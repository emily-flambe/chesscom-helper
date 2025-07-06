/**
 * Advanced Rate Limiting and Abuse Prevention for Cloudflare Workers
 * 
 * Security Features:
 * - Multiple rate limiting strategies (IP, user, endpoint-specific)
 * - Sliding window algorithm for accurate rate limiting
 * - Exponential backoff for repeated violations
 * - Distributed rate limiting across edge locations
 * - Suspicious activity detection and blocking
 * - Adaptive rate limiting based on user behavior
 * - DDoS protection and automatic blacklisting
 * - Comprehensive logging and monitoring
 */

export interface RateLimitConfig {
  windowMs: number;           // Time window in milliseconds
  maxRequests: number;        // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generation
  skipSuccessfulRequests?: boolean; // Only count failed requests
  skipFailedRequests?: boolean;     // Only count successful requests
  message?: string;           // Custom error message
  standardHeaders?: boolean;  // Include standard rate limit headers
  legacyHeaders?: boolean;    // Include legacy headers
  exponentialBackoff?: boolean; // Enable exponential backoff
  suspiciousActivityThreshold?: number; // Threshold for suspicious activity
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  totalHits: number;
  suspended?: boolean;
  suspiciousActivity?: boolean;
}

export interface SuspiciousActivityMetrics {
  rapidFireRequests: number;
  failedAuthAttempts: number;
  differentUserAgents: number;
  suspiciousPatterns: number;
  lastActivity: number;
}

/**
 * SECURITY MEASURE: Advanced rate limiter with multiple protection layers
 */
