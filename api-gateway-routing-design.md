# Chess.com Helper API Gateway Routing Design

## Overview

This document provides comprehensive API routing specifications for the Chess.com Helper notification service built on Cloudflare Workers. The design focuses on efficient edge routing, Chess.com API integration with proper rate limiting, and optimized data flow between services.

## API Gateway Architecture

### Edge-First Routing Strategy

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │  API Gateway    │    │   Backend       │
│                 │    │  (Edge Worker)  │    │   Services      │
│ • Web Frontend  │ -> │                 │ -> │                 │
│ • Mobile Apps   │    │ • Auth          │    │ • User Service  │
│ • Third Party   │    │ • Rate Limiting │    │ • Monitor Svc   │
│                 │    │ • Validation    │    │ • Notification  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ External APIs   │
                       │                 │
                       │ • Chess.com     │
                       │ • Email Service │
                       │ • Auth Provider │
                       └─────────────────┘
```

## API Routing Specifications

### 1. Authentication & Authorization Routes

#### Public Authentication Endpoints

```yaml
/api/v1/auth/register:
  methods: [POST]
  middleware: 
    - request_validation
    - rate_limiting (5 requests/minute per IP)
  handler: auth_service
  cache: none
  timeout: 10s
  
/api/v1/auth/login:
  methods: [POST]
  middleware:
    - request_validation
    - rate_limiting (10 requests/minute per IP)
    - brute_force_protection
  handler: auth_service
  cache: none
  timeout: 10s

/api/v1/auth/logout:
  methods: [POST]
  middleware:
    - jwt_validation
  handler: auth_service
  cache: none
  timeout: 5s

/api/v1/auth/refresh:
  methods: [POST]
  middleware:
    - refresh_token_validation
    - rate_limiting (20 requests/hour per user)
  handler: auth_service
  cache: none
  timeout: 5s

/api/v1/auth/forgot-password:
  methods: [POST]
  middleware:
    - request_validation
    - rate_limiting (3 requests/hour per email)
  handler: auth_service
  cache: none
  timeout: 15s

/api/v1/auth/reset-password:
  methods: [POST]
  middleware:
    - request_validation
    - token_validation
    - rate_limiting (5 requests/hour per IP)
  handler: auth_service
  cache: none
  timeout: 10s
```

#### OAuth Integration Routes

```yaml
/api/v1/auth/oauth/initiate:
  methods: [GET]
  middleware:
    - csrf_protection
    - rate_limiting (10 requests/minute per IP)
  handler: oauth_service
  cache: none
  timeout: 5s

/api/v1/auth/oauth/callback:
  methods: [GET, POST]
  middleware:
    - csrf_validation
    - state_validation
  handler: oauth_service
  cache: none
  timeout: 30s
```

### 2. User Management Routes

#### User Profile Management

```yaml
/api/v1/users/me:
  methods: [GET, PUT, DELETE]
  middleware:
    - jwt_validation
    - user_context_injection
  cache:
    GET: 5 minutes (per user)
    PUT/DELETE: none
  timeout: 10s
  
/api/v1/users/me/preferences:
  methods: [GET, PUT]
  middleware:
    - jwt_validation
    - user_context_injection
  cache:
    GET: 10 minutes (per user)
    PUT: none
  timeout: 5s

/api/v1/users/me/subscription-summary:
  methods: [GET]
  middleware:
    - jwt_validation
    - user_context_injection
  cache: 2 minutes (per user)
  timeout: 10s
```

#### Player Subscription Management

```yaml
/api/v1/users/me/subscriptions:
  methods: [GET, POST]
  middleware:
    - jwt_validation
    - user_context_injection
    - rate_limiting (GET: 100/hour, POST: 20/hour per user)
  cache:
    GET: 5 minutes (per user)
    POST: none
  timeout: 15s

/api/v1/users/me/subscriptions/{chess_username}:
  methods: [GET, DELETE]
  middleware:
    - jwt_validation
    - user_context_injection
    - chess_username_validation
  cache:
    GET: 5 minutes (per user + username)
    DELETE: none
  timeout: 10s

