# Email Notifications PRD
## Product Requirements Document for Live Game Notifications

**Version**: 1.0  
**Date**: 2025-07-06  
**Status**: Draft  
**Target Audience**: Claude AI Agents  

---

## 📋 Executive Summary

Implement email notifications for Chess.com Helper users when tracked players start new games. This feature enables users to receive timely notifications about their favorite players' gaming activity, enhancing engagement and real-time awareness.

### Key Value Proposition
- **Real-time awareness**: Know immediately when followed players start games
- **Selective control**: Choose which players trigger notifications
- **Spam prevention**: Built-in cooldown prevents notification overload
- **Rich context**: Game details included (time control, rated status)

---

## 🎯 Product Goals

### Primary Objectives
1. **Increase user engagement** by providing timely, relevant notifications
2. **Retain users** through valuable real-time features
3. **Build notification foundation** for future feature expansion

### Success Metrics
- **Adoption Rate**: 60% of active users enable notifications within 30 days
- **Retention Impact**: 15% increase in weekly active users
- **Notification Quality**: <5% unsubscribe rate from notification emails
- **System Reliability**: 99.5% notification delivery success rate

---

## 👥 Target Users

### Primary Users
- **Chess enthusiasts** following professional players
- **Tournament followers** tracking specific players during events
- **Coaching relationships** monitoring student/coach activity
- **Friend groups** staying connected through chess activity

### User Personas
- **Magnus Watcher**: Follows 3-5 top players, wants immediate alerts for rapid/blitz games
- **Tournament Tracker**: Monitors 10+ players during major tournaments
- **Casual Follower**: Follows 1-2 friends, wants occasional updates

---

## 🔧 Functional Requirements

### Core Features

#### FR-1: Game Start Detection
- **Requirement**: System monitors Chess.com API for `isPlaying` status changes
- **Trigger**: Player transitions from "not playing" to "playing"
- **Data Source**: Chess.com `/player/{username}/games/current` endpoint
- **Frequency**: Monitored every 2-5 minutes via scheduled jobs

#### FR-2: Notification Preferences
- **Requirement**: Per-player notification control
- **Implementation**: Extend `player_subscriptions` table with `notifications_enabled` boolean
- **Default**: Notifications enabled for new subscriptions
- **UI**: Toggle switches in user dashboard per tracked player

#### FR-3: Spam Prevention
- **Requirement**: Maximum 1 notification per player per hour
- **Implementation**: Check `notification_log` for recent notifications before sending
- **Cooldown**: 60 minutes from last notification for same player/user pair
- **Override**: No manual override in MVP

#### FR-4: Email Content
- **Requirement**: Rich notification emails with game context
- **Template**: HTML + text versions
- **Content**: Player name, game type, time control, rated status, direct game link
- **Branding**: Consistent with Chess.com Helper identity

#### FR-5: Delivery Reliability
- **Requirement**: Robust email delivery with retry logic
- **Implementation**: Queue-based system with exponential backoff
- **Retry Policy**: 3 attempts with 1m, 5m, 15m delays
- **Failure Handling**: Log failures, alert admins after 3 failures

### Non-Functional Requirements

#### NFR-1: Performance
- **Response Time**: Notifications sent within 5 minutes of game start
- **Throughput**: Support 1000+ notifications per hour during peak times
- **Resource Usage**: Minimal impact on existing Chess.com API rate limits

#### NFR-2: Reliability
- **Uptime**: 99.5% notification service availability
- **Delivery**: 99% email delivery success rate
- **Data Integrity**: Zero lost notifications due to system failures

#### NFR-3: Scalability
- **User Growth**: Support 10,000+ active users
- **Player Tracking**: Handle 100,000+ player subscriptions
- **Email Volume**: Process 50,000+ emails per day

---

## 🚀 User Stories

### Epic: Basic Notification Setup
**As a chess enthusiast, I want to enable notifications for my favorite players so I can watch their games live.**

