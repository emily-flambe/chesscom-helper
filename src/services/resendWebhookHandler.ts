/**
 * Resend Webhook Handler
 * Processes Resend webhook events for email delivery tracking and status updates
 */

import { generateSecureId } from '../utils/crypto'
import { createApiError } from '../middleware/errorHandler'
import type {
  ResendEmailEvent,
  ResendEmailStatus
} from './resendService'
import type {
  NotificationAuditEntry,
  NotificationAuditCreateInput,
  EmailDeliveryEvent,
  EmailDeliveryEventCreateInput,
  EmailDeliveryEventType,
  NotificationAuditType,
  NotificationEventSource
} from '../models/notificationAudit'

export interface ResendWebhookPayload {
  type: string
  created_at: string
  data: ResendWebhookEventData
}

export interface ResendWebhookEventData {
  id: string
  to: string[]
  from: string
  subject: string
  created_at: string
  message_id?: string
  
  // Event-specific data
  bounce_type?: 'hard' | 'soft' | 'undetermined'
  bounce_reason?: string
  bounce_sub_type?: string
  complaint_type?: 'abuse' | 'fraud' | 'virus' | 'other'
  complaint_sub_type?: string
  click_url?: string
  user_agent?: string
  ip?: string
  location?: {
    country?: string
    region?: string
    city?: string
  }
  
  // Custom headers/tags from original email
  tags?: Array<{ name: string; value: string }>
  headers?: Record<string, string>
}

export interface WebhookProcessingResult {
  success: boolean
  webhookId: string
  eventType: string
  messageId: string
  processingTime: number
  auditEntryId?: string
  deliveryEventId?: string
  errorMessage?: string
  errorCode?: string
}

export interface WebhookValidationResult {
  isValid: boolean
  errorMessage?: string
  timestamp: string
}

export interface ResendWebhookHandlerConfig {
  webhookSecret: string
  enableSignatureValidation: boolean
  enableDeliveryTracking: boolean
  enableAuditLogging: boolean
  
  // Processing settings
  maxPayloadSize: number    // bytes
  processingTimeout: number // milliseconds
  
  // Retry settings for failed webhook processing
  enableRetryOnFailure: boolean
  maxRetries: number
  retryDelay: number       // milliseconds
  
  // Database settings
  enableEventStorage: boolean
  eventRetentionDays: number
  
  // Security settings
  allowedOrigins?: string[]
  enableRateLimiting: boolean
  maxWebhooksPerMinute: number
}

export interface ResendWebhookHandlerDependencies {
  db: D1Database
  auditService?: WebhookAuditService
  metricsService?: WebhookMetricsService
  emailQueueService?: EmailQueueService
}

export interface WebhookAuditService {
  logWebhookReceived(payload: ResendWebhookPayload, result: WebhookProcessingResult): Promise<void>
  logWebhookValidationFailure(payload: any, error: string): Promise<void>
  logWebhookProcessingError(webhookId: string, error: Error): Promise<void>
}

export interface WebhookMetricsService {
  recordWebhookReceived(eventType: string, processingTime: number): Promise<void>
  recordWebhookValidationFailure(reason: string): Promise<void>
  recordWebhookProcessingError(eventType: string, error: Error): Promise<void>
  recordDeliveryEvent(eventType: EmailDeliveryEventType, messageId: string): Promise<void>
}

export interface EmailQueueService {
  updateEmailStatus(messageId: string, status: string, eventData: any): Promise<void>
  markEmailDelivered(messageId: string, deliveredAt: string): Promise<void>
  markEmailFailed(messageId: string, reason: string, bounceType?: string): Promise<void>
}

/**
 * ResendWebhookHandler - Professional webhook processing service
 * 
 * Features:
 * - Webhook signature verification
 * - Event type processing and routing
 * - Delivery tracking and status updates
 * - Audit logging and metrics
 * - Error handling and retry logic
 * - Rate limiting and security
 * - Database integration for event storage
 */
export class ResendWebhookHandler {
  private config: ResendWebhookHandlerConfig
  private dependencies: ResendWebhookHandlerDependencies
  private rateLimitTracker: Map<string, { count: number; resetTime: number }> = new Map()
  
