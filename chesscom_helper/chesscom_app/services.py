from django.core.mail import send_mail
from django.conf import settings
from chesscom_app.models import EmailSubscription, NotificationLog
import logging

logger = logging.getLogger(__name__)


def send_live_match_notification(user, live_games):
    """Send email notification to all active subscribers when a player starts a live match."""
    
    active_subscriptions = EmailSubscription.objects.filter(
        player=user,
        is_active=True
    )
    
    if not active_subscriptions.exists():
        return {"message": f"No active subscriptions for {user.username}"}
    
    subject = f"🏆 {user.username} is now playing live on Chess.com!"
    
    game_details = []
    for game in live_games:
        time_control = game.get('time_control', 'Unknown')
        game_url = game.get('url', '#')
        game_details.append(f"- Time Control: {time_control}\n  Game URL: {game_url}")
    
    message = f"""
Hi!

{user.username} ({user.name or 'Chess.com Player'}) has started playing live matches on Chess.com!

Game Details:
{chr(10).join(game_details)}

You can watch the games live by visiting the URLs above.

---
This notification was sent because you subscribed to updates for {user.username}.
To unsubscribe, please contact the site administrator.
    """.strip()
    
    successful_sends = 0
    failed_sends = 0
    
    for subscription in active_subscriptions:
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[subscription.email],
                fail_silently=False,
            )
            
            NotificationLog.objects.create(
                subscription=subscription,
                notification_type='live_match',
                success=True
            )
            successful_sends += 1
            logger.info(f"Notification sent to {subscription.email} for {user.username}")
            
        except Exception as e:
            NotificationLog.objects.create(
                subscription=subscription,
                notification_type='live_match',
                success=False,
                error_message=str(e)
            )
            failed_sends += 1
            logger.error(f"Failed to send notification to {subscription.email}: {str(e)}")
    
    return {
        "message": f"Notifications processed for {user.username}",
        "successful_sends": successful_sends,
        "failed_sends": failed_sends,
        "total_subscriptions": active_subscriptions.count()
    }


def check_and_notify_all_users():
    """Check all users for live matches and send notifications for newly started matches."""
    
    from chesscom_app.models import User
    from chesscom_app.common.chesscom_api import update_player_status
    
    users = User.objects.all()
    notifications_sent = 0
    errors = []
    
    for user in users:
        try:
            status_result = update_player_status(user.username)
            
            if "error" in status_result:
                errors.append(status_result)
                continue
            
            # If player just started playing (status changed from not playing to playing)
            if (not status_result["was_playing"] and 
                status_result["is_now_playing"] and 
                status_result["status_changed"]):
                
                notification_result = send_live_match_notification(user, status_result["live_games"])
                notifications_sent += notification_result.get("successful_sends", 0)
                
        except Exception as e:
            errors.append({"error": f"Error processing {user.username}: {str(e)}", "username": user.username})
            logger.error(f"Error processing user {user.username}: {str(e)}")
    
    return {
        "message": "Batch check completed",
        "total_users_checked": users.count(),
        "notifications_sent": notifications_sent,
        "errors": errors
    }