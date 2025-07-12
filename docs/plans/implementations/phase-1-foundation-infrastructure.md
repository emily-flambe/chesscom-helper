# Phase 1: Foundation Infrastructure Implementation Plan
## Email Notifications System - Days 1-3

**Version**: 1.0  
**Date**: 2025-07-06  
**Phase**: Foundation Infrastructure  
**Target Audience**: Claude AI Implementation Agents  
**Estimated Duration**: 3 days  

---

## 📋 Phase Overview

This implementation plan provides step-by-step instructions for building the foundation infrastructure for the email notifications system. The phase focuses on database schema updates, service extensions, and core notification logic while maintaining existing functionality.

### Key Objectives
1. **Database Schema Updates**: Extend existing tables with notification preferences and logging
2. **Service Architecture**: Enhance NotificationService with cooldown logic and preference management
3. **Email Infrastructure**: Implement basic email templating and delivery tracking
4. **Testing Foundation**: Create comprehensive test coverage for new functionality

---

## 🎯 Detailed Task Breakdown

### Day 1: Database Schema & Migration (8 hours)

#### Task 1.1: Database Schema Updates (3 hours)
**Objective**: Update database schema to support notification preferences and logging

**Subtasks**:
1. **Create migration file** (30 minutes)
   - File: `database/migrations/0003_notification_infrastructure.sql`
   - Add notification-related columns and tables
   - Include proper indexes for performance

2. **Update existing tables** (45 minutes)
   - Add `notifications_enabled` column to `player_subscriptions`
   - Add `notifications_enabled` column to `user_preferences`
   - Ensure backward compatibility with default values

3. **Create notification_log extensions** (45 minutes)
   - Extend existing `notification_log` table structure
   - Add new columns for enhanced tracking
   - Create indexes for efficient queries

4. **Apply and test migrations** (30 minutes)
   - Run migrations on local database
   - Verify schema changes
   - Test rollback procedures

**Implementation Details**:
```sql
-- File: database/migrations/0003_notification_infrastructure.sql

-- Extend player_subscriptions with notification preference
ALTER TABLE player_subscriptions 
ADD COLUMN notifications_enabled BOOLEAN DEFAULT TRUE;

-- Extend user_preferences with global notification toggle
ALTER TABLE user_preferences 
ADD COLUMN notifications_enabled BOOLEAN DEFAULT TRUE;

-- Extend notification_log with additional tracking fields
ALTER TABLE notification_log 
ADD COLUMN game_details TEXT; -- JSON: time control, rated status, etc.

ALTER TABLE notification_log 
ADD COLUMN delivered_at DATETIME;

ALTER TABLE notification_log 
ADD COLUMN failed_at DATETIME;

ALTER TABLE notification_log 
ADD COLUMN failure_reason TEXT;

ALTER TABLE notification_log 
ADD COLUMN email_provider_id TEXT; -- Resend message ID

-- Create optimized indexes for notification queries
CREATE INDEX idx_notification_log_cooldown 
ON notification_log(user_id, chess_com_username, sent_at);

CREATE INDEX idx_subscriptions_notifications 
ON player_subscriptions(user_id, notifications_enabled);

CREATE INDEX idx_user_preferences_notifications 
ON user_preferences(user_id, notifications_enabled);

-- Create notification queue table for future use
CREATE TABLE notification_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chess_com_username TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  game_details TEXT,
  queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  failed_at DATETIME,
  retry_count INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notification_queue_processing 
ON notification_queue(queued_at, processed_at, failed_at);
```

**Success Criteria**:
- [ ] Migration file created and validated
- [ ] All new columns added with proper defaults
- [ ] All indexes created and optimized
- [ ] Migration tested on local database
- [ ] Rollback procedure verified

---

#### Task 1.2: Database Query Functions (2 hours)
**Objective**: Create optimized database query functions for notification operations

**Subtasks**:
1. **Player subscription queries** (45 minutes)
   - Get subscriptions with notification preferences
   - Update notification preferences per player
   - Batch queries for multiple players

2. **User preference queries** (45 minutes)
   - Get/update global notification settings
   - Combine user and player preferences
   - Efficient preference checking

3. **Notification log queries** (30 minutes)
   - Cooldown period checking
   - Notification history retrieval
   - Delivery status tracking

**Implementation Details**:
```sql
-- File: database/queries/notification_queries.sql

-- Get all subscriptions with notification preferences for a user
SELECT 
  ps.id,
  ps.user_id,
  ps.chess_com_username,
  ps.notifications_enabled as player_notifications_enabled,
  ps.created_at,
  up.notifications_enabled as user_notifications_enabled
FROM player_subscriptions ps
JOIN user_preferences up ON ps.user_id = up.user_id
WHERE ps.user_id = ?;

-- Check if notification should be sent (cooldown and preferences)
SELECT 
  ps.notifications_enabled as player_enabled,
  up.notifications_enabled as user_enabled,
  nl.sent_at as last_notification
FROM player_subscriptions ps
JOIN user_preferences up ON ps.user_id = up.user_id
LEFT JOIN notification_log nl ON (
  nl.user_id = ps.user_id 
  AND nl.chess_com_username = ps.chess_com_username
  AND nl.sent_at > datetime('now', '-1 hour')
)
WHERE ps.user_id = ? AND ps.chess_com_username = ?
ORDER BY nl.sent_at DESC
LIMIT 1;

-- Get notification history for a user
SELECT 
  nl.id,
  nl.chess_com_username,
  nl.notification_type,
  nl.sent_at,
  nl.email_delivered,
  nl.delivered_at,
  nl.failed_at,
  nl.failure_reason,
  nl.game_details
FROM notification_log nl
WHERE nl.user_id = ?
ORDER BY nl.sent_at DESC
LIMIT ? OFFSET ?;

-- Get users to notify for a specific player
SELECT DISTINCT
  ps.user_id,
  u.email,
  ps.chess_com_username
FROM player_subscriptions ps
JOIN users u ON ps.user_id = u.id
JOIN user_preferences up ON ps.user_id = up.user_id
WHERE ps.chess_com_username = ?
  AND ps.notifications_enabled = TRUE
  AND up.notifications_enabled = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM notification_log nl
    WHERE nl.user_id = ps.user_id
      AND nl.chess_com_username = ps.chess_com_username
      AND nl.sent_at > datetime('now', '-1 hour')
  );
```

