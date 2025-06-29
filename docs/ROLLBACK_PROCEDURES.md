# Rollback Procedures

This document provides comprehensive rollback procedures for the Chess.com Helper application's Cloudflare D1 architecture.

## Overview

The rollback strategy is designed to handle different types of failures during or after deployment to the D1-based architecture. Procedures are organized by severity and time sensitivity.

## Quick Reference

| Scenario | Time to Rollback | Risk Level | Primary Action |
|----------|------------------|------------|----------------|
| Worker deployment failure | 2-5 minutes | Low | Revert Worker deployment |
| D1 database issues | 5-15 minutes | Medium | Switch to backup data source |
| Data corruption | 30-60 minutes | High | Full data restoration |
| Complete system failure | 1-4 hours | Critical | Full infrastructure rebuild |

## Prerequisites

Before implementing any rollback procedure, ensure you have:

- [ ] **Wrangler CLI** installed and authenticated
- [ ] **Access to Cloudflare dashboard** with Workers and D1 permissions
- [ ] **Database backups** (automated exports from previous architecture)
- [ ] **Git repository access** to previous working commit
- [ ] **Emergency contact information** for stakeholders

## Rollback Scenarios

### 1. Worker Deployment Rollback (Low Risk)

**When to use**: Worker deployment fails or causes immediate issues

**Time required**: 2-5 minutes

**Steps**:

```bash
# 1. Check current worker versions
wrangler deployments list --name chesscom-helper
wrangler deployments list --name chesscom-helper-cron

# 2. Rollback to previous deployment
wrangler rollback --name chesscom-helper
wrangler rollback --name chesscom-helper-cron

# 3. Verify rollback success
curl -I https://chesscom-helper.emily-flambe.workers.dev
wrangler tail chesscom-helper --once
```

**Verification**:
- [ ] Frontend loads correctly
- [ ] API endpoints respond
- [ ] No error spike in monitoring

### 2. D1 Database Issues (Medium Risk)

**When to use**: D1 queries fail, performance degradation, or data access issues

**Time required**: 5-15 minutes

**Steps**:

```bash
# 1. Check D1 database status
wrangler d1 info chesscom-helper-db

# 2. Test basic database connectivity
wrangler d1 execute chesscom-helper-db --command="SELECT 1"

# 3. If D1 is unresponsive, check recent operations
wrangler d1 execute chesscom-helper-db --command="SELECT COUNT(*) FROM chesscom_app_user"

# 4. Export current D1 data for backup
wrangler d1 export chesscom-helper-db --output=emergency-backup-$(date +%Y%m%d-%H%M%S).sql

# 5. If corruption detected, restore from backup
wrangler d1 execute chesscom-helper-db --file=latest-known-good-backup.sql
```

**Alternative: Temporary PostgreSQL Bridge**:

If D1 is completely unavailable, temporarily restore the HTTP bridge to a backup PostgreSQL instance:

```bash
# 1. Update worker environment to use PostgreSQL API
wrangler secret put DATABASE_FALLBACK_URL

# 2. Deploy emergency worker version with HTTP bridge
git checkout fallback-postgresql-bridge
cd worker-src/main-worker
wrangler deploy --name chesscom-helper-emergency
```

### 3. Data Corruption Recovery (High Risk)

**When to use**: Data integrity issues, missing records, or incorrect data relationships

**Time required**: 30-60 minutes

**Steps**:

```bash
# 1. Immediately stop all write operations
wrangler secret put MAINTENANCE_MODE true

# 2. Export current state for analysis
wrangler d1 export chesscom-helper-db --output=corrupted-state-$(date +%Y%m%d-%H%M%S).sql

# 3. Identify the last known good backup
ls -la backups/ | grep -E "chesscom-helper-.*\.sql$"

# 4. Create a new D1 database for restoration
wrangler d1 create chesscom-helper-db-restore

# 5. Restore from backup to new database
wrangler d1 execute chesscom-helper-db-restore --file=backups/latest-good-backup.sql

# 6. Validate data integrity
wrangler d1 execute chesscom-helper-db-restore --command="
SELECT 
  (SELECT COUNT(*) FROM chesscom_app_user) as users,
  (SELECT COUNT(*) FROM chesscom_app_emailsubscription) as subscriptions,
  (SELECT COUNT(*) FROM chesscom_app_notificationlog) as notifications"

# 7. Update worker bindings to use restored database
# Edit worker-src/main-worker/wrangler.toml and worker-src/cron-worker/wrangler.toml
# Update database_id to the restored database

# 8. Deploy workers with new database binding
cd worker-src/main-worker && wrangler deploy
cd ../cron-worker && wrangler deploy

# 9. Re-enable operations
wrangler secret put MAINTENANCE_MODE false
```

### 4. Complete System Failure (Critical Risk)

**When to use**: Multiple system components fail, infrastructure-wide issues

**Time required**: 1-4 hours

**Steps**:

#### Phase 1: Emergency Response (15 minutes)

```bash
# 1. Enable maintenance mode
echo "System maintenance in progress" > maintenance.html
# Deploy static maintenance page if possible

# 2. Document the failure
echo "$(date): System failure detected" >> rollback.log
wrangler deployments list --name chesscom-helper >> rollback.log
wrangler d1 info chesscom-helper-db >> rollback.log

# 3. Notify stakeholders
# Send emergency notification to project maintainers
```

#### Phase 2: Infrastructure Rebuild (30-60 minutes)

