/**
 * Email Queue Service
 * Advanced email queue processing with batch processing, priority handling, and retry management
 */

import { generateSecureId } from '../utils/crypto'
import { createApiError } from '../middleware/errorHandler'
import { EmailTemplateService, emailTemplateService } from './emailTemplateService'
import { ResendService, createResendEmailFromTemplate } from './resendService'
import { EmailRetryService } from './emailRetryService'
import type {
  EmailQueueItem,
  EmailQueueCreateInput,
  EmailQueueUpdateInput,
  EmailQueueFilterOptions,
  EmailBatch,
  EmailBatchProcessingResult,
  EmailProcessingResult,
  EmailQueueStatistics,
  EmailQueueHealthStatus,
  EmailQueueServiceConfig,
  EMAIL_QUEUE_CONSTANTS
} from '../models/emailQueue'
import type {
  EmailRetryContext,
  EmailRetryDecision,
  EmailFailureType
} from '../models/emailRetryPolicy'

export interface EmailQueueServiceDependencies {
  db: D1Database
  templateService: EmailTemplateService
  resendService: ResendService
  retryService: EmailRetryService
  auditService?: EmailQueueAuditService
  metricsService?: EmailQueueMetricsService
}

export interface EmailQueueAuditService {
  logEmailQueued(item: EmailQueueItem): Promise<void>
  logEmailProcessingStarted(emailId: string, batchId?: string): Promise<void>
  logEmailSent(emailId: string, messageId: string, processingTime: number): Promise<void>
  logEmailFailed(emailId: string, error: EmailQueueError, retryDecision: EmailRetryDecision): Promise<void>
  logBatchStarted(batch: EmailBatch): Promise<void>
  logBatchCompleted(batch: EmailBatch, result: EmailBatchProcessingResult): Promise<void>
}

export interface EmailQueueMetricsService {
  recordEmailQueued(item: EmailQueueItem): Promise<void>
  recordEmailProcessed(result: EmailProcessingResult): Promise<void>
  recordBatchProcessed(result: EmailBatchProcessingResult): Promise<void>
  recordQueueHealth(health: EmailQueueHealthStatus): Promise<void>
}

export interface EmailQueueError extends Error {
  emailId: string
  errorType: 'template_error' | 'send_error' | 'validation_error' | 'system_error'
  failureType?: EmailFailureType
  retryable: boolean
  details?: any
}

export interface EmailQueueProcessorConfig {
  batchSize: number
  processingInterval: number    // milliseconds
  maxConcurrentBatches: number
  enablePriorityProcessing: boolean
  enableDeadLetterQueue: boolean
  healthCheckInterval: number   // milliseconds
  cleanupInterval: number       // milliseconds
  retentionPeriod: number       // days
}

export interface EmailQueueBatchOptions {
  priority?: 1 | 2 | 3
  maxBatchSize?: number
  includeScheduled?: boolean
  scheduledBefore?: string      // ISO datetime
  excludeRetries?: boolean
}

/**
 * EmailQueueService - Professional email queue processing service
 * 
 * Features:
 * - Priority-based queue processing
 * - Batch processing with configurable size
 * - Retry management with exponential backoff  
 * - Dead letter queue for failed emails
 * - Template integration and rendering
 * - Comprehensive monitoring and metrics
 * - Health checking and alerting
 * - Automatic cleanup and maintenance
 */
export class EmailQueueService {
  private config: EmailQueueProcessorConfig
  private dependencies: EmailQueueServiceDependencies
  private isProcessing = false
  private processingInterval?: NodeJS.Timeout
  private healthCheckInterval?: NodeJS.Timeout
  private cleanupInterval?: NodeJS.Timeout
  private activeBatches: Map<string, EmailBatch> = new Map()
  
  constructor(
    config: EmailQueueProcessorConfig,
    dependencies: EmailQueueServiceDependencies
  ) {
    this.config = config
    this.dependencies = dependencies
    
    // Start background processing
    this.startBackgroundProcessing()
  }
  
