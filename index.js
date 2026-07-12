// ============================================================
// GitHub Proxy - Cloudflare Workers 优化版
// 最大化利用 Cloudflare 免费服务:
//   - Workers (10万次/天)
//   - Workers KV (10万读/天, 1000写/天)
//   - Cache API (边缘缓存, 零额外费用)
//   - Cloudflare CDN (自动加速)
// ============================================================

import INDEX_HTML from './html.js'

'use strict'

const CONFIG = {
    PREFIX: '/',
    JSDELIVR: 1,
    // KV 缓存 (大文件持久缓存)
    ENABLE_KV_CACHE: true,
    KV_CACHE_TTL: 86400,
    KV_MAX_SIZE: 20 * 1024 * 1024, // 20MB
    // Cache API 缓存 (边缘节点缓存)
    ENABLE_CF_CACHE: true,
    CF_CACHE_TTL: 3600,
    // 通用
    FETCH_TIMEOUT: 30000,
    MAX_REDIRECTS: 5,
}

const ROUTES = {
    LARGE: /^(?:https?:\/\/)?(?:github\.com\/.+?\/.+?\/(?:releases(?:\/download)?|archive)\/|gist\.github(?:usercontent)?\.com\/.+?\/.+?\/.+)/i,
    CODE: /^(?:https?:\/\/)?(?:github\.com\/.+?\/.+?\/(?:blob|raw)\/|raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+)/i,
    OTHER: /^(?:https?:\/\/)?(?:github\.com\/.+?\/.+?\/(?:info|git-|tags).*)/i
}

const CORS_HEADERS = {
    'access-control-allow-origin': '*',
    'access-control-expose-headers': '*',
    'access-control-allow-methods': 'GET,HEAD,OPTIONS',
    'access-control-max-age': '86400',
}

// 请求去重: 相同 URL 的并发请求共享同一个 fetch Promise
const inflightRequests = new Map()

function getRouteType(path) {
    if (ROUTES.LARGE.test(path)) return 'large'
    if (ROUTES.CODE.test(path)) return 'code'
    if (ROUTES.OTHER.test(path)) return 'other'
    return null
}

function fastResponse(body, status = 200, headers = {}) {
    return new Response(body, {
        status,
        headers: { ...CORS_HEADERS, ...headers }
    })
}

function isGitHubUrl(url) {
    return /github\.com|githubusercontent\.com/i.test(url)
}

function normalizeUrl(target) {
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = 'https://' + target
    }
    try {
        const u = new URL(target)
        if (!u.hostname.endsWith('github.com') && !u.hostname.endsWith('githubusercontent.com')) {
            return null
        }
        return u.href
    } catch {
        return null
    }
}

function fetchWithTimeout(url, options = {}, timeout = CONFIG.FETCH_TIMEOUT) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer))
}

async function dedupFetch(url, options) {
    const key = `${options?.method || 'GET'}:${url}`
    if (inflightRequests.has(key)) {
        return inflightRequests.get(key)
    }
    const promise = fetchWithTimeout(url, options).finally(() => {
        inflightRequests.delete(key)
    })
    inflightRequests.set(key, promise)
    return promise
}

// ============================================================
// Cache API - Cloudflare 边缘节点缓存 (零成本)
// ============================================================
async function cfCacheGet(request) {
    if (!CONFIG.ENABLE_CF_CACHE) return null
    const cache = caches.default
    return await cache.match(request)
}

async function cfCachePut(request, response) {
    if (!CONFIG.ENABLE_CF_CACHE) return
    try {
        const cache = caches.default
        const cloned = response.clone()
        // 设置 Cache-Control 以控制 Cloudflare CDN 缓存行为
        const headers = new Headers(cloned.headers)
        headers.set('cache-control', `public, max-age=${CONFIG.CF_CACHE_TTL}`)
        const toCache = new Response(cloned.body, {
            status: cloned.status,
            statusText: cloned.statusText,
            headers
        })
        await cache.put(request, toCache)
    } catch {}
}

// ============================================================
// KV 缓存 - 大文件持久化缓存
// ============================================================
async function kvCacheGet(url) {
    if (!CONFIG.ENABLE_KV_CACHE) return null
    try {
        const data = await GH_CACHE.get(`file:${url}`, 'arrayBuffer')
        if (!data) return null
        return new Response(data, {
            headers: {
                'content-type': 'application/octet-stream',
                'cache-control': `public, max-age=${CONFIG.KV_CACHE_TTL}`,
                'x-cache': 'KV-HIT',
            }
        })
    } catch { return null }
}

async function kvCachePut(url, response) {
    if (!CONFIG.ENABLE_KV_CACHE) return
    try {
        const cloned = response.clone()
        const data = await cloned.arrayBuffer()
        if (data.byteLength <= CONFIG.KV_MAX_SIZE) {
            await GH_CACHE.put(`file:${url}`, data, { expirationTtl: CONFIG.KV_CACHE_TTL })
        }
    } catch {}
}

