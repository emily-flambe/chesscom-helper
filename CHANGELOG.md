# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-06-14

### Added
- **Enhanced Email Notification System**: Users can now subscribe to email notifications when Chess.com players go live
  - Added "Notify Me" button to each user row in the Users list page
  - Clean modal dialog for entering email addresses with validation
  - Improved user experience with loading states and success/error messages
  - Auto-closing modal after successful subscription
- **Improved User Interface**: Enhanced Users page with better button layout and responsive design
- **Better Error Handling**: Comprehensive error and success message handling for notifications

### Fixed
- Fixed frontend API calls to use correct backend port (8002 instead of 8000)
- Updated all axios requests to point to the Django backend server
- Fixed admin user creation in backend startup script with proper superuser privileges
- Resolved connection issues between frontend and backend components

### Changed
- Updated frontend components to use absolute URLs for backend communication
- Improved button grouping and spacing in Users table actions
- Enhanced notification subscription flow for better user experience

## [0.1.0] - 2025-06-14

### Added
- **Player Tracking**: Add and manage Chess.com players to monitor their activity
- **Live Match Detection**: Automatically check for active games using Chess.com Public API
- **Email Notifications**: Subscribe to email alerts when tracked players start live matches
- **REST API**: Complete API for managing users and notification subscriptions
- **Web Interface**: React frontend with Material-UI for easy player management
- **User Management**: Add, remove, and refresh Chess.com player data
- **Subscription Management**: Subscribe/unsubscribe from player notifications
- **Database Integration**: PostgreSQL database for storing player data and subscriptions
- **Docker Support**: Full Docker Compose setup for easy deployment
- **Email Configuration**: Support for SMTP providers (Gmail, SendGrid, AWS SES, etc.)
- **Background Jobs**: Automated checking for live matches every 5 minutes
- **Comprehensive Documentation**: README with setup instructions, API docs, and troubleshooting

### Features
- Track multiple Chess.com players simultaneously
- Real-time detection of when players start live matches
- Email notifications with game details and links
- User-friendly web interface for managing subscriptions
- RESTful API for programmatic access
- Automatic data refresh and status updates
- Configurable email backends for different environments
- Docker-based development and deployment workflow

### Technical Stack
- **Backend**: Django (Python) with Django REST Framework
- **Frontend**: React 18 with Vite build system and Material-UI components
- **Database**: PostgreSQL with Django ORM
- **API Integration**: Chess.com Public API for player and game data
- **Email**: Django email framework with SMTP support
- **Containerization**: Docker and Docker Compose
- **Development**: Hot reload for frontend, Django debug mode