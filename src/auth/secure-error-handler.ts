/**
 * Secure Error Handling System for Cloudflare Workers Authentication
 * 
 * Security Features:
 * - Prevents information leakage through error messages
 * - Comprehensive error classification and sanitization
 * - Secure logging with sensitive data redaction
 * - Error correlation and tracking
 * - Standardized error responses
 * - Attack vector detection through error patterns
 * - Monitoring and alerting integration
 * - Contextual error handling based on security level
 */

export enum ErrorCode {
  // Authentication Errors
  INVALID_CREDENTIALS = 'AUTH_001',
  ACCOUNT_LOCKED = 'AUTH_002',
  EMAIL_NOT_VERIFIED = 'AUTH_003',
  TOKEN_EXPIRED = 'AUTH_004',
  TOKEN_INVALID = 'AUTH_005',
  SESSION_EXPIRED = 'AUTH_006',
  INSUFFICIENT_PERMISSIONS = 'AUTH_007',
  
  // Rate Limiting Errors
  RATE_LIMIT_EXCEEDED = 'RATE_001',
  SUSPICIOUS_ACTIVITY = 'RATE_002',
  IP_BLOCKED = 'RATE_003',
  
  // Validation Errors
  INVALID_INPUT = 'VAL_001',
  MISSING_REQUIRED_FIELD = 'VAL_002',
  INVALID_EMAIL_FORMAT = 'VAL_003',
  WEAK_PASSWORD = 'VAL_004',
  
  // System Errors
  DATABASE_ERROR = 'SYS_001',
  EXTERNAL_SERVICE_UNAVAILABLE = 'SYS_002',
  CONFIGURATION_ERROR = 'SYS_003',
  UNKNOWN_ERROR = 'SYS_999'
}

export enum SecurityLevel {
  LOW = 1,     // Generic errors, safe to expose details
  MEDIUM = 2,  // Sanitized errors, limited details
  HIGH = 3,    // Highly sensitive, generic messages only
  CRITICAL = 4 // Security-critical, no details exposed
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  userMessage: string;
  securityLevel: SecurityLevel;
  httpStatus: number;
  loggingDetails?: Record<string, any>;
  correlationId?: string;
  timestamp: number;
  context?: Record<string, any>;
}

export interface SecurityEvent {
  type: 'authentication_failure' | 'authorization_failure' | 'suspicious_activity' | 'system_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  description: string;
  metadata: Record<string, any>;
  timestamp: number;
  correlationId: string;
}

/**
 * SECURITY MEASURE: Secure Error Handler with comprehensive protection
 */
export class SecureErrorHandler {
  private readonly environment: 'development' | 'production'
  private readonly enableDetailedLogging: boolean
  
  constructor(environment: 'development' | 'production' = 'production') {
    this.environment = environment
    this.enableDetailedLogging = environment === 'development'
  }

  /**
   * SECURITY MEASURE: Handle authentication errors with information leakage prevention
   */
  handleAuthenticationError(
    error: Error | string,
    request: Request,
    context?: Record<string, any>
  ): ErrorDetails {
    
    const correlationId = this.generateCorrelationId()
    const timestamp = Date.now()
    
    // SECURITY: Classify error and determine security level
    const errorDetails = this.classifyAuthenticationError(error)
    
    // SECURITY: Sanitize error based on security level
    const sanitizedDetails = this.sanitizeError(errorDetails, correlationId, timestamp)
    
    // SECURITY: Log security event
    this.logSecurityEvent({
      type: 'authentication_failure',
      severity: this.mapSecurityLevelToSeverity(errorDetails.securityLevel),
      source: 'authentication',
      description: typeof error === 'string' ? error : error.message,
      metadata: {
        correlationId,
        userAgent: request.headers.get('User-Agent') || 'unknown',
        ip: request.headers.get('CF-Connecting-IP') || 'unknown',
        url: request.url,
        context: context || {}
      },
      timestamp,
      correlationId
    })
    
    return sanitizedDetails
  }