// ============================================================
// 主请求处理
// ============================================================
async function handleRequest(request, event) {
    const url = new URL(request.url)
    let path = url.pathname + url.search

    // 首页
    if (path === '/' || path === '') {
        return fastResponse(INDEX_HTML, 200, {
            'content-type': 'text/html;charset=UTF-8',
            'cache-control': 'public, max-age=300',
        })
    }

    // ?q= 查询参数跳转
    const queryUrl = url.searchParams.get('q')
    if (queryUrl) {
        const target = normalizeUrl(queryUrl)
        if (!target) return fastResponse('Invalid URL', 400)
        return Response.redirect(url.origin + CONFIG.PREFIX + queryUrl, 301)
    }

    // OPTIONS 预检
    if (request.method === 'OPTIONS') {
        return fastResponse(null, 204)
    }

    // 提取目标 URL
    let target = path.slice(CONFIG.PREFIX.length)
    // 支持编码的 URL
    try { target = decodeURIComponent(target) } catch {}
    target = normalizeUrl(target)
    if (!target) return fastResponse('Invalid GitHub URL', 400)

    const routeType = getRouteType(target)
    if (!routeType) {
        return fastResponse('Not a supported GitHub URL', 404)
    }

    // 代码文件 -> jsDelivr CDN 加速
    if (routeType === 'code' && CONFIG.JSDELIVR) {
        const cdnUrl = target
            .replace(/\/blob\//, '@')
            .replace(/^(?:https?:\/\/)?(?:github\.com|raw\.(?:githubusercontent|github)\.com)/, 'https://cdn.jsdelivr.net/gh')
            .replace(/(?<=com\/.+?\/.+?)\/(.+?\/)/, '@$1')
        return Response.redirect(cdnUrl, 302)
    }

    // 大文件 -> KV + Cache API 双缓存
    if (routeType === 'large') {
        return await handleLargeFile(target, request, event)
    }

    // 其他 -> 通用代理
    return await proxyRequest(target, request)
}

// ============================================================
// 大文件处理 (KV + Cache API 双层缓存)
// ============================================================
async function handleLargeFile(url, request, event) {
    // 1. 先查 Cloudflare Cache API (边缘节点缓存, 最快)
    const cfCached = await cfCacheGet(request)
    if (cfCached) {
        const resp = new Response(cfCached.body, cfCached)
        resp.headers.set('x-cache', 'CF-HIT')
        return resp
    }

    // 2. 再查 Workers KV (持久缓存)
    const kvCached = await kvCacheGet(url)
    if (kvCached) {
        // 异步回填 CF Cache
        event.waitUntil(cfCachePut(request, kvCached.clone()))
        return kvCached
    }

    // 3. 请求去重: 并发请求同一文件只发一次
    const response = await dedupFetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Range': request.headers.get('range') || '',
        },
        cf: { http2: true, cacheTtl: CONFIG.CF_CACHE_TTL }
    })

    if (!response.ok) {
        return fastResponse(`GitHub returned ${response.status}`, response.status)
    }

    const contentLength = response.headers.get('content-length')
    const contentType = response.headers.get('content-type') || 'application/octet-stream'

    // 构建响应头
    const respHeaders = {
        'content-type': contentType,
        'cache-control': `public, max-age=${CONFIG.CF_CACHE_TTL}`,
        'x-cache': 'MISS',
        'accept-ranges': 'bytes',
    }
    if (contentLength) respHeaders['content-length'] = contentLength

    const proxyResp = new Response(response.body, {
        status: response.status,
        headers: { ...CORS_HEADERS, ...respHeaders }
    })

    // 4. 异步写入双层缓存
    event.waitUntil(
        Promise.allSettled([
            cfCachePut(request, proxyResp.clone()),
            kvCachePut(url, proxyResp.clone()),
        ])
    )

    return proxyResp
}

// ============================================================
// 通用代理 (git clone 等)
// ============================================================
async function proxyRequest(url, request) {
    const response = await dedupFetch(url, {
        method: request.method,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': request.headers.get('accept') || '*/*',
            'Accept-Encoding': 'gzip, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Range': request.headers.get('range') || '',
        },
        redirect: 'manual',
        cf: { http2: true }
    })

    // 重写 GitHub 重定向
    if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
        const location = response.headers.get('location')
        if (location) {
            if (isGitHubUrl(location)) {
                return Response.redirect(url + CONFIG.PREFIX + location, response.status)
            }
            return Response.redirect(location, response.status)
        }
    }

    const headers = {
        'content-type': response.headers.get('content-type') || 'application/octet-stream',
        'cache-control': 'public, max-age=300',
        'accept-ranges': 'bytes',
    }
    const contentLength = response.headers.get('content-length')
    if (contentLength) headers['content-length'] = contentLength

    return new Response(response.body, {
        status: response.status,
        headers: { ...CORS_HEADERS, ...headers }
    })
}

// ============================================================
// 入口
// ============================================================
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request, event))
})