#### US-1: Enable Player Notifications
- **As a** user
- **I want** to enable notifications for specific players
- **So that** I receive emails when they start games
- **Acceptance Criteria**:
  - User can toggle notifications per player in dashboard
  - Setting persists across sessions
  - Changes take effect immediately
  - Default state is enabled for new subscriptions

#### US-2: Receive Game Start Notifications
- **As a** user with notifications enabled
- **I want** to receive emails when tracked players start games
- **So that** I can join as a spectator
- **Acceptance Criteria**:
  - Email sent within 5 minutes of game start
  - Email includes player name, game type, time control
  - Email includes direct link to live game
  - Email follows consistent branding

#### US-3: Prevent Notification Spam
- **As a** user
- **I want** limited notifications per player
- **So that** I don't receive excessive emails
- **Acceptance Criteria**:
  - Maximum 1 notification per player per hour
  - Cooldown applies even if player starts multiple games
  - User informed of cooldown policy
  - No notifications lost during cooldown

### Epic: Notification Management
**As a user, I want to manage my notification preferences so I control what emails I receive.**

#### US-4: Disable Player Notifications
- **As a** user
- **I want** to disable notifications for specific players
- **So that** I stop receiving emails for less interesting players
- **Acceptance Criteria**:
  - User can disable notifications per player
  - Disabled state persists across sessions
  - No notifications sent for disabled players
  - User can re-enable at any time

#### US-5: Global Notification Control
- **As a** user
- **I want** to disable all notifications
- **So that** I can pause emails temporarily
- **Acceptance Criteria**:
  - Global disable overrides all player settings
  - Setting accessible in user preferences
  - Can be re-enabled without losing player preferences
  - Immediate effect (no queued emails sent)

---

## 🎨 User Experience Requirements

### Email Design
- **Subject Line**: "🎯 {PlayerName} started a new game"
- **Content**: Clean, mobile-friendly HTML
- **Call-to-Action**: "Watch Live" button linking to game
- **Unsubscribe**: One-click unsubscribe link
- **Personalization**: User's name, player preferences link

### Dashboard Integration
- **Player List**: Toggle switches for notification preferences
- **Visual Feedback**: Clear enabled/disabled states
- **Bulk Actions**: Enable/disable all notifications
- **Status Display**: Show last notification sent per player

---

## 🔄 User Flow

### Primary Flow: Enable Notifications
1. User logs into Chess.com Helper
2. Navigates to tracked players dashboard
3. Sees notification toggle switches per player
4. Enables notifications for desired players
5. Saves preferences (auto-saved)
6. Receives confirmation message

### Notification Flow
1. System detects player game start
2. Checks user notification preferences
3. Verifies cooldown period
4. Generates notification email
5. Queues email for delivery
6. Sends email via Resend API
7. Logs notification in database
8. Handles delivery confirmations/failures

---

## 🛠️ Technical Architecture Overview

### System Components
- **Monitoring Service**: Detects game start events
- **Notification Service**: Manages preference logic and cooldowns
- **Email Service**: Templates and delivery via Resend
- **Job System**: Background processing and retries
- **Database**: Preferences and notification history

### Key Data Models
- **player_subscriptions**: Extended with `notifications_enabled`
- **notification_log**: Tracks sent notifications and cooldowns
- **monitoring_jobs**: Scheduled player status checks
- **user_preferences**: Global notification settings

### Integration Points
- **Chess.com API**: Player status monitoring
- **Resend API**: Email delivery
- **Cloudflare Workers**: Serverless execution
- **D1 Database**: Persistent storage

---

## 📊 Analytics & Monitoring

### Key Metrics
- **Notification Volume**: Emails sent per day/hour
- **Delivery Success Rate**: Successful deliveries / total attempts
- **User Engagement**: Click-through rates on game links
- **Preference Changes**: Enable/disable frequency
- **System Performance**: API response times, job execution

