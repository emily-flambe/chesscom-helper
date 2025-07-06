/**
 * Email Test Data Fixtures
 * Provides consistent test data for email delivery system tests
 */

import type {
  EmailQueueItem,
  EmailQueueCreateInput,
  EmailTemplateData,
  EmailBatch,
  EmailProcessingResult,
  EmailBatchProcessingResult,
  EmailQueueStatistics,
  EmailQueueHealthStatus
} from '../../src/models/emailQueue'

/**
 * Test user data
 */
export const testUsers = {
  alice: {
    id: 'test-user-alice',
    email: 'alice@example.com',
    passwordHash: 'hashed-password-alice',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  },
  bob: {
    id: 'test-user-bob',
    email: 'bob@example.com',
    passwordHash: 'hashed-password-bob',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  },
  charlie: {
    id: 'test-user-charlie',
    email: 'charlie@example.com',
    passwordHash: 'hashed-password-charlie',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  }
}

/**
 * Test email template data
 */
export const testTemplateData: Record<string, EmailTemplateData> = {
  gameStart: {
    userEmail: 'alice@example.com',
    baseUrl: 'https://test.chesshelper.app',
    unsubscribeUrl: 'https://test.chesshelper.app/unsubscribe/test-user-alice/hikaru',
    preferencesUrl: 'https://test.chesshelper.app/preferences',
    playerName: 'hikaru',
    opponentName: 'magnuscarlsen',
    opponentRating: '2850',
    opponentTitle: 'GM',
    gameType: 'rapid',
    gameId: 'test-game-123',
    gameUrl: 'https://chess.com/game/live/test-game-123',
    gameStartTime: '2024-01-01T12:00:00.000Z',
    playerColor: 'white',
    timeControl: '10+0'
  },
  gameEnd: {
    userEmail: 'alice@example.com',
    baseUrl: 'https://test.chesshelper.app',
    unsubscribeUrl: 'https://test.chesshelper.app/unsubscribe/test-user-alice/hikaru',
    preferencesUrl: 'https://test.chesshelper.app/preferences',
    playerName: 'hikaru',
    opponentName: 'magnuscarlsen',
    opponentRating: '2850',
    opponentTitle: 'GM',
    gameType: 'rapid',
    gameId: 'test-game-123',
    gameUrl: 'https://chess.com/game/live/test-game-123',
    gameStartTime: '2024-01-01T12:00:00.000Z',
    gameEndTime: '2024-01-01T12:15:00.000Z',
    playerColor: 'white',
    timeControl: '10+0',
    result: 'Win'
  },
  welcome: {
    userEmail: 'alice@example.com',
    baseUrl: 'https://test.chesshelper.app',
    unsubscribeUrl: 'https://test.chesshelper.app/unsubscribe/test-user-alice',
    preferencesUrl: 'https://test.chesshelper.app/preferences',
    playerName: 'Alice'
  },
  digest: {
    userEmail: 'alice@example.com',
    baseUrl: 'https://test.chesshelper.app',
    unsubscribeUrl: 'https://test.chesshelper.app/unsubscribe/test-user-alice',
    preferencesUrl: 'https://test.chesshelper.app/preferences',
    playerName: 'Alice',
    gameCount: 5,
    winCount: 3,
    lossCount: 2,
    drawCount: 0,
    periodStart: '2024-01-01T00:00:00.000Z',
    periodEnd: '2024-01-07T23:59:59.999Z'
  }
}

/**
 * Test email queue items
 */
