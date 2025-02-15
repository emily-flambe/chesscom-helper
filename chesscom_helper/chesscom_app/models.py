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

    def __str__(self):
        return f"{self.username} ({self.name})"