/**
 * Email Queue Models
 * TypeScript interfaces and types for email queue system
 */

// Email Queue Item Interface
export interface EmailQueueItem {
  id: string
  userId: string
  recipientEmail: string
  templateType: 'game_start' | 'game_end' | 'welcome' | 'digest' | 'custom'
  templateData: string // JSON string of template data
  priority: 1 | 2 | 3 // 1=high, 2=medium, 3=low
  
  // Email content (rendered at queue time)
  subject: string
  htmlContent: string
  textContent: string
  
  // Queue processing fields
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
  retryCount: number
  maxRetries: number
  
  // Scheduling and timing
  scheduledAt: string // ISO datetime
  firstAttemptedAt?: string // ISO datetime
  lastAttemptedAt?: string // ISO datetime
  sentAt?: string // ISO datetime
  
  // Error tracking
  errorMessage?: string
  errorCode?: string
  
  // External service tracking
  resendMessageId?: string
  webhookReceivedAt?: string // ISO datetime
  
  // Audit fields
  createdAt: string // ISO datetime
  updatedAt: string // ISO datetime
}

// Email Queue Create Input
export interface EmailQueueCreateInput {
  userId: string
  recipientEmail: string
  templateType: 'game_start' | 'game_end' | 'welcome' | 'digest' | 'custom'
  templateData: Record<string, any>
  priority?: 1 | 2 | 3
  scheduledAt?: string // ISO datetime
  maxRetries?: number
}

// Email Queue Update Input
export interface EmailQueueUpdateInput {
  status?: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
  retryCount?: number
  errorMessage?: string
  errorCode?: string
  resendMessageId?: string
  webhookReceivedAt?: string
  firstAttemptedAt?: string
  lastAttemptedAt?: string
  sentAt?: string
}

// Email Queue Filter Options
export interface EmailQueueFilterOptions {
  userId?: string
  status?: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
  templateType?: 'game_start' | 'game_end' | 'welcome' | 'digest' | 'custom'
  priority?: 1 | 2 | 3
  scheduledBefore?: string // ISO datetime
  scheduledAfter?: string // ISO datetime
  limit?: number
  offset?: number
}

// Email Retry Schedule Interface
export interface EmailRetrySchedule {
  id: string
  emailQueueId: string
  retryNumber: number
  scheduledAt: string // ISO datetime
  attemptedAt?: string // ISO datetime
  success: boolean
  errorMessage?: string
  backoffSeconds: number
  createdAt: string // ISO datetime
  updatedAt: string // ISO datetime
}

// Email Retry Schedule Create Input
export interface EmailRetryScheduleCreateInput {
  emailQueueId: string
  retryNumber: number
  scheduledAt: string // ISO datetime
  backoffSeconds: number
}

// Email Batch Interface
export interface EmailBatch {
  id: string
  batchSize: number
  priority: 1 | 2 | 3
  status: 'pending' | 'processing' | 'completed' | 'failed'
  
  // Processing timing
  startedAt?: string // ISO datetime
  completedAt?: string // ISO datetime
  processingTimeMs?: number
  
  // Batch statistics
  emailsProcessed: number
  emailsSent: number
  emailsFailed: number
  
  // Error tracking
  errorMessage?: string
  
  createdAt: string // ISO datetime
  updatedAt: string // ISO datetime
}

// Email Batch Create Input
export interface EmailBatchCreateInput {
  batchSize: number
  priority: 1 | 2 | 3
  emailIds: string[]
}

// Email Batch Item Interface
export interface EmailBatchItem {
  batchId: string
  emailQueueId: string
  processingOrder: number
  createdAt: string // ISO datetime
}

// Email Queue Statistics
export interface EmailQueueStatistics {
  totalPending: number
  totalProcessing: number
  totalSent: number
  totalFailed: number
  totalCancelled: number
  averageProcessingTime: number
  averageRetryCount: number
  oldestPendingAge: number // seconds
  successRate: number // percentage
}

// Email Queue Performance Metrics
export interface EmailQueuePerformanceMetrics {
  templateType: string
  totalEmails: number
  successfulEmails: number
  failedEmails: number
  successRate: number
  averageProcessingTime: number
  averageRetryCount: number
  date: string
}

// Email Processing Result
export interface EmailProcessingResult {
  emailId: string
  success: boolean
  processingTime: number
  errorMessage?: string
  errorCode?: string
  resendMessageId?: string
  retryScheduled?: boolean
  nextRetryAt?: string
}

// Email Batch Processing Result
export interface EmailBatchProcessingResult {
  batchId: string
  success: boolean
  processingTime: number
  emailsProcessed: number
  emailsSent: number
  emailsFailed: number
  results: EmailProcessingResult[]
  errorMessage?: string
}

// Email Queue Health Status
export interface EmailQueueHealthStatus {
  isHealthy: boolean
  queueSize: number
  processingRate: number // emails per hour
  errorRate: number // percentage
  averageWaitTime: number // seconds
  oldestItemAge: number // seconds
  issues: string[]
  lastHealthCheck: string // ISO datetime
}