export const testEmailQueueItems = {
  gameStartPending: {
    id: 'test-email-1',
    userId: 'test-user-alice',
    recipientEmail: 'alice@example.com',
    templateType: 'game_start' as const,
    templateData: JSON.stringify(testTemplateData.gameStart),
    priority: 1 as const,
    subject: '🎯 hikaru is now playing on Chess.com!',
    htmlContent: '<div>Test HTML content</div>',
    textContent: 'Test text content',
    status: 'pending' as const,
    retryCount: 0,
    maxRetries: 3,
    scheduledAt: '2024-01-01T12:00:00.000Z',
    createdAt: '2024-01-01T12:00:00.000Z',
    updatedAt: '2024-01-01T12:00:00.000Z'
  },
  gameEndSent: {
    id: 'test-email-2',
    userId: 'test-user-alice',
    recipientEmail: 'alice@example.com',
    templateType: 'game_end' as const,
    templateData: JSON.stringify(testTemplateData.gameEnd),
    priority: 2 as const,
    subject: '♟️ hikaru\'s game has ended',
    htmlContent: '<div>Test HTML content</div>',
    textContent: 'Test text content',
    status: 'sent' as const,
    retryCount: 0,
    maxRetries: 3,
    scheduledAt: '2024-01-01T12:00:00.000Z',
    firstAttemptedAt: '2024-01-01T12:00:30.000Z',
    lastAttemptedAt: '2024-01-01T12:00:30.000Z',
    sentAt: '2024-01-01T12:00:35.000Z',
    resendMessageId: 'resend-message-123',
    createdAt: '2024-01-01T12:00:00.000Z',
    updatedAt: '2024-01-01T12:00:35.000Z'
  },
  welcomeFailed: {
    id: 'test-email-3',
    userId: 'test-user-bob',
    recipientEmail: 'bob@example.com',
    templateType: 'welcome' as const,
    templateData: JSON.stringify(testTemplateData.welcome),
    priority: 3 as const,
    subject: 'Welcome to Chess.com Helper!',
    htmlContent: '<div>Test HTML content</div>',
    textContent: 'Test text content',
    status: 'failed' as const,
    retryCount: 3,
    maxRetries: 3,
    scheduledAt: '2024-01-01T12:00:00.000Z',
    firstAttemptedAt: '2024-01-01T12:00:30.000Z',
    lastAttemptedAt: '2024-01-01T12:05:00.000Z',
    errorMessage: 'Invalid email address',
    errorCode: 'INVALID_EMAIL',
    createdAt: '2024-01-01T12:00:00.000Z',
    updatedAt: '2024-01-01T12:05:00.000Z'
  },
  digestProcessing: {
    id: 'test-email-4',
    userId: 'test-user-charlie',
    recipientEmail: 'charlie@example.com',
    templateType: 'digest' as const,
    templateData: JSON.stringify(testTemplateData.digest),
    priority: 2 as const,
    subject: 'Your weekly chess digest',
    htmlContent: '<div>Test HTML content</div>',
    textContent: 'Test text content',
    status: 'processing' as const,
    retryCount: 0,
    maxRetries: 3,
    scheduledAt: '2024-01-01T12:00:00.000Z',
    firstAttemptedAt: '2024-01-01T12:00:30.000Z',
    lastAttemptedAt: '2024-01-01T12:00:30.000Z',
    createdAt: '2024-01-01T12:00:00.000Z',
    updatedAt: '2024-01-01T12:00:30.000Z'
  }
} as const

/**
 * Test email queue create inputs
 */
export const testEmailQueueCreateInputs = {
  gameStart: {
    userId: 'test-user-alice',
    recipientEmail: 'alice@example.com',
    templateType: 'game_start' as const,
    templateData: testTemplateData.gameStart,
    priority: 1 as const,
    scheduledAt: '2024-01-01T12:00:00.000Z',
    maxRetries: 5
  },
  gameEnd: {
    userId: 'test-user-alice',
    recipientEmail: 'alice@example.com',
    templateType: 'game_end' as const,
    templateData: testTemplateData.gameEnd,
    priority: 2 as const,
    scheduledAt: '2024-01-01T12:15:00.000Z',
    maxRetries: 3
  },
  welcome: {
    userId: 'test-user-bob',
    recipientEmail: 'bob@example.com',
    templateType: 'welcome' as const,
    templateData: testTemplateData.welcome,
    priority: 3 as const,
    maxRetries: 2
  },
  digest: {
    userId: 'test-user-charlie',
    recipientEmail: 'charlie@example.com',
    templateType: 'digest' as const,
    templateData: testTemplateData.digest,
    priority: 2 as const,
    scheduledAt: '2024-01-07T09:00:00.000Z',
    maxRetries: 3
  }
} as const

/**
 * Test email batches
 */
export const testEmailBatches = {
  pending: {
    id: 'test-batch-1',
    batchSize: 5,
    priority: 1 as const,
    status: 'pending' as const,
    emailsProcessed: 0,
    emailsSent: 0,
    emailsFailed: 0,
    createdAt: '2024-01-01T12:00:00.000Z',
    updatedAt: '2024-01-01T12:00:00.000Z'
  },
  processing: {
    id: 'test-batch-2',
    batchSize: 3,
    priority: 2 as const,
    status: 'processing' as const,
    startedAt: '2024-01-01T12:00:30.000Z',
    emailsProcessed: 1,
    emailsSent: 1,
    emailsFailed: 0,
    createdAt: '2024-01-01T12:00:00.000Z',
    updatedAt: '2024-01-01T12:00:30.000Z'
  },
  completed: {
    id: 'test-batch-3',
    batchSize: 2,
    priority: 3 as const,
    status: 'completed' as const,
    startedAt: '2024-01-01T12:00:30.000Z',
    completedAt: '2024-01-01T12:01:00.000Z',
    processingTimeMs: 30000,
    emailsProcessed: 2,
    emailsSent: 2,
    emailsFailed: 0,
    createdAt: '2024-01-01T12:00:00.000Z',
    updatedAt: '2024-01-01T12:01:00.000Z'
  },
  failed: {
    id: 'test-batch-4',
    batchSize: 1,
    priority: 1 as const,
    status: 'failed' as const,
    startedAt: '2024-01-01T12:00:30.000Z',
    completedAt: '2024-01-01T12:00:45.000Z',
    processingTimeMs: 15000,
    emailsProcessed: 1,
    emailsSent: 0,
    emailsFailed: 1,
    errorMessage: 'Email service unavailable',
    createdAt: '2024-01-01T12:00:00.000Z',
    updatedAt: '2024-01-01T12:00:45.000Z'
  }
} as const

