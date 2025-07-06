// Type declarations for test environment
/// <reference types="vitest/globals" />
/// <reference types="@cloudflare/workers-types" />

// Define D1Result interface that matches what Cloudflare Workers provides
export interface MockD1Result<T = any> {
  results: T[]
  success: boolean
  meta: {
    duration: number
    rows_read: number
    rows_written: number
  }
  changes?: number
}

// Mock types for testing that match the official Cloudflare Workers types
export interface TestD1PreparedStatement {
  bind(...params: any[]): TestD1PreparedStatement
  first<T = any>(): Promise<T | null>
  all<T = any>(): Promise<MockD1Result<T>>
  run(): Promise<MockD1Result>
  raw<T = any>(): Promise<T>
}

export interface TestD1Database {
  prepare(query: string): TestD1PreparedStatement
  batch(statements: TestD1PreparedStatement[]): Promise<MockD1Result[]>
  exec(query: string): Promise<any>
  dump(): Promise<ArrayBuffer>
  withSession<T>(callback: (session: any) => Promise<T>): Promise<T>
  raw(query: string, ...params: any[]): any
}

export interface TestKVNamespace {
  get(key: string, options?: any): Promise<string | null>
  put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: any): Promise<void>
  delete(key: string): Promise<void>
  list(options?: any): Promise<{
    keys: any[]
    list_complete: boolean
    cursor: string
    cacheStatus: string | null
  }>
  getWithMetadata(key: string, options?: any): Promise<{
    value: any
    metadata: any
    cacheStatus: string | null
  }>
}

// Test environment interface - matches main application's Env interface
export interface TestEnv {
  DB: TestD1Database
  CACHE: TestKVNamespace
  JWT_SECRET: string
  CHESS_COM_API_URL: string
  EMAIL_API_KEY: string
  RESEND_API_KEY: string
}