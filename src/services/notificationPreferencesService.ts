import { generateSecureId } from '../utils/crypto'
import { createApiError } from '../middleware/errorHandler'

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface NotificationPreferences {
  userId: string
  emailEnabled: boolean
  notificationFrequency: 'immediate' | 'digest_hourly' | 'digest_daily' | 'disabled'
  quietHoursStart: string
  quietHoursEnd: string
  timezone: string
  playerSpecificSettings: Record<string, PlayerNotificationSettings>
  gameTypeFilters: GameTypeFilters
  notificationCooldownMinutes: number
  bulkActionsEnabled: boolean
  emailPreviewEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface PlayerNotificationSettings {
  enabled: boolean
  notificationTypes: {
    gameStarted: boolean
    gameEnded: boolean
    online: boolean
    offline: boolean
  }
  gameTypeFilters: GameTypeFilters
  customCooldownMinutes?: number
  priorityLevel: 'low' | 'normal' | 'high' | 'urgent'
  notes?: string
}

export interface GameTypeFilters {
  rapid: boolean
  blitz: boolean
  bullet: boolean
  classical: boolean
  correspondence: boolean
}

export interface NotificationHistory {
  id: string
  userId: string
  playerName: string
  notificationType: string
  channel: string
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'clicked' | 'unsubscribed'
  subject?: string
  contentSummary?: string
  sentAt: string
  deliveredAt?: string
  clickedAt?: string
  failedAt?: string
  errorMessage?: string
  metadata?: Record<string, any>
  deliveryDurationMs?: number
  retryCount: number
}

export interface NotificationAnalytics {
  dateBucket: string
  totalNotificationsSent: number
  totalNotificationsDelivered: number
  totalNotificationsFailed: number
  totalNotificationsClicked: number
  averageDeliveryTimeMs: number
  uniquePlayersNotified: number
  notificationTypesBreakdown: Record<string, number>
}

export interface NotificationQueue {
  id: string
  userId: string
  playerName: string
  notificationType: string
  channel: string
  priority: number
  scheduledAt: string
  processingAt?: string
  processedAt?: string
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
  retryCount: number
  maxRetries: number
  errorMessage?: string
  payload: Record<string, any>
}

// =============================================================================
// NOTIFICATION PREFERENCES SERVICE
// =============================================================================

export async function getNotificationPreferences(db: D1Database, userId: string): Promise<NotificationPreferences | null> {
  try {
    const result = await db.prepare(`
      SELECT 
        user_id, email_enabled, notification_frequency, quiet_hours_start,
        quiet_hours_end, timezone, player_specific_settings, game_type_filters,
        notification_cooldown_minutes, bulk_actions_enabled, email_preview_enabled,
        created_at, updated_at
      FROM notification_preferences
      WHERE user_id = ?
    `).bind(userId).first()

    if (!result) {
      return null
    }

    return {
      userId: result.user_id as string,
      emailEnabled: Boolean(result.email_enabled),
      notificationFrequency: result.notification_frequency as any,
      quietHoursStart: result.quiet_hours_start as string,
      quietHoursEnd: result.quiet_hours_end as string,
      timezone: result.timezone as string,
      playerSpecificSettings: result.player_specific_settings ? JSON.parse(result.player_specific_settings as string) : {},
      gameTypeFilters: result.game_type_filters ? JSON.parse(result.game_type_filters as string) : {
        rapid: true,
        blitz: true,
        bullet: true,
        classical: true,
        correspondence: true
      },
      notificationCooldownMinutes: result.notification_cooldown_minutes as number,
      bulkActionsEnabled: Boolean(result.bulk_actions_enabled),
      emailPreviewEnabled: Boolean(result.email_preview_enabled),
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string
    }
  } catch (error) {
    console.error('Get notification preferences error:', error)
    throw createApiError('Failed to fetch notification preferences', 500, 'NOTIFICATION_PREFERENCES_FETCH_FAILED', error)
  }
}

export async function updateNotificationPreferences(db: D1Database, userId: string, updates: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  try {
    const current = await getNotificationPreferences(db, userId)
    
    if (!current) {
      // Create new preferences if they don't exist
      return await createNotificationPreferences(db, userId, updates)
    }

    const updateFields: string[] = []
    const values: any[] = []

    if (updates.emailEnabled !== undefined) {
      updateFields.push('email_enabled = ?')
      values.push(updates.emailEnabled)
    }

    if (updates.notificationFrequency) {
      updateFields.push('notification_frequency = ?')
      values.push(updates.notificationFrequency)
    }

    if (updates.quietHoursStart) {
      updateFields.push('quiet_hours_start = ?')
      values.push(updates.quietHoursStart)
    }

    if (updates.quietHoursEnd) {
      updateFields.push('quiet_hours_end = ?')
      values.push(updates.quietHoursEnd)
    }

    if (updates.timezone) {
      updateFields.push('timezone = ?')
      values.push(updates.timezone)
    }

    if (updates.playerSpecificSettings) {
      updateFields.push('player_specific_settings = ?')
      values.push(JSON.stringify(updates.playerSpecificSettings))
    }

    if (updates.gameTypeFilters) {
      updateFields.push('game_type_filters = ?')
      values.push(JSON.stringify(updates.gameTypeFilters))
    }

    if (updates.notificationCooldownMinutes !== undefined) {
      updateFields.push('notification_cooldown_minutes = ?')
      values.push(updates.notificationCooldownMinutes)
    }

    if (updates.bulkActionsEnabled !== undefined) {
      updateFields.push('bulk_actions_enabled = ?')
      values.push(updates.bulkActionsEnabled)
    }

    if (updates.emailPreviewEnabled !== undefined) {
      updateFields.push('email_preview_enabled = ?')
      values.push(updates.emailPreviewEnabled)
    }

    if (updateFields.length === 0) {
      return current
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP')
    values.push(userId)

    await db.prepare(`
      UPDATE notification_preferences 
      SET ${updateFields.join(', ')}
      WHERE user_id = ?
    `).bind(...values).run()

    const updated = await getNotificationPreferences(db, userId)
    if (!updated) {
      throw createApiError('Failed to retrieve updated preferences', 500, 'PREFERENCES_UPDATE_FAILED')
    }

    return updated
  } catch (error) {
    console.error('Update notification preferences error:', error)
    throw createApiError('Failed to update notification preferences', 500, 'NOTIFICATION_PREFERENCES_UPDATE_FAILED', error)
  }
}

export async function createNotificationPreferences(db: D1Database, userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  try {
    const defaultGameTypeFilters: GameTypeFilters = {
      rapid: true,
      blitz: true,
      bullet: true,
      classical: true,
      correspondence: true
    }

    await db.prepare(`
      INSERT INTO notification_preferences (
        user_id, email_enabled, notification_frequency, quiet_hours_start,
        quiet_hours_end, timezone, player_specific_settings, game_type_filters,
        notification_cooldown_minutes, bulk_actions_enabled, email_preview_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      preferences.emailEnabled ?? true,
      preferences.notificationFrequency ?? 'immediate',
      preferences.quietHoursStart ?? '22:00',
      preferences.quietHoursEnd ?? '07:00',
      preferences.timezone ?? 'UTC',
      JSON.stringify(preferences.playerSpecificSettings ?? {}),
      JSON.stringify(preferences.gameTypeFilters ?? defaultGameTypeFilters),
      preferences.notificationCooldownMinutes ?? 5,
      preferences.bulkActionsEnabled ?? true,
      preferences.emailPreviewEnabled ?? true
    ).run()

    const created = await getNotificationPreferences(db, userId)
    if (!created) {
      throw createApiError('Failed to retrieve created preferences', 500, 'PREFERENCES_CREATE_FAILED')
    }

    return created
  } catch (error) {
    console.error('Create notification preferences error:', error)
    throw createApiError('Failed to create notification preferences', 500, 'NOTIFICATION_PREFERENCES_CREATE_FAILED', error)
  }
}

// =============================================================================
// PLAYER-SPECIFIC NOTIFICATION SETTINGS
// =============================================================================

export async function getPlayerNotificationSettings(db: D1Database, userId: string, playerName?: string): Promise<PlayerNotificationSettings[]> {
  try {
    const query = playerName 
      ? `SELECT * FROM player_notification_settings WHERE user_id = ? AND player_name = ?`
      : `SELECT * FROM player_notification_settings WHERE user_id = ? ORDER BY player_name`
    
    const params = playerName ? [userId, playerName] : [userId]
    const result = await db.prepare(query).bind(...params).all()

    if (!result.results) {
      return []
    }

    return result.results.map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      playerName: row.player_name as string,
      enabled: Boolean(row.enabled),
      notificationTypes: row.notification_types ? JSON.parse(row.notification_types as string) : {
        gameStarted: true,
        gameEnded: true,
        online: false,
        offline: false
      },
      gameTypeFilters: row.game_type_filters ? JSON.parse(row.game_type_filters as string) : {
        rapid: true,
        blitz: true,
        bullet: true,
        classical: true,
        correspondence: true
      },
      customCooldownMinutes: row.custom_cooldown_minutes as number || undefined,
      priorityLevel: row.priority_level as any || 'normal',
      notes: row.notes as string || undefined
    }))
  } catch (error) {
    console.error('Get player notification settings error:', error)
    throw createApiError('Failed to fetch player notification settings', 500, 'PLAYER_SETTINGS_FETCH_FAILED', error)
  }
}

export async function updatePlayerNotificationSettings(db: D1Database, userId: string, playerName: string, settings: Partial<PlayerNotificationSettings>): Promise<PlayerNotificationSettings> {
  try {
    const id = await generateSecureId()

    await db.prepare(`
      INSERT INTO player_notification_settings (
        id, user_id, player_name, enabled, notification_types, game_type_filters,
        custom_cooldown_minutes, priority_level, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (user_id, player_name) DO UPDATE SET
        enabled = excluded.enabled,
        notification_types = excluded.notification_types,
        game_type_filters = excluded.game_type_filters,
        custom_cooldown_minutes = excluded.custom_cooldown_minutes,
        priority_level = excluded.priority_level,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      id,
      userId,
      playerName,
      settings.enabled ?? true,
      JSON.stringify(settings.notificationTypes ?? {
        gameStarted: true,
        gameEnded: true,
        online: false,
        offline: false
      }),
      JSON.stringify(settings.gameTypeFilters ?? {
        rapid: true,
        blitz: true,
        bullet: true,
        classical: true,
        correspondence: true
      }),
      settings.customCooldownMinutes || null,
      settings.priorityLevel ?? 'normal',
      settings.notes || null
    ).run()

    const updated = await getPlayerNotificationSettings(db, userId, playerName)
    if (!updated || updated.length === 0) {
      throw createApiError('Failed to retrieve updated player settings', 500, 'PLAYER_SETTINGS_UPDATE_FAILED')
    }

    return updated[0]
  } catch (error) {
    console.error('Update player notification settings error:', error)
    throw createApiError('Failed to update player notification settings', 500, 'PLAYER_SETTINGS_UPDATE_FAILED', error)
  }
}

export async function deletePlayerNotificationSettings(db: D1Database, userId: string, playerName: string): Promise<void> {
  try {
    await db.prepare(`
      DELETE FROM player_notification_settings 
      WHERE user_id = ? AND player_name = ?
    `).bind(userId, playerName).run()
  } catch (error) {
    console.error('Delete player notification settings error:', error)
    throw createApiError('Failed to delete player notification settings', 500, 'PLAYER_SETTINGS_DELETE_FAILED', error)
  }
}

// =============================================================================
// NOTIFICATION HISTORY SERVICE
// =============================================================================

export async function getNotificationHistory(db: D1Database, userId: string, options: {
  limit?: number
  offset?: number
  playerName?: string
  notificationType?: string
  status?: string
  startDate?: string
  endDate?: string
}): Promise<{ notifications: NotificationHistory[], totalCount: number }> {
  try {
    const limit = Math.min(options.limit || 50, 100)
    const offset = options.offset || 0

    const whereConditions = ['nh.user_id = ?']
    const params = [userId]

    if (options.playerName) {
      whereConditions.push('nh.player_name = ?')
      params.push(options.playerName)
    }

    if (options.notificationType) {
      whereConditions.push('nh.notification_type = ?')
      params.push(options.notificationType)
    }

    if (options.status) {
      whereConditions.push('nh.status = ?')
      params.push(options.status)
    }

    if (options.startDate) {
      whereConditions.push('nh.sent_at >= ?')
      params.push(options.startDate)
    }

    if (options.endDate) {
      whereConditions.push('nh.sent_at <= ?')
      params.push(options.endDate)
    }

    const whereClause = whereConditions.join(' AND ')

    // Get total count
    const countResult = await db.prepare(`
      SELECT COUNT(*) as total_count
      FROM notification_history nh
      WHERE ${whereClause}
    `).bind(...params).first()

    const totalCount = countResult?.total_count as number || 0

    // Get notifications
    const result = await db.prepare(`
      SELECT 
        nh.id, nh.user_id, nh.player_name, nh.notification_type, nh.channel,
        nh.status, nh.subject, nh.content_summary, nh.sent_at, nh.delivered_at,
        nh.clicked_at, nh.failed_at, nh.error_message, nh.metadata,
        nh.delivery_duration_ms, nh.retry_count
      FROM notification_history nh
      WHERE ${whereClause}
      ORDER BY nh.sent_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all()

    const notifications = result.results?.map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      playerName: row.player_name as string,
      notificationType: row.notification_type as string,
      channel: row.channel as string,
      status: row.status as any,
      subject: row.subject as string || undefined,
      contentSummary: row.content_summary as string || undefined,
      sentAt: row.sent_at as string,
      deliveredAt: row.delivered_at as string || undefined,
      clickedAt: row.clicked_at as string || undefined,
      failedAt: row.failed_at as string || undefined,
      errorMessage: row.error_message as string || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
      deliveryDurationMs: row.delivery_duration_ms as number || undefined,
      retryCount: row.retry_count as number
    })) || []

    return { notifications, totalCount }
  } catch (error) {
    console.error('Get notification history error:', error)
    throw createApiError('Failed to fetch notification history', 500, 'NOTIFICATION_HISTORY_FETCH_FAILED', error)
  }
}

// =============================================================================
// NOTIFICATION ANALYTICS SERVICE
// =============================================================================

export async function getNotificationAnalytics(db: D1Database, userId: string, options: {
  startDate: string
  endDate: string
  groupBy?: 'day' | 'hour'
}): Promise<NotificationAnalytics[]> {
  try {
    const result = await db.prepare(`
      SELECT 
        na.date_bucket,
        na.total_notifications_sent,
        na.total_notifications_delivered,
        na.total_notifications_failed,
        na.total_notifications_clicked,
        na.average_delivery_time_ms,
        na.unique_players_notified,
        na.notification_types_breakdown
      FROM notification_analytics na
      WHERE na.user_id = ?
        AND na.date_bucket >= ?
        AND na.date_bucket <= ?
      ORDER BY na.date_bucket DESC
    `).bind(userId, options.startDate, options.endDate).all()

    return result.results?.map(row => ({
      dateBucket: row.date_bucket as string,
      totalNotificationsSent: row.total_notifications_sent as number,
      totalNotificationsDelivered: row.total_notifications_delivered as number,
      totalNotificationsFailed: row.total_notifications_failed as number,
      totalNotificationsClicked: row.total_notifications_clicked as number,
      averageDeliveryTimeMs: row.average_delivery_time_ms as number,
      uniquePlayersNotified: row.unique_players_notified as number,
      notificationTypesBreakdown: row.notification_types_breakdown ? JSON.parse(row.notification_types_breakdown as string) : {}
    })) || []
  } catch (error) {
    console.error('Get notification analytics error:', error)
    throw createApiError('Failed to fetch notification analytics', 500, 'NOTIFICATION_ANALYTICS_FETCH_FAILED', error)
  }
}

// =============================================================================
// NOTIFICATION QUEUE SERVICE
// =============================================================================

export async function getNotificationQueue(db: D1Database, userId: string): Promise<NotificationQueue[]> {
  try {
    const result = await db.prepare(`
      SELECT 
        nq.id, nq.user_id, nq.player_name, nq.notification_type, nq.channel,
        nq.priority, nq.scheduled_at, nq.processing_at, nq.processed_at,
        nq.status, nq.retry_count, nq.max_retries, nq.error_message, nq.payload
      FROM notification_queue nq
      WHERE nq.user_id = ?
        AND nq.status IN ('pending', 'processing')
      ORDER BY nq.priority DESC, nq.scheduled_at ASC
    `).bind(userId).all()

    return result.results?.map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      playerName: row.player_name as string,
      notificationType: row.notification_type as string,
      channel: row.channel as string,
      priority: row.priority as number,
      scheduledAt: row.scheduled_at as string,
      processingAt: row.processing_at as string || undefined,
      processedAt: row.processed_at as string || undefined,
      status: row.status as any,
      retryCount: row.retry_count as number,
      maxRetries: row.max_retries as number,
      errorMessage: row.error_message as string || undefined,
      payload: row.payload ? JSON.parse(row.payload as string) : {}
    })) || []
  } catch (error) {
    console.error('Get notification queue error:', error)
    throw createApiError('Failed to fetch notification queue', 500, 'NOTIFICATION_QUEUE_FETCH_FAILED', error)
  }
}

export async function getNotificationQueueStatus(db: D1Database, userId: string): Promise<Record<string, number>> {
  try {
    const result = await db.prepare(`
      SELECT nq.status, COUNT(*) as count
      FROM notification_queue nq
      WHERE nq.user_id = ?
      GROUP BY nq.status
    `).bind(userId).all()

    const status: Record<string, number> = {}
    result.results?.forEach(row => {
      status[row.status as string] = row.count as number
    })

    return status
  } catch (error) {
    console.error('Get notification queue status error:', error)
    throw createApiError('Failed to fetch notification queue status', 500, 'NOTIFICATION_QUEUE_STATUS_FETCH_FAILED', error)
  }
}

// =============================================================================
// DASHBOARD STATISTICS
// =============================================================================

export async function getDashboardStats(db: D1Database, userId: string): Promise<{
  totalPlayers: number
  enabledPlayers: number
  notifications24h: number
  notifications7d: number
  pendingNotifications: number
}> {
  try {
    const result = await db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM player_subscriptions ps WHERE ps.user_id = ?) as total_players,
        (SELECT COUNT(*) FROM player_notification_settings pns WHERE pns.user_id = ? AND pns.enabled = true) as enabled_players,
        (SELECT COUNT(*) FROM notification_history nh WHERE nh.user_id = ? AND nh.sent_at >= datetime('now', '-24 hours')) as notifications_24h,
        (SELECT COUNT(*) FROM notification_history nh WHERE nh.user_id = ? AND nh.sent_at >= datetime('now', '-7 days')) as notifications_7d,
        (SELECT COUNT(*) FROM notification_queue nq WHERE nq.user_id = ? AND nq.status = 'pending') as pending_notifications
    `).bind(userId, userId, userId, userId, userId).first()

    return {
      totalPlayers: result?.total_players as number || 0,
      enabledPlayers: result?.enabled_players as number || 0,
      notifications24h: result?.notifications_24h as number || 0,
      notifications7d: result?.notifications_7d as number || 0,
      pendingNotifications: result?.pending_notifications as number || 0
    }
  } catch (error) {
    console.error('Get dashboard stats error:', error)
    throw createApiError('Failed to fetch dashboard statistics', 500, 'DASHBOARD_STATS_FETCH_FAILED', error)
  }
}