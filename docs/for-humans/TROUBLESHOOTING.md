# D1 Migration Troubleshooting Guide

This guide covers common issues, error messages, and solutions you may encounter during the PostgreSQL to D1 migration.

## Table of Contents

1. [Pre-Migration Issues](#pre-migration-issues)
2. [D1 Database Setup Issues](#d1-database-setup-issues)
3. [Schema and Migration Issues](#schema-and-migration-issues)
4. [Worker Integration Issues](#worker-integration-issues)
5. [Data Import Issues](#data-import-issues)
6. [Production Deployment Issues](#production-deployment-issues)
7. [Performance Issues](#performance-issues)
8. [Error Reference](#error-reference)
9. [Debugging Tools](#debugging-tools)
10. [Emergency Procedures](#emergency-procedures)

## Pre-Migration Issues

### Wrangler Authentication Problems

**Error:** `Error: You need to be logged in to use this command`

**Solutions:**
```bash
# Re-authenticate with Cloudflare
wrangler login

# If browser doesn't open automatically
wrangler login --scopes-list

# Verify authentication
wrangler whoami
```

**Error:** `Error: Unknown account ID`

**Solutions:**
```bash
# List available accounts
wrangler accounts

# Set specific account
wrangler accounts set [account-id]
```

### Version Compatibility Issues

**Error:** `Error: Wrangler version X.X.X is not supported`

**Solutions:**
```bash
# Update to latest version
npm install -g wrangler@latest

# Check version
wrangler --version

# If using yarn
yarn global add wrangler@latest
```

**Error:** `Node.js version too old`

**Solutions:**
```bash
# Check current version
node --version

# Update Node.js to 18+ using nvm
nvm install 18
nvm use 18

# Or update using your package manager
```

## D1 Database Setup Issues

### Database Creation Problems

**Error:** `Error: A database with this name already exists`

**Solutions:**
```bash
# List existing databases
wrangler d1 list

# Use existing database or delete and recreate
wrangler d1 delete chesscom-helper-db

# Create with a different name
wrangler d1 create chesscom-helper-db-v2
```

**Error:** `Error: You have reached the maximum number of D1 databases`

**Solutions:**
```bash
# List all databases
wrangler d1 list

# Delete unused databases
wrangler d1 delete unused-database-name

# Check plan limits on Cloudflare dashboard
```

### Database Connection Issues

**Error:** `Error: Database binding not found`

**Solutions:**
1. **Check wrangler.toml configuration:**
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "chesscom-helper-db"
   database_id = "your-actual-database-id"
   ```

2. **Verify database ID:**
   ```bash
   wrangler d1 list
   # Copy the correct UUID to wrangler.toml
   ```

3. **Restart development server:**
   ```bash
   wrangler dev --local
   ```

## Schema and Migration Issues

### Schema Application Errors

**Error:** `Error: SQL syntax error`

**Solutions:**
1. **Check SQLite compatibility:**
   ```sql
   -- PostgreSQL syntax (wrong)
   CREATE TABLE users (
       id SERIAL PRIMARY KEY
   );
   
   -- SQLite syntax (correct)
   CREATE TABLE users (
       id INTEGER PRIMARY KEY AUTOINCREMENT
   );
   ```

2. **Validate schema file:**
   ```bash
   # Test schema locally first
   sqlite3 test.db < database/schema.sql
   ```

**Error:** `Error: table already exists`

**Solutions:**
1. **Add IF NOT EXISTS:**
   ```sql
   CREATE TABLE IF NOT EXISTS chesscom_app_user (
       -- table definition
   );
   ```

2. **Drop and recreate (development only):**
   ```bash
   wrangler d1 execute chesscom-helper-db --command="DROP TABLE IF EXISTS chesscom_app_user;"
   wrangler d1 execute chesscom-helper-db --file=database/schema.sql
   ```

### Foreign Key Constraint Issues

**Error:** `Error: FOREIGN KEY constraint failed`

**Solutions:**
1. **Enable foreign key constraints:**
   ```sql
   PRAGMA foreign_keys = ON;
   ```

2. **Check data insertion order:**
   ```bash
   # Insert parent records first
   # Insert users before subscriptions
   # Insert subscriptions before notifications
   ```

3. **Validate foreign key references:**
   ```sql
   -- Check if referenced user exists
   SELECT player_id FROM chesscom_app_user WHERE player_id = ?;
   ```

## Worker Integration Issues

### Database Binding Errors

**Error:** `TypeError: Cannot read property 'prepare' of undefined`

**Solutions:**
1. **Check environment binding:**
   ```javascript
   // In worker code
   export default {
     async fetch(request, env, ctx) {
       console.log('DB binding:', env.DB); // Should not be undefined
       const db = new D1DatabaseService(env.DB);
       // ...
     }
   };
   ```

2. **Verify wrangler.toml binding:**
   ```toml
   [[d1_databases]]
   binding = "DB"  # Must match env.DB in code
   ```

3. **Restart development server:**
   ```bash
   wrangler dev --local
   ```

### Query Execution Errors

**Error:** `Error: D1_QUERY_FAILED`

**Solutions:**
1. **Check SQL syntax:**
   ```javascript
   // Wrong - missing question marks
   const result = await db.prepare("SELECT * FROM users WHERE id = " + id).all();
   
   // Correct - parameterized query
   const result = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).all();
   ```

2. **Validate parameter binding:**
   ```javascript
   // Check parameter count matches
   const stmt = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");
   const result = await stmt.bind(name, email).run();
   ```

3. **Handle JSON fields properly:**
   ```javascript
   // Serialize JSON before storing
   const streamingPlatforms = JSON.stringify(userData.streaming_platforms || []);
   
   // Deserialize after reading
   result.streaming_platforms = JSON.parse(result.streaming_platforms || '[]');
   ```

### Local Development Issues

**Error:** `Error: Local D1 database not found`

**Solutions:**
1. **Use --local flag:**
   ```bash
   wrangler dev --local
   ```

2. **Clear local storage:**
   ```bash
   rm -rf .wrangler/state
   wrangler dev --local
   ```

3. **Check local schema:**
   ```bash
   # Re-apply schema to local D1
   wrangler d1 execute chesscom-helper-db --file=database/schema.sql --local
   ```

## Data Import Issues

### Large Data Import Problems

**Error:** `Error: Request too large`

**Solutions:**
1. **Reduce batch size:**
   ```javascript
   // Reduce from 1000 to 100 or smaller
   const batchSize = 100;
   ```

2. **Use D1 batch API:**
   ```javascript
   const statements = batch.map(item => ({
     sql: "INSERT INTO table (...) VALUES (...)",
     params: [/* parameters */]
   }));
   
   await env.DB.batch(statements);
   ```

3. **Add delays between batches:**
   ```javascript
   for (const batch of batches) {
     await importBatch(batch);
     await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
   }
   ```

### Data Type Conversion Issues

**Error:** `Error: Invalid JSON in streaming_platforms`

**Solutions:**
1. **Validate JSON before insertion:**
   ```javascript
   const streamingPlatforms = userData.streaming_platforms;
   const jsonString = Array.isArray(streamingPlatforms) 
     ? JSON.stringify(streamingPlatforms)
     : '[]';
   ```

2. **Handle null values:**
   ```javascript
   const safeValue = value || null;
   const jsonValue = value ? JSON.stringify(value) : '[]';
   ```

### Foreign Key Import Issues

**Error:** `Error: FOREIGN KEY constraint failed during import`

**Solutions:**
1. **Import in correct order:**
   ```bash
   # 1. Import users first
   # 2. Import subscriptions second
   # 3. Import notifications last
   ```

2. **Validate references before import:**
   ```javascript
   // Check if user exists before adding subscription
   const user = await db.prepare("SELECT player_id FROM chesscom_app_user WHERE player_id = ?")
     .bind(subscription.player_id).first();
   
   if (!user) {
     console.warn(`User ${subscription.player_id} not found, skipping subscription`);
     continue;
   }
   ```

## Production Deployment Issues

### Deployment Failures

**Error:** `Error: Failed to publish worker`

**Solutions:**
1. **Check build process:**
   ```bash
   npm run build
   # Check for build errors
   ```

2. **Verify configuration:**
   ```bash
   # Validate wrangler.toml syntax
   wrangler validate
   ```

3. **Check account limits:**
   ```bash
   wrangler accounts
   # Verify you're not exceeding plan limits
   ```

### Production Database Issues

**Error:** `Error: Database not found in production`

**Solutions:**
1. **Apply schema to production:**
   ```bash
   wrangler d1 execute chesscom-helper-db --file=database/schema.sql --remote
   ```

2. **Verify database binding:**
   ```bash
   # Check that database exists
   wrangler d1 list
   
   # Verify binding in production
   wrangler tail chesscom-helper
   ```

## Performance Issues

### Slow Query Performance

**Symptoms:** Response times > 1000ms

**Solutions:**
1. **Add missing indexes:**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_user_username ON chesscom_app_user(username);
   CREATE INDEX IF NOT EXISTS idx_subscription_player ON chesscom_app_emailsubscription(player_id);
   ```

2. **Optimize queries:**
   ```javascript
   // Instead of loading all data
   const { results } = await db.prepare("SELECT * FROM users").all();
   
   // Use specific columns and limits
   const { results } = await db.prepare(
     "SELECT username, name FROM users LIMIT 100"
   ).all();
   ```

### High Error Rates

**Symptoms:** Multiple 500 errors in production

**Solutions:**
1. **Add error logging:**
   ```javascript
   try {
     const result = await db.prepare("...").all();
     return result;
   } catch (error) {
     console.error('Database error:', error);
     throw new Error('Database operation failed');
   }
   ```

2. **Check D1 limits:**
   - Query size limits
   - Request rate limits
   - Concurrent connection limits

## Error Reference

### Common D1 Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| `D1_QUERY_FAILED` | SQL query failed | Check SQL syntax and parameters |
| `D1_BINDING_NOT_FOUND` | Database binding missing | Update wrangler.toml configuration |
| `D1_REQUEST_TOO_LARGE` | Request exceeds size limit | Reduce batch size or data size |
| `D1_RATE_LIMITED` | Too many requests | Add delays between requests |
| `D1_CONNECTION_FAILED` | Can't connect to database | Check network and configuration |

### HTTP Status Codes

| Status | Meaning | Common Cause |
|--------|---------|--------------|
| 400 | Bad Request | Invalid query parameters |
| 404 | Not Found | Endpoint or resource doesn't exist |
| 500 | Internal Error | Database connection or query error |
| 503 | Service Unavailable | D1 service temporarily unavailable |

## Debugging Tools

### Wrangler Debugging Commands

```bash
# View worker logs in real-time
wrangler tail chesscom-helper

# Execute test queries
wrangler d1 execute chesscom-helper-db --command="SELECT COUNT(*) FROM chesscom_app_user;"

# Check D1 database status
wrangler d1 info chesscom-helper-db

# List all databases
wrangler d1 list

# Validate configuration
wrangler validate
```

### Local Testing Commands

```bash
# Start local development with debugging
wrangler dev --local --log-level=debug

# Test specific endpoints
curl -v http://localhost:8787/api/users

# Check local D1 data
wrangler d1 execute chesscom-helper-db --command="SELECT * FROM sqlite_master;" --local
```

### SQL Debugging Queries

```sql
-- Check table structure
PRAGMA table_info(chesscom_app_user);

-- Check foreign key constraints
PRAGMA foreign_key_check;

-- Check indexes
SELECT name FROM sqlite_master WHERE type='index';

-- Check record counts
SELECT 
  'users' as table_name, COUNT(*) as count 
FROM chesscom_app_user
UNION ALL
SELECT 
  'subscriptions' as table_name, COUNT(*) as count 
FROM chesscom_app_emailsubscription;
```

## Emergency Procedures

### Immediate Rollback

If critical issues occur in production:

1. **Revert Worker deployment:**
   ```bash
   # Deploy previous version
   git checkout previous-working-commit
   cd worker-src/main-worker
   npm run deploy
   ```

2. **Restore environment variables:**
   ```bash
   # Reset any changed environment variables
   wrangler secret put DATABASE_URL
   # Enter old PostgreSQL URL when prompted
   ```

3. **Verify rollback:**
   ```bash
   # Test critical endpoints
   curl https://your-worker-url.workers.dev/api/users
   ```

### Data Recovery

If data is corrupted or lost:

1. **Check D1 point-in-time restore:**
   - Available in Cloudflare dashboard
   - Can restore to specific timestamp

2. **Restore from backup:**
   ```bash
   # If you have export files
   python scripts/import_backup_data.py
   ```

3. **Verify data integrity:**
   ```sql
   -- Check record counts match expectations
   SELECT COUNT(*) FROM chesscom_app_user;
   
   -- Verify foreign key relationships
   PRAGMA foreign_key_check;
   ```

## Getting Help

### Internal Resources
1. Check project documentation in `docs/`
2. Review migration plan in `D1_MIGRATION_PLAN.md`
3. Consult with migration team members

### External Resources
1. [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
2. [Cloudflare Community Forum](https://community.cloudflare.com/)
3. [Cloudflare Discord](https://discord.gg/cloudflaredev)
4. [Wrangler GitHub Issues](https://github.com/cloudflare/workers-sdk/issues)

### Support Escalation
1. **Level 1**: Team member or project maintainer
2. **Level 2**: Cloudflare support ticket (for paid plans)
3. **Level 3**: Emergency rollback procedures

---

**Remember:** When in doubt, err on the side of caution. It's better to rollback and investigate than to risk data integrity or extended downtime.