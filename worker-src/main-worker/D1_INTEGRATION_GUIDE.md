# D1 Integration Guide

This document describes the D1 database integration for the Chess.com Helper Cloudflare Workers.

## Setup

### 1. Create D1 Database

```bash
npx wrangler d1 create chesscom-helper-db
```

This will output a database ID that needs to be added to `wrangler.toml`.

### 2. Update wrangler.toml

Replace `your-database-id-here` in the `wrangler.toml` with your actual D1 database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "chesscom-helper-db" 
database_id = "your-actual-database-id"
```

### 3. Apply Database Schema

```bash
npx wrangler d1 execute chesscom-helper-db --file=./schema.sql
```

## Architecture

### Database Service

The `D1DatabaseService` class provides a clean interface for all database operations:

- **Users**: CRUD operations for Chess.com user profiles
- **Subscriptions**: Email subscription management  
- **Notifications**: Logging notification attempts

### API Handlers

All API handlers now use the D1 binding (`env.DB`) instead of HTTP connections:

```javascript
const db = new DatabaseService(env.DB);
```

### Error Handling

D1-specific error handling patterns:
- Check for `env.DB` availability
- Handle D1 query errors appropriately
- No connection cleanup needed (D1 is managed by Workers runtime)

## Database Schema

The schema includes three main tables:

1. **chesscom_app_user**: User profiles from Chess.com
2. **chesscom_app_emailsubscription**: Email notification subscriptions
3. **chesscom_app_notificationlog**: Notification delivery logs

## Deployment

1. Deploy the schema: `npx wrangler d1 execute chesscom-helper-db --file=./schema.sql`
2. Deploy the worker: `npx wrangler deploy`

## Testing

Test endpoints using the local development server:

```bash
npx wrangler dev --local --persist
```

This will use a local SQLite database for testing.

## Migration from Previous System

The D1 integration replaces the previous HTTP-based database bridge. All existing functionality is preserved with improved performance and reduced latency.