/**
 * JWT Validation Middleware for Cloudflare Workers Edge Authentication
 * 
 * Security Features:
 * - Cryptographic JWT signature validation
 * - Token expiration enforcement
 * - Issuer and audience validation
 * - Defense against timing attacks
 * - Secure error handling without information leakage
 * - Rate limiting integration
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

export interface JWTPayload {
  sub: string;      // Subject (user ID)
  email: string;    // User email
  iat: number;      // Issued at
  exp: number;      // Expiration time
  iss: string;      // Issuer
  aud: string;      // Audience
  jti: string;      // JWT ID for revocation
  scope?: string;   // Optional scope/permissions
}

export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}

export interface JWTMiddlewareConfig {
  secret: string;
  issuer: string;
  audience: string;
  maxAge?: number;  // Maximum token age in seconds
  clockTolerance?: number; // Clock skew tolerance in seconds
}

/**
 * SECURITY MEASURE: Constant-time string comparison to prevent timing attacks
 * This prevents attackers from inferring token validity through response timing
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * SECURITY MEASURE: Secure token extraction with validation
 * Prevents header injection and ensures proper format
 */
function extractTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return null;
  }
  
  // SECURITY: Validate Bearer token format to prevent injection
  const bearerMatch = authHeader.match(/^Bearer\s+([A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_+/=]*)$/);
  
  if (!bearerMatch) {
    return null;
  }
  
  return bearerMatch[1];
}

/**
 * SECURITY MEASURE: Token validation with comprehensive security checks
 */
async function validateJWTToken(
  token: string,
  config: JWTMiddlewareConfig,
  env: any
): Promise<JWTPayload | null> {
  try {
    // SECURITY: Decode without verification first to check basic structure
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.payload) {
      return null;
    }
    
    // SECURITY: Verify cryptographic signature
    const isValid = await jwt.verify(token, config.secret);
    if (!isValid) {
      return null;
    }
    
    const payload = decoded.payload as JWTPayload;
    
    // SECURITY: Additional validation checks
    const now = Math.floor(Date.now() / 1000);
    
    // Check if token is expired (with clock tolerance)
    if (payload.exp && payload.exp < (now - (config.clockTolerance || 60))) {
      return null;
    }
    
    // Check if token is too old (additional security measure)
    if (config.maxAge && payload.iat && (now - payload.iat) > config.maxAge) {
      return null;
    }
    
    // SECURITY: Validate issuer with constant-time comparison
    if (!constantTimeEquals(payload.iss, config.issuer)) {
      return null;
    }
    
    // SECURITY: Validate audience with constant-time comparison
    if (!constantTimeEquals(payload.aud, config.audience)) {
      return null;
    }
    
    // SECURITY: Check if token is revoked (using JWT ID)
    if (payload.jti) {
      const isRevoked = await env.REVOKED_TOKENS?.get(payload.jti);
      if (isRevoked) {
        return null;
      }
    }
    
    return payload;
    
  } catch (error) {
    // SECURITY: Log error for monitoring but don't expose details
    console.error('JWT validation error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    
    return null;
  }
}

/**
 * SECURITY MEASURE: Secure error responses that don't leak information
 */
