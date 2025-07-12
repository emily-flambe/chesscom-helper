import { generateSecureId } from '../utils/crypto'
import { createApiError } from '../middleware/errorHandler'
import { logNotificationSent } from './notificationService'
import { getUserById } from './userService'
import type { Env } from '../index'

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface NotificationEmailData {
  playerName: string
  gameUrl?: string | undefined
  result?: string | undefined
}

export interface EmailSendResult {
  notificationId: string
  delivered: boolean
  messageId?: string | undefined
  error?: string | undefined
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

    const result = await response.json() as any
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

function getBaseUrl(): string {
  // This would be configured based on environment
  return 'https://chesshelper.app'
}