  /**
   * Add email to queue
   */
  async addToQueue(input: EmailQueueCreateInput): Promise<EmailQueueItem> {
    try {
      // Generate unique ID
      const id = await generateSecureId()
      const now = new Date().toISOString()
      
      // Validate input
      this.validateQueueInput(input)
      
      // Render template
      const templateResult = await this.dependencies.templateService.renderTemplate({
        templateType: input.templateType,
        data: input.templateData,
        userId: input.userId,
        priority: this.mapPriorityToString(input.priority || 3)
      })
      
      // Create queue item
      const queueItem: EmailQueueItem = {
        id,
        userId: input.userId,
        recipientEmail: input.recipientEmail,
        templateType: input.templateType,
        templateData: JSON.stringify(input.templateData),
        priority: input.priority || 3,
        subject: templateResult.subject,
        htmlContent: templateResult.html,
        textContent: templateResult.text,
        status: 'pending',
        retryCount: 0,
        maxRetries: input.maxRetries || EMAIL_QUEUE_CONSTANTS.DEFAULT_MAX_RETRIES,
        scheduledAt: input.scheduledAt || now,
        createdAt: now,
        updatedAt: now
      }
      
      // Save to database
      await this.saveQueueItem(queueItem)
      
      // Log to audit service
      if (this.dependencies.auditService) {
        await this.dependencies.auditService.logEmailQueued(queueItem)
      }
      
      // Record metrics
      if (this.dependencies.metricsService) {
        await this.dependencies.metricsService.recordEmailQueued(queueItem)
      }
      
      console.log(`Email queued: ${id} for ${input.recipientEmail}`)
      return queueItem
      
    } catch (error) {
      console.error('Failed to add email to queue:', error)
      throw createApiError(
        `Failed to add email to queue: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'EMAIL_QUEUE_ADD_FAILED',
        error
      )
    }
  }
  
  /**
   * Process queue manually (useful for testing or manual triggers)
   */
  async processQueue(options: EmailQueueBatchOptions = {}): Promise<EmailBatchProcessingResult> {
    try {
      // Get next batch of emails to process
      const emails = await this.getNextBatch(options)
      
      if (emails.length === 0) {
        return {
          batchId: await generateSecureId(),
          success: true,
          processingTime: 0,
          emailsProcessed: 0,
          emailsSent: 0,
          emailsFailed: 0,
          results: []
        }
      }
      
      // Create batch
      const batch = await this.createBatch(emails)
      
      // Process batch
      const result = await this.processBatch(batch)
      
      return result
      
    } catch (error) {
      console.error('Queue processing failed:', error)
      throw createApiError(
        'Queue processing failed',
        500,
        'QUEUE_PROCESSING_FAILED',
        error
      )
    }
  }
  
  /**
   * Process a single queue item
   */
  async processQueueItem(emailId: string): Promise<EmailProcessingResult> {
    const startTime = Date.now()
    
    try {
      // Get email from queue
      const email = await this.getQueueItem(emailId)
      if (!email) {
        throw createApiError('Email not found in queue', 404, 'EMAIL_NOT_FOUND')
      }
      
      // Check if already processing
      if (email.status === 'processing') {
        throw createApiError('Email is already being processed', 409, 'EMAIL_ALREADY_PROCESSING')
      }
      
      // Check if should be processed now
      if (email.scheduledAt && new Date(email.scheduledAt) > new Date()) {
        throw createApiError('Email is not yet scheduled for processing', 400, 'EMAIL_NOT_SCHEDULED')
      }
      
      // Update status to processing
      await this.updateQueueItem(emailId, {
        status: 'processing',
        firstAttemptedAt: email.firstAttemptedAt || new Date().toISOString(),
        lastAttemptedAt: new Date().toISOString()
      })
      
      // Log processing start
      if (this.dependencies.auditService) {
        await this.dependencies.auditService.logEmailProcessingStarted(emailId)
      }
      
      try {
        // Send email via Resend service
        const sendResult = await this.dependencies.resendService.sendEmail({
          to: email.recipientEmail,
          from: 'Chess.com Helper <notifications@chesshelper.app>', // Could be configurable
          subject: email.subject,
          html: email.htmlContent,
          text: email.textContent,
          tags: [
            { name: 'template_type', value: email.templateType },
            { name: 'priority', value: email.priority.toString() },
            { name: 'user_id', value: email.userId }
          ]
        })
        
        if (sendResult.success && sendResult.messageId) {
          // Update as sent
          await this.updateQueueItem(emailId, {
            status: 'sent',
            sentAt: new Date().toISOString(),
            resendMessageId: sendResult.messageId
          })
          
          const result: EmailProcessingResult = {
            emailId,
            success: true,
            processingTime: Date.now() - startTime,
            resendMessageId: sendResult.messageId
          }
          
          // Log success
          if (this.dependencies.auditService) {
            await this.dependencies.auditService.logEmailSent(emailId, sendResult.messageId, result.processingTime)
          }
          
          console.log(`Email sent successfully: ${emailId} -> ${sendResult.messageId}`)
          return result
          
        } else {
          // Handle send failure
          return await this.handleEmailFailure(email, sendResult.error)
        }
        
      } catch (sendError) {
        // Handle unexpected send error
        const error: EmailQueueError = {
          name: 'EmailSendError',
          message: sendError instanceof Error ? sendError.message : 'Unknown send error',
          emailId,
          errorType: 'send_error',
          retryable: true
        }
        
        return await this.handleEmailFailure(email, error)
      }
      
    } catch (error) {
      console.error(`Failed to process email ${emailId}:`, error)
      
      // Update email status to failed
      await this.updateQueueItem(emailId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof createApiError ? error.code : 'PROCESSING_ERROR'
      }).catch(updateError => console.error('Failed to update email status:', updateError))
      
      return {
        emailId,
        success: false,
        processingTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'PROCESSING_ERROR'
      }
    }
  }
  
  /**
   * Handle email sending failure with retry logic
   */
  async handleFailedEmail(emailId: string, error: EmailQueueError): Promise<EmailProcessingResult> {
    try {
      const email = await this.getQueueItem(emailId)
      if (!email) {
        throw createApiError('Email not found', 404, 'EMAIL_NOT_FOUND')
      }
      
      return await this.handleEmailFailure(email, error)
      
    } catch (handlingError) {
      console.error(`Failed to handle email failure ${emailId}:`, handlingError)
      return {
        emailId,
        success: false,
        processingTime: 0,
        errorMessage: handlingError instanceof Error ? handlingError.message : 'Unknown error',
        errorCode: 'FAILURE_HANDLING_ERROR'
      }
    }
  }
  
  /**
   * Get queue statistics
   */
  async getQueueStatistics(): Promise<EmailQueueStatistics> {
    try {
      const [statusCounts, timingStats, oldestPending] = await Promise.all([
        // Status counts
        this.dependencies.db.prepare(`
          SELECT status, COUNT(*) as count
          FROM email_queue
          GROUP BY status
        `).all(),
        
        // Timing statistics
        this.dependencies.db.prepare(`
          SELECT 
            AVG(CASE WHEN sent_at IS NOT NULL AND first_attempted_at IS NOT NULL 
                THEN (julianday(sent_at) - julianday(first_attempted_at)) * 86400000 END) as avg_processing_time,
            AVG(retry_count) as avg_retry_count
          FROM email_queue
          WHERE status IN ('sent', 'failed')
          AND first_attempted_at IS NOT NULL
        `).first(),
        
        // Oldest pending email
        this.dependencies.db.prepare(`
          SELECT 
            (julianday('now') - julianday(scheduled_at)) * 86400 as age_seconds
          FROM email_queue
          WHERE status = 'pending'
          ORDER BY scheduled_at ASC
          LIMIT 1
        `).first()
      ])
      
      // Process status counts
      const statusMap: Record<string, number> = {}
      statusCounts.results?.forEach(row => {
        statusMap[row.status as string] = row.count as number
      })
      
      // Calculate success rate
      const totalSent = statusMap.sent || 0
      const totalFailed = statusMap.failed || 0
      const totalProcessed = totalSent + totalFailed
      const successRate = totalProcessed > 0 ? (totalSent / totalProcessed) * 100 : 0
      
      return {
        totalPending: statusMap.pending || 0,
        totalProcessing: statusMap.processing || 0,
        totalSent: statusMap.sent || 0,
        totalFailed: statusMap.failed || 0,
        totalCancelled: statusMap.cancelled || 0,
        averageProcessingTime: timingStats?.avg_processing_time || 0,
        averageRetryCount: timingStats?.avg_retry_count || 0,
        oldestPendingAge: oldestPending?.age_seconds || 0,
        successRate
      }
      
    } catch (error) {
      console.error('Failed to get queue statistics:', error)
      throw createApiError('Failed to get queue statistics', 500, 'QUEUE_STATS_FAILED', error)
    }
  }
  
  /**
   * Get queue health status
   */
  async getHealthStatus(): Promise<EmailQueueHealthStatus> {
    try {
      const stats = await this.getQueueStatistics()
      const issues: string[] = []
      
      // Check for health issues
      if (stats.totalPending > 1000) {
        issues.push('High number of pending emails')
      }
      
      if (stats.oldestPendingAge > 3600) { // 1 hour
        issues.push('Old emails in queue')
      }
      
      if (stats.successRate < 95 && stats.totalSent + stats.totalFailed > 10) {
        issues.push('Low success rate')
      }
      
      if (stats.averageProcessingTime > 30000) { // 30 seconds
        issues.push('Slow processing times')
      }
      
      // Calculate processing rate (emails per hour)
      const processingRate = stats.totalSent > 0 ? (stats.totalSent / Math.max(stats.averageProcessingTime / 3600000, 1)) : 0
      
      const health: EmailQueueHealthStatus = {
        isHealthy: issues.length === 0,
        queueSize: stats.totalPending + stats.totalProcessing,
        processingRate,
        errorRate: 100 - stats.successRate,
        averageWaitTime: stats.averageProcessingTime / 1000, // Convert to seconds
        oldestItemAge: stats.oldestPendingAge,
        issues,
        lastHealthCheck: new Date().toISOString()
      }
      
      // Record metrics
      if (this.dependencies.metricsService) {
        await this.dependencies.metricsService.recordQueueHealth(health)
      }
      
      return health
      
    } catch (error) {
      console.error('Failed to get health status:', error)
      return {
        isHealthy: false,
        queueSize: 0,
        processingRate: 0,
        errorRate: 100,
        averageWaitTime: 0,
        oldestItemAge: 0,
        issues: ['Health check failed'],
        lastHealthCheck: new Date().toISOString()
      }
    }
  }
  
  /**
   * Cancel email in queue
   */
  async cancelEmail(emailId: string, reason: string = 'Manual cancellation'): Promise<void> {
    try {
      const email = await this.getQueueItem(emailId)
      if (!email) {
        throw createApiError('Email not found', 404, 'EMAIL_NOT_FOUND')
      }
      
      if (email.status === 'sent') {
        throw createApiError('Cannot cancel sent email', 400, 'EMAIL_ALREADY_SENT')
      }
      
      if (email.status === 'processing') {
        throw createApiError('Cannot cancel email being processed', 400, 'EMAIL_PROCESSING')
      }
      
      await this.updateQueueItem(emailId, {
        status: 'cancelled',
        errorMessage: reason
      })
      
      console.log(`Email cancelled: ${emailId} - ${reason}`)
      
    } catch (error) {
      console.error(`Failed to cancel email ${emailId}:`, error)
      throw createApiError('Failed to cancel email', 500, 'EMAIL_CANCEL_FAILED', error)
    }
  }
  
  /**
   * Cleanup old emails from queue
   */
  async cleanup(): Promise<{ deletedCount: number; errors: string[] }> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionPeriod)
      const cutoffIso = cutoffDate.toISOString()
      
      // Delete old completed emails
      const deleteResult = await this.dependencies.db.prepare(`
        DELETE FROM email_queue
        WHERE status IN ('sent', 'cancelled', 'failed')
        AND updated_at < ?
        AND retry_count >= max_retries
      `).bind(cutoffIso).run()
      
      const deletedCount = deleteResult.changes || 0
      
      console.log(`Cleanup completed: deleted ${deletedCount} old emails`)
      
      return {
        deletedCount,
        errors: []
      }
      
    } catch (error) {
      console.error('Cleanup failed:', error)
      return {
        deletedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown cleanup error']
      }
    }
  }
  
  /**
   * Stop background processing
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = undefined
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }
    
    console.log('Email queue service stopped')
  }
  
  /**
   * Start background processing
   */
  private startBackgroundProcessing(): void {
    // Main processing loop
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing && this.activeBatches.size < this.config.maxConcurrentBatches) {
        await this.backgroundProcessing()
      }
    }, this.config.processingInterval)
    
    // Health check loop
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.getHealthStatus()
      } catch (error) {
        console.error('Health check failed:', error)
      }
    }, this.config.healthCheckInterval)
    
    // Cleanup loop
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanup()
      } catch (error) {
        console.error('Cleanup failed:', error)
      }
    }, this.config.cleanupInterval)
    
    console.log('Email queue service started')
  }
  
  /**
   * Background processing logic
   */
  private async backgroundProcessing(): Promise<void> {
    this.isProcessing = true
    
    try {
      // Process emails by priority if enabled
      if (this.config.enablePriorityProcessing) {
        // Process high priority first
        await this.processQueue({ priority: 1, maxBatchSize: this.config.batchSize })
        
        // Then medium priority
        if (this.activeBatches.size < this.config.maxConcurrentBatches) {
          await this.processQueue({ priority: 2, maxBatchSize: this.config.batchSize })
        }
        
        // Finally low priority
        if (this.activeBatches.size < this.config.maxConcurrentBatches) {
          await this.processQueue({ priority: 3, maxBatchSize: this.config.batchSize })
        }
      } else {
        // Process all emails together
        await this.processQueue({ maxBatchSize: this.config.batchSize })
      }
      
    } catch (error) {
      console.error('Background processing error:', error)
    } finally {
      this.isProcessing = false
    }
  }
  
  /**
   * Get next batch of emails to process
   */
  private async getNextBatch(options: EmailQueueBatchOptions = {}): Promise<EmailQueueItem[]> {
    try {
      let query = `
        SELECT * FROM email_queue
        WHERE status = 'pending'
        AND scheduled_at <= datetime('now')
      `
      const params: any[] = []
      
      // Filter by priority
      if (options.priority) {
        query += ` AND priority = ?`
        params.push(options.priority)
      }
      
      // Filter by scheduled time
      if (options.scheduledBefore) {
        query += ` AND scheduled_at <= ?`
        params.push(options.scheduledBefore)
      }
      
      // Exclude retries if requested
      if (options.excludeRetries) {
        query += ` AND retry_count = 0`
      }
      
      // Order by priority and scheduled time
      query += ` ORDER BY priority ASC, scheduled_at ASC`
      
      // Limit batch size
      const batchSize = options.maxBatchSize || this.config.batchSize
      query += ` LIMIT ?`
      params.push(batchSize)
      
      const result = await this.dependencies.db.prepare(query).bind(...params).all()
      
      return result.results?.map(row => this.mapRowToQueueItem(row)) || []
      
    } catch (error) {
      console.error('Failed to get next batch:', error)
      return []
    }
  }
  
  /**
   * Create batch for processing
   */
  private async createBatch(emails: EmailQueueItem[]): Promise<EmailBatch> {
    const batch: EmailBatch = {
      id: await generateSecureId(),
      batchSize: emails.length,
      priority: emails[0]?.priority || 3,
      status: 'pending',
      emailsProcessed: 0,
      emailsSent: 0,
      emailsFailed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    // Save batch to database
    await this.saveBatch(batch)
    
    // Track active batch
    this.activeBatches.set(batch.id, batch)
    
    return batch
  }
  
  /**
   * Process a batch of emails
   */
  private async processBatch(batch: EmailBatch): Promise<EmailBatchProcessingResult> {
    const startTime = Date.now()
    const results: EmailProcessingResult[] = []
    
    try {
      // Update batch status
      batch.status = 'processing'
      batch.startedAt = new Date().toISOString()
      await this.updateBatch(batch)
      
      // Log batch start
      if (this.dependencies.auditService) {
        await this.dependencies.auditService.logBatchStarted(batch)
      }
      
      // Get emails for this batch
      const emails = await this.getNextBatch({ maxBatchSize: batch.batchSize, priority: batch.priority })
      
      // Process emails concurrently (with limited concurrency)
      const maxConcurrency = Math.min(5, emails.length)
      for (let i = 0; i < emails.length; i += maxConcurrency) {
        const batchEmails = emails.slice(i, i + maxConcurrency)
        
        const batchResults = await Promise.all(
          batchEmails.map(email => this.processQueueItem(email.id))
        )
        
        results.push(...batchResults)
        
        // Update batch progress
        batch.emailsProcessed += batchResults.length
        batch.emailsSent += batchResults.filter(r => r.success).length
        batch.emailsFailed += batchResults.filter(r => !r.success).length
        
        await this.updateBatch(batch)
      }
      
      // Finalize batch
      batch.status = 'completed'
      batch.completedAt = new Date().toISOString()
      batch.processingTimeMs = Date.now() - startTime
      await this.updateBatch(batch)
      
      const result: EmailBatchProcessingResult = {
        batchId: batch.id,
        success: true,
        processingTime: batch.processingTimeMs,
        emailsProcessed: batch.emailsProcessed,
        emailsSent: batch.emailsSent,
        emailsFailed: batch.emailsFailed,
        results
      }
      
      // Log batch completion
      if (this.dependencies.auditService) {
        await this.dependencies.auditService.logBatchCompleted(batch, result)
      }
      
      // Record metrics
      if (this.dependencies.metricsService) {
        await this.dependencies.metricsService.recordBatchProcessed(result)
      }
      
      return result
      
    } catch (error) {
      // Handle batch failure
      batch.status = 'failed'
      batch.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      batch.completedAt = new Date().toISOString()
      batch.processingTimeMs = Date.now() - startTime
      await this.updateBatch(batch)
      
      const result: EmailBatchProcessingResult = {
        batchId: batch.id,
        success: false,
        processingTime: batch.processingTimeMs || 0,
        emailsProcessed: batch.emailsProcessed,
        emailsSent: batch.emailsSent,
        emailsFailed: batch.emailsFailed,
        results,
        errorMessage: batch.errorMessage
      }
      
      return result
      
    } finally {
      // Remove from active batches
      this.activeBatches.delete(batch.id)
    }
  }
  
  /**
   * Handle email failure with retry logic
   */
  private async handleEmailFailure(email: EmailQueueItem, error: EmailQueueError): Promise<EmailProcessingResult> {
    try {
      // Create retry context
      const retryContext: EmailRetryContext = {
        emailQueueId: email.id,
        recipientEmail: email.recipientEmail,
        templateType: email.templateType,
        priority: this.mapPriorityToString(email.priority) as any,
        currentRetryCount: email.retryCount,
        previousAttempts: [], // Would need to query from database
        latestFailure: {
          errorMessage: error.message,
          errorCode: error.errorType,
          occurredAt: new Date().toISOString()
        },
        recipientHistory: {
          totalFailures: 1, // Would need to calculate from database
          recentFailures: 1,
        },
        serviceProvider: 'resend',
        policyId: 'standard'
      }
      
      // Get retry decision
      const retryDecision = await this.dependencies.retryService.shouldRetry(retryContext)
      
      // Update email based on retry decision
      if (retryDecision.shouldRetry && retryDecision.nextRetryAt) {
        // Schedule retry
        await this.updateQueueItem(email.id, {
          status: 'pending',
          retryCount: email.retryCount + 1,
          scheduledAt: retryDecision.nextRetryAt,
          errorMessage: error.message,
          errorCode: error.errorType
        })
        
        const result: EmailProcessingResult = {
          emailId: email.id,
          success: false,
          processingTime: 0,
          errorMessage: error.message,
          errorCode: error.errorType,
          retryScheduled: true,
          nextRetryAt: retryDecision.nextRetryAt
        }
        
        // Log retry scheduling
        if (this.dependencies.auditService) {
          await this.dependencies.auditService.logEmailFailed(email.id, error, retryDecision)
        }
        
        return result
        
      } else {
        // Mark as failed permanently
        await this.updateQueueItem(email.id, {
          status: 'failed',
          errorMessage: error.message,
          errorCode: error.errorType
        })
        
        // Handle suppression if recommended
        if (retryDecision.shouldSuppress && retryDecision.suppressionReason) {
          await this.dependencies.retryService.addToSuppressionList(
            email.recipientEmail,
            retryDecision.suppressionReason,
            email.id,
            retryDecision.failureType
          )
        }
        
        const result: EmailProcessingResult = {
          emailId: email.id,
          success: false,
          processingTime: 0,
          errorMessage: error.message,
          errorCode: error.errorType,
          retryScheduled: false
        }
        
        return result
      }
      
    } catch (handlingError) {
      console.error('Failed to handle email failure:', handlingError)
      
      // Default to failed status
      await this.updateQueueItem(email.id, {
        status: 'failed',
        errorMessage: error.message,
        errorCode: 'RETRY_HANDLING_FAILED'
      })
      
      return {
        emailId: email.id,
        success: false,
        processingTime: 0,
        errorMessage: error.message,
        errorCode: 'RETRY_HANDLING_FAILED'
      }
    }
  }
  
  /**
   * Validate queue input
   */
  private validateQueueInput(input: EmailQueueCreateInput): void {
    if (!input.userId) {
      throw createApiError('User ID is required', 400, 'MISSING_USER_ID')
    }
    
    if (!input.recipientEmail) {
      throw createApiError('Recipient email is required', 400, 'MISSING_RECIPIENT')
    }
    
    if (!this.isValidEmail(input.recipientEmail)) {
      throw createApiError('Invalid recipient email format', 400, 'INVALID_EMAIL_FORMAT')
    }
    
    if (!input.templateType) {
      throw createApiError('Template type is required', 400, 'MISSING_TEMPLATE_TYPE')
    }
    
    if (!input.templateData) {
      throw createApiError('Template data is required', 400, 'MISSING_TEMPLATE_DATA')
    }
  }
  
  /**
   * Map priority number to string
   */
  private mapPriorityToString(priority: number): string {
    switch (priority) {
      case 1: return 'high'
      case 2: return 'medium'
      case 3: return 'low'
      default: return 'medium'
    }
  }
  
  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
  
  /**
   * Database operations
   */
  
  private async saveQueueItem(item: EmailQueueItem): Promise<void> {
    await this.dependencies.db.prepare(`
      INSERT INTO email_queue (
        id, user_id, recipient_email, template_type, template_data, priority,
        subject, html_content, text_content, status, retry_count, max_retries,
        scheduled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      item.id, item.userId, item.recipientEmail, item.templateType, item.templateData,
      item.priority, item.subject, item.htmlContent, item.textContent, item.status,
      item.retryCount, item.maxRetries, item.scheduledAt, item.createdAt, item.updatedAt
    ).run()
  }
  
  private async updateQueueItem(id: string, updates: EmailQueueUpdateInput): Promise<void> {
    const fields: string[] = []
    const values: any[] = []
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${this.camelToSnake(key)} = ?`)
        values.push(value)
      }
    })
    
    if (fields.length === 0) return
    
    fields.push('updated_at = ?')
    values.push(new Date().toISOString(), id)
    
    await this.dependencies.db.prepare(`
      UPDATE email_queue SET ${fields.join(', ')} WHERE id = ?
    `).bind(...values).run()
  }
  
  private async getQueueItem(id: string): Promise<EmailQueueItem | null> {
    const result = await this.dependencies.db.prepare(`
      SELECT * FROM email_queue WHERE id = ?
    `).bind(id).first()
    
    return result ? this.mapRowToQueueItem(result) : null
  }
  
  private async saveBatch(batch: EmailBatch): Promise<void> {
    await this.dependencies.db.prepare(`
      INSERT INTO email_batches (
        id, batch_size, priority, status, emails_processed, emails_sent, emails_failed,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      batch.id, batch.batchSize, batch.priority, batch.status,
      batch.emailsProcessed, batch.emailsSent, batch.emailsFailed,
      batch.createdAt, batch.updatedAt
    ).run()
  }
  
  private async updateBatch(batch: EmailBatch): Promise<void> {
    await this.dependencies.db.prepare(`
      UPDATE email_batches SET
        batch_size = ?, priority = ?, status = ?, started_at = ?, completed_at = ?,
        processing_time_ms = ?, emails_processed = ?, emails_sent = ?, emails_failed = ?,
        error_message = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      batch.batchSize, batch.priority, batch.status, batch.startedAt || null,
      batch.completedAt || null, batch.processingTimeMs || null,
      batch.emailsProcessed, batch.emailsSent, batch.emailsFailed,
      batch.errorMessage || null, new Date().toISOString(), batch.id
    ).run()
  }
  
  private mapRowToQueueItem(row: any): EmailQueueItem {
    return {
      id: row.id,
      userId: row.user_id,
      recipientEmail: row.recipient_email,
      templateType: row.template_type,
      templateData: row.template_data,
      priority: row.priority,
      subject: row.subject,
      htmlContent: row.html_content,
      textContent: row.text_content,
      status: row.status,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      scheduledAt: row.scheduled_at,
      firstAttemptedAt: row.first_attempted_at,
      lastAttemptedAt: row.last_attempted_at,
      sentAt: row.sent_at,
      errorMessage: row.error_message,
      errorCode: row.error_code,
      resendMessageId: row.resend_message_id,
      webhookReceivedAt: row.webhook_received_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
  
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
  }
}

/**
 * Factory function to create EmailQueueService instance
 */
export function createEmailQueueService(
  config: EmailQueueProcessorConfig,
  dependencies: EmailQueueServiceDependencies
): EmailQueueService {
  return new EmailQueueService(config, dependencies)
}

/**
 * Default configuration for EmailQueueService
 */
export const DEFAULT_EMAIL_QUEUE_CONFIG: EmailQueueProcessorConfig = {
  batchSize: EMAIL_QUEUE_CONSTANTS.DEFAULT_BATCH_SIZE,
  processingInterval: EMAIL_QUEUE_CONSTANTS.DEFAULT_PROCESSING_INTERVAL,
  maxConcurrentBatches: 3,
  enablePriorityProcessing: true,
  enableDeadLetterQueue: true,
  healthCheckInterval: 60000,  // 1 minute
  cleanupInterval: 3600000,    // 1 hour
  retentionPeriod: EMAIL_QUEUE_CONSTANTS.DEFAULT_RETENTION_PERIOD
}