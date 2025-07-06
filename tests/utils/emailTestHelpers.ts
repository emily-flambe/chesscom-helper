/**
 * Email Test Helpers
 * Utility functions for testing email delivery system
 */

import { vi, type MockedFunction } from 'vitest'
import type {
  EmailQueueItem,
  EmailQueueCreateInput,
  EmailBatch,
  EmailProcessingResult,
  EmailBatchProcessingResult,
  EmailQueueStatistics,
  EmailQueueHealthStatus,
  EmailTemplateData
} from '../../src/models/emailQueue'
import type { EmailRetryDecision, EmailRetryContext } from '../../src/models/emailRetryPolicy'
import type { EmailTemplateService } from '../../src/services/emailTemplateService'
import type { ResendService } from '../../src/services/resendService'
import type { EmailRetryService } from '../../src/services/emailRetryService'
import { testResendResponses, testWebhookPayloads, testErrorScenarios } from '../fixtures/emailTestData'

/**
 * Mock D1 Database for email queue operations
 */
export function createMockEmailQueueDatabase() {
  const mockResults = new Map<string, any>()
  
  return {
    prepare: (query: string) => ({
      bind: (...params: any[]) => ({
        first: async () => mockResults.get('first') || null,
        all: async () => ({ results: mockResults.get('all') || [] }),
        run: async () => ({ success: true, changes: mockResults.get('changes') || 1 })
      }),
      first: async () => mockResults.get('first') || null,
      all: async () => ({ results: mockResults.get('all') || [] }),
      run: async () => ({ success: true, changes: mockResults.get('changes') || 1 })
    }),
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    
    // Helper methods for testing
    setMockResult: (key: string, value: any) => mockResults.set(key, value),
    clearMockResults: () => mockResults.clear(),
    getMockResults: () => mockResults
  }
}

/**
 * Mock Email Template Service
 */
export function createMockEmailTemplateService(): EmailTemplateService {
  return {
    renderTemplate: vi.fn().mockResolvedValue({
      subject: 'Test Email Subject',
      html: '<div>Test HTML Content</div>',
      text: 'Test text content'
    }),
    validateTemplate: vi.fn().mockResolvedValue(true),
    getTemplate: vi.fn().mockResolvedValue({
      id: 'test-template',
      name: 'Test Template',
      subject: 'Test Subject',
      htmlContent: '<div>Test HTML</div>',
      textContent: 'Test text'
    }),
    listTemplates: vi.fn().mockResolvedValue([])
  } as any
}

/**
 * Mock Resend Service
 */
export function createMockResendService(): ResendService {
  return {
    sendEmail: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'resend-msg-123'
    }),
    validateWebhook: vi.fn().mockReturnValue(true),
    processWebhook: vi.fn().mockResolvedValue(undefined),
    getDeliveryStatus: vi.fn().mockResolvedValue({
      id: 'resend-msg-123',
      status: 'delivered',
      deliveredAt: new Date().toISOString()
    })
  } as any
}

/**
 * Mock Email Retry Service
 */
export function createMockEmailRetryService(): EmailRetryService {
  return {
    shouldRetry: vi.fn().mockResolvedValue({
      shouldRetry: true,
      nextRetryAt: new Date(Date.now() + 60000).toISOString(),
      backoffSeconds: 60,
      totalAttempts: 2,
      remainingAttempts: 1,
      shouldSuppress: false,
      failureType: 'temporary_failure'
    } as EmailRetryDecision),
    calculateBackoff: vi.fn().mockReturnValue(60),
    addToSuppressionList: vi.fn().mockResolvedValue(undefined),
    isEmailSuppressed: vi.fn().mockResolvedValue(false),
    removeFromSuppressionList: vi.fn().mockResolvedValue(undefined)
  } as any
}

/**
 * Mock fetch function for external API calls
 */
export function createMockFetch(): MockedFunction<typeof fetch> {
  const mockFetch = vi.fn() as MockedFunction<typeof fetch>
  
  // Default successful response
  mockFetch.mockResolvedValue(new Response(
    JSON.stringify(testResendResponses.success),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  ))
  
  return mockFetch
}

/**
 * Mock environment with email-specific configuration
 */
export function createMockEmailEnv(): Env {
  return {
    DB: createMockEmailQueueDatabase() as any,
    CACHE: createMockKVNamespace(),
    JWT_SECRET: 'test-jwt-secret',
    CHESS_COM_API_URL: 'https://api.chess.com/pub',
    EMAIL_API_KEY: 'test-email-key',
    RESEND_API_KEY: 'test-resend-key',
    RESEND_WEBHOOK_SECRET: 'test-webhook-secret',
    EMAIL_FROM_ADDRESS: 'Chess.com Helper <notifications@chesshelper.app>',
    EMAIL_FROM_NAME: 'Chess.com Helper',
    BASE_URL: 'https://test.chesshelper.app'
  } as any
}

/**
 * Mock KV namespace for caching
 */
