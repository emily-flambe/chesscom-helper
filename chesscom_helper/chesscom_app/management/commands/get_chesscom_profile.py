import requests
from django.core.management.base import BaseCommand
from chesscom_app.models import User

CHESS_API_URL = "https://api.chess.com/pub/player/{username}"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}


class Command(BaseCommand):
    help = "Fetches and upserts a Chess.com player's profile"

    def add_arguments(self, parser):
        parser.add_argument("username", type=str, help="Chess.com username to fetch")

    def handle(self, *args, **options):
        username = options["username"]
        url = CHESS_API_URL.format(username=username)

        try:
            response = requests.get(url, headers=HEADERS)
            response.raise_for_status()
            data = response.json()

            user_data = {
                "player_id": data.get("player_id"),
                "url": data.get("url"),
                "name": data.get("name"),
                "username": data.get("username").lower(),
                "followers": data.get("followers", 0),
                "country": data.get("country"),
                "location": data.get("location"),
                "last_online": data.get("last_online"),
                "joined": data.get("joined"),
                "status": data.get("status"),
                "is_streamer": data.get("is_streamer", False),
                "verified": data.get("verified", False),
                "league": data.get("league"),
                "streaming_platforms": data.get("streaming_platforms", []),
            }

            user, created = User.objects.update_or_create(
                player_id=user_data["player_id"], defaults=user_data
            )

            if created:
                self.stdout.write(self.style.SUCCESS(f"New user '{username}' added."))
            else:
                self.stdout.write(self.style.SUCCESS(f"User '{username}' updated."))

        except requests.exceptions.RequestException as e:
            self.stderr.write(self.style.ERROR(f"Error fetching player data: {e}"))
