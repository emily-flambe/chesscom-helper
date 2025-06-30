import { error } from 'itty-router'
import type { Env } from '../index'

const MAX_BODY_SIZE = 1024 * 1024 // 1MB
const REQUIRED_HEADERS = ['content-type']

export async function validateRequest(request: Request, env: Env): Promise<Response | void> {
  if (request.method === 'OPTIONS') {
    return
  }

  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('content-type')
    
    if (!contentType) {
      return error(400, 'Content-Type header is required')
    }

    if (!contentType.includes('application/json')) {
      return error(400, 'Content-Type must be application/json')
    }

    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
      return error(413, 'Request body too large')
    }

    try {
      const clonedRequest = request.clone()
      const body = await clonedRequest.text()
      
      if (body.length > MAX_BODY_SIZE) {
        return error(413, 'Request body too large')
      }

      if (body.trim()) {
        JSON.parse(body)
      }
    } catch (err) {
      return error(400, 'Invalid JSON in request body')
    }
  }

  const userAgent = request.headers.get('user-agent')
  if (!userAgent) {
    return error(400, 'User-Agent header is required')
  }

  if (userAgent.length > 500) {
    return error(400, 'User-Agent header too long')
  }
}