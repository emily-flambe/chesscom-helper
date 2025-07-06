/**
 * Enhanced Resend Service
 * Advanced Resend API integration with rate limiting, delivery tracking, and webhook support
 */

import { generateSecureId } from '../utils/crypto'
import { createApiError } from '../middleware/errorHandler'
import { EmailTemplate } from './emailTemplateService'

export interface ResendEmailRequest {
  to: string | string[]
  from: string
  subject: string
  html?: string
  text?: string
  cc?: string | string[]
  bcc?: string | string[]
  reply_to?: string | string[]
  tags?: Array<{ name: string; value: string }>
  headers?: Record<string, string>
  attachments?: ResendAttachment[]
  scheduled_at?: string // ISO datetime for scheduled sending
}

export interface ResendAttachment {
  filename: string
  content: string | Buffer  // Base64 encoded content or Buffer
  content_type?: string
  disposition?: 'attachment' | 'inline'
  content_id?: string      // For inline attachments
}

export interface ResendEmailResponse {
  id: string               // Resend message ID
  from: string
  to: string[]
  created_at: string
}

export interface ResendEmailStatus {
  id: string
  object: 'email'
  to: string[]
  from: string
  subject: string
  created_at: string
  last_event: string       // sent, delivered, bounced, complained, opened, clicked
  
  // Event details
  events: ResendEmailEvent[]
  
  // Delivery stats
  opens?: number
  clicks?: number
  bounces?: number
  complaints?: number
}

export interface ResendEmailEvent {
  id: string
  type: 'email.sent' | 'email.delivered' | 'email.delivery_delayed' | 'email.bounced' | 'email.complained' | 'email.opened' | 'email.clicked'
  created_at: string
  data: {
    to: string
    from: string
    subject: string
    message_id: string
    
    // Event-specific data
    bounce_type?: 'hard' | 'soft' | 'undetermined'
    bounce_reason?: string
    complaint_type?: 'abuse' | 'fraud' | 'virus' | 'other'
    click_url?: string
    user_agent?: string
    ip?: string
  }
}

export interface ResendRateLimitInfo {
  limit: number            // Requests per period
  remaining: number        // Remaining requests
  reset: number           // Unix timestamp when limit resets
  retry_after?: number    // Seconds to wait before retrying (if rate limited)
}

export interface ResendServiceConfig {
  apiKey: string
  baseUrl: string
  defaultFrom: string
  
  // Rate limiting
  enableRateLimit: boolean
  rateLimitRequests: number
  rateLimitPeriod: number  // in milliseconds
  rateLimitRetryAfter: number // in milliseconds
  
  // Retries and timeouts
  requestTimeout: number   // in milliseconds
  maxRetries: number
  retryDelay: number      // in milliseconds
  
  // Webhook settings
  webhookSecret?: string
  webhookVerification: boolean
  
  // Monitoring
  enableMetrics: boolean
  enableDetailedLogging: boolean
  
  // Default email settings
  defaultReplyTo?: string
  defaultTags?: Array<{ name: string; value: string }>
  
  // Content filtering
  enableContentValidation: boolean
  maxEmailSize: number    // in bytes
  allowedAttachmentTypes: string[]
}

export interface ResendServiceDependencies {
  db?: D1Database
  metricsService?: ResendMetricsService
  auditService?: ResendAuditService
}

export interface ResendMetricsService {
  recordEmailSent(messageId: string, metadata: Record<string, any>): Promise<void>
  recordRateLimitHit(resetTime: number): Promise<void>
  recordApiError(error: ResendApiError): Promise<void>
  recordDeliveryEvent(event: ResendEmailEvent): Promise<void>
}

export interface ResendAuditService {
  logEmailRequest(request: ResendEmailRequest, response: ResendEmailResponse): Promise<void>
  logApiError(error: ResendApiError): Promise<void>
  logRateLimitEvent(rateLimitInfo: ResendRateLimitInfo): Promise<void>
  logWebhookReceived(webhook: any): Promise<void>
}

export interface ResendApiError extends Error {
  status: number
  code: string
  type: 'validation_error' | 'rate_limit_error' | 'authentication_error' | 'api_error' | 'network_error'
  details?: any
  rateLimitInfo?: ResendRateLimitInfo
}