/api/v1/users/me/subscriptions/batch:
  methods: [POST, DELETE]
  middleware:
    - jwt_validation
    - user_context_injection
    - batch_size_validation (max 10 players)
    - rate_limiting (5 requests/hour per user)
  cache: none
  timeout: 30s
```

### 3. Chess.com Integration Routes

#### Player Information & Validation

```yaml
/api/v1/chess/players/{username}:
  methods: [GET]
  middleware:
    - jwt_validation
    - chess_username_validation
    - chess_api_rate_limiting
  cache: 15 minutes (global per username)
  timeout: 10s
  upstream: chess.com API

/api/v1/chess/players/{username}/validate:
  methods: [GET]
  middleware:
    - jwt_validation
    - chess_username_validation
    - chess_api_rate_limiting
  cache: 1 hour (global per username)
  timeout: 5s
  upstream: chess.com API

/api/v1/chess/players/search:
  methods: [GET]
  query_params: [query, limit]
  middleware:
    - jwt_validation
    - search_query_validation
    - rate_limiting (30 requests/hour per user)
  cache: 30 minutes (per query)
  timeout: 10s
  upstream: chess.com API
```

#### Real-time Player Status

```yaml
/api/v1/chess/players/{username}/status:
  methods: [GET]
  middleware:
    - jwt_validation
    - user_subscription_check
    - chess_api_rate_limiting
  cache: 2 minutes (global per username)
  timeout: 8s
  upstream: chess.com API

/api/v1/chess/players/{username}/current-game:
  methods: [GET]
  middleware:
    - jwt_validation
    - user_subscription_check
    - chess_api_rate_limiting
  cache: 1 minute (global per username)
  timeout: 8s
  upstream: chess.com API
```

### 4. Notification Management Routes

#### User Notification Preferences

```yaml
/api/v1/notifications/preferences:
  methods: [GET, PUT]
  middleware:
    - jwt_validation
    - user_context_injection
  cache:
    GET: 10 minutes (per user)
    PUT: none
  timeout: 5s

/api/v1/notifications/preferences/{chess_username}:
  methods: [GET, PUT]
  middleware:
    - jwt_validation
    - user_context_injection
    - user_subscription_check
  cache:
    GET: 10 minutes (per user + username)
    PUT: none
  timeout: 5s
```

#### Notification History & Management

```yaml
/api/v1/notifications/history:
  methods: [GET]
  query_params: [limit, offset, from_date, to_date]
  middleware:
    - jwt_validation
    - user_context_injection
    - pagination_validation
  cache: 5 minutes (per user + params)
  timeout: 10s

/api/v1/notifications/unsubscribe/{token}:
  methods: [GET, POST]
  middleware:
    - unsubscribe_token_validation
    - rate_limiting (10 requests/hour per token)
  cache: none
  timeout: 5s
```

### 5. System Health & Monitoring Routes

#### Public Health Checks

```yaml
/api/health:
  methods: [GET]
  middleware: none
  cache: 30 seconds (global)
  timeout: 3s

/api/health/detailed:
  methods: [GET]
  middleware:
    - admin_api_key_validation
  cache: none
  timeout: 10s
```

#### Internal Monitoring Routes

```yaml
/internal/monitoring/player-check:
  methods: [POST]
  middleware:
    - internal_service_auth
    - request_validation
  cache: none
  timeout: 25s

/internal/monitoring/batch-poll:
  methods: [POST]
  middleware:
    - internal_service_auth
    - cron_trigger_validation
  cache: none
  timeout: 25s

/internal/notifications/send:
  methods: [POST]
  middleware:
    - internal_service_auth
    - notification_payload_validation
  cache: none
  timeout: 15s

/internal/notifications/queue:
  methods: [POST]
  middleware:
    - internal_service_auth
    - queue_payload_validation
  cache: none
  timeout: 5s
```

## Rate Limiting Strategies

### Chess.com API Rate Limiting

**Constraint**: 300 requests per 5 minutes per IP address

```typescript
interface ChessComRateLimiter {
  // Global rate limiting for Chess.com API
  globalLimit: {
    requests: 280, // 20 request buffer
    window: 300,   // 5 minutes
    storage: 'KV'  // Cloudflare KV
  };
  
