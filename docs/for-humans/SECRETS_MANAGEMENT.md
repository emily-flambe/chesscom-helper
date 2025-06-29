# Secrets Management Guide for D1 Migration

This guide covers how to manage secrets, environment variables, and configuration for the Chess.com Helper application after migrating to Cloudflare D1.

## Table of Contents

1. [Overview](#overview)
2. [Types of Configuration](#types-of-configuration)
3. [Development Environment](#development-environment)
4. [Production Environment](#production-environment)
5. [Wrangler Secrets Management](#wrangler-secrets-management)
6. [Environment Variables](#environment-variables)
7. [Security Best Practices](#security-best-practices)
8. [Migration from PostgreSQL](#migration-from-postgresql)
9. [Troubleshooting](#troubleshooting)

## Overview

After migrating to D1, the application's secret management strategy simplifies significantly:

### Before (PostgreSQL)
- Database connection strings with credentials
- Multiple environment variables for database configuration
- External service credentials
- API keys and tokens

### After (D1)
- D1 database bindings (no connection strings needed)
- Simplified environment variables
- Same external service credentials
- Same API keys and tokens

## Types of Configuration

### Public Configuration (wrangler.toml)
Configuration that can be safely committed to version control:

```toml
# Environment variables (public)
[vars]
CHESS_COM_API_BASE = "https://api.chess.com/pub"
FRONTEND_URL = "https://chesscom-helper.emily-flambe.workers.dev"
NODE_ENV = "production"

# D1 Database bindings (public)
[[d1_databases]]
binding = "DB"
database_name = "chesscom-helper-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Private Configuration (Wrangler Secrets)
Sensitive data that should never be committed to version control:

```toml
# These are NOT in wrangler.toml - managed via wrangler secret commands
# EMAIL_HOST_PASSWORD
# EMAIL_API_KEY
# SENDGRID_API_KEY (if used)
# WEBHOOK_SECRET (if used)
```

## Development Environment

### Local Development Setup

1. **Environment Variables File**
   Create `.env.local` file (never commit this):
   ```bash
   # .env.local - for local development only
   CHESS_COM_API_BASE=https://api.chess.com/pub
   FRONTEND_URL=http://localhost:8787
   NODE_ENV=development
   
   # Email configuration (if testing locally)
   EMAIL_HOST_PASSWORD=your-dev-email-password
   EMAIL_API_KEY=your-dev-api-key
   ```

2. **Local Wrangler Configuration**
   The main wrangler.toml handles local development:
   ```toml
   # This works for both local and remote
   [vars]
   CHESS_COM_API_BASE = "https://api.chess.com/pub"
   FRONTEND_URL = "http://localhost:8787"  # Updated for local dev
   ```

3. **Local D1 Database**
   D1 automatically handles local database instances:
   ```bash
   # Start local development (creates local D1 automatically)
   wrangler dev --local
   ```

### Development Secrets

For local development, you can set secrets that won't affect production:

```bash
# Set development secrets (these don't affect production)
echo "dev-email-password" | wrangler secret put EMAIL_HOST_PASSWORD --env development
echo "dev-api-key" | wrangler secret put EMAIL_API_KEY --env development
```

## Production Environment

### Production Configuration

1. **Public Variables (wrangler.toml)**
   ```toml
   name = "chesscom-helper"
   main = "src/index.js"
   compatibility_date = "2024-01-01"
   compatibility_flags = ["nodejs_compat"]

   # D1 Database binding
   [[d1_databases]]
   binding = "DB"
   database_name = "chesscom-helper-db"
   database_id = "your-production-database-id"

   # Public environment variables
   [vars]
   CHESS_COM_API_BASE = "https://api.chess.com/pub"
   FRONTEND_URL = "https://chesscom-helper.emily-flambe.workers.dev"
   NODE_ENV = "production"
   ```

2. **Production Secrets**
   Set via Wrangler CLI (covered in next section)

## Wrangler Secrets Management

### Setting Secrets

```bash
# Set a secret (will prompt for value)
wrangler secret put SECRET_NAME

# Set a secret from command line (less secure - visible in history)
echo "secret-value" | wrangler secret put SECRET_NAME

# Set a secret from file
wrangler secret put SECRET_NAME < secret-file.txt
```

### Required Secrets for Chess.com Helper

1. **Email Configuration (if using SMTP)**
   ```bash
   # Set email password
   wrangler secret put EMAIL_HOST_PASSWORD
   # When prompted, enter your email provider's password or app password
   ```

2. **Email API Key (if using SendGrid/similar)**
   ```bash
   # Set email API key
   wrangler secret put EMAIL_API_KEY
   # When prompted, enter your email service API key
   ```

3. **Optional Webhook Secret**
   ```bash
   # If you have webhook endpoints that need authentication
   wrangler secret put WEBHOOK_SECRET
   ```

### Managing Secrets

```bash
# List all secrets (shows names only, not values)
wrangler secret list

# Delete a secret
wrangler secret delete SECRET_NAME

# Update a secret (same as setting)
wrangler secret put SECRET_NAME
```

### Environment-Specific Secrets

If you have multiple environments (staging, production):

```bash
# Set secret for specific environment
wrangler secret put EMAIL_API_KEY --env production
wrangler secret put EMAIL_API_KEY --env staging

# List secrets for specific environment
wrangler secret list --env production
```

## Environment Variables

### Accessing Variables in Worker Code

```javascript
export default {
  async fetch(request, env, ctx) {
    // Public variables from [vars] section
    const apiBase = env.CHESS_COM_API_BASE;
    const frontendUrl = env.FRONTEND_URL;
    
    // Secrets from wrangler secret commands
    const emailPassword = env.EMAIL_HOST_PASSWORD;
    const emailApiKey = env.EMAIL_API_KEY;
    
    // D1 database binding
    const database = env.DB;
    
    // Use in your application logic
    const dbService = new D1DatabaseService(database);
    // ...
  }
};
```

### Environment Variable Naming

Follow consistent naming conventions:

```bash
# Public configuration (in [vars])
CHESS_COM_API_BASE          # External API endpoints
FRONTEND_URL                # Application URL
NODE_ENV                    # Environment name

# Private secrets (via wrangler secret)
EMAIL_HOST_PASSWORD         # Email SMTP password
EMAIL_API_KEY               # Email service API key
SENDGRID_API_KEY           # SendGrid specific key
WEBHOOK_SECRET             # Webhook authentication
```

## Security Best Practices

### Secret Storage

1. **Never commit secrets to version control**
   ```bash
   # Add to .gitignore
   echo ".env*" >> .gitignore
   echo "*.secret" >> .gitignore
   ```

2. **Use strong, unique secrets**
   ```bash
   # Generate strong secrets
   openssl rand -base64 32
   ```

3. **Rotate secrets regularly**
   ```bash
   # Update secrets periodically
   wrangler secret put EMAIL_API_KEY
   ```

### Access Control

1. **Limit Wrangler access**
   - Only authorized team members should have Wrangler access
   - Use Cloudflare team accounts for better access control
   - Review team member access regularly

2. **Environment separation**
   ```bash
   # Use different secrets for different environments
   wrangler secret put API_KEY --env staging
   wrangler secret put API_KEY --env production
   ```

### Monitoring and Auditing

1. **Monitor secret usage**
   ```bash
   # Check application logs for secret access
   wrangler tail chesscom-helper
   ```

2. **Audit secret changes**
   - Document when secrets are changed
   - Keep track of who has access to secrets
   - Review Cloudflare audit logs

## Migration from PostgreSQL

### Secrets No Longer Needed

After migrating to D1, you can remove these secrets:

```bash
# These PostgreSQL-related secrets are no longer needed
wrangler secret delete DATABASE_URL
wrangler secret delete POSTGRES_HOST
wrangler secret delete POSTGRES_USER
wrangler secret delete POSTGRES_PASSWORD
wrangler secret delete POSTGRES_DB
```

### Migration Steps

1. **Inventory current secrets**
   ```bash
   # List all current secrets
   wrangler secret list
   ```

2. **Identify which secrets to keep**
   - Email configuration secrets: **KEEP**
   - API keys for external services: **KEEP**
   - Database connection secrets: **REMOVE**

3. **Clean up old secrets**
   ```bash
   # Remove PostgreSQL secrets
   wrangler secret delete DATABASE_URL
   # ... (other PostgreSQL-related secrets)
   ```

4. **Update application code**
   Remove references to old environment variables:
   ```javascript
   // Remove these references
   // const databaseUrl = env.DATABASE_URL;
   // const postgresHost = env.POSTGRES_HOST;
   
   // Keep these
   const emailApiKey = env.EMAIL_API_KEY;
   const database = env.DB; // D1 binding
   ```

### Validation After Migration

```bash
# Verify correct secrets are set
wrangler secret list

# Test application with new configuration
wrangler dev --local

# Deploy and test production
wrangler deploy
```

## Troubleshooting

### Common Issues

1. **Secret not found error**
   ```
   Error: SECRET_NAME is not defined
   ```
   
   **Solution:**
   ```bash
   # Set the missing secret
   wrangler secret put SECRET_NAME
   ```

2. **Old database connection errors**
   ```
   Error: DATABASE_URL is not defined
   ```
   
   **Solution:**
   Remove references to old PostgreSQL environment variables from your code.

3. **Development vs Production secret conflicts**
   ```
   Error: Wrong API endpoint in development
   ```
   
   **Solution:**
   Use environment-specific secrets:
   ```bash
   wrangler secret put EMAIL_API_KEY --env development
   wrangler secret put EMAIL_API_KEY --env production
   ```

### Debugging Secret Issues

1. **Check if secret is set**
   ```bash
   wrangler secret list
   ```

2. **Test secret access in worker**
   ```javascript
   console.log('Available env vars:', Object.keys(env));
   console.log('EMAIL_API_KEY exists:', !!env.EMAIL_API_KEY);
   ```

3. **Use wrangler tail for debugging**
   ```bash
   wrangler tail chesscom-helper
   ```

### Emergency Secret Reset

If you suspect a secret has been compromised:

1. **Immediately rotate the secret**
   ```bash
   wrangler secret put COMPROMISED_SECRET_NAME
   ```

2. **Update the secret at its source**
   - Generate new API key from service provider
   - Change password in email service
   - Update webhook endpoint authentication

3. **Monitor for unauthorized access**
   ```bash
   wrangler tail chesscom-helper
   # Look for suspicious activity
   ```

4. **Update dependent services**
   - Notify any services that depend on the secret
   - Update documentation with new secret requirements

## Best Practices Summary

### Do's
- ✅ Use `wrangler secret put` for sensitive data
- ✅ Use `[vars]` in wrangler.toml for public configuration
- ✅ Use descriptive, consistent naming for secrets
- ✅ Document what each secret is used for
- ✅ Rotate secrets regularly
- ✅ Use environment-specific secrets when needed
- ✅ Keep .env files in .gitignore

### Don'ts
- ❌ Never commit secrets to version control
- ❌ Don't share secrets via insecure channels (email, chat)
- ❌ Don't reuse secrets across environments unnecessarily
- ❌ Don't hardcode secrets in application code
- ❌ Don't leave unused secrets configured
- ❌ Don't forget to clean up old PostgreSQL secrets

---

**Remember:** Proper secrets management is crucial for application security. When in doubt, treat information as sensitive and use Wrangler secrets rather than public environment variables.