**Success Criteria**:
- [ ] All query functions created and optimized
- [ ] Indexes properly utilized in query plans
- [ ] Performance tested with sample data
- [ ] Query results validated

---

#### Task 1.3: Migration Testing & Validation (3 hours)
**Objective**: Comprehensive testing of database changes

**Subtasks**:
1. **Unit tests for migrations** (90 minutes)
   - Test migration application
   - Test rollback procedures
   - Validate data integrity

2. **Integration tests** (60 minutes)
   - Test with existing data
   - Verify foreign key constraints
   - Test index performance

3. **Performance benchmarking** (30 minutes)
   - Query performance with indexes
   - Large dataset testing
   - Optimization verification

**Implementation Details**:
```typescript
// File: tests/database/migration.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { createTestEnv } from '../setup'

describe('Notification Infrastructure Migration', () => {
  let env: Env
  
  beforeEach(() => {
    env = createTestEnv()
  })

  it('should add notification columns to player_subscriptions', async () => {
    // Test that new columns exist with proper defaults
    const result = await env.DB.prepare(`
      SELECT notifications_enabled 
      FROM player_subscriptions 
      WHERE id = ?
    `).bind('test-subscription-id').first()
    
    expect(result).toBeDefined()
    expect(result.notifications_enabled).toBe(true)
  })

  it('should create notification_log indexes', async () => {
    // Test index creation and usage
    const explain = await env.DB.prepare(`
      EXPLAIN QUERY PLAN 
      SELECT * FROM notification_log 
      WHERE user_id = ? AND chess_com_username = ? 
      AND sent_at > datetime('now', '-1 hour')
    `).bind('test-user', 'test-player').all()
    
    expect(explain.results.some(row => 
      row.detail.includes('idx_notification_log_cooldown')
    )).toBe(true)
  })

  it('should maintain data integrity after migration', async () => {
    // Test foreign key constraints
    const invalidInsert = env.DB.prepare(`
      INSERT INTO notification_log (id, user_id, chess_com_username, notification_type)
      VALUES (?, ?, ?, ?)
    `).bind('test-id', 'invalid-user-id', 'test-player', 'game_started')
    
    await expect(invalidInsert.run()).rejects.toThrow()
  })
})
```

**Success Criteria**:
- [ ] All migration tests pass
- [ ] Performance benchmarks met
- [ ] Data integrity maintained
- [ ] Rollback procedures tested

---

### Day 2: Service Extensions & Core Logic (8 hours)

#### Task 2.1: NotificationService Extensions (4 hours)
**Objective**: Extend NotificationService with cooldown logic and preference management

**Subtasks**:
1. **Cooldown logic implementation** (90 minutes)
   - Check recent notifications
   - Implement 1-hour cooldown per player/user
   - Add cooldown bypass for testing

2. **Preference management** (90 minutes)
   - User-level preference checking
   - Player-level preference checking
   - Combined preference logic

3. **Notification decision engine** (60 minutes)
   - Centralized shouldSendNotification logic
   - Logging for debugging
   - Performance optimization

