import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authRoutes } from '../src/routes/auth'
import { createTestEnv, createMockRequest, createCustomMockD1Database } from './setup'
import type { TestEnv } from './types'

describe('Authentication Routes', () => {
  let env: TestEnv

  beforeEach(() => {
    env = createTestEnv()
    vi.clearAllMocks()
  })

  describe('POST /register', () => {
    it('should register a new user successfully', async () => {
      // Mock DB with no existing user (first returns null) and successful run
      env.DB = createCustomMockD1Database({
        firstResult: null, // No existing user
        runChanges: 1 // Successful insert
      })

      const request = createMockRequest('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'TestPass123!'
        })
      })

      const response = await authRoutes.handle(request, env)
      expect(response.status).toBe(201)

      const data = await response.json()
      expect(data).toHaveProperty('userId')
      expect(data).toHaveProperty('token')
      expect(data.email).toBe('test@example.com')
    })

    it('should reject invalid email format', async () => {
      const request = createMockRequest('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'TestPass123!'
        })
      })

      const response = await authRoutes.handle(request, env)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error.message).toContain('Invalid email format')
    })

    it('should reject weak passwords', async () => {
      const request = createMockRequest('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'weak'
        })
      })

      const response = await authRoutes.handle(request, env)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error.message).toContain('Password must be at least 8 characters')
    })

    it('should reject duplicate email registration', async () => {
      // Mock DB with existing user found
      env.DB = createCustomMockD1Database({
        firstResult: { id: 'existing-user' }, // Existing user found
        runChanges: 0
      })

      const request = createMockRequest('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'TestPass123!'
        })
      })

      const response = await authRoutes.handle(request, env)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error.message).toContain('User already exists')
    })
  })

  describe('POST /login', () => {
    it('should login with valid credentials', async () => {
      // Mock DB with valid user data
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        password_hash: await import('../src/utils/crypto').then(m => m.hashPassword('TestPass123!')),
        created_at: new Date().toISOString()
      }
      
      env.DB = createCustomMockD1Database({
        firstResult: mockUser,
        runChanges: 0
      })

      const request = createMockRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'TestPass123!'
        })
      })

      const response = await authRoutes.handle(request, env)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('token')
      expect(data.user.email).toBe('test@example.com')
    })

    it('should reject invalid credentials', async () => {
      // Mock DB with no user found
      env.DB = createCustomMockD1Database({
        firstResult: null, // No user found
        runChanges: 0
      })

      const request = createMockRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
      })

      const response = await authRoutes.handle(request, env)
      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data.error.message).toContain('Invalid credentials')
    })
  })

  describe('POST /logout', () => {
    it('should logout successfully', async () => {
      const request = createMockRequest('http://localhost/api/v1/auth/logout', {
        method: 'POST'
      })

      const response = await authRoutes.handle(request, env)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.message).toContain('Logged out successfully')
    })
  })

  describe('POST /forgot-password', () => {
    it('should handle forgot password request', async () => {
      const request = createMockRequest('http://localhost/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com'
        })
      })

      const response = await authRoutes.handle(request, env)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.message).toContain('reset email will be sent')
    })

    it('should reject invalid email format for forgot password', async () => {
      const request = createMockRequest('http://localhost/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email'
        })
      })

      const response = await authRoutes.handle(request, env)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error.message).toContain('Invalid email format')
    })
  })
})