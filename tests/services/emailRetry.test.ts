/**
 * Email Retry Service Tests
 * Comprehensive tests for email retry logic and exponential backoff
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EmailRetryService } from '../../src/services/emailRetryService'
import type {
  EmailRetryContext,
  EmailRetryDecision,
  EmailRetryPolicy,
  EmailFailureType,
  EmailSuppressionEntry
} from '../../src/models/emailRetryPolicy'
import { 
  setupTestEnvironment,
  cleanupTestEnvironment,
  createMockEmailQueueDatabase,
  setupDatabaseMocks
} from '../utils/emailTestHelpers'
import { testErrorScenarios } from '../fixtures/emailTestData'

describe('Email Retry Service', () => {
  let retryService: EmailRetryService
  let mockDb: ReturnType<typeof createMockEmailQueueDatabase>
  let testEnv: ReturnType<typeof setupTestEnvironment>

  beforeEach(() => {
    testEnv = setupTestEnvironment()
    mockDb = testEnv.mockDb
    retryService = new EmailRetryService(mockDb as any)
  })

  afterEach(() => {
    testEnv.cleanup()
    cleanupTestEnvironment()
  })

  describe('Retry Decision Logic', () => {
    it('should retry on temporary failures', async () => {
      const context: EmailRetryContext = {
        emailQueueId: 'test-email-1',
        recipientEmail: 'test@example.com',
        templateType: 'game_start',
        priority: 'high',
        currentRetryCount: 1,
        previousAttempts: [],
        latestFailure: {
          errorMessage: 'Service temporarily unavailable',
          errorCode: 'SERVICE_UNAVAILABLE',
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 1,
          recentFailures: 1
        },
        serviceProvider: 'resend',
        policyId: 'standard'
      }

      const decision = await retryService.shouldRetry(context)

      expect(decision.shouldRetry).toBe(true)
      expect(decision.nextRetryAt).toBeTruthy()
      expect(decision.backoffSeconds).toBeGreaterThan(0)
      expect(decision.remainingAttempts).toBeGreaterThan(0)
      expect(decision.failureType).toBe('temporary_failure')
    })

    it('should not retry on permanent failures', async () => {
      const context: EmailRetryContext = {
        emailQueueId: 'test-email-1',
        recipientEmail: 'invalid@example.com',
        templateType: 'game_start',
        priority: 'high',
        currentRetryCount: 1,
        previousAttempts: [],
        latestFailure: {
          errorMessage: 'Invalid email address',
          errorCode: 'INVALID_EMAIL',
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 1,
          recentFailures: 1
        },
        serviceProvider: 'resend',
        policyId: 'standard'
      }

      const decision = await retryService.shouldRetry(context)

      expect(decision.shouldRetry).toBe(false)
      expect(decision.failureType).toBe('permanent_failure')
      expect(decision.shouldSuppress).toBe(true)
      expect(decision.suppressionReason).toBeTruthy()
    })

    it('should not retry when max attempts reached', async () => {
      const context: EmailRetryContext = {
        emailQueueId: 'test-email-1',
        recipientEmail: 'test@example.com',
        templateType: 'game_start',
        priority: 'high',
        currentRetryCount: 5, // Max attempts for high priority
        previousAttempts: [],
        latestFailure: {
          errorMessage: 'Service temporarily unavailable',
          errorCode: 'SERVICE_UNAVAILABLE',
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 5,
          recentFailures: 5
        },
        serviceProvider: 'resend',
        policyId: 'standard'
      }

      const decision = await retryService.shouldRetry(context)

      expect(decision.shouldRetry).toBe(false)
      expect(decision.remainingAttempts).toBe(0)
    })

    it('should apply different retry limits based on priority', async () => {
      const highPriorityContext: EmailRetryContext = {
        emailQueueId: 'test-email-1',
        recipientEmail: 'test@example.com',
        templateType: 'game_start',
        priority: 'high',
        currentRetryCount: 3,
        previousAttempts: [],
        latestFailure: {
          errorMessage: 'Service temporarily unavailable',
          errorCode: 'SERVICE_UNAVAILABLE',
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 3,
          recentFailures: 3
        },
        serviceProvider: 'resend',
        policyId: 'standard'
      }

      const lowPriorityContext: EmailRetryContext = {
        ...highPriorityContext,
        priority: 'low',
        currentRetryCount: 2
      }

      const highPriorityDecision = await retryService.shouldRetry(highPriorityContext)
      const lowPriorityDecision = await retryService.shouldRetry(lowPriorityContext)

      expect(highPriorityDecision.shouldRetry).toBe(true) // High priority can retry more
      expect(lowPriorityDecision.shouldRetry).toBe(false) // Low priority hits limit sooner
    })

    it('should suppress recipient with high failure rate', async () => {
      const context: EmailRetryContext = {
        emailQueueId: 'test-email-1',
        recipientEmail: 'problematic@example.com',
        templateType: 'game_start',
        priority: 'high',
        currentRetryCount: 1,
        previousAttempts: [],
        latestFailure: {
          errorMessage: 'Mailbox full',
          errorCode: 'MAILBOX_FULL',
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 10, // High failure count
          recentFailures: 5
        },
        serviceProvider: 'resend',
        policyId: 'standard'
      }

      const decision = await retryService.shouldRetry(context)

      expect(decision.shouldRetry).toBe(false)
      expect(decision.shouldSuppress).toBe(true)
      expect(decision.suppressionReason).toContain('high failure rate')
    })

    it('should handle rate limiting with extended backoff', async () => {
      const context: EmailRetryContext = {
        emailQueueId: 'test-email-1',
        recipientEmail: 'test@example.com',
        templateType: 'game_start',
        priority: 'high',
        currentRetryCount: 1,
        previousAttempts: [],
        latestFailure: {
          errorMessage: 'Rate limit exceeded',
          errorCode: 'RATE_LIMITED',
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 1,
          recentFailures: 1
        },
        serviceProvider: 'resend',
        policyId: 'standard'
      }

      const decision = await retryService.shouldRetry(context)

      expect(decision.shouldRetry).toBe(true)
      expect(decision.backoffSeconds).toBeGreaterThan(300) // Extended backoff for rate limiting
      expect(decision.failureType).toBe('rate_limited')
    })
  })

  describe('Exponential Backoff Calculation', () => {
    it('should calculate exponential backoff correctly', () => {
      const baseBackoff = 60 // 1 minute
      const multiplier = 2
      
      const backoff1 = retryService.calculateBackoff(1, baseBackoff, multiplier)
      const backoff2 = retryService.calculateBackoff(2, baseBackoff, multiplier)
      const backoff3 = retryService.calculateBackoff(3, baseBackoff, multiplier)
      
      expect(backoff1).toBe(60)  // 60 * 2^0 = 60
      expect(backoff2).toBe(120) // 60 * 2^1 = 120
      expect(backoff3).toBe(240) // 60 * 2^2 = 240
    })

    it('should respect maximum backoff limit', () => {
      const baseBackoff = 60
      const multiplier = 2
      const maxBackoff = 300 // 5 minutes
      
      const backoff = retryService.calculateBackoff(10, baseBackoff, multiplier, maxBackoff)
      
      expect(backoff).toBe(maxBackoff)
    })

    it('should add jitter to prevent thundering herd', () => {
      const baseBackoff = 60
      const multiplier = 2
      
      const backoffs = Array.from({ length: 10 }, () => 
        retryService.calculateBackoff(2, baseBackoff, multiplier, undefined, true)
      )
      
      // All values should be different due to jitter
      const uniqueValues = new Set(backoffs)
      expect(uniqueValues.size).toBeGreaterThan(1)
      
      // All values should be around the expected value (120) ± jitter
      backoffs.forEach(backoff => {
        expect(backoff).toBeGreaterThan(100)
        expect(backoff).toBeLessThan(140)
      })
    })

    it('should handle different priority levels', () => {
      const highPriorityBackoff = retryService.calculateBackoff(1, 60, 2, undefined, false, 'high')
      const lowPriorityBackoff = retryService.calculateBackoff(1, 60, 2, undefined, false, 'low')
      
      expect(highPriorityBackoff).toBeLessThan(lowPriorityBackoff)
    })
  })

  describe('Suppression List Management', () => {
    it('should add email to suppression list', async () => {
      const email = 'suppress@example.com'
      const reason = 'Multiple bounces'
      const emailId = 'test-email-1'
      const failureType: EmailFailureType = 'permanent_failure'
      
      await retryService.addToSuppressionList(email, reason, emailId, failureType)
      
      // Verify database was called to insert suppression entry
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO email_suppression_list')
      )
    })

    it('should check if email is suppressed', async () => {
      const email = 'suppressed@example.com'
      
      // Mock suppressed email
      mockDb.setMockResult('first', {
        recipient_email: email,
        suppressed_at: new Date().toISOString(),
        reason: 'Multiple bounces',
        is_active: true
      })
      
      const isSuppressed = await retryService.isEmailSuppressed(email)
      
      expect(isSuppressed).toBe(true)
    })

    it('should check if email is not suppressed', async () => {
      const email = 'valid@example.com'
      
      // Mock no suppression record
      mockDb.setMockResult('first', null)
      
      const isSuppressed = await retryService.isEmailSuppressed(email)
      
      expect(isSuppressed).toBe(false)
    })

    it('should remove email from suppression list', async () => {
      const email = 'unsuppress@example.com'
      
      await retryService.removeFromSuppressionList(email)
      
      // Verify database was called to update suppression entry
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE email_suppression_list')
      )
    })

    it('should handle suppression list errors gracefully', async () => {
      const email = 'error@example.com'
      
      // Mock database error
      vi.mocked(mockDb.prepare).mockImplementation(() => {
        throw new Error('Database error')
      })
      
      await expect(retryService.addToSuppressionList(email, 'test', 'test', 'permanent_failure'))
        .rejects.toThrow('Database error')
    })
  })

  describe('Failure Type Classification', () => {
    it('should classify temporary failures correctly', async () => {
      const temporaryErrors = [
        'Service temporarily unavailable',
        'Connection timeout',
        'Rate limit exceeded',
        'Server error',
        'DNS resolution failed'
      ]
      
      for (const error of temporaryErrors) {
        const context: EmailRetryContext = {
          emailQueueId: 'test-email-1',
          recipientEmail: 'test@example.com',
          templateType: 'game_start',
          priority: 'high',
          currentRetryCount: 1,
          previousAttempts: [],
          latestFailure: {
            errorMessage: error,
            errorCode: 'TEMP_ERROR',
            occurredAt: new Date().toISOString()
          },
          recipientHistory: {
            totalFailures: 1,
            recentFailures: 1
          },
          serviceProvider: 'resend',
          policyId: 'standard'
        }
        
        const decision = await retryService.shouldRetry(context)
        expect(decision.failureType).toBe('temporary_failure')
      }
    })

    it('should classify permanent failures correctly', async () => {
      const permanentErrors = [
        'Invalid email address',
        'Email address does not exist',
        'Domain not found',
        'Mailbox disabled',
        'Spam rejection'
      ]
      
      for (const error of permanentErrors) {
        const context: EmailRetryContext = {
          emailQueueId: 'test-email-1',
          recipientEmail: 'invalid@example.com',
          templateType: 'game_start',
          priority: 'high',
          currentRetryCount: 1,
          previousAttempts: [],
          latestFailure: {
            errorMessage: error,
            errorCode: 'PERM_ERROR',
            occurredAt: new Date().toISOString()
          },
          recipientHistory: {
            totalFailures: 1,
            recentFailures: 1
          },
          serviceProvider: 'resend',
          policyId: 'standard'
        }
        
        const decision = await retryService.shouldRetry(context)
        expect(decision.failureType).toBe('permanent_failure')
      }
    })

    it('should classify rate limiting correctly', async () => {
      const context: EmailRetryContext = {
        emailQueueId: 'test-email-1',
        recipientEmail: 'test@example.com',
        templateType: 'game_start',
        priority: 'high',
        currentRetryCount: 1,
        previousAttempts: [],
        latestFailure: {
          errorMessage: 'Rate limit exceeded',
          errorCode: 'RATE_LIMITED',
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 1,
          recentFailures: 1
        },
        serviceProvider: 'resend',
        policyId: 'standard'
      }
      
      const decision = await retryService.shouldRetry(context)
      expect(decision.failureType).toBe('rate_limited')
    })

    it('should classify bounces correctly', async () => {
      const context: EmailRetryContext = {
        emailQueueId: 'test-email-1',
        recipientEmail: 'bounce@example.com',
        templateType: 'game_start',
        priority: 'high',
        currentRetryCount: 1,
        previousAttempts: [],
        latestFailure: {
          errorMessage: 'Email bounced',
          errorCode: 'BOUNCED',
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 1,
          recentFailures: 1
        },
        serviceProvider: 'resend',
        policyId: 'standard'
      }
      
      const decision = await retryService.shouldRetry(context)
      expect(decision.failureType).toBe('bounced')
    })
  })

  describe('Retry Policies', () => {
    it('should apply aggressive policy for high priority emails', async () => {
      const context: EmailRetryContext = {
        emailQueueId: 'test-email-1',
        recipientEmail: 'test@example.com',
        templateType: 'game_start',
        priority: 'high',
        currentRetryCount: 1,
        previousAttempts: [],
        latestFailure: {
          errorMessage: 'Service temporarily unavailable',
          errorCode: 'SERVICE_UNAVAILABLE',
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 1,
          recentFailures: 1
        },
        serviceProvider: 'resend',
        policyId: 'aggressive'
      }
      
      const decision = await retryService.shouldRetry(context)
      
      expect(decision.shouldRetry).toBe(true)
      expect(decision.totalAttempts).toBeGreaterThan(3) // More attempts for aggressive policy
    })

    it('should apply conservative policy for low priority emails', async () => {
      const context: EmailRetryContext = {
        emailQueueId: 'test-email-1',
        recipientEmail: 'test@example.com',
        templateType: 'digest',
        priority: 'low',
        currentRetryCount: 1,
        previousAttempts: [],
        latestFailure: {
          errorMessage: 'Service temporarily unavailable',
          errorCode: 'SERVICE_UNAVAILABLE',
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 1,
          recentFailures: 1
        },
        serviceProvider: 'resend',
        policyId: 'conservative'
      }
      
      const decision = await retryService.shouldRetry(context)
      
      expect(decision.shouldRetry).toBe(true)
      expect(decision.totalAttempts).toBeLessThan(5) // Fewer attempts for conservative policy
      expect(decision.backoffSeconds).toBeGreaterThan(120) // Longer backoff
    })

    it('should handle custom retry policies', async () => {
      const customPolicy: EmailRetryPolicy = {
        id: 'custom',
        name: 'Custom Policy',
        description: 'Custom retry policy for testing',
        maxRetries: 2,
        baseBackoffSeconds: 30,
        backoffMultiplier: 3,
        maxBackoffSeconds: 600,
        enableJitter: true,
        suppressAfterFailures: 3,
        priorityMultipliers: {
          high: 0.5,
          medium: 1.0,
          low: 2.0
        },
        failureTypeHandling: {
          temporary_failure: { retryable: true, backoffMultiplier: 1 },
          permanent_failure: { retryable: false, suppressImmediately: true },
          rate_limited: { retryable: true, backoffMultiplier: 5 },
          bounced: { retryable: false, suppressImmediately: true },
          spam_complaint: { retryable: false, suppressImmediately: true }
        }
      }
      
      const retryServiceWithCustomPolicy = new EmailRetryService(mockDb as any, [customPolicy])
      
      const context: EmailRetryContext = {
        emailQueueId: 'test-email-1',
        recipientEmail: 'test@example.com',
        templateType: 'game_start',
        priority: 'high',
        currentRetryCount: 1,
        previousAttempts: [],
        latestFailure: {
          errorMessage: 'Service temporarily unavailable',
          errorCode: 'SERVICE_UNAVAILABLE',
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 1,
          recentFailures: 1
        },
        serviceProvider: 'resend',
        policyId: 'custom'
      }
      
      const decision = await retryServiceWithCustomPolicy.shouldRetry(context)
      
      expect(decision.shouldRetry).toBe(true)
      expect(decision.totalAttempts).toBe(2) // Custom max retries
      expect(decision.backoffSeconds).toBe(15) // 30 * 0.5 (high priority multiplier)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      vi.mocked(mockDb.prepare).mockImplementation(() => {
        throw new Error('Database connection failed')
      })
      
      const context: EmailRetryContext = {
        emailQueueId: 'test-email-1',
        recipientEmail: 'test@example.com',
        templateType: 'game_start',
        priority: 'high',
        currentRetryCount: 1,
        previousAttempts: [],
        latestFailure: {
          errorMessage: 'Service temporarily unavailable',
          errorCode: 'SERVICE_UNAVAILABLE',
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 1,
          recentFailures: 1
        },
        serviceProvider: 'resend',
        policyId: 'standard'
      }
      
      // Should fall back to conservative retry decision
      const decision = await retryService.shouldRetry(context)
      
      expect(decision.shouldRetry).toBe(false) // Conservative fallback
    })

    it('should handle missing retry policy gracefully', async () => {
      const context: EmailRetryContext = {
        emailQueueId: 'test-email-1',
        recipientEmail: 'test@example.com',
        templateType: 'game_start',
        priority: 'high',
        currentRetryCount: 1,
        previousAttempts: [],
        latestFailure: {
          errorMessage: 'Service temporarily unavailable',
          errorCode: 'SERVICE_UNAVAILABLE',
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 1,
          recentFailures: 1
        },
        serviceProvider: 'resend',
        policyId: 'non-existent-policy'
      }
      
      const decision = await retryService.shouldRetry(context)
      
      // Should use default policy
      expect(decision.shouldRetry).toBe(true)
    })

    it('should validate retry context', async () => {
      const invalidContext = {
        // Missing required fields
        emailQueueId: '',
        recipientEmail: 'invalid-email'
      } as any
      
      await expect(retryService.shouldRetry(invalidContext))
        .rejects.toThrow()
    })
  })

  describe('Performance and Concurrency', () => {
    it('should handle concurrent retry decisions', async () => {
      const contexts = Array.from({ length: 10 }, (_, i) => ({
        emailQueueId: `test-email-${i}`,
        recipientEmail: `test${i}@example.com`,
        templateType: 'game_start' as const,
        priority: 'high' as const,
        currentRetryCount: 1,
        previousAttempts: [],
        latestFailure: {
          errorMessage: 'Service temporarily unavailable',
          errorCode: 'SERVICE_UNAVAILABLE',
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 1,
          recentFailures: 1
        },
        serviceProvider: 'resend' as const,
        policyId: 'standard'
      }))
      
      const decisions = await Promise.all(
        contexts.map(context => retryService.shouldRetry(context))
      )
      
      expect(decisions).toHaveLength(10)
      decisions.forEach(decision => {
        expect(decision.shouldRetry).toBe(true)
        expect(decision.nextRetryAt).toBeTruthy()
      })
    })

    it('should be performant for large numbers of retry calculations', async () => {
      const startTime = performance.now()
      
      const calculations = Array.from({ length: 1000 }, (_, i) => 
        retryService.calculateBackoff(i % 5, 60, 2, 3600, false)
      )
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(calculations).toHaveLength(1000)
      expect(duration).toBeLessThan(100) // Should complete in under 100ms
    })
  })
})