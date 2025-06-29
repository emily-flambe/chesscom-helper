# Monitoring Guide

This document provides comprehensive monitoring procedures for the Chess.com Helper application running on Cloudflare Workers with D1 database integration.

## Overview

The monitoring strategy covers four main areas:
1. **Worker Performance** - Main worker and cron worker execution metrics
2. **D1 Database Health** - Query performance, connection status, and data integrity
3. **Application Logic** - Business logic errors and Chess.com API integration
4. **User Experience** - Frontend performance and API response times

## Quick Health Check

```bash
# Run this command for immediate system status
./scripts/health-check.sh
```

Or manually:

```bash
# Check worker status
curl -f https://chesscom-helper.emily-flambe.workers.dev/api/health

# Check D1 connectivity
wrangler d1 execute chesscom-helper-db --command="SELECT 1 as health_check"

# Check recent cron executions
wrangler tail chesscom-helper-cron --once
```

## Worker Monitoring

### Real-time Log Monitoring

```bash
# Monitor main worker (frontend + API)
wrangler tail chesscom-helper

# Monitor cron worker (background jobs)
wrangler tail chesscom-helper-cron

# Monitor both workers simultaneously
wrangler tail chesscom-helper & wrangler tail chesscom-helper-cron
```

### Filtered Log Monitoring

```bash
# Monitor errors only
wrangler tail chesscom-helper --grep "ERROR|FATAL|Exception"

# Monitor API requests
wrangler tail chesscom-helper --grep "POST|PUT|DELETE"

# Monitor D1 queries
wrangler tail chesscom-helper --grep "D1|database|query"

# Monitor email notifications
wrangler tail chesscom-helper-cron --grep "email|notification|sendgrid"
```

### Performance Metrics

```bash
# Check worker execution times
wrangler tail chesscom-helper --grep "duration|elapsed|time" --once

# Monitor memory usage
wrangler tail chesscom-helper --grep "memory|heap|usage" --once

# Check request/response patterns
wrangler tail chesscom-helper --format=json | jq '.outcome'
```

## D1 Database Monitoring

### Connection Health

```bash
# Basic connectivity test
wrangler d1 execute chesscom-helper-db --command="SELECT datetime('now') as current_time"

# Connection pool status (if applicable)
wrangler d1 execute chesscom-helper-db --command="PRAGMA database_list"

# Database size and statistics
wrangler d1 execute chesscom-helper-db --command="
SELECT 
  name,
  COUNT(*) as row_count
FROM (
  SELECT 'users' as name FROM chesscom_app_user
  UNION ALL SELECT 'subscriptions' FROM chesscom_app_emailsubscription
  UNION ALL SELECT 'notifications' FROM chesscom_app_notificationlog
) 
GROUP BY name"
```

### Query Performance Monitoring

```bash
# Test query response times
time wrangler d1 execute chesscom-helper-db --command="SELECT COUNT(*) FROM chesscom_app_user"

# Check for slow queries (via Worker logs)
wrangler tail chesscom-helper --grep "slow|timeout|query.*ms"

# Monitor concurrent query load
wrangler tail chesscom-helper --grep "D1.*concurrent"
```

### Data Integrity Checks

```bash
# Check for orphaned records
wrangler d1 execute chesscom-helper-db --command="
SELECT 'orphaned_subscriptions' as issue, COUNT(*) as count
FROM chesscom_app_emailsubscription es
LEFT JOIN chesscom_app_user u ON es.player_id = u.player_id
WHERE u.player_id IS NULL

UNION ALL

SELECT 'orphaned_notifications' as issue, COUNT(*) as count
FROM chesscom_app_notificationlog nl
LEFT JOIN chesscom_app_emailsubscription es ON nl.subscription_id = es.id
WHERE es.id IS NULL"

# Validate JSON fields
wrangler d1 execute chesscom-helper-db --command="
SELECT username, streaming_platforms
FROM chesscom_app_user 
WHERE json_valid(streaming_platforms) = 0
LIMIT 5"

# Check for duplicate usernames
wrangler d1 execute chesscom-helper-db --command="
SELECT username, COUNT(*) as count
FROM chesscom_app_user
GROUP BY username
HAVING COUNT(*) > 1"
```

