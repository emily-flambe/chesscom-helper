/**
 * Notification Audit Models
 * TypeScript interfaces and types for notification audit system
 */

// Notification Audit Entry Interface
export interface NotificationAuditEntry {
  id: string
  
  // User and notification identification
  userId: string
  notificationType: NotificationAuditType
  templateType?: EmailTemplateType
  
  // Event details
  eventTimestamp: string // ISO datetime
  eventSource: NotificationEventSource
  eventData?: string // JSON string of event-specific data
  
  // Email tracking
  emailQueueId?: string
  recipientEmail?: string
  resendMessageId?: string
  
  // Chess.com specific tracking
  chessComUsername?: string
  gameId?: string
  gameUrl?: string
  
  // Success/failure tracking
  success: boolean
  errorMessage?: string
  errorCode?: string
  
  // Performance metrics
  processingTimeMs?: number
  retryCount: number
  
  // Request tracking
  requestId?: string
  sessionId?: string
  userAgent?: string
  ipAddress?: string
  
  // Metadata
  metadata?: string // JSON string for additional context
  
  // Audit fields
  createdAt: string // ISO datetime
}

// Notification Audit Types
export type NotificationAuditType = 
  | 'email_queued'
  | 'email_sent'
  | 'email_failed'
  | 'email_delivered'
  | 'email_bounced'
  | 'email_complained'
  | 'email_opened'
  | 'email_clicked'
  | 'email_unsubscribed'
  | 'email_status_change'
  | 'template_rendered'
  | 'template_failed'
  | 'queue_processed'
  | 'batch_completed'
  | 'webhook_received'
  | 'user_preference_changed'
  | 'suppression_added'
  | 'suppression_removed'

// Email Template Types
export type EmailTemplateType = 
  | 'game_start'
  | 'game_end'
  | 'welcome'
  | 'digest'
  | 'custom'

// Event Source Types
export type NotificationEventSource = 
  | 'queue_service'
  | 'email_service'
  | 'template_service'
  | 'resend_webhook'
  | 'manual_action'
  | 'system_trigger'
  | 'batch_processor'
  | 'cleanup_job'
  | 'admin_panel'

// Notification Audit Create Input
export interface NotificationAuditCreateInput {
  userId: string
  notificationType: NotificationAuditType
  templateType?: EmailTemplateType
  eventSource: NotificationEventSource
  eventData?: Record<string, any>
  emailQueueId?: string
  recipientEmail?: string
  resendMessageId?: string
  chessComUsername?: string
  gameId?: string
  gameUrl?: string
  success: boolean
  errorMessage?: string
  errorCode?: string
  processingTimeMs?: number
  retryCount?: number
  requestId?: string
  sessionId?: string
  userAgent?: string
  ipAddress?: string
  metadata?: Record<string, any>
}

// Notification Audit Filter Options
export interface NotificationAuditFilterOptions {
  userId?: string
  notificationType?: NotificationAuditType | NotificationAuditType[]
  templateType?: EmailTemplateType | EmailTemplateType[]
  eventSource?: NotificationEventSource | NotificationEventSource[]
  success?: boolean
  emailQueueId?: string
  resendMessageId?: string
  chessComUsername?: string
  gameId?: string
  startDate?: string // ISO datetime
  endDate?: string // ISO datetime
  limit?: number
  offset?: number
  orderBy?: 'eventTimestamp' | 'createdAt'
  orderDirection?: 'ASC' | 'DESC'
}

// Email Delivery Event Interface
export interface EmailDeliveryEvent {
  id: string
  
  // Event identification
  resendMessageId: string
  eventType: EmailDeliveryEventType
  eventTimestamp: string // ISO datetime
  
  // Delivery details
  recipientEmail: string
  bounceType?: 'hard' | 'soft' | 'undetermined'
  bounceReason?: string
  complaintType?: 'abuse' | 'fraud' | 'virus' | 'other'
  
  // Webhook data
  webhookId?: string
  webhookTimestamp?: string
  webhookData?: string // Full webhook payload as JSON
  
  // Processing info
  processedAt: string // ISO datetime
  notificationAuditId?: string
  
  createdAt: string // ISO datetime
}

// Email Delivery Event Types
export type EmailDeliveryEventType = 
  | 'sent'
  | 'delivered'
  | 'delivery_delayed'
  | 'bounced'
  | 'complained'
  | 'opened'
  | 'clicked'

// Email Delivery Event Create Input
export interface EmailDeliveryEventCreateInput {
  resendMessageId: string
  eventType: EmailDeliveryEventType
  eventTimestamp: string
  recipientEmail: string
  bounceType?: 'hard' | 'soft' | 'undetermined'
  bounceReason?: string
  complaintType?: 'abuse' | 'fraud' | 'virus' | 'other'
  webhookId?: string
  webhookTimestamp?: string
  webhookData?: Record<string, any>
  notificationAuditId?: string
}