### Alerting
- **High Failure Rate**: >5% email delivery failures
- **API Errors**: Chess.com API rate limiting or outages
- **Queue Backlog**: >100 pending notifications
- **User Complaints**: Unsubscribe rate spike

---

## 🚦 Risk Assessment

### Technical Risks
- **Chess.com API Limits**: Risk of rate limiting during high activity
  - *Mitigation*: Implement exponential backoff and batch processing
- **Email Deliverability**: Risk of emails marked as spam
  - *Mitigation*: Proper SPF/DKIM setup, clean templates, unsubscribe links
- **Scale Challenges**: Performance degradation with user growth
  - *Mitigation*: Database indexing, job queue optimization

### Business Risks
- **User Annoyance**: Too many notifications leading to unsubscribes
  - *Mitigation*: Strict cooldown periods, granular controls
- **Cost Escalation**: Email costs scaling with user growth
  - *Mitigation*: Monitor usage, implement cost controls
- **Competitive Response**: Chess.com blocking or limiting API access
  - *Mitigation*: Follow API terms strictly, maintain good relationship

---

## 🗓️ Implementation Timeline

### Phase 1: Core Infrastructure (Week 1-2)
- Database schema updates
- Basic notification preference system
- Email template creation
- Core notification logic

### Phase 2: Integration & Testing (Week 3-4)
- Chess.com API integration
- Job system integration
- End-to-end testing
- Performance optimization

### Phase 3: UI & Polish (Week 5-6)
- Dashboard preference controls
- Email template refinement
- Analytics implementation
- Documentation and monitoring

---

## 📝 Acceptance Criteria

### Definition of Done
- [ ] Users can enable/disable notifications per player
- [ ] Emails sent within 5 minutes of game start
- [ ] Cooldown prevents spam (1 notification/hour/player)
- [ ] Emails include game details and live links
- [ ] 99%+ email delivery success rate
- [ ] All tests pass with >80% code coverage
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Monitoring and alerting configured

### Quality Gates
- [ ] Zero critical bugs
- [ ] <2 second API response times
- [ ] <5% unsubscribe rate during beta
- [ ] Successful load testing with 1000 concurrent users
- [ ] Email templates render correctly across major clients
- [ ] Accessibility compliance (WCAG 2.1 AA)

---

## 🔗 Dependencies

### External Dependencies
- **Chess.com API**: Player status and game data
- **Resend API**: Email delivery service
- **Cloudflare Workers**: Runtime environment
- **D1 Database**: Data persistence

### Internal Dependencies
- **User Authentication**: Required for preference management
- **Player Subscription System**: Foundation for notification preferences
- **Job System**: Background processing infrastructure
- **Monitoring Service**: Player status detection

---

## 📚 Appendices

### A. Email Template Examples
```html
<!-- Game Start Notification -->
<h2>🎯 Magnus Carlsen started a new game!</h2>
<p>Game Details:</p>
<ul>
  <li>Time Control: 10+0 (Rapid)</li>
  <li>Rated: Yes</li>
  <li>Started: 2 minutes ago</li>
</ul>
<a href="https://chess.com/live/game/12345">Watch Live</a>
```

### B. API Endpoints
```
GET /api/v1/users/notifications/preferences
POST /api/v1/users/notifications/preferences
GET /api/v1/users/notifications/history
POST /api/v1/users/notifications/unsubscribe
```

### C. Database Schema Changes
```sql
-- Add notification preference to subscriptions
ALTER TABLE player_subscriptions 
ADD COLUMN notifications_enabled BOOLEAN DEFAULT TRUE;

-- Add notification history tracking
CREATE TABLE notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  player_username TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  delivered_at DATETIME,
  failed_at DATETIME,
  failure_reason TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

*This PRD serves as the definitive specification for the email notifications feature. All implementation decisions should reference this document for requirements clarity and scope boundaries.*