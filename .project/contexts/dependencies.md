# Dependencies & Versions

## Runtime Requirements
- **Node.js**: >=18.0.0
- **Cloudflare Workers**: Latest runtime
- **TypeScript**: ^5.0.0

## Dependencies Status

### ⚠️ IMPORTANT: Installed but NOT Used in Current Implementation

These dependencies are installed in package.json but the main application doesn't import them:

- **@tsndr/cloudflare-worker-jwt** (^3.2.0)
  - Installed but NOT USED - custom JWT implementation used instead
  - Could replace current custom implementation for better security

- **bcryptjs** (^2.4.3)
  - Installed but NOT USED - SHA-256 hashing used instead
  - Should be used for better password security

- **itty-router** (^5.0.0)
  - Installed but NOT USED - manual routing used instead
  - Could simplify routing logic significantly

- **uuid** (^9.0.0)
  - Installed but NOT USED - crypto.randomUUID() used instead
  - Native crypto.randomUUID() is actually preferred

### ✅ Actually Used in Implementation

Only these are actually imported and used:

- **TypeScript** - For type checking and compilation
- **Cloudflare Workers Types** - For TypeScript definitions
- **Built-in Web APIs**:
  - `crypto.subtle` - For SHA-256 hashing and HMAC
  - `crypto.randomUUID()` - For ID generation
  - `TextEncoder/TextDecoder` - For string encoding
  - `btoa/atob` - For base64 encoding

## Development Dependencies

### Cloudflare Tools
- **wrangler** (^4.22.0)
  - Cloudflare Workers CLI tool
  - Local development server
  - Deployment and configuration management
  - Database migrations

- **@cloudflare/workers-types** (^4.20241112.0)
  - TypeScript type definitions for Workers API
  - Environment bindings types
  - D1 database types

### TypeScript & Linting
- **typescript** (^5.0.0)
  - TypeScript compiler
  - Type checking and transpilation

- **@typescript-eslint/eslint-plugin** (^6.21.0)
- **@typescript-eslint/parser** (^6.21.0)
- **eslint** (^8.0.0)
  - Code linting and style enforcement
  - TypeScript-specific rules

### Testing
- **vitest** (^1.0.0)
  - Modern test runner
  - Native TypeScript support
  - Workers environment simulation

### Type Definitions
- **@types/bcryptjs** (^2.4.6)
- **@types/node** (^20.0.0)
- **@types/uuid** (^9.0.0)
  - TypeScript type definitions for dependencies

## External APIs

### Chess.com API
- **Endpoint**: https://api.chess.com/pub/
- **Version**: Public API v1
- **Authentication**: None required for public endpoints
- **Rate Limits**: Respect Chess.com rate limits
- **Currently Used For**: Username validation only
- **Actual Implementation**:
  ```typescript
  const response = await fetch(`https://api.chess.com/pub/player/${username}`)
  if (response.status === 200) // username exists
  ```

## Database

### Cloudflare D1
- **Database Name**: chesscom-helper-db
- **Database ID**: 4b98097e-9152-4056-b6b0-31fbf12152f4 (from .claude/project-config.yml)
- **Type**: SQLite-compatible serverless database
- **Local Development**: Runs via Wrangler with local SQLite
- **Tables in Use**: users, player_subscriptions
- **Tables Defined but Unused**: player_status, user_preferences, notification_log, monitoring_jobs

## Environment Variables

### Actually Required for Current Implementation
```bash
# Required in .dev.vars for local development
JWT_SECRET=dev-secret-key-for-local-testing-only
API_KEY_SALT=dev-salt-for-api-keys-local-testing-only

# Provided by Cloudflare Workers runtime
# No need to set these manually:
# - DB binding (configured in wrangler.toml)
```

### Configured in wrangler.toml
```toml
name = "chesscom-helper"
main = "src/index.ts"
compatibility_date = "2024-06-13"

[[d1_databases]]
binding = "DB"
database_name = "chesscom-helper-db"
database_id = "4b98097e-9152-4056-b6b0-31fbf12152f4"
```

### Future/Planned Variables (Not Yet Used)
```bash
# Email Service (Future)
EMAIL_API_KEY=your-email-api-key
EMAIL_FROM_ADDRESS=noreply@yourdomain.com

# Monitoring (Future)
SENTRY_DSN=your-sentry-dsn
```

## Version Management

### Dependency Updates
- Security updates: Apply immediately
- Minor updates: Monthly review
- Major updates: Quarterly planning
- Test all updates in development first

### Compatibility Matrix
| Dependency | Min Version | Max Version | Notes |
|------------|-------------|-------------|-------|
| Node.js | 18.0.0 | 20.x | LTS versions only |
| TypeScript | 5.0.0 | 5.x | Strict mode required |
| Wrangler | 4.0.0 | 4.x | Keep updated for D1 features |

## Migration Path to Use Installed Dependencies

### Recommended Improvements
1. **Replace SHA-256 with bcrypt**:
   ```typescript
   // Current: await crypto.subtle.digest('SHA-256', data)
   // Better: await bcrypt.hash(password, 10)
   ```

2. **Use itty-router for cleaner routing**:
   ```typescript
   // Instead of manual if/else chains
   import { Router } from 'itty-router'
   const router = Router()
   router.post('/api/auth/register', handleRegister)
   ```

3. **Use @tsndr/cloudflare-worker-jwt**:
   ```typescript
   // Instead of custom JWT implementation
   import jwt from '@tsndr/cloudflare-worker-jwt'
   ```

## Why These Dependencies Were Installed

The installed but unused dependencies suggest the project was initially planned with:
- More secure authentication (bcrypt)
- Cleaner routing patterns (itty-router)
- Standard JWT library usage
- Professional architecture patterns

The current implementation appears to be a simplified MVP that hasn't yet integrated these improvements.

## Security Considerations

### Current Security Gaps
- SHA-256 is too fast for password hashing (vulnerable to brute force)
- Custom JWT implementation may have vulnerabilities
- No rate limiting protection

### Dependency Scanning
- Run `npm audit` before each deployment
- Current status: Check with `npm audit`
- Keep dependencies updated for security patches

### License Compliance
- All current dependencies are MIT licensed ✅
- Safe for commercial use