## Application Logic Monitoring

### Chess.com API Integration

```bash
# Monitor Chess.com API calls from cron worker
wrangler tail chesscom-helper-cron --grep "chess.com|api.chess.com"

# Check for API rate limiting
wrangler tail chesscom-helper-cron --grep "rate.*limit|429|quota"

# Monitor API response times
wrangler tail chesscom-helper-cron --grep "chess.*api.*ms"
```

### Email Service Monitoring

```bash
# Monitor email sending attempts
wrangler tail chesscom-helper-cron --grep "email|sendgrid|notification"

# Check email delivery failures
wrangler tail chesscom-helper-cron --grep "email.*error|sendgrid.*fail|smtp.*error"

# Track email statistics
wrangler d1 execute chesscom-helper-db --command="
SELECT 
  DATE(sent_at) as date,
  notification_type,
  success,
  COUNT(*) as count
FROM chesscom_app_notificationlog
WHERE sent_at >= datetime('now', '-7 days')
GROUP BY DATE(sent_at), notification_type, success
ORDER BY date DESC"
```

### User Activity Monitoring

```bash
# Check new user registrations
wrangler d1 execute chesscom-helper-db --command="
SELECT DATE(created_at) as date, COUNT(*) as new_users
FROM chesscom_app_user
WHERE created_at >= datetime('now', '-7 days')
GROUP BY DATE(created_at)
ORDER BY date DESC"

# Monitor subscription activity
wrangler d1 execute chesscom-helper-db --command="
SELECT 
  is_active,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM chesscom_app_emailsubscription
GROUP BY is_active"

# Track live match detection
wrangler d1 execute chesscom-helper-db --command="
SELECT 
  username,
  is_playing,
  last_online
FROM chesscom_app_user
WHERE is_playing = 1
ORDER BY last_online DESC"
```

## Performance Benchmarking

### API Endpoint Performance

```bash
# Test main API endpoints
endpoints=(
  "/api/users"
  "/api/chesscom-app/add-user/"
  "/api/chesscom-app/subscribe/"
  "/api/health"
)

for endpoint in "${endpoints[@]}"; do
  echo "Testing $endpoint:"
  curl -w "Response time: %{time_total}s, Status: %{http_code}\n" \
       -s -o /dev/null \
       "https://chesscom-helper.emily-flambe.workers.dev$endpoint"
done
```

### Database Query Benchmarks

```bash
# Benchmark common queries
queries=(
  "SELECT COUNT(*) FROM chesscom_app_user"
  "SELECT * FROM chesscom_app_user WHERE username = 'magnuscarlsen'"
  "SELECT u.username, COUNT(es.id) FROM chesscom_app_user u LEFT JOIN chesscom_app_emailsubscription es ON u.player_id = es.player_id GROUP BY u.username LIMIT 10"
)

for query in "${queries[@]}"; do
  echo "Benchmarking: ${query:0:50}..."
  time wrangler d1 execute chesscom-helper-db --command="$query" > /dev/null
done
```

### Load Testing

```bash
# Simple concurrent request test
for i in {1..10}; do
  curl -s https://chesscom-helper.emily-flambe.workers.dev/api/health &
done
wait

# Monitor during load test
wrangler tail chesscom-helper --grep "concurrent|queue|throttle"
```

## Automated Monitoring Scripts

### Health Check Script

Create `scripts/health-check.sh`:

```bash
#!/bin/bash
# Health check script for Chess.com Helper

echo "🏥 Chess.com Helper Health Check"
echo "================================"

# Test main worker
echo "🔍 Testing main worker..."
MAIN_STATUS=$(curl -s -w "%{http_code}" -o /dev/null https://chesscom-helper.emily-flambe.workers.dev/api/health)
if [ "$MAIN_STATUS" = "200" ]; then
  echo "✅ Main worker: OK"
else
  echo "❌ Main worker: FAILED (Status: $MAIN_STATUS)"
fi

# Test D1 database
echo "🔍 Testing D1 database..."
D1_TEST=$(wrangler d1 execute chesscom-helper-db --command="SELECT 1" 2>/dev/null)
if [ $? -eq 0 ]; then
  echo "✅ D1 database: OK"
else
  echo "❌ D1 database: FAILED"
fi

# Check recent cron execution
echo "🔍 Checking cron worker..."
CRON_LOGS=$(wrangler tail chesscom-helper-cron --once 2>/dev/null | grep -c ".")
if [ "$CRON_LOGS" -gt 0 ]; then
  echo "✅ Cron worker: OK (Recent activity detected)"
else
  echo "⚠️  Cron worker: No recent activity"
fi

# Data integrity check
echo "🔍 Checking data integrity..."
USER_COUNT=$(wrangler d1 execute chesscom-helper-db --command="SELECT COUNT(*) as count FROM chesscom_app_user" --json | jq -r '.[0].count' 2>/dev/null)
if [[ "$USER_COUNT" =~ ^[0-9]+$ ]] && [ "$USER_COUNT" -gt 0 ]; then
  echo "✅ Data integrity: OK ($USER_COUNT users)"
else
  echo "❌ Data integrity: FAILED"
fi

echo "================================"
echo "🏥 Health check completed"
```

### Monitoring Dashboard Script

Create `scripts/monitoring-dashboard.sh`:

```bash
#!/bin/bash
# Real-time monitoring dashboard

# Function to display metrics
show_metrics() {
  clear
  echo "📊 Chess.com Helper Monitoring Dashboard"
  echo "========================================"
  echo "⏰ $(date)"
  echo ""
  
  # Worker status
  echo "🔧 Worker Status:"
  MAIN_STATUS=$(curl -s -w "%{http_code}" -o /dev/null https://chesscom-helper.emily-flambe.workers.dev/api/health)
  echo "   Main Worker: $([[ $MAIN_STATUS == "200" ]] && echo "✅ OK" || echo "❌ FAILED")"
  
  # Database metrics
  echo ""
  echo "🗄️ Database Metrics:"
  DB_STATS=$(wrangler d1 execute chesscom-helper-db --command="
    SELECT 
      (SELECT COUNT(*) FROM chesscom_app_user) as users,
      (SELECT COUNT(*) FROM chesscom_app_emailsubscription WHERE is_active = 1) as active_subs,
      (SELECT COUNT(*) FROM chesscom_app_user WHERE is_playing = 1) as playing_now
  " --json 2>/dev/null)
  
  if [ $? -eq 0 ]; then
    USERS=$(echo "$DB_STATS" | jq -r '.[0].users')
    SUBS=$(echo "$DB_STATS" | jq -r '.[0].active_subs')
    PLAYING=$(echo "$DB_STATS" | jq -r '.[0].playing_now')
    echo "   Total Users: $USERS"
    echo "   Active Subscriptions: $SUBS"
    echo "   Currently Playing: $PLAYING"
  else
    echo "   ❌ Database query failed"
  fi
  
  # Recent notifications
  echo ""
  echo "📧 Recent Notifications (last hour):"
  RECENT_NOTIFICATIONS=$(wrangler d1 execute chesscom-helper-db --command="
    SELECT COUNT(*) as count
    FROM chesscom_app_notificationlog
    WHERE sent_at >= datetime('now', '-1 hour')
  " --json 2>/dev/null | jq -r '.[0].count')
  echo "   Sent: ${RECENT_NOTIFICATIONS:-0}"
  
  echo ""
  echo "Press Ctrl+C to exit"
}

# Update every 30 seconds
while true; do
  show_metrics
  sleep 30
done
```

## Alerting Setup

### Error Rate Monitoring

```bash
# Monitor error rates (run in background)
while true; do
  ERROR_COUNT=$(wrangler tail chesscom-helper --once | grep -c "ERROR\|FATAL\|Exception")
  if [ "$ERROR_COUNT" -gt 5 ]; then
    echo "⚠️ High error rate detected: $ERROR_COUNT errors in last sample"
    # Send alert notification here
  fi
  sleep 300  # Check every 5 minutes
done
```

