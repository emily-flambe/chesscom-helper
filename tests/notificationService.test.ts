import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestEnv, createTestUser, createTestPlayerSubscription } from './setup'
import { 
  shouldSendNotificationEnhanced, 
  getUsersToNotifyForPlayer,
  updatePlayerNotificationPreference,
  logDetailedNotification
} from '../src/services/notificationService'
import type { Env } from '../src/index'

describe('NotificationService Phase 1 Extensions', () => {
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

  describe('shouldSendNotificationEnhanced', () => {
    it('should allow notification when preferences are enabled and no cooldown', async () => {
      const result = await shouldSendNotificationEnhanced(
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

      const result = await shouldSendNotificationEnhanced(
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

      const result = await shouldSendNotificationEnhanced(
        env.DB, 
        testUser.id, 
        testSubscription.chessComUsername
      )

      expect(result.canSend).toBe(false)
      expect(result.reason).toBe('User has disabled notifications for this player')
    })

    it('should block notification during cooldown period (1 hour)', async () => {
      // Add recent notification (30 minutes ago)
      await env.DB.prepare(`
        INSERT INTO notification_log (id, user_id, chess_com_username, notification_type, sent_at, email_delivered)
        VALUES (?, ?, ?, ?, datetime('now', '-30 minutes'), ?)
      `).bind('recent-notification', testUser.id, testSubscription.chessComUsername, 'game_started', true).run()

      const result = await shouldSendNotificationEnhanced(
        env.DB, 
        testUser.id, 
        testSubscription.chessComUsername
      )

      expect(result.canSend).toBe(false)
      expect(result.reason).toBe('Notification cooldown active')
      expect(result.cooldownUntil).toBeDefined()
    })

    it('should allow notification after cooldown period expires (1 hour)', async () => {
      // Add old notification (2 hours ago)
      await env.DB.prepare(`
        INSERT INTO notification_log (id, user_id, chess_com_username, notification_type, sent_at, email_delivered)
        VALUES (?, ?, ?, ?, datetime('now', '-2 hours'), ?)
      `).bind('old-notification', testUser.id, testSubscription.chessComUsername, 'game_started', true).run()

      const result = await shouldSendNotificationEnhanced(
        env.DB, 
        testUser.id, 
        testSubscription.chessComUsername
      )

      expect(result.canSend).toBe(true)
    })

    it('should handle missing subscription gracefully', async () => {
      const result = await shouldSendNotificationEnhanced(
        env.DB, 
        'non-existent-user', 
        'non-existent-player'
      )

      expect(result.canSend).toBe(false)
      expect(result.reason).toBe('No subscription found or user preferences not set')
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

    it('should exclude users with disabled global notifications', async () => {
      await env.DB.prepare(`
        UPDATE user_preferences 
        SET notifications_enabled = FALSE 
        WHERE user_id = ?
      `).bind(testUser.id).run()

      const users = await getUsersToNotifyForPlayer(env.DB, testSubscription.chessComUsername)

      expect(users).toHaveLength(0)
    })

    it('should exclude users with disabled player notifications', async () => {
      await env.DB.prepare(`
        UPDATE player_subscriptions 
        SET notifications_enabled = FALSE 
        WHERE user_id = ? AND chess_com_username = ?
      `).bind(testUser.id, testSubscription.chessComUsername).run()

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

    it('should return empty array for unknown player', async () => {
      const users = await getUsersToNotifyForPlayer(env.DB, 'unknown-player')

      expect(users).toHaveLength(0)
    })

    it('should handle different notification types', async () => {
      const usersForGameStarted = await getUsersToNotifyForPlayer(env.DB, testSubscription.chessComUsername, 'game_started')
      const usersForGameEnded = await getUsersToNotifyForPlayer(env.DB, testSubscription.chessComUsername, 'game_ended')

      expect(usersForGameStarted).toHaveLength(1)
      expect(usersForGameEnded).toHaveLength(1)
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

      // Verify the update
      const result = await env.DB.prepare(`
        SELECT notifications_enabled 
        FROM player_subscriptions 
        WHERE user_id = ? AND chess_com_username = ?
      `).bind(testUser.id, testSubscription.chessComUsername).first()

      expect(result?.notifications_enabled).toBe(false)
    })

    it('should enable notification preference', async () => {
      // First disable it
      await env.DB.prepare(`
        UPDATE player_subscriptions 
        SET notifications_enabled = FALSE 
        WHERE user_id = ? AND chess_com_username = ?
      `).bind(testUser.id, testSubscription.chessComUsername).run()

      // Then enable it through the function
      await updatePlayerNotificationPreference(
        env.DB, 
        testUser.id, 
        testSubscription.chessComUsername, 
        true
      )

      // Verify the update
      const result = await env.DB.prepare(`
        SELECT notifications_enabled 
        FROM player_subscriptions 
        WHERE user_id = ? AND chess_com_username = ?
      `).bind(testUser.id, testSubscription.chessComUsername).first()

      expect(result?.notifications_enabled).toBe(true)
    })

    it('should handle non-existent subscription gracefully', async () => {
      await expect(updatePlayerNotificationPreference(
        env.DB, 
        'non-existent-user', 
        'non-existent-player', 
        true
      )).resolves.not.toThrow()
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
      expect(logResult.sentAt).toBeDefined()
    })

    it('should log notification without game details', async () => {
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

    it('should log delivery tracking information', async () => {
      const now = new Date().toISOString()
      const logResult = await logDetailedNotification(env.DB, {
        userId: testUser.id,
        chessComUsername: testSubscription.chessComUsername,
        notificationType: 'game_ended',
        emailDelivered: true,
        deliveredAt: now,
        emailProviderMessageId: 'resend-456'
      })

      expect(logResult.emailDelivered).toBe(true)
      expect(logResult.deliveredAt).toBe(now)
      expect(logResult.emailProviderMessageId).toBe('resend-456')
      expect(logResult.failedAt).toBeUndefined()
    })

    it('should log failure information', async () => {
      const failedAt = new Date().toISOString()
      const logResult = await logDetailedNotification(env.DB, {
        userId: testUser.id,
        chessComUsername: testSubscription.chessComUsername,
        notificationType: 'game_started',
        emailDelivered: false,
        failedAt,
        failureReason: 'API rate limit exceeded'
      })

      expect(logResult.emailDelivered).toBe(false)
      expect(logResult.failedAt).toBe(failedAt)
      expect(logResult.failureReason).toBe('API rate limit exceeded')
      expect(logResult.deliveredAt).toBeUndefined()
    })

    it('should handle complex game details', async () => {
      const complexGameDetails = {
        timeControl: '5+3',
        rated: false,
        gameType: 'blitz',
        gameUrl: 'https://chess.com/live/game/12345',
        startTime: '2025-07-06T16:30:00.000Z',
        players: {
          white: 'player1',
          black: 'player2'
        },
        tournament: 'Daily Tournament'
      }

      const logResult = await logDetailedNotification(env.DB, {
        userId: testUser.id,
        chessComUsername: testSubscription.chessComUsername,
        notificationType: 'game_started',
        gameDetails: complexGameDetails,
        emailDelivered: true
      })

      expect(logResult.gameDetails).toEqual(complexGameDetails)
    })
  })
})