function createUnauthorizedResponse(reason?: string): Response {
  // SECURITY: Generic error message to prevent information leakage
  const response = new Response('Unauthorized', {
    status: 401,
    headers: {
      'Content-Type': 'text/plain',
      'WWW-Authenticate': 'Bearer realm="api"',
      // SECURITY: Prevent caching of error responses
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
  
  // SECURITY: Log security events for monitoring
  if (reason) {
    console.warn('Authentication failed:', {
      reason,
      timestamp: new Date().toISOString(),
      userAgent: 'redacted' // Don't log user agent for privacy
    });
  }
  
  return response;
}

/**
 * JWT Authentication Middleware Factory
 * 
 * SECURITY FEATURES:
 * - Cryptographic signature validation
 * - Comprehensive token validation
 * - Timing attack prevention
 * - Information leakage prevention
 * - Token revocation support
 */
export function createJWTMiddleware(config: JWTMiddlewareConfig) {
  return async function jwtMiddleware(
    request: Request,
    env: any,
    ctx: ExecutionContext
  ): Promise<{ request: AuthenticatedRequest; user: JWTPayload } | Response> {
    
    // SECURITY: Rate limiting check before processing
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitResult = await checkRateLimit(clientIP, env);
    
    if (!rateLimitResult.allowed) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          'Content-Type': 'text/plain'
        }
      });
    }
    
    // Extract token from request
    const token = extractTokenFromRequest(request);
    
    if (!token) {
      return createUnauthorizedResponse('missing_token');
    }
    
    // Validate JWT token
    const payload = await validateJWTToken(token, config, env);
    
    if (!payload) {
      return createUnauthorizedResponse('invalid_token');
    }
    
    // SECURITY: Create authenticated request object
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = payload;
    
    return {
      request: authenticatedRequest,
      user: payload
    };
  };
}

/**
 * SECURITY MEASURE: Rate limiting implementation
 * Prevents brute force attacks and API abuse
 */
interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  remainingRequests?: number;
}

async function checkRateLimit(
  identifier: string,
  env: any,
  windowMs: number = 900000, // 15 minutes
  maxRequests: number = 100
): Promise<RateLimitResult> {
  
  if (!env.RATE_LIMIT_KV) {
    // If rate limiting storage is not available, allow request
    return { allowed: true };
  }
  
  const key = `rate_limit:auth:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  
  try {
    // SECURITY: Get current request count for this window
    const currentData = await env.RATE_LIMIT_KV.get(key);
    const current = currentData ? JSON.parse(currentData) : { count: 0, windowStart: now };
    
    // Reset window if expired
    if (current.windowStart < windowStart) {
      current.count = 0;
      current.windowStart = now;
    }
    
    // Check if limit exceeded
    if (current.count >= maxRequests) {
      const retryAfter = Math.ceil((current.windowStart + windowMs - now) / 1000);
      return {
        allowed: false,
        retryAfter
      };
    }
    
    // Increment counter
    current.count++;
    
    // Store updated count with TTL
    await env.RATE_LIMIT_KV.put(key, JSON.stringify(current), {
      expirationTtl: Math.ceil(windowMs / 1000)
    });
    
    return {
      allowed: true,
      remainingRequests: maxRequests - current.count
    };
    
  } catch (error) {
    // SECURITY: If rate limiting fails, log but allow request to prevent service disruption
    console.error('Rate limiting error:', error);
    return { allowed: true };
  }
}

/**
 * SECURITY MEASURE: Token revocation utility
 * Allows immediate invalidation of compromised tokens
 */
export async function revokeToken(jti: string, env: any, ttl?: number): Promise<void> {
  if (!env.REVOKED_TOKENS || !jti) {
    return;
  }
  
  try {
    // Store revoked token with TTL matching token expiration
    await env.REVOKED_TOKENS.put(jti, 'revoked', {
      expirationTtl: ttl || 86400 // 24 hours default
    });
    
    console.info('Token revoked:', {
      jti: jti.substring(0, 8) + '...', // Log partial JTI for tracking
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Token revocation error:', error);
    throw new Error('Failed to revoke token');
  }
}

/**
 * SECURITY MEASURE: Optional middleware for protected routes
 * Simplified interface for routes that require authentication
 */
export function requireAuth(config: JWTMiddlewareConfig) {
  const middleware = createJWTMiddleware(config);
  
  return async function(
    request: Request,
    env: any,
    ctx: ExecutionContext,
    handler: (req: AuthenticatedRequest, user: JWTPayload) => Promise<Response>
  ): Promise<Response> {
    
    const result = await middleware(request, env, ctx);
    
    // If result is a Response, it's an error (401, 429, etc.)
    if (result instanceof Response) {
      return result;
    }
    
    // Otherwise, call the protected handler
    return handler(result.request, result.user);
  };
}