  // Per-endpoint specific limits
  endpointLimits: {
    '/player/{username}': {
      requests: 100,
      window: 300,
      cache: 900 // 15 minutes
    },
    '/player/{username}/games/current': {
      requests: 150,
      window: 300,
      cache: 60 // 1 minute
    }
  };
  
  // Smart batching strategy
  batchStrategy: {
    maxBatchSize: 10,
    batchWindow: 5, // seconds
    priorityQueue: true
  };
}
```

### User-Facing API Rate Limiting

```typescript
interface UserRateLimits {
  // Authentication endpoints
  auth: {
    login: { requests: 10, window: 60 },      // per IP
    register: { requests: 5, window: 60 },    // per IP
    refresh: { requests: 20, window: 3600 }   // per user
  };
  
  // User operations
  subscriptions: {
    create: { requests: 20, window: 3600 },   // per user
    batch: { requests: 5, window: 3600 },     // per user
    list: { requests: 100, window: 3600 }     // per user
  };
  
  // Chess.com data access
  chessData: {
    playerInfo: { requests: 50, window: 3600 }, // per user
    playerStatus: { requests: 200, window: 3600 }, // per user
    search: { requests: 30, window: 3600 }     // per user
  };
}
```

## Caching Strategies

### Multi-Level Caching Architecture

```typescript
interface CachingStrategy {
  // Level 1: Edge Cache (Cloudflare CDN)
  edgeCache: {
    publicData: {
      ttl: 1800,        // 30 minutes
      headers: ['Cache-Control', 'ETag'],
      vary: ['Accept-Language']
    }
  };
  
  // Level 2: Worker KV Cache
  kvCache: {
    userProfiles: { ttl: 600 },      // 10 minutes
    playerData: { ttl: 900 },        // 15 minutes
    chessComData: { ttl: 300 },      // 5 minutes
    rateLimitCounters: { ttl: 300 }  // 5 minutes
  };
  
  // Level 3: D1 Query Result Cache
  queryCache: {
    subscriptionLists: { ttl: 300 }, // 5 minutes
    userPreferences: { ttl: 600 },   // 10 minutes
    notificationHistory: { ttl: 120 } // 2 minutes
  };
}
```

### Cache Invalidation Patterns

```typescript
interface CacheInvalidation {
  // User-triggered invalidation
  userActions: {
    'subscription.created': ['user.subscriptions', 'user.summary'],
    'preferences.updated': ['user.preferences', 'notification.settings'],
    'profile.updated': ['user.profile', 'user.context']
  };
  
  // System-triggered invalidation
  systemEvents: {
    'player.status.changed': ['player.status.*', 'player.currentGame.*'],
    'chess.api.updated': ['chess.player.*'],
    'notification.sent': ['notification.history.*']
  };
  
  // Time-based invalidation
  scheduledInvalidation: {
    'chess.com.data': '*/5 * * * *',    // Every 5 minutes
    'player.status': '*/2 * * * *',     // Every 2 minutes
    'rate.limits': '*/1 * * * *'        // Every minute
  };
}
```

## Error Handling Patterns

### Hierarchical Error Handling

```typescript
interface ErrorHandlingStrategy {
  // HTTP Status Code Mapping
  statusCodes: {
    // Client errors (4xx)
    400: 'Invalid request format or parameters',
    401: 'Authentication required or invalid token',
    403: 'Insufficient permissions for resource',
    404: 'Resource not found',
    409: 'Resource conflict (duplicate subscription)',
    422: 'Validation failed for request data',
    429: 'Rate limit exceeded',
    
    // Server errors (5xx)
    500: 'Internal server error',
    502: 'Upstream service unavailable',
    503: 'Service temporarily unavailable',
    504: 'Upstream service timeout'
  };
  
  // Error Response Format
  errorFormat: {
    error: {
      code: string,        // machine-readable error code
      message: string,     // human-readable message
      details?: object,    // additional context
      requestId: string,   // for debugging
      timestamp: string    // ISO 8601 timestamp
    }
  };
}
```

### Circuit Breaker Patterns

```typescript
interface CircuitBreakerConfig {
  chessComAPI: {
    failureThreshold: 5,      // failures before opening
    resetTimeout: 30000,      // 30 seconds
    monitoringWindow: 60000,  // 1 minute
    fallbackStrategy: 'cached_data'
  };
  
