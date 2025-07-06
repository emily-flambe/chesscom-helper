import { generateSecureId } from '../utils/crypto'
import { createApiError } from '../middleware/errorHandler'

export interface PlayerSubscription {
  id: string
  userId: string
  chessComUsername: string
  createdAt: string
}

export interface CreateSubscriptionData {
  userId: string
  chessComUsername: string
}

export async function getPlayerSubscriptions(db: D1Database, userId: string): Promise<PlayerSubscription[]> {
  try {
    const result = await db.prepare(`
      SELECT id, user_id, chess_com_username, created_at
      FROM player_subscriptions
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(userId).all()

    if (!result.results) {
return []
}

    return result.results.map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      chessComUsername: row.chess_com_username as string,
      createdAt: row.created_at as string
    }))
  } catch (error) {
    console.error('Get player subscriptions error:', error)
    throw createApiError('Failed to fetch subscriptions', 500, 'SUBSCRIPTION_FETCH_FAILED', error)
  }
}

export async function createPlayerSubscription(db: D1Database, subscriptionData: CreateSubscriptionData): Promise<PlayerSubscription> {
  const id = await generateSecureId()
  const now = new Date().toISOString()

  try {
    const existingResult = await db.prepare(`
      SELECT id FROM player_subscriptions
      WHERE user_id = ? AND chess_com_username = ?
    `).bind(subscriptionData.userId, subscriptionData.chessComUsername).first()

    if (existingResult) {
      throw createApiError('Already subscribed to this player', 409, 'SUBSCRIPTION_EXISTS')
    }

    const result = await db.prepare(`
      INSERT INTO player_subscriptions (id, user_id, chess_com_username, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(id, subscriptionData.userId, subscriptionData.chessComUsername, now).run()

    if (!result.success) {
      throw createApiError('Failed to create subscription', 500, 'SUBSCRIPTION_CREATION_FAILED')
    }

    await ensurePlayerInMonitoringSystem(db, subscriptionData.chessComUsername)

    return {
      id,
      userId: subscriptionData.userId,
      chessComUsername: subscriptionData.chessComUsername,
      createdAt: now
    }
  } catch (error) {
    console.error('Create subscription error:', error)
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw createApiError('Already subscribed to this player', 409, 'SUBSCRIPTION_EXISTS')
    }
    throw createApiError('Failed to create subscription', 500, 'SUBSCRIPTION_CREATION_FAILED', error)
  }
}

export async function deletePlayerSubscription(db: D1Database, userId: string, chessComUsername: string, env?: { ENVIRONMENT?: string }): Promise<void> {
  try {
    const result = await db.prepare(`
      DELETE FROM player_subscriptions
      WHERE user_id = ? AND chess_com_username = ?
    `).bind(userId, chessComUsername).run()

    if (!result.success) {
      throw createApiError('Failed to delete subscription', 500, 'SUBSCRIPTION_DELETE_FAILED')
    }

    // Skip cleanup in development mode to preserve test data
    if (env?.ENVIRONMENT !== 'development') {
      await cleanupUnusedPlayerFromMonitoring(db, chessComUsername)
    }
  } catch (error) {
    console.error('Delete subscription error:', error)
    throw createApiError('Failed to delete subscription', 500, 'SUBSCRIPTION_DELETE_FAILED', error)
  }
}

export async function getSubscribersForPlayer(db: D1Database, chessComUsername: string): Promise<string[]> {
  try {
    const result = await db.prepare(`
      SELECT DISTINCT user_id
      FROM player_subscriptions
      WHERE chess_com_username = ?
    `).bind(chessComUsername).all()

    if (!result.results) {
return []
}

    return result.results.map(row => row.user_id as string)
  } catch (error) {
    console.error('Get subscribers for player error:', error)
    throw createApiError('Failed to fetch subscribers', 500, 'SUBSCRIBERS_FETCH_FAILED', error)
  }
}

async function ensurePlayerInMonitoringSystem(db: D1Database, chessComUsername: string): Promise<void> {
  try {
    const existingPlayer = await db.prepare(`
      SELECT chess_com_username FROM player_status
      WHERE chess_com_username = ?
    `).bind(chessComUsername).first()

    if (!existingPlayer) {
      const now = new Date().toISOString()
      await db.prepare(`
        INSERT INTO player_status (chess_com_username, is_online, is_playing, last_checked, updated_at)
        VALUES (?, false, false, ?, ?)
      `).bind(chessComUsername, now, now).run()
    }
  } catch (error) {
    console.error('Ensure player in monitoring system error:', error)
  }
}

async function cleanupUnusedPlayerFromMonitoring(db: D1Database, chessComUsername: string): Promise<void> {
  try {
    const subscribers = await getSubscribersForPlayer(db, chessComUsername)
    
    if (subscribers.length === 0) {
      await db.prepare(`
        DELETE FROM player_status
        WHERE chess_com_username = ?
      `).bind(chessComUsername).run()
    }
  } catch (error) {
    console.error('Cleanup unused player error:', error)
  }
}

// Bulk Operations

export interface BulkRemoveResult {
  removedCount: number
  errors: { username: string; error: string }[]
}

export interface PlayerStatus {
  chessComUsername: string
  isOnline: boolean
  isPlaying: boolean
  currentGameUrl?: string
  lastSeen?: string
  lastChecked: string
  updatedAt: string
}

export async function bulkRemovePlayerSubscriptions(
  db: D1Database, 
  userId: string, 
  chessComUsernames: string[], 
  env?: { ENVIRONMENT?: string }
): Promise<BulkRemoveResult> {
  const result: BulkRemoveResult = {
    removedCount: 0,
    errors: []
  }

  try {
    // Validate input
    if (!Array.isArray(chessComUsernames) || chessComUsernames.length === 0) {
      throw createApiError('Invalid usernames array', 400, 'INVALID_INPUT')
    }

    if (chessComUsernames.length > 100) {
      throw createApiError('Cannot remove more than 100 players at once', 400, 'BULK_LIMIT_EXCEEDED')
    }

    // Remove each subscription individually to handle errors gracefully
    for (const username of chessComUsernames) {
      try {
        const deleteResult = await db.prepare(`
          DELETE FROM player_subscriptions
          WHERE user_id = ? AND chess_com_username = ?
        `).bind(userId, username).run()

        if (deleteResult.success && deleteResult.changes > 0) {
          result.removedCount++
          
          // Skip cleanup in development mode to preserve test data
          if (env?.ENVIRONMENT !== 'development') {
            await cleanupUnusedPlayerFromMonitoring(db, username)
          }
        } else {
          result.errors.push({
            username,
            error: 'Subscription not found'
          })
        }
      } catch (error) {
        console.error(`Bulk remove error for ${username}:`, error)
        result.errors.push({
          username,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return result
  } catch (error) {
    console.error('Bulk remove subscriptions error:', error)
    throw createApiError('Failed to perform bulk removal', 500, 'BULK_REMOVE_FAILED', error)
  }
}

export async function getBulkPlayerStatus(db: D1Database, chessComUsernames: string[]): Promise<PlayerStatus[]> {
  try {
    // Validate input
    if (!Array.isArray(chessComUsernames) || chessComUsernames.length === 0) {
      return []
    }

    if (chessComUsernames.length > 200) {
      throw createApiError('Cannot fetch status for more than 200 players at once', 400, 'BULK_LIMIT_EXCEEDED')
    }

    // Create placeholders for the IN clause
    const placeholders = chessComUsernames.map(() => '?').join(', ')
    
    const result = await db.prepare(`
      SELECT chess_com_username, is_online, is_playing, current_game_url, last_seen, last_checked, updated_at
      FROM player_status
      WHERE chess_com_username IN (${placeholders})
      ORDER BY updated_at DESC
    `).bind(...chessComUsernames).all()

    if (!result.results) {
      return []
    }

    return result.results.map(row => ({
      chessComUsername: row.chess_com_username as string,
      isOnline: Boolean(row.is_online),
      isPlaying: Boolean(row.is_playing),
      currentGameUrl: row.current_game_url as string | undefined,
      lastSeen: row.last_seen as string | undefined,
      lastChecked: row.last_checked as string,
      updatedAt: row.updated_at as string
    }))
  } catch (error) {
    console.error('Get bulk player status error:', error)
    throw createApiError('Failed to fetch bulk player status', 500, 'BULK_STATUS_FETCH_FAILED', error)
  }
}

export async function getSubscriptionsWithStatus(db: D1Database, userId: string): Promise<Array<PlayerSubscription & { status?: PlayerStatus }>> {
  try {
    const result = await db.prepare(`
      SELECT 
        ps.id, ps.user_id, ps.chess_com_username, ps.created_at,
        status.is_online, status.is_playing, status.current_game_url, 
        status.last_seen, status.last_checked, status.updated_at as status_updated_at
      FROM player_subscriptions ps
      LEFT JOIN player_status status ON ps.chess_com_username = status.chess_com_username
      WHERE ps.user_id = ?
      ORDER BY ps.created_at DESC
    `).bind(userId).all()

    if (!result.results) {
      return []
    }

    return result.results.map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      chessComUsername: row.chess_com_username as string,
      createdAt: row.created_at as string,
      status: row.is_online !== null ? {
        chessComUsername: row.chess_com_username as string,
        isOnline: Boolean(row.is_online),
        isPlaying: Boolean(row.is_playing),
        currentGameUrl: row.current_game_url as string | undefined,
        lastSeen: row.last_seen as string | undefined,
        lastChecked: row.last_checked as string,
        updatedAt: row.status_updated_at as string
      } : undefined
    }))
  } catch (error) {
    console.error('Get subscriptions with status error:', error)
    throw createApiError('Failed to fetch subscriptions with status', 500, 'SUBSCRIPTIONS_WITH_STATUS_FETCH_FAILED', error)
  }
}