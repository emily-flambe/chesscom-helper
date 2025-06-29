# Railway PostgreSQL HTTP Bridge

HTTP bridge service that allows Cloudflare Workers to communicate with Railway PostgreSQL databases.

## Overview

This service solves the incompatibility between Cloudflare Workers' V8 isolate runtime (no TCP sockets) and traditional PostgreSQL connections by providing a RESTful HTTP API.

## API Endpoints

### Health Checks
- `GET /health` - Detailed health status including database connectivity
- `GET /ready` - Simple readiness check for Railway health monitoring

### Users
- `GET /api/users` - List all users
- `GET /api/users/:username` - Get specific user by username  
- `POST /api/users` - Add new user
- `DELETE /api/users/:username` - Remove user
- `PUT /api/users/:username/status` - Update user playing status

### Subscriptions
- `GET /api/users/:username/subscriptions` - Get user's email subscriptions
- `POST /api/subscriptions` - Add email subscription
- `DELETE /api/subscriptions` - Remove email subscription

## Authentication

All API endpoints (except health checks) require authentication via the `X-API-Key` header.

```bash
curl -H "X-API-Key: your-api-key" https://your-bridge.railway.app/api/users
```

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string (provided by Railway)
- `API_KEY` - Secret key for API authentication

Optional:
- `NODE_ENV` - Environment (production/development)
- `PORT` - Server port (default: 3000)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

## Deployment

This service is designed to be deployed on Railway alongside your PostgreSQL database.

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## Security Features

- API key authentication on all database endpoints
- Rate limiting (100 requests/minute per IP)
- CORS protection (Cloudflare Workers domains only)
- Input validation using Joi schemas
- SQL injection protection via parameterized queries
- Comprehensive error handling and logging

## Monitoring

- Health check endpoint for Railway monitoring
- Structured logging with Winston
- Request/response logging with unique request IDs
- Database connection pool monitoring