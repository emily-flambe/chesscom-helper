# Architecture

## Current Implementation

### Technology Stack (Active)
- **Runtime**: Cloudflare Workers (Edge Computing)
- **Language**: TypeScript 5.0+ with strict mode
- **Database**: Cloudflare D1 (SQLite)
- **Authentication**: Custom JWT implementation using Web Crypto API
- **Password Hashing**: SHA-256 (using crypto.subtle.digest)
- **Routing**: Manual if/else based routing in main handler
- **Testing**: Vitest for unit and integration tests

### Installed but Unused Dependencies
- **itty-router**: Installed but not imported
- **@tsndr/cloudflare-worker-jwt**: Installed but custom implementation used instead
- **bcryptjs**: Installed but SHA-256 used instead

## Current Architecture Pattern

### Monolithic Design (src/index.ts)
- All application logic in a single file
- Manual request routing with conditional statements
- Inline authentication and business logic
- Direct database access without abstraction layer

### Code Structure in index.ts
```typescript
// Main components:
- hashPassword() / verifyPassword() - Custom auth using SHA-256
- createJWT() / verifyJWT() - Custom JWT implementation
- authenticateRequest() - Auth middleware function
- Main fetch() handler with routing logic
- Inline HTML generation for UI
```

## Prepared Architecture (Not Yet Integrated)

### Directory Structure
```
src/
├── index.ts          # Current monolithic implementation
├── routes/           # Prepared but unused route handlers
│   ├── auth.ts       # Authentication routes
│   ├── monitoring.ts # Player monitoring routes
│   ├── notifications.ts # Notification routes
│   └── users.ts      # User management routes
├── services/         # Prepared service layer
│   ├── auth.ts       # Authentication service
│   ├── chess.ts      # Chess.com API service
│   ├── email.ts      # Email service
│   ├── monitoring.ts # Monitoring service
│   └── notification.ts # Notification service
├── auth/             # Prepared auth modules
│   ├── jwt.ts        # JWT utilities
│   ├── middleware.ts # Auth middleware
│   └── permissions.ts # Permission system
├── utils/            # Utility functions
│   └── validation.ts # Input validation (partially used)
├── models/           # TypeScript interfaces
└── jobs/             # Background job handlers
```

## Database Schema (From migrations/0001_initial_schema.sql)

### Core Tables

```sql
-- Users table (no username field in actual schema)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Player Subscriptions (main relationship table)
CREATE TABLE player_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chess_com_username TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, chess_com_username),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Player Status tracking
CREATE TABLE player_status (
  chess_com_username TEXT PRIMARY KEY,
  is_online BOOLEAN DEFAULT false,
  is_playing BOOLEAN DEFAULT false,
  current_game_url TEXT,
  last_seen DATETIME,
  last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Additional tables (defined but not yet used in main app)
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  email_notifications BOOLEAN DEFAULT true,
  notification_frequency TEXT DEFAULT 'immediate',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE notification_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chess_com_username TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  email_delivered BOOLEAN DEFAULT false,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE monitoring_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  started_at DATETIME,
  completed_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Current API Implementation

### Active Endpoints
- `POST /api/auth/register` - User registration (email + password)
- `POST /api/auth/login` - User login
- `GET /api/players` - Get monitored players (authenticated)
- `POST /api/monitor` - Add player to monitor list (authenticated)
- `GET /health` - Health check
- `GET /` - HTML interface

### Request/Response Format
```typescript
// Error response
{ error: string }

// Success response varies by endpoint
{ token: string } // login
{ success: true, message: string } // generic success
{ players: Array<{username: string, addedAt: string}> } // list players
```

### Authentication Implementation
1. User registers with email/password (no username)
2. Password hashed with SHA-256
3. Custom JWT creation with 7-day expiration
4. Bearer token validation on protected routes
5. Manual auth check in each endpoint

## Performance Characteristics

### Current Implementation
- Single file (~800 lines) loads quickly
- Minimal dependencies reduce cold start time
- Direct database queries without ORM overhead
- Inline HTML reduces separate asset requests

### Edge Computing Benefits
- Global distribution through Cloudflare network
- Automatic scaling with demand
- Low latency for end users
- No server management required

## Security Implementation

### Current Security Measures
- SHA-256 password hashing (less secure than bcrypt)
- Custom JWT with HMAC-SHA256 signatures
- Input validation for email and password
- Prepared statements prevent SQL injection
- Manual CORS headers in responses

### Security Gaps
- No rate limiting implemented
- No session management/revocation
- SHA-256 is fast but less secure for passwords
- No password complexity requirements enforced
- No account lockout after failed attempts

## Development Workflow

### Local Development
- `npm run dev` starts Wrangler dev server
- D1 database runs locally via Wrangler
- Environment variables in `.dev.vars`
- Hot reload on file changes

### Database Management
- Migrations in `database/migrations/`
- Apply with `npm run db:migrate`
- Local studio: `npm run db:studio`
- Seeds in `database/seeds/` for test data