// Email Reputation Event Interface
export interface EmailReputationEvent {
  id: string
  
  // Event details
  eventType: EmailReputationEventType
  recipientEmail: string
  eventTimestamp: string // ISO datetime
  
  // Reputation impact
  reputationImpact: number // -10 to +10 scale
  reputationCategory: 'deliverability' | 'engagement' | 'complaints'
  
  // Associated data
  emailQueueId?: string
  resendMessageId?: string
  templateType?: EmailTemplateType
  
  // Metadata
  metadata?: string // JSON string for additional context
  
  createdAt: string // ISO datetime
}

// Email Reputation Event Types
export type EmailReputationEventType = 
  | 'bounce'
  | 'complaint'
  | 'unsubscribe'
  | 'delivered'
  | 'opened'
  | 'clicked'

// System Event Audit Interface
export interface SystemEventAudit {
  id: string
  
  // Event identification
  eventType: SystemEventType
  eventCategory: SystemEventCategory
  
  // Event details
  eventTimestamp: string // ISO datetime
  eventSource: string // Service or component that generated the event
  eventMessage: string
  
  // Associated data
  affectedRecords: number
  processingTimeMs?: number
  
  // Context
  userId?: string // Admin user if applicable
  requestId?: string
  metadata?: string // JSON string for additional context
  
  // Severity and status
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical'
  success: boolean
  errorDetails?: string
  
  createdAt: string // ISO datetime
}

// System Event Types
export type SystemEventType = 
  | 'queue_batch_processed'
  | 'cleanup_run'
  | 'admin_action'
  | 'system_error'
  | 'webhook_processed'
  | 'metrics_calculated'
  | 'backup_created'
  | 'migration_run'
  | 'health_check'
  | 'rate_limit_exceeded'

// System Event Categories
export type SystemEventCategory = 
  | 'email_system'
  | 'database'
  | 'external_api'
  | 'security'
  | 'performance'
  | 'maintenance'

// System Event Audit Create Input
export interface SystemEventAuditCreateInput {
  eventType: SystemEventType
  eventCategory: SystemEventCategory
  eventSource: string
  eventMessage: string
  affectedRecords?: number
  processingTimeMs?: number
  userId?: string
  requestId?: string
  metadata?: Record<string, any>
  severity?: 'debug' | 'info' | 'warning' | 'error' | 'critical'
  success?: boolean
  errorDetails?: string
}

// Audit Statistics Interface
export interface AuditStatistics {
  totalEvents: number
  successfulEvents: number
  failedEvents: number
  successRate: number
  averageProcessingTime: number
  eventsByType: Record<NotificationAuditType, number>
  eventsBySource: Record<NotificationEventSource, number>
  recentErrors: NotificationAuditEntry[]
}

// Audit Performance Metrics
export interface AuditPerformanceMetrics {
  templateType: EmailTemplateType
  totalNotifications: number
  successfulNotifications: number
  failedNotifications: number
  successRate: number
  averageProcessingTime: number
  bounceRate: number
  complaintRate: number
  openRate?: number
  clickRate?: number
  date: string
}

// User Audit Summary
export interface UserAuditSummary {
  userId: string
  totalNotifications: number
  emailsSent: number
  emailsDelivered: number
  emailsFailed: number
  emailsBounced: number
  emailsComplained: number
  successRate: number
  lastNotificationAt?: string
  reputationScore: number
  isSupressed: boolean
}

// Audit Event Data Schemas
export interface EmailQueuedEventData {
  templateType: EmailTemplateType
  priority: number
  scheduledAt: string
  templateData: Record<string, any>
}

export interface EmailSentEventData {
  resendMessageId: string
  processingTime: number
  retryCount: number
  batchId?: string
}

export interface EmailFailedEventData {
  errorCode: string
  errorMessage: string
  retryCount: number
  willRetry: boolean
  nextRetryAt?: string
}

export interface EmailDeliveredEventData {
  deliveryTime: number
  totalProcessingTime: number
}

export interface EmailBouncedEventData {
  bounceType: 'hard' | 'soft' | 'undetermined'
  bounceReason: string
  suppressionAdded: boolean
}

export interface EmailComplainedEventData {
  complaintType: 'abuse' | 'fraud' | 'virus' | 'other'
  suppressionAdded: boolean
}

export interface TemplateRenderedEventData {
  templateType: EmailTemplateType
  renderTime: number
  templateVariables: string[]
}

export interface WebhookReceivedEventData {
  webhookType: string
  processingTime: number
  eventCount: number
  validSignature: boolean
}