**Implementation Details**:
```typescript
// File: src/services/notificationService.ts (extend existing)

export interface NotificationPreferences {
  userId: string
  globalNotificationsEnabled: boolean
  playerNotificationsEnabled: boolean
  lastNotificationSent?: string
  cooldownActive: boolean
}

export interface NotificationCooldownCheck {
  canSend: boolean
  cooldownUntil?: Date
  reason?: string
}

/**
 * Check if notification should be sent based on preferences and cooldown
 */
export async function shouldSendNotification(
  db: D1Database,
  userId: string,
  chessComUsername: string,
  notificationType: 'game_started' | 'game_ended' = 'game_started'
): Promise<NotificationCooldownCheck> {
  try {
    // Check user and player preferences in single query
    const preferencesResult = await db.prepare(`
      SELECT 
        ps.notifications_enabled as player_enabled,
        up.notifications_enabled as user_enabled,
        nl.sent_at as last_notification
      FROM player_subscriptions ps
      JOIN user_preferences up ON ps.user_id = up.user_id
      LEFT JOIN notification_log nl ON (
        nl.user_id = ps.user_id 
        AND nl.chess_com_username = ps.chess_com_username
        AND nl.notification_type = ?
        AND nl.sent_at > datetime('now', '-1 hour')
      )
      WHERE ps.user_id = ? AND ps.chess_com_username = ?
      ORDER BY nl.sent_at DESC
      LIMIT 1
    `).bind(notificationType, userId, chessComUsername).first()

    if (!preferencesResult) {
      return {
        canSend: false,
        reason: 'No subscription found or user preferences not set'
      }
    }

    // Check global user preference
    if (!preferencesResult.user_enabled) {
      return {
        canSend: false,
        reason: 'User has disabled all notifications'
      }
    }

    // Check player-specific preference
    if (!preferencesResult.player_enabled) {
      return {
        canSend: false,
        reason: 'User has disabled notifications for this player'
      }
    }

    // Check cooldown period
    if (preferencesResult.last_notification) {
      const lastNotificationTime = new Date(preferencesResult.last_notification)
      const cooldownUntil = new Date(lastNotificationTime.getTime() + (60 * 60 * 1000)) // 1 hour
      
      if (cooldownUntil > new Date()) {
        return {
          canSend: false,
          cooldownUntil,
          reason: 'Notification cooldown active'
        }
      }
    }

    return { canSend: true }

  } catch (error) {
    console.error('Error checking notification permissions:', error)
    return {
      canSend: false,
      reason: 'Error checking notification permissions'
    }
  }
}

/**
 * Get notification preferences for a user
 */
export async function getNotificationPreferences(
  db: D1Database,
  userId: string
): Promise<NotificationPreferences[]> {
  try {
    const result = await db.prepare(`
      SELECT 
        ps.id,
        ps.user_id,
        ps.chess_com_username,
        ps.notifications_enabled as player_notifications_enabled,
        up.notifications_enabled as user_notifications_enabled,
        nl.sent_at as last_notification_sent
      FROM player_subscriptions ps
      JOIN user_preferences up ON ps.user_id = up.user_id
      LEFT JOIN notification_log nl ON (
        nl.user_id = ps.user_id 
        AND nl.chess_com_username = ps.chess_com_username
        AND nl.sent_at = (
          SELECT MAX(sent_at) 
          FROM notification_log 
          WHERE user_id = ps.user_id 
          AND chess_com_username = ps.chess_com_username
        )
      )
      WHERE ps.user_id = ?
      ORDER BY ps.chess_com_username
    `).bind(userId).all()

    if (!result.results) {
      return []
    }

    return result.results.map(row => ({
      userId: row.user_id as string,
      globalNotificationsEnabled: Boolean(row.user_notifications_enabled),
      playerNotificationsEnabled: Boolean(row.player_notifications_enabled),
      lastNotificationSent: row.last_notification_sent as string | undefined,
      cooldownActive: row.last_notification_sent ? 
        new Date(row.last_notification_sent).getTime() + (60 * 60 * 1000) > Date.now() : false
    }))

  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    throw createApiError('Failed to fetch notification preferences', 500, 'NOTIFICATION_PREFERENCES_ERROR', error)
  }
}

/**
 * Update notification preferences for a specific player subscription
 */
export async function updatePlayerNotificationPreference(
  db: D1Database,
  userId: string,
  chessComUsername: string,
  enabled: boolean
): Promise<void> {
  try {
    const result = await db.prepare(`
      UPDATE player_subscriptions 
      SET notifications_enabled = ? 
      WHERE user_id = ? AND chess_com_username = ?
    `).bind(enabled, userId, chessComUsername).run()

    if (!result.success) {
      throw createApiError('Failed to update notification preference', 500, 'NOTIFICATION_PREFERENCE_UPDATE_FAILED')
    }

  } catch (error) {
    console.error('Error updating player notification preference:', error)
    throw createApiError('Failed to update notification preference', 500, 'NOTIFICATION_PREFERENCE_UPDATE_FAILED', error)
  }
}

/**
 * Get users who should receive notifications for a specific player
 */
export async function getUsersToNotifyForPlayer(
  db: D1Database,
  chessComUsername: string,
  notificationType: 'game_started' | 'game_ended' = 'game_started'
): Promise<Array<{userId: string, email: string, chessComUsername: string}>> {
  try {
    const result = await db.prepare(`
      SELECT DISTINCT
        ps.user_id,
        u.email,
        ps.chess_com_username
      FROM player_subscriptions ps
      JOIN users u ON ps.user_id = u.id
      JOIN user_preferences up ON ps.user_id = up.user_id
      WHERE ps.chess_com_username = ?
        AND ps.notifications_enabled = TRUE
        AND up.notifications_enabled = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM notification_log nl
          WHERE nl.user_id = ps.user_id
            AND nl.chess_com_username = ps.chess_com_username
            AND nl.notification_type = ?
            AND nl.sent_at > datetime('now', '-1 hour')
        )
    `).bind(chessComUsername, notificationType).all()

    if (!result.results) {
      return []
    }

    return result.results.map(row => ({
      userId: row.user_id as string,
      email: row.email as string,
      chessComUsername: row.chess_com_username as string
    }))

  } catch (error) {
    console.error('Error getting users to notify:', error)
    throw createApiError('Failed to get users to notify', 500, 'NOTIFICATION_USERS_FETCH_FAILED', error)
  }
}
```

**Success Criteria**:
- [ ] Cooldown logic implemented and tested
- [ ] Preference checking works correctly
- [ ] Decision engine handles all cases
- [ ] Performance optimized for database queries

---

#### Task 2.2: Enhanced Notification Logging (2 hours)
**Objective**: Improve notification logging with detailed tracking

**Subtasks**:
1. **Extended logging function** (60 minutes)
   - Add game details to logs
   - Track delivery status
   - Include provider message IDs

2. **Retry logic foundation** (60 minutes)
   - Basic retry mechanism
   - Exponential backoff setup
   - Failure tracking

**Implementation Details**:
```typescript
// File: src/services/notificationService.ts (extend existing)

export interface DetailedNotificationLog {
  id: string
  userId: string
  chessComUsername: string
  notificationType: 'game_started' | 'game_ended'
  gameDetails?: {
    timeControl?: string
    rated?: boolean
    gameType?: string
    gameUrl?: string
    startTime?: string
  }
  sentAt: string
  deliveredAt?: string
  failedAt?: string
  failureReason?: string
  emailProviderMessageId?: string
  emailDelivered: boolean
}

/**
 * Log notification attempt with detailed information
 */
export async function logDetailedNotification(
  db: D1Database,
  notification: {
    userId: string
    chessComUsername: string
    notificationType: 'game_started' | 'game_ended'
    gameDetails?: object
    emailDelivered: boolean
    deliveredAt?: string
    failedAt?: string
    failureReason?: string
    emailProviderMessageId?: string
  }
): Promise<DetailedNotificationLog> {
  const id = await generateSecureId()
  const now = new Date().toISOString()

  try {
    const result = await db.prepare(`
      INSERT INTO notification_log (
        id, user_id, chess_com_username, notification_type, 
        game_details, sent_at, delivered_at, failed_at, 
        failure_reason, email_provider_id, email_delivered
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      notification.userId,
      notification.chessComUsername,
      notification.notificationType,
      notification.gameDetails ? JSON.stringify(notification.gameDetails) : null,
      now,
      notification.deliveredAt || null,
      notification.failedAt || null,
      notification.failureReason || null,
      notification.emailProviderMessageId || null,
      notification.emailDelivered
    ).run()

    if (!result.success) {
      throw createApiError('Failed to log notification', 500, 'NOTIFICATION_LOG_FAILED')
    }

    return {
      id,
      userId: notification.userId,
      chessComUsername: notification.chessComUsername,
      notificationType: notification.notificationType,
      gameDetails: notification.gameDetails,
      sentAt: now,
      deliveredAt: notification.deliveredAt,
      failedAt: notification.failedAt,
      failureReason: notification.failureReason,
      emailProviderMessageId: notification.emailProviderMessageId,
      emailDelivered: notification.emailDelivered
    }

  } catch (error) {
    console.error('Error logging detailed notification:', error)
    throw createApiError('Failed to log notification', 500, 'NOTIFICATION_LOG_FAILED', error)
  }
}

