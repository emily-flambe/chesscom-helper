import { createApiError } from '../middleware/errorHandler'
import { validateNotificationFrequency } from '../utils/validation'

export interface UserPreferences {
  userId: string
  emailNotifications: boolean
  notificationFrequency: 'immediate' | 'digest' | 'disabled'
  createdAt: string
  updatedAt: string
}

export interface UpdatePreferencesData {
  emailNotifications?: boolean
  notificationFrequency?: 'immediate' | 'digest' | 'disabled'
}

export async function getUserPreferences(db: D1Database, userId: string): Promise<UserPreferences> {
  try {
    let result = await db.prepare(`
      SELECT user_id, email_notifications, notification_frequency, created_at, updated_at
      FROM user_preferences
      WHERE user_id = ?
    `).bind(userId).first()

    if (!result) {
      result = await createDefaultUserPreferences(db, userId)
    }

    return {
      userId: result.user_id as string,
      emailNotifications: Boolean(result.email_notifications),
      notificationFrequency: result.notification_frequency as 'immediate' | 'digest' | 'disabled',
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string
    }
  } catch (error) {
    console.error('Get user preferences error:', error)
    throw createApiError('Failed to fetch user preferences', 500, 'PREFERENCES_FETCH_FAILED', error)
  }
}

export async function updateUserPreferences(db: D1Database, userId: string, updateData: UpdatePreferencesData): Promise<UserPreferences> {
  const now = new Date().toISOString()
  const updates: string[] = []
  const values: any[] = []

  if (updateData.emailNotifications !== undefined) {
    updates.push('email_notifications = ?')
    values.push(updateData.emailNotifications)
  }

  if (updateData.notificationFrequency) {
    if (!validateNotificationFrequency(updateData.notificationFrequency)) {
      throw createApiError('Invalid notification frequency', 400, 'INVALID_NOTIFICATION_FREQUENCY')
    }
    updates.push('notification_frequency = ?')
    values.push(updateData.notificationFrequency)
  }

  if (updates.length === 0) {
    throw createApiError('No valid fields to update', 400, 'INVALID_UPDATE_DATA')
  }

  updates.push('updated_at = ?')
  values.push(now, userId)

  try {
    await db.prepare(`
      INSERT INTO user_preferences (user_id, email_notifications, notification_frequency, created_at, updated_at)
      VALUES (?, true, 'immediate', ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET ${updates.join(', ')}
      WHERE user_id = ?
    `).bind(userId, now, now, ...values).run()

    return await getUserPreferences(db, userId)
  } catch (error) {
    console.error('Update user preferences error:', error)
    throw createApiError('Failed to update user preferences', 500, 'PREFERENCES_UPDATE_FAILED', error)
  }
}

async function createDefaultUserPreferences(db: D1Database, userId: string): Promise<any> {
  const now = new Date().toISOString()

  try {
    await db.prepare(`
      INSERT INTO user_preferences (user_id, email_notifications, notification_frequency, created_at, updated_at)
      VALUES (?, true, 'immediate', ?, ?)
    `).bind(userId, now, now).run()

    return {
      user_id: userId,
      email_notifications: true,
      notification_frequency: 'immediate',
      created_at: now,
      updated_at: now
    }
  } catch (error) {
    console.error('Create default preferences error:', error)
    throw createApiError('Failed to create default preferences', 500, 'PREFERENCES_CREATION_FAILED', error)
  }
}