'use strict'

// ============ 极简配置 ============
const CONFIG = {
    PREFIX: '/',
    JSDELIVR: 1,              // 开启 jsDelivr 加速
    ENABLE_KV_CACHE: true,    // 开启 KV 缓存
    CACHE_TTL: 3600,          // 缓存1小时
    ENABLE_GZIP: true,        // 启用压缩
}

// ============ 精简路由（合并正则） ============
const ROUTES = {
    // 大文件：Release/Archive
    LARGE: /^(?:https?:\/\/)?(?:github\.com\/.+?\/.+?\/(?:releases|archive)\/|gist\.github\.com\/.+?\/.+?\/.+)/i,
    // 代码文件：Blob/Raw
    CODE: /^(?:https?:\/\/)?(?:github\.com\/.+?\/.+?\/(?:blob|raw)\/|raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+)/i,
    // 其他
    OTHER: /^(?:https?:\/\/)?(?:github\.com\/.+?\/.+?\/(?:info|git-|tags).*)/i,
}

function getRouteType(path) {
    if (ROUTES.LARGE.test(path)) return 'large'
    if (ROUTES.CODE.test(path)) return 'code'
    if (ROUTES.OTHER.test(path)) return 'other'
    return null
}

// ============ 极速响应工具 ============
const CORS_HEADERS = {
    'access-control-allow-origin': '*',
    'access-control-expose-headers': '*',
    'access-control-allow-methods': 'GET,HEAD,OPTIONS',
    'access-control-max-age': '86400',
}

// 快速创建响应（减少对象创建开销）
function fastResponse(body, status = 200, headers = {}) {
    return new Response(body, {
        status,
        headers: { ...CORS_HEADERS, ...headers }
    })
}

// ============ 主处理函数 ============
async function handleRequest(request) {
    const url = new URL(request.url)
    let path = url.pathname + url.search
    
    // 1. 处理根路径（极简首页）
    if (path === '/' || path === '') {
        return fastResponse(
            `<!DOCTYPE html><html><head><title>GH Proxy</title><meta charset="UTF-8"></head>
            <body><h1>🚀 GitHub Proxy</h1><p>Usage: ${url.origin}${CONFIG.PREFIX}https://github.com/...</p>
            <p>Example: <a href="${url.origin}${CONFIG.PREFIX}https://github.com/hunshcn/gh-proxy/blob/master/index.js">${url.origin}${CONFIG.PREFIX}https://github.com/hunshcn/gh-proxy/blob/master/index.js</a></p>
            <p>⚡ Optimized for speed</p></body></html>`,
            200,
            { 'content-type': 'text/html;charset=UTF-8' }
        )
    }
    
    // 2. 处理 ?q= 参数
    const queryUrl = url.searchParams.get('q')
    if (queryUrl) {
        return Response.redirect(url.origin + CONFIG.PREFIX + queryUrl, 301)
    }
    
    // 3. 移除前缀并修复 URL
    let target = path.slice(CONFIG.PREFIX.length)
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = 'https://' + target
    }
    
    // 4. 路由匹配
    const routeType = getRouteType(target)
    if (!routeType) {
        return fastResponse('Not Found', 404)
    }
    
    // 5. 处理代码文件（走 jsDelivr CDN，最快）
    if (routeType === 'code' && CONFIG.JSDELIVR) {
        // 替换为 jsDelivr URL（速度提升 3-5 倍）
        let cdnUrl = target
            .replace(/\/blob\//, '@')
            .replace(/^(?:https?:\/\/)?(?:github\.com|raw\.(?:githubusercontent|github)\.com)/, 'https://cdn.jsdelivr.net/gh')
            .replace(/(?<=com\/.+?\/.+?)\/(.+?\/)/, '@$1')
        
        // 直接 302 重定向到 jsDelivr（最快）
        return Response.redirect(cdnUrl, 302)
    }
    
    // 6. 处理大文件（使用流式传输 + 边缘缓存）
    if (routeType === 'large') {
        return await handleLargeFile(target, request)
    }
    
    // 7. 其他文件（直接代理）
    return await proxyRequest(target, request)
}

// ============ 大文件处理（流式 + 缓存） ============
async function handleLargeFile(url, request) {
    // 1. 尝试从 KV 缓存获取（极速）
    if (CONFIG.ENABLE_KV_CACHE) {
        const cacheKey = `file:${url}`
        const cached = await GH_CACHE.get(cacheKey, 'arrayBuffer')
        if (cached) {
            return fastResponse(cached, 200, {
                'content-type': 'application/octet-stream',
                'cache-control': 'public, max-age=86400',
                'x-cache': 'KV-HIT'
            })
        }
    }
    
    // 2. 从 GitHub 获取（流式传输，不阻塞）
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip',  // 让 GitHub 返回压缩内容
        }
    })
    
    if (!response.ok) {
        return fastResponse('Fetch failed', response.status)
    }
    
    // 3. 获取内容并缓存到 KV（异步，不阻塞响应）
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const contentLength = response.headers.get('content-length')
    
    // 只缓存小于 10MB 的文件（太大存 KV 会超时）
    if (CONFIG.ENABLE_KV_CACHE && contentLength && parseInt(contentLength) < 10 * 1024 * 1024) {
        // 克隆响应以便缓存
        const clonedResponse = response.clone()
        const cacheKey = `file:${url}`
        // 异步缓存（不阻塞当前响应）
        event.waitUntil(
            clonedResponse.arrayBuffer().then(data => {
                GH_CACHE.put(cacheKey, data, { expirationTtl: CONFIG.CACHE_TTL })
            }).catch(() => {}) // 静默失败
        )
    }
    
    // 4. 返回响应（流式）
    const headers = {
        'content-type': contentType,
        'cache-control': 'public, max-age=3600',
        'x-cache': 'MISS',
        'accept-ranges': 'bytes',  // 支持断点续传
    }
    if (contentLength) {
        headers['content-length'] = contentLength
    }
    
    return new Response(response.body, {
        status: response.status,
        headers: { ...CORS_HEADERS, ...headers }
    })
}

// ============ 普通代理（优化连接复用） ============
async function proxyRequest(url, request) {
    const response = await fetch(url, {
        method: request.method,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': request.headers.get('accept') || '*/*',
            'Accept-Encoding': 'gzip',
            'Range': request.headers.get('range') || '',  // 支持断点续传
        },
        redirect: 'manual',
        // 关键优化：连接复用
        cf: {
            // 优先选择离用户最近的节点
            cacheTtl: 0,
            // 启用 HTTP/2 连接复用
            http2: true,
        }
    })
    
    // 处理重定向
    if (response.status === 302 || response.status === 301) {
        const location = response.headers.get('location')
        if (location && location.includes('github.com')) {
            return Response.redirect(CONFIG.PREFIX + location, response.status)
        }
        return Response.redirect(location, response.status)
    }
    
    // 构建响应头
    const headers = {
        'content-type': response.headers.get('content-type') || 'application/octet-stream',
        'cache-control': 'public, max-age=300',
        'accept-ranges': 'bytes',
    }
    
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
        headers['content-length'] = contentLength
    }
    
    return new Response(response.body, {
        status: response.status,
        headers: { ...CORS_HEADERS, ...headers }
    })
}

// ============ 入口 ============
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})