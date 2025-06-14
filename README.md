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
- **Deployment**: Docker with Docker Compose

## 🏃‍♂️ Quick Start (Local Development)

### Prerequisites

- Docker and Docker Compose
- Git

### 1. Clone and Setup

```bash
git clone https://github.com/your-username/chesscom-helper.git
cd chesscom-helper

# Copy environment file
cp .env .env.local
```

### 2. Start the Application

```bash
# Build containers
make build

# Start all services
make up
```

This will start:
- Django backend on http://localhost:8000
- PostgreSQL database
- React frontend on http://localhost:5173

### 3. Run Database Migrations

```bash
# Open a shell in the web container
make web

# Inside the container, run migrations
python manage.py migrate

# Create a superuser (optional)
python manage.py createsuperuser

# Exit container
exit
```

### 4. Test the API

```bash
# Add a Chess.com user to track
curl -X POST http://localhost:8000/api/chesscom-app/add-user/ \
     -H "Content-Type: application/json" \
     -d '{"username": "magnuscarlsen"}'

# Subscribe to notifications
curl -X POST http://localhost:8000/api/chesscom-app/subscribe/ \
     -H "Content-Type: application/json" \
     -d '{"email": "your-email@example.com", "username": "magnuscarlsen"}'
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
make web
python manage.py check_live_matches --verbose
```

### Automated Monitoring
The system automatically checks for live matches every 5 minutes when deployed. See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup.

## 🖥 Frontend Development

The React frontend runs on http://localhost:5173 when you start the application with `make up`.

To develop the frontend separately:
```bash
cd chesscom_helper/frontend
npm install
npm run dev
```

## 🛠 Development Commands

```bash
# View logs
make logs c=web    # Web container logs
make logs c=db     # Database logs

# Get shell access
make web           # Django shell in web container
make db            # PostgreSQL shell

# Restart services
make restart c=web # Restart web container
make restart       # Restart all containers

# Stop everything
make down
```

## 🐛 Troubleshooting

### Common Issues

**Port already in use error**
```bash
# Kill processes using ports 8000 or 5432
sudo lsof -ti:8000 | xargs kill -9
sudo lsof -ti:5432 | xargs kill -9
```

**Docker permission errors**
```bash
# Add your user to docker group (requires logout/login)
sudo usermod -aG docker $USER
```

**Database connection issues**
```bash
# Restart database container
make restart c=db
```

**Email not sending**
- Check your email credentials in `.env`
- For Gmail, ensure you're using an App Password, not your regular password
- For development, use `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`

### Logs and Debugging

```bash
# View application logs
make logs c=web

# Check email logs in development
# Emails will appear in the console output

# Database logs
make logs c=db
```

## 📁 Project Structure

```
chesscom-helper/
├── chesscom_helper/           # Django project
│   ├── chesscom_app/         # Main Django app
│   │   ├── models.py         # Database models
│   │   ├── views.py          # API endpoints
│   │   ├── services.py       # Email notification service
│   │   └── management/commands/  # Background jobs
│   ├── config/               # Django settings
│   └── frontend/             # React frontend
├── .env                      # Environment variables
├── docker-compose.yml        # Docker configuration
├── Makefile                  # Development commands
├── DEPLOYMENT.md            # Production deployment guide
└── EMAIL_SETUP.md           # Email configuration guide
```

## 🚀 Deployment

For production deployment on AWS EC2, see [DEPLOYMENT.md](DEPLOYMENT.md).

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