export function createMockKVNamespace(): KVNamespace {
  const storage = new Map<string, string>()
  
  return {
    get: vi.fn().mockImplementation(async (key: string) => storage.get(key) || null),
    put: vi.fn().mockImplementation(async (key: string, value: string) => {
      storage.set(key, value)
      return undefined
    }),
    delete: vi.fn().mockImplementation(async (key: string) => {
      storage.delete(key)
      return undefined
    }),
    list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cursor: '' }),
    getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
    
    // Helper methods for testing
    _storage: storage,
    _clear: () => storage.clear()
  } as any
}

/**
 * Setup mock responses for Resend API
 */
export function setupMockResendResponses(mockFetch: MockedFunction<typeof fetch>) {
  return {
    success: () => {
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify(testResendResponses.success),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ))
    },
    error: (errorType: 'validation_error' | 'rate_limit_exceeded' | 'server_error' = 'validation_error') => {
      const errorResponse = errorType === 'rate_limit_exceeded' 
        ? testResendResponses.rateLimited 
        : testResendResponses.error
      const status = errorType === 'rate_limit_exceeded' ? 429 : 400
      
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify(errorResponse),
        { status, headers: { 'Content-Type': 'application/json' } }
      ))
    },
    serverError: () => {
      mockFetch.mockResolvedValueOnce(new Response(
        'Internal Server Error',
        { status: 500 }
      ))
    },
    networkError: () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
    }
  }
}

/**
 * Create mock webhook request
 */
export function createMockWebhookRequest(
  payload: any,
  signature: string = 'test-signature'
): Request {
  return new Request('https://test.chesshelper.app/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'resend-signature': signature
    },
    body: JSON.stringify(payload)
  })
}

/**
 * Create mock webhook signature
 */
export function createMockWebhookSignature(
  payload: string,
  secret: string = 'test-webhook-secret'
): string {
  // In a real implementation, this would use HMAC-SHA256
  // For testing, we'll use a simple hash
  return `sha256=${Buffer.from(payload + secret).toString('base64')}`
}

/**
 * Wait for async operations in tests
 */
export async function waitForAsyncOperations(ms: number = 100): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create test email queue items with database mocking
 */
export function setupDatabaseMocks(
  mockDb: ReturnType<typeof createMockEmailQueueDatabase>,
  items: EmailQueueItem[]
) {
  // Mock getting single item
  mockDb.setMockResult('first', items[0] || null)
  
  // Mock getting multiple items
  mockDb.setMockResult('all', items)
  
  // Mock successful operations
  mockDb.setMockResult('changes', 1)
  
  return {
    mockInsert: (item: EmailQueueItem) => {
      items.push(item)
      mockDb.setMockResult('all', items)
    },
    mockUpdate: (id: string, updates: Partial<EmailQueueItem>) => {
      const index = items.findIndex(item => item.id === id)
      if (index !== -1) {
        items[index] = { ...items[index], ...updates }
        mockDb.setMockResult('first', items[index])
        mockDb.setMockResult('all', items)
      }
    },
    mockDelete: (id: string) => {
      const index = items.findIndex(item => item.id === id)
      if (index !== -1) {
        items.splice(index, 1)
        mockDb.setMockResult('all', items)
      }
    },
    getItems: () => items
  }
}

/**
 * Assert email queue item properties
 */
export function assertEmailQueueItem(
  item: EmailQueueItem,
  expected: Partial<EmailQueueItem>
) {
  Object.entries(expected).forEach(([key, value]) => {
    expect((item as any)[key]).toEqual(value)
  })
}

/**
 * Assert email processing result properties
 */
export function assertEmailProcessingResult(
  result: EmailProcessingResult,
  expected: Partial<EmailProcessingResult>
) {
  Object.entries(expected).forEach(([key, value]) => {
    expect((result as any)[key]).toEqual(value)
  })
}

/**
 * Assert email batch processing result properties
 */
export function assertEmailBatchProcessingResult(
  result: EmailBatchProcessingResult,
  expected: Partial<EmailBatchProcessingResult>
) {
  Object.entries(expected).forEach(([key, value]) => {
    expect((result as any)[key]).toEqual(value)
  })
}

/**
 * Simulate email service errors
 */
export function simulateEmailServiceError(
  mockResendService: ReturnType<typeof createMockResendService>,
  errorType: 'template_error' | 'send_error' | 'validation_error' | 'system_error'
) {
  const error = testErrorScenarios[errorType]
  
  if (errorType === 'template_error') {
    ;(mockResendService.sendEmail as any).mockRejectedValue(new Error(error.message))
  } else {
    ;(mockResendService.sendEmail as any).mockResolvedValue({
      success: false,
      error: error.message
    })
  }
}

/**
 * Create performance test data
 */
