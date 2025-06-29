from django.http import HttpResponse
from django.http import HttpResponse
from django.urls import reverse_lazy
from django.http import JsonResponse
from chesscom_app.models import User, EmailSubscription, NotificationLog
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


def refresh_all_chesscom_users(request):
    users = User.objects.all()
    for user in users:
        fetch_and_save_chesscom_user(user.username)
    return JsonResponse({"message": "All users refreshed"}, status=200)


def remove_chesscom_user(request, username):
    try:
        user = User.objects.get(username=username)
        user.delete()
        return JsonResponse({"message": "User removed"}, status=200)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)


def subscribe_to_notifications(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email")
            username = data.get("username")

            if not email or not username:
                return JsonResponse(
                    {"error": "Email and username are required"}, status=400
                )

            try:
                player = User.objects.get(username=username.lower())
            except User.DoesNotExist:
                return JsonResponse({"error": "Player not found"}, status=404)

            subscription, created = EmailSubscription.objects.get_or_create(
                email=email, player=player, defaults={"is_active": True}
            )

            if not created and not subscription.is_active:
                subscription.is_active = True
                subscription.save()

            message = "Subscription created" if created else "Subscription reactivated"
            return JsonResponse(
                {"message": message, "subscription_id": subscription.id},
                status=201 if created else 200,
            )

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON input"}, status=400)

    return JsonResponse({"error": "Only POST requests are allowed"}, status=405)


def unsubscribe_from_notifications(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data.get("email")
            username = data.get("username")

            if not email or not username:
                return JsonResponse(
                    {"error": "Email and username are required"}, status=400
                )

            try:
                subscription = EmailSubscription.objects.get(
                    email=email, player__username=username.lower()
                )
                subscription.is_active = False
                subscription.save()
                return JsonResponse(
                    {"message": "Unsubscribed successfully"}, status=200
                )
            except EmailSubscription.DoesNotExist:
                return JsonResponse({"error": "Subscription not found"}, status=404)

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON input"}, status=400)

    return JsonResponse({"error": "Only POST requests are allowed"}, status=405)


def get_user_subscriptions(request, username):
    try:
        user = User.objects.get(username=username.lower())
        subscriptions = EmailSubscription.objects.filter(
            player=user, is_active=True
        ).values("email", "created_at")
        return JsonResponse(list(subscriptions), safe=False)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)
