/**
 * Email Retry Policy Models
 * TypeScript interfaces and types for email retry policies and failure classification
 */

// Email failure classification types
export type EmailFailureType = 
  | 'temporary'        // Temporary failure, should retry
  | 'permanent'        // Permanent failure, do not retry
  | 'rate_limit'       // Rate limit exceeded, retry with longer delay
  | 'invalid_email'    // Invalid email address, do not retry
  | 'bounced_hard'     // Hard bounce, do not retry
  | 'bounced_soft'     // Soft bounce, retry with caution
  | 'spam_complaint'   // Spam complaint, do not retry
  | 'network_error'    // Network/connectivity issue, retry
  | 'service_unavailable' // Service temporarily unavailable, retry
  | 'auth_failure'     // Authentication failure, do not retry
  | 'quota_exceeded'   // Quota exceeded, retry after longer delay
  | 'unknown'          // Unknown failure, retry with caution

// Email retry policy interface
export interface EmailRetryPolicy {
  id: string
  name: string
  description: string
  
  // Retry configuration
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  useJitter: boolean
  
  // Failure type handling
  retryableFailures: EmailFailureType[]
  nonRetryableFailures: EmailFailureType[]
  
  // Priority-specific overrides
  priorityOverrides: {
    [key in EmailPriority]?: Partial<EmailRetryPolicy>
  }
  
  // Rate limiting
  rateLimitBackoffMs: number
  rateLimitMaxBackoffMs: number
  
  // Dead letter queue threshold
  deadLetterThreshold: number
  
  // Metadata
  createdAt: string
  updatedAt: string
  isActive: boolean
}

// Email priority levels
export type EmailPriority = 'high' | 'medium' | 'low'

// Email retry attempt interface
export interface EmailRetryAttempt {
  id: string
  emailQueueId: string
  attemptNumber: number
  attemptedAt: string
  
  // Failure details
  failureType: EmailFailureType
  failureReason: string
  errorCode?: string
  errorMessage?: string
  
  // HTTP response details
  httpStatus?: number
  responseHeaders?: Record<string, string>
  responseBody?: string
  
  // Retry decision
  willRetry: boolean
  nextRetryAt?: string
  backoffDelayMs?: number
  
  // Policy applied
  policyId: string
  policyName: string
  
  // External service details
  serviceProvider: string
  serviceMessageId?: string
  
  createdAt: string
}

// Email retry statistics interface
export interface EmailRetryStatistics {
  totalAttempts: number
  successfulAttempts: number
  failedAttempts: number
  retriedAttempts: number
  
  // Failure breakdown
  failuresByType: Record<EmailFailureType, number>
  
  // Retry metrics
  averageRetryCount: number
  maxRetryCount: number
  successRateAfterRetry: number
  
  // Timing metrics
  averageBackoffDelay: number
  totalProcessingTime: number
  
  // Period statistics
  periodStart: string
  periodEnd: string
  
  // Policy effectiveness
  policyId: string
  policyName: string
  recommendedAdjustments?: string[]
}

// Email suppression entry
export interface EmailSuppressionEntry {
  id: string
  recipientEmail: string
  suppressionReason: EmailSuppressionReason
  
  // Suppression details
  suppressedAt: string
  suppressedUntil?: string // For temporary suppressions
  isPermanent: boolean
  
  // Source of suppression
  sourceType: EmailSuppressionSource
  sourceId?: string // ID of the email/event that caused suppression
  
  // Context
  failureCount: number
  lastFailureAt: string
  lastFailureType: EmailFailureType
  
  // Metadata
  metadata?: Record<string, any>
  
  createdAt: string
  updatedAt: string
}

// Email suppression reason types
export type EmailSuppressionReason = 
  | 'hard_bounce'
  | 'soft_bounce_limit'
  | 'spam_complaint'
  | 'unsubscribe'
  | 'invalid_email'
  | 'reputation_risk'
  | 'manual_suppression'
  | 'compliance_requirement'

