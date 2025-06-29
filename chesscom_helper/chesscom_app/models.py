# chesscom_app/models.py
from django.db import models
from django.conf import settings


class User(models.Model):
    player_id = models.BigIntegerField(primary_key=True, unique=True)  # Primary key
    url = models.URLField()
    name = models.CharField(max_length=255, null=True, blank=True)
    username = models.CharField(max_length=150, unique=True)
    followers = models.IntegerField(default=0)
    country = models.URLField(null=True, blank=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    last_online = models.BigIntegerField()
    joined = models.BigIntegerField()
    status = models.CharField(max_length=50)
    is_streamer = models.BooleanField(default=False)
    verified = models.BooleanField(default=False)
    league = models.CharField(max_length=50, null=True, blank=True)
    streaming_platforms = models.JSONField(default=list, blank=True)
    is_playing = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.username} ({self.name})"


class EmailSubscription(models.Model):
    email = models.EmailField()
    player = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="subscriptions"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("email", "player")

    def __str__(self):
        return f"{self.email} -> {self.player.username}"


class NotificationLog(models.Model):
    subscription = models.ForeignKey(EmailSubscription, on_delete=models.CASCADE)
    sent_at = models.DateTimeField(auto_now_add=True)
    notification_type = models.CharField(max_length=50, default="live_match")
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.subscription.email} - {self.notification_type} at {self.sent_at}"