  /**
   * SECURITY MEASURE: Handle authorization errors
   */
  handleAuthorizationError(
    error: Error | string,
    request: Request,
    requiredPermission?: string,
    context?: Record<string, any>
  ): ErrorDetails {
    
    const correlationId = this.generateCorrelationId()
    const timestamp = Date.now()
    
    const errorDetails: ErrorDetails = {
      code: ErrorCode.INSUFFICIENT_PERMISSIONS,
      message: typeof error === 'string' ? error : error.message,
      userMessage: 'Access denied',
      securityLevel: SecurityLevel.HIGH,
      httpStatus: 403,
      correlationId,
      timestamp,
      ...(context && { context })
    }
    
    // SECURITY: Log authorization failure
    this.logSecurityEvent({
      type: 'authorization_failure',
      severity: 'medium',
      source: 'authorization',
      description: `Access denied for resource: ${requiredPermission || 'unknown'}`,
      metadata: {
        correlationId,
        userAgent: request.headers.get('User-Agent') || 'unknown',
        ip: request.headers.get('CF-Connecting-IP') || 'unknown',
        url: request.url,
        requiredPermission,
        context: context || {}
      },
      timestamp,
      correlationId
    })
    
    return this.sanitizeError(errorDetails, correlationId, timestamp)
  }

  /**
   * SECURITY MEASURE: Handle validation errors
   */
  handleValidationError(
    field: string,
    value: any,
    validationRule: string,
    request: Request
  ): ErrorDetails {
    
    const correlationId = this.generateCorrelationId()
    const timestamp = Date.now()
    
    // SECURITY: Determine validation error code
    const errorCode = this.getValidationErrorCode(validationRule)
    
    const errorDetails: ErrorDetails = {
      code: errorCode,
      message: `Validation failed for field '${field}': ${validationRule}`,
      userMessage: this.getValidationUserMessage(field, validationRule),
      securityLevel: SecurityLevel.LOW,
      httpStatus: 400,
      correlationId,
      timestamp,
      loggingDetails: {
        field,
        rule: validationRule,
        // SECURITY: Don't log actual value for sensitive fields
        value: this.isSensitiveField(field) ? '[REDACTED]' : value
      }
    }
    
    return errorDetails
  }

  /**
   * SECURITY MEASURE: Handle rate limiting errors
   */
  handleRateLimitError(
    rateLimitResult: any,
    request: Request,
    context?: Record<string, any>
  ): ErrorDetails {
    
    const correlationId = this.generateCorrelationId()
    const timestamp = Date.now()
    
    let errorCode = ErrorCode.RATE_LIMIT_EXCEEDED
    let userMessage = 'Too many requests. Please try again later.'
    let securityLevel = SecurityLevel.MEDIUM
    
    // SECURITY: Adjust error details based on rate limit type
    if (rateLimitResult.suspended) {
      errorCode = ErrorCode.IP_BLOCKED
      userMessage = 'Access temporarily suspended due to suspicious activity.'
      securityLevel = SecurityLevel.HIGH
    } else if (rateLimitResult.suspiciousActivity) {
      errorCode = ErrorCode.SUSPICIOUS_ACTIVITY
      userMessage = 'Request blocked due to suspicious activity.'
      securityLevel = SecurityLevel.HIGH
    }
    
    const errorDetails: ErrorDetails = {
      code: errorCode,
      message: `Rate limit exceeded: ${JSON.stringify(rateLimitResult)}`,
      userMessage,
      securityLevel,
      httpStatus: rateLimitResult.suspended ? 403 : 429,
      correlationId,
      timestamp,
      ...(context && { context })
    }
    
    // SECURITY: Log rate limiting event
    this.logSecurityEvent({
      type: 'suspicious_activity',
      severity: rateLimitResult.suspended ? 'high' : 'medium',
      source: 'rate_limiter',
      description: `Rate limit exceeded for IP: ${request.headers.get('CF-Connecting-IP')}`,
      metadata: {
        correlationId,
        rateLimitResult,
        userAgent: request.headers.get('User-Agent') || 'unknown',
        ip: request.headers.get('CF-Connecting-IP') || 'unknown',
        url: request.url,
        context: context || {}
      },
      timestamp,
      correlationId
    })
    
    return this.sanitizeError(errorDetails, correlationId, timestamp)
  }

  /**
   * SECURITY MEASURE: Handle system errors
   */
  handleSystemError(
    error: Error,
    request: Request,
    context?: Record<string, any>
  ): ErrorDetails {
    
    const correlationId = this.generateCorrelationId()
    const timestamp = Date.now()
    
    const errorDetails: ErrorDetails = {
      code: ErrorCode.UNKNOWN_ERROR,
      message: error.message,
      userMessage: 'An internal error occurred. Please try again later.',
      securityLevel: SecurityLevel.HIGH,
      httpStatus: 500,
      correlationId,
      timestamp,
      ...(context && { context }),
      loggingDetails: {
        stack: error.stack,
        name: error.name
      }
    }
    
    // SECURITY: Log system error
    this.logSecurityEvent({
      type: 'system_error',
      severity: 'high',
      source: 'system',
      description: error.message,
      metadata: {
        correlationId,
        stack: error.stack,
        userAgent: request.headers.get('User-Agent') || 'unknown',
        ip: request.headers.get('CF-Connecting-IP') || 'unknown',
        url: request.url,
        context: context || {}
      },
      timestamp,
      correlationId
    })
    
    return this.sanitizeError(errorDetails, correlationId, timestamp)
  }