// Email suppression source types
export type EmailSuppressionSource = 
  | 'bounce_handler'
  | 'complaint_handler'
  | 'unsubscribe_handler'
  | 'manual_action'
  | 'automated_rule'
  | 'reputation_monitor'
  | 'compliance_system'

// Email retry configuration templates
export const EMAIL_RETRY_POLICIES: Record<string, Omit<EmailRetryPolicy, 'id' | 'createdAt' | 'updatedAt'>> = {
  // Standard retry policy for most emails
  standard: {
    name: 'Standard Retry Policy',
    description: 'Default retry policy for email delivery',
    maxRetries: 3,
    baseDelayMs: 60000,        // 1 minute
    maxDelayMs: 3600000,       // 1 hour
    backoffMultiplier: 2,
    useJitter: true,
    retryableFailures: [
      'temporary',
      'rate_limit',
      'bounced_soft',
      'network_error',
      'service_unavailable',
      'quota_exceeded'
    ],
    nonRetryableFailures: [
      'permanent',
      'invalid_email',
      'bounced_hard',
      'spam_complaint',
      'auth_failure'
    ],
    priorityOverrides: {
      high: {
        maxRetries: 5,
        baseDelayMs: 30000,    // 30 seconds
        maxDelayMs: 1800000    // 30 minutes
      },
      low: {
        maxRetries: 2,
        baseDelayMs: 300000,   // 5 minutes
        maxDelayMs: 7200000    // 2 hours
      }
    },
    rateLimitBackoffMs: 300000,     // 5 minutes
    rateLimitMaxBackoffMs: 3600000, // 1 hour
    deadLetterThreshold: 5,
    isActive: true
  },
  
  // Aggressive retry policy for high-priority emails
  aggressive: {
    name: 'Aggressive Retry Policy',
    description: 'Aggressive retry policy for critical emails',
    maxRetries: 7,
    baseDelayMs: 30000,        // 30 seconds
    maxDelayMs: 1800000,       // 30 minutes
    backoffMultiplier: 1.5,
    useJitter: true,
    retryableFailures: [
      'temporary',
      'rate_limit',
      'bounced_soft',
      'network_error',
      'service_unavailable',
      'quota_exceeded',
      'unknown'
    ],
    nonRetryableFailures: [
      'permanent',
      'invalid_email',
      'bounced_hard',
      'spam_complaint',
      'auth_failure'
    ],
    priorityOverrides: {},
    rateLimitBackoffMs: 120000,     // 2 minutes
    rateLimitMaxBackoffMs: 1800000, // 30 minutes
    deadLetterThreshold: 10,
    isActive: true
  },
  
  // Conservative retry policy for low-priority emails
  conservative: {
    name: 'Conservative Retry Policy',
    description: 'Conservative retry policy for low-priority emails',
    maxRetries: 2,
    baseDelayMs: 300000,       // 5 minutes
    maxDelayMs: 7200000,       // 2 hours
    backoffMultiplier: 2,
    useJitter: true,
    retryableFailures: [
      'temporary',
      'network_error',
      'service_unavailable'
    ],
    nonRetryableFailures: [
      'permanent',
      'invalid_email',
      'bounced_hard',
      'bounced_soft',
      'spam_complaint',
      'auth_failure',
      'rate_limit',
      'quota_exceeded'
    ],
    priorityOverrides: {},
    rateLimitBackoffMs: 1800000,    // 30 minutes
    rateLimitMaxBackoffMs: 7200000, // 2 hours
    deadLetterThreshold: 3,
    isActive: true
  }
}

// Email failure classification configuration
export interface EmailFailureClassificationConfig {
  // HTTP status code mappings
  httpStatusMappings: Record<number, EmailFailureType>
  
  // Error message patterns
  errorPatterns: Array<{
    pattern: RegExp
    failureType: EmailFailureType
    description: string
  }>
  
