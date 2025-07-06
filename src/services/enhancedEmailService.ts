/**
 * Enhanced Email Service
 * Queue-based email processing service that replaces the basic emailService.ts
 * Provides backward compatibility while adding advanced features
 */

import { generateSecureId } from '../utils/crypto'
import { createApiError } from '../middleware/errorHandler'
import { createEmailQueueService, DEFAULT_EMAIL_QUEUE_CONFIG } from './emailQueueService'
import { EmailTemplateService } from './emailTemplateService'
import { ResendService } from './resendService'
import { EmailRetryService } from './emailRetryService'
import { createNotificationAuditService } from './notificationAuditService'
import { getUserById } from './userService'
import type { Env } from '../index'
import type { EmailQueueCreateInput } from '../models/emailQueue'

export interface NotificationEmailData {
  playerName: string
  gameUrl?: string
  result?: string
}

export interface EmailSendResult {
  notificationId: string
  delivered: boolean
  messageId?: string
  error?: string
  queueId?: string
  scheduledAt?: string
}

export interface EnhancedEmailOptions {
  priority?: 1 | 2 | 3 // 1 = high, 2 = medium, 3 = low
  scheduledAt?: string // ISO datetime for delayed sending
  maxRetries?: number
  immediateMode?: boolean // Skip queue and send immediately
}

/**
 * Enhanced Email Service Class
 * Provides both immediate and queue-based email sending
 */
export class EnhancedEmailService {
  private queueService: any
  private auditService: any

  constructor(private env: Env) {
    // Initialize services
    this.auditService = createNotificationAuditService(env.DB)
    
    this.queueService = createEmailQueueService(DEFAULT_EMAIL_QUEUE_CONFIG, {
      db: env.DB,
      templateService: new EmailTemplateService(),
      resendService: new ResendService(env.RESEND_API_KEY || ''),
      retryService: new EmailRetryService(env.DB),
      auditService: this.auditService
    })
  }

