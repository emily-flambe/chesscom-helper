# D1 Migration Checklist

This checklist ensures a smooth migration from PostgreSQL to Cloudflare D1. Complete each section before proceeding to the next phase.

## Pre-Migration Preparation

### Environment Verification
- [ ] **Node.js 18+** installed and verified (`node --version`)
- [ ] **Wrangler CLI 3.x** installed and updated (`wrangler --version`)
- [ ] **Cloudflare account** created and verified
- [ ] **Wrangler authentication** completed (`wrangler whoami`)
- [ ] **Git repository** cloned and up-to-date
- [ ] **Current branch** verified (should be on migration branch)

### Backup and Safety
- [ ] **PostgreSQL database backup** created and verified
- [ ] **Environment variables** documented and saved
- [ ] **Current deployment** working and verified
- [ ] **Rollback plan** documented and reviewed
- [ ] **Maintenance window** scheduled (if applicable)
- [ ] **Team notification** sent about migration timeline

### Development Environment Setup
- [ ] **Project dependencies** installed (`npm install`)
- [ ] **Worker dependencies** installed (main-worker and cron-worker)
- [ ] **Local development** environment tested and working
- [ ] **PostgreSQL connection** still functional (for data export)

## Phase 1: D1 Database Setup

### Database Creation
- [ ] **D1 database created** with `wrangler d1 create chesscom-helper-db`
- [ ] **Database ID** recorded and saved securely
- [ ] **Database listed** successfully with `wrangler d1 list`
- [ ] **Database name** matches expected: `chesscom-helper-db`

### Configuration Updates
- [ ] **Main worker wrangler.toml** updated with D1 binding
- [ ] **Cron worker wrangler.toml** updated with D1 binding (if applicable)
- [ ] **Database ID** correctly inserted in all wrangler.toml files
- [ ] **Binding name** set to "DB" in all configurations
- [ ] **Configuration files** committed to version control

### Schema Deployment
- [ ] **Schema file** created at `database/schema.sql`
- [ ] **Schema syntax** validated (SQLite-compatible)
- [ ] **Schema applied** to D1 with `wrangler d1 execute --file=database/schema.sql`
- [ ] **Tables created** verified with table listing query
- [ ] **Indexes created** verified with index listing query
- [ ] **Foreign keys** working correctly

## Phase 2: Code Integration

### Database Service Verification
- [ ] **D1DatabaseService** exists in `worker-src/main-worker/src/services/database.js`
- [ ] **All required methods** implemented:
  - [ ] `getUsers()`
  - [ ] `getUserByUsername(username)`
  - [ ] `addUser(userData)`
  - [ ] `removeUser(username)`
  - [ ] `updateUserStatus(username, isPlaying)`
  - [ ] `getSubscriptions(username)`
  - [ ] `addSubscription(playerId, email)`
  - [ ] `removeSubscription(playerId, email)`
  - [ ] `logNotification(notificationData)`
- [ ] **Error handling** implemented for all methods
- [ ] **JSON field handling** correct for streaming_platforms

### Worker Integration
- [ ] **Database service** properly imported in worker handlers
- [ ] **Environment binding** (env.DB) correctly used
- [ ] **Old HTTP API calls** removed from worker code
- [ ] **Error responses** updated for D1-specific errors
- [ ] **Query parameters** properly bound to prevent SQL injection

## Phase 3: Local Testing

### Development Environment Testing
- [ ] **Local development** server starts with `wrangler dev --local`
- [ ] **API endpoints** accessible at `http://localhost:8787`
- [ ] **Database connection** working in local mode
- [ ] **Basic queries** executing successfully
- [ ] **Error handling** working correctly

### Functionality Testing
- [ ] **User listing** endpoint working (`/api/users`)
- [ ] **User details** endpoint working (`/api/users/{username}`)
- [ ] **User creation** working (if applicable)
- [ ] **User updates** working (if applicable)
- [ ] **Subscription management** working (if applicable)
- [ ] **Notification logging** working (if applicable)

### Data Validation
- [ ] **Test data** can be inserted successfully
- [ ] **Foreign key constraints** enforced correctly
- [ ] **JSON fields** serialized/deserialized properly
- [ ] **Unique constraints** working correctly
- [ ] **Test data** can be queried and updated
- [ ] **Test data** cleaned up after testing

## Phase 4: Data Migration (if applicable)

### Data Export
- [ ] **PostgreSQL connection** verified and accessible
- [ ] **Export script** (`scripts/export_postgresql_data.py`) tested
- [ ] **Environment variables** set for PostgreSQL connection:
  - [ ] `POSTGRES_HOST`
  - [ ] `POSTGRES_DB`
  - [ ] `POSTGRES_USER`
  - [ ] `POSTGRES_PASSWORD`
- [ ] **Data exported** successfully to JSON files
- [ ] **Export validation** passed (foreign keys, record counts)
- [ ] **Exported data** reviewed for accuracy