  // Service-specific error codes
  serviceErrorCodes: Record<string, Record<string, EmailFailureType>>
  
  // Default classification
  defaultFailureType: EmailFailureType
}

// Default failure classification configuration
export const DEFAULT_FAILURE_CLASSIFICATION: EmailFailureClassificationConfig = {
  httpStatusMappings: {
    // 4xx Client errors
    400: 'invalid_email',
    401: 'auth_failure',
    403: 'auth_failure',
    404: 'invalid_email',
    429: 'rate_limit',
    
    // 5xx Server errors
    500: 'temporary',
    502: 'temporary',
    503: 'service_unavailable',
    504: 'temporary',
    
    // Network errors
    0: 'network_error'
  },
  
  errorPatterns: [
    {
      pattern: /rate limit|too many requests/i,
      failureType: 'rate_limit',
      description: 'Rate limit exceeded'
    },
    {
      pattern: /invalid email|invalid recipient/i,
      failureType: 'invalid_email',
      description: 'Invalid email address'
    },
    {
      pattern: /bounce|bounced/i,
      failureType: 'bounced_soft',
      description: 'Email bounced'
    },
    {
      pattern: /spam|complaint/i,
      failureType: 'spam_complaint',
      description: 'Spam complaint'
    },
    {
      pattern: /quota exceeded|limit exceeded/i,
      failureType: 'quota_exceeded',
      description: 'Quota exceeded'
    },
    {
      pattern: /network error|connection|timeout/i,
      failureType: 'network_error',
      description: 'Network connectivity issue'
    },
    {
      pattern: /service unavailable|temporarily unavailable/i,
      failureType: 'service_unavailable',
      description: 'Service temporarily unavailable'
    },
    {
      pattern: /authentication|authorization|unauthorized/i,
      failureType: 'auth_failure',
      description: 'Authentication failure'
    }
  ],
  
  // Resend-specific error codes
  serviceErrorCodes: {
    resend: {
      'invalid_email': 'invalid_email',
      'rate_limited': 'rate_limit',
      'quota_exceeded': 'quota_exceeded',
      'bounced': 'bounced_soft',
      'complained': 'spam_complaint',
      'unsubscribed': 'permanent',
      'blocked': 'permanent',
      'invalid_domain': 'invalid_email',
      'no_mx_record': 'invalid_email',
      'mailbox_full': 'bounced_soft',
      'mailbox_not_found': 'bounced_hard',
      'spam_detected': 'spam_complaint',
      'virus_detected': 'permanent',
      'policy_violation': 'permanent',
      'content_rejected': 'permanent',
      'size_limit_exceeded': 'permanent',
      'timeout': 'temporary',
      'connection_error': 'network_error',
      'server_error': 'temporary',
      'unknown_error': 'unknown'
    }
  },
  
  defaultFailureType: 'temporary'
}

// Email retry policy decision interface
export interface EmailRetryDecision {
  shouldRetry: boolean
  failureType: EmailFailureType
  nextRetryAt?: string
  backoffDelayMs?: number
  reason: string
  policyApplied: string
  recommendedAction: string
  
  // Suppression recommendation
  shouldSuppress: boolean
  suppressionReason?: EmailSuppressionReason
  suppressionDuration?: number // in milliseconds, undefined for permanent
  
  // Dead letter recommendation
  shouldMoveToDeadLetter: boolean
  deadLetterReason?: string
}

// Email retry context interface
export interface EmailRetryContext {
  emailQueueId: string
  recipientEmail: string
  templateType: string
  priority: EmailPriority
  currentRetryCount: number
  previousAttempts: EmailRetryAttempt[]
  
  // Failure information
  latestFailure: {
    errorMessage: string
    errorCode?: string
    httpStatus?: number
    responseBody?: string
    occurredAt: string
  }
  
  // Recipient history
  recipientHistory: {
    totalFailures: number
    recentFailures: number
    lastSuccessAt?: string
    suppressionStatus?: EmailSuppressionEntry
  }
  
