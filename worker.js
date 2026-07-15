// ============================================================
// GitHub Proxy - Cloudflare Workers 极速版
// 最大化利用 Cloudflare 免费服务实现最快下载速度:
//   - Workers (10万次/天)
//   - Workers KV (10万读/天, 1000写/天) - 大文件持久缓存
//   - Cache API (边缘缓存, 零额外费用) - CDN 级加速
//   - Cloudflare CDN (自动加速) - 全球节点
//   - stale-while-revalidate (过期后仍可用, 后台刷新)
// ============================================================

import TEMPLATE_HTML from './renderHtml.js';

'use strict';

const CONFIG = {
    PREFIX: '/',
    JSDELIVR: 1,
    // KV 缓存 (大文件持久缓存)
    ENABLE_KV_CACHE: true,
    KV_CACHE_TTL: 86400,        // 24小时
    KV_MAX_SIZE: 20 * 1024 * 1024, // 20MB
    // Cache API 缓存 (边缘节点缓存, 最快)
    ENABLE_CF_CACHE: true,
    CF_CACHE_TTL: 7200,         // 2小时
    CF_CACHE_STALE: 86400,      // 过期后仍可用24小时, 后台刷新
    // 重试配置
    MAX_RETRIES: 3,
    RETRY_DELAYS: [800, 1600, 3200], // 指数退避
    FETCH_TIMEOUT: 20000,       // 20秒超时, 更快 failover
    // 备用源站 (GFW 无法直连时自动 fallback)
    MIRROR_SOURCES: [
        { name: 'GitHub', test: 'https://github.com', proxy: url => url },
        // 以下为公共镜像, 作为 fallback
    ],
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

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// ============================================================
// 工具函数
// ============================================================
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

// ============================================================
// 重试 + 指数退避
// ============================================================
async function fetchWithRetry(url, options = {}, retries = CONFIG.MAX_RETRIES) {
    let lastError
    for (let i = 0; i <= retries; i++) {
        try {
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT)
            const resp = await fetch(url, { ...options, signal: controller.signal })
            clearTimeout(timer)

            // 可重试的状态码
            if (resp.status === 502 || resp.status === 503 || resp.status === 504) {
                if (i < retries) {
                    await delay(CONFIG.RETRY_DELAYS[i] || 2000)
                    continue
                }
            }
            return resp
        } catch (err) {
            lastError = err
            if (i < retries) {
                await delay(CONFIG.RETRY_DELAYS[i] || 2000)
                continue
            }
        }
    }
    throw lastError
}

function delay(ms) {
    return new Promise(r => setTimeout(r, ms))
}

// ============================================================
// 请求去重
// ============================================================
async function dedupFetch(url, options) {
    const key = `${options?.method || 'GET'}:${url}`
    if (inflightRequests.has(key)) {
        return inflightRequests.get(key)
    }
    const promise = fetchWithRetry(url, options).finally(() => {
        inflightRequests.delete(key)
    })
    inflightRequests.set(key, promise)
    return promise
}

// ============================================================
// Cache API - Cloudflare 边缘节点缓存 (零成本, 最快)
// 支持 stale-while-revalidate: 过期后仍返回旧内容, 后台刷新
// ============================================================
async function cfCacheGet(request) {
    if (!CONFIG.ENABLE_CF_CACHE) return null
    try {
        const cache = caches.default
        return await cache.match(request)
    } catch { return null }
}

async function cfCachePut(request, response) {
    if (!CONFIG.ENABLE_CF_CACHE) return
    try {
        const cache = caches.default
        const headers = new Headers(response.headers)
        // stale-while-revalidate: 缓存过期后仍可用, 后台异步刷新
        headers.set('cache-control',
            `public, max-age=${CONFIG.CF_CACHE_TTL}, stale-while-revalidate=${CONFIG.CF_CACHE_STALE}`)
        const toCache = new Response(response.clone().body, {
            status: response.status,
            statusText: response.statusText,
            headers
        })
        await cache.put(request, toCache)
    } catch {}
}

