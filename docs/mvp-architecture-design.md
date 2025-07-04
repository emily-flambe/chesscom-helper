# Chess.com Helper MVP Architecture Design
## API-First, Domain-Driven Design with Cloudflare Workers + D1

## Executive Summary

This document outlines the MVP architecture for Chess.com Helper, focusing on the core notification functionality while maintaining extensibility for future features. The architecture leverages Cloudflare Workers + D1 with clean domain boundaries and API-first design principles.

## MVP Scope Analysis

Based on PRD analysis, the MVP includes:

### Core Features (MVP)
1. **User Authentication & Account Management** 
2. **Player Subscription Management**
3. **Email Notifications** for Chess.com player match activity

### Future Features (Post-MVP)
- Game analysis, insights dashboard, opening repertoire tracking (as outlined in ARCHITECTURE.md)

## Domain-Driven Design (MVP Focus)

### Bounded Contexts (MVP)

#### 1. User Management Context
**Aggregate Root**: `User`
**Entities**: `UserSession`, `UserPreferences`

**Responsibilities**:
- User registration/authentication
- Password management
- Account preferences
- Session management

#### 2. Player Subscription Context  
**Aggregate Root**: `PlayerSubscription`
**Entities**: `ChessComPlayer`, `NotificationSettings`

**Responsibilities**:
- Managing player subscriptions
- Chess.com player validation
- Notification preferences per player

#### 3. Notification Service Context
**Aggregate Root**: `NotificationJob`
**Entities**: `EmailTemplate`, `NotificationHistory`

**Responsibilities**:
- Email notification delivery
- Template management
- Notification scheduling and tracking

#### 4. Chess.com Integration Context
**Aggregate Root**: `PlayerMonitor`
**Entities**: `PlayerStatus`, `MatchEvent`

**Responsibilities**:
- Chess.com API integration
- Player status monitoring
- Match event detection
- Rate limit management

## API-First Design

### REST API Specification (MVP)

#### Authentication Service API
```yaml
/api/v1/auth:
  POST /register:
    body: { email: string, password: string }
    response: { userId: string, token: string }
    
  POST /login:
    body: { email: string, password: string }
    response: { token: string, user: UserProfile }
    
  POST /logout:
    headers: { Authorization: "Bearer <token>" }
    response: { success: boolean }
    
  POST /reset-password:
    body: { email: string }
    response: { success: boolean }
    
  POST /reset-password/confirm:
    body: { token: string, newPassword: string }
    response: { success: boolean }

/api/v1/users/{userId}:
  GET:
    headers: { Authorization: "Bearer <token>" }
    response: UserProfile
    
  PUT:
    headers: { Authorization: "Bearer <token>" }
    body: { email?: string, preferences?: UserPreferences }
    response: UserProfile
    
  DELETE:
    headers: { Authorization: "Bearer <token>" }
    response: { success: boolean }
```

#### Player Subscription API
```yaml
/api/v1/subscriptions:
  GET:
    headers: { Authorization: "Bearer <token>" }
    response: { subscriptions: PlayerSubscription[] }
    
  POST:
    headers: { Authorization: "Bearer <token>" }
    body: { 
      chessComUsername: string,
      notificationSettings: {
        matchStart: boolean,
        matchEnd: boolean,
        emailEnabled: boolean
      }
    }
    response: PlayerSubscription
    
/api/v1/subscriptions/{subscriptionId}:
  GET:
    headers: { Authorization: "Bearer <token>" }
    response: PlayerSubscription
    
  PUT:
    headers: { Authorization: "Bearer <token>" }
    body: { notificationSettings: NotificationSettings }
    response: PlayerSubscription
    
  DELETE:
    headers: { Authorization: "Bearer <token>" }
    response: { success: boolean }

/api/v1/players/search:
  GET:
    headers: { Authorization: "Bearer <token>" }
    query: { username: string }
    response: { players: ChessComPlayerInfo[] }
    
/api/v1/players/{username}/validate:
  GET:
    headers: { Authorization: "Bearer <token>" }
    response: { valid: boolean, playerInfo: ChessComPlayerInfo }
```

#### Notification Management API
```yaml
/api/v1/notifications/preferences:
  GET:
    headers: { Authorization: "Bearer <token>" }
    response: GlobalNotificationPreferences
    
  PUT:
    headers: { Authorization: "Bearer <token>" }
    body: GlobalNotificationPreferences
    response: GlobalNotificationPreferences

/api/v1/notifications/history:
  GET:
    headers: { Authorization: "Bearer <token>" }
    query: { limit?: number, offset?: number }
    response: { 
      notifications: NotificationHistory[],
      total: number,
      hasMore: boolean
    }

/api/v1/notifications/unsubscribe:
  POST:
    body: { token: string }
    response: { success: boolean }
```

