# D1 Migration Technical Plan
# Chess.com Helper PostgreSQL → Cloudflare D1 Migration

## Executive Summary

This document provides a comprehensive technical plan for migrating the chess.com helper application from PostgreSQL (Railway) to Cloudflare D1. The migration will simplify infrastructure, reduce costs, and improve integration with the existing Cloudflare Workers deployment.

## Current Architecture Analysis

### Database Layer
- **Engine**: PostgreSQL via psycopg2
- **Hosting**: Railway.app
- **Schema**: 3 tables (User, EmailSubscription, NotificationLog)
- **Data Volume**: Small (~50MB projected annually)
- **Access Pattern**: Read-heavy with low concurrency

### Application Layer
- **Backend**: Django REST API
- **Workers**: Cloudflare Workers
- **Deployment**: Cloudflare Pages + Workers
- **Database Access**: HTTP bridge via Django API

## Target D1 Architecture

### Database Layer
- **Engine**: SQLite (Cloudflare D1)
- **Hosting**: Cloudflare D1 (globally distributed)
- **Schema**: Same 3 tables with SQLite syntax
- **Access**: Direct HTTP API calls from Workers
- **Replication**: Automatic via D1

### Application Layer Changes
- **Backend**: Django with SQLite (development/local)
- **Workers**: Direct D1 integration (no HTTP bridge)
- **Deployment**: Simplified single-provider stack
- **Database Access**: Native D1 bindings

## Migration Phases

### Phase 1: Local Development Migration
**Objective**: Convert local development to SQLite
**Duration**: 1-2 hours
**Risk**: Low

#### Tasks:
1. Update Django settings for SQLite
2. Create new migrations for SQLite compatibility
3. Test JSONField compatibility
4. Validate all existing functionality
5. Update development documentation

### Phase 2: D1 Infrastructure Setup
**Objective**: Provision and configure D1 database
**Duration**: 30 minutes
**Risk**: Low

#### Tasks:
1. Create D1 database via Wrangler CLI
2. Configure Workers bindings
3. Set up development/production environments
4. Configure access permissions
5. Document connection details

### Phase 3: Workers Integration
**Objective**: Update Workers to use D1 directly
**Duration**: 2-3 hours
**Risk**: Medium

#### Tasks:
1. Remove HTTP bridge dependencies
2. Implement native D1 queries
3. Update error handling for D1 API
4. Test all Worker endpoints
5. Performance optimization

### Phase 4: Data Migration
**Objective**: Migrate existing PostgreSQL data to D1
**Duration**: 1 hour
**Risk**: Medium

#### Tasks:
1. Export PostgreSQL data
2. Transform data for SQLite compatibility
3. Import to D1 via batch API
4. Validate data integrity
5. Verify foreign key relationships

### Phase 5: Production Cutover
**Objective**: Deploy D1-enabled Workers to production
**Duration**: 30 minutes
**Risk**: High

#### Tasks:
1. Deploy updated Workers
2. Update environment variables
3. Monitor error rates and performance
4. Validate all functionality
5. Document new architecture

## Detailed Implementation Plan

### Code Changes Required

#### 1. Django Settings Update
**File**: `settings/base.py`, `settings/prod.py`
**Changes**:
```python
# Local development
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Remove PostgreSQL dependencies
# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.postgresql_psycopg2',
#         ...
#     }
# }
```

#### 2. Database Models Validation
**Files**: `chesscom_app/models.py`
**Changes**:
- Verify JSONField compatibility with SQLite
- Check BigInteger field behavior
- Validate unique constraints
- Test foreign key relationships

#### 3. Migration Files
**Files**: `chesscom_app/migrations/`
**Changes**:
- Create new initial migration for SQLite
- Handle PostgreSQL-specific field types
- Preserve data integrity constraints
- Test migration rollback capability

#### 4. Workers Database Service
**File**: `cloudflare/src/services/database.js`
**Changes**:
```javascript
// Remove HTTP API calls
// const response = await fetch(`${API_BASE}/api/users/`);

// Add D1 direct queries
export class D1DatabaseService {
  constructor(db) {
    this.db = db;
  }
  
  async getAllUsers() {
    const { results } = await this.db.prepare(
      "SELECT * FROM chesscom_app_user"
    ).all();
    return results;
  }
  
  async getUserByUsername(username) {
    const result = await this.db.prepare(
      "SELECT * FROM chesscom_app_user WHERE username = ?"
    ).bind(username).first();
    return result;
  }
  
  // Additional methods...
}
```

