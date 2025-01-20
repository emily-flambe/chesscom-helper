from django.http import HttpResponse
from django.shortcuts import render
from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.urls import reverse_lazy
import requests
from django.http import JsonResponse


def chesscom_app_home(request):

    html = "<html><body><div>Notify Me about things</div></body></html>"
    return HttpResponse(html)


CHESS_API_URL = "https://api.chess.com/pub/player/{username}"

def get_chesscom_profile(request, username):
    """
    View to fetch and display Chess.com player profile.
    """
    url = CHESS_API_URL.format(username=username)

    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        # Send JSON response to frontend
        return JsonResponse({
            "username": data.get("username", "N/A"),
            "name": data.get("name", "N/A"),
            "title": data.get("title", "N/A"),
            "country": data.get("country", "N/A"),
            "joined": data.get("joined", "N/A"),
            "avatar": data.get("avatar", None),
        })
    except requests.exceptions.RequestException as e:
        return JsonResponse({"error": f"Failed to fetch data: {str(e)}"}, status=500)
