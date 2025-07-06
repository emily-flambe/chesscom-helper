/**
 * Email Load Performance Tests
 * Performance tests for high-volume email delivery scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  EmailQueueService,
  createEmailQueueService,
  DEFAULT_EMAIL_QUEUE_CONFIG
} from '../../src/services/emailQueueService'
import type {
  EmailQueueCreateInput,
  EmailBatchProcessingResult
} from '../../src/models/emailQueue'
import { 
  setupTestEnvironment,
  cleanupTestEnvironment,
  createMockEmailQueueDatabase,
  setupDatabaseMocks,
  measurePerformance,
  createPerformanceTestData,
  waitForAsyncOperations
} from '../utils/emailTestHelpers'
import { 
  testPerformanceScenarios,
  createTestEmailQueueCreateInput,
  createTestEmailQueueItems
} from '../fixtures/emailTestData'

describe('Email Load Performance Tests', () => {
  let emailQueueService: EmailQueueService
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
    
    const performanceConfig = {
      ...DEFAULT_EMAIL_QUEUE_CONFIG,
      batchSize: 50,
      processingInterval: 10, // Very fast for testing
      maxConcurrentBatches: 5,
      healthCheckInterval: 100,
      cleanupInterval: 1000
    }
    
    emailQueueService = createEmailQueueService(performanceConfig, dependencies)
    
    // Mock successful email sends by default
    vi.mocked(testEnv.mockResendService.sendEmail).mockResolvedValue({
      success: true,
      messageId: 'perf-test-msg'
    })
  })

  afterEach(() => {
    emailQueueService.stop()
    testEnv.cleanup()
    cleanupTestEnvironment()
  })

  describe('High Volume Queue Operations', () => {
    it('should handle 1000 emails queuing efficiently', async () => {
      const { emailCount, expectedProcessingTime } = testPerformanceScenarios.highVolume
      const testData = createPerformanceTestData(emailCount, {
        templateTypes: ['game_start', 'game_end'],
        priorities: [1, 2, 3],
        userCount: 100
      })
      
      const { result: queueItems, duration } = await measurePerformance(
        async () => {
          const items = []
          for (const input of testData) {
            const item = await emailQueueService.addToQueue(input)
            items.push(item)
          }
          return items
        },
        `Queue ${emailCount} emails`
      )
      
      expect(queueItems).toHaveLength(emailCount)
      expect(duration).toBeLessThan(30000) // Should queue 1000 emails in under 30 seconds
      
      // Verify all emails are properly queued
      queueItems.forEach((item, index) => {
        expect(item.id).toBeTruthy()
        expect(item.status).toBe('pending')
        expect(item.recipientEmail).toBe(testData[index].recipientEmail)
      })
    })

    it('should batch process 1000 emails efficiently', async () => {
      const { emailCount, batchSize, expectedProcessingTime } = testPerformanceScenarios.highVolume
      const queueItems = createTestEmailQueueItems(emailCount, { status: 'pending' })
      
      setupDatabaseMocks(mockDb, queueItems)
      
      const { result: batchResult, duration } = await measurePerformance(
        () => emailQueueService.processQueue({ maxBatchSize: batchSize }),
        `Process ${emailCount} emails in batches of ${batchSize}`
      )
      
      expect(batchResult.success).toBe(true)
      expect(batchResult.emailsProcessed).toBe(Math.min(emailCount, batchSize))
      expect(batchResult.emailsSent).toBe(Math.min(emailCount, batchSize))
      expect(duration).toBeLessThan(expectedProcessingTime)
      
      // Verify email service was called appropriately
      expect(testEnv.mockResendService.sendEmail).toHaveBeenCalledTimes(
        Math.min(emailCount, batchSize)
      )
    })

    it('should handle concurrent queue operations', async () => {
      const concurrentBatches = 10
      const emailsPerBatch = 50
      const totalEmails = concurrentBatches * emailsPerBatch
      
      const batchPromises = Array.from({ length: concurrentBatches }, (_, batchIndex) => {
        const batchData = createPerformanceTestData(emailsPerBatch, {
          templateTypes: ['game_start'],
          priorities: [Math.floor(Math.random() * 3) + 1] as any,
          userCount: 20
        }).map(data => ({
          ...data,
          recipientEmail: `batch${batchIndex}-${data.recipientEmail}`
        }))
        
        return Promise.all(
          batchData.map(input => emailQueueService.addToQueue(input))
        )
      })
      
      const { result: allBatches, duration } = await measurePerformance(
        () => Promise.all(batchPromises),
        `Concurrent queue operations: ${concurrentBatches} batches of ${emailsPerBatch}`
      )
      
      const allItems = allBatches.flat()
      expect(allItems).toHaveLength(totalEmails)
      expect(duration).toBeLessThan(60000) // Should complete in under 1 minute
      
      // Verify no duplicate IDs
      const uniqueIds = new Set(allItems.map(item => item.id))
      expect(uniqueIds.size).toBe(totalEmails)
    })

    it('should maintain performance with large queue sizes', async () => {
      // Pre-populate queue with many items
      const backgroundEmails = 2000
      const newEmails = 100
      
      const backgroundItems = createTestEmailQueueItems(backgroundEmails, { status: 'pending' })
      setupDatabaseMocks(mockDb, backgroundItems)
      
      // Add new emails to large existing queue
      const newInputs = createPerformanceTestData(newEmails)
      
      const { result: newItems, duration } = await measurePerformance(
        () => Promise.all(newInputs.map(input => emailQueueService.addToQueue(input))),
        `Add ${newEmails} emails to queue of ${backgroundEmails}`
      )
      
      expect(newItems).toHaveLength(newEmails)
      expect(duration).toBeLessThan(15000) // Should not be significantly slower with large queue
    })
  })

  describe('Memory and Resource Management', () => {
    it('should manage memory efficiently during bulk operations', async () => {
      const emailCount = 1000
      const batchSize = 100
      
      // Process emails in smaller batches to test memory management
      let totalProcessed = 0
      const batches = Math.ceil(emailCount / batchSize)
      
      for (let i = 0; i < batches; i++) {
        const batchEmails = createTestEmailQueueItems(
          Math.min(batchSize, emailCount - totalProcessed),
          { status: 'pending' }
        )
        
        setupDatabaseMocks(mockDb, batchEmails)
        
        const result = await emailQueueService.processQueue({ 
          maxBatchSize: batchSize 
        })
        
        expect(result.success).toBe(true)
        totalProcessed += result.emailsProcessed
        
        // Small delay to allow garbage collection
        await waitForAsyncOperations(10)
      }
      
      expect(totalProcessed).toBe(emailCount)
    })

    it('should handle template rendering performance', async () => {
      const templateCount = 500
      const templateInputs = Array.from({ length: templateCount }, (_, i) => ({
        templateType: 'game_start' as const,
        data: {
          userEmail: `user${i}@example.com`,
          baseUrl: 'https://test.chesshelper.app',
          unsubscribeUrl: `https://test.chesshelper.app/unsubscribe/user${i}`,
          preferencesUrl: 'https://test.chesshelper.app/preferences',
          playerName: `player${i}`,
          gameId: `game-${i}`,
          gameUrl: `https://chess.com/game/live/game-${i}`
        },
        userId: `user-${i}`,
        priority: 'high' as const
      }))
      
      const { duration } = await measurePerformance(
        () => Promise.all(
          templateInputs.map(input => testEnv.mockTemplateService.renderTemplate(input))
        ),
        `Render ${templateCount} templates`
      )
      
      expect(duration).toBeLessThan(5000) // Should render 500 templates in under 5 seconds
      expect(testEnv.mockTemplateService.renderTemplate).toHaveBeenCalledTimes(templateCount)
    })

    it('should optimize database operations under load', async () => {
      const queryCount = 1000
      const emailId = 'test-email-1'
      
      // Simulate many database operations
      const { duration } = await measurePerformance(
        async () => {
          for (let i = 0; i < queryCount; i++) {
            try {
              await emailQueueService.processQueueItem(emailId)
            } catch (error) {
              // Expected to fail since email doesn't exist, but tests DB performance
            }
          }
        },
        `${queryCount} database operations`
      )
      
      expect(duration).toBeLessThan(10000) // Should handle 1000 DB ops in under 10 seconds
    })
  })

  describe('Throughput and Latency', () => {
    it('should achieve target throughput for high priority emails', async () => {
      const emailCount = 100
      const targetThroughputPerSecond = 20 // emails per second
      const maxAllowedTime = (emailCount / targetThroughputPerSecond) * 1000 // milliseconds
      
      const highPriorityEmails = createTestEmailQueueItems(emailCount, {
        status: 'pending',
        priority: 1
      })
      
      setupDatabaseMocks(mockDb, highPriorityEmails)
      
      const { duration } = await measurePerformance(
        () => emailQueueService.processQueue({ 
          priority: 1, 
          maxBatchSize: emailCount 
        }),
        `High priority throughput test: ${emailCount} emails`
      )
      
      expect(duration).toBeLessThan(maxAllowedTime)
      
      const actualThroughput = (emailCount / duration) * 1000 // emails per second
      expect(actualThroughput).toBeGreaterThan(targetThroughputPerSecond * 0.8) // 80% of target
    })

    it('should maintain low latency for individual email processing', async () => {
      const singleEmailTests = 50
      const maxLatencyPerEmail = 200 // milliseconds
      
      const latencies = []
      
      for (let i = 0; i < singleEmailTests; i++) {
        const email = createTestEmailQueueItems(1, { status: 'pending' })[0]
        setupDatabaseMocks(mockDb, [email])
        
        const { duration } = await measurePerformance(
          () => emailQueueService.processQueueItem(email.id),
          `Single email ${i + 1}`
        )
        
        latencies.push(duration)
        expect(duration).toBeLessThan(maxLatencyPerEmail)
      }
      
      const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]
      
      expect(averageLatency).toBeLessThan(maxLatencyPerEmail * 0.5) // Average should be much lower
      expect(p95Latency).toBeLessThan(maxLatencyPerEmail) // 95th percentile under limit
    })

    it('should scale processing with concurrent batches', async () => {
      const concurrentBatches = 5
      const emailsPerBatch = 50
      
      const batchPromises = Array.from({ length: concurrentBatches }, (_, batchIndex) => {
        const batchEmails = createTestEmailQueueItems(emailsPerBatch, {
          status: 'pending',
          id: `batch-${batchIndex}-email`
        })
        
        setupDatabaseMocks(mockDb, batchEmails)
        
        return emailQueueService.processQueue({ 
          maxBatchSize: emailsPerBatch 
        })
      })
      
      const { result: batchResults, duration } = await measurePerformance(
        () => Promise.all(batchPromises),
        `Concurrent batch processing: ${concurrentBatches} batches`
      )
      
      const totalProcessed = batchResults.reduce(
        (sum, result) => sum + result.emailsProcessed, 
        0
      )
      
      expect(totalProcessed).toBe(concurrentBatches * emailsPerBatch)
      
      // Concurrent processing should be faster than sequential
      const estimatedSequentialTime = concurrentBatches * (duration / concurrentBatches)
      expect(duration).toBeLessThan(estimatedSequentialTime * 0.8)
    })
  })

  describe('Stress Testing', () => {
    it('should handle extreme load without failure', async () => {
      const { emailCount, batchSize, concurrentBatches } = testPerformanceScenarios.stressTest
      
      // Create extreme load scenario
      const stressInputs = createPerformanceTestData(emailCount, {
        templateTypes: ['game_start', 'game_end', 'welcome', 'digest'],
        priorities: [1, 2, 3],
        userCount: 1000
      })
      
      // Queue all emails
      const { result: queueItems, duration: queueDuration } = await measurePerformance(
        async () => {
          const batches = []
          for (let i = 0; i < stressInputs.length; i += batchSize) {
            const batch = stressInputs.slice(i, i + batchSize)
            const batchPromise = Promise.all(
              batch.map(input => emailQueueService.addToQueue(input))
            )
            batches.push(batchPromise)
          }
          const results = await Promise.all(batches)
          return results.flat()
        },
        `Stress test queue: ${emailCount} emails`
      )
      
      expect(queueItems).toHaveLength(emailCount)
      expect(queueDuration).toBeLessThan(300000) // Should complete in under 5 minutes
      
      setupDatabaseMocks(mockDb, queueItems)
      
      // Process with multiple concurrent batches
      const processingPromises = Array.from({ length: concurrentBatches }, () =>
        emailQueueService.processQueue({ maxBatchSize: batchSize })
      )
      
      const { result: processingResults, duration: processingDuration } = await measurePerformance(
        () => Promise.all(processingPromises),
        `Stress test processing: ${concurrentBatches} concurrent batches`
      )
      
      const totalProcessed = processingResults.reduce(
        (sum, result) => sum + result.emailsProcessed, 
        0
      )
      
      expect(totalProcessed).toBeGreaterThan(0)
      expect(processingDuration).toBeLessThan(600000) // Should complete in under 10 minutes
      
      // Verify system remains stable
      const healthStatus = await emailQueueService.getHealthStatus()
      expect(healthStatus.lastHealthCheck).toBeTruthy()
    })

    it('should maintain performance under retry scenarios', async () => {
      const emailCount = 200
      const failureRate = 0.3 // 30% failure rate
      
      const emails = createTestEmailQueueItems(emailCount, { status: 'pending' })
      setupDatabaseMocks(mockDb, emails)
      
      // Mock mixed success/failure responses
      vi.mocked(testEnv.mockResendService.sendEmail).mockImplementation(async () => {
        if (Math.random() < failureRate) {
          return { success: false, error: 'Temporary failure' }
        }
        return { success: true, messageId: 'retry-test-msg' }
      })
      
      // Mock retry decisions
      vi.mocked(testEnv.mockRetryService.shouldRetry).mockResolvedValue({
        shouldRetry: true,
        nextRetryAt: new Date(Date.now() + 60000).toISOString(),
        backoffSeconds: 60,
        totalAttempts: 2,
        remainingAttempts: 1,
        shouldSuppress: false,
        failureType: 'temporary_failure'
      })
      
      const { result: batchResult, duration } = await measurePerformance(
        () => emailQueueService.processQueue({ maxBatchSize: emailCount }),
        `Retry scenario: ${emailCount} emails with ${failureRate * 100}% failure rate`
      )
      
      expect(batchResult.emailsProcessed).toBe(emailCount)
      expect(batchResult.emailsFailed).toBeGreaterThan(0)
      expect(batchResult.emailsSent).toBeGreaterThan(0)
      expect(duration).toBeLessThan(60000) // Should handle retries efficiently
    })

    it('should handle burst traffic patterns', async () => {
      const burstSize = 500
      const burstCount = 5
      const burstInterval = 100 // milliseconds between bursts
      
      const allBurstResults = []
      
      for (let burst = 0; burst < burstCount; burst++) {
        const burstInputs = createPerformanceTestData(burstSize, {
          userCount: 100
        }).map(input => ({
          ...input,
          recipientEmail: `burst${burst}-${input.recipientEmail}`
        }))
        
        const { result: burstItems, duration } = await measurePerformance(
          () => Promise.all(burstInputs.map(input => emailQueueService.addToQueue(input))),
          `Burst ${burst + 1}: ${burstSize} emails`
        )
        
        allBurstResults.push({ items: burstItems, duration })
        
        expect(burstItems).toHaveLength(burstSize)
        expect(duration).toBeLessThan(30000) // Each burst should complete quickly
        
        // Wait before next burst
        if (burst < burstCount - 1) {
          await waitForAsyncOperations(burstInterval)
        }
      }
      
      const totalEmails = allBurstResults.reduce(
        (sum, burst) => sum + burst.items.length, 
        0
      )
      
      expect(totalEmails).toBe(burstSize * burstCount)
      
      // Verify system can handle burst patterns
      const healthStatus = await emailQueueService.getHealthStatus()
      expect(healthStatus.queueSize).toBeGreaterThan(0)
    })
  })

  describe('Resource Monitoring', () => {
    it('should track performance metrics during load', async () => {
      const emailCount = 100
      const emails = createTestEmailQueueItems(emailCount, { status: 'pending' })
      
      setupDatabaseMocks(mockDb, emails)
      
      const startTime = Date.now()
      const result = await emailQueueService.processQueue({ maxBatchSize: emailCount })
      const endTime = Date.now()
      
      const processingTime = endTime - startTime
      const throughput = (result.emailsProcessed / processingTime) * 1000 // emails per second
      
      expect(result.processingTime).toBeGreaterThan(0)
      expect(result.processingTime).toBeLessThan(processingTime + 1000) // Allow some overhead
      expect(throughput).toBeGreaterThan(1) // At least 1 email per second
    })

    it('should maintain queue health under sustained load', async () => {
      const sustainedPeriod = 1000 // milliseconds
      const emailsPerInterval = 20
      const checkInterval = 200 // milliseconds
      
      const healthChecks = []
      const startTime = Date.now()
      
      // Sustained load for a period
      const loadInterval = setInterval(async () => {
        const inputs = createPerformanceTestData(emailsPerInterval)
        await Promise.all(inputs.map(input => emailQueueService.addToQueue(input)))
      }, checkInterval)
      
      // Monitor health during load
      const healthInterval = setInterval(async () => {
        try {
          const health = await emailQueueService.getHealthStatus()
          healthChecks.push(health)
        } catch (error) {
          // Health check failed under load
          healthChecks.push({ isHealthy: false, error })
        }
      }, checkInterval)
      
      // Wait for sustained period
      await waitForAsyncOperations(sustainedPeriod)
      
      clearInterval(loadInterval)
      clearInterval(healthInterval)
      
      expect(healthChecks.length).toBeGreaterThan(0)
      
      // Most health checks should succeed
      const successfulChecks = healthChecks.filter(check => check.isHealthy)
      const successRate = successfulChecks.length / healthChecks.length
      
      expect(successRate).toBeGreaterThan(0.8) // 80% success rate under load
    })

    it('should provide performance insights and recommendations', async () => {
      // Process various loads and analyze performance
      const testCases = [
        { emails: 10, expectedTime: 2000 },
        { emails: 50, expectedTime: 8000 },
        { emails: 100, expectedTime: 15000 }
      ]
      
      const performanceData = []
      
      for (const testCase of testCases) {
        const emails = createTestEmailQueueItems(testCase.emails, { status: 'pending' })
        setupDatabaseMocks(mockDb, emails)
        
        const { result, duration } = await measurePerformance(
          () => emailQueueService.processQueue({ maxBatchSize: testCase.emails }),
          `Performance test: ${testCase.emails} emails`
        )
        
        performanceData.push({
          emailCount: testCase.emails,
          duration,
          throughput: (result.emailsProcessed / duration) * 1000,
          expectedTime: testCase.expectedTime,
          efficiency: testCase.expectedTime / duration
        })
        
        expect(duration).toBeLessThan(testCase.expectedTime)
      }
      
      // Analyze scaling characteristics
      const throughputs = performanceData.map(data => data.throughput)
      const avgThroughput = throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length
      
      expect(avgThroughput).toBeGreaterThan(5) // At least 5 emails per second average
      
      // Throughput should remain relatively stable across different loads
      const throughputVariation = Math.max(...throughputs) / Math.min(...throughputs)
      expect(throughputVariation).toBeLessThan(3) // No more than 3x variation
    })
  })
})