#### 5. Worker Handlers Update
**Files**: `cloudflare/src/handlers/*.js`
**Changes**:
- Remove dependency on external API
- Use D1DatabaseService instead of HTTP calls
- Update error handling for D1 responses
- Optimize query patterns for D1

#### 6. Environment Configuration
**File**: `wrangler.toml`
**Changes**:
```toml
[[d1_databases]]
binding = "DB"
database_name = "chesscom-helper-db"
database_id = "your-d1-database-id"
```

### Infrastructure Changes

#### 1. D1 Database Creation
```bash
# Create D1 database
wrangler d1 create chesscom-helper-db

# Apply schema
wrangler d1 execute chesscom-helper-db --file=./schema.sql

# Configure bindings
wrangler d1 list
```

#### 2. Workers Binding Configuration
**Requirements**:
- Update wrangler.toml with D1 binding
- Deploy with new bindings
- Test connectivity in development
- Validate production deployment

#### 3. Schema Creation
**File**: `schema.sql`
**Content**: SQLite-compatible version of current PostgreSQL schema

```sql
-- Users table
CREATE TABLE chesscom_app_user (
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
CREATE TABLE chesscom_app_emailsubscription (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(254) NOT NULL,
    player_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (player_id) REFERENCES chesscom_app_user (player_id),
    UNIQUE(email, player_id)
);

-- Notification log table
CREATE TABLE chesscom_app_notificationlog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    sent_at DATETIME NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    FOREIGN KEY (subscription_id) REFERENCES chesscom_app_emailsubscription (id)
);

-- Indexes for performance
CREATE INDEX idx_user_username ON chesscom_app_user(username);
CREATE INDEX idx_subscription_player ON chesscom_app_emailsubscription(player_id);
CREATE INDEX idx_subscription_active ON chesscom_app_emailsubscription(is_active);
CREATE INDEX idx_notification_subscription ON chesscom_app_notificationlog(subscription_id);
CREATE INDEX idx_notification_sent_at ON chesscom_app_notificationlog(sent_at);
```

### Data Migration Strategy

#### 1. Export Current Data
**Script**: `scripts/export_postgresql_data.py`
```python
import os
import json
import psycopg2
from django.core.serializers import serialize
from django.apps import apps

def export_postgresql_data():
    # Connect to PostgreSQL
    conn = psycopg2.connect(DATABASE_URL)
    
    # Export each table
    models = [
        apps.get_model('chesscom_app', 'User'),
        apps.get_model('chesscom_app', 'EmailSubscription'),
        apps.get_model('chesscom_app', 'NotificationLog'),
    ]
    
    for model in models:
        data = serialize('json', model.objects.all())
        with open(f'{model._meta.label_lower}.json', 'w') as f:
            f.write(data)
```

#### 2. Transform Data for SQLite
**Script**: `scripts/transform_data_for_d1.py`
```python
import json
import sqlite3
from datetime import datetime

def transform_and_import_data():
    # Connect to local SQLite for validation
    conn = sqlite3.connect('db.sqlite3')
    
    # Import users
    with open('chesscom_app.user.json', 'r') as f:
        users = json.load(f)
        for user in users:
            fields = user['fields']
            # Transform streaming_platforms from dict to JSON string
            streaming_platforms = json.dumps(fields.get('streaming_platforms', []))
            # Insert into SQLite...
    
    # Import subscriptions and logs
    # ... similar transformation logic
```

#### 3. Import to D1
**Script**: `scripts/import_to_d1.js`
```javascript
// Import data to D1 via API
async function importToD1(data) {
  const batches = chunkArray(data, 100); // D1 batch limit
  
  for (const batch of batches) {
    const statements = batch.map(item => ({
      sql: "INSERT INTO chesscom_app_user (...) VALUES (...)",
      params: Object.values(item)
    }));
    
    await env.DB.batch(statements);
  }
}
```

### Testing Strategy

#### 1. Unit Tests
**Objective**: Verify individual component functionality
**Scope**:
- Database model operations
- Worker query functions
- Data transformation scripts
- Error handling

#### 2. Integration Tests
**Objective**: Verify end-to-end functionality
**Scope**:
- API endpoint responses
- Cron job execution
- Email notification pipeline
- Database connectivity

#### 3. Performance Tests
**Objective**: Validate performance characteristics
**Scope**:
- Query response times
- Concurrent request handling
- Worker execution duration
- Database write performance