// Email Template Data Interface (for queue processing)
export interface EmailTemplateData {
  // Common fields
  userEmail: string
  baseUrl: string
  unsubscribeUrl: string
  preferencesUrl: string
  
  // Game-specific fields
  playerName?: string
  opponentName?: string
  opponentRating?: string
  opponentTitle?: string
  gameType?: string
  gameId?: string
  gameUrl?: string
  gameStartTime?: string
  gameEndTime?: string
  playerColor?: string
  timeControl?: string
  result?: string
  
  // Additional context
  [key: string]: any
}

// Email Priority Configuration
export interface EmailPriorityConfig {
  high: {
    priority: 1
    maxRetries: 5
    backoffBase: 60 // seconds
    maxBackoff: 3600 // seconds
    processingOrder: 1
  }
  medium: {
    priority: 2
    maxRetries: 3
    backoffBase: 120 // seconds
    maxBackoff: 7200 // seconds
    processingOrder: 2
  }
  low: {
    priority: 3
    maxRetries: 2
    backoffBase: 300 // seconds
    maxBackoff: 14400 // seconds
    processingOrder: 3
  }
}

// Email Queue Service Configuration
export interface EmailQueueServiceConfig {
  batchSize: number
  processingInterval: number // milliseconds
  maxConcurrentBatches: number
  retryBackoffMultiplier: number
  maxRetryBackoff: number // seconds
  cleanupInterval: number // milliseconds
  retentionPeriod: number // days
  healthCheckInterval: number // milliseconds
  priorityConfigs: EmailPriorityConfig
}

// Email Queue Events
export type EmailQueueEvent = 
  | 'email_queued'
  | 'email_processing_started'
  | 'email_sent'
  | 'email_failed'
  | 'email_retry_scheduled'
  | 'email_cancelled'
  | 'batch_started'
  | 'batch_completed'
  | 'batch_failed'

// Email Queue Event Handler
export interface EmailQueueEventHandler {
  (event: EmailQueueEvent, data: any): void | Promise<void>
}

// Email Queue Event Subscription
export interface EmailQueueEventSubscription {
  id: string
  event: EmailQueueEvent
  handler: EmailQueueEventHandler
  active: boolean
  createdAt: string
}

// Utility types for database operations
export type EmailQueueRecord = Omit<EmailQueueItem, 'templateData'> & {
  templateData: string // JSON string in database
}

export type EmailQueueInsertData = Omit<EmailQueueItem, 'id' | 'createdAt' | 'updatedAt'>

export type EmailQueueUpdateData = Partial<Omit<EmailQueueItem, 'id' | 'createdAt'>>

// Type guards for runtime validation
export function isEmailQueueItem(obj: any): obj is EmailQueueItem {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.userId === 'string' &&
    typeof obj.recipientEmail === 'string' &&
    typeof obj.templateType === 'string' &&
    typeof obj.templateData === 'string' &&
    typeof obj.priority === 'number' &&
    typeof obj.status === 'string' &&
    typeof obj.retryCount === 'number' &&
    typeof obj.maxRetries === 'number' &&
    typeof obj.scheduledAt === 'string' &&
    typeof obj.subject === 'string' &&
    typeof obj.htmlContent === 'string' &&
    typeof obj.textContent === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string'
  )
}

export function isValidEmailQueueStatus(status: string): status is EmailQueueItem['status'] {
  return ['pending', 'processing', 'sent', 'failed', 'cancelled'].includes(status)
}

export function isValidEmailTemplateType(type: string): type is EmailQueueItem['templateType'] {
  return ['game_start', 'game_end', 'welcome', 'digest', 'custom'].includes(type)
}

export function isValidEmailPriority(priority: number): priority is EmailQueueItem['priority'] {
  return [1, 2, 3].includes(priority)
}

// Constants
export const EMAIL_QUEUE_CONSTANTS = {
  DEFAULT_BATCH_SIZE: 10,
  DEFAULT_PROCESSING_INTERVAL: 5000, // 5 seconds
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_PRIORITY: 3,
  DEFAULT_BACKOFF_BASE: 60, // 1 minute
  DEFAULT_MAX_BACKOFF: 3600, // 1 hour
  DEFAULT_RETENTION_PERIOD: 30, // 30 days
  
  PRIORITY_WEIGHTS: {
    1: 10, // High priority
    2: 5,  // Medium priority
    3: 1   // Low priority
  },
  
  STATUS_FINAL: ['sent', 'cancelled'] as const,
  STATUS_RETRY: ['failed'] as const,
  STATUS_PROCESSING: ['pending', 'processing'] as const,
  
  TEMPLATE_TYPES: ['game_start', 'game_end', 'welcome', 'digest', 'custom'] as const,
  PRIORITIES: [1, 2, 3] as const,
  STATUSES: ['pending', 'processing', 'sent', 'failed', 'cancelled'] as const
} as const

// Export type utilities
export type EmailQueueStatus = typeof EMAIL_QUEUE_CONSTANTS.STATUSES[number]
export type EmailTemplateType = typeof EMAIL_QUEUE_CONSTANTS.TEMPLATE_TYPES[number]
export type EmailPriority = typeof EMAIL_QUEUE_CONSTANTS.PRIORITIES[number]