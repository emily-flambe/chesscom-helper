import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authenticateUser } from '../src/middleware/auth'
import { validateRequest } from '../src/middleware/validation'
import { rateLimiter } from '../src/middleware/rateLimit'
import { createTestEnv, createMockRequest } from './setup'

describe('Middleware', () => {
  let env: Env

  beforeEach(() => {
    env = createTestEnv()
    vi.clearAllMocks()
  })

  describe('authenticateUser', () => {
    it('should reject request without authorization header', async () => {
      const request = createMockRequest('http://localhost/api/test')
      
      const response = await authenticateUser(request, env)
      
      expect(response).toBeDefined()
      expect(response?.status).toBe(401)
    })

    it('should reject request with invalid authorization format', async () => {
      const request = createMockRequest('http://localhost/api/test', {
        headers: { 'Authorization': 'Invalid token' }
      })
      
      const response = await authenticateUser(request, env)
      
      expect(response).toBeDefined()
      expect(response?.status).toBe(401)
    })

    it('should reject request with invalid token', async () => {
      const request = createMockRequest('http://localhost/api/test', {
        headers: { 'Authorization': 'Bearer invalid-token' }
      })
      
      const response = await authenticateUser(request, env)
      
      expect(response).toBeDefined()
      expect(response?.status).toBe(401)
    })

    it('should accept request with valid token', async () => {
      // Create a valid token
      const { generateToken } = await import('../src/utils/jwt')
      const token = await generateToken('test-user-id', env.JWT_SECRET)
      
      const request = createMockRequest('http://localhost/api/test', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      const response = await authenticateUser(request, env)
      
      expect(response).toBeUndefined()
      expect(request.user).toBeDefined()
      expect(request.user?.id).toBe('test-user-id')
    })
  })

  describe('validateRequest', () => {
    it('should pass OPTIONS requests without validation', async () => {
      const request = createMockRequest('http://localhost/api/test', {
        method: 'OPTIONS'
      })
      
      const response = await validateRequest(request, env)
      
      expect(response).toBeUndefined()
    })

    it('should require Content-Type for POST requests', async () => {
      const request = createMockRequest('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      })
      
      const response = await validateRequest(request, env)
      
      expect(response).toBeDefined()
      expect(response?.status).toBe(400)
    })

    it('should require application/json Content-Type', async () => {
      const request = createMockRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'test data'
      })
      
      const response = await validateRequest(request, env)
      
      expect(response).toBeDefined()
      expect(response?.status).toBe(400)
    })

    it('should reject invalid JSON', async () => {
      const request = createMockRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {'
      })
      
      const response = await validateRequest(request, env)
      
      expect(response).toBeDefined()
      expect(response?.status).toBe(400)
    })

    it('should require User-Agent header', async () => {
      const request = createMockRequest('http://localhost/api/test', {
        method: 'GET'
      })
      
      // Remove User-Agent header
      request.headers.delete('User-Agent')
      
      const response = await validateRequest(request, env)
      
      expect(response).toBeDefined()
      expect(response?.status).toBe(400)
    })

    it('should accept valid requests', async () => {
      const request = createMockRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'Test Client/1.0'
        },
        body: JSON.stringify({ test: 'data' })
      })
      
      const response = await validateRequest(request, env)
      
      expect(response).toBeUndefined()
    })
  })

  describe('rateLimiter', () => {
    it('should pass OPTIONS requests without rate limiting', async () => {
      const request = createMockRequest('http://localhost/api/test', {
        method: 'OPTIONS'
      })
      
      const response = await rateLimiter(request, env)
      
      expect(response).toBeUndefined()
    })

    it('should add rate limit headers to requests', async () => {
      const request = createMockRequest('http://localhost/api/test', {
        headers: { 'CF-Connecting-IP': '127.0.0.1' }
      })
      
      const response = await rateLimiter(request, env)
      
      expect(response).toBeUndefined()
      expect(request.headers.get('X-RateLimit-Limit')).toBeDefined()
      expect(request.headers.get('X-RateLimit-Remaining')).toBeDefined()
      expect(request.headers.get('X-RateLimit-Reset')).toBeDefined()
    })

    it('should use different limits for auth endpoints', async () => {
      const authRequest = createMockRequest('http://localhost/api/v1/auth/login', {
        headers: { 'CF-Connecting-IP': '127.0.0.1' }
      })
      
      const apiRequest = createMockRequest('http://localhost/api/v1/users/me', {
        headers: { 'CF-Connecting-IP': '127.0.0.1' }
      })
      
      await rateLimiter(authRequest, env)
      await rateLimiter(apiRequest, env)
      
      // Auth endpoints should have lower limits
      const authLimit = authRequest.headers.get('X-RateLimit-Limit')
      const apiLimit = apiRequest.headers.get('X-RateLimit-Limit')
      
      expect(parseInt(authLimit || '0')).toBeLessThan(parseInt(apiLimit || '0'))
    })

    it('should handle rate limit exceeded gracefully', async () => {
      // Mock KV to simulate rate limit exceeded
      const mockKV = {
        ...env.CACHE,
        get: async (key: string) => {
          // Return enough requests to exceed limit
          const requests = Array(20).fill(Math.floor(Date.now() / 1000))
          return JSON.stringify(requests)
        }
      }
      
      env.CACHE = mockKV
      
      const request = createMockRequest('http://localhost/api/v1/auth/login', {
        headers: { 'CF-Connecting-IP': '127.0.0.1' }
      })
      
      const response = await rateLimiter(request, env)
      
      expect(response).toBeDefined()
      expect(response?.status).toBe(429)
    })
  })
})