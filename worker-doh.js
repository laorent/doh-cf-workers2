addEventListener('fetch', event => {
    event.respondWith(handleRequest(event))
})

// 处理请求的主函数
async function handleRequest(event) {
    const request = event.request
    const url = new URL(request.url)

    // 验证请求路径是否有效
    if (!isValidPath(url.pathname)) {
        return new Response('Not found', { status: 404 })
    }

    // 验证请求方法是否有效
    if (!isValidMethod(request.method)) {
        return new Response('Method not allowed', { status: 405 })
    }

    // 使用缓存机制
    const cache = caches.default
    let response = await cache.match(request)
    if (!response) {
        // 如果缓存中没有响应，则发起新的请求
        response = await fetchDNSResponse(request)

        // 如果响应有效，将其存入缓存
        if (response) {
            event.waitUntil(cache.put(request, response.clone()))
        } else {
            // 如果请求失败，返回 502 错误
            return new Response('Error fetching DNS query', { status: 502 })
        }
    }

    // 返回响应
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
    })
}

// 验证请求路径
function isValidPath(pathname) {
    return pathname === '/dns-query'
}

// 验证请求方法
function isValidMethod(method) {
    return method === 'GET' || method === 'POST'
}

// 发起 DNS 请求的函数
async function fetchDNSResponse(request) {
    const dohServerUrl = 'https://dns.google/dns-query'
    const newRequest = new Request(dohServerUrl, {
        method: request.method,
        headers: filterHeaders(request.headers),
        body: request.body,
        redirect: 'follow'
    })

    try {
        // 发起请求并处理响应
        let response = await fetch(newRequest)

        // 设置必要的响应头
        const headers = new Headers(response.headers)
        headers.set('Cache-Control', 'max-age=3600')
        headers.set('Content-Security-Policy', "default-src 'none'")
        headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
        headers.set('X-Content-Type-Options', 'nosniff')
        headers.set('X-Frame-Options', 'DENY')

        // 返回新的响应
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: headers
        })
    } catch (error) {
        // 处理错误并返回 null
        return null
    }
}

// 过滤请求头，只保留必要的头部信息
function filterHeaders(headers) {
    const necessaryHeaders = new Headers()
    if (headers.has('Content-Type')) necessaryHeaders.set('Content-Type', headers.get('Content-Type'))
    if (headers.has('Accept')) necessaryHeaders.set('Accept', headers.get('Accept'))
    return necessaryHeaders
}