  constructor(
    config: ResendWebhookHandlerConfig,
    dependencies: ResendWebhookHandlerDependencies
  ) {
    this.config = config
    this.dependencies = dependencies
    
    // Initialize rate limiting if enabled
    if (this.config.enableRateLimiting) {
      this.initializeRateLimiting()
    }
  }
  
  /**
   * Process incoming webhook request
   */
  async processWebhook(
    signature: string,
    payload: string,
    headers?: Record<string, string>
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now()
    const webhookId = await generateSecureId()
    
    try {
      // Validate payload size
      if (payload.length > this.config.maxPayloadSize) {
        throw createApiError(
          'Webhook payload too large',
          413,
          'PAYLOAD_TOO_LARGE'
        )
      }
      
      // Rate limiting check
      if (this.config.enableRateLimiting) {
        await this.checkRateLimit()
      }
      
      // Validate webhook signature
      if (this.config.enableSignatureValidation) {
        const validationResult = await this.validateSignature(signature, payload)
        if (!validationResult.isValid) {
          if (this.dependencies.auditService) {
            await this.dependencies.auditService.logWebhookValidationFailure(
              payload,
              validationResult.errorMessage || 'Invalid signature'
            )
          }
          
          throw createApiError(
            'Invalid webhook signature',
            401,
            'INVALID_SIGNATURE'
          )
        }
      }
      
      // Parse webhook payload
      let webhookPayload: ResendWebhookPayload
      try {
        webhookPayload = JSON.parse(payload)
      } catch (parseError) {
        throw createApiError(
          'Invalid webhook payload JSON',
          400,
          'INVALID_JSON',
          parseError
        )
      }
      
      // Validate payload structure
      this.validateWebhookPayload(webhookPayload)
      
      // Process the webhook event
      const result = await this.processWebhookEvent(webhookId, webhookPayload)
      
      // Record metrics
      if (this.dependencies.metricsService) {
        await this.dependencies.metricsService.recordWebhookReceived(
          webhookPayload.type,
          result.processingTime
        )
      }
      
      // Log to audit service
      if (this.dependencies.auditService) {
        await this.dependencies.auditService.logWebhookReceived(webhookPayload, result)
      }
      
      return result
      
    } catch (error) {
      const errorResult: WebhookProcessingResult = {
        success: false,
        webhookId,
        eventType: 'unknown',
        messageId: '',
        processingTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof createApiError ? error.code : 'WEBHOOK_PROCESSING_ERROR'
      }
      
      // Record error metrics
      if (this.dependencies.metricsService) {
        await this.dependencies.metricsService.recordWebhookProcessingError(
          'unknown',
          error instanceof Error ? error : new Error(String(error))
        )
      }
      
      // Log error to audit service
      if (this.dependencies.auditService) {
        await this.dependencies.auditService.logWebhookProcessingError(
          webhookId,
          error instanceof Error ? error : new Error(String(error))
        )
      }
      
      throw error
    }
  }
  
  /**
   * Validate webhook signature using HMAC-SHA256
   */
  async validateSignature(signature: string, payload: string): Promise<WebhookValidationResult> {
    try {
      // Extract signature from header (format: "sha256=<signature>")
      const cleanSignature = signature.replace(/^sha256=/, '')
      
      // Create HMAC key
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(this.config.webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      )
      
      // Calculate expected signature
      const payloadBytes = new TextEncoder().encode(payload)
      const signatureBytes = this.hexToUint8Array(cleanSignature)
      
      // Verify signature
      const isValid = await crypto.subtle.verify(
        'HMAC',
        key,
        signatureBytes,
        payloadBytes
      )
      
      return {
        isValid,
        timestamp: new Date().toISOString()
      }
      
    } catch (error) {
      console.error('Signature validation error:', error)
      return {
        isValid: false,
        errorMessage: error instanceof Error ? error.message : 'Signature validation failed',
        timestamp: new Date().toISOString()
      }
    }
  }
  