```bash
# 1. Create new D1 database
wrangler d1 create chesscom-helper-db-emergency

# 2. Apply schema
wrangler d1 execute chesscom-helper-db-emergency --file=scripts/d1-schema.sql

# 3. Restore data from latest backup
wrangler d1 execute chesscom-helper-db-emergency --file=backups/latest-backup.sql

# 4. Update all worker configurations
# Edit wrangler.toml files to use new database_id

# 5. Rebuild and deploy workers from known good commit
git checkout last-known-good-commit
cd chesscom_helper/frontend && npm ci && npm run build
cd ../../worker-src/main-worker && npm ci && wrangler deploy
cd ../cron-worker && npm ci && wrangler deploy
```

#### Phase 3: Validation and Recovery (30-60 minutes)

```bash
# 1. Comprehensive testing
curl -f https://chesscom-helper.emily-flambe.workers.dev/api/health
wrangler tail chesscom-helper --once

# 2. Data validation
wrangler d1 execute chesscom-helper-db-emergency --command="
SELECT COUNT(*) FROM chesscom_app_user WHERE username IS NOT NULL"

# 3. Monitor for 30 minutes
wrangler tail chesscom-helper --duration 1800

# 4. Document recovery
echo "$(date): System restored successfully" >> rollback.log
```

## Data Recovery Procedures

### Automated Backup Restoration

```bash
# List available backups
ls -la backups/ | grep chesscom-helper

# Restore specific backup
wrangler d1 execute chesscom-helper-db --file=backups/chesscom-helper-20240101-120000.sql

# Verify restoration
wrangler d1 execute chesscom-helper-db --command="
SELECT 
  username, 
  COUNT(*) as subscription_count
FROM chesscom_app_user u
LEFT JOIN chesscom_app_emailsubscription es ON u.player_id = es.player_id
GROUP BY username
LIMIT 5"
```

### Manual Data Recovery

```bash
# Export specific table data
wrangler d1 execute chesscom-helper-db --command="
SELECT * FROM chesscom_app_user WHERE created_at > '2024-01-01'" --json > users-recovery.json

# Import recovered data
wrangler d1 execute chesscom-helper-db --file=manual-recovery.sql
```

## Monitoring During Rollback

### Key Metrics to Watch

```bash
# 1. Worker health
wrangler tail chesscom-helper --grep "ERROR|WARN"

# 2. D1 performance
wrangler d1 execute chesscom-helper-db --command="
SELECT 
  'health_check' as test,
  COUNT(*) as user_count,
  datetime('now') as timestamp
FROM chesscom_app_user"

# 3. API endpoint status
curl -w "%{http_code} %{time_total}s\n" -s -o /dev/null https://chesscom-helper.emily-flambe.workers.dev/api/users
```

### Alerting During Rollback

Set up temporary monitoring:

```bash
# Monitor error rates
watch -n 30 "wrangler tail chesscom-helper --once | grep -c ERROR"

# Check response times
watch -n 60 "curl -w 'Response time: %{time_total}s\n' -s -o /dev/null https://chesscom-helper.emily-flambe.workers.dev"
```

## Post-Rollback Procedures

### Immediate Actions (Within 1 hour)

1. **Verify all functionality**:
   - [ ] Frontend loads and renders correctly
   - [ ] User management API endpoints work
   - [ ] Email subscription system functional
   - [ ] Cron job executes successfully

2. **Check data integrity**:
   - [ ] User count matches expected values
   - [ ] Email subscriptions are intact
   - [ ] Notification logs are preserved

3. **Monitor performance**:
   - [ ] Response times within normal range
   - [ ] No error spikes in logs
   - [ ] D1 query performance acceptable

### Follow-up Actions (Within 24 hours)

1. **Root cause analysis**:
   - Document what went wrong
   - Identify prevention measures
   - Update rollback procedures if needed

2. **Stakeholder communication**:
   - Send status update to users
   - Document lessons learned
   - Plan preventive measures

3. **System hardening**:
   - Implement additional monitoring
   - Improve backup procedures
   - Update deployment safeguards

## Testing Rollback Procedures

### Monthly Rollback Drill

```bash
# 1. Create test D1 database
wrangler d1 create chesscom-helper-test-$(date +%Y%m)

# 2. Deploy to test database
# Update test wrangler.toml with test database_id
wrangler deploy --env test

# 3. Practice rollback scenarios
# Test each rollback procedure in non-production environment

# 4. Document timing and issues
# Update procedures based on drill results

# 5. Clean up test resources
wrangler d1 delete chesscom-helper-test-$(date +%Y%m)
```

## Emergency Contacts

**During rollback procedures, notify:**

- **Primary**: Project maintainer
- **Secondary**: Cloudflare support (if infrastructure issues)
- **Tertiary**: End users (if extended downtime expected)

## Backup Strategy

### Automated Backups

Current backup schedule:
- **Hourly**: D1 incremental snapshots (via Cloudflare)
- **Daily**: Full D1 export to external storage
- **Weekly**: Complete system state backup

### Manual Backup Commands

```bash
# Create immediate backup
wrangler d1 export chesscom-helper-db --output=manual-backup-$(date +%Y%m%d-%H%M%S).sql

# Verify backup integrity
wrangler d1 create temp-backup-test
wrangler d1 execute temp-backup-test --file=manual-backup-*.sql
wrangler d1 execute temp-backup-test --command="SELECT COUNT(*) FROM chesscom_app_user"
wrangler d1 delete temp-backup-test
```

## Version Control Integration

### Git-based Rollback

```bash
# Identify last working commit
git log --oneline -10

# Checkout last known good version
git checkout <commit-hash>

# Deploy from stable commit
./scripts/deploy/deploy.sh

# Create hotfix branch if needed
git checkout -b hotfix/rollback-$(date +%Y%m%d)
```

---

**Last Updated**: 2024-01-01  
**Review Schedule**: Monthly  
**Owner**: DevOps Team

**Note**: This document should be updated after each rollback event to incorporate lessons learned and improve procedures.