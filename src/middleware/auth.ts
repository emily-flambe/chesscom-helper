import { error } from 'itty-router'
import { verifyToken } from '../utils/jwt'
import type { Env } from '../index'

declare global {
  namespace globalThis {
    interface Request {
      user?: {
        id: string
        email: string
      }
    }
  }
}

export async function authenticateUser(request: Request, env: Env): Promise<Response | void> {
  const authHeader = request.headers.get('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(401, 'Missing or invalid authorization header')
  }

  const token = authHeader.substring(7)
  
  try {
    const payload = await verifyToken(token, env.JWT_SECRET)
    
    if (!payload || !payload.userId) {
      return error(401, 'Invalid token')
    }

    request.user = {
      id: payload.userId,
      email: payload.email || ''
    }

  } catch (err) {
    console.error('Token verification error:', err)
    return error(401, 'Invalid or expired token')
  }
}

// Middleware function for itty-router
export async function authenticate(request: Request, env: Env): Promise<Response | void> {
  return await authenticateUser(request, env)
}