  /**
   * Send notification email (backward compatible interface)
   * Now uses queue-based processing by default
   */
  async sendNotificationEmail(
    userId: string,
    type: 'game_started' | 'game_ended',
    data: NotificationEmailData,
    options: EnhancedEmailOptions = {}
  ): Promise<EmailSendResult> {
    const notificationId = await generateSecureId()

    try {
      // Get user details
      const user = await getUserById(this.env.DB, userId)
      if (!user) {
        throw createApiError('User not found', 404, 'USER_NOT_FOUND')
      }

      // Check if user has notification preferences that would block this
      const userPrefs = await this.getUserNotificationPreferences(userId)
      if (!userPrefs.emailNotifications) {
        return {
          notificationId,
          delivered: false,
          error: 'User has disabled email notifications'
        }
      }

      // If immediate mode is requested, send directly
      if (options.immediateMode) {
        return await this.sendEmailImmediately(userId, type, data, notificationId)
      }

      // Default: Use queue-based processing
      return await this.queueEmailForProcessing(userId, type, data, notificationId, options)

    } catch (error) {
      console.error('Enhanced email service error:', error)

      // Log failure to audit service
      try {
        await this.auditService.logEmailQueued({
          userId,
          emailId: notificationId,
          emailAddress: 'unknown',
          templateType: type,
          priority: options.priority || 3,
          scheduledAt: options.scheduledAt
        })
      } catch (auditError) {
        console.error('Failed to log email failure to audit:', auditError)
      }

      return {
        notificationId,
        delivered: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Queue email for processing (preferred method)
   */
  private async queueEmailForProcessing(
    userId: string,
    type: 'game_started' | 'game_ended',
    data: NotificationEmailData,
    notificationId: string,
    options: EnhancedEmailOptions
  ): Promise<EmailSendResult> {
    try {
      const user = await getUserById(this.env.DB, userId)
      if (!user) {
        throw createApiError('User not found', 404, 'USER_NOT_FOUND')
      }

      // Prepare queue input
      const queueInput: EmailQueueCreateInput = {
        userId,
        recipientEmail: user.email,
        templateType: type,
        templateData: {
          playerName: data.playerName,
          gameUrl: data.gameUrl,
          result: data.result,
          userId: userId,
          userEmail: user.email
        },
        priority: options.priority || 3,
        scheduledAt: options.scheduledAt,
        maxRetries: options.maxRetries
      }

      // Add to queue
      const queueItem = await this.queueService.addToQueue(queueInput)

      console.log(`Email queued for processing: ${queueItem.id} -> ${user.email}`)

      return {
        notificationId,
        delivered: false, // Will be delivered asynchronously
        queueId: queueItem.id,
        scheduledAt: queueItem.scheduledAt
      }

    } catch (error) {
      console.error('Failed to queue email:', error)
      throw error
    }
  }

  /**
   * Send email immediately (bypass queue)
   */
  private async sendEmailImmediately(
    userId: string,
    type: 'game_started' | 'game_ended',
    data: NotificationEmailData,
    notificationId: string
  ): Promise<EmailSendResult> {
    const startTime = Date.now()

    try {
      const user = await getUserById(this.env.DB, userId)
      if (!user) {
        throw createApiError('User not found', 404, 'USER_NOT_FOUND')
      }

      // Render template
      const templateService = new EmailTemplateService()
      const templateResult = await templateService.renderTemplate({
        templateType: type,
        data: {
          playerName: data.playerName,
          gameUrl: data.gameUrl,
          result: data.result,
          userId: userId,
          userEmail: user.email
        },
        userId,
        priority: 'high'
      })

      // Send via Resend
      const resendService = new ResendService(this.env.RESEND_API_KEY || '')
      const sendResult = await resendService.sendEmail({
        to: user.email,
        from: 'Chess.com Helper <notifications@chesshelper.app>',
        subject: templateResult.subject,
        html: templateResult.html,
        text: templateResult.text,
        tags: [
          { name: 'template_type', value: type },
          { name: 'priority', value: 'high' },
          { name: 'user_id', value: userId },
          { name: 'immediate_mode', value: 'true' }
        ]
      })

      const processingTime = Date.now() - startTime

      if (sendResult.success && sendResult.messageId) {
        // Log successful send
        await this.auditService.logEmailSent({
          userId,
          emailId: notificationId,
          messageId: sendResult.messageId,
          emailAddress: user.email,
          chessComUsername: data.playerName,
          templateType: type,
          processingTime
        })

        return {
          notificationId,
          delivered: true,
          messageId: sendResult.messageId
        }
      } else {
        throw createApiError('Email send failed', 500, 'EMAIL_SEND_FAILED', sendResult.error)
      }

    } catch (error) {
      console.error('Immediate email send failed:', error)
      
      // Log failure
      try {
        await this.auditService.logEmailQueued({
          userId,
          emailId: notificationId,
          emailAddress: 'unknown',
          templateType: type,
          priority: 1
        })
      } catch (auditError) {
        console.error('Failed to log immediate send failure:', auditError)
      }

      throw error
    }
  }

  /**
   * Get user notification preferences
   */
  private async getUserNotificationPreferences(userId: string): Promise<{
    emailNotifications: boolean
    notificationFrequency: 'immediate' | 'digest' | 'disabled'
  }> {
    try {
      const prefs = await this.env.DB.prepare(`
        SELECT email_notifications, notification_frequency
        FROM notification_preferences
        WHERE user_id = ?
      `).bind(userId).first()

      return {
        emailNotifications: prefs?.email_notifications ?? true,
        notificationFrequency: prefs?.notification_frequency ?? 'immediate'
      }
    } catch (error) {
      console.error('Failed to get user preferences:', error)
      // Default to enabled if can't retrieve preferences
      return {
        emailNotifications: true,
        notificationFrequency: 'immediate'
      }
    }
  }

  /**
   * Process queue manually (for testing or manual triggers)
   */
  async processEmailQueue(options: {
    priority?: 1 | 2 | 3
    maxBatchSize?: number
    dryRun?: boolean
  } = {}): Promise<any> {
    try {
      return await this.queueService.processQueue(options)
    } catch (error) {
      console.error('Failed to process email queue:', error)
      throw createApiError('Queue processing failed', 500, 'QUEUE_PROCESSING_FAILED', error)
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStatistics(): Promise<any> {
    try {
      return await this.queueService.getQueueStatistics()
    } catch (error) {
      console.error('Failed to get queue statistics:', error)
      throw createApiError('Failed to get queue statistics', 500, 'QUEUE_STATS_FAILED', error)
    }
  }

  /**
   * Get queue health status
   */
  async getQueueHealthStatus(): Promise<any> {
    try {
      return await this.queueService.getHealthStatus()
    } catch (error) {
      console.error('Failed to get queue health status:', error)
      throw createApiError('Failed to get queue health status', 500, 'QUEUE_HEALTH_FAILED', error)
    }
  }

  /**
   * Cancel queued email
   */
  async cancelQueuedEmail(queueId: string, reason: string = 'Cancelled by user'): Promise<void> {
    try {
      await this.queueService.cancelEmail(queueId, reason)
    } catch (error) {
      console.error('Failed to cancel queued email:', error)
      throw createApiError('Failed to cancel email', 500, 'EMAIL_CANCEL_FAILED', error)
    }
  }

  /**
   * Stop the service and cleanup resources
   */
  stop(): void {
    if (this.queueService && typeof this.queueService.stop === 'function') {
      this.queueService.stop()
    }
  }
}

// Factory function for creating enhanced email service
export function createEnhancedEmailService(env: Env): EnhancedEmailService {
  return new EnhancedEmailService(env)
}

// Backward compatibility: Export function with same signature as original emailService
export async function sendNotificationEmail(
  env: Env,
  userId: string,
  type: 'game_started' | 'game_ended',
  data: NotificationEmailData,
  options: EnhancedEmailOptions = {}
): Promise<EmailSendResult> {
  const service = createEnhancedEmailService(env)
  return await service.sendNotificationEmail(userId, type, data, options)
}

// Re-export types for compatibility
export type { NotificationEmailData, EmailSendResult }

// Export service instance factory
let serviceInstance: EnhancedEmailService | null = null

export function getEnhancedEmailService(env: Env): EnhancedEmailService {
  if (!serviceInstance) {
    serviceInstance = createEnhancedEmailService(env)
  }
  return serviceInstance
}