/**
 * Update notification delivery status
 */
export async function updateNotificationDeliveryStatus(
  db: D1Database,
  notificationId: string,
  status: {
    delivered?: boolean
    deliveredAt?: string
    failedAt?: string
    failureReason?: string
    emailProviderMessageId?: string
  }
): Promise<void> {
  try {
    const updateFields: string[] = []
    const values: any[] = []

    if (status.delivered !== undefined) {
      updateFields.push('email_delivered = ?')
      values.push(status.delivered)
    }

    if (status.deliveredAt) {
      updateFields.push('delivered_at = ?')
      values.push(status.deliveredAt)
    }

    if (status.failedAt) {
      updateFields.push('failed_at = ?')
      values.push(status.failedAt)
    }

    if (status.failureReason) {
      updateFields.push('failure_reason = ?')
      values.push(status.failureReason)
    }

    if (status.emailProviderMessageId) {
      updateFields.push('email_provider_id = ?')
      values.push(status.emailProviderMessageId)
    }

    if (updateFields.length === 0) {
      return
    }

    values.push(notificationId)

    await db.prepare(`
      UPDATE notification_log 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).bind(...values).run()

  } catch (error) {
    console.error('Error updating notification delivery status:', error)
    throw createApiError('Failed to update notification delivery status', 500, 'NOTIFICATION_STATUS_UPDATE_FAILED', error)
  }
}
```

**Success Criteria**:
- [ ] Detailed logging implemented
- [ ] Retry logic foundation created
- [ ] Delivery status tracking works
- [ ] Error handling comprehensive

---

#### Task 2.3: Service Integration Tests (2 hours)
**Objective**: Comprehensive testing of service extensions

**Subtasks**:
1. **Unit tests for new functions** (90 minutes)
   - Test cooldown logic
   - Test preference checking
   - Test notification decision engine

2. **Integration tests** (30 minutes)
   - Test database interactions
   - Test error scenarios
   - Test performance with multiple users

**Implementation Details**:
```typescript
// File: tests/services/notificationService.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { createTestEnv, createTestUser, createTestPlayerSubscription } from '../setup'
import { 
  shouldSendNotification, 
  getNotificationPreferences,
  updatePlayerNotificationPreference,
  getUsersToNotifyForPlayer,
  logDetailedNotification
} from '../../src/services/notificationService'

describe('NotificationService Extensions', () => {
  let env: Env
  let testUser: any
  let testSubscription: any

  beforeEach(async () => {
    env = createTestEnv()
    testUser = createTestUser()
    testSubscription = createTestPlayerSubscription()
    
    // Set up test data
    await env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      testUser.id, testUser.email, testUser.passwordHash, 
      testUser.createdAt, testUser.updatedAt
    ).run()

    await env.DB.prepare(`
      INSERT INTO user_preferences (user_id, email_notifications, notification_frequency, notifications_enabled)
      VALUES (?, ?, ?, ?)
    `).bind(testUser.id, true, 'immediate', true).run()

    await env.DB.prepare(`
      INSERT INTO player_subscriptions (id, user_id, chess_com_username, notifications_enabled)
      VALUES (?, ?, ?, ?)
    `).bind(testSubscription.id, testUser.id, testSubscription.chessComUsername, true).run()
  })

  describe('shouldSendNotification', () => {
    it('should allow notification when preferences are enabled and no cooldown', async () => {
      const result = await shouldSendNotification(
        env.DB, 
        testUser.id, 
        testSubscription.chessComUsername
      )

      expect(result.canSend).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should block notification when user has disabled global notifications', async () => {
      await env.DB.prepare(`
        UPDATE user_preferences 
        SET notifications_enabled = FALSE 
        WHERE user_id = ?
      `).bind(testUser.id).run()

      const result = await shouldSendNotification(
        env.DB, 
        testUser.id, 
        testSubscription.chessComUsername
      )

      expect(result.canSend).toBe(false)
      expect(result.reason).toBe('User has disabled all notifications')
    })

    it('should block notification when user has disabled player notifications', async () => {
      await env.DB.prepare(`
        UPDATE player_subscriptions 
        SET notifications_enabled = FALSE 
        WHERE user_id = ? AND chess_com_username = ?
      `).bind(testUser.id, testSubscription.chessComUsername).run()

      const result = await shouldSendNotification(
        env.DB, 
        testUser.id, 
        testSubscription.chessComUsername
      )

      expect(result.canSend).toBe(false)
      expect(result.reason).toBe('User has disabled notifications for this player')
    })

    it('should block notification during cooldown period', async () => {
      // Add recent notification
      await env.DB.prepare(`
        INSERT INTO notification_log (id, user_id, chess_com_username, notification_type, sent_at, email_delivered)
        VALUES (?, ?, ?, ?, datetime('now', '-30 minutes'), ?)
      `).bind('recent-notification', testUser.id, testSubscription.chessComUsername, 'game_started', true).run()

      const result = await shouldSendNotification(
        env.DB, 
        testUser.id, 
        testSubscription.chessComUsername
      )

      expect(result.canSend).toBe(false)
      expect(result.reason).toBe('Notification cooldown active')
      expect(result.cooldownUntil).toBeDefined()
    })

    it('should allow notification after cooldown period expires', async () => {
      // Add old notification
      await env.DB.prepare(`
        INSERT INTO notification_log (id, user_id, chess_com_username, notification_type, sent_at, email_delivered)
        VALUES (?, ?, ?, ?, datetime('now', '-2 hours'), ?)
      `).bind('old-notification', testUser.id, testSubscription.chessComUsername, 'game_started', true).run()

      const result = await shouldSendNotification(
        env.DB, 
        testUser.id, 
        testSubscription.chessComUsername
      )

      expect(result.canSend).toBe(true)
    })
  })

  describe('getNotificationPreferences', () => {
    it('should return notification preferences for all user subscriptions', async () => {
      const preferences = await getNotificationPreferences(env.DB, testUser.id)

      expect(preferences).toHaveLength(1)
      expect(preferences[0]).toMatchObject({
        userId: testUser.id,
        globalNotificationsEnabled: true,
        playerNotificationsEnabled: true,
        cooldownActive: false
      })
    })

    it('should indicate cooldown status correctly', async () => {
      // Add recent notification
      await env.DB.prepare(`
        INSERT INTO notification_log (id, user_id, chess_com_username, notification_type, sent_at, email_delivered)
        VALUES (?, ?, ?, ?, datetime('now', '-30 minutes'), ?)
      `).bind('recent-notification', testUser.id, testSubscription.chessComUsername, 'game_started', true).run()

      const preferences = await getNotificationPreferences(env.DB, testUser.id)

      expect(preferences[0].cooldownActive).toBe(true)
      expect(preferences[0].lastNotificationSent).toBeDefined()
    })
  })

  describe('updatePlayerNotificationPreference', () => {
    it('should update notification preference for specific player', async () => {
      await updatePlayerNotificationPreference(
        env.DB, 
        testUser.id, 
        testSubscription.chessComUsername, 
        false
      )

      const preferences = await getNotificationPreferences(env.DB, testUser.id)
      expect(preferences[0].playerNotificationsEnabled).toBe(false)
    })
  })

  describe('getUsersToNotifyForPlayer', () => {
    it('should return users who should receive notifications', async () => {
      const users = await getUsersToNotifyForPlayer(env.DB, testSubscription.chessComUsername)

      expect(users).toHaveLength(1)
      expect(users[0]).toMatchObject({
        userId: testUser.id,
        email: testUser.email,
        chessComUsername: testSubscription.chessComUsername
      })
    })

    it('should exclude users with disabled notifications', async () => {
      await env.DB.prepare(`
        UPDATE user_preferences 
        SET notifications_enabled = FALSE 
        WHERE user_id = ?
      `).bind(testUser.id).run()

      const users = await getUsersToNotifyForPlayer(env.DB, testSubscription.chessComUsername)

      expect(users).toHaveLength(0)
    })

    it('should exclude users in cooldown period', async () => {
      // Add recent notification
      await env.DB.prepare(`
        INSERT INTO notification_log (id, user_id, chess_com_username, notification_type, sent_at, email_delivered)
        VALUES (?, ?, ?, ?, datetime('now', '-30 minutes'), ?)
      `).bind('recent-notification', testUser.id, testSubscription.chessComUsername, 'game_started', true).run()

      const users = await getUsersToNotifyForPlayer(env.DB, testSubscription.chessComUsername)

      expect(users).toHaveLength(0)
    })
  })

  describe('logDetailedNotification', () => {
    it('should log notification with game details', async () => {
      const gameDetails = {
        timeControl: '10+0',
        rated: true,
        gameType: 'rapid',
        gameUrl: 'https://chess.com/game/123',
        startTime: new Date().toISOString()
      }

      const logResult = await logDetailedNotification(env.DB, {
        userId: testUser.id,
        chessComUsername: testSubscription.chessComUsername,
        notificationType: 'game_started',
        gameDetails,
        emailDelivered: true,
        emailProviderMessageId: 'resend-123'
      })

      expect(logResult.id).toBeDefined()
      expect(logResult.gameDetails).toEqual(gameDetails)
      expect(logResult.emailDelivered).toBe(true)
      expect(logResult.emailProviderMessageId).toBe('resend-123')
    })

    it('should handle logging without game details', async () => {
      const logResult = await logDetailedNotification(env.DB, {
        userId: testUser.id,
        chessComUsername: testSubscription.chessComUsername,
        notificationType: 'game_started',
        emailDelivered: false,
        failureReason: 'Email service unavailable'
      })

      expect(logResult.id).toBeDefined()
      expect(logResult.gameDetails).toBeUndefined()
      expect(logResult.emailDelivered).toBe(false)
      expect(logResult.failureReason).toBe('Email service unavailable')
    })
  })
})
```

**Success Criteria**:
- [ ] All unit tests pass
- [ ] Integration tests validate database interactions
- [ ] Performance tests show acceptable response times
- [ ] Error scenarios handled gracefully

---

### Day 3: Email Infrastructure & Templates (8 hours)

#### Task 3.1: Enhanced Email Templates (3 hours)
**Objective**: Create professional email templates with game details

**Subtasks**:
1. **HTML template enhancement** (90 minutes)
   - Rich game details display
   - Responsive design
   - Consistent branding

2. **Template data interface** (60 minutes)
   - Type-safe template data
   - Game details formatting
   - User preference links

3. **Template testing** (30 minutes)
   - Render testing
   - Cross-email client testing
   - Template validation

**Implementation Details**:
```typescript
// File: src/services/emailService.ts (extend existing)

export interface GameStartEmailData {
  playerName: string
  gameDetails: {
    timeControl: string
    rated: boolean
    gameType: string
    gameUrl: string
    startTime: Date
  }
  userPreferences: {
    unsubscribeUrl: string
    managePreferencesUrl: string
  }
  userName?: string
}

export interface EmailTemplateData {
  gameStart: GameStartEmailData
}

const ENHANCED_EMAIL_TEMPLATES = {
  game_started: {
    subject: (data: GameStartEmailData) => 
      `🎯 ${data.playerName} started a ${data.gameDetails.timeControl} game!`,
    
    html: (data: GameStartEmailData) => `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data.playerName} started a new game</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #769656 0%, #6b8c49 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            padding: 30px 20px;
          }
          .game-details {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
          }
          .game-details h3 {
            margin: 0 0 15px 0;
            color: #2c3e50;
            font-size: 18px;
          }
          .detail-item {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .detail-item:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 500;
            color: #666;
          }
          .detail-value {
            color: #2c3e50;
            font-weight: 600;
          }
          .cta-button {
            display: inline-block;
            background: #769656;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            transition: background 0.3s;
          }
          .cta-button:hover {
            background: #6b8c49;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
          }
          .footer a {
            color: #769656;
            text-decoration: none;
          }
          .footer a:hover {
            text-decoration: underline;
          }
          .rated-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
          }
          .rated-yes {
            background: #e8f5e8;
            color: #2e7d32;
          }
          .rated-no {
            background: #fff3e0;
            color: #ef6c00;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 ${data.playerName} is playing!</h1>
          </div>
          
          <div class="content">
            <p>Hello${data.userName ? ` ${data.userName}` : ''}!</p>
            
            <p><strong>${data.playerName}</strong> just started a new game on Chess.com. 
            ${data.gameDetails.rated ? 'This is a rated game' : 'This is a casual game'} 
            - perfect timing to watch some live chess action!</p>
            
            <div class="game-details">
              <h3>Game Details</h3>
              <div class="detail-item">
                <span class="detail-label">Time Control:</span>
                <span class="detail-value">${data.gameDetails.timeControl}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Game Type:</span>
                <span class="detail-value">${data.gameDetails.gameType}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Rated:</span>
                <span class="detail-value">
                  <span class="rated-badge ${data.gameDetails.rated ? 'rated-yes' : 'rated-no'}">
                    ${data.gameDetails.rated ? 'Yes' : 'No'}
                  </span>
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Started:</span>
                <span class="detail-value">${formatTimeAgo(data.gameDetails.startTime)}</span>
              </div>
            </div>
            
            <div style="text-align: center;">
              <a href="${data.gameDetails.gameUrl}" class="cta-button">
                🏁 Watch Live Game
              </a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              Don't want to miss any of ${data.playerName}'s games? 
              Make sure notifications are enabled in your 
              <a href="${data.userPreferences.managePreferencesUrl}" style="color: #769656;">preferences</a>.
            </p>
          </div>
          
          <div class="footer">
            <p>This notification was sent by Chess.com Helper</p>
            <p>
              <a href="${data.userPreferences.managePreferencesUrl}">Manage Preferences</a> • 
              <a href="${data.userPreferences.unsubscribeUrl}">Unsubscribe from ${data.playerName}</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    
    text: (data: GameStartEmailData) => `
🎯 ${data.playerName} is playing!

Hello${data.userName ? ` ${data.userName}` : ''}!

${data.playerName} just started a new game on Chess.com.

Game Details:
- Time Control: ${data.gameDetails.timeControl}
- Game Type: ${data.gameDetails.gameType}
- Rated: ${data.gameDetails.rated ? 'Yes' : 'No'}
- Started: ${formatTimeAgo(data.gameDetails.startTime)}

Watch the game live: ${data.gameDetails.gameUrl}

Don't want to miss any of ${data.playerName}'s games? 
Manage your preferences: ${data.userPreferences.managePreferencesUrl}

---
This notification was sent by Chess.com Helper
Manage Preferences: ${data.userPreferences.managePreferencesUrl}
Unsubscribe from ${data.playerName}: ${data.userPreferences.unsubscribeUrl}
    `
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return 'Just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
}
```

**Success Criteria**:
- [ ] Professional HTML templates created
- [ ] Responsive design works on mobile
- [ ] Template data interfaces defined
- [ ] Template rendering tested

---

#### Task 3.2: Email Delivery Enhancement (3 hours)
**Objective**: Enhance email delivery with retry logic and tracking

**Subtasks**:
1. **Retry mechanism** (90 minutes)
   - Exponential backoff implementation
   - Retry queue management
   - Failure threshold handling

2. **Delivery tracking** (60 minutes)
   - Provider message ID tracking
   - Delivery confirmation handling
   - Failure reason logging

3. **Email queue foundation** (30 minutes)
   - Basic queue implementation
   - Batch processing setup
   - Performance optimization

**Implementation Details**:
```typescript
// File: src/services/emailService.ts (extend existing)

