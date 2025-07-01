# Chess.com Helper

A simple Cloudflare Workers application for monitoring Chess.com players.

## Current Features

- 🔐 **Basic Authentication** - Simple user registration and login
- ♟️ **Chess.com Integration** - Validates usernames against Chess.com API
- 📝 **Player Monitoring** - Track Chess.com players with persistent storage
- 🌐 **Web Interface** - Simple HTML interface with authentication
- ⚡ **Edge Computing** - Built on Cloudflare Workers

## Current Implementation

This is a production-ready implementation with:
- Cloudflare D1 database for persistent storage
- JWT-based authentication with session management
- Chess.com username validation
- Comprehensive player monitoring system

**Note**: Uses Cloudflare D1 for production deployment with in-memory fallback for local development.

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Player Monitoring  
- `GET /api/players` - Get list of monitored players
- `POST /api/monitor` - Add a player to monitoring list

### Utility
- `GET /health` - Health check endpoint
- `GET /` - Web interface

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account  
- Wrangler CLI

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/chesscom-helper.git
cd chesscom-helper

# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev

# Type checking
npm run typecheck

# Linting  
npm run lint
```

### Deployment

```bash
# Deploy to Cloudflare Workers
wrangler deploy
```

## Usage

1. Visit the deployed Worker URL
2. Register a new account or login
3. Add Chess.com usernames to monitor
4. The application validates usernames against Chess.com API

## Implementation Features

- **Persistent Storage**: Cloudflare D1 database for production data persistence
- **Email Notifications**: Comprehensive notification system for player activity
- **Rate Limiting**: Advanced rate limiting with abuse prevention
- **Enterprise Security**: bcrypt password hashing, JWT tokens, session management

## Architecture

- **Database**: Cloudflare D1 SQLite database with automated migrations
- **Authentication**: JWT-based with secure session management
- **Monitoring**: Real-time Chess.com player status tracking
- **Notifications**: Email alerts for player activity
- **Security**: Multi-layer security with rate limiting and abuse prevention

## License

MIT License - see LICENSE file for details.