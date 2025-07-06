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

export interface PlayerNotificationPreferences {
  id: string
  subscriptionId: string
  notifyOnline: boolean
  notifyGameStart: boolean
  notifyGameEnd: boolean
  createdAt: string
  updatedAt: string
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

export async function shouldSendNotification(db: D1Database, userId: string, playerName: string, eventType: 'game_started' | 'game_ended'): Promise<boolean> {
  try {
    const preferences = await getNotificationPreferences(db, userId)
    
    if (!preferences || !preferences.emailNotifications || preferences.notificationFrequency === 'disabled') {
      return false
    }

    // Check per-player preferences
    const playerPrefs = await getPlayerNotificationPreferences(db, userId, playerName)
    if (playerPrefs) {
      const shouldNotify = eventType === 'game_started' ? playerPrefs.notifyGameStart : playerPrefs.notifyGameEnd
      if (!shouldNotify) {
        return false
      }
    }

    const recentNotification = await db.prepare(`
      SELECT id FROM notification_log
      WHERE user_id = ? AND chess_com_username = ? AND notification_type = ?
      AND sent_at > datetime('now', '-5 minutes')
      LIMIT 1
    `).bind(userId, playerName, eventType).first()

    return !recentNotification
  } catch (error) {
    console.error('Should send notification check error:', error)
    return false
  }
}

// Per-player notification preference functions

export async function getPlayerNotificationPreferences(db: D1Database, userId: string, chessComUsername: string): Promise<PlayerNotificationPreferences | null> {
  try {
    const result = await db.prepare(`
      SELECT pnp.id, pnp.subscription_id, pnp.notify_online, pnp.notify_game_start, pnp.notify_game_end, pnp.created_at, pnp.updated_at
      FROM player_notification_preferences pnp
      JOIN player_subscriptions ps ON pnp.subscription_id = ps.id
      WHERE ps.user_id = ? AND ps.chess_com_username = ?
    `).bind(userId, chessComUsername).first()

    if (!result) {
      return null
    }

    return {
      id: result.id as string,
      subscriptionId: result.subscription_id as string,
      notifyOnline: Boolean(result.notify_online),
      notifyGameStart: Boolean(result.notify_game_start),
      notifyGameEnd: Boolean(result.notify_game_end),
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string
    }
  } catch (error) {
    console.error('Get player notification preferences error:', error)
    throw createApiError('Failed to fetch player notification preferences', 500, 'PLAYER_NOTIFICATION_PREFERENCES_FETCH_FAILED', error)
  }
}

export async function updatePlayerNotificationPreferences(db: D1Database, userId: string, chessComUsername: string, updates: {
  notifyOnline?: boolean
  notifyGameStart?: boolean
  notifyGameEnd?: boolean
}): Promise<PlayerNotificationPreferences> {
  const now = new Date().toISOString()

  try {
    // First find the subscription
    const subscription = await db.prepare(`
      SELECT id FROM player_subscriptions 
      WHERE user_id = ? AND chess_com_username = ?
    `).bind(userId, chessComUsername).first()

    if (!subscription) {
      throw createApiError('Player subscription not found', 404, 'SUBSCRIPTION_NOT_FOUND')
    }

    const subscriptionId = subscription.id as string

    // Check if preferences already exist
    const existing = await db.prepare(`
      SELECT id FROM player_notification_preferences 
      WHERE subscription_id = ?
    `).bind(subscriptionId).first()

    if (existing) {
      // Update existing preferences
      const updateFields: string[] = []
      const values: any[] = []

      if (updates.notifyOnline !== undefined) {
        updateFields.push('notify_online = ?')
        values.push(updates.notifyOnline)
      }

      if (updates.notifyGameStart !== undefined) {
        updateFields.push('notify_game_start = ?')
        values.push(updates.notifyGameStart)
      }

      if (updates.notifyGameEnd !== undefined) {
        updateFields.push('notify_game_end = ?')
        values.push(updates.notifyGameEnd)
      }

      if (updateFields.length === 0) {
        throw createApiError('No valid fields to update', 400, 'INVALID_UPDATE_DATA')
      }

      updateFields.push('updated_at = ?')
      values.push(now, subscriptionId)

      await db.prepare(`
        UPDATE player_notification_preferences 
        SET ${updateFields.join(', ')}
        WHERE subscription_id = ?
      `).bind(...values).run()
    } else {
      // Create new preferences
      const id = await generateSecureId()
      
      await db.prepare(`
        INSERT INTO player_notification_preferences 
        (id, subscription_id, notify_online, notify_game_start, notify_game_end, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        subscriptionId,
        updates.notifyOnline ?? false,
        updates.notifyGameStart ?? false,
        updates.notifyGameEnd ?? false,
        now,
        now
      ).run()
    }

    const preferences = await getPlayerNotificationPreferences(db, userId, chessComUsername)
    if (!preferences) {
      throw createApiError('Failed to retrieve updated player preferences', 500, 'PLAYER_PREFERENCES_UPDATE_FAILED')
    }

    return preferences
  } catch (error) {
    console.error('Update player notification preferences error:', error)
    throw createApiError('Failed to update player notification preferences', 500, 'PLAYER_NOTIFICATION_PREFERENCES_UPDATE_FAILED', error)
  }
}

export async function getAllPlayerNotificationPreferences(db: D1Database, userId: string): Promise<PlayerNotificationPreferences[]> {
  try {
    const result = await db.prepare(`
      SELECT pnp.id, pnp.subscription_id, pnp.notify_online, pnp.notify_game_start, pnp.notify_game_end, pnp.created_at, pnp.updated_at
      FROM player_notification_preferences pnp
      JOIN player_subscriptions ps ON pnp.subscription_id = ps.id
      WHERE ps.user_id = ?
      ORDER BY pnp.created_at DESC
    `).bind(userId).all()

    if (!result.results) {
      return []
    }

    return result.results.map(row => ({
      id: row.id as string,
      subscriptionId: row.subscription_id as string,
      notifyOnline: Boolean(row.notify_online),
      notifyGameStart: Boolean(row.notify_game_start),
      notifyGameEnd: Boolean(row.notify_game_end),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string
    }))
  } catch (error) {
    console.error('Get all player notification preferences error:', error)
    throw createApiError('Failed to fetch all player notification preferences', 500, 'ALL_PLAYER_NOTIFICATION_PREFERENCES_FETCH_FAILED', error)
  }
}