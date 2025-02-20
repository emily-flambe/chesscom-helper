"""
URL configuration for chesscom_app project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.urls import path
from chesscom_app.views import (
    chesscom_app_home,
    get_chesscom_user,
    get_chesscom_users,
    add_chesscom_user,
    refresh_all_chesscom_users,
    remove_chesscom_user,
)

urlpatterns = [
    path("", chesscom_app_home, name="chesscom_app_home"),
    path("user/<str:username>/", get_chesscom_user, name="get_chesscom_user"),
    path("users/", get_chesscom_users, name="get_chesscom_users"),
    path("add-user/", add_chesscom_user, name="add_chesscom_user"),
    path(
        "refresh-all-users/",
        refresh_all_chesscom_users,
        name="refresh_all_chesscom_users",
    ),
    path(
        "remove-user/<str:username>/", remove_chesscom_user, name="remove_chesscom_user"
    ),
]
