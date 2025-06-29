import { DatabaseService } from './database';

export async function sendNotifications(env, notifications) {
  const results = [];
  
  for (const notification of notifications) {
    try {
      await sendEmail(env, notification);
      await logNotification(env, notification, 'sent');
      results.push({ ...notification, status: 'sent' });
    } catch (error) {
      await logNotification(env, notification, 'failed', error.message);
      results.push({ ...notification, status: 'failed', error: error.message });
    }
  }
  
  return results;
}

async function sendEmail(env, { email, username }) {
  const emailData = {
    personalizations: [{
      to: [{ email }],
      subject: `🔴 ${username} is playing live on Chess.com!`
    }],
    from: { 
      email: env.EMAIL_FROM_ADDRESS, 
      name: 'Chess.com Helper' 
    },
    content: [{
      type: 'text/html',
      value: generateEmailHTML(username)
    }]
  };

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.EMAIL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailData)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Email failed: ${response.status} ${error}`);
  }
}

function generateEmailHTML(username) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Live Match Notification</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #4CAF50;
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 5px;
        }
        .content {
          padding: 20px;
          background-color: #f4f4f4;
          margin-top: 20px;
          border-radius: 5px;
        }
        .button {
          display: inline-block;
          background-color: #4CAF50;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          margin-top: 10px;
        }
        .footer {
          margin-top: 20px;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🔴 Live Match Alert!</h1>
      </div>
      <div class="content">
        <h2>${username} is playing live on Chess.com!</h2>
        <p>Great news! ${username} has just started a live game on Chess.com.</p>
        <p>Click below to watch their game:</p>
        <a href="https://www.chess.com/member/${username}" class="button">Watch Live Game</a>
      </div>
      <div class="footer">
        <p>You're receiving this email because you subscribed to notifications for ${username}.</p>
        <p>To manage your subscriptions, visit Chess.com Helper.</p>
      </div>
    </body>
    </html>
  `;
}

async function logNotification(env, notification, status, error = null) {
  const db = new DatabaseService(env.DATABASE_URL);
  try {
    await db.logNotification({
      subscription_id: notification.subscriptionId,
      username: notification.username,
      email: notification.email,
      status: status,
      error: error,
      sent_at: new Date().toISOString()
    });
  } finally {
    await db.close();
  }
}