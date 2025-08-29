/**
 * Email Queue Service Tests
 * Comprehensive tests for email queue processing functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  EmailQueueService,
  createEmailQueueService,
  DEFAULT_EMAIL_QUEUE_CONFIG,
  type EmailQueueServiceDependencies,
  type EmailQueueProcessorConfig
} from '../../src/services/emailQueueService'
import type {
  EmailQueueItem,
  EmailQueueCreateInput,
  EmailBatch,
  EmailProcessingResult,
  EmailBatchProcessingResult
} from '../../src/models/emailQueue'
import { 
  setupTestEnvironment,
  cleanupTestEnvironment,
  createMockEmailQueueDatabase,
  createMockEmailTemplateService,
  createMockResendService,
  createMockEmailRetryService,
  setupDatabaseMocks,
  assertEmailQueueItem,
  assertEmailProcessingResult,
  assertEmailBatchProcessingResult,
  waitForAsyncOperations
} from '../utils/emailTestHelpers'
import { 
  testEmailQueueItems,
  testEmailQueueCreateInputs,
  testEmailBatches,
  testEmailProcessingResults,
  testEmailBatchProcessingResults,
  createTestEmailQueueItem,
  createTestEmailQueueCreateInput,
  createTestEmailBatch,
  createTestEmailQueueItems
} from '../fixtures/emailTestData'

describe('Email Queue Service', () => {
  let emailQueueService: EmailQueueService
  let mockDb: ReturnType<typeof createMockEmailQueueDatabase>
  let dependencies: EmailQueueServiceDependencies
  let config: EmailQueueProcessorConfig
  let testEnv: ReturnType<typeof setupTestEnvironment>

  beforeEach(() => {
    testEnv = setupTestEnvironment()
    mockDb = testEnv.mockDb
    
    dependencies = {
      db: mockDb as any,
      templateService: testEnv.mockTemplateService,
      resendService: testEnv.mockResendService,
      retryService: testEnv.mockRetryService
    }
    
    config = {
      ...DEFAULT_EMAIL_QUEUE_CONFIG,
      processingInterval: 100, // Faster for testing
      healthCheckInterval: 200,
      cleanupInterval: 300
    }
    
    emailQueueService = createEmailQueueService(config, dependencies)
  })

  afterEach(() => {
    emailQueueService.stop()
    testEnv.cleanup()
    cleanupTestEnvironment()
  })

  describe('Queue Management', () => {
    it('should add email to queue successfully', async () => {
      const input = createTestEmailQueueCreateInput()
      
      const result = await emailQueueService.addToQueue(input)
      
      assertEmailQueueItem(result, {
        userId: input.userId,
        recipientEmail: input.recipientEmail,
        templateType: input.templateType,
        priority: input.priority,
        status: 'pending',
        retryCount: 0
      })
      
      expect(result.id).toBeTruthy()
      expect(result.subject).toBe('Test Email Subject')
      expect(result.htmlContent).toBe('<div>Test HTML Content</div>')
      expect(result.textContent).toBe('Test text content')
    })

    it('should validate input when adding to queue', async () => {
      const invalidInput = {
        ...createTestEmailQueueCreateInput(),
        userId: '', // Invalid
        recipientEmail: 'invalid-email' // Invalid
      }
      
      await expect(emailQueueService.addToQueue(invalidInput))
        .rejects.toThrow('User ID is required')
    })

    it('should validate email format', async () => {
      const invalidInput = {
        ...createTestEmailQueueCreateInput(),
        recipientEmail: 'invalid-email-format'
      }
      
      await expect(emailQueueService.addToQueue(invalidInput))
        .rejects.toThrow('Invalid recipient email format')
    })

    it('should set default priority when not specified', async () => {
      const input = {
        ...createTestEmailQueueCreateInput(),
        priority: undefined
      }
      
      const result = await emailQueueService.addToQueue(input)
      
      expect(result.priority).toBe(3) // Default low priority
    })

    it('should set scheduled time when not specified', async () => {
      const input = {
        ...createTestEmailQueueCreateInput(),
        scheduledAt: undefined
      }
      
      const result = await emailQueueService.addToQueue(input)
      
      expect(new Date(result.scheduledAt)).toBeInstanceOf(Date)
    })

    it('should render template when adding to queue', async () => {
      const input = createTestEmailQueueCreateInput()
      
      await emailQueueService.addToQueue(input)
      
      expect(dependencies.templateService.renderTemplate).toHaveBeenCalledWith({
        templateType: input.templateType,
        data: input.templateData,
        userId: input.userId,
        priority: 'high'
      })
    })

    it('should handle template rendering errors', async () => {
      const input = createTestEmailQueueCreateInput()
      
      // Mock template service to throw error
      vi.mocked(dependencies.templateService.renderTemplate).mockRejectedValue(
        new Error('Template not found')
      )
      
      await expect(emailQueueService.addToQueue(input))
        .rejects.toThrow('Failed to add email to queue')
    })
  })

  describe('Queue Processing', () => {
    it('should process single email successfully', async () => {
      const emailItem = createTestEmailQueueItem({ status: 'pending' })
      setupDatabaseMocks(mockDb, [emailItem])
      
      // Mock successful send
      vi.mocked(dependencies.resendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'resend-msg-123'
      })
      
      const result = await emailQueueService.processQueueItem(emailItem.id)
      
      assertEmailProcessingResult(result, {
        emailId: emailItem.id,
        success: true,
        resendMessageId: 'resend-msg-123'
      })
      
      expect(result.processingTime).toBeGreaterThan(0)
    })

    it('should handle email not found in queue', async () => {
      setupDatabaseMocks(mockDb, [])
      
      await expect(emailQueueService.processQueueItem('non-existent-id'))
        .rejects.toThrow('Email not found in queue')
    })

    it('should prevent processing of already processing emails', async () => {
      const emailItem = createTestEmailQueueItem({ status: 'processing' })
      setupDatabaseMocks(mockDb, [emailItem])
      
      await expect(emailQueueService.processQueueItem(emailItem.id))
        .rejects.toThrow('Email is already being processed')
    })

    it('should prevent processing of future scheduled emails', async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      const emailItem = createTestEmailQueueItem({ 
        status: 'pending',
        scheduledAt: futureTime
      })
      setupDatabaseMocks(mockDb, [emailItem])
      
      await expect(emailQueueService.processQueueItem(emailItem.id))
        .rejects.toThrow('Email is not yet scheduled for processing')
    })

    it('should update email status during processing', async () => {
      const emailItem = createTestEmailQueueItem({ status: 'pending' })
      const dbMocks = setupDatabaseMocks(mockDb, [emailItem])
      
      vi.mocked(dependencies.resendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'resend-msg-123'
      })
      
      await emailQueueService.processQueueItem(emailItem.id)
      
      // Verify status was updated to processing, then to sent
      expect(dbMocks.getItems()[0].status).toBe('sent')
      expect(dbMocks.getItems()[0].resendMessageId).toBe('resend-msg-123')
      expect(dbMocks.getItems()[0].sentAt).toBeTruthy()
    })

    it('should handle email sending failures', async () => {
      const emailItem = createTestEmailQueueItem({ status: 'pending' })
      setupDatabaseMocks(mockDb, [emailItem])
      
      vi.mocked(dependencies.resendService.sendEmail).mockResolvedValue({
        success: false,
        error: 'Invalid email address'
      })
      
      // Mock retry service to not retry
      vi.mocked(dependencies.retryService.shouldRetry).mockResolvedValue({
        shouldRetry: false,
        shouldSuppress: false,
        totalAttempts: 1,
        remainingAttempts: 0,
        failureType: 'permanent_failure'
      })
      
      const result = await emailQueueService.processQueueItem(emailItem.id)
      
      assertEmailProcessingResult(result, {
        emailId: emailItem.id,
        success: false,
        retryScheduled: false
      })
    })

    it('should schedule retries for temporary failures', async () => {
      const emailItem = createTestEmailQueueItem({ status: 'pending' })
      setupDatabaseMocks(mockDb, [emailItem])
      
      vi.mocked(dependencies.resendService.sendEmail).mockResolvedValue({
        success: false,
        error: 'Service unavailable'
      })
      
      const nextRetryAt = new Date(Date.now() + 60000).toISOString()
      vi.mocked(dependencies.retryService.shouldRetry).mockResolvedValue({
        shouldRetry: true,
        nextRetryAt,
        backoffSeconds: 60,
        totalAttempts: 1,
        remainingAttempts: 2,
        shouldSuppress: false,
        failureType: 'temporary_failure'
      })
      
      const result = await emailQueueService.processQueueItem(emailItem.id)
      
      assertEmailProcessingResult(result, {
        emailId: emailItem.id,
        success: false,
        retryScheduled: true,
        nextRetryAt
      })
    })

    it('should handle unexpected processing errors', async () => {
      const emailItem = createTestEmailQueueItem({ status: 'pending' })
      setupDatabaseMocks(mockDb, [emailItem])
      
      // Mock resend service to throw error
      vi.mocked(dependencies.resendService.sendEmail).mockRejectedValue(
        new Error('Network error')
      )
      
      const result = await emailQueueService.processQueueItem(emailItem.id)
      
      assertEmailProcessingResult(result, {
        emailId: emailItem.id,
        success: false,
        errorMessage: 'Network error'
      })
    })
  })

  describe('Batch Processing', () => {
    it('should process batch of emails successfully', async () => {
      const emails = createTestEmailQueueItems(3, { status: 'pending' })
      setupDatabaseMocks(mockDb, emails)
      
      vi.mocked(dependencies.resendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'resend-msg-123'
      })
      
      const result = await emailQueueService.processQueue({ maxBatchSize: 3 })
      
      assertEmailBatchProcessingResult(result, {
        success: true,
        emailsProcessed: 3,
        emailsSent: 3,
        emailsFailed: 0
      })
      
      expect(result.results).toHaveLength(3)
      result.results.forEach(emailResult => {
        expect(emailResult.success).toBe(true)
      })
    })

    it('should handle empty queue gracefully', async () => {
      setupDatabaseMocks(mockDb, [])
      
      const result = await emailQueueService.processQueue()
      
      assertEmailBatchProcessingResult(result, {
        success: true,
        emailsProcessed: 0,
        emailsSent: 0,
        emailsFailed: 0
      })
      
      expect(result.results).toHaveLength(0)
    })

    it('should process emails by priority order', async () => {
      const emails = [
        createTestEmailQueueItem({ id: 'low', priority: 3, status: 'pending' }),
        createTestEmailQueueItem({ id: 'high', priority: 1, status: 'pending' }),
        createTestEmailQueueItem({ id: 'medium', priority: 2, status: 'pending' })
      ]
      setupDatabaseMocks(mockDb, emails)
      
      vi.mocked(dependencies.resendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'resend-msg-123'
      })
      
      const result = await emailQueueService.processQueue({ priority: 1 })
      
      // Should only process high priority email
      assertEmailBatchProcessingResult(result, {
        success: true,
        emailsProcessed: 1,
        emailsSent: 1,
        emailsFailed: 0
      })
      
      expect(result.results[0].emailId).toBe('high')
    })

    it('should respect batch size limits', async () => {
      const emails = createTestEmailQueueItems(10, { status: 'pending' })
      setupDatabaseMocks(mockDb, emails)
      
      vi.mocked(dependencies.resendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'resend-msg-123'
      })
      
      const result = await emailQueueService.processQueue({ maxBatchSize: 5 })
      
      assertEmailBatchProcessingResult(result, {
        success: true,
        emailsProcessed: 5,
        emailsSent: 5,
        emailsFailed: 0
      })
    })

    it('should handle mixed success and failure in batch', async () => {
      const emails = createTestEmailQueueItems(3, { status: 'pending' })
      setupDatabaseMocks(mockDb, emails)
      
      // Mock alternating success/failure
      vi.mocked(dependencies.resendService.sendEmail)
        .mockResolvedValueOnce({ success: true, messageId: 'msg-1' })
        .mockResolvedValueOnce({ success: false, error: 'Error' })
        .mockResolvedValueOnce({ success: true, messageId: 'msg-3' })
      
      vi.mocked(dependencies.retryService.shouldRetry).mockResolvedValue({
        shouldRetry: false,
        shouldSuppress: false,
        totalAttempts: 1,
        remainingAttempts: 0,
        failureType: 'permanent_failure'
      })
      
      const result = await emailQueueService.processQueue({ maxBatchSize: 3 })
      
      assertEmailBatchProcessingResult(result, {
        success: true,
        emailsProcessed: 3,
        emailsSent: 2,
        emailsFailed: 1
      })
    })

    it('should handle batch processing failure', async () => {
      const emails = createTestEmailQueueItems(2, { status: 'pending' })
      setupDatabaseMocks(mockDb, emails)
      
      // Mock database error during batch creation
      vi.mocked(mockDb.prepare).mockImplementation(() => {
        throw new Error('Database error')
      })
      
      await expect(emailQueueService.processQueue())
        .rejects.toThrow('Queue processing failed')
    })
  })

  describe('Queue Statistics', () => {
    it('should return accurate queue statistics', async () => {
      // Mock database responses for statistics
      mockDb.setMockResult('all', [
        { status: 'pending', count: 10 },
        { status: 'processing', count: 2 },
        { status: 'sent', count: 100 },
        { status: 'failed', count: 5 }
      ])
      
      mockDb.setMockResult('first', {
        avg_processing_time: 2500,
        avg_retry_count: 0.5
      })
      
      const stats = await emailQueueService.getQueueStatistics()
      
      expect(stats).toEqual({
        totalPending: 10,
        totalProcessing: 2,
        totalSent: 100,
        totalFailed: 5,
        totalCancelled: 0,
        averageProcessingTime: 2500,
        averageRetryCount: 0.5,
        oldestPendingAge: 0,
        successRate: expect.closeTo(95.24, 1)
      })
    })

    it('should handle empty statistics gracefully', async () => {
      mockDb.setMockResult('all', [])
      mockDb.setMockResult('first', null)
      
      const stats = await emailQueueService.getQueueStatistics()
      
      expect(stats).toEqual({
        totalPending: 0,
        totalProcessing: 0,
        totalSent: 0,
        totalFailed: 0,
        totalCancelled: 0,
        averageProcessingTime: 0,
        averageRetryCount: 0,
        oldestPendingAge: 0,
        successRate: 0
      })
    })

    it('should calculate success rate correctly', async () => {
      mockDb.setMockResult('all', [
        { status: 'sent', count: 95 },
        { status: 'failed', count: 5 }
      ])
      
      const stats = await emailQueueService.getQueueStatistics()
      
      expect(stats.successRate).toBe(95)
    })
  })

  describe('Health Monitoring', () => {
    it('should report healthy status', async () => {
      // Mock healthy statistics
      mockDb.setMockResult('all', [
        { status: 'pending', count: 10 },
        { status: 'sent', count: 100 },
        { status: 'failed', count: 2 }
      ])
      
      mockDb.setMockResult('first', {
        avg_processing_time: 2500,
        avg_retry_count: 0.2
      })
      
      const health = await emailQueueService.getHealthStatus()
      
      expect(health.isHealthy).toBe(true)
      expect(health.issues).toHaveLength(0)
      expect(health.queueSize).toBe(10)
      expect(health.errorRate).toBeLessThan(5)
    })

    it('should report unhealthy status with issues', async () => {
      // Mock unhealthy statistics
      mockDb.setMockResult('all', [
        { status: 'pending', count: 1500 }, // Too many pending
        { status: 'sent', count: 50 },
        { status: 'failed', count: 50 } // High failure rate
      ])
      
      mockDb.setMockResult('first', {
        avg_processing_time: 35000, // Slow processing
        avg_retry_count: 2.5
      })
      
      const health = await emailQueueService.getHealthStatus()
      
      expect(health.isHealthy).toBe(false)
      expect(health.issues).toContain('High number of pending emails')
      expect(health.issues).toContain('Low success rate')
      expect(health.issues).toContain('Slow processing times')
      expect(health.queueSize).toBe(1500)
      expect(health.errorRate).toBe(50)
    })

    it('should handle health check errors gracefully', async () => {
      // Mock database error
      vi.mocked(mockDb.prepare).mockImplementation(() => {
        throw new Error('Database error')
      })
      
      const health = await emailQueueService.getHealthStatus()
      
      expect(health.isHealthy).toBe(false)
      expect(health.issues).toContain('Health check failed')
    })
  })

  describe('Email Cancellation', () => {
    it('should cancel pending email successfully', async () => {
      const emailItem = createTestEmailQueueItem({ status: 'pending' })
      const dbMocks = setupDatabaseMocks(mockDb, [emailItem])
      
      await emailQueueService.cancelEmail(emailItem.id, 'User requested cancellation')
      
      expect(dbMocks.getItems()[0].status).toBe('cancelled')
      expect(dbMocks.getItems()[0].errorMessage).toBe('User requested cancellation')
    })

    it('should prevent cancellation of sent emails', async () => {
      const emailItem = createTestEmailQueueItem({ status: 'sent' })
      setupDatabaseMocks(mockDb, [emailItem])
      
      await expect(emailQueueService.cancelEmail(emailItem.id))
        .rejects.toThrow('Cannot cancel sent email')
    })

    it('should prevent cancellation of processing emails', async () => {
      const emailItem = createTestEmailQueueItem({ status: 'processing' })
      setupDatabaseMocks(mockDb, [emailItem])
      
      await expect(emailQueueService.cancelEmail(emailItem.id))
        .rejects.toThrow('Cannot cancel email being processed')
    })

    it('should handle cancellation of non-existent email', async () => {
      setupDatabaseMocks(mockDb, [])
      
      await expect(emailQueueService.cancelEmail('non-existent-id'))
        .rejects.toThrow('Email not found')
    })
  })

  describe('Queue Cleanup', () => {
    it('should cleanup old completed emails', async () => {
      mockDb.setMockResult('changes', 5) // 5 emails deleted
      
      const result = await emailQueueService.cleanup()
      
      expect(result.deletedCount).toBe(5)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle cleanup errors gracefully', async () => {
      // Mock database error
      vi.mocked(mockDb.prepare).mockImplementation(() => {
        throw new Error('Database error')
      })
      
      const result = await emailQueueService.cleanup()
      
      expect(result.deletedCount).toBe(0)
      expect(result.errors).toContain('Database error')
    })
  })

  describe('Background Processing', () => {
    it('should start and stop background processing', async () => {
      const service = createEmailQueueService(config, dependencies)
      
      // Service should start automatically
      expect(service).toBeDefined()
      
      // Stop should work without errors
      service.stop()
    })

    it('should process queue automatically in background', async () => {
      const emails = createTestEmailQueueItems(2, { status: 'pending' })
      setupDatabaseMocks(mockDb, emails)
      
      vi.mocked(dependencies.resendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'resend-msg-123'
      })
      
      const service = createEmailQueueService({
        ...config,
        processingInterval: 50 // Very fast for testing
      }, dependencies)
      
      // Wait for background processing
      await waitForAsyncOperations(200)
      
      // Should have attempted to send emails
      expect(dependencies.resendService.sendEmail).toHaveBeenCalled()
      
      service.stop()
    })
  })

  describe('Service Configuration', () => {
    it('should use default configuration', async () => {
      const service = createEmailQueueService(DEFAULT_EMAIL_QUEUE_CONFIG, dependencies)
      
      expect(service).toBeDefined()
      
      service.stop()
    })

    it('should accept custom configuration', async () => {
      const customConfig = {
        ...DEFAULT_EMAIL_QUEUE_CONFIG,
        batchSize: 25,
        processingInterval: 10000,
        maxConcurrentBatches: 5
      }
      
      const service = createEmailQueueService(customConfig, dependencies)
      
      expect(service).toBeDefined()
      
      service.stop()
    })

    it('should validate required dependencies', async () => {
      const incompleteDependencies = {
        db: mockDb as any,
        templateService: testEnv.mockTemplateService
        // Missing resendService and retryService
      } as any
      
      expect(() => createEmailQueueService(config, incompleteDependencies))
        .toThrow()
    })
  })
})