// Audit Query Builder Interface
export interface AuditQueryBuilder {
  forUser(userId: string): AuditQueryBuilder
  forNotificationType(type: NotificationAuditType): AuditQueryBuilder
  forTemplateType(type: EmailTemplateType): AuditQueryBuilder
  forEventSource(source: NotificationEventSource): AuditQueryBuilder
  withSuccess(success: boolean): AuditQueryBuilder
  withEmailQueue(emailQueueId: string): AuditQueryBuilder
  withResendMessage(messageId: string): AuditQueryBuilder
  withChessComUsername(username: string): AuditQueryBuilder
  withDateRange(startDate: string, endDate: string): AuditQueryBuilder
  withLimit(limit: number): AuditQueryBuilder
  withOffset(offset: number): AuditQueryBuilder
  orderBy(field: string, direction: 'ASC' | 'DESC'): AuditQueryBuilder
  build(): NotificationAuditFilterOptions
}

// Type guards for runtime validation
export function isNotificationAuditEntry(obj: any): obj is NotificationAuditEntry {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.userId === 'string' &&
    typeof obj.notificationType === 'string' &&
    typeof obj.eventTimestamp === 'string' &&
    typeof obj.eventSource === 'string' &&
    typeof obj.success === 'boolean' &&
    typeof obj.retryCount === 'number' &&
    typeof obj.createdAt === 'string'
  )
}

export function isValidNotificationAuditType(type: string): type is NotificationAuditType {
  const validTypes: NotificationAuditType[] = [
    'email_queued', 'email_sent', 'email_failed', 'email_delivered', 
    'email_bounced', 'email_complained', 'email_opened', 'email_clicked',
    'email_unsubscribed', 'email_status_change', 'template_rendered',
    'template_failed', 'queue_processed', 'batch_completed', 
    'webhook_received', 'user_preference_changed', 'suppression_added',
    'suppression_removed'
  ]
  return validTypes.includes(type as NotificationAuditType)
}

export function isValidEventSource(source: string): source is NotificationEventSource {
  const validSources: NotificationEventSource[] = [
    'queue_service', 'email_service', 'template_service', 'resend_webhook',
    'manual_action', 'system_trigger', 'batch_processor', 'cleanup_job',
    'admin_panel'
  ]
  return validSources.includes(source as NotificationEventSource)
}

export function isValidEmailTemplateType(type: string): type is EmailTemplateType {
  return ['game_start', 'game_end', 'welcome', 'digest', 'custom'].includes(type)
}

export function isValidDeliveryEventType(type: string): type is EmailDeliveryEventType {
  return ['sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'opened', 'clicked'].includes(type)
}

// Constants
export const NOTIFICATION_AUDIT_CONSTANTS = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 1000,
  DEFAULT_ORDER_BY: 'eventTimestamp',
  DEFAULT_ORDER_DIRECTION: 'DESC',
  
  RETENTION_PERIODS: {
    audit_entries: 90, // days
    delivery_events: 60, // days
    reputation_events: 365, // days
    system_events_info: 30, // days
    system_events_error: 365 // days
  },
  
  REPUTATION_IMPACT: {
    delivered: 1,
    opened: 2,
    clicked: 3,
    bounce_soft: -2,
    bounce_hard: -5,
    complaint: -10,
    unsubscribe: -1
  },
  
  SEVERITY_LEVELS: ['debug', 'info', 'warning', 'error', 'critical'] as const,
  
  BOUNCE_TYPES: ['hard', 'soft', 'undetermined'] as const,
  COMPLAINT_TYPES: ['abuse', 'fraud', 'virus', 'other'] as const,
  
  NOTIFICATION_TYPES: [
    'email_queued', 'email_sent', 'email_failed', 'email_delivered',
    'email_bounced', 'email_complained', 'email_opened', 'email_clicked',
    'email_unsubscribed', 'email_status_change', 'template_rendered',
    'template_failed', 'queue_processed', 'batch_completed',
    'webhook_received', 'user_preference_changed', 'suppression_added',
    'suppression_removed'
  ] as const,
  
  EVENT_SOURCES: [
    'queue_service', 'email_service', 'template_service', 'resend_webhook',
    'manual_action', 'system_trigger', 'batch_processor', 'cleanup_job',
    'admin_panel'
  ] as const,
  
  DELIVERY_EVENT_TYPES: [
    'sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'opened', 'clicked'
  ] as const
} as const

// Export type utilities
export type SeverityLevel = typeof NOTIFICATION_AUDIT_CONSTANTS.SEVERITY_LEVELS[number]
export type BounceType = typeof NOTIFICATION_AUDIT_CONSTANTS.BOUNCE_TYPES[number]
export type ComplaintType = typeof NOTIFICATION_AUDIT_CONSTANTS.COMPLAINT_TYPES[number]