### Data Models (TypeScript)

```typescript
// Core Domain Models
interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  preferences: UserPreferences;
}

interface UserPreferences {
  emailNotifications: boolean;
  timezone: string;
  language: string;
}

interface PlayerSubscription {
  id: string;
  userId: string;
  chessComUsername: string;
  playerInfo: ChessComPlayerInfo;
  notificationSettings: NotificationSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ChessComPlayerInfo {
  username: string;
  displayName?: string;
  countryCode?: string;
  currentRating?: number;
  isOnline: boolean;
  isPlaying: boolean;
  lastSeen?: Date;
}

interface NotificationSettings {
  matchStart: boolean;
  matchEnd: boolean;
  emailEnabled: boolean;
}

interface NotificationJob {
  id: string;
  userId: string;
  subscriptionId: string;
  type: 'match_start' | 'match_end';
  playerUsername: string;
  matchInfo: MatchInfo;
  status: 'pending' | 'sent' | 'failed';
  scheduledAt: Date;
  sentAt?: Date;
  createdAt: Date;
}

interface MatchInfo {
  gameId: string;
  opponent: string;
  timeControl: string;
  gameUrl: string;
  startedAt: Date;
}
```

## Cloudflare Workers Architecture

### Worker Services (MVP)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │    │  Auth Service   │    │ Subscription    │
│   Worker        │ -> │   Worker        │    │   Service       │
│                 │    │                 │    │   Worker        │
│ • Routing       │    │ • JWT Auth      │    │ • Player Mgmt   │
│ • Rate Limiting │    │ • User CRUD     │    │ • Chess.com API │
│ • CORS          │    │ • Password Mgmt │    │ • Validation    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────│  D1 Database    │──────────────┘
                        │  + KV Store     │
         ┌──────────────│                 │──────────────┐
         │              └─────────────────┘              │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Notification   │    │  Chess.com      │    │  Email Service  │
│   Service       │    │  Monitor        │    │   Worker        │
│   Worker        │    │  Worker (Cron)  │    │                 │
│                 │    │                 │    │ • Email Sending │
│ • Queue Mgmt    │    │ • Player Status │    │ • Templates     │
│ • Scheduling    │    │ • Match Events  │    │ • Delivery Logs │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### D1 Database Schema (MVP)

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User preferences table
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  email_notifications BOOLEAN DEFAULT true,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Player subscriptions table
CREATE TABLE player_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chess_com_username TEXT NOT NULL,
  display_name TEXT,
  current_rating INTEGER,
  country_code TEXT,
  match_start_notifications BOOLEAN DEFAULT true,
  match_end_notifications BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, chess_com_username)
);

-- Player status tracking
CREATE TABLE player_status (
  chess_com_username TEXT PRIMARY KEY,
  is_online BOOLEAN DEFAULT false,
  is_playing BOOLEAN DEFAULT false,
  current_game_id TEXT,
  current_opponent TEXT,
  last_checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notification jobs queue
CREATE TABLE notification_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'match_start' or 'match_end'
  player_username TEXT NOT NULL,
  match_data JSON NOT NULL, -- MatchInfo as JSON
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  scheduled_at DATETIME NOT NULL,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subscription_id) REFERENCES player_subscriptions(id)
);

-- Notification history
CREATE TABLE notification_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  email_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_name TEXT NOT NULL,
  delivery_status TEXT NOT NULL, -- 'delivered', 'bounced', 'failed'
  sent_at DATETIME NOT NULL,
  delivered_at DATETIME,
  error_message TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (job_id) REFERENCES notification_jobs(id)
);

-- Rate limiting table
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0,
  window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_player_subscriptions_user_id ON player_subscriptions(user_id);
CREATE INDEX idx_player_subscriptions_username ON player_subscriptions(chess_com_username);
CREATE INDEX idx_notification_jobs_status ON notification_jobs(status);
CREATE INDEX idx_notification_jobs_scheduled ON notification_jobs(scheduled_at);
CREATE INDEX idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX idx_rate_limits_expires ON rate_limits(expires_at);
```

## Event-Driven Communication (MVP)

### Domain Events

```typescript
// MVP Domain Events
interface UserRegistered {
  userId: string;
  email: string;
  timestamp: Date;
}

interface PlayerSubscriptionCreated {
  subscriptionId: string;
  userId: string;
  chessComUsername: string;
  notificationSettings: NotificationSettings;
  timestamp: Date;
}

interface PlayerMatchStarted {
  playerUsername: string;
  gameId: string;
  opponent: string;
  timeControl: string;
  gameUrl: string;
  timestamp: Date;
}