export interface EmailDeliveryOptions {
  retryAttempts?: number
  retryDelay?: number
  priority?: 'high' | 'normal' | 'low'
}

export interface EmailDeliveryResult {
  success: boolean
  messageId?: string
  error?: string
  retryCount?: number
  deliveredAt?: string
  failedAt?: string
}

export interface EmailRetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: EmailRetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2
}

/**
 * Enhanced email sending with retry logic
 */
export async function sendNotificationEmailWithRetry(
  env: Env,
  userId: string,
  type: 'game_started' | 'game_ended',
  data: GameStartEmailData,
  options: EmailDeliveryOptions = {}
): Promise<EmailDeliveryResult> {
  const config = { ...DEFAULT_RETRY_CONFIG }
  const maxRetries = options.retryAttempts || config.maxRetries
  
  let lastError: Error | null = null
  let retryCount = 0
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendEnhancedNotificationEmail(env, userId, type, data)
      
      if (result.delivered) {
        return {
          success: true,
          messageId: result.messageId,
          retryCount: attempt,
          deliveredAt: new Date().toISOString()
        }
      }
      
      // If not delivered but no error, treat as failure
      lastError = new Error(result.error || 'Email delivery failed')
      
    } catch (error) {
      lastError = error as Error
      console.error(`Email delivery attempt ${attempt + 1} failed:`, error)
    }
    
    // Don't wait after the last attempt
    if (attempt < maxRetries) {
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelay
      )
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    retryCount++
  }
  
  return {
    success: false,
    error: lastError?.message || 'Email delivery failed after all retries',
    retryCount,
    failedAt: new Date().toISOString()
  }
}

