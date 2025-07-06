import { error } from 'itty-router'
import type { Env } from '../index'

const RATE_LIMITS = {
  default: { requests: 100, window: 3600 }, // 100 requests per hour
  auth: { requests: 10, window: 900 },     // 10 requests per 15 minutes
  api: { requests: 1000, window: 3600 }    // 1000 requests per hour for authenticated users
}

export async function rateLimiter(request: Request, env: Env): Promise<Response | void> {
  if (request.method === 'OPTIONS') {
    return
  }

  const clientId = getClientId(request)
  const endpoint = getEndpointType(request.url)
  const limit = RATE_LIMITS[endpoint] || RATE_LIMITS.default

  const key = `rate_limit:${endpoint}:${clientId}`
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - limit.window

  try {
    const current = await env.CACHE.get(key)
    let requests: number[] = current ? JSON.parse(current) : []

    requests = requests.filter(timestamp => timestamp > windowStart)

    if (requests.length >= limit.requests) {
      const resetTime = requests[0] + limit.window
      return error(429, 'Rate limit exceeded', {
        headers: {
          'Retry-After': String(resetTime - now),
          'X-RateLimit-Limit': String(limit.requests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetTime)
        }
      })
    }

    requests.push(now)
    await env.CACHE.put(key, JSON.stringify(requests), { expirationTtl: limit.window })

    const remaining = limit.requests - requests.length
    const resetTime = requests[0] + limit.window

    request.headers.set('X-RateLimit-Limit', String(limit.requests))
    request.headers.set('X-RateLimit-Remaining', String(remaining))
    request.headers.set('X-RateLimit-Reset', String(resetTime))

  } catch (err) {
    console.error('Rate limiting error:', err)
  }
}

function getClientId(request: Request): string {
  const forwarded = request.headers.get('CF-Connecting-IP') ||
                   request.headers.get('X-Forwarded-For') ||
                   request.headers.get('X-Real-IP')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return `user:${authHeader.substring(7, 20)}`
  }

  return 'anonymous'
}

function getEndpointType(url: string): keyof typeof RATE_LIMITS {
  if (url.includes('/auth/')) {
return 'auth'
}
  if (url.includes('/api/')) {
return 'api'
}
  return 'default'
}