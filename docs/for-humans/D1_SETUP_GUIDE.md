# Cloudflare D1 Setup Guide

This comprehensive guide will walk you through setting up Cloudflare D1 for the Chess.com Helper application, migrating from PostgreSQL to a serverless SQLite database.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Creating D1 Database](#creating-d1-database)
4. [Configuring Wrangler](#configuring-wrangler)
5. [Setting Up Database Schema](#setting-up-database-schema)
6. [Configuring Workers Bindings](#configuring-workers-bindings)
7. [Running Migrations](#running-migrations)
8. [Data Import Process](#data-import-process)
9. [Deployment](#deployment)
10. [Validation and Testing](#validation-and-testing)
11. [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting, ensure you have the following installed and configured:

### Required Software

1. **Node.js** (version 18 or higher)
   ```bash
   node --version  # Should output v18.x.x or higher
   ```

2. **Wrangler CLI** (version 3.x)
   ```bash
   npm install -g wrangler@latest
   wrangler --version  # Should output 3.x.x
   ```

3. **Git** (for version control)
   ```bash
   git --version
   ```

### Cloudflare Account Setup

1. **Cloudflare Account**
   - Sign up at [cloudflare.com](https://cloudflare.com) if you don't have an account
   - Verify your email address

2. **Wrangler Authentication**
   ```bash
   wrangler login
   ```
   This will open a browser window to authenticate with Cloudflare

3. **Verify Authentication**
   ```bash
   wrangler whoami
   ```
   Should display your Cloudflare account email

### Environment Preparation

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd chesscom-helper
   ```

2. **Install Dependencies**
   ```bash
   # Install main project dependencies
   npm install
   
   # Install worker dependencies
   cd worker-src/main-worker
   npm install
   cd ../cron-worker
   npm install
   cd ../..
   ```

## Initial Setup

### 1. Verify Current Branch

Ensure you're on the correct branch for D1 migration:

```bash
git status
git branch  # Should show you're on fix/cloudflare-deployment-config or similar
```

### 2. Review Current Configuration

Check the existing wrangler.toml files:

```bash
# Main worker configuration
cat worker-src/main-worker/wrangler.toml

# Cron worker configuration  
cat worker-src/cron-worker/wrangler.toml
```

## Creating D1 Database

### 1. Create the D1 Database

Create your D1 database using Wrangler:

```bash
wrangler d1 create chesscom-helper-db
```

**Expected Output:**
```
✅ Successfully created DB 'chesscom-helper-db' in region APAC
Created your database using D1's new storage backend. The new storage backend is not yet recommended for production workloads, but backs up your data via point-in-time restore.

[[d1_databases]]
binding = "DB"
database_name = "chesscom-helper-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Important:** Save the `database_id` from the output - you'll need it for configuration.

### 2. List Your D1 Databases (Verification)

Verify the database was created:

```bash
wrangler d1 list
```

**Expected Output:**
```
┌──────────────────────┬──────────────────────────────────────┬─────────┐
│ Name                 │ UUID                                 │ Version │
├──────────────────────┼──────────────────────────────────────┼─────────┤
│ chesscom-helper-db   │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │ β       │
└──────────────────────┴──────────────────────────────────────┴─────────┘
```

## Configuring Wrangler

### 1. Update Main Worker Configuration

Edit `worker-src/main-worker/wrangler.toml`:

```toml
name = "chesscom-helper"
main = "src/index.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[build]
command = "npm run build"

# Assets for React frontend
[assets]
bucket = "./dist"
include = ["**/*"]

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "chesscom-helper-db"
database_id = "YOUR_DATABASE_ID_HERE"

# Environment variables
[vars]
CHESS_COM_API_BASE = "https://api.chess.com/pub"
FRONTEND_URL = "https://chesscom-helper.emily-flambe.workers.dev"

[triggers]
crons = []
```

**Replace `YOUR_DATABASE_ID_HERE`** with the actual database ID from step 1.

### 2. Update Cron Worker Configuration (if applicable)

Edit `worker-src/cron-worker/wrangler.toml`:

```toml
name = "chesscom-helper-cron"
main = "src/index.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "chesscom-helper-db"
database_id = "YOUR_DATABASE_ID_HERE"

# Environment variables
[vars]
CHESS_COM_API_BASE = "https://api.chess.com/pub"

# Cron triggers
[triggers]
crons = ["0 */5 * * * *"]  # Every 5 minutes
```

## Setting Up Database Schema

### 1. Create Schema File

Create a new file `database/schema.sql` in your project root:

```bash
mkdir -p database
```

Create `database/schema.sql`:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS chesscom_app_user (
    player_id INTEGER PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100),
    url VARCHAR(200),
    country VARCHAR(2),
    location VARCHAR(100),
    followers INTEGER,
    last_online INTEGER,
    joined INTEGER,
    status VARCHAR(20),
    league VARCHAR(50),
    is_streamer BOOLEAN DEFAULT FALSE,
    verified BOOLEAN DEFAULT FALSE,
    is_playing BOOLEAN DEFAULT FALSE,
    streaming_platforms TEXT DEFAULT '[]'
);

-- Email subscriptions table
CREATE TABLE IF NOT EXISTS chesscom_app_emailsubscription (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(254) NOT NULL,
    player_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (player_id) REFERENCES chesscom_app_user (player_id),
    UNIQUE(email, player_id)
);

-- Notification log table
CREATE TABLE IF NOT EXISTS chesscom_app_notificationlog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    sent_at DATETIME NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    FOREIGN KEY (subscription_id) REFERENCES chesscom_app_emailsubscription (id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_username ON chesscom_app_user(username);
CREATE INDEX IF NOT EXISTS idx_subscription_player ON chesscom_app_emailsubscription(player_id);
CREATE INDEX IF NOT EXISTS idx_subscription_active ON chesscom_app_emailsubscription(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_subscription ON chesscom_app_notificationlog(subscription_id);
CREATE INDEX IF NOT EXISTS idx_notification_sent_at ON chesscom_app_notificationlog(sent_at);
```

### 2. Apply Schema to D1 Database

Execute the schema against your D1 database:

```bash
wrangler d1 execute chesscom-helper-db --file=database/schema.sql
```

**Expected Output:**
```
🌀 Mapping SQL input into an array of statements
🌀 Parsing 8 statements
🌀 Executing on chesscom-helper-db (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx):
🌀 To execute on your remote database, add a --remote flag to your wrangler command.
🚣 Executed 8 commands in 0.123ms
✅ Success! All commands executed successfully.
```

### 3. Verify Schema Creation

Check that tables were created:

```bash
wrangler d1 execute chesscom-helper-db --command="SELECT name FROM sqlite_master WHERE type='table';"
```

**Expected Output:**
```
┌─────────────────────────────────┐
│ name                            │
├─────────────────────────────────┤
│ chesscom_app_user              │
├─────────────────────────────────┤
│ chesscom_app_emailsubscription │
├─────────────────────────────────┤
│ chesscom_app_notificationlog   │
└─────────────────────────────────┘
```

## Configuring Workers Bindings

The D1DatabaseService is already implemented in your codebase. Verify it exists:

```bash
cat worker-src/main-worker/src/services/database.js
```

The service should include methods like:
- `getUsers()`
- `getUserByUsername(username)`
- `addUser(userData)`
- `removeUser(username)`
- `updateUserStatus(username, isPlaying)`
- `getSubscriptions(username)`
- `addSubscription(playerId, email)`
- `removeSubscription(playerId, email)`
- `logNotification(notificationData)`

## Running Migrations

### 1. Test Local Development Setup

First, test the schema with local development:

```bash
cd worker-src/main-worker
wrangler dev --local
```

This starts a local development server with D1 emulation.

### 2. Test Database Connection

In another terminal, test the API endpoints:

```bash
# Test basic connectivity
curl http://localhost:8787/api/users

# Should return empty array initially: []
```

### 3. Test Schema with Sample Data

Add a test user to verify the schema:

```bash
wrangler d1 execute chesscom-helper-db --command="INSERT INTO chesscom_app_user (player_id, username, name, joined, last_online) VALUES (123456, 'testuser', 'Test User', 1640995200, 1640995200);"
```

Query the data:

```bash
wrangler d1 execute chesscom-helper-db --command="SELECT * FROM chesscom_app_user;"
```

Clean up test data:

```bash
wrangler d1 execute chesscom-helper-db --command="DELETE FROM chesscom_app_user WHERE username = 'testuser';"
```

## Data Import Process

### 1. Export Existing PostgreSQL Data

If you have existing data to migrate, use the export script:

```bash
# Set environment variables for PostgreSQL connection
export POSTGRES_HOST="your-host"
export POSTGRES_DB="your-database"
export POSTGRES_USER="your-username"
export POSTGRES_PASSWORD="your-password"

# Run the export script
python scripts/export_postgresql_data.py --output-dir migration_data --validate
```

### 2. Transform Data for D1

The export script creates JSON files. For large datasets, you may need to batch import:

```bash
# Create import script (example for users table)
cat > import_users.js << 'EOF'
const fs = require('fs');

async function importUsers() {
  const data = JSON.parse(fs.readFileSync('migration_data/chesscom_app_user.json', 'utf8'));
  const users = data.data;
  
  // Process in batches of 100 (D1 limit)
  const batchSize = 100;
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    const statements = batch.map(user => ({
      sql: `INSERT OR REPLACE INTO chesscom_app_user (
        player_id, username, name, url, country, location, followers,
        last_online, joined, status, league, is_streamer, verified,
        is_playing, streaming_platforms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        user.player_id, user.username, user.name, user.url,
        user.country, user.location, user.followers, user.last_online,
        user.joined, user.status, user.league, user.is_streamer,
        user.verified, user.is_playing,
        JSON.stringify(user.streaming_platforms || [])
      ]
    }));
    
    console.log(`Importing batch ${Math.floor(i/batchSize) + 1}...`);
    // Execute batch - this would need to be done via wrangler command or API
  }
}

importUsers().catch(console.error);
EOF
```

### 3. Import Data Using D1 API

For programmatic import, use the D1 HTTP API or batch operations through wrangler.

## Deployment

### 1. Build the Application

```bash
cd worker-src/main-worker
npm run build
```

### 2. Deploy to Cloudflare

```bash
npm run deploy
```

**Expected Output:**
```
✨ Build completed successfully!
Your worker has been published to https://chesscom-helper.emily-flambe.workers.dev
```

### 3. Apply Schema to Production Database

```bash
wrangler d1 execute chesscom-helper-db --file=../../database/schema.sql --remote
```

The `--remote` flag ensures you're executing against the production D1 database.

## Validation and Testing

### 1. Test API Endpoints

Test all major endpoints:

```bash
# Test user endpoints
curl https://chesscom-helper.emily-flambe.workers.dev/api/users
curl https://chesscom-helper.emily-flambe.workers.dev/api/users/test-username

# Test subscription endpoints (if applicable)
curl -X POST https://chesscom-helper.emily-flambe.workers.dev/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "username": "test-user"}'
```

### 2. Verify Database Operations

Check data persistence:

```bash
# Check table contents
wrangler d1 execute chesscom-helper-db --command="SELECT COUNT(*) as user_count FROM chesscom_app_user;" --remote

# Check recent activity
wrangler d1 execute chesscom-helper-db --command="SELECT * FROM chesscom_app_user ORDER BY last_online DESC LIMIT 5;" --remote
```

### 3. Monitor Application Logs

```bash
wrangler tail chesscom-helper
```

### 4. Performance Testing

Test response times and error rates:

```bash
# Simple load test
for i in {1..10}; do
  curl -w "%{time_total}\n" -o /dev/null -s https://chesscom-helper.emily-flambe.workers.dev/api/users
done
```

## Validation Checklist

After completing setup, verify:

- [ ] D1 database created successfully
- [ ] Wrangler configuration updated with correct database ID
- [ ] Database schema applied without errors
- [ ] All tables and indexes created
- [ ] Worker can connect to D1 database
- [ ] API endpoints return expected responses
- [ ] Data operations (CRUD) work correctly
- [ ] Application deploys successfully
- [ ] Production database accessible
- [ ] Monitoring and logging working
- [ ] Performance meets expectations

## Next Steps

1. **Set up monitoring** - Configure alerts for errors and performance
2. **Implement backup strategy** - D1 provides automatic backups, but consider export routines
3. **Optimize queries** - Monitor slow queries and add indexes as needed
4. **Scale testing** - Test with production-like data volumes
5. **Documentation** - Update API documentation and deployment guides

## Additional Resources

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [D1 SQL Reference](https://developers.cloudflare.com/d1/platform/client-api/)
- [Workers KV vs D1 Guide](https://developers.cloudflare.com/d1/learning/data-location/)

## Support

If you encounter issues:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review Cloudflare D1 status page
3. Check application logs with `wrangler tail`
4. Verify database connectivity with test queries
5. Consult the migration team or project maintainers