/**
 * Enhanced notification email sending
 */
async function sendEnhancedNotificationEmail(
  env: Env,
  userId: string,
  type: 'game_started' | 'game_ended',
  data: GameStartEmailData
): Promise<EmailSendResult> {
  const notificationId = await generateSecureId()
  
  try {
    const user = await getUserById(env.DB, userId)
    if (!user) {
      throw createApiError('User not found', 404, 'USER_NOT_FOUND')
    }
    
    const template = ENHANCED_EMAIL_TEMPLATES[type]
    const subject = template.subject(data)
    const html = template.html(data)
    const text = template.text(data)
    
    const emailResult = await sendEmailWithProvider({
      to: user.email,
      subject,
      html,
      text
    }, env)
    
    // Log the detailed notification
    await logDetailedNotification(env.DB, {
      userId,
      chessComUsername: data.playerName,
      notificationType: type,
      gameDetails: data.gameDetails,
      emailDelivered: emailResult.success,
      deliveredAt: emailResult.success ? new Date().toISOString() : undefined,
      failedAt: !emailResult.success ? new Date().toISOString() : undefined,
      failureReason: emailResult.error,
      emailProviderMessageId: emailResult.messageId
    })
    
    return {
      notificationId,
      delivered: emailResult.success,
      messageId: emailResult.messageId,
      error: emailResult.error
    }
    
  } catch (error) {
    console.error('Enhanced notification email error:', error)
    
    // Log the failure
    await logDetailedNotification(env.DB, {
      userId,
      chessComUsername: data.playerName,
      notificationType: type,
      emailDelivered: false,
      failedAt: new Date().toISOString(),
      failureReason: error instanceof Error ? error.message : 'Unknown error'
    }).catch(logError => console.error('Failed to log notification failure:', logError))
    
    return {
      notificationId,
      delivered: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Email provider abstraction with enhanced error handling
 */
async function sendEmailWithProvider(
  email: {
    to: string
    subject: string
    html: string
    text: string
  },
  env: Env
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (env.RESEND_API_KEY) {
      return await sendWithResendEnhanced(email, env.RESEND_API_KEY)
    }
    
    throw createApiError('No email service configured', 500, 'EMAIL_SERVICE_NOT_CONFIGURED')
    
  } catch (error) {
    console.error('Email provider error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email service failed'
    }
  }
}

/**
 * Enhanced Resend API integration
 */
async function sendWithResendEnhanced(
  email: {
    to: string
    subject: string
    html: string
    text: string
  },
  apiKey: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Chess.com Helper <notifications@chesshelper.app>',
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        tags: [
          { name: 'type', value: 'game_notification' },
          { name: 'source', value: 'chesscom_helper' }
        ]
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      // Handle specific Resend errors
      if (response.status === 429) {
        throw createApiError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
      } else if (response.status === 400) {
        throw createApiError('Invalid email data', 400, 'INVALID_EMAIL_DATA', errorData)
      } else if (response.status === 401) {
        throw createApiError('Invalid API key', 401, 'INVALID_API_KEY')
      }
      
      throw createApiError(
        `Resend API error: ${response.status}`,
        response.status,
        'EMAIL_SERVICE_ERROR',
        errorData
      )
    }
    
    const result = await response.json()
    return {
      success: true,
      messageId: result.id
    }
    
  } catch (error) {
    console.error('Resend API error:', error)
    
    // Return specific error information
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message
      }
    }
    
    return {
      success: false,
      error: 'Resend API failed'
    }
  }
}
```

**Success Criteria**:
- [ ] Retry mechanism implemented with exponential backoff
- [ ] Delivery tracking works correctly
- [ ] Error handling comprehensive
- [ ] Performance optimized for batch operations

---

#### Task 3.3: Email Service Testing (2 hours)
**Objective**: Comprehensive testing of email service enhancements

**Subtasks**:
1. **Template testing** (60 minutes)
   - Template rendering tests
   - Data binding validation
   - Cross-platform compatibility

2. **Delivery testing** (60 minutes)
   - Retry logic testing
   - Error scenario testing
   - Performance benchmarking

**Implementation Details**:
```typescript
// File: tests/services/emailService.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestEnv, createTestUser } from '../setup'
import { 
  sendNotificationEmailWithRetry,
  formatTimeAgo,
  ENHANCED_EMAIL_TEMPLATES
} from '../../src/services/emailService'

