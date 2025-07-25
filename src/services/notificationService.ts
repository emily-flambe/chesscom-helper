import { generateSecureId } from '../utils/crypto'
import { createApiError } from '../middleware/errorHandler'

export interface NotificationPreferences {
  userId: string
  emailNotifications: boolean
  notificationFrequency: 'immediate' | 'digest' | 'disabled'
  createdAt: string
  updatedAt: string
}

export interface NotificationLog {
  id: string
  userId: string
  chessComUsername: string
  notificationType: 'game_started' | 'game_ended'
  sentAt: string
  emailDelivered: boolean
  gameDetails?: {
    timeControl?: string
    rated?: boolean
    gameType?: string
    gameUrl?: string
    startTime?: string
  }
  deliveredAt?: string
  failedAt?: string
  failureReason?: string
  emailProviderMessageId?: string
}

export interface QueuedNotification {
  id: string
  userId: string
  playerName: string
  eventType: 'game_started' | 'game_ended'
  gameUrl?: string
  result?: string
  queuedAt: string
}

export interface NotificationCooldownCheck {
  canSend: boolean
  cooldownUntil?: Date
  reason?: string
}

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

export async function getNotificationPreferences(db: D1Database, userId: string): Promise<NotificationPreferences | null> {
  try {
    const result = await db.prepare(`
      SELECT user_id, email_notifications, notification_frequency, created_at, updated_at
      FROM user_preferences
      WHERE user_id = ?
    `).bind(userId).first()

    if (!result) {
return null
}

    return {
      userId: result.user_id as string,
      emailNotifications: Boolean(result.email_notifications),
      notificationFrequency: result.notification_frequency as 'immediate' | 'digest' | 'disabled',
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string
    }
  } catch (error) {
    console.error('Get notification preferences error:', error)
    throw createApiError('Failed to fetch notification preferences', 500, 'NOTIFICATION_PREFERENCES_FETCH_FAILED', error)
  }
}

export async function updateNotificationPreferences(db: D1Database, userId: string, updates: {
  emailNotifications?: boolean
  notificationFrequency?: 'immediate' | 'digest' | 'disabled'
}): Promise<NotificationPreferences> {
  const now = new Date().toISOString()

  try {
    const updateFields: string[] = []
    const values: any[] = []

    if (updates.emailNotifications !== undefined) {
      updateFields.push('email_notifications = ?')
      values.push(updates.emailNotifications)
    }

    if (updates.notificationFrequency) {
      updateFields.push('notification_frequency = ?')
      values.push(updates.notificationFrequency)
    }

    if (updateFields.length === 0) {
      throw createApiError('No valid fields to update', 400, 'INVALID_UPDATE_DATA')
    }

    updateFields.push('updated_at = ?')
    values.push(now, userId)

    await db.prepare(`
      UPDATE user_preferences 
      SET ${updateFields.join(', ')}
      WHERE user_id = ?
    `).bind(...values).run()

    const preferences = await getNotificationPreferences(db, userId)
    if (!preferences) {
      throw createApiError('Failed to retrieve updated preferences', 500, 'PREFERENCES_UPDATE_FAILED')
    }

    return preferences
  } catch (error) {
    console.error('Update notification preferences error:', error)
    throw createApiError('Failed to update notification preferences', 500, 'NOTIFICATION_PREFERENCES_UPDATE_FAILED', error)
  }
}

export async function getNotificationHistory(db: D1Database, userId: string, options: {
  limit: number
  offset: number
}): Promise<NotificationLog[]> {
  try {
    const result = await db.prepare(`
      SELECT id, user_id, chess_com_username, notification_type, sent_at, email_delivered
      FROM notification_log
      WHERE user_id = ?
      ORDER BY sent_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, options.limit, options.offset).all()

    if (!result.results) {
return []
}

    return result.results.map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      chessComUsername: row.chess_com_username as string,
      notificationType: row.notification_type as 'game_started' | 'game_ended',
      sentAt: row.sent_at as string,
      emailDelivered: Boolean(row.email_delivered)
    }))
  } catch (error) {
    console.error('Get notification history error:', error)
    throw createApiError('Failed to fetch notification history', 500, 'NOTIFICATION_HISTORY_FETCH_FAILED', error)
  }
}

export async function logNotificationSent(db: D1Database, notification: {
  userId: string
  chessComUsername: string
  notificationType: 'game_started' | 'game_ended'
  emailDelivered: boolean
}): Promise<NotificationLog> {
  const id = await generateSecureId()
  const now = new Date().toISOString()

  try {
    const result = await db.prepare(`
      INSERT INTO notification_log (id, user_id, chess_com_username, notification_type, sent_at, email_delivered)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      notification.userId,
      notification.chessComUsername,
      notification.notificationType,
      now,
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
      sentAt: now,
      emailDelivered: notification.emailDelivered
    }
  } catch (error) {
    console.error('Log notification sent error:', error)
    throw createApiError('Failed to log notification', 500, 'NOTIFICATION_LOG_FAILED', error)
  }
}

export async function queueNotification(db: D1Database, notification: {
  userId: string
  playerName: string
  eventType: 'game_started' | 'game_ended'
  gameUrl?: string
  result?: string
}): Promise<QueuedNotification> {
  const id = await generateSecureId()
  const now = new Date().toISOString()

  try {
    const recentNotification = await db.prepare(`
      SELECT id FROM notification_log
      WHERE user_id = ? AND chess_com_username = ? AND notification_type = ?
      AND sent_at > datetime('now', '-5 minutes')
      LIMIT 1
    `).bind(notification.userId, notification.playerName, notification.eventType).first()

    if (recentNotification) {
      throw createApiError('Duplicate notification prevented', 409, 'DUPLICATE_NOTIFICATION')
    }

    // For immediate processing, we'll directly trigger the email
    const emailResult = await import('./emailService').then(m =>
      m.sendNotificationEmail(
        { DB: db } as any, // Simplified for this context
        notification.userId,
        notification.eventType,
        {
          playerName: notification.playerName,
          gameUrl: notification.gameUrl,
          result: notification.result
        }
      )
    )

    return {
      id,
      userId: notification.userId,
      playerName: notification.playerName,
      eventType: notification.eventType,
      gameUrl: notification.gameUrl,
      result: notification.result,
      queuedAt: now
    }
  } catch (error) {
    console.error('Queue notification error:', error)
    throw createApiError('Failed to queue notification', 500, 'NOTIFICATION_QUEUE_FAILED', error)
  }
}

/**
 * Enhanced notification cooldown and preference checking
 */
export async function shouldSendNotificationEnhanced(
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

    // Check cooldown period (1 hour)
    if (preferencesResult.last_notification) {
      const lastNotificationTime = new Date(preferencesResult.last_notification as string)
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
 * Log detailed notification with enhanced tracking
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

export async function shouldSendNotification(db: D1Database, userId: string, playerName: string, eventType: 'game_started' | 'game_ended'): Promise<boolean> {
  try {
    const preferences = await getNotificationPreferences(db, userId)
    
    if (!preferences || !preferences.emailNotifications || preferences.notificationFrequency === 'disabled') {
      return false
    }

    const recentNotification = await db.prepare(`
      SELECT id FROM notification_log
      WHERE user_id = ? AND chess_com_username = ? AND notification_type = ?
      AND sent_at > datetime('now', '-1 hour')
      LIMIT 1
    `).bind(userId, playerName, eventType).first()

    return !recentNotification
  } catch (error) {
    console.error('Should send notification check error:', error)
    return false
  }
}