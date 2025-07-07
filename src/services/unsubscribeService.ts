import { generateSecureId } from '../utils/crypto'
import { createApiError } from '../middleware/errorHandler'

// =============================================================================
// UNSUBSCRIBE SERVICE - Secure Token-Based Unsubscribe System
// =============================================================================

export interface UnsubscribeToken {
  id: string
  userId: string
  token: string
  tokenType: 'global' | 'player_specific' | 'notification_type'
  scopeData: Record<string, any>
  expiresAt: string
  usedAt?: string
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export interface UnsubscribeOptions {
  type: 'global' | 'player_specific' | 'notification_type'
  playerName?: string
  notificationType?: string
  userId: string
}

export interface UnsubscribeResult {
  success: boolean
  message: string
  unsubscribeType: string
  affectedSettings?: any
}

// =============================================================================
// TOKEN GENERATION
// =============================================================================

export async function generateUnsubscribeToken(
  db: D1Database, 
  options: UnsubscribeOptions
): Promise<UnsubscribeToken> {
  try {
    const id = await generateSecureId()
    const token = await generateSecureId() // Use crypto-secure ID as token
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    
    const scopeData: Record<string, any> = {}
    if (options.playerName) {
      scopeData.playerName = options.playerName
    }
    if (options.notificationType) {
      scopeData.notificationType = options.notificationType
    }

    const unsubscribeToken: UnsubscribeToken = {
      id,
      userId: options.userId,
      token,
      tokenType: options.type,
      scopeData,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString()
    }

    await db.prepare(`
      INSERT INTO unsubscribe_tokens (
        id, user_id, token, token_type, scope_data, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      options.userId,
      token,
      options.type,
      JSON.stringify(scopeData),
      expiresAt.toISOString(),
      unsubscribeToken.createdAt
    ).run()

    return unsubscribeToken

  } catch (error) {
    console.error('Generate unsubscribe token error:', error)
    throw createApiError('Failed to generate unsubscribe token', 500, 'UNSUBSCRIBE_TOKEN_GENERATION_FAILED', error)
  }
}

// =============================================================================
// TOKEN VALIDATION
// =============================================================================

export async function validateUnsubscribeToken(
  db: D1Database, 
  token: string
): Promise<UnsubscribeToken | null> {
  try {
    const result = await db.prepare(`
      SELECT 
        id, user_id, token, token_type, scope_data, expires_at, used_at,
        ip_address, user_agent, created_at
      FROM unsubscribe_tokens
      WHERE token = ? AND expires_at > CURRENT_TIMESTAMP AND used_at IS NULL
    `).bind(token).first()

    if (!result) {
      return null
    }

    return {
      id: result.id as string,
      userId: result.user_id as string,
      token: result.token as string,
      tokenType: result.token_type as 'global' | 'player_specific' | 'notification_type',
      scopeData: result.scope_data ? JSON.parse(result.scope_data as string) : {},
      expiresAt: result.expires_at as string,
      usedAt: result.used_at as string || undefined,
      ipAddress: result.ip_address as string || undefined,
      userAgent: result.user_agent as string || undefined,
      createdAt: result.created_at as string
    }

  } catch (error) {
    console.error('Validate unsubscribe token error:', error)
    throw createApiError('Failed to validate unsubscribe token', 500, 'UNSUBSCRIBE_TOKEN_VALIDATION_FAILED', error)
  }
}

// =============================================================================
// UNSUBSCRIBE PROCESSING
// =============================================================================

export async function processUnsubscribe(
  db: D1Database,
  token: string,
  options: {
    ipAddress?: string
    userAgent?: string
    preferences?: {
      unsubscribeFromAll?: boolean
      unsubscribeFromPlayer?: string
      unsubscribeFromType?: string
      newFrequency?: 'disabled' | 'digest_daily' | 'digest_hourly'
    }
  }
): Promise<UnsubscribeResult> {
  try {
    // Validate token
    const unsubscribeToken = await validateUnsubscribeToken(db, token)
    if (!unsubscribeToken) {
      return {
        success: false,
        message: 'Invalid or expired unsubscribe link',
        unsubscribeType: 'invalid'
      }
    }

    // Mark token as used
    await markTokenAsUsed(db, token, options.ipAddress, options.userAgent)

    // Process unsubscribe based on type
    let result: UnsubscribeResult

    switch (unsubscribeToken.tokenType) {
      case 'global':
        result = await processGlobalUnsubscribe(db, unsubscribeToken, options.preferences)
        break
      case 'player_specific':
        result = await processPlayerUnsubscribe(db, unsubscribeToken, options.preferences)
        break
      case 'notification_type':
        result = await processNotificationTypeUnsubscribe(db, unsubscribeToken, options.preferences)
        break
      default:
        throw new Error(`Unknown token type: ${unsubscribeToken.tokenType}`)
    }

    // Log unsubscribe activity
    await logUnsubscribeActivity(db, unsubscribeToken, result, options)

    return result

  } catch (error) {
    console.error('Process unsubscribe error:', error)
    throw createApiError('Failed to process unsubscribe request', 500, 'UNSUBSCRIBE_PROCESSING_FAILED', error)
  }
}

async function markTokenAsUsed(
  db: D1Database,
  token: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await db.prepare(`
    UPDATE unsubscribe_tokens 
    SET used_at = CURRENT_TIMESTAMP, ip_address = ?, user_agent = ?
    WHERE token = ?
  `).bind(ipAddress || null, userAgent || null, token).run()
}

async function processGlobalUnsubscribe(
  db: D1Database,
  unsubscribeToken: UnsubscribeToken,
  preferences?: any
): Promise<UnsubscribeResult> {
  // Update global notification preferences
  if (preferences?.unsubscribeFromAll) {
    await db.prepare(`
      UPDATE notification_preferences 
      SET email_enabled = false, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).bind(unsubscribeToken.userId).run()

    return {
      success: true,
      message: 'Successfully unsubscribed from all email notifications',
      unsubscribeType: 'global_all',
      affectedSettings: { emailEnabled: false }
    }
  } else if (preferences?.newFrequency) {
    await db.prepare(`
      UPDATE notification_preferences 
      SET notification_frequency = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).bind(preferences.newFrequency, unsubscribeToken.userId).run()

    return {
      success: true,
      message: `Successfully updated notification frequency to ${preferences.newFrequency}`,
      unsubscribeType: 'global_frequency',
      affectedSettings: { notificationFrequency: preferences.newFrequency }
    }
  } else {
    // Default: disable email notifications
    await db.prepare(`
      UPDATE notification_preferences 
      SET email_enabled = false, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).bind(unsubscribeToken.userId).run()

    return {
      success: true,
      message: 'Successfully unsubscribed from email notifications',
      unsubscribeType: 'global_default',
      affectedSettings: { emailEnabled: false }
    }
  }
}

async function processPlayerUnsubscribe(
  db: D1Database,
  unsubscribeToken: UnsubscribeToken,
  preferences?: any
): Promise<UnsubscribeResult> {
  const playerName = unsubscribeToken.scopeData.playerName

  if (!playerName) {
    throw new Error('Player name not found in token scope')
  }

  // Update or create player-specific settings
  const id = await generateSecureId()
  await db.prepare(`
    INSERT INTO player_notification_settings (
      id, user_id, player_name, enabled, notification_types, game_type_filters,
      custom_cooldown_minutes, priority_level, notes
    ) VALUES (?, ?, ?, false, '{}', '{}', null, 'normal', 'Unsubscribed via email link')
    ON CONFLICT (user_id, player_name) DO UPDATE SET
      enabled = false,
      notes = 'Unsubscribed via email link',
      updated_at = CURRENT_TIMESTAMP
  `).bind(id, unsubscribeToken.userId, playerName).run()

  return {
    success: true,
    message: `Successfully unsubscribed from notifications for ${playerName}`,
    unsubscribeType: 'player_specific',
    affectedSettings: { playerName, enabled: false }
  }
}

async function processNotificationTypeUnsubscribe(
  db: D1Database,
  unsubscribeToken: UnsubscribeToken,
  preferences?: any
): Promise<UnsubscribeResult> {
  const notificationType = unsubscribeToken.scopeData.notificationType

  if (!notificationType) {
    throw new Error('Notification type not found in token scope')
  }

  // This could be implemented to disable specific types of notifications
  // For now, we'll disable all email notifications
  await db.prepare(`
    UPDATE notification_preferences 
    SET email_enabled = false, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).bind(unsubscribeToken.userId).run()

  return {
    success: true,
    message: `Successfully unsubscribed from ${notificationType} notifications`,
    unsubscribeType: 'notification_type',
    affectedSettings: { notificationType, emailEnabled: false }
  }
}

async function logUnsubscribeActivity(
  db: D1Database,
  unsubscribeToken: UnsubscribeToken,
  result: UnsubscribeResult,
  options: any
): Promise<void> {
  try {
    const id = await generateSecureId()
    await db.prepare(`
      INSERT INTO user_activity (
        id, user_id, activity_type, activity_data, ip_address, user_agent, created_at
      ) VALUES (?, ?, 'unsubscribe', ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      id,
      unsubscribeToken.userId,
      JSON.stringify({
        tokenType: unsubscribeToken.tokenType,
        scopeData: unsubscribeToken.scopeData,
        result: result,
        tokenId: unsubscribeToken.id
      }),
      options.ipAddress || null,
      options.userAgent || null
    ).run()
  } catch (error) {
    console.error('Error logging unsubscribe activity:', error)
    // Don't throw - this is logging only
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export async function cleanupExpiredTokens(db: D1Database): Promise<number> {
  try {
    const result = await db.prepare(`
      DELETE FROM unsubscribe_tokens 
      WHERE expires_at < CURRENT_TIMESTAMP
    `).run()

    return result.changes || 0
  } catch (error) {
    console.error('Cleanup expired tokens error:', error)
    throw createApiError('Failed to cleanup expired tokens', 500, 'TOKEN_CLEANUP_FAILED', error)
  }
}

export async function getUserUnsubscribeTokens(
  db: D1Database,
  userId: string
): Promise<UnsubscribeToken[]> {
  try {
    const result = await db.prepare(`
      SELECT 
        id, user_id, token, token_type, scope_data, expires_at, used_at,
        ip_address, user_agent, created_at
      FROM unsubscribe_tokens
      WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
    `).bind(userId).all()

    return result.results?.map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      token: row.token as string,
      tokenType: row.token_type as 'global' | 'player_specific' | 'notification_type',
      scopeData: row.scope_data ? JSON.parse(row.scope_data as string) : {},
      expiresAt: row.expires_at as string,
      usedAt: row.used_at as string || undefined,
      ipAddress: row.ip_address as string || undefined,
      userAgent: row.user_agent as string || undefined,
      createdAt: row.created_at as string
    })) || []

  } catch (error) {
    console.error('Get user unsubscribe tokens error:', error)
    throw createApiError('Failed to fetch user unsubscribe tokens', 500, 'USER_TOKENS_FETCH_FAILED', error)
  }
}

export function generateUnsubscribeUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`
}