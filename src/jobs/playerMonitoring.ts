import { generateSecureId } from '../utils/crypto'
import { getAllMonitoredPlayers, updatePlayerStatus, getPlayerStatus } from '../services/monitoringService'
import { batchGetPlayerStatuses, getPlayerGameStatus } from '../services/chessComService'
import { getSubscribersForPlayer } from '../services/subscriptionService'
import { shouldSendNotification, queueNotification } from '../services/notificationService'
import type { Env } from '../index'

export interface MonitoringJobResult {
  playersChecked: number
  notificationsSent: number
  errors: string[]
  duration: number
}

export async function checkPlayerStatus(env: Env, ctx: ExecutionContext): Promise<MonitoringJobResult> {
  const startTime = Date.now()
  const jobId = await generateSecureId()
  const errors: string[] = []
  let playersChecked = 0
  let notificationsSent = 0

  try {
    await logJobStart(env.DB, jobId, 'batch_poll')

    const monitoredPlayers = await getAllMonitoredPlayers(env.DB)
    if (monitoredPlayers.length === 0) {
      await logJobComplete(env.DB, jobId, 'completed')
      return { playersChecked: 0, notificationsSent: 0, errors: [], duration: Date.now() - startTime }
    }

    console.log(`Starting monitoring check for ${monitoredPlayers.length} players`)

    const batchSize = 10
    const batches = chunkArray(monitoredPlayers, batchSize)

    for (const batch of batches) {
      try {
        const playerStatuses = await batchGetPlayerStatuses(batch, env.CHESS_COM_API_URL)
        
        for (const status of playerStatuses) {
          try {
            const previousStatus = await getPlayerStatus(env.DB, status.username)
            
            await updatePlayerStatus(env.DB, status.username, {
              isOnline: status.isOnline,
              isPlaying: status.isPlaying,
              currentGameUrl: status.currentGames[0]?.url || null,
              lastSeen: status.isOnline ? new Date().toISOString() : null
            })

            playersChecked++

            const statusChanged = !previousStatus || 
              (previousStatus.isPlaying !== status.isPlaying)

            if (statusChanged && status.isPlaying && !previousStatus?.isPlaying) {
              const notificationCount = await sendGameStartedNotifications(
                env, 
                status.username, 
                status.currentGames[0]?.url
              )
              notificationsSent += notificationCount
            }

            if (statusChanged && !status.isPlaying && previousStatus?.isPlaying) {
              const notificationCount = await sendGameEndedNotifications(
                env, 
                status.username
              )
              notificationsSent += notificationCount
            }

          } catch (playerError) {
            const errorMsg = `Error processing player ${status.username}: ${playerError}`
            console.error(errorMsg)
            errors.push(errorMsg)
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (batchError) {
        const errorMsg = `Error processing batch: ${batchError}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    await logJobComplete(env.DB, jobId, 'completed')
    console.log(`Monitoring check completed: ${playersChecked} players checked, ${notificationsSent} notifications sent`)

  } catch (error) {
    const errorMsg = `Monitoring job failed: ${error}`
    console.error(errorMsg)
    errors.push(errorMsg)
    await logJobComplete(env.DB, jobId, 'failed', errorMsg)
  }

  return {
    playersChecked,
    notificationsSent, 
    errors,
    duration: Date.now() - startTime
  }
}

export async function checkSpecificPlayers(env: Env, playernames?: string[]): Promise<MonitoringJobResult> {
  const startTime = Date.now()
  const jobId = await generateSecureId()
  const errors: string[] = []
  let playersChecked = 0
  let notificationsSent = 0

  try {
    await logJobStart(env.DB, jobId, 'player_check')

    const playersToCheck = playernames || await getAllMonitoredPlayers(env.DB)
    
    if (playersToCheck.length === 0) {
      await logJobComplete(env.DB, jobId, 'completed')
      return { playersChecked: 0, notificationsSent: 0, errors: [], duration: Date.now() - startTime }
    }

    console.log(`Checking specific players: ${playersToCheck.join(', ')}`)

    for (const playerName of playersToCheck) {
      try {
        const status = await getPlayerGameStatus(playerName, env.CHESS_COM_API_URL)
        const previousStatus = await getPlayerStatus(env.DB, playerName)

        await updatePlayerStatus(env.DB, playerName, {
          isOnline: status.isOnline,
          isPlaying: status.isPlaying,
          currentGameUrl: status.currentGames[0]?.url || null,
          lastSeen: status.isOnline ? new Date().toISOString() : null
        })

        playersChecked++

        const statusChanged = !previousStatus || 
          (previousStatus.isPlaying !== status.isPlaying)

        if (statusChanged && status.isPlaying && !previousStatus?.isPlaying) {
          const notificationCount = await sendGameStartedNotifications(
            env,
            playerName,
            status.currentGames[0]?.url
          )
          notificationsSent += notificationCount
        }

      } catch (playerError) {
        const errorMsg = `Error checking player ${playerName}: ${playerError}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }

      await new Promise(resolve => setTimeout(resolve, 500))
    }

    await logJobComplete(env.DB, jobId, 'completed')

  } catch (error) {
    const errorMsg = `Player check job failed: ${error}`
    console.error(errorMsg)
    errors.push(errorMsg)
    await logJobComplete(env.DB, jobId, 'failed', errorMsg)
  }

  return {
    playersChecked,
    notificationsSent,
    errors,
    duration: Date.now() - startTime
  }
}

async function sendGameStartedNotifications(env: Env, playerName: string, gameUrl?: string): Promise<number> {
  try {
    const subscribers = await getSubscribersForPlayer(env.DB, playerName)
    let notificationsSent = 0

    for (const userId of subscribers) {
      try {
        const shouldSend = await shouldSendNotification(env.DB, userId, playerName, 'game_started')
        
        if (shouldSend) {
          await queueNotification(env.DB, {
            userId,
            playerName,
            eventType: 'game_started',
            ...(gameUrl && { gameUrl })
          })
          notificationsSent++
        }
      } catch (error) {
        console.error(`Failed to send game started notification to user ${userId}:`, error)
      }
    }

    return notificationsSent
  } catch (error) {
    console.error(`Failed to send game started notifications for ${playerName}:`, error)
    return 0
  }
}

async function sendGameEndedNotifications(env: Env, playerName: string): Promise<number> {
  try {
    const subscribers = await getSubscribersForPlayer(env.DB, playerName)
    let notificationsSent = 0

    for (const userId of subscribers) {
      try {
        const shouldSend = await shouldSendNotification(env.DB, userId, playerName, 'game_ended')
        
        if (shouldSend) {
          await queueNotification(env.DB, {
            userId,
            playerName,
            eventType: 'game_ended'
          })
          notificationsSent++
        }
      } catch (error) {
        console.error(`Failed to send game ended notification to user ${userId}:`, error)
      }
    }

    return notificationsSent
  } catch (error) {
    console.error(`Failed to send game ended notifications for ${playerName}:`, error)
    return 0
  }
}

async function logJobStart(db: D1Database, jobId: string, jobType: string): Promise<void> {
  try {
    const now = new Date().toISOString()
    await db.prepare(`
      INSERT INTO monitoring_jobs (id, job_type, status, started_at, created_at)
      VALUES (?, ?, 'running', ?, ?)
    `).bind(jobId, jobType, now, now).run()
  } catch (error) {
    console.error('Failed to log job start:', error)
  }
}

async function logJobComplete(db: D1Database, jobId: string, status: string, errorMessage?: string): Promise<void> {
  try {
    const now = new Date().toISOString()
    await db.prepare(`
      UPDATE monitoring_jobs
      SET status = ?, completed_at = ?, error_message = ?
      WHERE id = ?
    `).bind(status, now, errorMessage || null, jobId).run()
  } catch (error) {
    console.error('Failed to log job completion:', error)
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}