export interface ResendEmailSendResult {
  success: boolean
  messageId?: string
  error?: ResendApiError
  rateLimitInfo?: ResendRateLimitInfo
  
  // Response metadata
  responseTime: number     // in milliseconds
  retryCount: number
  
  // Request tracking
  requestId: string
  timestamp: string
}

export interface ResendBatchEmailRequest {
  emails: ResendEmailRequest[]
  batchId?: string
  maxConcurrency?: number
  delayBetweenRequests?: number // in milliseconds
}

export interface ResendBatchEmailResult {
  batchId: string
  totalEmails: number
  successfulEmails: number
  failedEmails: number
  results: ResendEmailSendResult[]
  
  // Batch timing
  startTime: string
  endTime: string
  totalTime: number       // in milliseconds
  
  // Rate limiting info
  rateLimitHit: boolean
  rateLimitDelay: number  // total delay due to rate limiting
}

/**
 * Enhanced Resend Service - Professional email delivery service
 * 
 * Features:
 * - Rate limiting and quota management
 * - Comprehensive error handling and retries
 * - Delivery tracking and status monitoring
 * - Webhook processing support
 * - Batch email sending
 * - Performance metrics and monitoring
 * - Content validation and security
 */
export class ResendService {
  private config: ResendServiceConfig
  private dependencies: ResendServiceDependencies
  private rateLimitTracker: Map<string, { count: number; resetTime: number }> = new Map()
  private requestQueue: Array<() => Promise<any>> = []
  private isProcessingQueue = false
  
  constructor(config: ResendServiceConfig, dependencies: ResendServiceDependencies = {}) {
    this.config = config
    this.dependencies = dependencies
    
    // Validate configuration
    this.validateConfig()
    
    // Initialize rate limit tracker
    this.initializeRateLimiting()
  }
  
  /**
   * Send a single email via Resend API
   */
  async sendEmail(emailRequest: ResendEmailRequest): Promise<ResendEmailSendResult> {
    const requestId = await generateSecureId()
    const startTime = Date.now()
    const retryCount = 0
    
    try {
      // Validate email request
      this.validateEmailRequest(emailRequest)
      
      // Check rate limiting
      await this.checkRateLimit()
      
      // Prepare request
      const request = this.prepareEmailRequest(emailRequest)
      
      // Send with retries
      const response = await this.sendWithRetries(request, retryCount)
      
      // Process response
      const result: ResendEmailSendResult = {
        success: true,
        messageId: response.id,
        responseTime: Date.now() - startTime,
        retryCount,
        requestId,
        timestamp: new Date().toISOString()
      }
      
      // Log success
      if (this.dependencies.auditService) {
        await this.dependencies.auditService.logEmailRequest(emailRequest, response)
      }
      
      // Record metrics
      if (this.dependencies.metricsService) {
        await this.dependencies.metricsService.recordEmailSent(response.id, {
          to: emailRequest.to,
          subject: emailRequest.subject,
          responseTime: result.responseTime,
          retryCount
        })
      }
      
      return result
      
    } catch (error) {
      const resendError = this.processError(error)
      
      const result: ResendEmailSendResult = {
        success: false,
        error: resendError,
        responseTime: Date.now() - startTime,
        retryCount,
        requestId,
        timestamp: new Date().toISOString()
      }
      
      // Extract rate limit info if available
      if (resendError.rateLimitInfo) {
        result.rateLimitInfo = resendError.rateLimitInfo
      }
      
      // Log error
      if (this.dependencies.auditService) {
        await this.dependencies.auditService.logApiError(resendError)
      }
      
      // Record metrics
      if (this.dependencies.metricsService) {
        await this.dependencies.metricsService.recordApiError(resendError)
      }
      
      return result
    }
  }
  
