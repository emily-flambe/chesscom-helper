# Chess.com Helper

A web application for tracking Chess.com players and receiving email notifications when they start live matches.

## 🚀 Features

- **Player Tracking**: Add and manage Chess.com players to monitor
- **Email Notifications**: Subscribe to notifications when players start live matches
- **Live Match Detection**: Automatically checks for active games every 5 minutes
- **REST API**: Full API for managing users and subscriptions
- **Web Interface**: React frontend for easy interaction

## 🛠 Tech Stack

- **Backend**: Django (Python) with PostgreSQL
- **Frontend**: React with Vite and Material-UI
- **API**: Chess.com Public API integration
- **Email**: SMTP support (Gmail, SendGrid, AWS SES, etc.)
- **Development**: Native setup with shell scripts

## 🏃‍♂️ Quick Start

### Prerequisites

- Python 3.12+
- Poetry (Python package manager)
- Node.js 18+ and npm
- PostgreSQL 15+
- Git

### Automated Setup (Recommended)

```bash
git clone https://github.com/your-username/chesscom-helper.git
cd chesscom-helper

# Complete automated setup
make setup

# Start backend (in terminal 1)
make start-backend

# Start frontend (in terminal 2)  
make start-frontend
```

This will:
- ✅ Check all prerequisites 
- ✅ Install missing dependencies (Poetry)
- ✅ Create PostgreSQL database and user
- ✅ Install Python and Node.js dependencies
- ✅ Run database migrations
- ✅ Start Django backend on http://localhost:8000
- ✅ Start React frontend on http://localhost:5173

### Manual Setup (Alternative)

If you prefer step-by-step setup:

```bash
# Check dependencies
make check-deps

# Setup database
make setup-db

# Install dependencies
make install

# Start backend (terminal 1)
make start-backend

# Start frontend (terminal 2)
make start-frontend
```

### Test the API

```bash
# Add a Chess.com user to track
curl -X POST http://localhost:8000/api/chesscom-app/add-user/ \
     -H "Content-Type: application/json" \
     -d '{"username": "magnuscarlsen"}'

# Subscribe to notifications
curl -X POST http://localhost:8000/api/chesscom-app/subscribe/ \
     -H "Content-Type: application/json" \
     -d '{"email": "your-email@example.com", "username": "magnuscarlsen"}'

# Check for live matches manually
make check-matches
```

That's it! The shell scripts handle all dependency checking and setup automatically.

---

## Manual Installation Guide

If you need to install prerequisites manually:

### macOS (using Homebrew)
```bash
# Install Python, Poetry, Node.js, and PostgreSQL
brew install python@3.12 poetry node postgresql@15

# Start PostgreSQL service
brew services start postgresql@15
```

### Ubuntu/Debian
```bash
# Install Python, Poetry, Node.js, and PostgreSQL
sudo apt update
sudo apt install python3.12 python3.12-venv python3-pip nodejs npm postgresql postgresql-contrib

# Install Poetry
curl -sSL https://install.python-poetry.org | python3 -

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Windows
```bash
# Install using Chocolatey (or download individually)
choco install python nodejs postgresql

