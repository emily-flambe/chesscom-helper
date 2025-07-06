# Setup Steps for Manual Tasks
## Email Notifications Implementation - Manual Configuration Guide

**Version**: 1.0  
**Date**: 2025-07-06  
**Target Audience**: Project Owner / System Administrator  
**Estimated Time**: 2-3 hours  

---

## 📋 Overview

This document outlines the manual setup steps required for implementing the email notifications feature. These tasks cannot be automated and require manual configuration by the project owner/administrator.

**⚠️ Important**: Complete these tasks before starting the technical implementation phases.

---

## 🔧 Required Manual Tasks

### 1. Email Service Configuration (30 minutes)

#### 1.1 Resend API Setup
**Current Status**: ✅ Already configured (based on existing `emailService.ts`)

**Verify Configuration**:
```bash
# Check if Resend API key is configured
grep -r "RESEND_API_KEY" wrangler.toml
```

**If not configured, add to `wrangler.toml`**:
```toml
[env.production.vars]
RESEND_API_KEY = "your-resend-api-key-here"

[env.staging.vars]
RESEND_API_KEY = "your-staging-resend-api-key-here"
```

#### 1.2 Email Domain Configuration
**Required**: Configure email authentication for `chesshelper.app`

**DNS Records to Add**:
```dns
# SPF Record
chesshelper.app. IN TXT "v=spf1 include:_spf.resend.com ~all"

# DKIM Record (get from Resend dashboard)
resend._domainkey.chesshelper.app. IN TXT "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY_HERE"

# DMARC Record
_dmarc.chesshelper.app. IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@chesshelper.app"
```

**Verification Steps**:
1. Log into Resend dashboard
2. Navigate to Domains section
3. Add `chesshelper.app` domain
4. Copy DNS records provided by Resend
5. Add records to DNS provider
6. Verify domain in Resend dashboard

---

### 2. Database Migration Preparation (15 minutes)

#### 2.1 Backup Current Database
**Critical**: Always backup before schema changes

```bash
# Create backup of current D1 database
npx wrangler d1 backup create chess-helper-db --local

# Verify backup was created
npx wrangler d1 backup list chess-helper-db
```

#### 2.2 Test Environment Setup
**Required**: Separate testing database for development

```bash
# Create staging database
npx wrangler d1 create chess-helper-staging

# Update wrangler.toml with staging database
```

**Add to `wrangler.toml`**:
```toml
[env.staging]
[[env.staging.d1_databases]]
binding = "DB"
database_name = "chess-helper-staging"
database_id = "your-staging-database-id"
```

---

### 3. Environment Variables Configuration (20 minutes)

#### 3.1 Required Environment Variables
**Add to `wrangler.toml`**:

```toml
[env.production.vars]
# Email Configuration
RESEND_API_KEY = "re_your_production_key"
EMAIL_FROM_ADDRESS = "notifications@chesshelper.app"
EMAIL_FROM_NAME = "Chess.com Helper"
EMAIL_REPLY_TO = "support@chesshelper.app"

# Notification Settings
NOTIFICATION_COOLDOWN_MINUTES = "60"
MAX_NOTIFICATIONS_PER_BATCH = "100"
NOTIFICATION_RETRY_ATTEMPTS = "3"

# Feature Flags
NOTIFICATIONS_ENABLED = "true"
NOTIFICATION_BETA_USERS = "false"

# Chess.com API
CHESS_COM_API_BASE_URL = "https://api.chess.com/pub"
CHESS_COM_API_USER_AGENT = "ChessComHelper/1.0"
CHESS_COM_API_RATE_LIMIT_MS = "200"

# Application URLs
APP_BASE_URL = "https://chesshelper.app"
UNSUBSCRIBE_BASE_URL = "https://chesshelper.app/unsubscribe"
PREFERENCES_BASE_URL = "https://chesshelper.app/notifications/preferences"

[env.staging.vars]
# Same as production but with staging values
RESEND_API_KEY = "re_your_staging_key"
EMAIL_FROM_ADDRESS = "notifications@staging.chesshelper.app"
NOTIFICATIONS_ENABLED = "true"
NOTIFICATION_BETA_USERS = "true"
APP_BASE_URL = "https://staging.chesshelper.app"
```

#### 3.2 Local Development Environment
**Create `.dev.vars` file**:
```bash
# Local development environment variables
RESEND_API_KEY="re_your_development_key"
EMAIL_FROM_ADDRESS="notifications@localhost"
EMAIL_FROM_NAME="Chess.com Helper (Dev)"
NOTIFICATION_COOLDOWN_MINUTES="5"
NOTIFICATIONS_ENABLED="true"
APP_BASE_URL="http://localhost:8787"
```

**⚠️ Important**: Add `.dev.vars` to `.gitignore`

---

### 4. Monitoring and Analytics Setup (45 minutes)

#### 4.1 Cloudflare Analytics Configuration
**Enable Analytics**:
1. Go to Cloudflare Workers dashboard
2. Select your chess-helper worker
3. Enable Analytics & Logs
4. Configure log retention (recommended: 7 days)

#### 4.2 Email Analytics Setup
**Resend Webhook Configuration**:
1. Log into Resend dashboard
2. Navigate to Webhooks section
3. Add webhook endpoint: `https://chesshelper.app/api/v1/webhooks/email`
4. Select events: `email.sent`, `email.delivered`, `email.bounced`, `email.complained`
5. Copy webhook signing secret