  emailService: {
    failureThreshold: 3,
    resetTimeout: 60000,      // 1 minute
    monitoringWindow: 300000, // 5 minutes
    fallbackStrategy: 'queue_for_retry'
  };
  
  database: {
    failureThreshold: 2,
    resetTimeout: 10000,      // 10 seconds
    monitoringWindow: 30000,  // 30 seconds
    fallbackStrategy: 'read_only_mode'
  };
}
```

## Request/Response Flow Optimization

### Efficient Data Flow Patterns

```typescript
interface DataFlowOptimization {
  // Request Pipeline
  requestPipeline: [
    'authentication',      // JWT validation (5ms)
    'authorization',       // Permission check (3ms)
    'rate_limiting',       // Rate limit check (2ms)
    'request_validation',  // Schema validation (5ms)
    'cache_lookup',        // Cache check (3ms)
    'upstream_request',    // Service call (varies)
    'response_processing', // Data transformation (5ms)
    'cache_update',        // Cache population (2ms)
    'response_formatting'  // Final formatting (2ms)
  ];
  
  // Parallel Processing
  parallelOperations: {
    'user_subscriptions_get': [
      'fetch_subscriptions',
      'fetch_player_status',
      'fetch_notification_preferences'
    ],
    'chess_player_info': [
      'fetch_basic_profile',
      'fetch_current_status',
      'check_subscription_status'
    ]
  };
  
  // Streaming Responses
  streamingEndpoints: [
    '/api/v1/notifications/history',
    '/api/v1/users/me/subscriptions',
    '/internal/monitoring/batch-poll'
  ];
}
```

### Response Optimization

```typescript
interface ResponseOptimization {
  // Conditional Responses
  conditionalHeaders: {
    'ETag': 'content-hash',
    'Last-Modified': 'resource-timestamp',
    'Cache-Control': 'max-age, must-revalidate'
  };
  
  // Compression Strategy
  compression: {
    algorithm: 'brotli', // fallback to gzip
    minSize: 1024,       // compress responses > 1KB
    contentTypes: [
      'application/json',
      'text/html',
      'text/css',
      'application/javascript'
    ]
  };
  
  // Partial Responses
  partialSupport: {
    endpoints: ['/api/v1/notifications/history'],
    headers: ['Range', 'Content-Range'],
    maxRangeSize: 1000 // maximum items per range
  };
}
```

## API Versioning Strategy

### Version Management

```typescript
interface APIVersioning {
  // URL-based versioning (primary)
  urlVersioning: {
    pattern: '/api/v{major}/...',
    currentVersion: 'v1',
    supportedVersions: ['v1'],
    deprecationPolicy: '6 months notice'
  };
  
  // Header-based versioning (fallback)
  headerVersioning: {
    header: 'API-Version',
    default: 'v1',
    acceptedFormats: ['v1', '1', '1.0']
  };
  
  // Backward compatibility
  compatibility: {
    breaking_changes: 'new_major_version',
    feature_additions: 'same_version_with_feature_flags',
    bug_fixes: 'same_version'
  };
}
```

## Security Patterns

### Authentication & Authorization

```typescript
interface SecurityPatterns {
  // JWT Configuration
  jwt: {
    algorithm: 'RS256',
    issuer: 'chesscom-helper-api',
    audience: 'chesscom-helper-users',
    expirationTime: 3600,      // 1 hour
    refreshExpirationTime: 604800, // 7 days
    clockTolerance: 30         // 30 seconds
  };
  
  // API Key Management
  apiKeys: {
    format: 'chh_live_xxxxx',
    scopes: ['read', 'write', 'admin'],
    rateLimits: 'per_key_configuration',
    rotation: 'monthly_recommended'
  };
  
