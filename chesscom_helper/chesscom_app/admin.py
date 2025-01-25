from django.contrib import admin
from chesscom_app.models import User


class UserAdmin(admin.ModelAdmin):
    list_display = (
        "username",
        "name",
        "followers",
        "country",
        "location",
        "last_online",
        "joined",
        "status",
        "is_streamer",
        "verified",
        "league",
        "streaming_platforms",
    )
    search_fields = ("username", "name", "location")
    list_filter = ("is_streamer", "verified", "league")
    ordering = ("-last_online",)


admin.site.register(User, UserAdmin)
