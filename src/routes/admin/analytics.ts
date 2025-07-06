import { Router, json, error } from 'itty-router'
import { authenticateUser } from '../../middleware/auth'
import { createNotificationAuditService } from '../../services/notificationAuditService'
import type { Env } from '../../index'

const router = Router({ base: '/api/v1/admin/analytics' })

// Admin authentication middleware
async function requireAdmin(request: Request, env: Env): Promise<Response | void> {
  const authResult = await authenticateUser(request, env)
  if (authResult instanceof Response) {
    return authResult
  }

  // In production, check if user has admin role
  console.log(`Admin analytics access by user: ${request.user?.id}`)
}

// Email delivery overview
router.get('/overview', requireAdmin, async (request: Request, env: Env) => {
  try {
    const url = new URL(request.url)
    const period = url.searchParams.get('period') as 'day' | 'week' | 'month' || 'week'
    const fromDate = url.searchParams.get('fromDate')
    const toDate = url.searchParams.get('toDate')

    const auditService = createNotificationAuditService(env.DB)

    // Get delivery success rate
    const deliveryStats = await auditService.getDeliverySuccessRate({
      period,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined
    })

    // Get additional metrics
    const [templateStats, userStats, timeStats] = await Promise.all([
      getTemplateStatistics(env.DB, period, fromDate, toDate),
      getUserStatistics(env.DB, period, fromDate, toDate),
      getTimeBasedStatistics(env.DB, period, fromDate, toDate)
    ])

    return json({
      deliveryStats,
      templateStats,
      userStats,
      timeStats,
      period,
      dateRange: {
        from: fromDate || getDateByPeriod(period),
        to: toDate || new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Failed to get analytics overview:', err)
    return error(500, 'Failed to retrieve analytics overview')
  }
})

// Email delivery trends (hourly/daily breakdown)
router.get('/trends', requireAdmin, async (request: Request, env: Env) => {
  try {
    const url = new URL(request.url)
    const period = url.searchParams.get('period') as 'hour' | 'day' | 'week' || 'day'
    const days = parseInt(url.searchParams.get('days') || '7')

    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)
    const fromDateIso = fromDate.toISOString()
    const toDateIso = new Date().toISOString()

    let groupFormat: string
    let orderBy: string

    switch (period) {
      case 'hour':
        groupFormat = "strftime('%Y-%m-%d %H:00', created_at)"
        orderBy = "datetime(created_at)"
        break
      case 'day':
        groupFormat = "strftime('%Y-%m-%d', created_at)"
        orderBy = "date(created_at)"
        break
      case 'week':
        groupFormat = "strftime('%Y-W%W', created_at)"
        orderBy = "strftime('%Y-%W', created_at)"
        break
      default:
        groupFormat = "strftime('%Y-%m-%d', created_at)"
        orderBy = "date(created_at)"
    }

    const trendsQuery = `
      SELECT 
        ${groupFormat} as time_period,
        COUNT(*) as total_emails,
        SUM(CASE WHEN notification_type = 'email_sent' THEN 1 ELSE 0 END) as emails_sent,
        SUM(CASE WHEN notification_type = 'email_delivered' THEN 1 ELSE 0 END) as emails_delivered,
        SUM(CASE WHEN notification_type = 'email_bounced' THEN 1 ELSE 0 END) as emails_bounced,
        SUM(CASE WHEN notification_type = 'email_complained' THEN 1 ELSE 0 END) as emails_complained,
        SUM(CASE WHEN notification_type = 'email_failed' THEN 1 ELSE 0 END) as emails_failed,
        AVG(processing_time) as avg_processing_time
      FROM notification_audit
      WHERE created_at >= ? AND created_at <= ?
      AND notification_type IN ('email_sent', 'email_delivered', 'email_bounced', 'email_complained', 'email_failed')
      GROUP BY ${groupFormat}
      ORDER BY ${orderBy}
    `

    const result = await env.DB.prepare(trendsQuery).bind(fromDateIso, toDateIso).all()

    const trends = result.results?.map(row => ({
      timePeriod: row.time_period,
      totalEmails: row.total_emails || 0,
      emailsSent: row.emails_sent || 0,
      emailsDelivered: row.emails_delivered || 0,
      emailsBounced: row.emails_bounced || 0,
      emailsComplained: row.emails_complained || 0,
      emailsFailed: row.emails_failed || 0,
      averageProcessingTime: row.avg_processing_time || 0,
      successRate: row.total_emails > 0 ? ((row.emails_delivered || 0) / (row.total_emails || 1)) * 100 : 0
    })) || []

    return json({
      trends,
      period,
      days,
      dateRange: {
        from: fromDateIso,
        to: toDateIso
      },
      summary: {
        totalPeriods: trends.length,
        totalEmails: trends.reduce((sum, t) => sum + t.totalEmails, 0),
        averageSuccessRate: trends.length > 0 ? trends.reduce((sum, t) => sum + t.successRate, 0) / trends.length : 0
      },
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Failed to get analytics trends:', err)
    return error(500, 'Failed to retrieve analytics trends')
  }
})

// User-specific email metrics
router.get('/users', requireAdmin, async (request: Request, env: Env) => {
  try {
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const sortBy = url.searchParams.get('sortBy') || 'totalEmails'
    const sortOrder = url.searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc'

    const auditService = createNotificationAuditService(env.DB)

    // Get list of users with email activity
    const usersQuery = `
      SELECT DISTINCT user_id
      FROM notification_audit
      WHERE notification_type IN ('email_sent', 'email_delivered', 'email_bounced', 'email_complained', 'email_failed')
      ORDER BY user_id
      LIMIT ? OFFSET ?
    `

    const usersResult = await env.DB.prepare(usersQuery).bind(limit, offset).all()
    const userIds = usersResult.results?.map(row => row.user_id as string) || []

    // Get metrics for each user
    const userMetrics = await Promise.all(
      userIds.map(userId => auditService.getUserEmailMetrics(userId))
    )

    // Sort by requested field
    userMetrics.sort((a, b) => {
      let aVal: number
      let bVal: number

      switch (sortBy) {
        case 'totalEmails':
          aVal = a.totalEmailsSent
          bVal = b.totalEmailsSent
          break
        case 'successRate':
          aVal = a.successRate
          bVal = b.successRate
          break
        case 'bounces':
          aVal = a.bounces
          bVal = b.bounces
          break
        case 'complaints':
          aVal = a.complaints
          bVal = b.complaints
          break
        default:
          aVal = a.totalEmailsSent
          bVal = b.totalEmailsSent
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
    })

    // Get total count for pagination
    const totalCountResult = await env.DB.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM notification_audit
      WHERE notification_type IN ('email_sent', 'email_delivered', 'email_bounced', 'email_complained', 'email_failed')
    `).first()

    return json({
      users: userMetrics,
      pagination: {
        total: totalCountResult?.count || 0,
        limit,
        offset,
        hasMore: offset + userMetrics.length < (totalCountResult?.count || 0)
      },
      sorting: {
        sortBy,
        sortOrder
      },
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Failed to get user analytics:', err)
    return error(500, 'Failed to retrieve user analytics')
  }
})

// Template performance analytics
router.get('/templates', requireAdmin, async (request: Request, env: Env) => {
  try {
    const url = new URL(request.url)
    const period = url.searchParams.get('period') as 'day' | 'week' | 'month' || 'month'
    const fromDate = url.searchParams.get('fromDate')
    const toDate = url.searchParams.get('toDate')

    const templateStats = await getTemplateStatistics(env.DB, period, fromDate, toDate)

    return json({
      templates: templateStats,
      period,
      dateRange: {
        from: fromDate || getDateByPeriod(period),
        to: toDate || new Date().toISOString()
      },
      summary: {
        totalTemplates: templateStats.length,
        totalEmails: templateStats.reduce((sum, t) => sum + t.totalEmails, 0),
        averageSuccessRate: templateStats.length > 0 
          ? templateStats.reduce((sum, t) => sum + t.successRate, 0) / templateStats.length 
          : 0
      },
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Failed to get template analytics:', err)
    return error(500, 'Failed to retrieve template analytics')
  }
})

// System health and performance metrics
router.get('/system', requireAdmin, async (request: Request, env: Env) => {
  try {
    const [queueStats, processingStats, errorStats] = await Promise.all([
      getSystemQueueStats(env.DB),
      getSystemProcessingStats(env.DB),
      getSystemErrorStats(env.DB)
    ])

    return json({
      queue: queueStats,
      processing: processingStats,
      errors: errorStats,
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Failed to get system analytics:', err)
    return error(500, 'Failed to retrieve system analytics')
  }
})

// Helper functions

async function getTemplateStatistics(
  db: D1Database, 
  period: string, 
  fromDate?: string | null, 
  toDate?: string | null
) {
  const from = fromDate || getDateByPeriod(period)
  const to = toDate || new Date().toISOString()

  const query = `
    SELECT 
      template_type,
      COUNT(*) as total_emails,
      SUM(CASE WHEN notification_type = 'email_delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN notification_type = 'email_bounced' THEN 1 ELSE 0 END) as bounced,
      SUM(CASE WHEN notification_type = 'email_complained' THEN 1 ELSE 0 END) as complained,
      SUM(CASE WHEN notification_type = 'email_failed' THEN 1 ELSE 0 END) as failed,
      AVG(processing_time) as avg_processing_time
    FROM notification_audit
    WHERE template_type IS NOT NULL
    AND created_at >= ? AND created_at <= ?
    AND notification_type IN ('email_sent', 'email_delivered', 'email_bounced', 'email_complained', 'email_failed')
    GROUP BY template_type
    ORDER BY total_emails DESC
  `

  const result = await db.prepare(query).bind(from, to).all()

  return result.results?.map(row => ({
    templateType: row.template_type,
    totalEmails: row.total_emails || 0,
    delivered: row.delivered || 0,
    bounced: row.bounced || 0,
    complained: row.complained || 0,
    failed: row.failed || 0,
    averageProcessingTime: row.avg_processing_time || 0,
    successRate: row.total_emails > 0 ? ((row.delivered || 0) / (row.total_emails || 1)) * 100 : 0
  })) || []
}

async function getUserStatistics(
  db: D1Database,
  period: string,
  fromDate?: string | null,
  toDate?: string | null
) {
  const from = fromDate || getDateByPeriod(period)
  const to = toDate || new Date().toISOString()

  const query = `
    SELECT 
      COUNT(DISTINCT user_id) as total_users,
      COUNT(DISTINCT email_address) as total_email_addresses,
      COUNT(*) as total_notifications,
      AVG(CASE WHEN notification_type = 'email_delivered' THEN 1.0 ELSE 0.0 END) * 100 as avg_user_success_rate
    FROM notification_audit
    WHERE created_at >= ? AND created_at <= ?
    AND notification_type IN ('email_sent', 'email_delivered', 'email_bounced', 'email_complained', 'email_failed')
  `

  const result = await db.prepare(query).bind(from, to).first()

  return {
    totalUsers: result?.total_users || 0,
    totalEmailAddresses: result?.total_email_addresses || 0,
    totalNotifications: result?.total_notifications || 0,
    averageUserSuccessRate: result?.avg_user_success_rate || 0
  }
}

async function getTimeBasedStatistics(
  db: D1Database,
  period: string,
  fromDate?: string | null,
  toDate?: string | null
) {
  const from = fromDate || getDateByPeriod(period)
  const to = toDate || new Date().toISOString()

  const query = `
    SELECT 
      MIN(processing_time) as min_processing_time,
      MAX(processing_time) as max_processing_time,
      AVG(processing_time) as avg_processing_time,
      COUNT(CASE WHEN processing_time > 30000 THEN 1 END) as slow_emails,
      COUNT(*) as total_processed_emails
    FROM notification_audit
    WHERE processing_time IS NOT NULL
    AND created_at >= ? AND created_at <= ?
    AND notification_type IN ('email_sent', 'email_delivered')
  `

  const result = await db.prepare(query).bind(from, to).first()

  return {
    minProcessingTime: result?.min_processing_time || 0,
    maxProcessingTime: result?.max_processing_time || 0,
    averageProcessingTime: result?.avg_processing_time || 0,
    slowEmails: result?.slow_emails || 0,
    totalProcessedEmails: result?.total_processed_emails || 0,
    slowEmailPercentage: result?.total_processed_emails > 0 
      ? ((result?.slow_emails || 0) / (result?.total_processed_emails || 1)) * 100 
      : 0
  }
}

async function getSystemQueueStats(db: D1Database) {
  const query = `
    SELECT 
      status,
      COUNT(*) as count,
      AVG(retry_count) as avg_retry_count,
      MAX(retry_count) as max_retry_count
    FROM email_queue
    GROUP BY status
  `

  const result = await db.prepare(query).all()
  const statusCounts = result.results?.reduce((acc: any, row) => {
    acc[row.status as string] = {
      count: row.count,
      avgRetryCount: row.avg_retry_count || 0,
      maxRetryCount: row.max_retry_count || 0
    }
    return acc
  }, {}) || {}

  return statusCounts
}

async function getSystemProcessingStats(db: D1Database) {
  const query = `
    SELECT 
      AVG(
        CASE WHEN sent_at IS NOT NULL AND first_attempted_at IS NOT NULL 
        THEN (julianday(sent_at) - julianday(first_attempted_at)) * 86400000 
        END
      ) as avg_queue_processing_time,
      COUNT(CASE WHEN status = 'processing' THEN 1 END) as currently_processing,
      COUNT(CASE WHEN created_at >= datetime('now', '-1 hour') THEN 1 END) as queued_last_hour
    FROM email_queue
  `

  const result = await db.prepare(query).first()

  return {
    averageQueueProcessingTime: result?.avg_queue_processing_time || 0,
    currentlyProcessing: result?.currently_processing || 0,
    queuedLastHour: result?.queued_last_hour || 0
  }
}

async function getSystemErrorStats(db: D1Database) {
  const query = `
    SELECT 
      error_code,
      COUNT(*) as count,
      MAX(created_at) as last_occurrence
    FROM notification_audit
    WHERE notification_type IN ('email_bounced', 'email_failed')
    AND created_at >= datetime('now', '-7 days')
    GROUP BY error_code
    ORDER BY count DESC
    LIMIT 10
  `

  const result = await db.prepare(query).all()

  return result.results?.map(row => ({
    errorCode: row.error_code,
    count: row.count,
    lastOccurrence: row.last_occurrence
  })) || []
}

function getDateByPeriod(period: string): string {
  const now = new Date()
  switch (period) {
    case 'day':
      now.setDate(now.getDate() - 1)
      break
    case 'week':
      now.setDate(now.getDate() - 7)
      break
    case 'month':
      now.setMonth(now.getMonth() - 1)
      break
  }
  return now.toISOString()
}

export { router as analyticsAdminRoutes }