// Mock fetch for testing
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Enhanced Email Service', () => {
  let env: Env
  let testUser: any
  let gameStartData: any

  beforeEach(() => {
    env = createTestEnv()
    testUser = createTestUser()
    gameStartData = {
      playerName: 'TestPlayer',
      gameDetails: {
        timeControl: '10+0',
        rated: true,
        gameType: 'rapid',
        gameUrl: 'https://chess.com/game/123',
        startTime: new Date()
      },
      userPreferences: {
        unsubscribeUrl: 'https://example.com/unsubscribe',
        managePreferencesUrl: 'https://example.com/preferences'
      },
      userName: 'TestUser'
    }
    
    // Reset mocks
    mockFetch.mockReset()
  })

  describe('Email Templates', () => {
    it('should generate proper subject line', () => {
      const template = ENHANCED_EMAIL_TEMPLATES.game_started
      const subject = template.subject(gameStartData)
      
      expect(subject).toBe('🎯 TestPlayer started a 10+0 game!')
    })

    it('should generate HTML email with all game details', () => {
      const template = ENHANCED_EMAIL_TEMPLATES.game_started
      const html = template.html(gameStartData)
      
      expect(html).toContain('TestPlayer')
      expect(html).toContain('10+0')
      expect(html).toContain('rapid')
      expect(html).toContain('https://chess.com/game/123')
      expect(html).toContain('rated-yes')
      expect(html).toContain('TestUser')
    })

    it('should generate text email with all game details', () => {
      const template = ENHANCED_EMAIL_TEMPLATES.game_started
      const text = template.text(gameStartData)
      
      expect(text).toContain('TestPlayer')
      expect(text).toContain('10+0')
      expect(text).toContain('rapid')
      expect(text).toContain('https://chess.com/game/123')
      expect(text).toContain('Yes')
      expect(text).toContain('TestUser')
    })

    it('should handle missing userName gracefully', () => {
      const dataWithoutName = { ...gameStartData, userName: undefined }
      const template = ENHANCED_EMAIL_TEMPLATES.game_started
      const html = template.html(dataWithoutName)
      
      expect(html).toContain('Hello!')
      expect(html).not.toContain('Hello undefined')
    })
  })

  describe('Email Delivery with Retry', () => {
    it('should succeed on first attempt', async () => {
      // Mock successful Resend response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend-123' })
      })

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData
      )

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('resend-123')
      expect(result.retryCount).toBe(0)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and eventually succeed', async () => {
      // Mock first two failures, then success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'resend-456' })
        })

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData
      )

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('resend-456')
      expect(result.retryCount).toBe(2)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should fail after max retries', async () => {
      // Mock all attempts to fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' })
      })

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData,
        { retryAttempts: 2 }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('failed after all retries')
      expect(result.retryCount).toBe(3) // 0 + 2 retries
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should handle rate limiting specifically', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limit exceeded' })
      })

      const result = await sendNotificationEmailWithRetry(
        env,
        testUser.id,
        'game_started',
        gameStartData,
        { retryAttempts: 0 }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Rate limit exceeded')
    })
  })

  describe('Utility Functions', () => {
    it('should format time ago correctly', () => {
      const now = new Date()
      
      expect(formatTimeAgo(now)).toBe('Just now')
      expect(formatTimeAgo(new Date(now.getTime() - 30 * 1000))).toBe('Just now')
      expect(formatTimeAgo(new Date(now.getTime() - 2 * 60 * 1000))).toBe('2 minutes ago')
      expect(formatTimeAgo(new Date(now.getTime() - 1 * 60 * 1000))).toBe('1 minute ago')
      expect(formatTimeAgo(new Date(now.getTime() - 2 * 60 * 60 * 1000))).toBe('2 hours ago')
      expect(formatTimeAgo(new Date(now.getTime() - 25 * 60 * 60 * 1000))).toBe('1 day ago')
    })
  })
})
```

**Success Criteria**:
- [ ] All template tests pass
- [ ] Retry logic thoroughly tested
- [ ] Error scenarios covered
- [ ] Performance benchmarks meet targets

---

## 🎯 Success Criteria

### Technical Acceptance Criteria
- [ ] Database schema updated with proper indexes
- [ ] Migration scripts tested and validated
- [ ] NotificationService extended with cooldown logic
- [ ] Email templates professionally designed
- [ ] Retry mechanism implemented with exponential backoff
- [ ] All unit tests pass (>80% coverage)
- [ ] Integration tests validate end-to-end functionality
- [ ] Performance benchmarks met (<2s response time)

### Functional Acceptance Criteria
- [ ] Notification preferences can be checked
- [ ] Cooldown period prevents spam notifications
- [ ] Email templates render correctly
- [ ] Delivery tracking works properly
- [ ] Error handling is comprehensive
- [ ] Database queries are optimized

### Quality Gates
- [ ] Code follows project conventions
- [ ] All linting rules pass
- [ ] Documentation updated
- [ ] No security vulnerabilities introduced
- [ ] Backward compatibility maintained

---

## 🚀 Implementation Order

### Day 1 Execution Sequence
1. Create migration file
2. Apply database schema changes
3. Test migration rollback
4. Create database query functions
5. Validate query performance
6. Run migration tests

### Day 2 Execution Sequence
1. Extend NotificationService with cooldown logic
2. Implement preference checking
3. Add notification decision engine
4. Enhance logging with detailed tracking
5. Create service integration tests
6. Validate performance benchmarks

### Day 3 Execution Sequence
1. Create enhanced email templates
2. Implement retry mechanism
3. Add delivery tracking
4. Create email service tests
5. Validate template rendering
6. Performance test email delivery

---

## 📋 Dependencies & Prerequisites

### Required Before Starting
- [ ] Existing codebase understanding
- [ ] Database migration tools set up
- [ ] Resend API key configured
- [ ] Test environment prepared

### External Dependencies
- Chess.com API (for game data)
- Resend API (for email delivery)
- Cloudflare D1 (for database)
- Cloudflare Workers (for runtime)

### Internal Dependencies
- User authentication system
- Player subscription system
- Existing notification infrastructure
- Error handling middleware

---

## 🔍 Testing Strategy

### Unit Testing
- Database operations
- Service logic
- Email template rendering
- Retry mechanisms
- Preference checking

### Integration Testing
- Database migrations
- Service interactions
- Email delivery
- Error scenarios
- Performance benchmarks

### Performance Testing
- Database query optimization
- Email delivery throughput
- Memory usage validation
- Response time measurement

---

## 📊 Monitoring & Validation

### Key Metrics to Track
- Database query performance
- Email delivery success rate
- Notification decision accuracy
- Error rates and types
- System resource usage

### Validation Checkpoints
- After each task completion
- Before moving to next day
- After all tests pass
- Before declaring phase complete

---

This implementation plan provides comprehensive guidance for building the foundation infrastructure for the email notifications system. Each task includes detailed specifications, code examples, and success criteria to ensure consistent implementation quality.