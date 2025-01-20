# notify_me/models.py
from django.db import models

class Dummy(models.Model):

    id = models.TextField(primary_key=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    text = models.TextField()

    class Meta:
        verbose_name = "Dummy"
        verbose_name_plural = "Dumdums"
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.id} - {self.created_at}"