  /**
   * Get email delivery status by message ID
   */
  async getEmailStatus(messageId: string): Promise<ResendEmailStatus> {
    try {
      await this.checkRateLimit()
      
      const response = await this.makeApiRequest(`emails/${messageId}`, {
        method: 'GET'
      })
      
      if (!response.ok) {
        throw await this.createApiError(response)
      }
      
      const status = await response.json() as ResendEmailStatus
      
      // Record metrics for delivery tracking
      if (this.dependencies.metricsService && status.events) {
        for (const event of status.events) {
          await this.dependencies.metricsService.recordDeliveryEvent(event)
        }
      }
      
      return status
      
    } catch (error) {
      console.error('Failed to get email status:', error)
      throw this.processError(error)
    }
  }
  
  /**
   * Send batch of emails with rate limiting and concurrency control
   */
  async sendBatchEmails(batchRequest: ResendBatchEmailRequest): Promise<ResendBatchEmailResult> {
    const batchId = batchRequest.batchId || await generateSecureId()
    const startTime = new Date()
    const results: ResendEmailSendResult[] = []
    let rateLimitHit = false
    let totalRateLimitDelay = 0
    
    try {
      const maxConcurrency = batchRequest.maxConcurrency || 5
      const delayBetweenRequests = batchRequest.delayBetweenRequests || 100
      
      // Process emails in batches to respect rate limits
      for (let i = 0; i < batchRequest.emails.length; i += maxConcurrency) {
        const batch = batchRequest.emails.slice(i, i + maxConcurrency)
        
        // Send batch concurrently
        const batchPromises = batch.map(async (email, index) => {
          // Add delay between requests if specified
          if (delayBetweenRequests > 0 && index > 0) {
            await this.sleep(delayBetweenRequests)
          }
          
          try {
            const result = await this.sendEmail(email)
            
            // Track rate limiting
            if (result.rateLimitInfo?.remaining === 0) {
              rateLimitHit = true
              totalRateLimitDelay += result.rateLimitInfo.retry_after || 0
            }
            
            return result
          } catch (error) {
            return {
              success: false,
              error: this.processError(error),
              responseTime: 0,
              retryCount: 0,
              requestId: await generateSecureId(),
              timestamp: new Date().toISOString()
            } as ResendEmailSendResult
          }
        })
        
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
        
        // Add delay between batches if rate limit was hit
        if (rateLimitHit && i + maxConcurrency < batchRequest.emails.length) {
          const delay = Math.max(1000, totalRateLimitDelay * 1000) // Convert to milliseconds
          await this.sleep(delay)
        }
      }
      
      const endTime = new Date()
      const successfulEmails = results.filter(r => r.success).length
      const failedEmails = results.length - successfulEmails
      
      return {
        batchId,
        totalEmails: batchRequest.emails.length,
        successfulEmails,
        failedEmails,
        results,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalTime: endTime.getTime() - startTime.getTime(),
        rateLimitHit,
        rateLimitDelay: totalRateLimitDelay
      }
      
    } catch (error) {
      console.error('Batch email send failed:', error)
      throw this.processError(error)
    }
  }
  
  /**
   * Validate webhook signature and process webhook data
   */
  async validateWebhook(signature: string, payload: string): Promise<boolean> {
    if (!this.config.webhookVerification || !this.config.webhookSecret) {
      return true // Skip validation if not configured
    }
    
    try {
      // Use Web Crypto API to verify HMAC signature
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(this.config.webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      )
      
      const signatureBytes = this.hexToBytes(signature.replace('sha256=', ''))
      const payloadBytes = new TextEncoder().encode(payload)
      
      const isValid = await crypto.subtle.verify(
        'HMAC',
        key,
        signatureBytes,
        payloadBytes
      )
      
      return isValid
      
    } catch (error) {
      console.error('Webhook signature validation failed:', error)
      return false
    }
  }
  
