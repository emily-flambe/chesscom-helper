import { generateSecureId } from '../utils/crypto'
import { createApiError } from '../middleware/errorHandler'
import { logNotificationSent, logDetailedNotification } from './notificationService'
import { getUserById } from './userService'
import type { Env } from '../index'

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface NotificationEmailData {
  playerName: string
  gameUrl?: string
  result?: string
}

export interface GameStartEmailData {
  playerName: string
  gameDetails: {
    timeControl: string
    rated: boolean
    gameType: string
    gameUrl: string
    startTime: Date
  }
  userPreferences: {
    unsubscribeUrl: string
    managePreferencesUrl: string
  }
  userName?: string
}

export interface EmailDeliveryOptions {
  retryAttempts?: number
  retryDelay?: number
  priority?: 'high' | 'normal' | 'low'
}

export interface EmailDeliveryResult {
  success: boolean
  messageId?: string
  error?: string
  retryCount?: number
  deliveredAt?: string
  failedAt?: string
}

export interface EmailRetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
}

export interface EmailSendResult {
  notificationId: string
  delivered: boolean
  messageId?: string
  error?: string
}

const DEFAULT_RETRY_CONFIG: EmailRetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2
}

const ENHANCED_EMAIL_TEMPLATES = {
  game_started: {
    subject: (data: GameStartEmailData) => 
      `🎯 ${data.playerName} started a ${data.gameDetails.timeControl} game!`,
    
    html: (data: GameStartEmailData) => `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data.playerName} started a new game</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #769656 0%, #6b8c49 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            padding: 30px 20px;
          }
          .game-details {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
          }
          .game-details h3 {
            margin: 0 0 15px 0;
            color: #2c3e50;
            font-size: 18px;
          }
          .detail-item {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .detail-item:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 500;
            color: #666;
          }
          .detail-value {
            color: #2c3e50;
            font-weight: 600;
          }
          .cta-button {
            display: inline-block;
            background: #769656;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            transition: background 0.3s;
          }
          .cta-button:hover {
            background: #6b8c49;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
          }
          .footer a {
            color: #769656;
            text-decoration: none;
          }
          .footer a:hover {
            text-decoration: underline;
          }
          .rated-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
          }
          .rated-yes {
            background: #e8f5e8;
            color: #2e7d32;
          }
          .rated-no {
            background: #fff3e0;
            color: #ef6c00;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 ${data.playerName} is playing!</h1>
          </div>
          
          <div class="content">
            <p>Hello${data.userName ? ` ${data.userName}` : ''}!</p>
            
            <p><strong>${data.playerName}</strong> just started a new game on Chess.com. 
            ${data.gameDetails.rated ? 'This is a rated game' : 'This is a casual game'} 
            - perfect timing to watch some live chess action!</p>
            
            <div class="game-details">
              <h3>Game Details</h3>
              <div class="detail-item">
                <span class="detail-label">Time Control:</span>
                <span class="detail-value">${data.gameDetails.timeControl}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Game Type:</span>
                <span class="detail-value">${data.gameDetails.gameType}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Rated:</span>
                <span class="detail-value">
                  <span class="rated-badge ${data.gameDetails.rated ? 'rated-yes' : 'rated-no'}">
                    ${data.gameDetails.rated ? 'Yes' : 'No'}
                  </span>
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Started:</span>
                <span class="detail-value">${formatTimeAgo(data.gameDetails.startTime)}</span>
              </div>
            </div>
            
            <div style="text-align: center;">
              <a href="${data.gameDetails.gameUrl}" class="cta-button">
                🏁 Watch Live Game
              </a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              Don't want to miss any of ${data.playerName}'s games? 
              Make sure notifications are enabled in your 
              <a href="${data.userPreferences.managePreferencesUrl}" style="color: #769656;">preferences</a>.
            </p>
          </div>
          
          <div class="footer">
            <p>This notification was sent by Chess.com Helper</p>
            <p>
              <a href="${data.userPreferences.managePreferencesUrl}">Manage Preferences</a> • 
              <a href="${data.userPreferences.unsubscribeUrl}">Unsubscribe from ${data.playerName}</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    
    text: (data: GameStartEmailData) => `
🎯 ${data.playerName} is playing!

Hello${data.userName ? ` ${data.userName}` : ''}!

${data.playerName} just started a new game on Chess.com.

Game Details:
- Time Control: ${data.gameDetails.timeControl}
- Game Type: ${data.gameDetails.gameType}
- Rated: ${data.gameDetails.rated ? 'Yes' : 'No'}
- Started: ${formatTimeAgo(data.gameDetails.startTime)}

Watch the game live: ${data.gameDetails.gameUrl}

Don't want to miss any of ${data.playerName}'s games? 
Manage your preferences: ${data.userPreferences.managePreferencesUrl}

---
This notification was sent by Chess.com Helper
Manage Preferences: ${data.userPreferences.managePreferencesUrl}
Unsubscribe from ${data.playerName}: ${data.userPreferences.unsubscribeUrl}
    `
  }
}

const EMAIL_TEMPLATES = {
  game_started: {
    subject: (playerName: string) => `🎯 ${playerName} is now playing on Chess.com!`,
    html: (data: NotificationEmailData) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2e7d32;">♟️ Game Alert</h2>
        <p><strong>${data.playerName}</strong> just started a new game on Chess.com!</p>
        ${data.gameUrl ? `
          <p>
            <a href="${data.gameUrl}" 
               style="background: #2e7d32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Watch Live Game
            </a>
          </p>
        ` : ''}
        <hr style="margin: 20px 0; border: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          This notification was sent by Chess.com Helper.<br>
          <a href="{{unsubscribeUrl}}">Unsubscribe from ${data.playerName}</a> | 
          <a href="{{settingsUrl}}">Manage all subscriptions</a>
        </p>
      </div>
    `,
    text: (data: NotificationEmailData) => `
♟️ Game Alert

${data.playerName} just started a new game on Chess.com!

${data.gameUrl ? `Watch the game live: ${data.gameUrl}` : ''}

---
This notification was sent by Chess.com Helper.
Manage your subscriptions: {{settingsUrl}}
    `
  },
  game_ended: {
    subject: (playerName: string) => `♟️ ${playerName}'s game has ended`,
    html: (data: NotificationEmailData) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">♟️ Game Complete</h2>
        <p><strong>${data.playerName}</strong>'s game on Chess.com has finished.</p>
        ${data.result ? `<p><strong>Result:</strong> ${data.result}</p>` : ''}
        <hr style="margin: 20px 0; border: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          This notification was sent by Chess.com Helper.<br>
          <a href="{{unsubscribeUrl}}">Unsubscribe from ${data.playerName}</a> | 
          <a href="{{settingsUrl}}">Manage all subscriptions</a>
        </p>
      </div>
    `,
    text: (data: NotificationEmailData) => `
♟️ Game Complete

${data.playerName}'s game on Chess.com has finished.
${data.result ? `Result: ${data.result}` : ''}

---
This notification was sent by Chess.com Helper.
Manage your subscriptions: {{settingsUrl}}
    `
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return 'Just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
}

export async function sendNotificationEmail(
  env: Env, 
  userId: string, 
  type: 'game_started' | 'game_ended', 
  data: NotificationEmailData
): Promise<EmailSendResult> {
  const notificationId = await generateSecureId()

  try {
    const user = await getUserById(env.DB, userId)
    if (!user) {
      throw createApiError('User not found', 404, 'USER_NOT_FOUND')
    }

    const template = EMAIL_TEMPLATES[type]
    const subject = template.subject(data.playerName)
    const html = template.html(data)
      .replace('{{settingsUrl}}', `${getBaseUrl()}/settings`)
      .replace('{{unsubscribeUrl}}', `${getBaseUrl()}/unsubscribe/${userId}/${data.playerName}`)
    const text = template.text(data)
      .replace('{{settingsUrl}}', `${getBaseUrl()}/settings`)
      .replace('{{unsubscribeUrl}}', `${getBaseUrl()}/unsubscribe/${userId}/${data.playerName}`)

    const emailResult = await sendEmail({
      to: user.email,
      subject,
      html,
      text
    }, env)

    await logNotificationSent(env.DB, {
      userId,
      chessComUsername: data.playerName,
      notificationType: type,
      emailDelivered: emailResult.success
    })

    return {
      notificationId,
      delivered: emailResult.success,
      messageId: emailResult.messageId,
      error: emailResult.error
    }
  } catch (error) {
    console.error('Send notification email error:', error)

    await logNotificationSent(env.DB, {
      userId,
      chessComUsername: data.playerName,
      notificationType: type,
      emailDelivered: false
    }).catch(logError => console.error('Failed to log notification failure:', logError))

    return {
      notificationId,
      delivered: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function sendEmail(email: {
  to: string
  subject: string
  html: string
  text: string
}, env: Env): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Using Resend API
    if (env.RESEND_API_KEY) {
      return await sendWithResend(email, env.RESEND_API_KEY)
    }

    // Fallback or other email service
    throw createApiError('No email service configured', 500, 'EMAIL_SERVICE_NOT_CONFIGURED')
  } catch (error) {
    console.error('Send email error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email send failed'
    }
  }
}

async function sendWithResend(email: {
  to: string
  subject: string
  html: string
  text: string
}, apiKey: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Chess.com Helper <notifications@chesshelper.app>',
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw createApiError(
        `Resend API error: ${response.status}`, 
        502, 
        'EMAIL_SERVICE_ERROR',
        errorData
      )
    }

    const result = await response.json()
    return {
      success: true,
      messageId: result.id
    }
  } catch (error) {
    console.error('Resend email error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Resend API failed'
    }
  }
}

/**
 * Enhanced email sending with retry logic and detailed tracking
 */
export async function sendNotificationEmailWithRetry(
  env: Env,
  userId: string,
  type: 'game_started' | 'game_ended',
  data: GameStartEmailData,
  options: EmailDeliveryOptions = {}
): Promise<EmailDeliveryResult> {
  const config = { ...DEFAULT_RETRY_CONFIG }
  const maxRetries = options.retryAttempts || config.maxRetries
  
  let lastError: Error | null = null
  let retryCount = 0
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendEnhancedNotificationEmail(env, userId, type, data)
      
      if (result.delivered) {
        return {
          success: true,
          messageId: result.messageId,
          retryCount: attempt,
          deliveredAt: new Date().toISOString()
        }
      }
      
      // If not delivered but no error, treat as failure
      lastError = new Error(result.error || 'Email delivery failed')
      
    } catch (error) {
      lastError = error as Error
      console.error(`Email delivery attempt ${attempt + 1} failed:`, error)
    }
    
    // Don't wait after the last attempt
    if (attempt < maxRetries) {
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelay
      )
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    retryCount++
  }
  
  return {
    success: false,
    error: lastError?.message || 'Email delivery failed after all retries',
    retryCount,
    failedAt: new Date().toISOString()
  }
}

/**
 * Enhanced notification email sending with detailed logging
 */
async function sendEnhancedNotificationEmail(
  env: Env,
  userId: string,
  type: 'game_started' | 'game_ended',
  data: GameStartEmailData
): Promise<EmailSendResult> {
  const notificationId = await generateSecureId()
  
  try {
    const user = await getUserById(env.DB, userId)
    if (!user) {
      throw createApiError('User not found', 404, 'USER_NOT_FOUND')
    }
    
    const template = ENHANCED_EMAIL_TEMPLATES[type]
    const subject = template.subject(data)
    const html = template.html(data)
    const text = template.text(data)
    
    const emailResult = await sendEmailWithProvider({
      to: user.email,
      subject,
      html,
      text
    }, env)
    
    // Log the detailed notification
    await logDetailedNotification(env.DB, {
      userId,
      chessComUsername: data.playerName,
      notificationType: type,
      gameDetails: data.gameDetails,
      emailDelivered: emailResult.success,
      deliveredAt: emailResult.success ? new Date().toISOString() : undefined,
      failedAt: !emailResult.success ? new Date().toISOString() : undefined,
      failureReason: emailResult.error,
      emailProviderMessageId: emailResult.messageId
    })
    
    return {
      notificationId,
      delivered: emailResult.success,
      messageId: emailResult.messageId,
      error: emailResult.error
    }
    
  } catch (error) {
    console.error('Enhanced notification email error:', error)
    
    // Log the failure
    await logDetailedNotification(env.DB, {
      userId,
      chessComUsername: data.playerName,
      notificationType: type,
      emailDelivered: false,
      failedAt: new Date().toISOString(),
      failureReason: error instanceof Error ? error.message : 'Unknown error'
    }).catch(logError => console.error('Failed to log notification failure:', logError))
    
    return {
      notificationId,
      delivered: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Enhanced email provider abstraction with improved error handling
 */
async function sendEmailWithProvider(
  email: {
    to: string
    subject: string
    html: string
    text: string
  },
  env: Env
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (env.RESEND_API_KEY) {
      return await sendWithResendEnhanced(email, env.RESEND_API_KEY)
    }
    
    throw createApiError('No email service configured', 500, 'EMAIL_SERVICE_NOT_CONFIGURED')
    
  } catch (error) {
    console.error('Email provider error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email service failed'
    }
  }
}

/**
 * Enhanced Resend API integration with better error handling
 */
async function sendWithResendEnhanced(
  email: {
    to: string
    subject: string
    html: string
    text: string
  },
  apiKey: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Chess.com Helper <notifications@chesshelper.app>',
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        tags: [
          { name: 'type', value: 'game_notification' },
          { name: 'source', value: 'chesscom_helper' }
        ]
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      
      // Handle specific Resend errors
      if (response.status === 429) {
        throw createApiError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED')
      } else if (response.status === 400) {
        throw createApiError('Invalid email data', 400, 'INVALID_EMAIL_DATA', errorData)
      } else if (response.status === 401) {
        throw createApiError('Invalid API key', 401, 'INVALID_API_KEY')
      }
      
      throw createApiError(
        `Resend API error: ${response.status}`,
        response.status,
        'EMAIL_SERVICE_ERROR',
        errorData
      )
    }
    
    const result = await response.json() as any
    return {
      success: true,
      messageId: result.id
    }
    
  } catch (error) {
    console.error('Resend API error:', error)
    
    // Return specific error information
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message
      }
    }
    
    return {
      success: false,
      error: 'Resend API failed'
    }
  }
}

function getBaseUrl(): string {
  // This would be configured based on environment
  return 'https://chesshelper.app'
}