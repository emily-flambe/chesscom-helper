from django.contrib import admin
from notify_me.models import Dummy


class DummyAdmin(admin.ModelAdmin):
    pass


admin.site.register(Dummy, DummyAdmin)
