# Chess.com Helper API

A Cloudflare Workers-based API for monitoring Chess.com player activity and sending email notifications when players start or finish games.

## Features

- 🔐 **User Authentication** - JWT-based authentication with secure registration/login
- ♟️ **Player Monitoring** - Real-time monitoring of Chess.com players via API
- 📧 **Email Notifications** - Smart email alerts when subscribed players are active
- ⚡ **Edge Computing** - Built on Cloudflare Workers for global performance
- 🗄️ **D1 Database** - Serverless SQL database for reliable data storage
- 🚀 **Rate Limiting** - Built-in rate limiting and request validation
- 🧪 **Comprehensive Testing** - Full test suite with Vitest

## Architecture

This is the MVP implementation following the comprehensive architecture documented in `ARCHITECTURE.md`. The system is designed for future expansion with Claude AI integration for advanced chess analysis features.

### Core Services

- **User Service** - Authentication, subscriptions, preferences
- **Chess.com Monitoring Service** - Player status tracking and game detection
- **Notification Service** - Smart email delivery with anti-spam protection
- **Scheduled Jobs** - Automated monitoring and cleanup tasks

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/forgot-password` - Password reset

### User Management
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update user profile
- `DELETE /api/v1/users/me` - Delete account

### Player Subscriptions
- `GET /api/v1/users/me/subscriptions` - Get player subscriptions
- `POST /api/v1/users/me/subscriptions` - Subscribe to a player
- `DELETE /api/v1/users/me/subscriptions` - Unsubscribe from player

### Notification Preferences
- `GET /api/v1/users/me/preferences` - Get notification preferences
- `PUT /api/v1/users/me/preferences` - Update preferences

### Monitoring
- `GET /api/v1/monitoring/status` - Get monitoring system status
- `GET /api/v1/monitoring/players/{username}` - Get player status

### Notifications
- `GET /api/v1/notifications/preferences` - Get notification settings
- `PUT /api/v1/notifications/preferences` - Update notification settings
- `GET /api/v1/notifications/history` - Get notification history

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

# Set up environment
cp .env.example .env.local
```

### Configuration

1. **Create D1 Database:**
```bash
wrangler d1 create chesscom-helper-dev
```

2. **Update `wrangler.toml`** with your database ID

3. **Run migrations:**
```bash
wrangler d1 migrations apply --local
```

4. **Set up KV namespace:**
```bash
wrangler kv:namespace create CACHE
```

5. **Configure environment variables** in Cloudflare dashboard or wrangler.toml:
   - `JWT_SECRET` - Secret for JWT token signing
   - `RESEND_API_KEY` - API key for email service
   - `CHESS_COM_API_URL` - Chess.com API endpoint (default: https://api.chess.com/pub)

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Deployment

```bash
# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production
```

## Database Schema

The database schema is defined in `migrations/0001_initial_schema.sql` and includes:

- `users` - User accounts and authentication
- `player_subscriptions` - User subscriptions to Chess.com players
- `player_status` - Current status of monitored players
- `user_preferences` - Notification preferences
- `notification_log` - History of sent notifications
- `monitoring_jobs` - Tracking of scheduled tasks

Future-ready tables for Claude AI integration:
- `agent_tasks` - AI analysis task tracking
- `agent_results` - AI analysis results storage
- `game_analysis` - Chess game analysis data

## Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run specific test file
npm test auth.test.ts

# Generate coverage report
npm run test -- --coverage
```

Test files are located in the `tests/` directory and cover:
- Authentication endpoints
- Chess.com service integration
- Middleware functionality
- Service layer logic

## Rate Limiting

Built-in rate limiting with different limits for different endpoint types:
- **Auth endpoints**: 10 requests per 15 minutes
- **API endpoints**: 1000 requests per hour (authenticated)
- **Default**: 100 requests per hour

## Monitoring & Observability

The system includes built-in monitoring:
- Scheduled health checks every 5 minutes
- Automatic cleanup of old data every 6 hours
- Request logging and error tracking
- Performance metrics for Chess.com API calls

## Security Features

- JWT-based authentication with secure tokens
- Password hashing with SHA-256
- Request validation and sanitization
- Rate limiting per IP and user
- CORS protection
- Input validation for all endpoints

## Error Handling

Comprehensive error handling with:
- Structured error responses
- Request ID tracking
- Detailed logging for debugging
- Graceful degradation for external API failures

## Future Enhancements

This MVP is designed for expansion with:
- Claude AI integration for game analysis
- Advanced notification intelligence
- Chess coaching features
- Performance analytics dashboard
- Mobile app support

See `IMPLEMENTATION_PLAN.md` for detailed roadmap.

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests for new functionality
4. Run the test suite
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the documentation in `/docs`
- Review the architecture guide in `ARCHITECTURE.md`