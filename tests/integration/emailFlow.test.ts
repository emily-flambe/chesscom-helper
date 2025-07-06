/**
 * Email Flow Integration Tests
 * End-to-end tests for complete email delivery workflow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  EmailQueueService,
  createEmailQueueService,
  DEFAULT_EMAIL_QUEUE_CONFIG
} from '../../src/services/emailQueueService'
import { EmailRetryService } from '../../src/services/emailRetryService'
import { ResendWebhookHandler } from '../../src/services/resendWebhookHandler'
import type {
  EmailQueueItem,
  EmailQueueCreateInput,
  EmailProcessingResult
} from '../../src/models/emailQueue'
import { 
  setupTestEnvironment,
  cleanupTestEnvironment,
  createMockEmailQueueDatabase,
  createMockEmailTemplateService,
  createMockResendService,
  createMockEmailRetryService,
  setupDatabaseMocks,
  createMockWebhookRequest,
  simulateWebhookDelivery,
  waitForAsyncOperations,
  measurePerformance
} from '../utils/emailTestHelpers'
import { 
  testEmailQueueCreateInputs,
  testWebhookPayloads,
  createTestEmailQueueCreateInput,
  createTestEmailQueueItems
} from '../fixtures/emailTestData'

describe('Email Flow Integration Tests', () => {
  let emailQueueService: EmailQueueService
  let retryService: EmailRetryService
  let webhookHandler: ResendWebhookHandler
  let mockDb: ReturnType<typeof createMockEmailQueueDatabase>
  let testEnv: ReturnType<typeof setupTestEnvironment>

  beforeEach(() => {
    testEnv = setupTestEnvironment()
    mockDb = testEnv.mockDb
    
    const dependencies = {
      db: mockDb as any,
      templateService: testEnv.mockTemplateService,
      resendService: testEnv.mockResendService,
      retryService: testEnv.mockRetryService
    }
    
    const config = {
      ...DEFAULT_EMAIL_QUEUE_CONFIG,
      processingInterval: 50, // Fast for testing
      healthCheckInterval: 100,
      cleanupInterval: 200
    }
    
    emailQueueService = createEmailQueueService(config, dependencies)
    retryService = new EmailRetryService(mockDb as any)
    webhookHandler = new ResendWebhookHandler(mockDb as any)
  })

  afterEach(() => {
    emailQueueService.stop()
    testEnv.cleanup()
    cleanupTestEnvironment()
  })

  describe('Complete Email Delivery Flow', () => {
    it('should complete successful email delivery end-to-end', async () => {
      // Step 1: Add email to queue
      const input = createTestEmailQueueCreateInput()
      const queueItem = await emailQueueService.addToQueue(input)
      
      expect(queueItem.status).toBe('pending')
      expect(queueItem.id).toBeTruthy()
      
      // Step 2: Process email from queue
      vi.mocked(testEnv.mockResendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'resend-msg-123'
      })
      
      const processingResult = await emailQueueService.processQueueItem(queueItem.id)
      
      expect(processingResult.success).toBe(true)
      expect(processingResult.resendMessageId).toBe('resend-msg-123')
      
      // Step 3: Simulate webhook delivery confirmation
      const { payload, signature } = simulateWebhookDelivery('resend-msg-123', 'email.delivered')
      const webhookRequest = createMockWebhookRequest(payload, signature)
      
      await webhookHandler.handleWebhook(webhookRequest)
      
      // Verify complete flow
      expect(testEnv.mockTemplateService.renderTemplate).toHaveBeenCalled()
      expect(testEnv.mockResendService.sendEmail).toHaveBeenCalled()
    })

    it('should handle email failure with retry flow', async () => {
      // Step 1: Add email to queue
      const input = createTestEmailQueueCreateInput()
      const queueItem = await emailQueueService.addToQueue(input)
      
      // Step 2: Simulate email send failure
      vi.mocked(testEnv.mockResendService.sendEmail).mockResolvedValue({
        success: false,
        error: 'Service temporarily unavailable'
      })
      
      // Step 3: Mock retry decision to retry
      const nextRetryAt = new Date(Date.now() + 60000).toISOString()
      vi.mocked(testEnv.mockRetryService.shouldRetry).mockResolvedValue({
        shouldRetry: true,
        nextRetryAt,
        backoffSeconds: 60,
        totalAttempts: 2,
        remainingAttempts: 1,
        shouldSuppress: false,
        failureType: 'temporary_failure'
      })
      
      const processingResult = await emailQueueService.processQueueItem(queueItem.id)
      
      expect(processingResult.success).toBe(false)
      expect(processingResult.retryScheduled).toBe(true)
      expect(processingResult.nextRetryAt).toBe(nextRetryAt)
      
      // Step 4: Simulate successful retry
      vi.mocked(testEnv.mockResendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'resend-msg-retry-123'
      })
      
      // Wait for scheduled retry time (mocked)
      await waitForAsyncOperations(100)
      
      const retryResult = await emailQueueService.processQueueItem(queueItem.id)
      
      expect(retryResult.success).toBe(true)
      expect(retryResult.resendMessageId).toBe('resend-msg-retry-123')
    })

    it('should handle permanent failure with suppression', async () => {
      // Step 1: Add email to queue
      const input = createTestEmailQueueCreateInput({
        recipientEmail: 'invalid@example.com'
      })
      const queueItem = await emailQueueService.addToQueue(input)
      
      // Step 2: Simulate permanent failure
      vi.mocked(testEnv.mockResendService.sendEmail).mockResolvedValue({
        success: false,
        error: 'Invalid email address'
      })
      
      // Step 3: Mock retry decision to not retry and suppress
      vi.mocked(testEnv.mockRetryService.shouldRetry).mockResolvedValue({
        shouldRetry: false,
        shouldSuppress: true,
        suppressionReason: 'Invalid email address',
        totalAttempts: 1,
        remainingAttempts: 0,
        failureType: 'permanent_failure'
      })
      
      const processingResult = await emailQueueService.processQueueItem(queueItem.id)
      
      expect(processingResult.success).toBe(false)
      expect(processingResult.retryScheduled).toBe(false)
      
      // Verify suppression was added
      expect(testEnv.mockRetryService.addToSuppressionList).toHaveBeenCalledWith(
        'invalid@example.com',
        'Invalid email address',
        queueItem.id,
        'permanent_failure'
      )
    })

    it('should handle batch processing with mixed results', async () => {
      // Step 1: Add multiple emails to queue
      const inputs = [
        createTestEmailQueueCreateInput({ recipientEmail: 'success1@example.com' }),
        createTestEmailQueueCreateInput({ recipientEmail: 'success2@example.com' }),
        createTestEmailQueueCreateInput({ recipientEmail: 'failure@example.com' }),
        createTestEmailQueueCreateInput({ recipientEmail: 'retry@example.com' })
      ]
      
      const queueItems = await Promise.all(
        inputs.map(input => emailQueueService.addToQueue(input))
      )
      
      setupDatabaseMocks(mockDb, queueItems)
      
      // Step 2: Mock different send results
      vi.mocked(testEnv.mockResendService.sendEmail)
        .mockResolvedValueOnce({ success: true, messageId: 'msg-1' })
        .mockResolvedValueOnce({ success: true, messageId: 'msg-2' })
        .mockResolvedValueOnce({ success: false, error: 'Invalid email' })
        .mockResolvedValueOnce({ success: false, error: 'Temporary error' })
      
      // Step 3: Mock retry decisions
      vi.mocked(testEnv.mockRetryService.shouldRetry)
        .mockResolvedValueOnce({ // For permanent failure
          shouldRetry: false,
          shouldSuppress: true,
          suppressionReason: 'Invalid email',
          totalAttempts: 1,
          remainingAttempts: 0,
          failureType: 'permanent_failure'
        })
        .mockResolvedValueOnce({ // For temporary failure
          shouldRetry: true,
          nextRetryAt: new Date(Date.now() + 60000).toISOString(),
          backoffSeconds: 60,
          totalAttempts: 2,
          remainingAttempts: 1,
          shouldSuppress: false,
          failureType: 'temporary_failure'
        })
      
      // Step 4: Process batch
      const batchResult = await emailQueueService.processQueue({ maxBatchSize: 4 })
      
      expect(batchResult.success).toBe(true)
      expect(batchResult.emailsProcessed).toBe(4)
      expect(batchResult.emailsSent).toBe(2)
      expect(batchResult.emailsFailed).toBe(2)
      
      // Verify individual results
      const successResults = batchResult.results.filter(r => r.success)
      const failureResults = batchResult.results.filter(r => !r.success)
      
      expect(successResults).toHaveLength(2)
      expect(failureResults).toHaveLength(2)
      expect(failureResults.find(r => r.retryScheduled)).toBeTruthy()
    })

    it('should handle webhook delivery confirmations', async () => {
      // Step 1: Process email successfully
      const input = createTestEmailQueueCreateInput()
      const queueItem = await emailQueueService.addToQueue(input)
      
      vi.mocked(testEnv.mockResendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'resend-msg-webhook-123'
      })
      
      await emailQueueService.processQueueItem(queueItem.id)
      
      // Step 2: Simulate delivery webhook
      const { payload, signature } = simulateWebhookDelivery('resend-msg-webhook-123', 'email.delivered')
      const webhookRequest = createMockWebhookRequest(payload, signature)
      
      // Mock webhook validation
      vi.mocked(testEnv.mockResendService.validateWebhook).mockReturnValue(true)
      
      await webhookHandler.handleWebhook(webhookRequest)
      
      expect(testEnv.mockResendService.validateWebhook).toHaveBeenCalled()
      expect(testEnv.mockResendService.processWebhook).toHaveBeenCalled()
    })

    it('should handle bounce webhook notifications', async () => {
      // Step 1: Process email that will bounce
      const input = createTestEmailQueueCreateInput({
        recipientEmail: 'bounce@example.com'
      })
      const queueItem = await emailQueueService.addToQueue(input)
      
      vi.mocked(testEnv.mockResendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'resend-msg-bounce-123'
      })
      
      await emailQueueService.processQueueItem(queueItem.id)
      
      // Step 2: Simulate bounce webhook
      const { payload, signature } = simulateWebhookDelivery('resend-msg-bounce-123', 'email.bounced')
      const webhookRequest = createMockWebhookRequest(payload, signature)
      
      vi.mocked(testEnv.mockResendService.validateWebhook).mockReturnValue(true)
      
      await webhookHandler.handleWebhook(webhookRequest)
      
      // Verify bounce was processed
      expect(testEnv.mockResendService.processWebhook).toHaveBeenCalledWith(payload)
    })

    it('should handle spam complaint webhook notifications', async () => {
      // Step 1: Process email that will generate complaint
      const input = createTestEmailQueueCreateInput({
        recipientEmail: 'complaint@example.com'
      })
      const queueItem = await emailQueueService.addToQueue(input)
      
      vi.mocked(testEnv.mockResendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'resend-msg-complaint-123'
      })
      
      await emailQueueService.processQueueItem(queueItem.id)
      
      // Step 2: Simulate complaint webhook
      const { payload, signature } = simulateWebhookDelivery('resend-msg-complaint-123', 'email.complained')
      const webhookRequest = createMockWebhookRequest(payload, signature)
      
      vi.mocked(testEnv.mockResendService.validateWebhook).mockReturnValue(true)
      
      await webhookHandler.handleWebhook(webhookRequest)
      
      // Verify complaint was processed and likely added to suppression
      expect(testEnv.mockResendService.processWebhook).toHaveBeenCalledWith(payload)
    })
  })

  describe('Background Processing Integration', () => {
    it('should process queue automatically in background', async () => {
      // Add emails to queue
      const inputs = Array.from({ length: 3 }, () => createTestEmailQueueCreateInput())
      const queueItems = await Promise.all(
        inputs.map(input => emailQueueService.addToQueue(input))
      )
      
      setupDatabaseMocks(mockDb, queueItems)
      
      // Mock successful sends
      vi.mocked(testEnv.mockResendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'auto-msg-123'
      })
      
      // Wait for background processing
      await waitForAsyncOperations(500)
      
      // Should have processed emails automatically
      expect(testEnv.mockResendService.sendEmail).toHaveBeenCalled()
    })

    it('should respect processing intervals', async () => {
      const fastConfig = {
        ...DEFAULT_EMAIL_QUEUE_CONFIG,
        processingInterval: 10 // Very fast
      }
      
      const fastService = createEmailQueueService(fastConfig, {
        db: mockDb as any,
        templateService: testEnv.mockTemplateService,
        resendService: testEnv.mockResendService,
        retryService: testEnv.mockRetryService
      })
      
      // Add email
      const input = createTestEmailQueueCreateInput()
      await fastService.addToQueue(input)
      
      vi.mocked(testEnv.mockResendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'interval-msg-123'
      })
      
      // Should process quickly due to fast interval
      await waitForAsyncOperations(100)
      
      expect(testEnv.mockResendService.sendEmail).toHaveBeenCalled()
      
      fastService.stop()
    })

    it('should handle priority-based processing', async () => {
      // Add emails with different priorities
      const highPriorityInput = createTestEmailQueueCreateInput({ priority: 1 })
      const lowPriorityInput = createTestEmailQueueCreateInput({ priority: 3 })
      
      const highPriorityItem = await emailQueueService.addToQueue(highPriorityInput)
      const lowPriorityItem = await emailQueueService.addToQueue(lowPriorityInput)
      
      setupDatabaseMocks(mockDb, [lowPriorityItem, highPriorityItem]) // Low priority first in array
      
      vi.mocked(testEnv.mockResendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'priority-msg-123'
      })
      
      // Process with priority enabled
      const result = await emailQueueService.processQueue({
        priority: 1, // Only high priority
        maxBatchSize: 1
      })
      
      expect(result.emailsProcessed).toBe(1)
      // Should have processed high priority email first
    })
  })

  describe('Error Recovery Integration', () => {
    it('should recover from service outages', async () => {
      // Step 1: Add email during outage
      const input = createTestEmailQueueCreateInput()
      const queueItem = await emailQueueService.addToQueue(input)
      
      // Step 2: Simulate service outage
      vi.mocked(testEnv.mockResendService.sendEmail).mockRejectedValue(
        new Error('Service unavailable')
      )
      
      vi.mocked(testEnv.mockRetryService.shouldRetry).mockResolvedValue({
        shouldRetry: true,
        nextRetryAt: new Date(Date.now() + 60000).toISOString(),
        backoffSeconds: 60,
        totalAttempts: 2,
        remainingAttempts: 2,
        shouldSuppress: false,
        failureType: 'temporary_failure'
      })
      
      const failureResult = await emailQueueService.processQueueItem(queueItem.id)
      
      expect(failureResult.success).toBe(false)
      expect(failureResult.retryScheduled).toBe(true)
      
      // Step 3: Service recovers
      vi.mocked(testEnv.mockResendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'recovery-msg-123'
      })
      
      const recoveryResult = await emailQueueService.processQueueItem(queueItem.id)
      
      expect(recoveryResult.success).toBe(true)
      expect(recoveryResult.resendMessageId).toBe('recovery-msg-123')
    })

    it('should handle database connectivity issues', async () => {
      // Simulate database error during processing
      const originalPrepare = mockDb.prepare
      vi.mocked(mockDb.prepare).mockImplementation(() => {
        throw new Error('Database connection lost')
      })
      
      const input = createTestEmailQueueCreateInput()
      
      await expect(emailQueueService.addToQueue(input))
        .rejects.toThrow('Failed to add email to queue')
      
      // Restore database connection
      vi.mocked(mockDb.prepare).mockImplementation(originalPrepare)
      
      // Should work again
      const queueItem = await emailQueueService.addToQueue(input)
      expect(queueItem.id).toBeTruthy()
    })

    it('should handle template rendering failures gracefully', async () => {
      // Mock template service failure
      vi.mocked(testEnv.mockTemplateService.renderTemplate).mockRejectedValue(
        new Error('Template not found')
      )
      
      const input = createTestEmailQueueCreateInput()
      
      await expect(emailQueueService.addToQueue(input))
        .rejects.toThrow('Failed to add email to queue')
      
      // Restore template service
      vi.mocked(testEnv.mockTemplateService.renderTemplate).mockResolvedValue({
        subject: 'Test Subject',
        html: '<div>Test HTML</div>',
        text: 'Test text'
      })
      
      // Should work again
      const queueItem = await emailQueueService.addToQueue(input)
      expect(queueItem.id).toBeTruthy()
    })
  })

  describe('Performance Integration', () => {
    it('should handle high-volume email processing', async () => {
      const emailCount = 100
      const inputs = Array.from({ length: emailCount }, (_, i) => 
        createTestEmailQueueCreateInput({
          recipientEmail: `user${i}@example.com`
        })
      )
      
      // Add all emails to queue
      const { result: queueItems, duration: queueDuration } = await measurePerformance(
        () => Promise.all(inputs.map(input => emailQueueService.addToQueue(input))),
        'Queue 100 emails'
      )
      
      expect(queueItems).toHaveLength(emailCount)
      expect(queueDuration).toBeLessThan(5000) // Should queue 100 emails in under 5 seconds
      
      setupDatabaseMocks(mockDb, queueItems)
      
      // Mock successful sends
      vi.mocked(testEnv.mockResendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'bulk-msg-123'
      })
      
      // Process all emails
      const { result: batchResult, duration: processingDuration } = await measurePerformance(
        () => emailQueueService.processQueue({ maxBatchSize: emailCount }),
        'Process 100 emails'
      )
      
      expect(batchResult.emailsProcessed).toBe(emailCount)
      expect(batchResult.emailsSent).toBe(emailCount)
      expect(processingDuration).toBeLessThan(10000) // Should process 100 emails in under 10 seconds
    })

    it('should maintain performance under concurrent load', async () => {
      const concurrentBatches = 5
      const emailsPerBatch = 20
      
      const batchPromises = Array.from({ length: concurrentBatches }, async (_, batchIndex) => {
        const inputs = Array.from({ length: emailsPerBatch }, (_, emailIndex) => 
          createTestEmailQueueCreateInput({
            recipientEmail: `batch${batchIndex}-user${emailIndex}@example.com`
          })
        )
        
        const queueItems = await Promise.all(
          inputs.map(input => emailQueueService.addToQueue(input))
        )
        
        return queueItems
      })
      
      const { result: allBatches, duration } = await measurePerformance(
        () => Promise.all(batchPromises),
        'Concurrent batching'
      )
      
      const totalEmails = allBatches.flat().length
      expect(totalEmails).toBe(concurrentBatches * emailsPerBatch)
      expect(duration).toBeLessThan(15000) // Should handle concurrent load in under 15 seconds
    })

    it('should maintain queue health under load', async () => {
      // Add many emails
      const inputs = Array.from({ length: 50 }, (_, i) => 
        createTestEmailQueueCreateInput({
          recipientEmail: `health${i}@example.com`
        })
      )
      
      await Promise.all(inputs.map(input => emailQueueService.addToQueue(input)))
      
      // Check health status
      const healthStatus = await emailQueueService.getHealthStatus()
      
      expect(healthStatus.queueSize).toBeGreaterThan(0)
      expect(healthStatus.lastHealthCheck).toBeTruthy()
      expect(healthStatus.issues).toBeDefined()
      
      // Should not be unhealthy just from queue size
      if (healthStatus.queueSize < 1000) {
        expect(healthStatus.isHealthy).toBe(true)
      }
    })
  })

  describe('Monitoring and Observability', () => {
    it('should provide accurate queue statistics', async () => {
      // Add mixed status emails
      const inputs = Array.from({ length: 10 }, (_, i) => 
        createTestEmailQueueCreateInput({
          recipientEmail: `stats${i}@example.com`
        })
      )
      
      await Promise.all(inputs.map(input => emailQueueService.addToQueue(input)))
      
      // Mock statistics data
      mockDb.setMockResult('all', [
        { status: 'pending', count: 5 },
        { status: 'sent', count: 3 },
        { status: 'failed', count: 2 }
      ])
      
      mockDb.setMockResult('first', {
        avg_processing_time: 2500,
        avg_retry_count: 0.8
      })
      
      const stats = await emailQueueService.getQueueStatistics()
      
      expect(stats.totalPending).toBe(5)
      expect(stats.totalSent).toBe(3)
      expect(stats.totalFailed).toBe(2)
      expect(stats.averageProcessingTime).toBe(2500)
      expect(stats.successRate).toBe(60) // 3/(3+2) * 100
    })

    it('should track processing metrics over time', async () => {
      const startTime = Date.now()
      
      // Process some emails
      const input = createTestEmailQueueCreateInput()
      const queueItem = await emailQueueService.addToQueue(input)
      
      vi.mocked(testEnv.mockResendService.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'metrics-msg-123'
      })
      
      const result = await emailQueueService.processQueueItem(queueItem.id)
      
      const endTime = Date.now()
      
      expect(result.processingTime).toBeGreaterThan(0)
      expect(result.processingTime).toBeLessThan(endTime - startTime)
    })

    it('should provide real-time health monitoring', async () => {
      // Initial health check
      const initialHealth = await emailQueueService.getHealthStatus()
      expect(initialHealth.lastHealthCheck).toBeTruthy()
      
      // Add emails and check health again
      const inputs = Array.from({ length: 5 }, () => createTestEmailQueueCreateInput())
      await Promise.all(inputs.map(input => emailQueueService.addToQueue(input)))
      
      const loadedHealth = await emailQueueService.getHealthStatus()
      expect(new Date(loadedHealth.lastHealthCheck).getTime()).toBeGreaterThan(
        new Date(initialHealth.lastHealthCheck).getTime()
      )
    })
  })
})