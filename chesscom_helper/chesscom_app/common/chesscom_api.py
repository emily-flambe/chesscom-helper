import requests
from chesscom_app.models import User

CHESS_API_URL = "https://api.chess.com/pub/player/{username}"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

def fetch_and_save_chesscom_user(username):
    """Fetch user data from Chess.com and upsert it into the database."""

    url = CHESS_API_URL.format(username=username.lower())
    
    try:
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        chess_data = response.json()
        
        user_data = {
            "player_id": chess_data.get("player_id"),
            "url": chess_data.get("url"),
            "name": chess_data.get("name"),
            "username": chess_data.get("username").lower(),
            "followers": chess_data.get("followers", 0),
            "country": chess_data.get("country"),
            "location": chess_data.get("location"),
            "last_online": chess_data.get("last_online"),
            "joined": chess_data.get("joined"),
            "status": chess_data.get("status"),
            "is_streamer": chess_data.get("is_streamer", False),
            "verified": chess_data.get("verified", False),
            "league": chess_data.get("league"),
            "streaming_platforms": chess_data.get("streaming_platforms", []),
        }

        user, created = User.objects.update_or_create(
            player_id=user_data["player_id"], defaults=user_data
        )

        return {
            "message": f"New user '{username}' added." if created else f"User '{username}' updated.",
            "user": user_data,
            "status": 201 if created else 200
        }

    except requests.exceptions.RequestException as e:
        return {
            "error": f"Error fetching player data: {str(e)}",
            "status": 500
        }