/**
 * Test email processing results
 */
export const testEmailProcessingResults = {
  success: {
    emailId: 'test-email-1',
    success: true,
    processingTime: 1500,
    resendMessageId: 'resend-msg-123'
  },
  failure: {
    emailId: 'test-email-2',
    success: false,
    processingTime: 2000,
    errorMessage: 'Invalid email address',
    errorCode: 'INVALID_EMAIL'
  },
  retryScheduled: {
    emailId: 'test-email-3',
    success: false,
    processingTime: 500,
    errorMessage: 'Temporary service unavailable',
    errorCode: 'SERVICE_UNAVAILABLE',
    retryScheduled: true,
    nextRetryAt: '2024-01-01T12:05:00.000Z'
  }
} as const

/**
 * Test email batch processing results
 */
export const testEmailBatchProcessingResults = {
  success: {
    batchId: 'test-batch-1',
    success: true,
    processingTime: 30000,
    emailsProcessed: 5,
    emailsSent: 5,
    emailsFailed: 0,
    results: [
      testEmailProcessingResults.success,
      testEmailProcessingResults.success,
      testEmailProcessingResults.success,
      testEmailProcessingResults.success,
      testEmailProcessingResults.success
    ]
  },
  partialFailure: {
    batchId: 'test-batch-2',
    success: true,
    processingTime: 25000,
    emailsProcessed: 3,
    emailsSent: 2,
    emailsFailed: 1,
    results: [
      testEmailProcessingResults.success,
      testEmailProcessingResults.success,
      testEmailProcessingResults.failure
    ]
  },
  failure: {
    batchId: 'test-batch-3',
    success: false,
    processingTime: 15000,
    emailsProcessed: 1,
    emailsSent: 0,
    emailsFailed: 1,
    errorMessage: 'Batch processing failed',
    results: [
      testEmailProcessingResults.failure
    ]
  }
} as const

/**
 * Test queue statistics
 */
export const testQueueStatistics = {
  healthy: {
    totalPending: 10,
    totalProcessing: 2,
    totalSent: 100,
    totalFailed: 5,
    totalCancelled: 1,
    averageProcessingTime: 2500,
    averageRetryCount: 0.5,
    oldestPendingAge: 300, // 5 minutes
    successRate: 95.2
  },
  unhealthy: {
    totalPending: 1000,
    totalProcessing: 10,
    totalSent: 50,
    totalFailed: 50,
    totalCancelled: 5,
    averageProcessingTime: 30000,
    averageRetryCount: 2.5,
    oldestPendingAge: 7200, // 2 hours
    successRate: 50.0
  }
} as const

/**
 * Test health status
 */
export const testHealthStatus = {
  healthy: {
    isHealthy: true,
    queueSize: 12,
    processingRate: 120, // emails per hour
    errorRate: 4.8,
    averageWaitTime: 2.5,
    oldestItemAge: 300,
    issues: [],
    lastHealthCheck: '2024-01-01T12:00:00.000Z'
  },
  unhealthy: {
    isHealthy: false,
    queueSize: 1010,
    processingRate: 30, // emails per hour
    errorRate: 50.0,
    averageWaitTime: 30.0,
    oldestItemAge: 7200,
    issues: [
      'High number of pending emails',
      'Old emails in queue',
      'Low success rate',
      'Slow processing times'
    ],
    lastHealthCheck: '2024-01-01T12:00:00.000Z'
  }
} as const

/**
 * Test Resend API responses
 */
export const testResendResponses = {
  success: {
    id: 'resend-msg-123',
    to: ['alice@example.com'],
    from: 'Chess.com Helper <notifications@chesshelper.app>',
    subject: '🎯 hikaru is now playing on Chess.com!',
    created_at: '2024-01-01T12:00:00.000Z'
  },
  error: {
    name: 'validation_error',
    message: 'Invalid email address',
    details: {
      field: 'to',
      code: 'invalid_email'
    }
  },
  rateLimited: {
    name: 'rate_limit_exceeded',
    message: 'Rate limit exceeded',
    details: {
      limit: 100,
      remaining: 0,
      reset: '2024-01-01T13:00:00.000Z'
    }
  }
} as const

/**
 * Test webhook payloads
 */
