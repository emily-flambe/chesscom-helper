from django.http import HttpResponse
from django.shortcuts import render
from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.urls import reverse_lazy
from django.http import JsonResponse
from chesscom_app.models import User


def chesscom_app_home(request):

    html = "<html><body><div>Notify Me about things</div></body></html>"
    return HttpResponse(html)


def get_chesscom_user(request, username):
    try:
        # username should be lowercase
        username = username.lower()
        user = User.objects.get(username=username)
        data = {
            "player_id": user.player_id,
            "username": user.username,
            "name": user.name,
            "followers": user.followers,
            "country": user.country,
            "league": user.league,
            "last_online": user.last_online,
            "is_streamer": user.is_streamer,
        }
        return JsonResponse(data)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)


def get_chesscom_users(request):
    users = User.objects.all().values(
        "player_id", "username", "name", "followers", "league", "status", "last_online"
    )
    return JsonResponse(list(users), safe=False)
