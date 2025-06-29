# Chess.com Helper

A web application for tracking Chess.com players and receiving email notifications when they start live matches.

## Tech Stack

- **Backend**: SQLite (development) / Cloudflare D1 (production)
- **Frontend**: React with Vite and Material-UI
- **Database**: Cloudflare D1 (SQLite-based, globally distributed)
- **Deployment**: Cloudflare Workers with native D1 integration
- **API**: Chess.com Public API integration
- **Email**: SendGrid via Cloudflare Workers
- **Legacy**: Django backend (local development only)

## Prerequisites

- **Production**: Wrangler CLI v3+ (for D1 database and Workers deployment)
- **Development**: Python 3.12+ with Poetry, Node.js 18+ and npm
- **Required**: Cloudflare account with Workers and D1 access

## Quick Start

### Local Development Setup

```bash
git clone https://github.com/your-username/chesscom-helper.git
cd chesscom-helper

# Install Wrangler CLI globally
npm install -g wrangler

# Complete setup (installs deps, creates SQLite database, runs migrations)
make setup

# Start both servers
make dev
```

**Frontend**: http://localhost:5173  
**Backend**: http://localhost:8000  
**Admin**: http://localhost:8000/admin

### Production Deployment (Cloudflare D1 + Workers)

```bash
# 1. Create D1 database
wrangler d1 create chesscom-helper-db

# 2. Note the database_id from output and update wrangler.toml files

# 3. Apply schema to D1
wrangler d1 execute chesscom-helper-db --file=scripts/d1-schema.sql

# 4. Set up secrets for Workers
cd worker-src/main-worker
wrangler secret put EMAIL_API_KEY  # SendGrid API key
wrangler secret put EMAIL_FROM_ADDRESS  # Verified sender email

# 5. Deploy both workers
cd worker-src/main-worker && wrangler deploy
cd ../cron-worker && wrangler deploy
```

### Architecture Overview

**Current Production Stack:**
- **Main Worker**: Serves React frontend + API endpoints with direct D1 access
- **Cron Worker**: Background live match checking with D1 integration
- **Database**: Cloudflare D1 (globally distributed SQLite)
- **Email**: SendGrid integration via Workers

**Benefits of D1 Architecture:**
- Single cloud provider (simplified infrastructure)
- Direct Worker-to-D1 connections (no HTTP bridge)
- Global distribution and automatic replication
- Reduced latency and operational complexity

## Make Commands

```bash
make help           # Show all available commands
make setup          # Complete first-time setup
make dev            # Start both frontend and backend
make dev-backend    # Start Django server only
make dev-frontend   # Start React server only
make migrate        # Run database migrations
make superuser      # Create Django admin user
make test           # Run test suite
make build          # Build frontend for production
make clean          # Clean build artifacts
```

## API Usage

```bash
# Add a user to track
curl -X POST http://localhost:8000/api/chesscom-app/add-user/ \
     -H "Content-Type: application/json" \
     -d '{"username": "magnuscarlsen"}'

# Subscribe to notifications
curl -X POST http://localhost:8000/api/chesscom-app/subscribe/ \
     -H "Content-Type: application/json" \
     -d '{"email": "your-email@example.com", "username": "magnuscarlsen"}'
```

## Email Configuration

### Local Development (Django - Optional)

For local development with Django backend:

```bash
# Edit .env file for local email testing
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

### Production (Cloudflare Workers + D1)

Email configuration is handled entirely through Worker secrets:

```bash
# Required secrets for production Workers
wrangler secret put EMAIL_API_KEY      # SendGrid API key
wrangler secret put EMAIL_FROM_ADDRESS # Verified sender email
```

**Note**: The Django backend is now used only for local development. Production runs entirely on Cloudflare Workers with direct D1 database access.

See [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md) for detailed email configuration.

## License

MIT License - see [LICENSE](LICENSE) file for details.