  // CORS Configuration
  cors: {
    allowedOrigins: [
      'https://chesscom-helper.app',
      'https://*.chesscom-helper.app'
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'API-Version'],
    maxAge: 86400 // 24 hours
  };
}
```

### Request Validation

```typescript
interface RequestValidation {
  // Schema Validation
  schemas: {
    'POST /api/v1/auth/register': {
      email: 'email_format',
      password: 'min_8_chars_complex'
    },
    'POST /api/v1/users/me/subscriptions': {
      chessComUsername: 'chess_username_format'
    }
  };
  
  // Sanitization Rules
  sanitization: {
    username: 'alphanumeric_underscore_hyphen',
    email: 'email_normalization',
    query_params: 'html_entity_decode'
  };
  
  // Size Limits
  limits: {
    requestBody: 10485760,    // 10MB
    queryString: 8192,        // 8KB
    headers: 32768,           // 32KB
    batchOperations: 10       // max items
  };
}
```

## Performance Monitoring

### Key Performance Indicators

```typescript
interface PerformanceMetrics {
  // Latency Metrics
  latency: {
    p50: '<100ms',    // 50th percentile
    p95: '<500ms',    // 95th percentile
    p99: '<1000ms',   // 99th percentile
    timeout: '30s'    // hard timeout
  };
  
  // Throughput Metrics
  throughput: {
    requestsPerSecond: 1000,
    concurrentUsers: 500,
    batchOperations: 50
  };
  
  // Error Rate Metrics
  errorRates: {
    overall: '<1%',
    authentication: '<0.1%',
    chessApiIntegration: '<2%',
    databaseOperations: '<0.5%'
  };
  
  // Resource Utilization
  resources: {
    memoryUsage: '<100MB',
    cpuTime: '<25s',
    databaseConnections: '<50',
    kvOperations: '<1000/min'
  };
}
```

### Alerting Thresholds

```typescript
interface AlertingConfig {
  critical: {
    errorRate: '>5%',
    latencyP95: '>2000ms',
    memoryUsage: '>120MB',
    cpuTime: '>28s'
  };
  
  warning: {
    errorRate: '>2%',
    latencyP95: '>1000ms',
    memoryUsage: '>80MB',
    rateLimitHit: '>80%'
  };
  
  info: {
    errorRate: '>0.5%',
    latencyP95: '>500ms',
    unusualTraffic: '>150% normal'
  };
}
```

## Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1-2)
1. **API Gateway Foundation**
   - Set up Cloudflare Workers environment
   - Implement basic routing framework
   - Add request/response middleware system
   - Configure D1 database connections

2. **Authentication System**
   - JWT token validation middleware
   - Rate limiting framework
   - Basic error handling patterns
   - CORS configuration

### Phase 2: User & Chess.com Integration (Week 3-4)
1. **User Management Routes**
   - Authentication endpoints
   - User profile management
   - Subscription management APIs
   - Preference configuration

2. **Chess.com API Integration**
   - Player data fetching with rate limiting
   - Status monitoring endpoints
   - Search functionality
   - Caching implementation

### Phase 3: Notifications & Monitoring (Week 5-6)
1. **Notification System**
   - Notification preference management
   - History and tracking endpoints
   - Unsubscribe functionality
   - Email integration

2. **System Monitoring**
   - Health check endpoints
   - Internal monitoring routes
   - Performance metrics collection
   - Alerting configuration

### Phase 4: Optimization & Production (Week 7-8)
1. **Performance Optimization**
   - Advanced caching strategies
   - Response compression
   - Query optimization
   - Load testing and tuning

2. **Production Readiness**
   - Security hardening
   - Error handling refinements
   - Monitoring dashboard setup
   - Documentation completion

## Conclusion

This comprehensive API Gateway routing design provides a robust foundation for the Chess.com Helper notification service. The design emphasizes:

1. **Edge-optimized routing** that leverages Cloudflare Workers' global distribution
2. **Intelligent rate limiting** that respects Chess.com API constraints while providing good user experience
3. **Multi-level caching** that reduces latency and API calls
4. **Comprehensive error handling** with circuit breaker patterns and graceful degradation
5. **Security-first approach** with proper authentication, authorization, and input validation
6. **Performance monitoring** with detailed metrics and alerting

The modular design allows for incremental implementation while maintaining the flexibility to adapt to changing requirements and scale with user growth.