### Database Performance Alerts

```bash
# Monitor D1 query performance
while true; do
  QUERY_TIME=$(time (wrangler d1 execute chesscom-helper-db --command="SELECT COUNT(*) FROM chesscom_app_user" > /dev/null) 2>&1 | grep real | awk '{print $2}' | sed 's/[^0-9.]//g')
  if (( $(echo "$QUERY_TIME > 2.0" | bc -l) )); then
    echo "⚠️ Slow D1 query detected: ${QUERY_TIME}s"
    # Send alert notification here
  fi
  sleep 600  # Check every 10 minutes
done
```

## Troubleshooting Common Issues

### Worker Not Responding

```bash
# Check worker status
wrangler deployments list --name chesscom-helper

# Check recent deployments
wrangler tail chesscom-helper --grep "START\|READY\|ERROR" --once

# Test specific endpoints
curl -v https://chesscom-helper.emily-flambe.workers.dev/api/health
```

### D1 Connection Issues

```bash
# Verify D1 database exists
wrangler d1 list | grep chesscom-helper

# Check database binding in wrangler.toml
cat worker-src/main-worker/wrangler.toml | grep -A5 "d1_databases"

# Test raw D1 connection
wrangler d1 execute chesscom-helper-db --command="PRAGMA schema_version"
```

### Cron Job Not Running

```bash
# Check cron trigger configuration
cat worker-src/cron-worker/wrangler.toml | grep -A5 "triggers"

# Manually trigger cron job
curl -X POST https://chesscom-helper-cron.emily-flambe.workers.dev/trigger

# Check recent cron executions
wrangler tail chesscom-helper-cron --since 1h
```

### Email Delivery Issues

```bash
# Check email service secrets
wrangler secret list --name chesscom-helper-cron

# Test email configuration
wrangler tail chesscom-helper-cron --grep "sendgrid\|email" --once

# Check recent notification logs
wrangler d1 execute chesscom-helper-db --command="
SELECT *
FROM chesscom_app_notificationlog
WHERE sent_at >= datetime('now', '-1 hour')
ORDER BY sent_at DESC
LIMIT 10"
```

## Log Analysis

### Common Log Patterns

```bash
# Find repeated errors
wrangler tail chesscom-helper --format=json --once | jq -r '.message' | sort | uniq -c | sort -nr

# Analyze response times
wrangler tail chesscom-helper --grep "duration.*ms" --once | grep -o "[0-9]\+ms" | sort -n

# Track API usage patterns
wrangler tail chesscom-helper --grep "POST\|GET\|PUT\|DELETE" --once | cut -d' ' -f3 | sort | uniq -c
```

### Performance Analysis

```bash
# Memory usage patterns
wrangler tail chesscom-helper --grep "memory" --format=json --once | jq '.memoryUsage'

# CPU time analysis
wrangler tail chesscom-helper --grep "cpu" --format=json --once | jq '.cpuTime'
```

## Monitoring Best Practices

1. **Regular Health Checks**: Run automated health checks every 5 minutes
2. **Log Retention**: Keep worker logs for at least 7 days for analysis
3. **Performance Baselines**: Establish normal performance ranges for comparison
4. **Alert Thresholds**: Set appropriate thresholds to avoid false positives
5. **Escalation Procedures**: Document who to contact for different issue types

## Integration with External Tools

### Prometheus/Grafana Setup

```bash
# Export metrics in Prometheus format
# (This would require custom worker code to expose metrics endpoint)
curl https://chesscom-helper.emily-flambe.workers.dev/metrics
```

### Webhook Notifications

```bash
# Set up webhook for critical alerts
wrangler secret put ALERT_WEBHOOK_URL
# Configure in worker to send notifications on errors
```

---

**Last Updated**: 2024-01-01  
**Review Schedule**: Monthly  
**Owner**: DevOps Team