  /**
   * Process webhook payload
   */
  async processWebhook(payload: any): Promise<void> {
    try {
      // Log webhook received
      if (this.dependencies.auditService) {
        await this.dependencies.auditService.logWebhookReceived(payload)
      }
      
      // Process different event types
      switch (payload.type) {
        case 'email.sent':
        case 'email.delivered':
        case 'email.delivery_delayed':
        case 'email.bounced':
        case 'email.complained':
        case 'email.opened':
        case 'email.clicked':
          await this.processEmailEvent(payload)
          break
          
        default:
          console.warn('Unknown webhook event type:', payload.type)
      }
      
    } catch (error) {
      console.error('Failed to process webhook:', error)
      throw createApiError('Failed to process webhook', 500, 'WEBHOOK_PROCESSING_FAILED', error)
    }
  }
  
  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(): Promise<ResendRateLimitInfo> {
    try {
      const response = await this.makeApiRequest('rate-limit', {
        method: 'GET'
      })
      
      if (!response.ok) {
        throw await this.createApiError(response)
      }
      
      const rateLimitInfo = this.extractRateLimitInfo(response.headers)
      return rateLimitInfo
      
    } catch (error) {
      console.error('Failed to get rate limit status:', error)
      throw this.processError(error)
    }
  }
  
  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean
    rateLimitStatus: ResendRateLimitInfo
    lastError?: ResendApiError
    averageResponseTime: number
    totalEmailsSent: number
  }> {
    try {
      const rateLimitStatus = await this.getRateLimitStatus()
      
      return {
        isHealthy: true,
        rateLimitStatus,
        averageResponseTime: 0, // Would be calculated from metrics
        totalEmailsSent: 0      // Would be calculated from metrics
      }
      
    } catch (error) {
      return {
        isHealthy: false,
        rateLimitStatus: {
          limit: 0,
          remaining: 0,
          reset: 0
        },
        lastError: this.processError(error),
        averageResponseTime: 0,
        totalEmailsSent: 0
      }
    }
  }
  
  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (!this.config.apiKey) {
      throw createApiError('Resend API key is required', 400, 'MISSING_API_KEY')
    }
    
    if (!this.config.defaultFrom) {
      throw createApiError('Default from address is required', 400, 'MISSING_FROM_ADDRESS')
    }
    
    if (!this.isValidEmail(this.config.defaultFrom)) {
      throw createApiError('Default from address is invalid', 400, 'INVALID_FROM_ADDRESS')
    }
  }
  
  /**
   * Initialize rate limiting tracker
   */
  private initializeRateLimiting(): void {
    if (!this.config.enableRateLimit) {
      return
    }
    
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
   * Check and enforce rate limiting
   */
  private async checkRateLimit(): Promise<void> {
    if (!this.config.enableRateLimit) {
      return
    }
    
    const now = Date.now()
    const key = 'default' // Could be user-specific or API-key specific
    const tracker = this.rateLimitTracker.get(key)
    
    if (!tracker) {
      this.rateLimitTracker.set(key, {
        count: 1,
        resetTime: now + this.config.rateLimitPeriod
      })
      return
    }
    
    // Check if rate limit period has expired
    if (tracker.resetTime <= now) {
      tracker.count = 1
      tracker.resetTime = now + this.config.rateLimitPeriod
      return
    }
    
    // Check if rate limit is exceeded
    if (tracker.count >= this.config.rateLimitRequests) {
      const waitTime = tracker.resetTime - now
      
      // Log rate limit hit
      if (this.dependencies.metricsService) {
        await this.dependencies.metricsService.recordRateLimitHit(tracker.resetTime)
      }
      
      throw this.createRateLimitError(waitTime)
    }
    
    // Increment counter
    tracker.count++
  }
  
  /**
   * Validate email request
   */
  private validateEmailRequest(request: ResendEmailRequest): void {
    if (!request.to || (Array.isArray(request.to) && request.to.length === 0)) {
      throw createApiError('Recipient email is required', 400, 'MISSING_RECIPIENT')
    }
    
    if (!request.subject) {
      throw createApiError('Email subject is required', 400, 'MISSING_SUBJECT')
    }
    
    if (!request.html && !request.text) {
      throw createApiError('Email content (html or text) is required', 400, 'MISSING_CONTENT')
    }
    
    // Validate email addresses
    const recipients = Array.isArray(request.to) ? request.to : [request.to]
    for (const email of recipients) {
      if (!this.isValidEmail(email)) {
        throw createApiError(`Invalid recipient email: ${email}`, 400, 'INVALID_RECIPIENT')
      }
    }
    
    if (!this.isValidEmail(request.from)) {
      throw createApiError(`Invalid from email: ${request.from}`, 400, 'INVALID_FROM')
    }
    
    // Check content size
    const contentSize = (request.html?.length || 0) + (request.text?.length || 0)
    if (contentSize > this.config.maxEmailSize) {
      throw createApiError('Email content exceeds maximum size', 400, 'CONTENT_TOO_LARGE')
    }
    
    // Validate attachments
    if (request.attachments) {
      for (const attachment of request.attachments) {
        if (!attachment.filename || !attachment.content) {
          throw createApiError('Attachment filename and content are required', 400, 'INVALID_ATTACHMENT')
        }
        
        if (attachment.content_type && !this.config.allowedAttachmentTypes.includes(attachment.content_type)) {
          throw createApiError(`Attachment type not allowed: ${attachment.content_type}`, 400, 'ATTACHMENT_TYPE_NOT_ALLOWED')
        }
      }
    }
  }
  
  /**
   * Prepare email request for Resend API
   */
  private prepareEmailRequest(request: ResendEmailRequest): ResendEmailRequest {
    const prepared: ResendEmailRequest = {
      ...request,
      from: request.from || this.config.defaultFrom
    }
    
    // Add default tags if configured
    if (this.config.defaultTags && this.config.defaultTags.length > 0) {
      prepared.tags = [...(prepared.tags || []), ...this.config.defaultTags]
    }
    
    // Add default reply-to if configured
    if (this.config.defaultReplyTo && !prepared.reply_to) {
      prepared.reply_to = this.config.defaultReplyTo
    }
    
    return prepared
  }
  
  /**
   * Send email with retries
   */
  private async sendWithRetries(request: ResendEmailRequest, retryCount: number = 0): Promise<ResendEmailResponse> {
    try {
      const response = await this.makeApiRequest('emails', {
        method: 'POST',
        body: JSON.stringify(request)
      })
      
      if (!response.ok) {
        throw await this.createApiError(response)
      }
      
      return await response.json() as ResendEmailResponse
      
    } catch (error) {
      const resendError = this.processError(error)
      
      // Check if we should retry
      if (retryCount < this.config.maxRetries && this.shouldRetry(resendError)) {
        const delay = this.calculateRetryDelay(retryCount)
        await this.sleep(delay)
        return this.sendWithRetries(request, retryCount + 1)
      }
      
      throw resendError
    }
  }
  
  /**
   * Make API request to Resend
   */
  private async makeApiRequest(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${this.config.baseUrl}/${endpoint}`
    
    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ChessHelperApp/1.0',
      ...options.headers
    }
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout)
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      return response
      
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }
  
  /**
   * Create API error from response
   */
  private async createApiError(response: Response): Promise<ResendApiError> {
    let errorData: any = {}
    
    try {
      errorData = await response.json()
    } catch {
      // Response body is not JSON
    }
    
    const error = new Error(errorData.message || `API request failed with status ${response.status}`) as ResendApiError
    error.status = response.status
    error.code = errorData.name || 'API_ERROR'
    error.type = this.getErrorType(response.status)
    error.details = errorData
    
    // Extract rate limit info
    error.rateLimitInfo = this.extractRateLimitInfo(response.headers)
    
    return error
  }
  
  /**
   * Process and classify errors
   */
  private processError(error: any): ResendApiError {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Request timeout') as ResendApiError
      timeoutError.status = 408
      timeoutError.code = 'REQUEST_TIMEOUT'
      timeoutError.type = 'network_error'
      return timeoutError
    }
    
    if (error.status) {
      return error as ResendApiError
    }
    
    // Network or other errors
    const networkError = new Error(error.message || 'Network error') as ResendApiError
    networkError.status = 0
    networkError.code = 'NETWORK_ERROR'
    networkError.type = 'network_error'
    return networkError
  }
  
  /**
   * Get error type from status code
   */
  private getErrorType(status: number): ResendApiError['type'] {
    if (status === 429) {
return 'rate_limit_error'
}
    if (status === 401 || status === 403) {
return 'authentication_error'
}
    if (status >= 400 && status < 500) {
return 'validation_error'
}
    if (status >= 500) {
return 'api_error'
}
    return 'network_error'
  }
  
  /**
   * Extract rate limit info from response headers
   */
  private extractRateLimitInfo(headers: Headers): ResendRateLimitInfo {
    return {
      limit: parseInt(headers.get('x-ratelimit-limit') || '0'),
      remaining: parseInt(headers.get('x-ratelimit-remaining') || '0'),
      reset: parseInt(headers.get('x-ratelimit-reset') || '0'),
      retry_after: parseInt(headers.get('retry-after') || '0') || undefined
    }
  }
  
  /**
   * Create rate limit error
   */
  private createRateLimitError(waitTime: number): ResendApiError {
    const error = new Error('Rate limit exceeded') as ResendApiError
    error.status = 429
    error.code = 'RATE_LIMIT_EXCEEDED'
    error.type = 'rate_limit_error'
    error.rateLimitInfo = {
      limit: this.config.rateLimitRequests,
      remaining: 0,
      reset: Math.floor((Date.now() + waitTime) / 1000),
      retry_after: Math.ceil(waitTime / 1000)
    }
    return error
  }
  
  /**
   * Check if error should be retried
   */
  private shouldRetry(error: ResendApiError): boolean {
    // Don't retry validation errors or authentication errors
    if (error.type === 'validation_error' || error.type === 'authentication_error') {
      return false
    }
    
    // Retry rate limit errors, network errors, and server errors
    return ['rate_limit_error', 'network_error', 'api_error'].includes(error.type)
  }
  
  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.config.retryDelay
    const exponentialDelay = baseDelay * Math.pow(2, retryCount)
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000
    
    return Math.min(exponentialDelay + jitter, 30000) // Max 30 seconds
  }
  
  /**
   * Process email delivery events from webhooks
   */
  private async processEmailEvent(payload: any): Promise<void> {
    const event: ResendEmailEvent = {
      id: payload.data.id || await generateSecureId(),
      type: payload.type,
      created_at: payload.created_at || new Date().toISOString(),
      data: payload.data
    }
    
    // Record metrics
    if (this.dependencies.metricsService) {
      await this.dependencies.metricsService.recordDeliveryEvent(event)
    }
    
    // Update database if available
    if (this.dependencies.db) {
      await this.saveEmailEvent(event)
    }
  }
  
  /**
   * Save email event to database
   */
  private async saveEmailEvent(event: ResendEmailEvent): Promise<void> {
    if (!this.dependencies.db) {
return
}
    
    try {
      await this.dependencies.db.prepare(`
        INSERT INTO email_delivery_events (
          id, message_id, event_type, event_data, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        event.id,
        event.data.message_id,
        event.type,
        JSON.stringify(event.data),
        event.created_at
      ).run()
    } catch (error) {
      console.error('Failed to save email event:', error)
    }
  }
  
  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
  
  /**
   * Convert hex string to bytes
   */
  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
    }
    return bytes
  }
  
  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Factory function to create ResendService instance
 */
export function createResendService(
  config: ResendServiceConfig,
  dependencies: ResendServiceDependencies = {}
): ResendService {
  return new ResendService(config, dependencies)
}

/**
 * Default configuration for ResendService
 */
export const DEFAULT_RESEND_CONFIG: Omit<ResendServiceConfig, 'apiKey' | 'defaultFrom'> = {
  baseUrl: 'https://api.resend.com',
  enableRateLimit: true,
  rateLimitRequests: 100,
  rateLimitPeriod: 60000,     // 1 minute
  rateLimitRetryAfter: 5000,  // 5 seconds
  requestTimeout: 30000,      // 30 seconds
  maxRetries: 3,
  retryDelay: 1000,           // 1 second
  webhookVerification: true,
  enableMetrics: true,
  enableDetailedLogging: true,
  enableContentValidation: true,
  maxEmailSize: 10485760,     // 10MB
  allowedAttachmentTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv'
  ]
}

/**
 * Utility function to create email template from EmailTemplate interface
 */
export function createResendEmailFromTemplate(
  template: EmailTemplate,
  to: string | string[],
  from: string
): ResendEmailRequest {
  return {
    to,
    from,
    subject: template.subject,
    html: template.html,
    text: template.text
  }
}