# Install Poetry
(Invoke-WebRequest -Uri https://install.python-poetry.org -UseBasicParsing).Content | python -
```

## 📧 Email Configuration (Optional)

To enable email notifications, configure your email settings in `.env`:

### Option 1: Gmail (Easiest for testing)
```bash
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-gmail@gmail.com
EMAIL_HOST_PASSWORD=your-app-password  # Generate from Google Account settings
DEFAULT_FROM_EMAIL=Chess.com Helper <your-gmail@gmail.com>
```

### Option 2: Console Output (Development)
```bash
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

See [EMAIL_SETUP.md](EMAIL_SETUP.md) for detailed email configuration options.

## 🔧 API Endpoints

### User Management
```bash
# List all tracked users
GET /api/chesscom-app/users/

# Get specific user
GET /api/chesscom-app/user/{username}/

# Add user to tracking
POST /api/chesscom-app/add-user/
{"username": "magnuscarlsen"}

# Remove user
DELETE /api/chesscom-app/remove-user/{username}/

# Refresh all user data
POST /api/chesscom-app/refresh-all-users/
```

### Notification Subscriptions
```bash
# Subscribe to notifications
POST /api/chesscom-app/subscribe/
{"email": "user@example.com", "username": "magnuscarlsen"}

# Unsubscribe
POST /api/chesscom-app/unsubscribe/
{"email": "user@example.com", "username": "magnuscarlsen"}

# View subscriptions for a user
GET /api/chesscom-app/user/{username}/subscriptions/
```

## 🎯 Live Match Monitoring

### Manual Check
```bash
# Check for live matches manually
make check-matches
```

### Automated Monitoring
For production-like live match monitoring:

#### Option 1: Cron Job (Linux/macOS)
```bash
# Edit crontab
crontab -e

# Add this line to check every 5 minutes
*/5 * * * * cd /path/to/chesscom-helper && ./scripts/check-live-matches.sh
```

#### Option 2: Manual Testing
```bash
# Run manual check
make check-matches

# Keep running to test notifications
while true; do make check-matches; sleep 300; done
```

## 🖥 Frontend Development

The React frontend runs on http://localhost:5173 when you start with `make start-frontend`.

To develop the frontend separately:
```bash
cd chesscom_helper/frontend
npm install
npm run dev
```

## 🛠 Development Commands

The Makefile provides user-friendly commands:

```bash
# View all available commands
make help

# Setup & Installation
make setup          # Complete first-time setup
make check-deps     # Check if dependencies are installed
make setup-db       # Setup PostgreSQL database only
make install        # Install Python and Node.js dependencies

# Running
make start-backend  # Start Django backend server
make start-frontend # Start React frontend server
make stop           # Stop all running servers

# Development
make check-matches  # Manually check for live matches
make clean          # Clean up temporary files and caches
```

## 🐛 Troubleshooting

### Common Issues

**PostgreSQL connection errors**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list | grep postgresql  # macOS

# Start PostgreSQL if not running
sudo systemctl start postgresql  # Linux
brew services start postgresql@15  # macOS

# Reset PostgreSQL password (if needed)
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'newpassword';"
```

**Poetry not found**
```bash
# Add Poetry to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.local/bin:$PATH"

# Or reinstall Poetry
curl -sSL https://install.python-poetry.org | python3 -
```

**Python version issues**
```bash
# Check Python version
python3 --version  # Should be 3.12+

# Install specific Python version (Ubuntu)
sudo apt install python3.12-dev python3.12-venv

# Use pyenv for version management
curl https://pyenv.run | bash
pyenv install 3.12.0
pyenv local 3.12.0
```

**Node.js/npm issues**
```bash
# Check Node.js version
node --version  # Should be 18+

# Update npm
npm install -g npm@latest

# Clear npm cache if having issues
npm cache clean --force
```

**Database migration errors**
```bash
# Reset migrations (if needed)
cd chesscom_helper
rm -rf chesscom_app/migrations/000*
poetry run python manage.py makemigrations chesscom_app
poetry run python manage.py migrate

# Or recreate database
make setup-db  # This will recreate the database
```

**Permission errors on static files**
```bash
# Fix static files directory permissions
sudo mkdir -p /tmp/chesscom_static
sudo chown -R $USER:$USER /tmp/chesscom_static
```

**Email not sending**
- Check your email credentials in `.env`
- For Gmail, ensure you're using an App Password, not your regular password
- For development, use `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`

**API endpoints returning 404**
- Ensure Django server is running on port 8000
- Check that you're using the correct URL: `http://localhost:8000/api/chesscom-app/`
- Verify database migrations have been run

**Frontend not loading**
- Ensure React dev server is running on port 5173
- Check for npm dependency issues: `npm install`
- Clear browser cache or try incognito mode

## 📁 Project Structure

```
chesscom-helper/
├── scripts/                  # Shell scripts for development
│   ├── check-dependencies.sh # Check if prerequisites are installed
│   ├── setup-database.sh     # Create PostgreSQL database and user
│   ├── start-backend.sh      # Start Django development server
│   ├── start-frontend.sh     # Start React development server
│   └── check-live-matches.sh # Check for live matches manually
├── chesscom_helper/          # Django project
│   ├── chesscom_app/         # Main Django app
│   │   ├── models.py         # Database models
│   │   ├── views.py          # API endpoints
│   │   ├── services.py       # Email notification service
│   │   └── management/commands/  # Background jobs
│   ├── config/               # Django settings
│   └── frontend/             # React frontend
├── .env                      # Environment variables
├── Makefile                  # Development commands
├── DEPLOYMENT.md            # Production deployment guide
└── EMAIL_SETUP.md           # Email configuration guide
```

## 🚀 Deployment

For production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test locally
4. Commit your changes: `git commit -am 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Screenshots

<details>
<summary>Click to expand</summary>

![alt text](screenshots/home.png)
![alt text](screenshots/users.png)
![alt text](screenshots/add_user.png)
![alt text](screenshots/user_details.png)

</details>