#### 4. Data Integrity Tests
**Objective**: Ensure data accuracy after migration
**Scope**:
- Record count validation
- Foreign key integrity
- JSON field data preservation
- Timestamp accuracy

### Rollback Plan

#### Immediate Rollback (< 1 hour)
1. Revert Workers deployment to previous version
2. Restore original environment variables
3. Re-enable PostgreSQL connections
4. Validate system functionality

#### Data Recovery (1-4 hours)
1. Restore PostgreSQL database from backup
2. Re-import any missing data from export files
3. Validate data integrity
4. Resume normal operations

#### Infrastructure Rollback (4-8 hours)
1. Rebuild original PostgreSQL infrastructure
2. Restore all configuration settings
3. Re-deploy original Worker code
4. Comprehensive system testing

### Dependencies and Prerequisites

#### Technical Requirements
- Wrangler CLI v3.x installed
- Node.js v18+ for Workers development
- Python 3.9+ for Django migration scripts
- SQLite 3.8+ for local development

#### Access Requirements
- Cloudflare account with Workers access
- D1 database creation permissions
- GitHub repository write access
- Railway database export access

#### Preparation Tasks
1. Backup current PostgreSQL database
2. Document current environment variables
3. Test local SQLite development setup
4. Verify Cloudflare Workers deployment process

### Validation Criteria

#### Functional Validation
- [ ] All API endpoints return expected responses
- [ ] Cron jobs execute successfully
- [ ] Email notifications send correctly
- [ ] Database queries return accurate data
- [ ] Error handling works properly

#### Performance Validation
- [ ] Query response times < 100ms for simple operations
- [ ] Worker execution time < 500ms
- [ ] No increase in error rates
- [ ] Database write operations complete successfully

#### Data Validation
- [ ] All user records migrated correctly
- [ ] Email subscriptions preserved
- [ ] Notification logs maintained
- [ ] JSON fields parsed properly
- [ ] Foreign key relationships intact

## Risk Assessment

### High Risk Areas
1. **Data Migration**: Potential for data loss during export/import
2. **Production Cutover**: Service interruption during deployment
3. **Worker Integration**: Breaking changes in D1 API usage

### Mitigation Strategies
1. **Comprehensive Backups**: Multiple backup copies before migration
2. **Staged Deployment**: Test in development environment first
3. **Monitoring**: Real-time error tracking during cutover
4. **Rollback Plan**: Documented and tested recovery procedures

### Contingency Plans
1. **Failed Migration**: Immediate rollback to PostgreSQL
2. **Data Corruption**: Restore from backup and retry
3. **Performance Issues**: Optimize queries or rollback
4. **API Incompatibility**: Update Worker code or rollback

## Success Metrics

### Technical Metrics
- Zero data loss during migration
- < 5 minutes total downtime
- Performance maintained or improved
- All automated tests passing

### Operational Metrics
- Reduced infrastructure complexity
- Lower operational costs
- Improved deployment simplicity
- Better error monitoring

## Post-Migration Tasks

### Immediate (Day 1)
1. Monitor error rates and performance
2. Validate all core functionality
3. Check data accuracy
4. Update documentation

### Short-term (Week 1)
1. Optimize D1 query performance
2. Remove PostgreSQL dependencies
3. Update deployment scripts
4. Train team on new architecture

### Long-term (Month 1)
1. Evaluate cost savings
2. Assess performance improvements
3. Document lessons learned
4. Plan future optimizations

## Documentation Updates Required

### Technical Documentation
- [ ] Update deployment guide
- [ ] Revise architecture diagrams
- [ ] Update API documentation
- [ ] Modify development setup instructions

### Operational Documentation
- [ ] Update monitoring procedures
- [ ] Revise backup strategies
- [ ] Update troubleshooting guides
- [ ] Modify incident response plans

---

**Migration Team Assignments**:
- **Agent 1**: Database code changes and Django migration
- **Agent 2**: Cloudflare Workers D1 integration
- **Agent 3**: Human-readable setup documentation
- **Agent 4**: Data migration scripts and validation
- **Agent 5**: Deployment documentation updates

**Timeline**: 4-6 hours total execution time
**Go-live Window**: [To be determined based on low-traffic period]
**Emergency Contact**: [Project maintainer]

---
*This plan serves as the master reference for all migration agents and should be updated as implementation progresses.*