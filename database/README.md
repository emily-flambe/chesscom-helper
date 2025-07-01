# Database Schema for Chesscom Helper

This directory contains the database schema, migrations, and seed data for the Chesscom Helper MVP using Cloudflare D1.

## Directory Structure

```
database/
├── migrations/           # Database schema migrations
│   ├── 0001_initial_schema.sql
│   └── 0002_create_indexes.sql
├── seeds/               # Development seed data
│   └── dev_seed.sql
└── README.md           # This file
```

## Database Schema Overview

The MVP database consists of 6 core tables:

1. **users** - User authentication and account management
2. **player_subscriptions** - Tracks which users subscribe to which Chess.com players
3. **player_status** - Current status of monitored Chess.com players
4. **user_preferences** - User notification settings and preferences
5. **notification_log** - Tracks sent notifications to prevent duplicates
6. **monitoring_jobs** - Scheduled monitoring tasks and their status

## Using with Cloudflare D1

### Prerequisites

- Wrangler CLI installed and configured
- Cloudflare account with D1 access

### Creating the Database

```bash
# Create a new D1 database
wrangler d1 create chesscom-helper-production

# Copy the database ID to your wrangler.toml file
```

### Running Migrations

```bash
# Apply initial schema
wrangler d1 execute chesscom-helper-production --file=database/migrations/0001_initial_schema.sql

# Create performance indexes
wrangler d1 execute chesscom-helper-production --file=database/migrations/0002_create_indexes.sql
```

### Loading Development Data

```bash
# Load seed data for development
wrangler d1 execute chesscom-helper-production --file=database/seeds/dev_seed.sql
```

### Local Development

For local development with D1:

```bash
# Create local database
wrangler d1 execute chesscom-helper-production --local --file=database/migrations/0001_initial_schema.sql
wrangler d1 execute chesscom-helper-production --local --file=database/migrations/0002_create_indexes.sql

# Load seed data locally
wrangler d1 execute chesscom-helper-production --local --file=database/seeds/dev_seed.sql
```

## Sample Queries

### User Management

```sql
-- Get user with subscriptions
SELECT u.email, ps.chess_com_username 
FROM users u 
LEFT JOIN player_subscriptions ps ON u.id = ps.user_id 
WHERE u.email = 'alice@example.com';
```

### Player Monitoring

```sql
-- Get currently playing players that have subscribers
SELECT DISTINCT ps.chess_com_username, st.current_game_url
FROM player_subscriptions ps
JOIN player_status st ON ps.chess_com_username = st.chess_com_username
WHERE st.is_playing = true;
```

### Notification History

```sql
-- Get recent notifications for a user
SELECT nl.chess_com_username, nl.notification_type, nl.sent_at
FROM notification_log nl
WHERE nl.user_id = 'user-1'
ORDER BY nl.sent_at DESC
LIMIT 10;
```

## Schema Modifications

When making schema changes:

1. Create a new migration file with incremental numbering
2. Test the migration locally first
3. Apply to production during maintenance windows
4. Update this README with any new tables or significant changes

## Performance Considerations

- All frequently queried columns have appropriate indexes
- Foreign key relationships ensure data integrity
- Timestamps use DATETIME format for D1 compatibility
- User and player identifiers use TEXT for flexibility

## Security Notes

- Passwords are hashed using bcrypt with salt rounds ≥ 10
- User email addresses are unique constraints
- Foreign key cascades ensure clean data deletion
- No sensitive data stored in plain text