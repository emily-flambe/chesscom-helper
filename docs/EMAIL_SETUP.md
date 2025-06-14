# Email Server Setup Guide

## Overview

This guide provides multiple options for setting up email notifications for the Chess.com Helper application. Choose the option that best fits your needs and technical requirements.

## Option 1: Gmail SMTP (Recommended for Getting Started)

### 1.1 Enable 2-Factor Authentication

1. Go to your Google Account settings
2. Navigate to Security → 2-Step Verification
3. Enable 2-Step Verification if not already enabled

### 1.2 Generate App Password

1. Go to Google Account → Security → 2-Step Verification
2. Scroll down to "App passwords"
3. Select "Other (Custom name)" and enter "Chess.com Helper"
4. Copy the generated 16-character password

### 1.3 Configure Environment Variables

Add to your `.env` file:

```bash
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-gmail@gmail.com
EMAIL_HOST_PASSWORD=your-16-character-app-password
DEFAULT_FROM_EMAIL=Chess.com Helper <your-gmail@gmail.com>
```

### 1.4 Test Configuration

```bash
# Run this in Django shell
sudo docker compose exec web python manage.py shell

# Test email sending
from django.core.mail import send_mail
send_mail(
    'Test Email',
    'This is a test email from Chess.com Helper',
    'your-gmail@gmail.com',
    ['recipient@example.com'],
    fail_silently=False,
)
```

## Option 2: SendGrid (Recommended for Production)

### 2.1 Create SendGrid Account

