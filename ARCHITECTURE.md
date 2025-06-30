# Chess.com Helper MVP Architecture

## System Overview

This document outlines the MVP architecture for the Chess.com Helper application using Cloudflare Workers and D1 database. The MVP focuses on core functionality: user authentication, player subscriptions, and email notifications when monitored players are in active matches.

## MVP Core Services

The MVP architecture consists of three essential services:

### 1. User Service
**Core Responsibilities:**
- User registration and authentication
- Player subscription management
- User preferences and settings

**Domain Entities:**
- `User` (Aggregate Root)
- `PlayerSubscription`
- `UserPreferences`

### 2. Chess.com Monitoring Service
**Core Responsibilities:**
- Monitor Chess.com players for active matches
- Fetch player status via Chess.com API
- Detect when subscribed players start/end games
- Rate limit management

**Domain Entities:**
- `PlayerMonitor` (Aggregate Root)
- `PlayerStatus`
- `MatchEvent`

### 3. Notification Service
**Core Responsibilities:**
- Send email notifications when players are active
- Manage notification preferences
- Handle email delivery and templates

**Domain Entities:**
- `EmailNotification` (Aggregate Root)
- `NotificationTemplate`
- `NotificationPreference`

## MVP Architecture Overview

### Simplified Service Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Service  │    │ Chess.com       │    │ Notification    │
│                 │    │ Monitoring Svc  │    │ Service         │
│ • Auth          │    │                 │    │                 │
│ • Registration  │    │ • Player Status │    │ • Email Alerts  │
│ • Subscriptions │    │ • Match Detection│   │ • Templates     │
│ • Preferences   │    │ • API Polling   │    │ • Scheduling    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Shared Database │
                    │ (Cloudflare D1) │
                    │                 │
                    │ • Users         │
                    │ • Subscriptions │
                    │ • Player Status │
                    │ • Notifications │
                    └─────────────────┘
```

## MVP Context Diagram

```
                           ┌─────────────────┐
                           │   Chess Player  │
                           │     (User)      │
                           └─────────┬───────┘
                                     │
                                     │ Uses
                                     ▼
              ┌─────────────────────────────────────────┐
              │       Chess.com Helper MVP              │
              │                                         │
              │  Monitors players and sends email       │
              │  notifications when they're playing     │
              └─────────────┬───────────────────────────┘
                            │
                            │ Monitors via
                            ▼
              ┌─────────────────────────────────────────┐
              │           Chess.com API                 │
              │                                         │
              │  Provides player status and             │
              │  current game information               │
              └─────────────────────────────────────────┘
                            ▲
                            │
                            │ Sends notifications via
                            │
              ┌─────────────────────────────────────────┐
              │         Email Service                   │
              │                                         │
              │  External email delivery system         │
              │  (Resend, SendGrid, etc.)              │
              └─────────────────────────────────────────┘
```

## MVP API Design

### User Service API

```yaml
/api/v1/auth/register:
  POST:    # Register new user
    body: { email, password }
    response: { userId, token }
  
/api/v1/auth/login:
  POST:    # Login
    body: { email, password }
    response: { token, user }

/api/v1/auth/logout:
  POST:    # Logout
    headers: { Authorization: Bearer <token> }

/api/v1/users/me:
  GET:     # Get current user profile
  PUT:     # Update user profile
  DELETE:  # Delete account

/api/v1/users/me/subscriptions:
  GET:     # Get player subscriptions
  POST:    # Subscribe to a player
    body: { chessComUsername }
  DELETE:  # Unsubscribe from player
    body: { chessComUsername }

/api/v1/users/me/preferences:
  GET:     # Get notification preferences
  PUT:     # Update preferences
    body: { emailNotifications, notificationFrequency }
```

### Chess.com Monitoring Service API

```yaml
/api/v1/monitoring/status:
  GET:     # Get monitoring service status
  
/api/v1/monitoring/players/{username}:
  GET:     # Get current player status
    response: { username, isOnline, currentGame, lastSeen }

# Internal endpoints (used by scheduled jobs)
/internal/monitoring/check:
  POST:    # Trigger player status check
  
/internal/monitoring/poll:
  POST:    # Scheduled polling of all monitored players
```

### Notification Service API

```yaml
/api/v1/notifications/preferences:
  GET:     # Get notification settings for current user
  PUT:     # Update notification preferences

# Internal endpoints
/internal/notifications/send:
  POST:    # Send notification (internal)
    body: { userId, type, data }
    
/internal/notifications/queue:
  POST:    # Queue notification for delivery
    body: { userId, playername, eventType }
```

## MVP Sequence Diagrams

### User Registration & Player Subscription

```
User → User Service: POST /api/v1/auth/register
User Service → D1 Database: Create user record
User Service → User: Return token and userId

User → User Service: POST /api/v1/users/me/subscriptions
User Service → Chess.com Monitoring: Validate player exists
Chess.com Monitoring → Chess.com API: Check player profile
Chess.com API → Chess.com Monitoring: Player profile data
Chess.com Monitoring → User Service: Player validated
User Service → D1 Database: Store subscription
User Service → User: Subscription confirmed
```

### Player Monitoring & Notification Flow

```
Cron Trigger → Chess.com Monitoring: Scheduled poll
Chess.com Monitoring → D1 Database: Get all subscribed players
Chess.com Monitoring → Chess.com API: Check player status (batch)
Chess.com API → Chess.com Monitoring: Player status data

alt Player is now in game
  Chess.com Monitoring → D1 Database: Update player status
  Chess.com Monitoring → Notification Service: Queue notifications
  Notification Service → D1 Database: Get subscribers for player
  Notification Service → Email Service: Send email alerts
  Email Service → Users: Email notifications
