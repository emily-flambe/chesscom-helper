import { createApiError } from '../middleware/errorHandler'

export interface PlayerStatus {
  chessComUsername: string
  isOnline: boolean
  isPlaying: boolean
  currentGameUrl: string | null
  lastSeen: string | null
  lastChecked: string
  updatedAt: string
}

export interface MonitoringStatus {
  totalPlayersMonitored: number
  activeGames: number
  lastFullCheck: string | null
  systemStatus: 'healthy' | 'degraded' | 'down'
  checksLast24Hours: number
}

export async function getPlayerStatus(db: D1Database, chessComUsername: string): Promise<PlayerStatus | null> {
  try {
    const result = await db.prepare(`
      SELECT chess_com_username, is_online, is_playing, current_game_url, 
             last_seen, last_checked, updated_at
      FROM player_status
      WHERE chess_com_username = ?
    `).bind(chessComUsername).first()

    if (!result) return null

    return {
      chessComUsername: result.chess_com_username as string,
      isOnline: Boolean(result.is_online),
      isPlaying: Boolean(result.is_playing),
      currentGameUrl: result.current_game_url as string | null,
      lastSeen: result.last_seen as string | null,
      lastChecked: result.last_checked as string,
      updatedAt: result.updated_at as string
    }
  } catch (error) {
    console.error('Get player status error:', error)
    throw createApiError('Failed to fetch player status', 500, 'PLAYER_STATUS_FETCH_FAILED', error)
  }
}

export async function updatePlayerStatus(db: D1Database, chessComUsername: string, status: {
  isOnline: boolean
  isPlaying: boolean
  currentGameUrl?: string | null
  lastSeen?: string | null
}): Promise<void> {
  const now = new Date().toISOString()

  try {
    const result = await db.prepare(`
      INSERT INTO player_status (
        chess_com_username, is_online, is_playing, current_game_url, 
        last_seen, last_checked, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chess_com_username) DO UPDATE SET
        is_online = excluded.is_online,
        is_playing = excluded.is_playing,
        current_game_url = excluded.current_game_url,
        last_seen = COALESCE(excluded.last_seen, last_seen),
        last_checked = excluded.last_checked,
        updated_at = excluded.updated_at
    `).bind(
      chessComUsername,
      status.isOnline,
      status.isPlaying,
      status.currentGameUrl || null,
      status.lastSeen || null,
      now,
      now
    ).run()

    if (!result.success) {
      throw createApiError('Failed to update player status', 500, 'PLAYER_STATUS_UPDATE_FAILED')
    }
  } catch (error) {
    console.error('Update player status error:', error)
    throw createApiError('Failed to update player status', 500, 'PLAYER_STATUS_UPDATE_FAILED', error)
  }
}

export async function getAllMonitoredPlayers(db: D1Database): Promise<string[]> {
  try {
    const result = await db.prepare(`
      SELECT DISTINCT chess_com_username
      FROM player_subscriptions
      ORDER BY chess_com_username
    `).all()

    if (!result.results) return []

    return result.results.map(row => row.chess_com_username as string)
  } catch (error) {
    console.error('Get all monitored players error:', error)
    throw createApiError('Failed to fetch monitored players', 500, 'MONITORED_PLAYERS_FETCH_FAILED', error)
  }
}

export async function getPlayersWithStatusChanges(db: D1Database, since: string): Promise<PlayerStatus[]> {
  try {
    const result = await db.prepare(`
      SELECT chess_com_username, is_online, is_playing, current_game_url,
             last_seen, last_checked, updated_at
      FROM player_status
      WHERE updated_at > ?
      ORDER BY updated_at DESC
    `).bind(since).all()

    if (!result.results) return []

    return result.results.map(row => ({
      chessComUsername: row.chess_com_username as string,
      isOnline: Boolean(row.is_online),
      isPlaying: Boolean(row.is_playing),
      currentGameUrl: row.current_game_url as string | null,
      lastSeen: row.last_seen as string | null,
      lastChecked: row.last_checked as string,
      updatedAt: row.updated_at as string
    }))
  } catch (error) {
    console.error('Get players with status changes error:', error)
    throw createApiError('Failed to fetch status changes', 500, 'STATUS_CHANGES_FETCH_FAILED', error)
  }
}

export async function getMonitoringStatus(db: D1Database): Promise<MonitoringStatus> {
  try {
    const [totalPlayers, activeGames, recentJobs] = await Promise.all([
      getTotalMonitoredPlayers(db),
      getActiveGamesCount(db),
      getRecentMonitoringJobs(db)
    ])

    const lastFullCheck = recentJobs.length > 0 ? recentJobs[0].completedAt : null
    const checksLast24Hours = recentJobs.filter(job => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      return new Date(job.completedAt || job.createdAt) > twentyFourHoursAgo
    }).length

    let systemStatus: 'healthy' | 'degraded' | 'down' = 'healthy'
    if (checksLast24Hours === 0) {
      systemStatus = 'down'
    } else if (checksLast24Hours < 100) { // Assuming 5-minute intervals = ~288 checks per day
      systemStatus = 'degraded'
    }

    return {
      totalPlayersMonitored: totalPlayers,
      activeGames,
      lastFullCheck,
      systemStatus,
      checksLast24Hours
    }
  } catch (error) {
    console.error('Get monitoring status error:', error)
    throw createApiError('Failed to fetch monitoring status', 500, 'MONITORING_STATUS_FETCH_FAILED', error)
  }
}

async function getTotalMonitoredPlayers(db: D1Database): Promise<number> {
  const result = await db.prepare(`
    SELECT COUNT(DISTINCT chess_com_username) as count
    FROM player_subscriptions
  `).first()

  return result?.count as number || 0
}

async function getActiveGamesCount(db: D1Database): Promise<number> {
  const result = await db.prepare(`
    SELECT COUNT(*) as count
    FROM player_status
    WHERE is_playing = true
  `).first()

  return result?.count as number || 0
}

async function getRecentMonitoringJobs(db: D1Database): Promise<Array<{
  id: string
  jobType: string
  status: string
  createdAt: string
  completedAt: string | null
}>> {
  const result = await db.prepare(`
    SELECT id, job_type, status, created_at, completed_at
    FROM monitoring_jobs
    WHERE job_type IN ('player_check', 'batch_poll')
    ORDER BY created_at DESC
    LIMIT 10
  `).all()

  if (!result.results) return []

  return result.results.map(row => ({
    id: row.id as string,
    jobType: row.job_type as string,
    status: row.status as string,
    createdAt: row.created_at as string,
    completedAt: row.completed_at as string | null
  }))
}