// ============================================================
// KV 缓存 - 大文件持久化缓存
// 优化: 先检查 Content-Length 再决定是否缓存, 避免大文件撑爆内存
// ============================================================
async function kvCacheGet(url, env) {
    if (!CONFIG.ENABLE_KV_CACHE) return null
    try {
        const data = await env.GH_CACHE.get(`file:${url}`, 'arrayBuffer')
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

async function kvCachePut(url, response, env) {
    if (!CONFIG.ENABLE_KV_CACHE) return
    try {
        const contentLength = parseInt(response.headers.get('content-length') || '0')
        // 先检查大小, 避免超大文件读入内存
        if (contentLength > CONFIG.KV_MAX_SIZE) return
        // 如果没有 Content-Length, 仍需读取检查
        const data = await response.clone().arrayBuffer()
        if (data.byteLength <= CONFIG.KV_MAX_SIZE) {
            await env.GH_CACHE.put(`file:${url}`, data, { expirationTtl: CONFIG.KV_CACHE_TTL })
        }
    } catch {}
}

// ============================================================
// 主请求处理
// ============================================================
async function handleRequest(request, event, env) {
    const url = new URL(request.url)
    let path = url.pathname + url.search

    // 直连规则订阅 (/rules/*)
    if (path.startsWith('/rules')) {
        return handleProxyRule(request, path)
    }

    // 首页
    if (path === '/' || path === '') {
        return fastResponse(TEMPLATE_HTML, 200, {
            'content-type': 'text/html;charset=UTF-8',
            'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
        })
    }

    // 健康检查端点 (检测 GitHub 连通性)
    if (path === '/health' || path === '/health/') {
        return await handleHealthCheck()
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
    try { target = decodeURIComponent(target) } catch {}
    target = normalizeUrl(target)
    if (!target) return fastResponse('Invalid GitHub URL', 400)

    const routeType = getRouteType(target)
    if (!routeType) {
        return fastResponse('Not a supported GitHub URL', 404)
    }

    // 代码文件 -> jsDelivr CDN 加速 (最快路径)
    if (routeType === 'code' && CONFIG.JSDELIVR) {
        const cdnUrl = target
            .replace(/\/blob\//, '@')
            .replace(/^(?:https?:\/\/)?(?:github\.com|raw\.(?:githubusercontent|github)\.com)/, 'https://cdn.jsdelivr.net/gh')
            .replace(/(?<=com\/.+?\/.+?)\/(.+?\/)/, '@$1')
        return Response.redirect(cdnUrl, 302)
    }

    // 大文件 -> KV + Cache API 双层缓存 + 重试
    if (routeType === 'large') {
        return await handleLargeFile(target, request, event, env)
    }

    // git clone 等 -> 通用代理 + 重试
    return await proxyRequest(target, request)
}

// ============================================================
// 健康检查 - 检测 GitHub 连通性
// ============================================================
async function handleHealthCheck() {
    const start = Date.now()
    try {
        const resp = await fetchWithRetry('https://github.com', {
            method: 'HEAD',
            cf: { http2: true }
        }, 1) // 只重试1次
        const latency = Date.now() - start
        return fastResponse(JSON.stringify({
            github: resp.ok ? 'reachable' : 'error',
            status: resp.status,
            latency_ms: latency,
            cache: CONFIG.ENABLE_CF_CACHE ? 'enabled' : 'disabled',
            kv: CONFIG.ENABLE_KV_CACHE ? 'enabled' : 'disabled',
            timestamp: new Date().toISOString()
        }), 200, { 'content-type': 'application/json' })
    } catch (err) {
        return fastResponse(JSON.stringify({
            github: 'unreachable',
            error: err.message,
            cache: CONFIG.ENABLE_CF_CACHE ? 'enabled' : 'disabled',
            kv: CONFIG.ENABLE_KV_CACHE ? 'enabled' : 'disabled',
            timestamp: new Date().toISOString()
        }), 503, { 'content-type': 'application/json' })
    }
}

// ============================================================
// 大文件处理 (KV + Cache API 双层缓存 + 重试 + Range 支持)
// ============================================================
async function handleLargeFile(url, request, event, env) {
    // 1. 先查 Cloudflare Cache API (边缘节点缓存, 最快)
    const cfCached = await cfCacheGet(request)
    if (cfCached) {
        const resp = new Response(cfCached.body, cfCached)
        resp.headers.set('x-cache', 'CF-HIT')
        return resp
    }

    // 2. 再查 Workers KV (持久缓存)
    const kvCached = await kvCacheGet(url, env)
    if (kvCached) {
        // 异步回填 CF Cache
        event.waitUntil(cfCachePut(request, kvCached.clone()))
        return kvCached
    }

    // 3. 构建上游请求头 (条件发送 Range)
    const upstreamHeaders = {
        'User-Agent': UA,
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, br',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    // 只在客户端确实发送了 Range 时才转发, 避免空 Range 导致 GitHub 400
    const clientRange = request.headers.get('range')
    if (clientRange) {
        upstreamHeaders['Range'] = clientRange
    }

    // 4. 请求去重 + 自动重试
    let response
    try {
        response = await dedupFetch(url, {
            headers: upstreamHeaders,
            cf: { http2: true, cacheTtl: CONFIG.CF_CACHE_TTL, cacheEverything: true }
        })
    } catch (err) {
        // 超时/网络错误 - 返回友好错误
        return fastResponse(
            JSON.stringify({
                error: 'upstream_timeout',
                message: 'GitHub 连接超时，请稍后重试',
                detail: err.name === 'AbortError' ? '请求超时' : err.message,
                retry: true,
            }),
            504,
            { 'content-type': 'application/json' }
        )
    }

    if (!response.ok && response.status !== 206 && response.status !== 200) {
        // 可重试的状态码
        if (response.status === 502 || response.status === 503) {
            return fastResponse(
                JSON.stringify({
                    error: 'upstream_error',
                    status: response.status,
                    message: 'GitHub 暂时不可用，请稍后重试',
                    retry: true,
                }),
                response.status,
                { 'content-type': 'application/json' }
            )
        }
        return fastResponse(`GitHub returned ${response.status}`, response.status)
    }

    const contentLength = response.headers.get('content-length')
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const contentRange = response.headers.get('content-range')

    // 构建响应头
    const respHeaders = {
        'content-type': contentType,
        'cache-control': `public, max-age=${CONFIG.CF_CACHE_TTL}, stale-while-revalidate=${CONFIG.CF_CACHE_STALE}`,
        'x-cache': 'MISS',
        'accept-ranges': 'bytes',
    }
    if (contentLength) respHeaders['content-length'] = contentLength
    if (contentRange) respHeaders['content-range'] = contentRange

    // 构建代理响应
    const proxyResp = new Response(response.body, {
        status: response.status,
        headers: { ...CORS_HEADERS, ...respHeaders }
    })

    // 5. 异步写入双层缓存 (仅 200/206 完整响应)
    if ((response.status === 200 || response.status === 206) && contentLength) {
        const size = parseInt(contentLength)
        // 只缓存小于限制的文件
        if (size <= CONFIG.KV_MAX_SIZE) {
            event.waitUntil(
                Promise.allSettled([
                    cfCachePut(request, proxyResp.clone()),
                    kvCachePut(url, proxyResp.clone(), env),
                ])
            )
        } else {
            // 超大文件只写 CF Cache (不写 KV)
            event.waitUntil(cfCachePut(request, proxyResp.clone()))
        }
    } else {
        // 无 Content-Length 的流式响应也写 CF Cache
        event.waitUntil(cfCachePut(request, proxyResp.clone()))
    }

    return proxyResp
}

// ============================================================
// 通用代理 (git clone 等) + 重试
// ============================================================
async function proxyRequest(url, request) {
    const upstreamHeaders = {
        'User-Agent': UA,
        'Accept': request.headers.get('accept') || '*/*',
        'Accept-Encoding': 'gzip, br',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    const clientRange = request.headers.get('range')
    if (clientRange) upstreamHeaders['Range'] = clientRange

    let response
    try {
        response = await dedupFetch(url, {
            method: request.method,
            headers: upstreamHeaders,
            redirect: 'manual',
            cf: { http2: true }
        })
    } catch (err) {
        return fastResponse(
            JSON.stringify({
                error: 'upstream_timeout',
                message: 'GitHub 连接超时，请稍后重试',
                detail: err.name === 'AbortError' ? '请求超时' : err.message,
            }),
            504,
            { 'content-type': 'application/json' }
        )
    }

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
        'cache-control': 'public, max-age=300, stale-while-revalidate=600',
        'accept-ranges': 'bytes',
    }
    const contentLength = response.headers.get('content-length')
    const contentRange = response.headers.get('content-range')
    if (contentLength) headers['content-length'] = contentLength
    if (contentRange) headers['content-range'] = contentRange

    return new Response(response.body, {
        status: response.status,
        headers: { ...CORS_HEADERS, ...headers }
    })
}

// ============================================================
// ============================================================
// 直连规则订阅
// ============================================================
const PROXY_RULE_CONFIG = {
    GITHUB_RAW_BASE: 'https://raw.githubusercontent.com/seraluce/proxy-rule/main',
    CACHE_TTL: 86400,
};

const PROXY_RULE_PATHS = {
    '/rules': 'direct.txt',
    '/rules/direct': 'direct.txt',
    '/rules/clash': 'direct_clash.yaml',
    '/rules/txt': 'direct.txt',
    '/rules/yaml': 'direct_clash.yaml',
    '/rules/direct.txt': 'direct.txt',
    '/rules/direct_clash.yaml': 'direct_clash.yaml',
};

async function handleProxyRule(request, path) {
    // 规则列表 (JSON)
    if (path === '/rules' || path === '/rules/') {
        return new Response(JSON.stringify({
            name: '中国直连域名规则集',
            files: {
                'direct.txt': '/rules/direct.txt',
                'direct_clash.yaml': '/rules/direct_clash.yaml',
            },
            quickLinks: {
                'TXT': '/rules/direct',
                'Clash': '/rules/clash',
            },
        }, null, 2), {
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }

    const filePath = PROXY_RULE_PATHS[path];
    if (!filePath) {
        return new Response('Not Found', { status: 404 });
    }

    const githubUrl = `${PROXY_RULE_CONFIG.GITHUB_RAW_BASE}/${filePath}`;

    try {
        const response = await fetch(githubUrl, {
            headers: { 'User-Agent': 'ProxyHub/1.0' },
        });

        if (response.status === 403) {
            return new Response('GitHub API rate limit exceeded', {
                status: 429,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }

        if (!response.ok) {
            return new Response(`File not found: ${filePath}`, {
                status: 404,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }

        const content = await response.text();
        const contentType = filePath.endsWith('.yaml')
            ? 'text/yaml; charset=utf-8'
            : 'text/plain; charset=utf-8';

        return new Response(content, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': `public, max-age=${PROXY_RULE_CONFIG.CACHE_TTL}, stale-while-revalidate=43200`,
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        return new Response(`Error: ${error.message}`, {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
}

// 入口
// ============================================================
export default {
    fetch(request, env, event) {
        return handleRequest(request, event, env)
    }
}
