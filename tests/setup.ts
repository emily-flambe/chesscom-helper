import { beforeEach } from 'vitest'
import type { TestEnv, TestD1Database, TestKVNamespace, MockD1Result } from './types'

// Test environment setup
beforeEach(async () => {
  // Reset any global state before each test
  // This is where you'd reset databases, clear caches, etc.
})

// Global test utilities
export const createTestEnv = (): TestEnv => ({
  DB: createMockD1Database(),
  CACHE: createMockKVNamespace(),
  JWT_SECRET: 'test-jwt-secret',
  CHESS_COM_API_URL: 'https://api.chess.com/pub',
  EMAIL_API_KEY: 'test-email-key',
  RESEND_API_KEY: 'test-resend-key'
})

export const createMockD1Database = (): TestD1Database => {
  const createMockResult = (): MockD1Result => ({
    results: [],
    success: true,
    meta: { duration: 0, rows_read: 0, rows_written: 0 }
  })

  return {
    prepare: (query: string) => ({
      bind: (...params: any[]) => ({
        bind: (...moreParams: any[]) => ({
          first: async () => null,
          all: async () => createMockResult(),
          run: async () => ({ ...createMockResult(), changes: 0 }),
          raw: async () => ({ query, params: [...params, ...moreParams] })
        }),
        first: async () => null,
        all: async () => createMockResult(),
        run: async () => ({ ...createMockResult(), changes: 0 }),
        raw: async () => ({ query, params })
      }),
      first: async () => null,
      all: async () => createMockResult(),
      run: async () => ({ ...createMockResult(), changes: 0 }),
      raw: async () => ({ query, params: [] })
    }),
    dump: async () => new ArrayBuffer(0),
    batch: async (statements: any[]) => statements.map(() => createMockResult()),
    exec: async (query: string) => ({ count: 0, duration: 0 }),
    withSession: (callback: (session: any) => Promise<any>) => callback({}),
    raw: (query: string, ...params: any[]) => ({ query, params })
  }
}

export const createMockKVNamespace = (): TestKVNamespace => ({
  get: async (key: string, options?: any) => null,
  put: async (key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: any) => undefined,
  delete: async (key: string) => undefined,
  list: async (options?: any) => ({ 
    keys: [], 
    list_complete: true, 
    cursor: '',
    cacheStatus: null
  }),
  getWithMetadata: async (key: string, options?: any) => ({ 
    value: null, 
    metadata: null,
    cacheStatus: null
  })
})

// Helper function to create a mock D1Database with custom behavior
export const createCustomMockD1Database = (options: {
  firstResult?: any
  allResults?: any[]
  runChanges?: number
} = {}): TestD1Database => {
  const { firstResult = null, allResults = [], runChanges = 0 } = options

  const createMockResult = (results: any[] = allResults): MockD1Result => ({
    results,
    success: true,
    meta: { duration: 0, rows_read: 0, rows_written: 0 }
  })

  return {
    prepare: (query: string) => ({
      bind: (...params: any[]) => ({
        bind: (...moreParams: any[]) => ({
          first: async () => firstResult,
          all: async () => createMockResult(),
          run: async () => ({ ...createMockResult(), changes: runChanges }),
          raw: async () => ({ query, params: [...params, ...moreParams] })
        }),
        first: async () => firstResult,
        all: async () => createMockResult(),
        run: async () => ({ ...createMockResult(), changes: runChanges }),
        raw: async () => ({ query, params })
      }),
      first: async () => firstResult,
      all: async () => createMockResult(),
      run: async () => ({ ...createMockResult(), changes: runChanges }),
      raw: async () => ({ query, params: [] })
    }),
    dump: async () => new ArrayBuffer(0),
    batch: async (statements: any[]) => statements.map(() => createMockResult()),
    exec: async (query: string) => ({ count: 0, duration: 0 }),
    withSession: (callback: (session: any) => Promise<any>) => callback({}),
    raw: (query: string, ...params: any[]) => ({ query, params })
  }
}

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

// Import types for tests
import './types'