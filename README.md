# Chess.com Helper

A web application for tracking Chess.com players and receiving email notifications when they start live matches.

## Tech Stack

- **Backend**: Django (Python) with PostgreSQL
- **Frontend**: React with Vite and Material-UI
- **API**: Chess.com Public API integration
- **Email**: SMTP support for notifications

## Prerequisites

- Python 3.12+ with Poetry
- Node.js 18+ and npm
- PostgreSQL 15+

## Quick Start

```bash
git clone https://github.com/your-username/chesscom-helper.git
cd chesscom-helper

# Complete setup (installs deps, creates database, runs migrations)
make setup

# Start both servers
make dev
```

**Frontend**: http://localhost:5173  
**Backend**: http://localhost:8000  
**Admin**: http://localhost:8000/admin

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

Edit `.env` file:

```bash
# For development (console output)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend

# For production (Gmail example)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-gmail@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

## License

MIT License - see [LICENSE](LICENSE) file for details.