interface PlayerMatchEnded {
  playerUsername: string;
  gameId: string;
  result: string;
  timestamp: Date;
}

interface NotificationScheduled {
  jobId: string;
  userId: string;
  type: string;
  scheduledAt: Date;
  timestamp: Date;
}
```

### Event Processing Workflow

```
Chess.com Monitor (Cron) → Player Status Change → Event Bus (KV)
                                                        ↓
Notification Service ← Event Processing ← Subscription Service
       ↓
Email Service → External Email Provider → Delivery Tracking
```

## Implementation Plan with Collaborative Agents

### Phase 1: Foundation & Authentication (Architect + Builder)

**Architect Agent Responsibilities:**
- Design authentication flow and JWT strategy
- Define database schema and migrations
- Plan security measures and rate limiting
- Design error handling patterns

**Builder Agent Responsibilities:**
- Implement User Service Worker
- Create authentication endpoints
- Build JWT middleware
- Set up D1 database and migrations
- Implement password hashing and validation

**Deliverables:**
- `auth-service/` Worker implementation
- Database schema and migrations
- JWT authentication middleware
- User registration/login endpoints

### Phase 2: Player Subscription Management (Architect + Builder)

**Architect Agent Responsibilities:**
- Design Chess.com API integration patterns
- Plan rate limiting and caching strategies
- Design subscription management workflows
- Define player validation logic

**Builder Agent Responsibilities:**
- Implement Subscription Service Worker
- Build Chess.com API client
- Create player search and validation
- Implement subscription CRUD operations
- Add rate limiting and error handling

**Deliverables:**
- `subscription-service/` Worker implementation
- Chess.com API integration
- Player management endpoints
- Subscription management UI components

### Phase 3: Notification System (Architect + Builder)

**Architect Agent Responsibilities:**
- Design notification scheduling system
- Plan email template management
- Design monitoring and alerting workflows
- Define cron job patterns for player monitoring

**Builder Agent Responsibilities:**
- Implement Notification Service Worker
- Build email sending functionality
- Create Chess.com monitoring cron jobs
- Implement notification queue processing
- Add delivery tracking and history

**Deliverables:**
- `notification-service/` Worker implementation
- `chess-monitor/` Cron Worker
- Email service integration
- Notification management dashboard

### Phase 4: Integration & Testing (Collaborative)

**Shared Responsibilities:**
- End-to-end testing of notification flow
- Performance optimization and monitoring
- Security testing and vulnerability assessment
- Documentation and deployment guides

**Deliverables:**
- Complete MVP application
- Testing suite and documentation
- Deployment configuration
- Monitoring and alerting setup

## Technical Considerations

### Performance Optimization
- **KV Caching**: Cache Chess.com player data and API responses
- **D1 Read Replicas**: Use for read-heavy subscription queries
- **Batch Processing**: Process notifications in batches for efficiency
- **Connection Pooling**: Optimize external API connections

### Security Measures
- **JWT with short expiry**: 15-minute access tokens with refresh tokens
- **Rate Limiting**: Per-user and per-IP rate limits
- **Input Validation**: Comprehensive validation on all endpoints
- **CORS Configuration**: Strict CORS policies for web interface

### Scalability Patterns
- **Horizontal Database Scaling**: Per-tenant D1 databases for large scale
- **Worker Auto-scaling**: Leverage Cloudflare's automatic scaling
- **Queue-based Processing**: Async processing for heavy operations
- **Circuit Breaker**: Graceful degradation for external dependencies

### Monitoring & Observability
- **Health Checks**: Endpoint health monitoring
- **Performance Metrics**: Response times and error rates
- **Business Metrics**: User engagement and notification success rates
- **Alerting**: Critical failure notifications

## Future Extensibility

This MVP architecture is designed to seamlessly extend into the full vision outlined in ARCHITECTURE.md:

- **Additional Bounded Contexts**: Game Analysis, Insights, Opening Repertoire
- **Event Sourcing**: Already designed with event-driven patterns
- **Microservices**: Clean service boundaries for easy service addition
- **API Versioning**: Designed for backward compatibility

The collaborative architect + builder agent approach ensures both solid architectural foundations and practical implementation that delivers working software incrementally.

## Success Criteria

### Technical Success
- Sub-200ms API response times
- 99.9% notification delivery rate
- Zero security vulnerabilities
- Scalable to 10,000+ users

### Business Success
- User registration and activation flow
- Reliable Chess.com player monitoring
- Timely notification delivery (within 5 minutes)
- High user satisfaction with notification accuracy

This architecture provides a robust foundation for the Chess.com Helper MVP while maintaining the flexibility to evolve into the comprehensive platform envisioned in the full architecture specification.