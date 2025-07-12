import { generateSecureId } from '../utils/crypto'
import type { Env } from '../index'

export interface CleanupJobResult {
  expiredTasksRemoved: number
  oldNotificationsRemoved: number
  oldJobsRemoved: number
  errors: string[]
  duration: number
}

export async function cleanupExpiredTasks(env: Env, ctx: ExecutionContext): Promise<CleanupJobResult> {
  const startTime = Date.now()
  const jobId = await generateSecureId()
  const errors: string[] = []
  let expiredTasksRemoved = 0
  let oldNotificationsRemoved = 0
  let oldJobsRemoved = 0

  try {
    await logCleanupJobStart(env.DB, jobId)

    expiredTasksRemoved = await cleanupOldAgentTasks(env.DB)

    oldNotificationsRemoved = await cleanupOldNotificationLogs(env.DB)

    oldJobsRemoved = await cleanupOldMonitoringJobs(env.DB)

    await logCleanupJobComplete(env.DB, jobId, 'completed')
    
    console.log(`Cleanup completed: ${expiredTasksRemoved} tasks, ${oldNotificationsRemoved} notifications, ${oldJobsRemoved} jobs removed`)

  } catch (error) {
    const errorMsg = `Cleanup job failed: ${error}`
    console.error(errorMsg)
    errors.push(errorMsg)
    await logCleanupJobComplete(env.DB, jobId, 'failed', errorMsg)
  }

  return {
    expiredTasksRemoved,
    oldNotificationsRemoved,
    oldJobsRemoved,
    errors,
    duration: Date.now() - startTime
  }
}

async function cleanupOldAgentTasks(db: D1Database): Promise<number> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const result = await db.prepare(`
      DELETE FROM agent_tasks
      WHERE (status IN ('completed', 'failed') AND completed_at < ?)
         OR (status = 'pending' AND created_at < ?)
    `).bind(thirtyDaysAgo, thirtyDaysAgo).run()

    console.log(`Cleaned up ${result.meta.changes || 0} old agent tasks`)
    return result.meta.changes || 0
  } catch (error) {
    console.error('Failed to cleanup old agent tasks:', error)
    return 0
  }
}

async function cleanupOldNotificationLogs(db: D1Database): Promise<number> {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    
    const result = await db.prepare(`
      DELETE FROM notification_log
      WHERE sent_at < ?
    `).bind(ninetyDaysAgo).run()

    console.log(`Cleaned up ${result.meta.changes || 0} old notification logs`)
    return result.meta.changes || 0
  } catch (error) {
    console.error('Failed to cleanup old notification logs:', error)
    return 0
  }
}

async function cleanupOldMonitoringJobs(db: D1Database): Promise<number> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    
    const result = await db.prepare(`
      DELETE FROM monitoring_jobs
      WHERE (status IN ('completed', 'failed') AND completed_at < ?)
         OR (status = 'pending' AND created_at < ?)
    `).bind(sevenDaysAgo, sevenDaysAgo).run()

    console.log(`Cleaned up ${result.meta.changes || 0} old monitoring jobs`)
    return result.meta.changes || 0
  } catch (error) {
    console.error('Failed to cleanup old monitoring jobs:', error)
    return 0
  }
}

export async function cleanupOrphanedPlayerStatuses(env: Env): Promise<number> {
  // Skip cleanup in development mode to preserve test data
  if (env.ENVIRONMENT === 'development') {
    console.log('Skipping orphaned player status cleanup in development mode')
    return 0
  }

  try {
    const result = await env.DB.prepare(`
      DELETE FROM player_status
      WHERE chess_com_username NOT IN (
        SELECT DISTINCT chess_com_username FROM player_subscriptions
      )
    `).run()

    console.log(`Cleaned up ${result.meta.changes || 0} orphaned player statuses`)
    return result.meta.changes || 0
  } catch (error) {
    console.error('Failed to cleanup orphaned player statuses:', error)
    return 0
  }
}

export async function cleanupExpiredAgentResults(env: Env): Promise<number> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    
    const result = await env.DB.prepare(`
      DELETE FROM agent_results
      WHERE created_at < ?
        AND task_id NOT IN (
          SELECT id FROM agent_tasks WHERE status = 'processing'
        )
    `).bind(sevenDaysAgo).run()

    console.log(`Cleaned up ${result.meta.changes || 0} expired agent results`)
    return result.meta.changes || 0
  } catch (error) {
    console.error('Failed to cleanup expired agent results:', error)
    return 0
  }
}

export async function optimizeDatabaseTables(env: Env): Promise<void> {
  try {
    // Vacuum the database to reclaim space and optimize
    await env.DB.prepare('PRAGMA vacuum').run()
    
    // Analyze tables for query optimization
    await env.DB.prepare('PRAGMA analyze').run()
    
    console.log('Database optimization completed')
  } catch (error) {
    console.error('Failed to optimize database:', error)
  }
}

async function logCleanupJobStart(db: D1Database, jobId: string): Promise<void> {
  try {
    const now = new Date().toISOString()
    await db.prepare(`
      INSERT INTO monitoring_jobs (id, job_type, status, started_at, created_at)
      VALUES (?, 'cleanup', 'running', ?, ?)
    `).bind(jobId, now, now).run()
  } catch (error) {
    console.error('Failed to log cleanup job start:', error)
  }
}

async function logCleanupJobComplete(db: D1Database, jobId: string, status: string, errorMessage?: string): Promise<void> {
  try {
    const now = new Date().toISOString()
    await db.prepare(`
      UPDATE monitoring_jobs
      SET status = ?, completed_at = ?, error_message = ?
      WHERE id = ?
    `).bind(status, now, errorMessage || null, jobId).run()
  } catch (error) {
    console.error('Failed to log cleanup job completion:', error)
  }
}