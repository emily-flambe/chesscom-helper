# Chess.com Helper

A simple Cloudflare Workers application for monitoring Chess.com players.

## Current Features

- 🔐 **Basic Authentication** - Simple user registration and login
- ♟️ **Chess.com Integration** - Validates usernames against Chess.com API
- 📝 **Player Monitoring** - Track Chess.com players (in-memory storage)
- 🌐 **Web Interface** - Simple HTML interface with authentication
- ⚡ **Edge Computing** - Built on Cloudflare Workers

## Current Implementation

This is a minimal viable implementation with:
- In-memory user storage (not persistent)
- Basic token-based authentication (not JWT)
- Chess.com username validation
- Simple player monitoring list

**Note**: This is currently a prototype. The implementation uses in-memory storage and will reset on worker restarts.

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

## Current Limitations

- **No Persistence**: Data is stored in-memory and resets on worker restarts
- **No Email Notifications**: Monitoring list only, no actual notifications
- **No Rate Limiting**: No request throttling implemented
- **Basic Security**: Simple password storage without proper hashing

## Future Enhancements

This prototype can be expanded with:
- Persistent database storage (D1)
- JWT-based authentication  
- Email notification system
- Rate limiting and security improvements
- Advanced monitoring features

## License

MIT License - see LICENSE file for details.