export const testWebhookPayloads = {
  delivered: {
    type: 'email.delivered',
    created_at: '2024-01-01T12:00:35.000Z',
    data: {
      id: 'resend-msg-123',
      to: ['alice@example.com'],
      from: 'Chess.com Helper <notifications@chesshelper.app>',
      subject: '🎯 hikaru is now playing on Chess.com!',
      created_at: '2024-01-01T12:00:00.000Z'
    }
  },
  bounced: {
    type: 'email.bounced',
    created_at: '2024-01-01T12:00:35.000Z',
    data: {
      id: 'resend-msg-124',
      to: ['invalid@example.com'],
      from: 'Chess.com Helper <notifications@chesshelper.app>',
      subject: '🎯 hikaru is now playing on Chess.com!',
      created_at: '2024-01-01T12:00:00.000Z',
      bounce_type: 'hard'
    }
  },
  complained: {
    type: 'email.complained',
    created_at: '2024-01-01T12:00:35.000Z',
    data: {
      id: 'resend-msg-125',
      to: ['user@example.com'],
      from: 'Chess.com Helper <notifications@chesshelper.app>',
      subject: '🎯 hikaru is now playing on Chess.com!',
      created_at: '2024-01-01T12:00:00.000Z'
    }
  }
} as const

/**
 * Test error scenarios
 */
export const testErrorScenarios = {
  templateError: {
    name: 'TemplateError',
    message: 'Template not found',
    errorType: 'template_error',
    retryable: false
  },
  sendError: {
    name: 'SendError',
    message: 'Email service unavailable',
    errorType: 'send_error',
    retryable: true
  },
  validationError: {
    name: 'ValidationError',
    message: 'Invalid email address',
    errorType: 'validation_error',
    retryable: false
  },
  systemError: {
    name: 'SystemError',
    message: 'Database connection failed',
    errorType: 'system_error',
    retryable: true
  }
} as const

/**
 * Test performance scenarios
 */
export const testPerformanceScenarios = {
  highVolume: {
    emailCount: 1000,
    batchSize: 50,
    concurrentBatches: 5,
    expectedProcessingTime: 120000, // 2 minutes
    expectedSuccessRate: 95
  },
  lowVolume: {
    emailCount: 10,
    batchSize: 5,
    concurrentBatches: 1,
    expectedProcessingTime: 10000, // 10 seconds
    expectedSuccessRate: 99
  },
  stressTest: {
    emailCount: 10000,
    batchSize: 100,
    concurrentBatches: 10,
    expectedProcessingTime: 600000, // 10 minutes
    expectedSuccessRate: 90
  }
} as const

/**
 * Helper function to create test email queue items
 */
export function createTestEmailQueueItem(
  overrides: Partial<EmailQueueItem> = {}
): EmailQueueItem {
  return {
    ...testEmailQueueItems.gameStartPending,
    ...overrides,
    id: overrides.id || `test-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString()
  }
}

/**
 * Helper function to create test email queue create inputs
 */
export function createTestEmailQueueCreateInput(
  overrides: Partial<EmailQueueCreateInput> = {}
): EmailQueueCreateInput {
  return {
    ...testEmailQueueCreateInputs.gameStart,
    ...overrides
  }
}

/**
 * Helper function to create test email batches
 */
export function createTestEmailBatch(
  overrides: Partial<EmailBatch> = {}
): EmailBatch {
  return {
    ...testEmailBatches.pending,
    ...overrides,
    id: overrides.id || `test-batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString()
  }
}

/**
 * Helper function to create test template data
 */
export function createTestTemplateData(
  type: 'gameStart' | 'gameEnd' | 'welcome' | 'digest',
  overrides: Partial<EmailTemplateData> = {}
): EmailTemplateData {
  return {
    ...testTemplateData[type],
    ...overrides
  }
}

/**
 * Helper function to create multiple test email queue items
 */
export function createTestEmailQueueItems(
  count: number,
  overrides: Partial<EmailQueueItem> = {}
): EmailQueueItem[] {
  return Array.from({ length: count }, (_, index) => 
    createTestEmailQueueItem({
      ...overrides,
      id: `test-email-${index + 1}`,
      recipientEmail: `user${index + 1}@example.com`
    })
  )
}

/**
 * Helper function to create test email processing results
 */
export function createTestEmailProcessingResults(
  emailIds: string[],
  successRate: number = 1.0
): EmailProcessingResult[] {
  return emailIds.map((emailId, index) => {
    const isSuccess = Math.random() < successRate
    return {
      emailId,
      success: isSuccess,
      processingTime: Math.random() * 3000 + 500,
      ...(isSuccess 
        ? { resendMessageId: `resend-msg-${index + 1}` }
        : { 
            errorMessage: 'Test error',
            errorCode: 'TEST_ERROR'
          }
      )
    }
  })
}