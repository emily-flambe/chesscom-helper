import { beforeEach } from 'vitest'

// Test environment setup
beforeEach(async () => {
  // Reset any global state before each test
  // This is where you'd reset databases, clear caches, etc.
})

// Global test utilities
export const createTestEnv = (): Env => ({
  DB: createMockD1Database(),
  CACHE: createMockKVNamespace(),
  JWT_SECRET: 'test-jwt-secret',
  CHESS_COM_API_URL: 'https://api.chess.com/pub',
  EMAIL_API_KEY: 'test-email-key',
  RESEND_API_KEY: 'test-resend-key'
})

export const createMockD1Database = (): D1Database => ({
  prepare: (query: string) => ({
    bind: (...params: any[]) => ({
      first: async () => null,
      all: async () => ({ results: [] }),
      run: async () => ({ success: true, meta: { changes: 0 } }),
      raw: async () => []
    }),
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => ({ success: true, meta: { changes: 0 } }),
    raw: async () => []
  }),
  dump: async () => new ArrayBuffer(0),
  batch: async () => [],
  exec: async () => ({ count: 0, duration: 0 }),
  withSession: async (fn: any) => await fn()
})

export const createMockKVNamespace = (): KVNamespace => ({
  get: async () => null,
  put: async () => undefined,
  delete: async () => undefined,
  list: async () => ({ 
    keys: [], 
    list_complete: true, 
    cursor: '',
    cacheStatus: null
  }),
  getWithMetadata: async () => ({ 
    value: null, 
    metadata: null,
    cacheStatus: null
  })
})

export const createMockRequest = (url: string, options: RequestInit = {}): Request => {
  return new Request(url, {
    method: 'GET',
    ...options
  })
}

export const createTestUser = () => ({
  id: 'test-user-id',
  email: 'test@example.com',
  passwordHash: 'hashed-password',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
})

export const createTestPlayerSubscription = () => ({
  id: 'test-subscription-id',
  userId: 'test-user-id',
  chessComUsername: 'testplayer',
  createdAt: new Date().toISOString()
})

// Type declarations for tests
declare global {
  interface Env {
    DB: D1Database
    CACHE: KVNamespace
    JWT_SECRET: string
    CHESS_COM_API_URL: string
    EMAIL_API_KEY: string
    RESEND_API_KEY: string
  }
}