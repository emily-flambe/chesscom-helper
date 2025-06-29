# Data Storage and User Management in Chess.com Helper

This document explains how data is stored and managed in the Chess.com Helper application, including database architecture, deployment data persistence, and user management models.

## Database Architecture

### Database Type: PostgreSQL
The application uses **PostgreSQL** as its primary database across all environments (development, staging, and production). This is a persistent, external database - not embedded storage like SQLite.

**Key Characteristics**:
- **External Database**: Hosted separately from the application (likely on Railway PostgreSQL)
- **Persistent Storage**: Data survives application restarts and deployments
- **Shared Access**: Both Django backend and Cloudflare Workers connect to the same database
- **Connection Pooling**: Uses psycopg2 (Django) and postgres npm package (Workers)

### Database Configuration

**Connection Management**:
All database connection parameters are sourced from environment variables:
```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql_psycopg2",
        "NAME": get_env_variable("POSTGRES_DB"),
        "HOST": get_env_variable("POSTGRES_HOST"),
        "PORT": get_env_variable("POSTGRES_PORT"),
        "USER": get_env_variable("POSTGRES_USER"),
        "PASSWORD": get_env_variable("POSTGRES_PASSWORD"),
    }
}
```

**Required Environment Variables**:
- `POSTGRES_DB` - Database name
- `POSTGRES_HOST` - Database server address
- `POSTGRES_PORT` - Database port (usually 5432)
- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_SSLMODE` - SSL mode for secure connections (staging/production)

### Data Schema and Models

The application stores data in three primary tables:

#### 1. Chess.com User Profiles (`chesscom_app_user`)
**Purpose**: Stores Chess.com player information and tracking status
**Primary Key**: `player_id` (BigInteger from Chess.com API)

**Key Fields**:
- `username` (CharField, unique, lowercase)
- `name` (CharField) - Display name
- `followers`, `country`, `location`, `status`, `league`
- `last_online`, `joined` (DateTimeField)
- `is_streamer`, `verified`, `is_playing` (BooleanField)
- `streaming_platforms` (JSONField)

#### 2. Email Subscriptions (`chesscom_app_emailsubscription`)
**Purpose**: Links email addresses to Chess.com players for notifications
**Primary Key**: Auto-generated integer ID

**Key Fields**:
- `email` (EmailField)
- `player_id` (ForeignKey to chesscom_app_user)
- `is_active` (BooleanField) - For soft deletion
- `created_at`, `updated_at` (DateTimeField)
- **Unique Constraint**: (email, player) combination

#### 3. Notification Logs (`chesscom_app_notificationlog`)
**Purpose**: Tracks all sent email notifications
**Primary Key**: Auto-generated integer ID

**Key Fields**:
- `subscription_id` (ForeignKey to emailsubscription)
- `sent_at` (DateTimeField)
- `notification_type` (CharField, default="live_match")
- `success` (BooleanField)
- `error_message` (TextField, optional)

### User Management Architecture

The application implements a **dual user system**:

#### 1. Django Authentication Users
- **Purpose**: Traditional web app authentication (login/logout)
- **Usage**: Currently minimal - only required for account deletion
- **Storage**: Django's built-in `auth_user` table
- **Future**: Could enable personal dashboards, preferences, etc.

#### 2. Chess.com Tracked Users
- **Purpose**: Chess.com players being monitored for live matches
- **Usage**: Core application functionality
- **Storage**: Custom `chesscom_app_user` table
- **Access**: No authentication required to view/track players

**Important**: These two user systems are completely separate - there's no relationship between Django auth users and tracked Chess.com players.

## Deployment and Data Persistence

### Data Persistence During Deployments

**Critical Point**: Deployments **DO NOT** wipe data because:

1. **External Database**: PostgreSQL is hosted separately from the application
2. **Stateless Applications**: Django and Cloudflare Workers are stateless
3. **Persistent Connections**: Applications reconnect to the same database after deployment
4. **Migration System**: Django migrations handle schema changes safely

### Deployment Architecture

**Current Setup**:
- **Django Backend**: Can be deployed to various platforms (Railway, EC2, etc.)
- **Cloudflare Workers**: Handle both frontend serving and API requests
- **Shared Database**: Both deployment types connect to the same PostgreSQL instance

**Data Flow**:
```
User Request → Cloudflare Worker → PostgreSQL Database
                     ↕
              Django Backend → PostgreSQL Database
```

### Migration and Schema Changes

**How Schema Updates Work**:
1. Django migrations are created for model changes
2. Migrations run against the live database during deployment
3. Data is preserved and transformed according to migration instructions
4. No data loss occurs unless explicitly designed (rare)

**Migration Safety**:
- Migrations are atomic (all-or-nothing)
- Can be rolled back if issues occur
- Test migrations in staging environment first

## Security and Access Control

### Database Security
- **SSL Connections**: Configured for staging/production environments
- **Environment Variables**: All credentials externalized
- **No Hardcoded Secrets**: Connection strings never committed to code

### Application Security
**Current State** (somewhat open by design):
- Most API operations require no authentication
- Anyone can add Chess.com players to track
- Anyone can subscribe emails to notifications
- Rate limiting: 5 requests/minute (anonymous), 10/minute (authenticated)

### Data Privacy Considerations
- Email addresses in subscriptions are publicly visible
- All Chess.com player data is public information
- No email verification required for subscriptions
- Subscriptions use "soft delete" (marked inactive vs. removed)

## Backup and Recovery

### Database Backup Strategy
Since the application uses an external PostgreSQL service:
- **Automatic Backups**: Handled by the database provider (Railway, etc.)
- **Point-in-Time Recovery**: Available through database provider
- **Manual Backups**: Can be created via pg_dump if needed

### Application Recovery
- **Stateless Design**: Applications can be redeployed quickly
- **Environment Variables**: Store all configuration externally
- **No Local Storage**: No application-level data to back up

## Development vs Production Data

### Environment Separation
- **Development**: Uses separate PostgreSQL database
- **Staging**: Uses separate PostgreSQL database with production-like data
- **Production**: Uses production PostgreSQL database

### Data Synchronization
- No automatic data sync between environments
- Staging can be refreshed with production data copies when needed
- Development uses test data or minimal production data copies

## Performance Considerations

### Database Performance
- **Connection Pooling**: Both Django and Workers use connection pooling
- **Indexing**: Primary keys and foreign keys are automatically indexed
- **Query Optimization**: Simple queries with minimal joins

### Scaling Considerations
- **Read Replicas**: Could be added for read-heavy operations
- **Connection Limits**: PostgreSQL connection limits may need monitoring
- **Worker Concurrency**: Cloudflare Workers automatically scale

## Monitoring and Maintenance

### Database Monitoring
- Monitor connection counts and query performance
- Track database size and growth over time
- Alert on connection failures or slow queries

### Data Maintenance
- **Cleanup Tasks**: Could implement cleanup of old notification logs
- **User Data**: Inactive users could be archived (not currently implemented)
- **Health Checks**: Monitor database connectivity from all services

## Summary

The Chess.com Helper uses a robust, persistent PostgreSQL database that maintains data across deployments. The dual user system separates authentication from Chess.com player tracking, while the external database architecture ensures data persistence and scalability. Deployments are safe and do not affect stored data, making the system reliable for production use.