# API Testing Guide

This document provides sample curl commands to test all API routes in the Chess.com Helper application.

## Base URL

Production: `https://chesscom-helper.emily-cogsdill.workers.dev`

## Authentication Routes

### 1. User Registration

Register a new user with email and password.

```bash
curl -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Response (Success):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "user@example.com",
  "userId": "ada59b73-6476-4df5-96bf-449d0447ca17"
}
```

**Expected Response (User Exists):**
```json
{
  "error": "User already exists"
}
```

### 2. User Login

Login with existing user credentials.

```bash
curl -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Response (Success):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "ada59b73-6476-4df5-96bf-449d0447ca17",
    "email": "user@example.com"
  }
}
```

**Expected Response (Invalid Credentials):**
```json
{
  "error": "Invalid credentials"
}
```

### 3. Test Invalid Login

Test authentication with wrong password.

```bash
curl -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "wrongpassword"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Response:**
```json
{
  "error": "Invalid credentials"
}
```

## Player Monitoring Routes

### 4. Get Monitored Players

Retrieve list of currently monitored players.

```bash
curl -X GET https://chesscom-helper.emily-cogsdill.workers.dev/api/players \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Response:**
```json
{
  "players": ["MagnusCarlsen", "Hikaru"],
  "count": 2
}
```

### 5. Add Player to Monitoring

Add a Chess.com player to the monitoring list.

```bash
curl -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "username": "MagnusCarlsen"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Response (Success):**
```json
{
  "success": true,
  "message": "Started monitoring MagnusCarlsen",
  "username": "MagnusCarlsen"
}
```

**Expected Response (Player Not Found):**
```json
{
  "error": "User \"NonExistentPlayer\" not found on Chess.com. Try the exact username (e.g., \"MagnusCarlsen\" instead of \"Magnus\")"
}
```

**Expected Response (Already Monitoring):**
```json
{
  "error": "Already monitoring MagnusCarlsen"
}
```

### 6. Test Invalid Chess.com Username

Try to monitor a non-existent Chess.com user.

```bash
curl -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/monitor \
  -H "Content-Type: application/json" \
  -d '{
    "username": "ThisUserDoesNotExist12345"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Response:**
```json
{
  "error": "User \"ThisUserDoesNotExist12345\" not found on Chess.com. Try the exact username (e.g., \"MagnusCarlsen\" instead of \"Magnus\")"
}
```

## Utility Routes

### 7. Health Check

Check if the application is running and connected to D1.

```bash
curl -X GET https://chesscom-helper.emily-cogsdill.workers.dev/health \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "Chess.com Helper running with D1"
}
```

### 8. Home Page

Access the main application UI.

```bash
curl -X GET https://chesscom-helper.emily-cogsdill.workers.dev/ \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Response:**
- HTML page with Chess.com Helper UI
- HTTP Status: 200

### 9. Favicon

Test favicon endpoint.

```bash
curl -X GET https://chesscom-helper.emily-cogsdill.workers.dev/favicon.png \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Response:**
- PNG image data
- HTTP Status: 200

## Testing Scenarios

### Complete Registration and Login Flow

```bash
# 1. Register a new user
echo "=== Testing Registration ==="
curl -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"testpass123"}' \
  -w "\nHTTP Status: %{http_code}\n"

# 2. Try to register same user again (should fail)
echo -e "\n=== Testing Duplicate Registration ==="
curl -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"differentpass"}' \
  -w "\nHTTP Status: %{http_code}\n"

# 3. Login with correct credentials
echo -e "\n=== Testing Valid Login ==="
curl -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"testpass123"}' \
  -w "\nHTTP Status: %{http_code}\n"

# 4. Login with wrong password
echo -e "\n=== Testing Invalid Login ==="
curl -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"wrongpassword"}' \
  -w "\nHTTP Status: %{http_code}\n"
```

### Player Monitoring Flow

```bash
# 1. Check current monitored players
echo "=== Current Monitored Players ==="
curl -X GET https://chesscom-helper.emily-cogsdill.workers.dev/api/players \
  -w "\nHTTP Status: %{http_code}\n"

# 2. Add a valid Chess.com player
echo -e "\n=== Adding Valid Player ==="
curl -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/monitor \
  -H "Content-Type: application/json" \
  -d '{"username":"Hikaru"}' \
  -w "\nHTTP Status: %{http_code}\n"

# 3. Try to add same player again
echo -e "\n=== Adding Duplicate Player ==="
curl -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/monitor \
  -H "Content-Type: application/json" \
  -d '{"username":"Hikaru"}' \
  -w "\nHTTP Status: %{http_code}\n"

# 4. Check updated player list
echo -e "\n=== Updated Monitored Players ==="
curl -X GET https://chesscom-helper.emily-cogsdill.workers.dev/api/players \
  -w "\nHTTP Status: %{http_code}\n"
```

### Error Handling Tests

```bash
# Test missing fields
echo "=== Testing Missing Email ==="
curl -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"password":"testpass123"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n=== Testing Missing Password ==="
curl -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n=== Testing Invalid JSON ==="
curl -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{invalid json}' \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n=== Testing Non-existent Route ==="
curl -X GET https://chesscom-helper.emily-cogsdill.workers.dev/api/nonexistent \
  -w "\nHTTP Status: %{http_code}\n"
```

## Authentication Flow Testing

To test the complete authentication flow with token usage (for future protected routes):

```bash
# 1. Register and capture token
echo "=== Getting Auth Token ==="
TOKEN=$(curl -s -X POST https://chesscom-helper.emily-cogsdill.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"apitest@example.com","password":"apitest123"}' | \
  jq -r '.token')

echo "Token: $TOKEN"

# 2. Use token for authenticated requests (when implemented)
# curl -X GET https://chesscom-helper.emily-cogsdill.workers.dev/api/protected \
#   -H "Authorization: Bearer $TOKEN" \
#   -w "\nHTTP Status: %{http_code}\n"
```

## Notes

1. **Rate Limiting**: Be mindful of rate limits when testing repeatedly
2. **Data Persistence**: User data is stored in D1 database and persists between requests
3. **JWT Tokens**: Tokens expire after 7 days
4. **Chess.com API**: Player validation uses Chess.com's public API
5. **Case Sensitivity**: Chess.com usernames are case-sensitive

## Troubleshooting

- **500 errors**: Check if D1 database is properly configured
- **404 errors**: Verify the endpoint URL is correct
- **400 errors**: Check request body format and required fields
- **401 errors**: Invalid credentials or expired tokens

## Expected HTTP Status Codes

- `200`: Success
- `201`: Resource created (registration)
- `400`: Bad request (missing fields, validation errors)
- `401`: Unauthorized (invalid credentials)
- `404`: Not found (route or Chess.com user not found)
- `500`: Internal server error