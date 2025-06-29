import requests
from chesscom_app.models import User

CHESS_API_URL = "https://api.chess.com/pub/player/{username}"
CHESS_GAMES_URL = "https://api.chess.com/pub/player/{username}/games/to-move"
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
            "message": (
                f"New user '{username}' added."
                if created
                else f"User '{username}' updated."
            ),
            "user": user_data,
            "status": 201 if created else 200,
        }

    except Exception as e:
        return {"error": f"Error fetching player data: {str(e)}", "status": 500}


def check_player_live_games(username):
    """Check if a player has active games (live matches)."""

    url = CHESS_GAMES_URL.format(username=username.lower())

    try:
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        games_data = response.json()

        games = games_data.get("games", [])
        live_games = []

        for game in games:
            if game.get("move_by") and game.get("turn"):
                live_games.append(
                    {
                        "url": game.get("url"),
                        "turn": game.get("turn"),
                        "move_by": game.get("move_by"),
                        "time_control": game.get("time_control"),
                    }
                )

        return {
            "username": username,
            "is_playing": len(live_games) > 0,
            "live_games": live_games,
            "total_games": len(games),
        }

    except requests.exceptions.RequestException as e:
        return {
            "error": f"Error fetching games for {username}: {str(e)}",
            "username": username,
        }


def update_player_status(username):
    """Update a player's live game status in the database."""

    try:
        user = User.objects.get(username=username.lower())

        games_result = check_player_live_games(username)

        if "error" in games_result:
            return games_result

        was_playing = user.is_playing
        is_now_playing = games_result["is_playing"]

        user.is_playing = is_now_playing
        user.save()

        return {
            "username": username,
            "was_playing": was_playing,
            "is_now_playing": is_now_playing,
            "status_changed": was_playing != is_now_playing,
            "live_games": games_result["live_games"],
        }

    except User.DoesNotExist:
        return {"error": f"User {username} not found in database", "username": username}