end

Chess.com Monitoring → D1 Database: Store status check results
```

## MVP Database Schema

### Core Tables

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Player Subscriptions - tracks which users subscribe to which players
CREATE TABLE player_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chess_com_username TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, chess_com_username),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Player Status - tracks current status of monitored players
CREATE TABLE player_status (
  chess_com_username TEXT PRIMARY KEY,
  is_online BOOLEAN DEFAULT false,
  is_playing BOOLEAN DEFAULT false,
  current_game_url TEXT,
  last_seen DATETIME,
  last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User Preferences table
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  email_notifications BOOLEAN DEFAULT true,
  notification_frequency TEXT DEFAULT 'immediate', -- 'immediate', 'digest', 'disabled'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notification Log - tracks sent notifications to avoid duplicates
CREATE TABLE notification_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chess_com_username TEXT NOT NULL,
  notification_type TEXT NOT NULL, -- 'game_started', 'game_ended'
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  email_delivered BOOLEAN DEFAULT false,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Monitoring Jobs - tracks scheduled monitoring tasks
CREATE TABLE monitoring_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL, -- 'player_check', 'batch_poll'
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  started_at DATETIME,
  completed_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes for Performance

```sql
-- Indexes for efficient queries
CREATE INDEX idx_player_subscriptions_user_id ON player_subscriptions(user_id);
CREATE INDEX idx_player_subscriptions_username ON player_subscriptions(chess_com_username);
CREATE INDEX idx_player_status_last_checked ON player_status(last_checked);
CREATE INDEX idx_notification_log_user_player ON notification_log(user_id, chess_com_username);
CREATE INDEX idx_notification_log_sent_at ON notification_log(sent_at);
CREATE INDEX idx_monitoring_jobs_status ON monitoring_jobs(status);
```

## MVP Implementation Details

### Cloudflare Workers Configuration

```typescript
// wrangler.toml configuration for each service
[env.production]
name = "chess-helper-user-service"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[env.production.d1_databases]]
binding = "DB"
database_name = "chess-helper-production"
database_id = "xxx"

[[env.production.kv_namespaces]]
binding = "CACHE"
id = "xxx"

[env.production.vars]
CHESS_COM_API_URL = "https://api.chess.com/pub"
JWT_SECRET = "xxx"
EMAIL_API_KEY = "xxx"

# Cron trigger for monitoring service
[[env.production.triggers]]
crons = ["*/5 * * * *"] # Check every 5 minutes
```

### Chess.com API Integration

```typescript
// Key endpoints used in MVP
const CHESS_COM_ENDPOINTS = {
  player: (username: string) => `https://api.chess.com/pub/player/${username}`,
  games: (username: string) => `https://api.chess.com/pub/player/${username}/games/current`,
  stats: (username: string) => `https://api.chess.com/pub/player/${username}/stats`
};

// Rate limiting: 300 requests per 5 minutes per IP
// Batch requests when possible to minimize API calls
```

### Email Notification Templates

```yaml
game_started:
  subject: "🎯 {{ playerName }} is now playing on Chess.com!"
  body: |
    {{ playerName }} just started a new game on Chess.com.
    
    You can watch the game live at: {{ gameUrl }}
    
    Unsubscribe from {{ playerName }}: {{ unsubscribeUrl }}

game_ended:
  subject: "♟️ {{ playerName }}'s game has ended"
  body: |
    {{ playerName }}'s game on Chess.com has finished.
    Result: {{ result }}
    
    Manage your subscriptions: {{ settingsUrl }}
```

## MVP Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
1. Set up Cloudflare Workers environment
2. Configure D1 database with MVP schema
3. Implement User Service with JWT authentication
4. Create user registration and login endpoints

### Phase 2: Player Monitoring (Week 3-4)
1. Implement Chess.com Monitoring Service
2. Build Chess.com API client with rate limiting
3. Create player subscription management
4. Add scheduled monitoring jobs

### Phase 3: Notifications (Week 5-6)
1. Implement Notification Service
2. Integrate with email provider (Resend/SendGrid)
3. Create notification templates
4. Add notification preferences

### Phase 4: Testing & Deployment (Week 7-8)
1. Add comprehensive error handling
2. Implement monitoring and logging
3. Performance testing and optimization
4. Production deployment and monitoring

---

## Future Architecture Considerations

*The following features are not part of the MVP but are documented for future development:*

### Advanced Features for Future Releases

#### Game Analysis Service
- Chess engine integration (Stockfish WASM)
- Move-by-move evaluation
- Mistake and blunder detection
- Analysis reports and insights

#### Insights & Analytics Service
- Performance trend calculation
- Statistical analysis generation
- Dashboard data aggregation
- Rating progression tracking

#### Opening Repertoire Service
- Opening classification and tracking
- Success rate calculation
- Repertoire recommendations
- Opponent response analysis

#### Game Collection Service
- Game storage and organization
- Personal note management
- Collection management
- PGN export functionality

### Complex Architecture Patterns for Future Use

#### Event-Driven Architecture
```yaml
Domain Events:
  UserRegistered: { userId, email }
  PlayerSubscribed: { userId, playerName }
  GameDetected: { playerName, gameUrl, timestamp }
  NotificationSent: { userId, playerName, type }
```

#### Event Sourcing Implementation
```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSON NOT NULL,
  version INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Advanced DDD Patterns
- Aggregate boundaries with proper invariants
- Domain services for complex business logic
- Repository patterns with unit of work
- Specification pattern for complex queries

This simplified MVP architecture focuses on delivering core value quickly while maintaining the foundation for future advanced features.