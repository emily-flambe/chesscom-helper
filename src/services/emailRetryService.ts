/**
 * Email Retry Service
 * Handles exponential backoff retry logic and failure classification for email delivery
 */

import { generateSecureId } from '../utils/crypto'
import { createApiError } from '../middleware/errorHandler'
import { 
  calculateBackoffDelay, 
  calculateNextRetryTime, 
  shouldRetryNow, 
  getEmailBackoffConfig,
  BackoffOptions 
} from '../utils/exponentialBackoff'
import type {
  EmailFailureType,
  EmailRetryPolicy,
  EmailRetryAttempt,
  EmailRetryDecision,
  EmailRetryContext,
  EmailSuppressionEntry,
  EmailSuppressionReason,
  EmailPriority,
  EmailFailureClassificationConfig,
  DEFAULT_FAILURE_CLASSIFICATION,
  EMAIL_RETRY_POLICIES
} from '../models/emailRetryPolicy'

export interface EmailRetryServiceConfig {
  defaultPolicyId: string
  maxRetryAttempts: number
  enableSuppressionList: boolean
  enableDeadLetterQueue: boolean
  
  // Classification settings
  classificationConfig: EmailFailureClassificationConfig
  
  // Monitoring settings
  enableRetryMetrics: boolean
  enableFailureAnalytics: boolean
  
  // Database settings
  retryHistoryRetentionDays: number
  suppressionListRetentionDays: number
}

export interface EmailRetryServiceDependencies {
  db: D1Database
  auditService?: EmailAuditService
  metricsService?: EmailMetricsService
}

export interface EmailAuditService {
  logRetryAttempt(attempt: EmailRetryAttempt): Promise<void>
  logSuppressionEvent(event: EmailSuppressionEvent): Promise<void>
  logRetryDecision(decision: EmailRetryDecision, context: EmailRetryContext): Promise<void>
}

export interface EmailMetricsService {
  recordRetryAttempt(attempt: EmailRetryAttempt): Promise<void>
  recordFailureClassification(failureType: EmailFailureType, context: EmailRetryContext): Promise<void>
  recordSuppressionEvent(event: EmailSuppressionEvent): Promise<void>
}

export interface EmailSuppressionEvent {
  id: string
  recipientEmail: string
  suppressionReason: EmailSuppressionReason
  sourceEmailId: string
  sourceFailureType: EmailFailureType
  createdAt: string
  metadata?: Record<string, any>
}

/**
 * EmailRetryService - Professional email retry and failure management service
 * 
 * Features:
 * - Exponential backoff with jitter
 * - Intelligent failure classification
 * - Suppression list management
 * - Dead letter queue handling
 * - Comprehensive retry policies
 * - Audit logging and metrics
 */
export class EmailRetryService {
  private config: EmailRetryServiceConfig
  private dependencies: EmailRetryServiceDependencies
  private retryPolicies: Map<string, EmailRetryPolicy> = new Map()
  private suppressionCache: Map<string, EmailSuppressionEntry> = new Map()
  
  constructor(config: EmailRetryServiceConfig, dependencies: EmailRetryServiceDependencies) {
    this.config = config
    this.dependencies = dependencies
    
    // Initialize retry policies
    this.initializeRetryPolicies()
  }
  
  /**
   * Initialize retry policies from configuration
   */
  private async initializeRetryPolicies(): Promise<void> {
    try {
      // Load policies from database
      const policies = await this.loadRetryPoliciesFromDatabase()
      
      // If no policies exist, create default ones
      if (policies.length === 0) {
        await this.createDefaultPolicies()
      }
      
      // Load into memory cache
      policies.forEach(policy => {
        this.retryPolicies.set(policy.id, policy)
      })
      
      console.log(`Initialized ${policies.length} retry policies`)
    } catch (error) {
      console.error('Failed to initialize retry policies:', error)
      throw createApiError('Failed to initialize retry service', 500, 'RETRY_SERVICE_INIT_FAILED', error)
    }
  }
  