  /**
   * SECURITY MEASURE: Create secure HTTP response from error details
   */
  createErrorResponse(errorDetails: ErrorDetails): Response {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Correlation-ID': errorDetails.correlationId || 'unknown',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    })
    
    // SECURITY: Include retry headers for rate limiting
    if (errorDetails.code === ErrorCode.RATE_LIMIT_EXCEEDED && errorDetails.context?.retryAfter) {
      headers.set('Retry-After', errorDetails.context.retryAfter.toString())
    }
    
    const responseBody = {
      error: {
        code: errorDetails.code,
        message: errorDetails.userMessage,
        correlationId: errorDetails.correlationId,
        timestamp: errorDetails.timestamp
      }
    }
    
    // SECURITY: Include additional details only in development
    if (this.environment === 'development' && errorDetails.securityLevel <= SecurityLevel.MEDIUM) {
      (responseBody.error as any).details = errorDetails.message
    }
    
    return new Response(JSON.stringify(responseBody), {
      status: errorDetails.httpStatus,
      headers
    })
  }

  /**
   * SECURITY MEASURE: Classify authentication errors
   */
  private classifyAuthenticationError(error: Error | string): ErrorDetails {
    const errorMessage = typeof error === 'string' ? error : error.message
    const errorLower = errorMessage.toLowerCase()
    
    // SECURITY: Map internal errors to standardized error codes
    if (errorLower.includes('invalid credentials') || errorLower.includes('password')) {
      return {
        code: ErrorCode.INVALID_CREDENTIALS,
        message: errorMessage,
        userMessage: 'Invalid email or password',
        securityLevel: SecurityLevel.HIGH,
        httpStatus: 401,
        timestamp: Date.now()
      }
    }
    
    if (errorLower.includes('account locked') || errorLower.includes('locked')) {
      return {
        code: ErrorCode.ACCOUNT_LOCKED,
        message: errorMessage,
        userMessage: 'Account temporarily locked due to failed login attempts',
        securityLevel: SecurityLevel.MEDIUM,
        httpStatus: 423,
        timestamp: Date.now()
      }
    }
    
    if (errorLower.includes('email not verified') || errorLower.includes('verification')) {
      return {
        code: ErrorCode.EMAIL_NOT_VERIFIED,
        message: errorMessage,
        userMessage: 'Please verify your email address before logging in',
        securityLevel: SecurityLevel.LOW,
        httpStatus: 403,
        timestamp: Date.now()
      }
    }
    
    if (errorLower.includes('token expired') || errorLower.includes('expired')) {
      return {
        code: ErrorCode.TOKEN_EXPIRED,
        message: errorMessage,
        userMessage: 'Your session has expired. Please log in again.',
        securityLevel: SecurityLevel.MEDIUM,
        httpStatus: 401,
        timestamp: Date.now()
      }
    }
    
    if (errorLower.includes('invalid token') || errorLower.includes('unauthorized')) {
      return {
        code: ErrorCode.TOKEN_INVALID,
        message: errorMessage,
        userMessage: 'Invalid authentication token',
        securityLevel: SecurityLevel.HIGH,
        httpStatus: 401,
        timestamp: Date.now()
      }
    }
    
    // SECURITY: Default to high security level for unknown errors
    return {
      code: ErrorCode.UNKNOWN_ERROR,
      message: errorMessage,
      userMessage: 'Authentication failed',
      securityLevel: SecurityLevel.CRITICAL,
      httpStatus: 401,
      timestamp: Date.now()
    }
  }

  /**
   * SECURITY MEASURE: Sanitize error details based on security level
   */
  private sanitizeError(
    errorDetails: ErrorDetails,
    correlationId: string,
    timestamp: number
  ): ErrorDetails {
    
    const sanitized = { ...errorDetails }
    sanitized.correlationId = correlationId
    sanitized.timestamp = timestamp
    
    // SECURITY: Remove sensitive information based on security level
    if (errorDetails.securityLevel >= SecurityLevel.HIGH) {
      // SECURITY: Remove internal message for high security level
      sanitized.message = 'Internal error details redacted for security'
      
      // SECURITY: Remove logging details from response
      delete sanitized.loggingDetails
      
      // SECURITY: Remove context from response
      delete sanitized.context
    }
    
    if (errorDetails.securityLevel >= SecurityLevel.CRITICAL) {
      // SECURITY: Use generic message for critical security level
      sanitized.userMessage = 'An error occurred. Please contact support.'
    }
    
    return sanitized
  }

