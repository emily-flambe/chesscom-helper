/**
 * Exponential Backoff Utility
 * Implements exponential backoff with jitter for retry mechanisms
 */

export interface BackoffOptions {
  baseDelay: number      // Base delay in milliseconds
  maxDelay: number       // Maximum delay in milliseconds
  multiplier: number     // Backoff multiplier (usually 2)
  jitter: boolean        // Whether to add jitter to reduce thundering herd
  maxRetries: number     // Maximum number of retries
}

export interface BackoffResult {
  delay: number          // Calculated delay in milliseconds
  shouldRetry: boolean   // Whether retry should be attempted
  nextRetryNumber: number // Next retry number
}

export interface BackoffState {
  retryCount: number
  lastDelay: number
  totalDelay: number
  startTime: number
}

/**
 * Default backoff configuration
 */
export const DEFAULT_BACKOFF_OPTIONS: BackoffOptions = {
  baseDelay: 1000,       // 1 second
  maxDelay: 300000,      // 5 minutes
  multiplier: 2,
  jitter: true,
  maxRetries: 5
}

/**
 * Email-specific backoff configurations
 */
export const EMAIL_BACKOFF_CONFIGS = {
  high_priority: {
    baseDelay: 60000,    // 1 minute
    maxDelay: 3600000,   // 1 hour
    multiplier: 2,
    jitter: true,
    maxRetries: 5
  },
  medium_priority: {
    baseDelay: 120000,   // 2 minutes
    maxDelay: 7200000,   // 2 hours
    multiplier: 2,
    jitter: true,
    maxRetries: 3
  },
  low_priority: {
    baseDelay: 300000,   // 5 minutes
    maxDelay: 14400000,  // 4 hours
    multiplier: 2,
    jitter: true,
    maxRetries: 2
  }
} as const

/**
 * Calculate exponential backoff delay with optional jitter
 * @param retryCount Current retry attempt (0-based)
 * @param options Backoff configuration options
 * @returns Calculated delay in milliseconds
 */
export function calculateBackoffDelay(
  retryCount: number,
  options: BackoffOptions = DEFAULT_BACKOFF_OPTIONS
): BackoffResult {
  // Check if we've exceeded max retries
  if (retryCount >= options.maxRetries) {
    return {
      delay: 0,
      shouldRetry: false,
      nextRetryNumber: retryCount + 1
    }
  }

  // Calculate exponential delay
  const exponentialDelay = options.baseDelay * Math.pow(options.multiplier, retryCount)
  
  // Apply maximum delay cap
  const cappedDelay = Math.min(exponentialDelay, options.maxDelay)
  
  // Add jitter if enabled
  const finalDelay = options.jitter ? addJitter(cappedDelay) : cappedDelay
  
  return {
    delay: Math.round(finalDelay),
    shouldRetry: true,
    nextRetryNumber: retryCount + 1
  }
}

/**
 * Add jitter to delay to prevent thundering herd problem
 * Uses full jitter algorithm: randomDelay = random(0, delay)
 * @param delay Base delay in milliseconds
 * @returns Jittered delay
 */
export function addJitter(delay: number): number {
  return Math.random() * delay
}

/**
 * Add decorrelated jitter to delay
 * More sophisticated jitter that considers previous delay
 * @param delay Base delay in milliseconds
 * @param previousDelay Previous delay used
 * @returns Jittered delay
 */
export function addDecorrelatedJitter(delay: number, previousDelay: number = 0): number {
  const minDelay = Math.min(delay * 0.1, 1000) // Minimum 10% of delay or 1 second
  const maxDelay = delay * 3 // Maximum 3x the calculated delay
  
  return Math.random() * (maxDelay - minDelay) + minDelay
}

/**
 * Create a backoff state tracker
 * @param options Backoff configuration
 * @returns Initial backoff state
 */
export function createBackoffState(options: BackoffOptions = DEFAULT_BACKOFF_OPTIONS): BackoffState {
  return {
    retryCount: 0,
    lastDelay: 0,
    totalDelay: 0,
    startTime: Date.now()
  }
}

/**
 * Calculate next retry delay and update state
 * @param state Current backoff state
 * @param options Backoff configuration
 * @returns Updated backoff result and state
 */
export function getNextRetryDelay(
  state: BackoffState,
  options: BackoffOptions = DEFAULT_BACKOFF_OPTIONS
): { result: BackoffResult; state: BackoffState } {
  const result = calculateBackoffDelay(state.retryCount, options)
  
  const newState: BackoffState = {
    retryCount: state.retryCount + 1,
    lastDelay: result.delay,
    totalDelay: state.totalDelay + result.delay,
    startTime: state.startTime
  }
  
  return { result, state: newState }
}

/**
 * Calculate when next retry should happen
 * @param retryCount Current retry count
 * @param options Backoff configuration
 * @returns ISO timestamp for next retry
 */
export function calculateNextRetryTime(
  retryCount: number,
  options: BackoffOptions = DEFAULT_BACKOFF_OPTIONS
): string | null {
  const backoffResult = calculateBackoffDelay(retryCount, options)
  
  if (!backoffResult.shouldRetry) {
    return null
  }
  
  const nextRetryTime = new Date(Date.now() + backoffResult.delay)
  return nextRetryTime.toISOString()
}

