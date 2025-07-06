/**
 * Notification Audit Service
 * Comprehensive audit logging for all email/notification events
 */

import { generateSecureId } from '../utils/crypto'
import { createApiError } from '../middleware/errorHandler'
import { getUserById } from './userService'
import type { Env } from '../index'

export interface NotificationAuditEntry {
  id: string
  userId: string
  notificationType: 'email_queued' | 'email_sent' | 'email_delivered' | 'email_bounced' | 'email_complained' | 'email_retry_scheduled' | 'email_failed'
  emailAddress?: string
  chessComUsername?: string
  emailId?: string
  messageId?: string
  templateType?: string
  status: 'success' | 'failed' | 'pending'
  metadata: any
  errorMessage?: string
  processingTime?: number
  createdAt: string
}

export interface AuditQueryOptions {
  userId?: string
  notificationType?: string
  emailAddress?: string
  chessComUsername?: string
  status?: string
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
}

export interface DeliverySuccessRate {
  totalEmails: number
  successfulDeliveries: number
  failedDeliveries: number
  successRate: number
  period: string
}

export interface NotificationHistory {
  entries: NotificationAuditEntry[]
  totalCount: number
  pagination: {
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface UserEmailMetrics {
  userId: string
  emailAddress: string
  totalEmailsSent: number
  successfulDeliveries: number
  failedDeliveries: number
  bounces: number
  complaints: number
  averageProcessingTime: number
  lastEmailSent?: string
  successRate: number
}

export class NotificationAuditService {
  constructor(private db: D1Database) {}

  /**
   * Log email queued event
   */
  async logEmailQueued(data: {
    userId: string
    emailId: string
    emailAddress: string
    chessComUsername?: string
    templateType: string
    priority: number
    scheduledAt?: string
  }): Promise<void> {
    try {
      const entry: NotificationAuditEntry = {
        id: await generateSecureId(),
        userId: data.userId,
        notificationType: 'email_queued',
        emailAddress: data.emailAddress,
        chessComUsername: data.chessComUsername,
        emailId: data.emailId,
        templateType: data.templateType,
        status: 'success',
        metadata: {
          priority: data.priority,
          scheduledAt: data.scheduledAt
        },
        createdAt: new Date().toISOString()
      }

      await this.saveAuditEntry(entry)
      console.log(`Audit: Email queued for ${data.emailAddress}`)

    } catch (error) {
      console.error('Failed to log email queued event:', error)
      throw createApiError('Failed to log audit event', 500, 'AUDIT_LOG_FAILED', error)
    }
  }

  /**
   * Log email sent event
   */
  async logEmailSent(data: {
    userId: string
    emailId: string
    messageId: string
    emailAddress: string
    chessComUsername?: string
    templateType: string
    processingTime: number
  }): Promise<void> {
    try {
      const entry: NotificationAuditEntry = {
        id: await generateSecureId(),
        userId: data.userId,
        notificationType: 'email_sent',
        emailAddress: data.emailAddress,
        chessComUsername: data.chessComUsername,
        emailId: data.emailId,
        messageId: data.messageId,
        templateType: data.templateType,
        status: 'success',
        processingTime: data.processingTime,
        metadata: {
          service: 'resend',
          timestamp: new Date().toISOString()
        },
        createdAt: new Date().toISOString()
      }

      await this.saveAuditEntry(entry)
      console.log(`Audit: Email sent to ${data.emailAddress} with message ID ${data.messageId}`)

    } catch (error) {
      console.error('Failed to log email sent event:', error)
      throw createApiError('Failed to log audit event', 500, 'AUDIT_LOG_FAILED', error)
    }
  }

  /**
   * Log email delivered event (from webhook)
   */
  async logEmailDelivered(data: {
    messageId: string
    emailAddress: string
    deliveredAt: string
    userId?: string
    emailId?: string
  }): Promise<void> {
    try {
      // Get email details from queue if available
      let emailDetails = null
      if (data.emailId) {
        emailDetails = await this.getEmailDetailsFromQueue(data.emailId)
      } else {
        emailDetails = await this.getEmailDetailsByMessageId(data.messageId)
      }

      const entry: NotificationAuditEntry = {
        id: await generateSecureId(),
        userId: data.userId || emailDetails?.userId || 'unknown',
        notificationType: 'email_delivered',
        emailAddress: data.emailAddress,
        chessComUsername: emailDetails?.chessComUsername,
        emailId: data.emailId || emailDetails?.emailId,
        messageId: data.messageId,
        templateType: emailDetails?.templateType,
        status: 'success',
        metadata: {
          deliveredAt: data.deliveredAt,
          webhook: 'resend'
        },
        createdAt: new Date().toISOString()
      }

      await this.saveAuditEntry(entry)
      console.log(`Audit: Email delivered to ${data.emailAddress}`)

    } catch (error) {
      console.error('Failed to log email delivered event:', error)
      throw createApiError('Failed to log audit event', 500, 'AUDIT_LOG_FAILED', error)
    }
  }

  /**
   * Log email bounced event (from webhook)
   */
  async logEmailBounced(data: {
    messageId: string
    emailAddress: string
    bounceType: string
    bounceReason: string
    bouncedAt: string
    userId?: string
    emailId?: string
  }): Promise<void> {
    try {
      // Get email details from queue if available
      let emailDetails = null
      if (data.emailId) {
        emailDetails = await this.getEmailDetailsFromQueue(data.emailId)
      } else {
        emailDetails = await this.getEmailDetailsByMessageId(data.messageId)
      }

      const entry: NotificationAuditEntry = {
        id: await generateSecureId(),
        userId: data.userId || emailDetails?.userId || 'unknown',
        notificationType: 'email_bounced',
        emailAddress: data.emailAddress,
        chessComUsername: emailDetails?.chessComUsername,
        emailId: data.emailId || emailDetails?.emailId,
        messageId: data.messageId,
        templateType: emailDetails?.templateType,
        status: 'failed',
        errorMessage: `Bounce: ${data.bounceType} - ${data.bounceReason}`,
        metadata: {
          bounceType: data.bounceType,
          bounceReason: data.bounceReason,
          bouncedAt: data.bouncedAt,
          webhook: 'resend'
        },
        createdAt: new Date().toISOString()
      }

      await this.saveAuditEntry(entry)
      console.log(`Audit: Email bounced for ${data.emailAddress} - ${data.bounceType}`)

    } catch (error) {
      console.error('Failed to log email bounced event:', error)
      throw createApiError('Failed to log audit event', 500, 'AUDIT_LOG_FAILED', error)
    }
  }

  /**
   * Log email complained event (from webhook)
   */
  async logEmailComplained(data: {
    messageId: string
    emailAddress: string
    complainedAt: string
    userId?: string
    emailId?: string
  }): Promise<void> {
    try {
      // Get email details from queue if available
      let emailDetails = null
      if (data.emailId) {
        emailDetails = await this.getEmailDetailsFromQueue(data.emailId)
      } else {
        emailDetails = await this.getEmailDetailsByMessageId(data.messageId)
      }

      const entry: NotificationAuditEntry = {
        id: await generateSecureId(),
        userId: data.userId || emailDetails?.userId || 'unknown',
        notificationType: 'email_complained',
        emailAddress: data.emailAddress,
        chessComUsername: emailDetails?.chessComUsername,
        emailId: data.emailId || emailDetails?.emailId,
        messageId: data.messageId,
        templateType: emailDetails?.templateType,
        status: 'failed',
        errorMessage: 'Spam complaint received',
        metadata: {
          complainedAt: data.complainedAt,
          webhook: 'resend'
        },
        createdAt: new Date().toISOString()
      }

      await this.saveAuditEntry(entry)
      console.log(`Audit: Email complaint for ${data.emailAddress}`)

    } catch (error) {
      console.error('Failed to log email complained event:', error)
      throw createApiError('Failed to log audit event', 500, 'AUDIT_LOG_FAILED', error)
    }
  }

  /**
   * Log email retry scheduled event
   */
  async logEmailRetryScheduled(data: {
    userId: string
    emailId: string
    emailAddress: string
    chessComUsername?: string
    templateType: string
    retryCount: number
    nextRetryAt: string
    reason: string
  }): Promise<void> {
    try {
      const entry: NotificationAuditEntry = {
        id: await generateSecureId(),
        userId: data.userId,
        notificationType: 'email_retry_scheduled',
        emailAddress: data.emailAddress,
        chessComUsername: data.chessComUsername,
        emailId: data.emailId,
        templateType: data.templateType,
        status: 'pending',
        metadata: {
          retryCount: data.retryCount,
          nextRetryAt: data.nextRetryAt,
          reason: data.reason
        },
        createdAt: new Date().toISOString()
      }

      await this.saveAuditEntry(entry)
      console.log(`Audit: Email retry scheduled for ${data.emailAddress} (attempt ${data.retryCount})`)

    } catch (error) {
      console.error('Failed to log email retry scheduled event:', error)
      throw createApiError('Failed to log audit event', 500, 'AUDIT_LOG_FAILED', error)
    }
  }

  /**
   * Get delivery success rate analytics
   */
  async getDeliverySuccessRate(options: {
    userId?: string
    period?: 'day' | 'week' | 'month'
    fromDate?: string
    toDate?: string
  } = {}): Promise<DeliverySuccessRate> {
    try {
      const period = options.period || 'month'
      const fromDate = options.fromDate || this.getDateByPeriod(period)
      const toDate = options.toDate || new Date().toISOString()

      let query = `
        SELECT 
          COUNT(*) as total_emails,
          SUM(CASE WHEN notification_type = 'email_delivered' THEN 1 ELSE 0 END) as successful_deliveries,
          SUM(CASE WHEN notification_type IN ('email_bounced', 'email_failed') THEN 1 ELSE 0 END) as failed_deliveries
        FROM notification_audit
        WHERE notification_type IN ('email_sent', 'email_delivered', 'email_bounced', 'email_failed')
        AND created_at >= ? AND created_at <= ?
      `
      const params = [fromDate, toDate]

      if (options.userId) {
        query += ' AND user_id = ?'
        params.push(options.userId)
      }

      const result = await this.db.prepare(query).bind(...params).first()

      const totalEmails = result?.total_emails || 0
      const successfulDeliveries = result?.successful_deliveries || 0
      const failedDeliveries = result?.failed_deliveries || 0
      const successRate = totalEmails > 0 ? (successfulDeliveries / totalEmails) * 100 : 0

      return {
        totalEmails,
        successfulDeliveries,
        failedDeliveries,
        successRate: Math.round(successRate * 100) / 100,
        period: `${fromDate} to ${toDate}`
      }

    } catch (error) {
      console.error('Failed to get delivery success rate:', error)
      throw createApiError('Failed to get delivery success rate', 500, 'ANALYTICS_FAILED', error)
    }
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(options: AuditQueryOptions = {}): Promise<NotificationHistory> {
    try {
      const limit = Math.min(options.limit || 50, 100)
      const offset = options.offset || 0

      // Build query
      let query = 'SELECT * FROM notification_audit WHERE 1=1'
      let countQuery = 'SELECT COUNT(*) as count FROM notification_audit WHERE 1=1'
      const params: any[] = []

      if (options.userId) {
        query += ' AND user_id = ?'
        countQuery += ' AND user_id = ?'
        params.push(options.userId)
      }

      if (options.notificationType) {
        query += ' AND notification_type = ?'
        countQuery += ' AND notification_type = ?'
        params.push(options.notificationType)
      }

      if (options.emailAddress) {
        query += ' AND email_address = ?'
        countQuery += ' AND email_address = ?'
        params.push(options.emailAddress)
      }

      if (options.chessComUsername) {
        query += ' AND chess_com_username = ?'
        countQuery += ' AND chess_com_username = ?'
        params.push(options.chessComUsername)
      }

      if (options.status) {
        query += ' AND status = ?'
        countQuery += ' AND status = ?'
        params.push(options.status)
      }

      if (options.fromDate) {
        query += ' AND created_at >= ?'
        countQuery += ' AND created_at >= ?'
        params.push(options.fromDate)
      }

      if (options.toDate) {
        query += ' AND created_at <= ?'
        countQuery += ' AND created_at <= ?'
        params.push(options.toDate)
      }

      // Get total count
      const countResult = await this.db.prepare(countQuery).bind(...params).first()
      const totalCount = countResult?.count || 0

      // Get paginated results
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
      const queryParams = [...params, limit, offset]
      
      const result = await this.db.prepare(query).bind(...queryParams).all()
      const entries = result.results?.map(row => this.mapRowToAuditEntry(row)) || []

      return {
        entries,
        totalCount,
        pagination: {
          limit,
          offset,
          hasMore: offset + entries.length < totalCount
        }
      }

    } catch (error) {
      console.error('Failed to get notification history:', error)
      throw createApiError('Failed to get notification history', 500, 'HISTORY_QUERY_FAILED', error)
    }
  }

  /**
   * Get user email metrics
   */
  async getUserEmailMetrics(userId: string): Promise<UserEmailMetrics> {
    try {
      // Get user details
      const user = await getUserById(this.db, userId)
      if (!user) {
        throw createApiError('User not found', 404, 'USER_NOT_FOUND')
      }

      // Get email statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_emails_sent,
          SUM(CASE WHEN notification_type = 'email_delivered' THEN 1 ELSE 0 END) as successful_deliveries,
          SUM(CASE WHEN notification_type IN ('email_bounced', 'email_failed') THEN 1 ELSE 0 END) as failed_deliveries,
          SUM(CASE WHEN notification_type = 'email_bounced' THEN 1 ELSE 0 END) as bounces,
          SUM(CASE WHEN notification_type = 'email_complained' THEN 1 ELSE 0 END) as complaints,
          AVG(processing_time) as avg_processing_time,
          MAX(CASE WHEN notification_type = 'email_sent' THEN created_at END) as last_email_sent
        FROM notification_audit
        WHERE user_id = ? AND notification_type IN ('email_sent', 'email_delivered', 'email_bounced', 'email_complained', 'email_failed')
      `

      const stats = await this.db.prepare(statsQuery).bind(userId).first()

      const totalEmailsSent = stats?.total_emails_sent || 0
      const successfulDeliveries = stats?.successful_deliveries || 0
      const failedDeliveries = stats?.failed_deliveries || 0
      const successRate = totalEmailsSent > 0 ? (successfulDeliveries / totalEmailsSent) * 100 : 0

      return {
        userId,
        emailAddress: user.email,
        totalEmailsSent,
        successfulDeliveries,
        failedDeliveries,
        bounces: stats?.bounces || 0,
        complaints: stats?.complaints || 0,
        averageProcessingTime: stats?.avg_processing_time || 0,
        lastEmailSent: stats?.last_email_sent,
        successRate: Math.round(successRate * 100) / 100
      }

    } catch (error) {
      console.error('Failed to get user email metrics:', error)
      throw createApiError('Failed to get user email metrics', 500, 'METRICS_QUERY_FAILED', error)
    }
  }

  /**
   * Private helper methods
   */

  private async saveAuditEntry(entry: NotificationAuditEntry): Promise<void> {
    await this.db.prepare(`
      INSERT INTO notification_audit (
        id, user_id, notification_type, email_address, chess_com_username,
        email_id, message_id, template_type, status, metadata,
        error_message, processing_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      entry.id,
      entry.userId,
      entry.notificationType,
      entry.emailAddress || null,
      entry.chessComUsername || null,
      entry.emailId || null,
      entry.messageId || null,
      entry.templateType || null,
      entry.status,
      JSON.stringify(entry.metadata),
      entry.errorMessage || null,
      entry.processingTime || null,
      entry.createdAt
    ).run()
  }

  private async getEmailDetailsFromQueue(emailId: string): Promise<any> {
    try {
      const result = await this.db.prepare(`
        SELECT user_id, template_type FROM email_queue WHERE id = ?
      `).bind(emailId).first()
      
      return result ? { userId: result.user_id, templateType: result.template_type, emailId } : null
    } catch (error) {
      console.error('Failed to get email details from queue:', error)
      return null
    }
  }

  private async getEmailDetailsByMessageId(messageId: string): Promise<any> {
    try {
      const result = await this.db.prepare(`
        SELECT user_id, template_type, id as email_id FROM email_queue WHERE resend_message_id = ?
      `).bind(messageId).first()
      
      return result ? { 
        userId: result.user_id, 
        templateType: result.template_type, 
        emailId: result.email_id 
      } : null
    } catch (error) {
      console.error('Failed to get email details by message ID:', error)
      return null
    }
  }

  private mapRowToAuditEntry(row: any): NotificationAuditEntry {
    return {
      id: row.id,
      userId: row.user_id,
      notificationType: row.notification_type,
      emailAddress: row.email_address,
      chessComUsername: row.chess_com_username,
      emailId: row.email_id,
      messageId: row.message_id,
      templateType: row.template_type,
      status: row.status,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      errorMessage: row.error_message,
      processingTime: row.processing_time,
      createdAt: row.created_at
    }
  }

  private getDateByPeriod(period: 'day' | 'week' | 'month'): string {
    const now = new Date()
    switch (period) {
      case 'day':
        now.setDate(now.getDate() - 1)
        break
      case 'week':
        now.setDate(now.getDate() - 7)
        break
      case 'month':
        now.setMonth(now.getMonth() - 1)
        break
    }
    return now.toISOString()
  }
}

// Export singleton instance factory
export function createNotificationAuditService(db: D1Database): NotificationAuditService {
  return new NotificationAuditService(db)
}