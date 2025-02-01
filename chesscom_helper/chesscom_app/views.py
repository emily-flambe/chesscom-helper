from django.http import HttpResponse
from django.http import HttpResponse
from django.urls import reverse_lazy
from django.http import JsonResponse
from chesscom_app.models import User
from chesscom_app.common.chesscom_api import fetch_and_save_chesscom_user
import json


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

def add_chesscom_user(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = data.get("username")

            if not username:
                return JsonResponse({"error": "Username is required"}, status=400)

            result = fetch_and_save_chesscom_user(username)

            return JsonResponse(result, status=result.get("status", 500))

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON input"}, status=400)

    return JsonResponse({"error": "Only POST requests are allowed"}, status=405)