**Add webhook secret to `wrangler.toml`**:
```toml
[env.production.vars]
RESEND_WEBHOOK_SECRET = "your-webhook-signing-secret"
```

#### 4.3 Monitoring Dashboards
**Optional**: Set up external monitoring

**Recommended Services**:
- **Uptime Robot**: Monitor email delivery endpoints
- **Sentry**: Error tracking and performance monitoring
- **LogRocket**: User session recording (for preference UI)

---

### 5. Security Configuration (30 minutes)

#### 5.1 CORS Configuration
**Update CORS settings in worker**:
```typescript
// Add to main worker file
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://chesshelper.app',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};
```

#### 5.2 Rate Limiting Configuration
**Email-specific rate limits**:
- Max 10 preference changes per user per minute
- Max 100 notifications per user per day
- Max 1000 API calls per IP per hour

#### 5.3 Content Security Policy
**Add to email templates**:
```html
<!-- Email CSP headers -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';">
```

---

### 6. Testing Infrastructure Setup (20 minutes)

#### 6.1 Test Email Accounts
**Create test accounts**:
- Gmail: `chesshelper.test@gmail.com`
- Outlook: `chesshelper.test@outlook.com`
- Yahoo: `chesshelper.test@yahoo.com`

**Use for testing**:
- Email template rendering
- Unsubscribe flow
- Mobile email client compatibility

#### 6.2 Beta User Group
**Create beta user list**:
```sql
-- Mark beta users in database
UPDATE users SET is_beta_user = true 
WHERE email IN (
  'your-email@example.com',
  'trusted-user@example.com'
);
```

#### 6.3 Test Player Accounts
**Chess.com test players** (for monitoring):
- `hikaru` - Very active player
- `magnuscarlsen` - Moderately active
- `test-inactive-player` - Inactive player

---

## 🔍 Verification Checklist

### Pre-Implementation Verification
- [ ] Resend API key configured and tested
- [ ] Email domain DNS records configured
- [ ] Database backup created
- [ ] Environment variables configured
- [ ] Webhook endpoints configured
- [ ] Test accounts created
- [ ] Beta user group defined

### Post-Implementation Verification
- [ ] Test email delivery working
- [ ] Unsubscribe flow functional
- [ ] Preference management working
- [ ] Monitoring alerts configured
- [ ] Analytics data flowing
- [ ] Security headers configured
- [ ] Rate limiting functional

---

## 📊 Configuration Testing Commands

### Test Email Configuration
```bash
# Test Resend API connection
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "notifications@chesshelper.app",
    "to": "your-email@example.com",
    "subject": "Test Email",
    "html": "<p>Test email from Chess.com Helper</p>"
  }'
```

### Test Database Connection
```bash
# Test D1 database connection
npx wrangler d1 execute chess-helper-db --command "SELECT COUNT(*) FROM users"
```

### Test Environment Variables
```bash
# Test environment variable loading
npx wrangler dev --local --var NOTIFICATIONS_ENABLED:true
```

---

## 🚨 Security Considerations

### Email Security
- **SPF/DKIM**: Prevents email spoofing
- **DMARC**: Provides email authentication reporting
- **Unsubscribe**: CAN-SPAM compliance
- **Rate Limiting**: Prevents abuse

### Data Protection
- **Encryption**: All email content encrypted in transit
- **Access Control**: User-scoped data access only
- **Audit Trail**: Complete notification history
- **Data Retention**: Configurable log retention

### API Security
- **Authentication**: JWT tokens for API access
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Sanitize all user inputs
- **CORS**: Restrict cross-origin requests

---

## 📞 Support and Troubleshooting

### Common Issues

#### Email Delivery Issues
**Problem**: Emails not being delivered  
**Solution**: Check DNS records, verify Resend API key, check domain verification

#### Database Connection Issues
**Problem**: Cannot connect to D1 database  
**Solution**: Verify database ID in wrangler.toml, check binding name

#### Environment Variable Issues
**Problem**: Configuration not loading  
**Solution**: Check wrangler.toml syntax, verify variable names

### Getting Help
- **Resend Support**: support@resend.com
- **Cloudflare Support**: Cloudflare dashboard support
- **Chess.com API**: https://www.chess.com/news/view/published-data-api

---

## 📝 Implementation Timeline

### Before Phase 1 (Day 0)
- [ ] Complete email service configuration
- [ ] Set up environment variables
- [ ] Create database backups
- [ ] Configure monitoring

### Before Phase 3 (Day 6)
- [ ] Verify email domain authentication
- [ ] Test email delivery with test accounts
- [ ] Configure webhook endpoints

### Before Phase 5 (Day 12)
- [ ] Set up beta user group
- [ ] Configure production monitoring
- [ ] Verify security configuration

---

## 🎯 Success Criteria

### Configuration Success
- [ ] All environment variables configured
- [ ] Email domain verified in Resend
- [ ] DNS records propagated and verified
- [ ] Database backup created successfully
- [ ] Webhook endpoints responding correctly

### Testing Success
- [ ] Test emails delivered successfully
- [ ] Unsubscribe flow works end-to-end
- [ ] Monitoring alerts trigger correctly
- [ ] Rate limiting prevents abuse
- [ ] Security headers configured properly

---

**⚠️ Important Reminder**: Complete these manual setup steps before beginning the technical implementation phases. These configurations are critical for the proper functioning of the email notification system.

*This document should be kept up-to-date as the system evolves and new configuration requirements are identified.*