  /**
   * Determine if an email should be retried and calculate backoff
   */
  async shouldRetry(context: EmailRetryContext): Promise<EmailRetryDecision> {
    try {
      // Check if recipient is suppressed
      const suppressionEntry = await this.getSuppressionEntry(context.recipientEmail)
      if (suppressionEntry) {
        return {
          shouldRetry: false,
          failureType: 'permanent',
          reason: `Recipient is suppressed: ${suppressionEntry.suppressionReason}`,
          policyApplied: 'suppression_list',
          recommendedAction: 'Remove from queue',
          shouldSuppress: true,
          suppressionReason: suppressionEntry.suppressionReason,
          shouldMoveToDeadLetter: false
        }
      }
      
      // Classify the failure
      const failureType = this.classifyFailure(context.latestFailure)
      
      // Get retry policy
      const policy = await this.getRetryPolicy(context.policyId)
      
      // Apply priority-specific overrides
      const effectivePolicy = this.applyPriorityOverrides(policy, context.priority)
      
      // Check if failure type is retryable
      if (effectivePolicy.nonRetryableFailures.includes(failureType)) {
        const suppressionRecommendation = this.getSuppres sionRecommendation(failureType)
        
        return {
          shouldRetry: false,
          failureType,
          reason: `Failure type '${failureType}' is non-retryable`,
          policyApplied: policy.name,
          recommendedAction: suppressionRecommendation.shouldSuppress ? 'Suppress recipient' : 'Move to dead letter queue',
          shouldSuppress: suppressionRecommendation.shouldSuppress,
          suppressionReason: suppressionRecommendation.reason,
          shouldMoveToDeadLetter: !suppressionRecommendation.shouldSuppress
        }
      }
      
      // Check retry limit
      if (context.currentRetryCount >= effectivePolicy.maxRetries) {
        return {
          shouldRetry: false,
          failureType,
          reason: `Maximum retry attempts (${effectivePolicy.maxRetries}) exceeded`,
          policyApplied: policy.name,
          recommendedAction: 'Move to dead letter queue',
          shouldSuppress: false,
          shouldMoveToDeadLetter: true,
          deadLetterReason: 'Maximum retry attempts exceeded'
        }
      }
      
      // Check dead letter threshold
      if (context.recipientHistory.totalFailures >= effectivePolicy.deadLetterThreshold) {
        return {
          shouldRetry: false,
          failureType,
          reason: `Dead letter threshold (${effectivePolicy.deadLetterThreshold}) exceeded`,
          policyApplied: policy.name,
          recommendedAction: 'Move to dead letter queue',
          shouldSuppress: false,
          shouldMoveToDeadLetter: true,
          deadLetterReason: 'Dead letter threshold exceeded'
        }
      }
      
      // Calculate backoff delay
      const backoffConfig = this.getBackoffConfig(effectivePolicy, failureType)
      const backoffResult = calculateBackoffDelay(context.currentRetryCount, backoffConfig)
      
      if (!backoffResult.shouldRetry) {
        return {
          shouldRetry: false,
          failureType,
          reason: 'Backoff algorithm determined not to retry',
          policyApplied: policy.name,
          recommendedAction: 'Move to dead letter queue',
          shouldSuppress: false,
          shouldMoveToDeadLetter: true,
          deadLetterReason: 'Backoff limit reached'
        }
      }
      
      // Calculate next retry time
      const nextRetryAt = calculateNextRetryTime(context.currentRetryCount, backoffConfig)
      
      // Log retry decision
      if (this.dependencies.auditService) {
        const decision: EmailRetryDecision = {
          shouldRetry: true,
          failureType,
          nextRetryAt: nextRetryAt || undefined,
          backoffDelayMs: backoffResult.delay,
          reason: `Retrying with ${backoffResult.delay}ms backoff`,
          policyApplied: policy.name,
          recommendedAction: 'Schedule retry',
          shouldSuppress: false,
          shouldMoveToDeadLetter: false
        }
        
        await this.dependencies.auditService.logRetryDecision(decision, context)
      }
      
      return {
        shouldRetry: true,
        failureType,
        nextRetryAt: nextRetryAt || undefined,
        backoffDelayMs: backoffResult.delay,
        reason: `Retrying with ${backoffResult.delay}ms backoff`,
        policyApplied: policy.name,
        recommendedAction: 'Schedule retry',
        shouldSuppress: false,
        shouldMoveToDeadLetter: false
      }
      
    } catch (error) {
      console.error('Error determining retry decision:', error)
      
      // Default to not retrying on service errors
      return {
        shouldRetry: false,
        failureType: 'unknown',
        reason: `Service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        policyApplied: 'error_fallback',
        recommendedAction: 'Manual review required',
        shouldSuppress: false,
        shouldMoveToDeadLetter: true,
        deadLetterReason: 'Service error during retry decision'
      }
    }
  }
  
  /**
   * Calculate exponential backoff delay with jitter
   */
  calculateBackoffDelay(retryCount: number, priority: EmailPriority = 'medium'): number {
    const backoffConfig = getEmailBackoffConfig(priority)
    const result = calculateBackoffDelay(retryCount, backoffConfig)
    return result.delay
  }
  
  /**
   * Classify failure based on error details
   */
  classifyFailure(failure: EmailRetryContext['latestFailure']): EmailFailureType {
    const config = this.config.classificationConfig
    
    // Check HTTP status code first
    if (failure.httpStatus && config.httpStatusMappings[failure.httpStatus]) {
      return config.httpStatusMappings[failure.httpStatus]
    }
    
    // Check error message patterns
    for (const pattern of config.errorPatterns) {
      if (pattern.pattern.test(failure.errorMessage)) {
        return pattern.failureType
      }
    }
    
    // Check service-specific error codes
    if (failure.errorCode) {
      for (const [service, errorCodes] of Object.entries(config.serviceErrorCodes)) {
        if (errorCodes[failure.errorCode]) {
          return errorCodes[failure.errorCode]
        }
      }
    }
    
    // Default classification
    return config.defaultFailureType
  }
  
  /**
   * Record retry attempt for auditing and metrics
   */
  async recordRetryAttempt(
    emailQueueId: string,
    attemptNumber: number,
    failureType: EmailFailureType,
    errorDetails: {
      errorMessage: string
      errorCode?: string
      httpStatus?: number
      responseBody?: string
    },
    retryDecision: EmailRetryDecision
  ): Promise<EmailRetryAttempt> {
    const attempt: EmailRetryAttempt = {
      id: await generateSecureId(),
      emailQueueId,
      attemptNumber,
      attemptedAt: new Date().toISOString(),
      failureType,
      failureReason: errorDetails.errorMessage,
      errorCode: errorDetails.errorCode,
      errorMessage: errorDetails.errorMessage,
      httpStatus: errorDetails.httpStatus,
      responseBody: errorDetails.responseBody,
      willRetry: retryDecision.shouldRetry,
      nextRetryAt: retryDecision.nextRetryAt,
      backoffDelayMs: retryDecision.backoffDelayMs,
      policyId: 'default', // Would be determined from context
      policyName: retryDecision.policyApplied,
      serviceProvider: 'resend', // Would be determined from context
      createdAt: new Date().toISOString()
    }
    
    try {
      // Store in database
      await this.saveRetryAttempt(attempt)
      
      // Log to audit service
      if (this.dependencies.auditService) {
        await this.dependencies.auditService.logRetryAttempt(attempt)
      }
      
      // Record metrics
      if (this.dependencies.metricsService) {
        await this.dependencies.metricsService.recordRetryAttempt(attempt)
      }
      
      return attempt
      
    } catch (error) {
      console.error('Failed to record retry attempt:', error)
      // Don't throw error - this is for logging purposes
      return attempt
    }
  }
  
  /**
   * Add email to suppression list
   */
  async addToSuppressionList(
    recipientEmail: string,
    reason: EmailSuppressionReason,
    sourceEmailId: string,
    failureType: EmailFailureType,
    permanent: boolean = false,
    duration?: number
  ): Promise<EmailSuppressionEntry> {
    const entry: EmailSuppressionEntry = {
      id: await generateSecureId(),
      recipientEmail,
      suppressionReason: reason,
      suppressedAt: new Date().toISOString(),
      suppressedUntil: permanent ? undefined : new Date(Date.now() + (duration || 86400000)).toISOString(),
      isPermanent: permanent,
      sourceType: 'bounce_handler',
      sourceId: sourceEmailId,
      failureCount: 1,
      lastFailureAt: new Date().toISOString(),
      lastFailureType: failureType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    try {
      // Save to database
      await this.saveSuppressionEntry(entry)
      
      // Update cache
      this.suppressionCache.set(recipientEmail, entry)
      
      // Log event
      if (this.dependencies.auditService) {
        const event: EmailSuppressionEvent = {
          id: await generateSecureId(),
          recipientEmail,
          suppressionReason: reason,
          sourceEmailId,
          sourceFailureType: failureType,
          createdAt: new Date().toISOString()
        }
        await this.dependencies.auditService.logSuppressionEvent(event)
      }
      
      return entry
      
    } catch (error) {
      console.error('Failed to add to suppression list:', error)
      throw createApiError(
        'Failed to add to suppression list',
        500,
        'SUPPRESSION_ADD_FAILED',
        error
      )
    }
  }
  
  /**
   * Check if recipient is suppressed
   */
  async isRecipientSuppressed(recipientEmail: string): Promise<boolean> {
    const entry = await this.getSuppressionEntry(recipientEmail)
    return entry !== null
  }
  
  /**
   * Get suppression entry for recipient
   */
  async getSuppressionEntry(recipientEmail: string): Promise<EmailSuppressionEntry | null> {
    try {
      // Check cache first
      const cached = this.suppressionCache.get(recipientEmail)
      if (cached) {
        // Check if suppression has expired
        if (!cached.isPermanent && cached.suppressedUntil && new Date(cached.suppressedUntil) < new Date()) {
          await this.removeFromSuppressionList(recipientEmail)
          return null
        }
        return cached
      }
      
      // Query database
      const result = await this.dependencies.db.prepare(`
        SELECT * FROM email_suppression_list 
        WHERE recipient_email = ? AND (is_permanent = 1 OR suppressed_until > datetime('now'))
      `).bind(recipientEmail).first()
      
      if (!result) {
        return null
      }
      
      const entry: EmailSuppressionEntry = {
        id: result.id as string,
        recipientEmail: result.recipient_email as string,
        suppressionReason: result.suppression_reason as EmailSuppressionReason,
        suppressedAt: result.suppressed_at as string,
        suppressedUntil: result.suppressed_until as string,
        isPermanent: Boolean(result.is_permanent),
        sourceType: result.source_type as any,
        sourceId: result.source_id as string,
        failureCount: result.failure_count as number,
        lastFailureAt: result.last_failure_at as string,
        lastFailureType: result.last_failure_type as EmailFailureType,
        createdAt: result.created_at as string,
        updatedAt: result.updated_at as string
      }
      
      // Cache the entry
      this.suppressionCache.set(recipientEmail, entry)
      
      return entry
      
    } catch (error) {
      console.error('Failed to check suppression status:', error)
      return null
    }
  }
  
  /**
   * Remove recipient from suppression list
   */
  async removeFromSuppressionList(recipientEmail: string): Promise<void> {
    try {
      await this.dependencies.db.prepare(`
        DELETE FROM email_suppression_list WHERE recipient_email = ?
      `).bind(recipientEmail).run()
      
      // Remove from cache
      this.suppressionCache.delete(recipientEmail)
      
    } catch (error) {
      console.error('Failed to remove from suppression list:', error)
      throw createApiError(
        'Failed to remove from suppression list',
        500,
        'SUPPRESSION_REMOVE_FAILED',
        error
      )
    }
  }
  
  /**
   * Get retry policy by ID
   */
  private async getRetryPolicy(policyId: string): Promise<EmailRetryPolicy> {
    const policy = this.retryPolicies.get(policyId)
    if (!policy) {
      // Fall back to default policy
      const defaultPolicy = this.retryPolicies.get(this.config.defaultPolicyId)
      if (!defaultPolicy) {
        throw createApiError(`Retry policy not found: ${policyId}`, 404, 'POLICY_NOT_FOUND')
      }
      return defaultPolicy
    }
    return policy
  }
  
  /**
   * Apply priority-specific overrides to policy
   */
  private applyPriorityOverrides(policy: EmailRetryPolicy, priority: EmailPriority): EmailRetryPolicy {
    const overrides = policy.priorityOverrides[priority]
    if (!overrides) {
      return policy
    }
    
    return {
      ...policy,
      ...overrides
    }
  }
  
  /**
   * Get backoff configuration for failure type
   */
  private getBackoffConfig(policy: EmailRetryPolicy, failureType: EmailFailureType): BackoffOptions {
    const baseConfig: BackoffOptions = {
      baseDelay: policy.baseDelayMs,
      maxDelay: policy.maxDelayMs,
      multiplier: policy.backoffMultiplier,
      jitter: policy.useJitter,
      maxRetries: policy.maxRetries
    }
    
    // Apply special handling for rate limits
    if (failureType === 'rate_limit') {
      return {
        ...baseConfig,
        baseDelay: policy.rateLimitBackoffMs,
        maxDelay: policy.rateLimitMaxBackoffMs
      }
    }
    
    return baseConfig
  }
  
  /**
   * Get suppression recommendation for failure type
   */
  private getSuppres sionRecommendation(failureType: EmailFailureType): {
    shouldSuppress: boolean
    reason?: EmailSuppressionReason
  } {
    const suppressionMap: Record<EmailFailureType, { shouldSuppress: boolean; reason?: EmailSuppressionReason }> = {
      bounced_hard: { shouldSuppress: true, reason: 'hard_bounce' },
      spam_complaint: { shouldSuppress: true, reason: 'spam_complaint' },
      invalid_email: { shouldSuppress: true, reason: 'invalid_email' },
      bounced_soft: { shouldSuppress: false },
      temporary: { shouldSuppress: false },
      permanent: { shouldSuppress: true, reason: 'reputation_risk' },
      rate_limit: { shouldSuppress: false },
      network_error: { shouldSuppress: false },
      service_unavailable: { shouldSuppress: false },
      auth_failure: { shouldSuppress: false },
      quota_exceeded: { shouldSuppress: false },
      unknown: { shouldSuppress: false }
    }
    
    return suppressionMap[failureType] || { shouldSuppress: false }
  }
  
  /**
   * Load retry policies from database
   */
  private async loadRetryPoliciesFromDatabase(): Promise<EmailRetryPolicy[]> {
    try {
      const result = await this.dependencies.db.prepare(`
        SELECT * FROM email_retry_policies WHERE is_active = 1
      `).all()
      
      return result.results?.map(row => ({
        id: row.id as string,
        name: row.name as string,
        description: row.description as string,
        maxRetries: row.max_retries as number,
        baseDelayMs: row.base_delay_ms as number,
        maxDelayMs: row.max_delay_ms as number,
        backoffMultiplier: row.backoff_multiplier as number,
        useJitter: Boolean(row.use_jitter),
        retryableFailures: JSON.parse(row.retryable_failures as string),
        nonRetryableFailures: JSON.parse(row.non_retryable_failures as string),
        priorityOverrides: JSON.parse(row.priority_overrides as string),
        rateLimitBackoffMs: row.rate_limit_backoff_ms as number,
        rateLimitMaxBackoffMs: row.rate_limit_max_backoff_ms as number,
        deadLetterThreshold: row.dead_letter_threshold as number,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        isActive: Boolean(row.is_active)
      })) || []
      
    } catch (error) {
      console.error('Failed to load retry policies:', error)
      return []
    }
  }
  
  /**
   * Create default retry policies
   */
  private async createDefaultPolicies(): Promise<void> {
    try {
      for (const [key, policyTemplate] of Object.entries(EMAIL_RETRY_POLICIES)) {
        const policy: EmailRetryPolicy = {
          id: await generateSecureId(),
          ...policyTemplate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        await this.saveRetryPolicy(policy)
      }
    } catch (error) {
      console.error('Failed to create default policies:', error)
      throw error
    }
  }
  
  /**
   * Save retry policy to database
   */
  private async saveRetryPolicy(policy: EmailRetryPolicy): Promise<void> {
    await this.dependencies.db.prepare(`
      INSERT OR REPLACE INTO email_retry_policies (
        id, name, description, max_retries, base_delay_ms, max_delay_ms,
        backoff_multiplier, use_jitter, retryable_failures, non_retryable_failures,
        priority_overrides, rate_limit_backoff_ms, rate_limit_max_backoff_ms,
        dead_letter_threshold, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      policy.id,
      policy.name,
      policy.description,
      policy.maxRetries,
      policy.baseDelayMs,
      policy.maxDelayMs,
      policy.backoffMultiplier,
      policy.useJitter,
      JSON.stringify(policy.retryableFailures),
      JSON.stringify(policy.nonRetryableFailures),
      JSON.stringify(policy.priorityOverrides),
      policy.rateLimitBackoffMs,
      policy.rateLimitMaxBackoffMs,
      policy.deadLetterThreshold,
      policy.isActive,
      policy.createdAt,
      policy.updatedAt
    ).run()
  }
  
  /**
   * Save retry attempt to database
   */
  private async saveRetryAttempt(attempt: EmailRetryAttempt): Promise<void> {
    await this.dependencies.db.prepare(`
      INSERT INTO email_retry_attempts (
        id, email_queue_id, attempt_number, attempted_at, failure_type, failure_reason,
        error_code, error_message, http_status, response_body, will_retry, next_retry_at,
        backoff_delay_ms, policy_id, policy_name, service_provider, service_message_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      attempt.id,
      attempt.emailQueueId,
      attempt.attemptNumber,
      attempt.attemptedAt,
      attempt.failureType,
      attempt.failureReason,
      attempt.errorCode || null,
      attempt.errorMessage,
      attempt.httpStatus || null,
      attempt.responseBody || null,
      attempt.willRetry,
      attempt.nextRetryAt || null,
      attempt.backoffDelayMs || null,
      attempt.policyId,
      attempt.policyName,
      attempt.serviceProvider,
      attempt.serviceMessageId || null,
      attempt.createdAt
    ).run()
  }
  
  /**
   * Save suppression entry to database
   */
  private async saveSuppressionEntry(entry: EmailSuppressionEntry): Promise<void> {
    await this.dependencies.db.prepare(`
      INSERT OR REPLACE INTO email_suppression_list (
        id, recipient_email, suppression_reason, suppressed_at, suppressed_until,
        is_permanent, source_type, source_id, failure_count, last_failure_at,
        last_failure_type, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      entry.id,
      entry.recipientEmail,
      entry.suppressionReason,
      entry.suppressedAt,
      entry.suppressedUntil || null,
      entry.isPermanent,
      entry.sourceType,
      entry.sourceId || null,
      entry.failureCount,
      entry.lastFailureAt,
      entry.lastFailureType,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      entry.createdAt,
      entry.updatedAt
    ).run()
  }
  
  /**
   * Get service statistics
   */
  async getRetryStatistics(timeRange: { start: string; end: string }): Promise<{
    totalAttempts: number
    successfulRetries: number
    failedRetries: number
    suppressedRecipients: number
    deadLetterItems: number
    failureBreakdown: Record<EmailFailureType, number>
    policyEffectiveness: Record<string, number>
  }> {
    try {
      const [attemptsResult, suppressionResult, failureResult] = await Promise.all([
        this.dependencies.db.prepare(`
          SELECT COUNT(*) as total_attempts, 
                 SUM(CASE WHEN will_retry = 1 THEN 1 ELSE 0 END) as successful_retries,
                 SUM(CASE WHEN will_retry = 0 THEN 1 ELSE 0 END) as failed_retries
          FROM email_retry_attempts 
          WHERE attempted_at BETWEEN ? AND ?
        `).bind(timeRange.start, timeRange.end).first(),
        
        this.dependencies.db.prepare(`
          SELECT COUNT(*) as suppressed_recipients
          FROM email_suppression_list
          WHERE suppressed_at BETWEEN ? AND ?
        `).bind(timeRange.start, timeRange.end).first(),
        
        this.dependencies.db.prepare(`
          SELECT failure_type, COUNT(*) as count
          FROM email_retry_attempts
          WHERE attempted_at BETWEEN ? AND ?
          GROUP BY failure_type
        `).bind(timeRange.start, timeRange.end).all()
      ])
      
      const failureBreakdown: Record<EmailFailureType, number> = {}
      failureResult.results?.forEach(row => {
        failureBreakdown[row.failure_type as EmailFailureType] = row.count as number
      })
      
      return {
        totalAttempts: attemptsResult?.total_attempts as number || 0,
        successfulRetries: attemptsResult?.successful_retries as number || 0,
        failedRetries: attemptsResult?.failed_retries as number || 0,
        suppressedRecipients: suppressionResult?.suppressed_recipients as number || 0,
        deadLetterItems: 0, // Would need to query dead letter queue
        failureBreakdown,
        policyEffectiveness: {} // Would need more complex query
      }
      
    } catch (error) {
      console.error('Failed to get retry statistics:', error)
      throw createApiError('Failed to get retry statistics', 500, 'RETRY_STATS_FAILED', error)
    }
  }
}

/**
 * Factory function to create EmailRetryService instance
 */
export function createEmailRetryService(
  config: EmailRetryServiceConfig,
  dependencies: EmailRetryServiceDependencies
): EmailRetryService {
  return new EmailRetryService(config, dependencies)
}

/**
 * Default configuration for EmailRetryService
 */
export const DEFAULT_EMAIL_RETRY_CONFIG: EmailRetryServiceConfig = {
  defaultPolicyId: 'standard',
  maxRetryAttempts: 5,
  enableSuppressionList: true,
  enableDeadLetterQueue: true,
  classificationConfig: DEFAULT_FAILURE_CLASSIFICATION,
  enableRetryMetrics: true,
  enableFailureAnalytics: true,
  retryHistoryRetentionDays: 30,
  suppressionListRetentionDays: 90
}