export class AdvancedRateLimiter {
  private readonly config: RateLimitConfig
  
  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: 900000, // 15 minutes default
      maxRequests: 100,
      message: 'Too many requests',
      standardHeaders: true,
      legacyHeaders: false,
      exponentialBackoff: true,
      suspiciousActivityThreshold: 5,
      ...config
    }
  }

  /**
   * SECURITY MEASURE: Check rate limit with comprehensive protection
   */
  async checkRateLimit(
    request: Request,
    env: any,
    identifier?: string
  ): Promise<RateLimitResult> {
    
    const key = identifier || this.generateKey(request)
    const now = Date.now()
    
    try {
      // SECURITY: Check if IP is blacklisted
      if (await this.isBlacklisted(key, env)) {
        return {
          allowed: false,
          limit: 0,
          remaining: 0,
          resetTime: now + 86400000, // 24 hours
          retryAfter: 86400,
          totalHits: 0,
          suspended: true
        }
      }
      
      // SECURITY: Get current rate limit data
      const rateLimitData = await this.getRateLimitData(key, env)
      
      // SECURITY: Check suspicious activity
      const suspiciousMetrics = await this.checkSuspiciousActivity(key, request, env)
      
      // SECURITY: Apply exponential backoff if enabled
      const backoffMultiplier = this.config.exponentialBackoff 
        ? await this.getBackoffMultiplier(key, env)
        : 1
      
      const effectiveLimit = Math.floor(this.config.maxRequests / backoffMultiplier)
      const windowStart = now - this.config.windowMs
      
      // SECURITY: Clean old entries and count current requests
      const currentRequests = rateLimitData.requests.filter(
        timestamp => timestamp > windowStart
      ).length
      
      // SECURITY: Check if limit exceeded
      if (currentRequests >= effectiveLimit) {
        // SECURITY: Increment violation count for exponential backoff
        if (this.config.exponentialBackoff) {
          await this.incrementViolationCount(key, env)
        }
        
        // SECURITY: Check for excessive violations (potential attack)
        if (currentRequests > effectiveLimit * 2) {
          await this.flagSuspiciousActivity(key, env, 'excessive_rate_limit_violations')
        }
        
        const resetTime = Math.min(...rateLimitData.requests) + this.config.windowMs
        const retryAfter = Math.ceil((resetTime - now) / 1000)
        
        return {
          allowed: false,
          limit: effectiveLimit,
          remaining: 0,
          resetTime,
          retryAfter,
          totalHits: currentRequests,
          suspiciousActivity: suspiciousMetrics.isSuspicious
        }
      }
      
      // SECURITY: Record this request
      await this.recordRequest(key, now, env)
      
      const remaining = effectiveLimit - currentRequests - 1
      const resetTime = windowStart + this.config.windowMs
      
      return {
        allowed: true,
        limit: effectiveLimit,
        remaining: Math.max(0, remaining),
        resetTime,
        totalHits: currentRequests + 1,
        suspiciousActivity: suspiciousMetrics.isSuspicious
      }
      
    } catch (error) {
      console.error('Rate limiting error:', error)
      
      // SECURITY: Fail open to prevent complete service disruption
      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs,
        totalHits: 0
      }
    }
  }

  /**
   * SECURITY MEASURE: Generate unique keys for different rate limiting strategies
   */
  private generateKey(request: Request): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(request)
    }
    
    // SECURITY: Use CF-Connecting-IP (real client IP behind Cloudflare)
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     'unknown'
    
    return `rate_limit:${clientIP}`
  }

  /**
   * SECURITY MEASURE: Get rate limit data with sliding window
   */
  private async getRateLimitData(key: string, env: any): Promise<{
    requests: number[];
    violations: number;
    suspiciousActivity: SuspiciousActivityMetrics;
  }> {
    
    const data = await env.RATE_LIMIT_KV?.get(key)
    
    if (!data) {
      return {
        requests: [],
        violations: 0,
        suspiciousActivity: {
          rapidFireRequests: 0,
          failedAuthAttempts: 0,
          differentUserAgents: 0,
          suspiciousPatterns: 0,
          lastActivity: Date.now()
        }
      }
    }
    
    return JSON.parse(data)
  }

  /**
   * SECURITY MEASURE: Record request with timestamp
   */
  private async recordRequest(key: string, timestamp: number, env: any): Promise<void> {
    if (!env.RATE_LIMIT_KV) {
      return
    }
    
    const data = await this.getRateLimitData(key, env)
    
    // SECURITY: Add current request timestamp
    data.requests.push(timestamp)
    
    // SECURITY: Keep only recent requests (sliding window)
    const windowStart = timestamp - this.config.windowMs
    data.requests = data.requests.filter(ts => ts > windowStart)
    
    // SECURITY: Detect rapid-fire requests
    const recentRequests = data.requests.filter(ts => ts > timestamp - 1000) // Last second
    if (recentRequests.length > 10) {
      data.suspiciousActivity.rapidFireRequests++
    }
    
    data.suspiciousActivity.lastActivity = timestamp
    
    // SECURITY: Store with appropriate TTL
    const ttl = Math.ceil(this.config.windowMs / 1000) + 300 // Window + 5 minutes buffer
    await env.RATE_LIMIT_KV.put(key, JSON.stringify(data), {
      expirationTtl: ttl
    })
  }

  /**
   * SECURITY MEASURE: Exponential backoff implementation
   */
  private async getBackoffMultiplier(key: string, env: any): Promise<number> {
    const data = await this.getRateLimitData(key, env)
    
    // SECURITY: Exponential backoff based on violation count
    const violations = data.violations || 0
    return Math.min(Math.pow(2, violations), 16) // Cap at 16x
  }

  /**
   * SECURITY MEASURE: Increment violation count for exponential backoff
   */
  private async incrementViolationCount(key: string, env: any): Promise<void> {
    if (!env.RATE_LIMIT_KV) {
      return
    }
    
    const data = await this.getRateLimitData(key, env)
    data.violations = (data.violations || 0) + 1
    
    // SECURITY: Cap violations to prevent integer overflow
    data.violations = Math.min(data.violations, 10)
    
    const ttl = Math.ceil(this.config.windowMs / 1000) + 300
    await env.RATE_LIMIT_KV.put(key, JSON.stringify(data), {
      expirationTtl: ttl
    })
  }

  /**
   * SECURITY MEASURE: Comprehensive suspicious activity detection
   */
  private async checkSuspiciousActivity(
    key: string,
    request: Request,
    env: any
  ): Promise<{ isSuspicious: boolean; reasons: string[] }> {
    
    const data = await this.getRateLimitData(key, env)
    const metrics = data.suspiciousActivity
    const reasons: string[] = []
    
    // SECURITY: Check for rapid-fire requests
    if (metrics.rapidFireRequests > 3) {
      reasons.push('rapid_fire_requests')
    }
    
    // SECURITY: Check for excessive failed auth attempts
    if (metrics.failedAuthAttempts > 5) {
      reasons.push('excessive_failed_auth')
    }
    
    // SECURITY: Check for user agent switching (potential bot)
    const userAgent = request.headers.get('User-Agent') || ''
    const userAgentHash = await this.hashString(userAgent)
    
    if (await this.isNewUserAgent(key, userAgentHash, env)) {
      metrics.differentUserAgents++
      if (metrics.differentUserAgents > 3) {
        reasons.push('multiple_user_agents')
      }
    }
    
    // SECURITY: Check for suspicious patterns in request
    const suspiciousPatterns = await this.detectSuspiciousPatterns(request)
    if (suspiciousPatterns.length > 0) {
      metrics.suspiciousPatterns++
      reasons.push(...suspiciousPatterns)
    }
    
    // SECURITY: Check for abnormal request timing
    const now = Date.now()
    if (data.requests.length > 2) {
      const intervals = []
      for (let i = 1; i < data.requests.length; i++) {
        intervals.push(data.requests[i] - data.requests[i-1])
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      if (avgInterval < 100) { // Less than 100ms average
        reasons.push('abnormal_timing')
      }
    }
    
    const isSuspicious = reasons.length >= (this.config.suspiciousActivityThreshold || 2)
    
    // SECURITY: Update metrics
    if (isSuspicious) {
      await this.flagSuspiciousActivity(key, env, reasons.join(','))
    }
    
    return { isSuspicious, reasons }
  }

  /**
   * SECURITY MEASURE: Detect suspicious patterns in requests
   */
  private async detectSuspiciousPatterns(request: Request): Promise<string[]> {
    const patterns: string[] = []
    
    // SECURITY: Check for common attack patterns in URL
    const url = new URL(request.url)
    const suspiciousUrlPatterns = [
      /\.\./,           // Directory traversal
      /<script/i,       // XSS attempts
      /union.*select/i, // SQL injection
      /eval\(/i,        // Code injection
      /javascript:/i,   // JavaScript protocol
      /data:/i,         // Data URI
      /vbscript:/i      // VBScript
    ]
    
    for (const pattern of suspiciousUrlPatterns) {
      if (pattern.test(url.pathname + url.search)) {
        patterns.push('suspicious_url_pattern')
        break
      }
    }
    
    // SECURITY: Check for suspicious headers
    const userAgent = request.headers.get('User-Agent') || ''
    const suspiciousUserAgents = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /python/i,
      /curl/i,
      /wget/i,
      /postman/i
    ]
    
    for (const pattern of suspiciousUserAgents) {
      if (pattern.test(userAgent)) {
        patterns.push('suspicious_user_agent')
        break
      }
    }
    
    // SECURITY: Check for missing common headers
    if (!request.headers.get('Accept') || !request.headers.get('Accept-Language')) {
      patterns.push('missing_browser_headers')
    }
    
    return patterns
  }

  /**
   * SECURITY MEASURE: Flag suspicious activity for monitoring
   */
  private async flagSuspiciousActivity(
    key: string,
    env: any,
    reason: string
  ): Promise<void> {
    
    const suspiciousKey = `suspicious:${key}`
    const now = Date.now()
    
    try {
      const existingData = await env.SUSPICIOUS_ACTIVITY?.get(suspiciousKey)
      const data = existingData ? JSON.parse(existingData) : {
        firstSeen: now,
        lastSeen: now,
        incidents: []
      }
      
      data.lastSeen = now
      data.incidents.push({
        timestamp: now,
        reason,
        severity: this.calculateSeverity(reason)
      })
      
      // SECURITY: Keep only recent incidents
      data.incidents = data.incidents.filter(
        incident => incident.timestamp > now - 86400000 // 24 hours
      )
      
      // SECURITY: Auto-blacklist if too many high-severity incidents
      const highSeverityIncidents = data.incidents.filter(
        incident => incident.severity >= 8
      ).length
      
      if (highSeverityIncidents >= 3) {
        await this.blacklistKey(key, env, 'excessive_suspicious_activity')
      }
      
      await env.SUSPICIOUS_ACTIVITY?.put(suspiciousKey, JSON.stringify(data), {
        expirationTtl: 86400 // 24 hours
      })
      
      console.warn('Suspicious activity detected:', {
        key: key.replace(/rate_limit:/, ''),
        reason,
        timestamp: new Date().toISOString(),
        totalIncidents: data.incidents.length
      })
      
    } catch (error) {
      console.error('Suspicious activity flagging error:', error)
    }
  }

  /**
   * SECURITY MEASURE: Calculate severity score for incidents
   */
  private calculateSeverity(reason: string): number {
    const severityMap: Record<string, number> = {
      'rapid_fire_requests': 6,
      'excessive_failed_auth': 9,
      'multiple_user_agents': 7,
      'suspicious_url_pattern': 8,
      'suspicious_user_agent': 5,
      'missing_browser_headers': 4,
      'abnormal_timing': 6,
      'excessive_rate_limit_violations': 8
    }
    
    return severityMap[reason] || 5
  }

  /**
   * SECURITY MEASURE: Check if key is blacklisted
   */
  private async isBlacklisted(key: string, env: any): Promise<boolean> {
    if (!env.BLACKLIST_KV) {
      return false
    }
    
    const blacklistKey = `blacklist:${key}`
    const blacklistData = await env.BLACKLIST_KV.get(blacklistKey)
    
    return blacklistData !== null
  }

  /**
   * SECURITY MEASURE: Blacklist a key
   */
  private async blacklistKey(key: string, env: any, reason: string): Promise<void> {
    if (!env.BLACKLIST_KV) {
      return
    }
    
    const blacklistKey = `blacklist:${key}`
    const blacklistData = {
      reason,
      timestamp: Date.now(),
      expiresAt: Date.now() + 86400000 // 24 hours
    }
    
    await env.BLACKLIST_KV.put(blacklistKey, JSON.stringify(blacklistData), {
      expirationTtl: 86400 // 24 hours
    })
    
    console.error('Key blacklisted:', {
      key: key.replace(/rate_limit:/, ''),
      reason,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * SECURITY MEASURE: Track user agent changes
   */
  private async isNewUserAgent(key: string, userAgentHash: string, env: any): Promise<boolean> {
    if (!env.USER_AGENTS_KV) {
      return false
    }
    
    const userAgentKey = `ua:${key}`
    const knownUserAgents = await env.USER_AGENTS_KV.get(userAgentKey)
    
    if (!knownUserAgents) {
      await env.USER_AGENTS_KV.put(userAgentKey, JSON.stringify([userAgentHash]), {
        expirationTtl: 86400 // 24 hours
      })
      return false
    }
    
    const userAgentList = JSON.parse(knownUserAgents)
    
    if (!userAgentList.includes(userAgentHash)) {
      userAgentList.push(userAgentHash)
      
      // SECURITY: Limit stored user agents
      if (userAgentList.length > 5) {
        userAgentList.shift() // Remove oldest
      }
      
      await env.USER_AGENTS_KV.put(userAgentKey, JSON.stringify(userAgentList), {
        expirationTtl: 86400 // 24 hours
      })
      
      return true
    }
    
    return false
  }

  /**
   * SECURITY MEASURE: Hash string for comparison
   */
  private async hashString(input: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(input)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * SECURITY MEASURE: Create HTTP response with rate limit headers
   */
  createRateLimitResponse(result: RateLimitResult): Response {
    const headers = new Headers()
    
    if (this.config.standardHeaders) {
      headers.set('RateLimit-Limit', result.limit.toString())
      headers.set('RateLimit-Remaining', result.remaining.toString())
      headers.set('RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString())
    }
    
    if (this.config.legacyHeaders) {
      headers.set('X-RateLimit-Limit', result.limit.toString())
      headers.set('X-RateLimit-Remaining', result.remaining.toString())
      headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString())
    }
    
    if (result.retryAfter) {
      headers.set('Retry-After', result.retryAfter.toString())
    }
    
    headers.set('Content-Type', 'application/json')
    
    const status = result.suspended ? 403 : 429
    const message = result.suspended ? 'Access suspended due to suspicious activity' : 
                   this.config.message || 'Too many requests'
    
    return new Response(JSON.stringify({
      error: message,
      details: {
        limit: result.limit,
        remaining: result.remaining,
        resetTime: result.resetTime,
        suspended: result.suspended,
        suspiciousActivity: result.suspiciousActivity
      }
    }), {
      status,
      headers
    })
  }
}

/**
 * SECURITY MEASURE: Specialized rate limiters for different endpoints
 */
export class AuthRateLimiter extends AdvancedRateLimiter {
  constructor() {
    super({
      windowMs: 900000, // 15 minutes
      maxRequests: 5,   // Very restrictive for auth endpoints
      exponentialBackoff: true,
      suspiciousActivityThreshold: 3,
      message: 'Too many authentication attempts'
    })
  }
}

export class APIRateLimiter extends AdvancedRateLimiter {
  constructor() {
    super({
      windowMs: 60000,  // 1 minute
      maxRequests: 100, // More generous for API endpoints
      exponentialBackoff: false,
      suspiciousActivityThreshold: 5,
      message: 'API rate limit exceeded'
    })
  }
}

export class GlobalRateLimiter extends AdvancedRateLimiter {
  constructor() {
    super({
      windowMs: 60000,  // 1 minute
      maxRequests: 1000, // High limit for global protection
      exponentialBackoff: true,
      suspiciousActivityThreshold: 10,
      message: 'Global rate limit exceeded'
    })
  }
}