  /**
   * Process specific webhook event types
   */
  private async processWebhookEvent(
    webhookId: string,
    payload: ResendWebhookPayload
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now()
    const messageId = payload.data.message_id || payload.data.id
    
    try {
      let auditEntryId: string | undefined
      let deliveryEventId: string | undefined
      
      // Process based on event type
      switch (payload.type) {
        case 'email.sent':
          await this.handleEmailSent(payload)
          break
          
        case 'email.delivered':
          await this.handleEmailDelivered(payload)
          break
          
        case 'email.delivery_delayed':
          await this.handleEmailDeliveryDelayed(payload)
          break
          
        case 'email.bounced':
          await this.handleEmailBounced(payload)
          break
          
        case 'email.complained':
          await this.handleEmailComplained(payload)
          break
          
        case 'email.opened':
          await this.handleEmailOpened(payload)
          break
          
        case 'email.clicked':
          await this.handleEmailClicked(payload)
          break
          
        default:
          console.warn(`Unknown webhook event type: ${payload.type}`)
      }
      
      // Create audit entry
      if (this.config.enableAuditLogging) {
        auditEntryId = await this.createAuditEntry(payload)
      }
      
      // Create delivery event
      if (this.config.enableDeliveryTracking) {
        deliveryEventId = await this.createDeliveryEvent(payload)
      }
      
      // Update email queue status if service is available
      if (this.dependencies.emailQueueService && messageId) {
        await this.updateEmailQueueStatus(payload)
      }
      
      return {
        success: true,
        webhookId,
        eventType: payload.type,
        messageId: messageId || '',
        processingTime: Date.now() - startTime,
        auditEntryId,
        deliveryEventId
      }
      
    } catch (error) {
      console.error(`Failed to process webhook event ${payload.type}:`, error)
      throw createApiError(
        `Failed to process webhook event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'WEBHOOK_EVENT_PROCESSING_FAILED',
        error
      )
    }
  }
  
  /**
   * Handle email.sent event
   */
  private async handleEmailSent(payload: ResendWebhookPayload): Promise<void> {
    console.log(`Email sent: ${payload.data.message_id} to ${payload.data.to.join(', ')}`)
    
    // Record metrics
    if (this.dependencies.metricsService) {
      await this.dependencies.metricsService.recordDeliveryEvent(
        'sent',
        payload.data.message_id || payload.data.id
      )
    }
  }
  
  /**
   * Handle email.delivered event
   */
  private async handleEmailDelivered(payload: ResendWebhookPayload): Promise<void> {
    const messageId = payload.data.message_id || payload.data.id
    console.log(`Email delivered: ${messageId} to ${payload.data.to.join(', ')}`)
    
    // Update email queue if service available
    if (this.dependencies.emailQueueService) {
      await this.dependencies.emailQueueService.markEmailDelivered(
        messageId,
        payload.created_at
      )
    }
    
    // Record metrics
    if (this.dependencies.metricsService) {
      await this.dependencies.metricsService.recordDeliveryEvent('delivered', messageId)
    }
  }
  
  /**
   * Handle email.delivery_delayed event
   */
  private async handleEmailDeliveryDelayed(payload: ResendWebhookPayload): Promise<void> {
    const messageId = payload.data.message_id || payload.data.id
    console.log(`Email delivery delayed: ${messageId}`)
    
    // Record metrics
    if (this.dependencies.metricsService) {
      await this.dependencies.metricsService.recordDeliveryEvent('delivery_delayed', messageId)
    }
  }
  
  /**
   * Handle email.bounced event
   */
  private async handleEmailBounced(payload: ResendWebhookPayload): Promise<void> {
    const messageId = payload.data.message_id || payload.data.id
    const bounceType = payload.data.bounce_type || 'undetermined'
    const bounceReason = payload.data.bounce_reason || 'Unknown bounce reason'
    
    console.log(`Email bounced: ${messageId} (${bounceType}) - ${bounceReason}`)
    
    // Update email queue if service available
    if (this.dependencies.emailQueueService) {
      await this.dependencies.emailQueueService.markEmailFailed(
        messageId,
        bounceReason,
        bounceType
      )
    }
    
    // Record metrics
    if (this.dependencies.metricsService) {
      await this.dependencies.metricsService.recordDeliveryEvent('bounced', messageId)
    }
    
    // TODO: Add to suppression list for hard bounces
    if (bounceType === 'hard') {
      console.log(`Hard bounce detected for ${payload.data.to.join(', ')} - should add to suppression list`)
    }
  }
  
  /**
   * Handle email.complained event
   */
  private async handleEmailComplained(payload: ResendWebhookPayload): Promise<void> {
    const messageId = payload.data.message_id || payload.data.id
    const complaintType = payload.data.complaint_type || 'other'
    
    console.log(`Email complaint: ${messageId} (${complaintType}) from ${payload.data.to.join(', ')}`)
    
    // Update email queue if service available
    if (this.dependencies.emailQueueService) {
      await this.dependencies.emailQueueService.markEmailFailed(
        messageId,
        `Spam complaint: ${complaintType}`
      )
    }
    
    // Record metrics
    if (this.dependencies.metricsService) {
      await this.dependencies.metricsService.recordDeliveryEvent('complained', messageId)
    }
    
    // TODO: Add to suppression list
    console.log(`Spam complaint detected for ${payload.data.to.join(', ')} - should add to suppression list`)
  }
  
  /**
   * Handle email.opened event
   */
  private async handleEmailOpened(payload: ResendWebhookPayload): Promise<void> {
    const messageId = payload.data.message_id || payload.data.id
    console.log(`Email opened: ${messageId}`)
    
    // Record metrics
    if (this.dependencies.metricsService) {
      await this.dependencies.metricsService.recordDeliveryEvent('opened', messageId)
    }
  }
  
  /**
   * Handle email.clicked event
   */
  private async handleEmailClicked(payload: ResendWebhookPayload): Promise<void> {
    const messageId = payload.data.message_id || payload.data.id
    const clickUrl = payload.data.click_url
    
    console.log(`Email clicked: ${messageId} - URL: ${clickUrl}`)
    
    // Record metrics
    if (this.dependencies.metricsService) {
      await this.dependencies.metricsService.recordDeliveryEvent('clicked', messageId)
    }
  }
  
  /**
   * Create audit entry for webhook event
   */
  private async createAuditEntry(payload: ResendWebhookPayload): Promise<string> {
    const auditData: NotificationAuditCreateInput = {
      userId: this.extractUserIdFromPayload(payload),
      notificationType: this.mapEventToAuditType(payload.type),
      templateType: this.extractTemplateTypeFromPayload(payload),
      eventSource: 'resend_webhook',
      eventData: payload.data,
      resendMessageId: payload.data.message_id || payload.data.id,
      recipientEmail: payload.data.to[0], // Take first recipient
      success: this.isSuccessfulEvent(payload.type),
      errorMessage: this.extractErrorMessage(payload),
      processingTimeMs: 0, // Webhook processing time would be calculated elsewhere
      retryCount: 0
    }
    
    const auditEntry: NotificationAuditEntry = {
      id: await generateSecureId(),
      ...auditData,
      eventTimestamp: payload.created_at,
      createdAt: new Date().toISOString()
    }
    
    // Save to database
    await this.saveAuditEntry(auditEntry)
    
    return auditEntry.id
  }
  
  /**
   * Create delivery event for webhook
   */
  private async createDeliveryEvent(payload: ResendWebhookPayload): Promise<string> {
    const deliveryEventData: EmailDeliveryEventCreateInput = {
      resendMessageId: payload.data.message_id || payload.data.id,
      eventType: this.mapEventToDeliveryType(payload.type),
      eventTimestamp: payload.created_at,
      recipientEmail: payload.data.to[0], // Take first recipient
      bounceType: payload.data.bounce_type,
      bounceReason: payload.data.bounce_reason,
      complaintType: payload.data.complaint_type,
      webhookId: await generateSecureId(),
      webhookTimestamp: new Date().toISOString(),
      webhookData: payload.data
    }
    
    const deliveryEvent: EmailDeliveryEvent = {
      id: await generateSecureId(),
      ...deliveryEventData,
      processedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }
    
    // Save to database
    await this.saveDeliveryEvent(deliveryEvent)
    
    return deliveryEvent.id
  }
  
  /**
   * Update email queue status based on webhook event
   */
  private async updateEmailQueueStatus(payload: ResendWebhookPayload): Promise<void> {
    if (!this.dependencies.emailQueueService) {
return
}
    
    const messageId = payload.data.message_id || payload.data.id
    
    try {
      switch (payload.type) {
        case 'email.delivered':
          await this.dependencies.emailQueueService.updateEmailStatus(
            messageId,
            'delivered',
            { deliveredAt: payload.created_at }
          )
          break
          
        case 'email.bounced':
          await this.dependencies.emailQueueService.updateEmailStatus(
            messageId,
            'bounced',
            {
              bounceType: payload.data.bounce_type,
              bounceReason: payload.data.bounce_reason
            }
          )
          break
          
        case 'email.complained':
          await this.dependencies.emailQueueService.updateEmailStatus(
            messageId,
            'complained',
            {
              complaintType: payload.data.complaint_type
            }
          )
          break
      }
    } catch (error) {
      console.error('Failed to update email queue status:', error)
      // Don't throw error - webhook processing should continue
    }
  }
  
  /**
   * Validate webhook payload structure
   */
  private validateWebhookPayload(payload: ResendWebhookPayload): void {
    if (!payload.type) {
      throw createApiError('Missing event type in webhook payload', 400, 'MISSING_EVENT_TYPE')
    }
    
    if (!payload.data) {
      throw createApiError('Missing data in webhook payload', 400, 'MISSING_DATA')
    }
    
    if (!payload.data.to || !Array.isArray(payload.data.to) || payload.data.to.length === 0) {
      throw createApiError('Missing or invalid recipient in webhook payload', 400, 'INVALID_RECIPIENT')
    }
    
    if (!payload.created_at) {
      throw createApiError('Missing created_at in webhook payload', 400, 'MISSING_TIMESTAMP')
    }
  }
  
  /**
   * Initialize rate limiting
   */
  private initializeRateLimiting(): void {
    // Clean up expired rate limit entries periodically
    setInterval(() => {
      const now = Date.now()
      for (const [key, data] of this.rateLimitTracker.entries()) {
        if (data.resetTime <= now) {
          this.rateLimitTracker.delete(key)
        }
      }
    }, 60000) // Clean up every minute
  }
  
  /**
   * Check rate limit for incoming webhooks
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now()
    const key = 'webhook_rate_limit' // Could be IP-based or more granular
    const tracker = this.rateLimitTracker.get(key)
    
    if (!tracker) {
      this.rateLimitTracker.set(key, {
        count: 1,
        resetTime: now + 60000 // 1 minute window
      })
      return
    }
    
    // Check if rate limit period has expired
    if (tracker.resetTime <= now) {
      tracker.count = 1
      tracker.resetTime = now + 60000
      return
    }
    
    // Check if rate limit is exceeded
    if (tracker.count >= this.config.maxWebhooksPerMinute) {
      throw createApiError(
        'Webhook rate limit exceeded',
        429,
        'RATE_LIMIT_EXCEEDED'
      )
    }
    
    tracker.count++
  }
  
  /**
   * Helper methods for data extraction and mapping
   */
  
  private extractUserIdFromPayload(payload: ResendWebhookPayload): string {
    // Try to extract user ID from tags
    const userIdTag = payload.data.tags?.find(tag => tag.name === 'user_id')
    return userIdTag?.value || 'unknown'
  }
  
  private extractTemplateTypeFromPayload(payload: ResendWebhookPayload): string | undefined {
    const templateTag = payload.data.tags?.find(tag => tag.name === 'template_type')
    return templateTag?.value
  }
  
  private mapEventToAuditType(eventType: string): NotificationAuditType {
    const mapping: Record<string, NotificationAuditType> = {
      'email.sent': 'email_sent',
      'email.delivered': 'email_delivered',
      'email.bounced': 'email_bounced',
      'email.complained': 'email_complained',
      'email.opened': 'email_opened',
      'email.clicked': 'email_clicked'
    }
    
    return mapping[eventType] || 'webhook_received'
  }
  
  private mapEventToDeliveryType(eventType: string): EmailDeliveryEventType {
    const mapping: Record<string, EmailDeliveryEventType> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.delivery_delayed': 'delivery_delayed',
      'email.bounced': 'bounced',
      'email.complained': 'complained',
      'email.opened': 'opened',
      'email.clicked': 'clicked'
    }
    
    return mapping[eventType] || 'sent'
  }
  
  private isSuccessfulEvent(eventType: string): boolean {
    const successfulEvents = ['email.sent', 'email.delivered', 'email.opened', 'email.clicked']
    return successfulEvents.includes(eventType)
  }
  
  private extractErrorMessage(payload: ResendWebhookPayload): string | undefined {
    if (payload.data.bounce_reason) {
      return `Bounce: ${payload.data.bounce_reason}`
    }
    
    if (payload.data.complaint_type) {
      return `Complaint: ${payload.data.complaint_type}`
    }
    
    return undefined
  }
  
  private hexToUint8Array(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
    }
    return bytes
  }
  
  /**
   * Database operations
   */
  
  private async saveAuditEntry(entry: NotificationAuditEntry): Promise<void> {
    await this.dependencies.db.prepare(`
      INSERT INTO notification_audit (
        id, user_id, notification_type, template_type, event_timestamp, event_source,
        event_data, email_queue_id, recipient_email, resend_message_id, chess_com_username,
        game_id, game_url, success, error_message, error_code, processing_time_ms,
        retry_count, request_id, session_id, user_agent, ip_address, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      entry.id,
      entry.userId,
      entry.notificationType,
      entry.templateType || null,
      entry.eventTimestamp,
      entry.eventSource,
      entry.eventData ? JSON.stringify(entry.eventData) : null,
      entry.emailQueueId || null,
      entry.recipientEmail || null,
      entry.resendMessageId || null,
      entry.chessComUsername || null,
      entry.gameId || null,
      entry.gameUrl || null,
      entry.success,
      entry.errorMessage || null,
      entry.errorCode || null,
      entry.processingTimeMs || null,
      entry.retryCount,
      entry.requestId || null,
      entry.sessionId || null,
      entry.userAgent || null,
      entry.ipAddress || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      entry.createdAt
    ).run()
  }
  
  private async saveDeliveryEvent(event: EmailDeliveryEvent): Promise<void> {
    await this.dependencies.db.prepare(`
      INSERT INTO email_delivery_events (
        id, resend_message_id, event_type, event_timestamp, recipient_email,
        bounce_type, bounce_reason, complaint_type, webhook_id, webhook_timestamp,
        webhook_data, processed_at, notification_audit_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      event.id,
      event.resendMessageId,
      event.eventType,
      event.eventTimestamp,
      event.recipientEmail,
      event.bounceType || null,
      event.bounceReason || null,
      event.complaintType || null,
      event.webhookId || null,
      event.webhookTimestamp || null,
      event.webhookData ? JSON.stringify(event.webhookData) : null,
      event.processedAt,
      event.notificationAuditId || null,
      event.createdAt
    ).run()
  }
  
  /**
   * Get webhook processing statistics
   */
  async getWebhookStatistics(timeRange: { start: string; end: string }): Promise<{
    totalWebhooks: number
    successfulWebhooks: number
    failedWebhooks: number
    eventTypeBreakdown: Record<string, number>
    averageProcessingTime: number
    validationFailures: number
  }> {
    // Implementation would query the database for webhook statistics
    // This is a placeholder structure
    return {
      totalWebhooks: 0,
      successfulWebhooks: 0,
      failedWebhooks: 0,
      eventTypeBreakdown: {},
      averageProcessingTime: 0,
      validationFailures: 0
    }
  }
}

/**
 * Factory function to create ResendWebhookHandler instance
 */
export function createResendWebhookHandler(
  config: ResendWebhookHandlerConfig,
  dependencies: ResendWebhookHandlerDependencies
): ResendWebhookHandler {
  return new ResendWebhookHandler(config, dependencies)
}

/**
 * Default configuration for ResendWebhookHandler
 */
export const DEFAULT_WEBHOOK_CONFIG: Omit<ResendWebhookHandlerConfig, 'webhookSecret'> = {
  enableSignatureValidation: true,
  enableDeliveryTracking: true,
  enableAuditLogging: true,
  maxPayloadSize: 1048576,    // 1MB
  processingTimeout: 30000,   // 30 seconds
  enableRetryOnFailure: true,
  maxRetries: 3,
  retryDelay: 1000,          // 1 second
  enableEventStorage: true,
  eventRetentionDays: 90,
  enableRateLimiting: true,
  maxWebhooksPerMinute: 100
}