1. Sign up at [SendGrid](https://sendgrid.com/)
2. Complete email verification
3. Choose a free plan (100 emails/day) or paid plan

### 2.2 Create API Key

1. Go to Settings → API Keys
2. Click "Create API Key"
3. Choose "Restricted Access"
4. Give it a name: "Chess.com Helper"
5. Select permissions:
   - Mail Send: Full Access
   - Template Engine: Read Access (optional)
6. Copy the API key

### 2.3 Configure Environment Variables

```bash
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=your-sendgrid-api-key
DEFAULT_FROM_EMAIL=Chess.com Helper <noreply@your-domain.com>
```

### 2.4 Verify Sender Identity

1. In SendGrid dashboard, go to Settings → Sender Authentication
2. Add your domain or verify a single sender email
3. Follow the verification process

## Option 3: Amazon SES (Cost-Effective for High Volume)

### 3.1 Set Up AWS SES

1. Log into AWS Console
2. Navigate to Simple Email Service (SES)
3. Choose your region
4. Verify your domain or email address

### 3.2 Create SMTP Credentials

1. In SES console, go to Account dashboard
2. Click "Create SMTP credentials"
3. Enter IAM user name: "chesscom-helper-smtp"
4. Download credentials CSV file

### 3.3 Configure Environment Variables

```bash
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com  # Replace with your region
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-smtp-username
EMAIL_HOST_PASSWORD=your-smtp-password
DEFAULT_FROM_EMAIL=Chess.com Helper <noreply@your-verified-domain.com>
```

### 3.4 Request Production Access

1. In SES console, go to Account dashboard
2. Click "Request production access"
3. Fill out the form with your use case
4. Wait for approval (usually 24-48 hours)

## Option 4: Self-Hosted Email Server (Advanced)

### 4.1 Install Postfix on EC2

```bash
# Update system
sudo apt update

# Install Postfix
sudo apt install postfix mailutils

# During installation, choose "Internet Site"
# Enter your domain name when prompted
```

### 4.2 Configure Postfix

Edit `/etc/postfix/main.cf`:

```bash
sudo nano /etc/postfix/main.cf
```

Add/modify these lines:

```bash
# Basic configuration
myhostname = mail.your-domain.com
mydomain = your-domain.com
myorigin = $mydomain
inet_interfaces = all
inet_protocols = ipv4

# Network configuration
mydestination = $myhostname, localhost.$mydomain, localhost, $mydomain
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128

# TLS configuration
smtpd_tls_cert_file = /etc/ssl/certs/ssl-cert-snakeoil.pem
smtpd_tls_key_file = /etc/ssl/private/ssl-cert-snakeoil.key
smtpd_use_tls = yes
smtpd_tls_auth_only = yes
```

### 4.3 Configure DNS Records

Add these DNS records for your domain:

```
Type: MX
Name: @
Value: 10 mail.your-domain.com

Type: A
Name: mail
Value: your-ec2-ip-address

Type: TXT
Name: @
Value: v=spf1 ip4:your-ec2-ip-address ~all
```

### 4.4 Configure Django Settings

```bash
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=localhost
EMAIL_PORT=25
EMAIL_USE_TLS=False
DEFAULT_FROM_EMAIL=Chess.com Helper <noreply@your-domain.com>
```

### 4.5 Start and Enable Postfix

```bash
sudo systemctl start postfix
sudo systemctl enable postfix

# Test configuration
echo "Test email body" | mail -s "Test Subject" recipient@example.com
```

## Email Template Customization

### 5.1 Custom Email Templates

Create `chesscom_helper/templates/emails/live_match_notification.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ player.username }} is playing live!</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .header { background-color: #2e7d32; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .game-info { background-color: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .footer { font-size: 12px; color: #666; padding: 20px; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏆 {{ player.username }} is playing live!</h1>
    </div>
    
    <div class="content">
        <p>Hi there!</p>
        
        <p><strong>{{ player.username }}</strong> ({{ player.name|default:"Chess.com Player" }}) has started playing live matches on Chess.com!</p>
        
        {% for game in live_games %}
        <div class="game-info">
            <h3>Live Game #{{ forloop.counter }}</h3>
            <p><strong>Time Control:</strong> {{ game.time_control|default:"Unknown" }}</p>
            <p><strong>Watch Live:</strong> <a href="{{ game.url }}">{{ game.url }}</a></p>
        </div>
        {% endfor %}
        
        <p>Don't miss the action! Click the links above to watch the games live.</p>
    </div>
    
    <div class="footer">
        <p>You received this notification because you subscribed to updates for {{ player.username }}.</p>
        <p>Chess.com Helper - Live Match Notifications</p>
    </div>
</body>
</html>
```

### 5.2 Update Email Service

Modify `chesscom_helper/chesscom_app/services.py` to use HTML templates:

```python
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives

def send_live_match_notification(user, live_games):
    """Send HTML email notification."""
    
    active_subscriptions = EmailSubscription.objects.filter(
        player=user,
        is_active=True
    )
    
    if not active_subscriptions.exists():
        return {"message": f"No active subscriptions for {user.username}"}
    
    subject = f"🏆 {user.username} is now playing live on Chess.com!"
    
    # Render HTML template
    html_content = render_to_string('emails/live_match_notification.html', {
        'player': user,
        'live_games': live_games,
    })
    
    # Plain text fallback
    text_content = f"""
Hi!

{user.username} ({user.name or 'Chess.com Player'}) has started playing live matches on Chess.com!

Game Details:
{chr(10).join([f"- Time Control: {game.get('time_control', 'Unknown')} - {game.get('url', '#')}" for game in live_games])}

You can watch the games live by visiting the URLs above.

This notification was sent because you subscribed to updates for {user.username}.
    """.strip()
    
    successful_sends = 0
    failed_sends = 0
    
    for subscription in active_subscriptions:
        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[subscription.email]
            )
            msg.attach_alternative(html_content, "text/html")
            msg.send()
            
            # Log success
            NotificationLog.objects.create(
                subscription=subscription,
                notification_type='live_match',
                success=True
            )
            successful_sends += 1
            
        except Exception as e:
            # Log failure
            NotificationLog.objects.create(
                subscription=subscription,
                notification_type='live_match',
                success=False,
                error_message=str(e)
            )
            failed_sends += 1
    
    return {
        "message": f"Notifications processed for {user.username}",
        "successful_sends": successful_sends,
        "failed_sends": failed_sends,
        "total_subscriptions": active_subscriptions.count()
    }
```

## Security and Best Practices

### 6.1 Rate Limiting

Add rate limiting to prevent spam:

```python
# In settings.py
EMAIL_RATE_LIMIT = 100  # emails per hour per user

# In services.py
from django.core.cache import cache
from django.utils import timezone

def check_email_rate_limit(email):
    """Check if email has exceeded rate limit."""
    key = f"email_rate_limit:{email}"
    current_count = cache.get(key, 0)
    
    if current_count >= settings.EMAIL_RATE_LIMIT:
        return False
    
    # Increment counter with 1-hour expiry
    cache.set(key, current_count + 1, 3600)
    return True
```

### 6.2 Unsubscribe Links

Add unsubscribe functionality:

```python
# In services.py
import uuid
from django.urls import reverse

# Generate unsubscribe token
unsubscribe_token = str(uuid.uuid4())
cache.set(f"unsubscribe:{unsubscribe_token}", subscription.id, 86400 * 7)  # 7 days

unsubscribe_url = request.build_absolute_uri(
    reverse('unsubscribe_token', args=[unsubscribe_token])
)
```

### 6.3 Email Validation

Validate email addresses before subscribing:

```python
from django.core.validators import validate_email
from django.core.exceptions import ValidationError

def validate_subscription_email(email):
    """Validate email address format."""
    try:
        validate_email(email)
        return True
    except ValidationError:
        return False
```

## Monitoring and Analytics

### 7.1 Email Delivery Tracking

Create dashboard to monitor email statistics:

```python
# In views.py
def email_stats(request):
    """Display email delivery statistics."""
    
    total_sent = NotificationLog.objects.filter(success=True).count()
    total_failed = NotificationLog.objects.filter(success=False).count()
    
    recent_logs = NotificationLog.objects.order_by('-sent_at')[:50]
    
    return JsonResponse({
        'total_sent': total_sent,
        'total_failed': total_failed,
        'success_rate': (total_sent / (total_sent + total_failed)) * 100 if (total_sent + total_failed) > 0 else 0,
        'recent_logs': list(recent_logs.values())
    })
```

### 7.2 Error Handling and Alerts

Set up alerts for email failures:

```python
# In services.py
import logging

logger = logging.getLogger(__name__)

def send_admin_alert(message):
    """Send alert to administrators."""
    if failed_sends > 10:  # Alert if more than 10 failures
        logger.error(f"High email failure rate: {message}")
        # Send alert to admin email
```

## Troubleshooting

### Common Issues and Solutions

1. **Gmail "Less secure app access"**: Use App Passwords instead
2. **SendGrid authentication failed**: Verify API key permissions
3. **AWS SES still in sandbox**: Request production access
4. **Self-hosted emails going to spam**: Configure SPF, DKIM, and DMARC records
5. **Rate limiting errors**: Implement proper rate limiting and retry logic

### Testing Email Configuration

```bash
# Test from Django shell
sudo docker compose exec web python manage.py shell

from django.core.mail import send_mail
from django.conf import settings

# Test basic email sending
send_mail(
    'Test Subject',
    'Test message body',
    settings.DEFAULT_FROM_EMAIL,
    ['test@example.com'],
    fail_silently=False,
)

# Test HTML email
from django.core.mail import EmailMultiAlternatives

msg = EmailMultiAlternatives(
    'HTML Test',
    'Plain text version',
    settings.DEFAULT_FROM_EMAIL,
    ['test@example.com']
)
msg.attach_alternative('<h1>HTML Version</h1>', "text/html")
msg.send()
```

---

Your email notification system is now configured and ready to send live match alerts to subscribers!