export function createPerformanceTestData(
  count: number,
  options: {
    templateTypes?: Array<'game_start' | 'game_end' | 'welcome' | 'digest'>
    priorities?: Array<1 | 2 | 3>
    userCount?: number
  } = {}
): EmailQueueCreateInput[] {
  const {
    templateTypes = ['game_start', 'game_end'],
    priorities = [1, 2, 3],
    userCount = 100
  } = options
  
  return Array.from({ length: count }, (_, index) => {
    const templateType = templateTypes[index % templateTypes.length]
    const priority = priorities[index % priorities.length]
    const userId = `test-user-${(index % userCount) + 1}`
    
    return {
      userId,
      recipientEmail: `user${(index % userCount) + 1}@example.com`,
      templateType,
      templateData: {
        userEmail: `user${(index % userCount) + 1}@example.com`,
        baseUrl: 'https://test.chesshelper.app',
        unsubscribeUrl: `https://test.chesshelper.app/unsubscribe/${userId}`,
        preferencesUrl: 'https://test.chesshelper.app/preferences',
        playerName: `player${index + 1}`,
        gameId: `game-${index + 1}`,
        gameUrl: `https://chess.com/game/live/game-${index + 1}`
      },
      priority,
      maxRetries: 3
    }
  })
}

/**
 * Measure performance of async operations
 */
export async function measurePerformance<T>(
  operation: () => Promise<T>,
  name: string = 'operation'
): Promise<{ result: T; duration: number }> {
  const start = performance.now()
  const result = await operation()
  const duration = performance.now() - start
  
  console.log(`${name} completed in ${duration.toFixed(2)}ms`)
  
  return { result, duration }
}

/**
 * Create test request with authentication
 */
export function createAuthenticatedRequest(
  url: string,
  options: RequestInit = {},
  token: string = 'test-jwt-token'
): Request {
  return new Request(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
}

/**
 * Create test WebSocket for real-time updates
 */
export function createMockWebSocket(): WebSocket {
  const mockWS = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: WebSocket.OPEN,
    url: 'ws://test.chesshelper.app/ws',
    protocol: '',
    extensions: '',
    bufferedAmount: 0,
    binaryType: 'blob' as BinaryType,
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    dispatchEvent: vi.fn()
  }
  
  return mockWS as any
}

/**
 * Simulate webhook delivery
 */
export function simulateWebhookDelivery(
  messageId: string,
  eventType: 'email.delivered' | 'email.bounced' | 'email.complained' = 'email.delivered'
) {
  const payload = {
    ...testWebhookPayloads[eventType === 'email.delivered' ? 'delivered' : 
                          eventType === 'email.bounced' ? 'bounced' : 'complained'],
    data: {
      ...testWebhookPayloads[eventType === 'email.delivered' ? 'delivered' : 
                            eventType === 'email.bounced' ? 'bounced' : 'complained'].data,
      id: messageId
    }
  }
  
  return {
    payload,
    signature: createMockWebhookSignature(JSON.stringify(payload))
  }
}

/**
 * Validate email template rendering
 */
export function validateEmailTemplate(
  subject: string,
  htmlContent: string,
  textContent: string,
  templateData: EmailTemplateData
) {
  // Check for required placeholders
  const requiredPlaceholders = ['userEmail', 'baseUrl', 'unsubscribeUrl']
  
  requiredPlaceholders.forEach(placeholder => {
    if (templateData[placeholder]) {
      expect(htmlContent).toContain(templateData[placeholder])
      expect(textContent).toContain(templateData[placeholder])
    }
  })
  
  // Check for XSS prevention
  expect(htmlContent).not.toMatch(/<script[^>]*>/i)
  expect(htmlContent).not.toMatch(/javascript:/i)
  expect(htmlContent).not.toMatch(/on\w+=/i)
  
  // Check for basic HTML structure
  expect(htmlContent).toMatch(/<html[^>]*>/i)
  expect(htmlContent).toMatch(/<body[^>]*>/i)
  
  // Check for unsubscribe link
  expect(htmlContent).toMatch(/unsubscribe/i)
  expect(textContent).toMatch(/unsubscribe/i)
}

/**
 * Create test user for authentication
 */
export function createTestUser(overrides: any = {}) {
  return {
    id: 'test-user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Create test JWT token
 */
export function createTestJWT(payload: any = {}, secret: string = 'test-jwt-secret'): string {
  // In a real implementation, this would use proper JWT signing
  // For testing, we'll use a simple mock
  const header = { alg: 'HS256', typ: 'JWT' }
  const testPayload = { 
    sub: 'test-user-1', 
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload 
  }
  
  return `${Buffer.from(JSON.stringify(header)).toString('base64')}.${Buffer.from(JSON.stringify(testPayload)).toString('base64')}.test-signature`
}

/**
 * Setup test environment
 */
export function setupTestEnvironment() {
  const mockDb = createMockEmailQueueDatabase()
  const mockEnv = createMockEmailEnv()
  const mockFetch = createMockFetch()
  
  // Replace global fetch
  global.fetch = mockFetch
  
  return {
    mockDb,
    mockEnv,
    mockFetch,
    mockTemplateService: createMockEmailTemplateService(),
    mockResendService: createMockResendService(),
    mockRetryService: createMockEmailRetryService(),
    resendMocks: setupMockResendResponses(mockFetch),
    cleanup: () => {
      vi.clearAllMocks()
      mockDb.clearMockResults()
    }
  }
}

/**
 * Cleanup test environment
 */
export function cleanupTestEnvironment() {
  vi.clearAllMocks()
  vi.restoreAllMocks()
}