/**
 * Check if enough time has passed for a retry
 * @param lastAttemptTime ISO timestamp of last attempt
 * @param retryCount Current retry count
 * @param options Backoff configuration
 * @returns Whether retry should be attempted now
 */
export function shouldRetryNow(
  lastAttemptTime: string,
  retryCount: number,
  options: BackoffOptions = DEFAULT_BACKOFF_OPTIONS
): boolean {
  const backoffResult = calculateBackoffDelay(retryCount, options)
  
  if (!backoffResult.shouldRetry) {
    return false
  }
  
  const lastAttempt = new Date(lastAttemptTime).getTime()
  const requiredWaitTime = backoffResult.delay
  const timeSinceLastAttempt = Date.now() - lastAttempt
  
  return timeSinceLastAttempt >= requiredWaitTime
}

/**
 * Get backoff configuration for email priority
 * @param priority Email priority level
 * @returns Backoff configuration for the priority
 */
export function getEmailBackoffConfig(priority: 'high' | 'medium' | 'low'): BackoffOptions {
  const priorityMap = {
    high: 'high_priority',
    medium: 'medium_priority',
    low: 'low_priority'
  } as const
  
  return EMAIL_BACKOFF_CONFIGS[priorityMap[priority]]
}

/**
 * Create a retry schedule for debugging/monitoring
 * @param options Backoff configuration
 * @returns Array of retry delays
 */
export function createRetrySchedule(options: BackoffOptions = DEFAULT_BACKOFF_OPTIONS): number[] {
  const schedule: number[] = []
  
  for (let i = 0; i < options.maxRetries; i++) {
    const result = calculateBackoffDelay(i, { ...options, jitter: false })
    if (result.shouldRetry) {
      schedule.push(result.delay)
    }
  }
  
  return schedule
}

/**
 * Format delay for human-readable display
 * @param delayMs Delay in milliseconds
 * @returns Human-readable delay string
 */
export function formatDelay(delayMs: number): string {
  if (delayMs < 1000) {
    return `${delayMs}ms`
  } else if (delayMs < 60000) {
    return `${Math.round(delayMs / 1000)}s`
  } else if (delayMs < 3600000) {
    return `${Math.round(delayMs / 60000)}m`
  } else {
    return `${Math.round(delayMs / 3600000)}h`
  }
}

/**
 * Backoff utility class for more advanced usage
 */
export class ExponentialBackoff {
  private state: BackoffState
  private options: BackoffOptions
  
  constructor(options: BackoffOptions = DEFAULT_BACKOFF_OPTIONS) {
    this.options = { ...options }
    this.state = createBackoffState(options)
  }
  
  /**
   * Get next retry delay
   */
  getNextDelay(): BackoffResult {
    const { result, state } = getNextRetryDelay(this.state, this.options)
    this.state = state
    return result
  }
  
  /**
   * Reset backoff state
   */
  reset(): void {
    this.state = createBackoffState(this.options)
  }
  
  /**
   * Get current state
   */
  getState(): BackoffState {
    return { ...this.state }
  }
  
  /**
   * Check if max retries exceeded
   */
  isMaxRetriesExceeded(): boolean {
    return this.state.retryCount >= this.options.maxRetries
  }
  
  /**
   * Get total elapsed time
   */
  getTotalElapsedTime(): number {
    return Date.now() - this.state.startTime
  }
  
  /**
   * Get formatted total delay
   */
  getFormattedTotalDelay(): string {
    return formatDelay(this.state.totalDelay)
  }
}

/**
 * Utility function to sleep for a specified duration
 * @param ms Duration in milliseconds
 * @returns Promise that resolves after the delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry function with exponential backoff
 * @param fn Function to retry
 * @param options Backoff configuration
 * @returns Promise that resolves with function result or rejects with last error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: BackoffOptions = DEFAULT_BACKOFF_OPTIONS
): Promise<T> {
  const backoff = new ExponentialBackoff(options)
  let lastError: Error | null = null
  let shouldContinue = true
  
  while (shouldContinue) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      const retryResult = backoff.getNextDelay()
      
      if (!retryResult.shouldRetry) {
        shouldContinue = false
        throw lastError
      }
      
      await sleep(retryResult.delay)
    }
  }
  
  // This should never be reached, but TypeScript requires it
  throw lastError || new Error('Retry function failed without error')
}

/**
 * Constants for common retry scenarios
 */
export const RETRY_SCENARIOS = {
  // API rate limiting
  RATE_LIMIT: {
    baseDelay: 5000,     // 5 seconds
    maxDelay: 60000,     // 1 minute
    multiplier: 1.5,
    jitter: true,
    maxRetries: 10
  },
  
  // Network connectivity issues
  NETWORK_ERROR: {
    baseDelay: 1000,     // 1 second
    maxDelay: 30000,     // 30 seconds
    multiplier: 2,
    jitter: true,
    maxRetries: 5
  },
  
  // Database connection issues
  DATABASE_ERROR: {
    baseDelay: 2000,     // 2 seconds
    maxDelay: 60000,     // 1 minute
    multiplier: 2,
    jitter: true,
    maxRetries: 3
  },
  
  // External service temporary failures
  SERVICE_UNAVAILABLE: {
    baseDelay: 10000,    // 10 seconds
    maxDelay: 300000,    // 5 minutes
    multiplier: 2,
    jitter: true,
    maxRetries: 6
  }
} as const