  // Service context
  serviceProvider: string
  serviceMessageId?: string
  
  // Policy context
  policyId: string
  customRules?: Record<string, any>
}

// Type guards and validation functions
export function isRetryableFailure(failureType: EmailFailureType): boolean {
  const retryableTypes: EmailFailureType[] = [
    'temporary',
    'rate_limit',
    'bounced_soft',
    'network_error',
    'service_unavailable',
    'quota_exceeded'
  ]
  return retryableTypes.includes(failureType)
}

export function isPermanentFailure(failureType: EmailFailureType): boolean {
  const permanentTypes: EmailFailureType[] = [
    'permanent',
    'invalid_email',
    'bounced_hard',
    'spam_complaint',
    'auth_failure'
  ]
  return permanentTypes.includes(failureType)
}

export function shouldSuppressRecipient(failureType: EmailFailureType): boolean {
  const suppressionTypes: EmailFailureType[] = [
    'bounced_hard',
    'spam_complaint',
    'invalid_email'
  ]
  return suppressionTypes.includes(failureType)
}

export function isValidEmailFailureType(type: string): type is EmailFailureType {
  const validTypes: EmailFailureType[] = [
    'temporary', 'permanent', 'rate_limit', 'invalid_email',
    'bounced_hard', 'bounced_soft', 'spam_complaint', 'network_error',
    'service_unavailable', 'auth_failure', 'quota_exceeded', 'unknown'
  ]
  return validTypes.includes(type as EmailFailureType)
}

export function isValidEmailPriority(priority: string): priority is EmailPriority {
  return ['high', 'medium', 'low'].includes(priority)
}

export function isValidSuppressionReason(reason: string): reason is EmailSuppressionReason {
  const validReasons: EmailSuppressionReason[] = [
    'hard_bounce', 'soft_bounce_limit', 'spam_complaint', 'unsubscribe',
    'invalid_email', 'reputation_risk', 'manual_suppression', 'compliance_requirement'
  ]
  return validReasons.includes(reason as EmailSuppressionReason)
}

// Constants for retry policies
export const EMAIL_RETRY_CONSTANTS = {
  // Default retry limits
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_BASE_DELAY: 60000,     // 1 minute
  DEFAULT_MAX_DELAY: 3600000,    // 1 hour
  DEFAULT_BACKOFF_MULTIPLIER: 2,
  
  // Rate limiting
  DEFAULT_RATE_LIMIT_BACKOFF: 300000,     // 5 minutes
  DEFAULT_RATE_LIMIT_MAX_BACKOFF: 3600000, // 1 hour
  
  // Dead letter queue
  DEFAULT_DEAD_LETTER_THRESHOLD: 5,
  
  // Suppression
  DEFAULT_SOFT_BOUNCE_LIMIT: 5,
  DEFAULT_SUPPRESSION_DURATION: 86400000, // 24 hours
  
  // Retry scenarios
  RETRY_SCENARIOS: {
    NETWORK_ISSUE: 'network_error',
    RATE_LIMITED: 'rate_limit',
    SERVICE_DOWN: 'service_unavailable',
    TEMPORARY_FAILURE: 'temporary',
    QUOTA_EXCEEDED: 'quota_exceeded'
  },
  
  // Non-retry scenarios
  NON_RETRY_SCENARIOS: {
    INVALID_EMAIL: 'invalid_email',
    HARD_BOUNCE: 'bounced_hard',
    SPAM_COMPLAINT: 'spam_complaint',
    AUTH_FAILURE: 'auth_failure',
    PERMANENT_FAILURE: 'permanent'
  }
} as const

// Export type utilities
export type RetryScenario = keyof typeof EMAIL_RETRY_CONSTANTS.RETRY_SCENARIOS
export type NonRetryScenario = keyof typeof EMAIL_RETRY_CONSTANTS.NON_RETRY_SCENARIOS