### Data Transformation
- [ ] **Data format** compatible with D1/SQLite
- [ ] **JSON fields** properly formatted
- [ ] **Timestamp formats** converted correctly
- [ ] **Foreign key relationships** preserved
- [ ] **Data integrity** maintained

### Data Import
- [ ] **Import strategy** planned (batch size, order)
- [ ] **Import script** created and tested
- [ ] **Batch operations** working within D1 limits
- [ ] **Import progress** monitored and logged
- [ ] **Data integrity** verified after import
- [ ] **Record counts** match export data

## Phase 5: Production Deployment

### Pre-Deployment
- [ ] **Code changes** reviewed and approved
- [ ] **All tests** passing locally
- [ ] **Configuration files** double-checked
- [ ] **Deployment process** documented and rehearsed
- [ ] **Rollback plan** confirmed and ready

### Build and Deploy
- [ ] **Application built** successfully with `npm run build`
- [ ] **Worker deployed** with `npm run deploy`
- [ ] **Deployment URL** accessible and responding
- [ ] **Worker logs** showing no errors
- [ ] **D1 binding** connected in production

### Production Schema
- [ ] **Production schema** applied with `--remote` flag
- [ ] **Production tables** created successfully
- [ ] **Production indexes** created successfully
- [ ] **Production foreign keys** working correctly

## Phase 6: Production Validation

### Functionality Testing
- [ ] **Production API endpoints** responding correctly
- [ ] **Database operations** working in production
- [ ] **Error handling** working correctly
- [ ] **Response times** acceptable (< 500ms for simple queries)
- [ ] **Concurrent requests** handled properly

### Data Verification
- [ ] **Production data** matches expected records
- [ ] **Data integrity** maintained
- [ ] **Foreign key relationships** intact
- [ ] **JSON fields** properly formatted
- [ ] **Query performance** acceptable

### Monitoring Setup
- [ ] **Application monitoring** configured
- [ ] **Error tracking** enabled
- [ ] **Performance monitoring** enabled
- [ ] **Database query monitoring** enabled
- [ ] **Alert thresholds** configured

## Phase 7: Post-Migration

### Verification
- [ ] **All functionality** working as expected
- [ ] **No data loss** confirmed
- [ ] **Performance** maintained or improved
- [ ] **Error rates** normal or reduced
- [ ] **User experience** unaffected

### Cleanup
- [ ] **Old PostgreSQL connections** removed from code
- [ ] **Unused environment variables** cleaned up
- [ ] **Test data** cleaned up from production
- [ ] **Migration scripts** archived
- [ ] **Temporary files** cleaned up

### Documentation Updates
- [ ] **API documentation** updated
- [ ] **Deployment guides** updated
- [ ] **Architecture diagrams** updated
- [ ] **Development setup** instructions updated
- [ ] **Monitoring procedures** updated

## Rollback Checklist (if needed)

### Immediate Rollback (< 15 minutes)
- [ ] **Previous Worker version** deployed
- [ ] **Environment variables** restored
- [ ] **DNS/routing** reverted (if changed)
- [ ] **Application functionality** verified
- [ ] **Error monitoring** confirms rollback success

### Data Rollback (if needed)
- [ ] **PostgreSQL service** restored
- [ ] **Database connections** re-enabled
- [ ] **Data integrity** verified
- [ ] **Application functionality** verified
- [ ] **Backup data** restored (if needed)

## Success Criteria

The migration is considered successful when:

- [ ] **Zero data loss** - All records successfully migrated
- [ ] **Functionality preserved** - All features working correctly
- [ ] **Performance maintained** - Response times acceptable
- [ ] **Error rates normal** - No increase in application errors
- [ ] **Monitoring active** - All monitoring and alerting working
- [ ] **Team trained** - Team familiar with new architecture
- [ ] **Documentation complete** - All guides updated and accurate

## Risk Mitigation

### High-Risk Items
- [ ] **Database connectivity** - Thoroughly tested
- [ ] **Data integrity** - Multiple validation checks
- [ ] **Performance impact** - Load tested
- [ ] **Error handling** - Comprehensive error scenarios tested

### Contingency Plans
- [ ] **Rollback procedure** tested and documented
- [ ] **Emergency contacts** identified and notified
- [ ] **Alternative approaches** documented
- [ ] **Recovery procedures** tested and verified

## Sign-off

### Technical Review
- [ ] **Database architect** reviewed and approved
- [ ] **Backend developer** reviewed and approved
- [ ] **DevOps engineer** reviewed and approved
- [ ] **Quality assurance** testing completed

### Business Review
- [ ] **Product owner** approved migration
- [ ] **Stakeholders** notified of changes
- [ ] **Support team** briefed on changes
- [ ] **Go-live approval** obtained

---

**Migration Completion Date:** _______________

**Migration Team:**
- Database Migration: _______________
- Code Integration: _______________
- Testing & Validation: _______________
- Documentation: _______________
- Deployment: _______________

**Notes:**
_Use this space to record any issues, lessons learned, or important observations during the migration process._