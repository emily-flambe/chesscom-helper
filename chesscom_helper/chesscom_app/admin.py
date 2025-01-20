from django.contrib import admin
from chesscom_app.models import Dummy, User

class DummyAdmin(admin.ModelAdmin):
    pass

class UserAdmin(admin.ModelAdmin):
    pass


admin.site.register(Dummy, DummyAdmin)
admin.site.register(User, UserAdmin)