  /**
   * SECURITY MEASURE: Log security events with proper redaction
   */
  private logSecurityEvent(event: SecurityEvent): void {
    // SECURITY: Redact sensitive information from logs
    const sanitizedMetadata = this.redactSensitiveData(event.metadata)
    
    const logEvent = {
      ...event,
      metadata: sanitizedMetadata,
      environment: this.environment
    }
    
    // SECURITY: Log based on severity
    switch (event.severity) {
      case 'critical':
        console.error('SECURITY ALERT - CRITICAL:', logEvent)
        break
      case 'high':
        console.error('SECURITY ALERT - HIGH:', logEvent)
        break
      case 'medium':
        console.warn('SECURITY ALERT - MEDIUM:', logEvent)
        break
      case 'low':
        console.info('SECURITY ALERT - LOW:', logEvent)
        break
    }
  }

  /**
   * SECURITY MEASURE: Redact sensitive data from logs
   */
  private redactSensitiveData(data: Record<string, any>): Record<string, any> {
    const redacted = { ...data }
    
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'authorization',
      'cookie', 'session', 'email', 'phone', 'ssn', 'credit_card'
    ]
    
    for (const [key, value] of Object.entries(redacted)) {
      const keyLower = key.toLowerCase()
      
      if (sensitiveFields.some(field => keyLower.includes(field))) {
        redacted[key] = '[REDACTED]'
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactSensitiveData(value)
      }
    }
    
    return redacted
  }

  /**
   * SECURITY MEASURE: Generate correlation ID for error tracking
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36)
    const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    return `${timestamp}-${randomBytes}`
  }

  /**
   * Map security level to severity
   */
  private mapSecurityLevelToSeverity(level: SecurityLevel): 'low' | 'medium' | 'high' | 'critical' {
    switch (level) {
      case SecurityLevel.LOW: return 'low'
      case SecurityLevel.MEDIUM: return 'medium'
      case SecurityLevel.HIGH: return 'high'
      case SecurityLevel.CRITICAL: return 'critical'
      default: return 'medium'
    }
  }

  /**
   * Get validation error code
   */
  private getValidationErrorCode(validationRule: string): ErrorCode {
    if (validationRule.includes('email')) {
return ErrorCode.INVALID_EMAIL_FORMAT
}
    if (validationRule.includes('password')) {
return ErrorCode.WEAK_PASSWORD
}
    if (validationRule.includes('required')) {
return ErrorCode.MISSING_REQUIRED_FIELD
}
    return ErrorCode.INVALID_INPUT
  }

  /**
   * Get user-friendly validation message
   */
  private getValidationUserMessage(field: string, rule: string): string {
    if (rule.includes('email')) {
return 'Please enter a valid email address'
}
    if (rule.includes('password')) {
return 'Password does not meet security requirements'
}
    if (rule.includes('required')) {
return `${field} is required`
}
    return `Invalid ${field}`
  }

  /**
   * Check if field contains sensitive data
   */
  private isSensitiveField(field: string): boolean {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'ssn', 'credit_card']
    return sensitiveFields.some(sensitive => field.toLowerCase().includes(sensitive))
  }
}

/**
 * SECURITY MEASURE: Global error handler instance
 */
export const secureErrorHandler = new SecureErrorHandler(
  // SECURITY: Determine environment from worker environment
  typeof globalThis !== 'undefined' && (globalThis as any).ENVIRONMENT === 'development' 
    ? 'development' 
    : 'production'
)

/**
 * SECURITY MEASURE: Utility function for consistent error handling
 */
export function handleSecureError(
  error: Error | string,
  request: Request,
  type: 'auth' | 'validation' | 'rate_limit' | 'system' = 'system',
  context?: Record<string, any>
): Response {
  
  let errorDetails: ErrorDetails
  
  switch (type) {
    case 'auth':
      errorDetails = secureErrorHandler.handleAuthenticationError(error, request, context)
      break
    case 'rate_limit':
      errorDetails = secureErrorHandler.handleRateLimitError(context, request)
      break
    case 'system':
      errorDetails = secureErrorHandler.handleSystemError(
        error instanceof Error ? error : new Error(error.toString()),
        request,
        context
      )
      break
    default:
      errorDetails = secureErrorHandler.handleSystemError(
        error instanceof Error ? error : new Error(error.toString()),
        request,
        context
      )
  }
  
  return secureErrorHandler.createErrorResponse(errorDetails)
}