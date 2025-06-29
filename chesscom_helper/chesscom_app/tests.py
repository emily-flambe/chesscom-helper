from django.test import TestCase
from django.core.management import call_command
from unittest.mock import patch, Mock
import json
from chesscom_app.models import User, EmailSubscription, NotificationLog
from chesscom_app.common.chesscom_api import (
    fetch_and_save_chesscom_user,
    check_player_live_games,
    update_player_status,
)
from chesscom_app.services import (
    send_live_match_notification,
    check_and_notify_all_users,
)


class ChesscomAPITestCase(TestCase):
    """Test cases for Chess.com API integration"""

    def setUp(self):
        """Set up test data"""
        self.sample_user_data = {
            "player_id": 12345678,
            "url": "https://www.chess.com/member/testuser",
            "name": "Test User",
            "username": "testuser",
            "followers": 100,
            "country": "https://api.chess.com/pub/country/US",
            "location": "New York",
            "last_online": 1640995200,
            "joined": 1609459200,
            "status": "premium",
            "is_streamer": False,
            "verified": True,
            "league": "Champion",
        }

        self.sample_games_data = {
            "games": [
                {
                    "url": "https://www.chess.com/game/live/12345",
                    "turn": "white",
                    "move_by": 1640995800,
                    "time_control": "600",
                },
                {
                    "url": "https://www.chess.com/game/live/12346",
                    "turn": "black",
                    "move_by": 1640995900,
                    "time_control": "300+5",
                },
            ]
        }

    @patch("chesscom_app.common.chesscom_api.requests.get")
    def test_fetch_and_save_chesscom_user_success(self, mock_get):
        """Test successful user fetch and save"""
        mock_response = Mock()
        mock_response.json.return_value = self.sample_user_data
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        result = fetch_and_save_chesscom_user("testuser")

        self.assertEqual(result["status"], 201)
        self.assertIn("New user 'testuser' added", result["message"])

        # Verify user was created
        user = User.objects.get(username="testuser")
        self.assertEqual(user.player_id, 12345678)
        self.assertEqual(user.name, "Test User")
        self.assertEqual(user.followers, 100)

    @patch("chesscom_app.common.chesscom_api.requests.get")
    def test_fetch_and_save_chesscom_user_update_existing(self, mock_get):
        """Test updating existing user"""
        # Create existing user
        User.objects.create(
            player_id=12345678,
            username="testuser",
            url="https://www.chess.com/member/testuser",
            name="Old Name",
            followers=50,
            last_online=1640900000,
            joined=1609459200,
            status="basic",
        )

        mock_response = Mock()
        mock_response.json.return_value = self.sample_user_data
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        result = fetch_and_save_chesscom_user("testuser")

        self.assertEqual(result["status"], 200)
        self.assertIn("User 'testuser' updated", result["message"])

        # Verify user was updated
        user = User.objects.get(username="testuser")
        self.assertEqual(user.name, "Test User")  # Updated
        self.assertEqual(user.followers, 100)  # Updated

    @patch("chesscom_app.common.chesscom_api.requests.get")
    def test_fetch_and_save_chesscom_user_api_error(self, mock_get):
        """Test API error handling"""
        mock_get.side_effect = Exception("API Error")

        result = fetch_and_save_chesscom_user("testuser")

        self.assertEqual(result["status"], 500)
        self.assertIn("Error fetching player data", result["error"])

    @patch("chesscom_app.common.chesscom_api.requests.get")
    def test_check_player_live_games_with_games(self, mock_get):
        """Test checking live games when player has active games"""
        mock_response = Mock()
        mock_response.json.return_value = self.sample_games_data
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        result = check_player_live_games("testuser")

        self.assertEqual(result["username"], "testuser")
        self.assertTrue(result["is_playing"])
        self.assertEqual(len(result["live_games"]), 2)
        self.assertEqual(result["total_games"], 2)

    @patch("chesscom_app.common.chesscom_api.requests.get")
    def test_check_player_live_games_no_games(self, mock_get):
        """Test checking live games when player has no active games"""
        mock_response = Mock()
        mock_response.json.return_value = {"games": []}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        result = check_player_live_games("testuser")

        self.assertEqual(result["username"], "testuser")
        self.assertFalse(result["is_playing"])
        self.assertEqual(len(result["live_games"]), 0)

    @patch("chesscom_app.common.chesscom_api.check_player_live_games")
    def test_update_player_status_not_playing_to_playing(self, mock_check_games):
        """Test status update from not playing to playing"""
        # Create user who is not currently playing
        user = User.objects.create(
            player_id=12345678,
            username="testuser",
            url="https://www.chess.com/member/testuser",
            name="Test User",
            last_online=1640995200,
            joined=1609459200,
            status="premium",
            is_playing=False,
        )

        mock_check_games.return_value = {
            "username": "testuser",
            "is_playing": True,
            "live_games": [{"url": "https://www.chess.com/game/live/12345"}],
            "total_games": 1,
        }

        result = update_player_status("testuser")

        self.assertEqual(result["username"], "testuser")
        self.assertFalse(result["was_playing"])
        self.assertTrue(result["is_now_playing"])
        self.assertTrue(result["status_changed"])

        # Verify user status was updated
        user.refresh_from_db()
        self.assertTrue(user.is_playing)

    def test_update_player_status_user_not_found(self):
        """Test status update for non-existent user"""
        result = update_player_status("nonexistentuser")

        self.assertIn("error", result)
        self.assertIn("User nonexistentuser not found", result["error"])


class EmailNotificationTestCase(TestCase):
    """Test cases for email notification service"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create(
            player_id=12345678,
            username="testuser",
            url="https://www.chess.com/member/testuser",
            name="Test User",
            last_online=1640995200,
            joined=1609459200,
            status="premium",
            is_playing=True,
        )

        self.subscription = EmailSubscription.objects.create(
            email="test@example.com", player=self.user, is_active=True
        )

        self.live_games = [
            {"url": "https://www.chess.com/game/live/12345", "time_control": "600"}
        ]

    @patch("chesscom_app.services.send_mail")
    def test_send_live_match_notification_success(self, mock_send_mail):
        """Test successful email notification sending"""
        mock_send_mail.return_value = True

        result = send_live_match_notification(self.user, self.live_games)

        self.assertEqual(result["successful_sends"], 1)
        self.assertEqual(result["failed_sends"], 0)
        self.assertEqual(result["total_subscriptions"], 1)

        # Verify notification log was created
        log = NotificationLog.objects.get(subscription=self.subscription)
        self.assertTrue(log.success)
        self.assertEqual(log.notification_type, "live_match")

    @patch("chesscom_app.services.send_mail")
    def test_send_live_match_notification_failure(self, mock_send_mail):
        """Test email notification sending failure"""
        mock_send_mail.side_effect = Exception("SMTP Error")

        result = send_live_match_notification(self.user, self.live_games)

        self.assertEqual(result["successful_sends"], 0)
        self.assertEqual(result["failed_sends"], 1)

        # Verify error was logged
        log = NotificationLog.objects.get(subscription=self.subscription)
        self.assertFalse(log.success)
        self.assertIn("SMTP Error", log.error_message)

    def test_send_live_match_notification_no_subscriptions(self):
        """Test notification when user has no active subscriptions"""
        # Deactivate subscription
        self.subscription.is_active = False
        self.subscription.save()

        result = send_live_match_notification(self.user, self.live_games)

        self.assertIn("No active subscriptions", result["message"])

    @patch("chesscom_app.services.send_live_match_notification")
    @patch("chesscom_app.common.chesscom_api.update_player_status")
    def test_check_and_notify_all_users(
        self, mock_update_status, mock_send_notification
    ):
        """Test batch checking and notification for all users"""
        mock_update_status.return_value = {
            "was_playing": False,
            "is_now_playing": True,
            "status_changed": True,
            "live_games": self.live_games,
        }

        mock_send_notification.return_value = {"successful_sends": 1, "failed_sends": 0}

        result = check_and_notify_all_users()

        self.assertEqual(result["total_users_checked"], 1)
        self.assertEqual(result["notifications_sent"], 1)
        self.assertEqual(len(result["errors"]), 0)


class ModelTestCase(TestCase):
    """Test cases for Django models"""

    def test_user_model_creation(self):
        """Test User model creation and string representation"""
        user = User.objects.create(
            player_id=12345678,
            username="testuser",
            url="https://www.chess.com/member/testuser",
            name="Test User",
            last_online=1640995200,
            joined=1609459200,
            status="premium",
        )

        self.assertEqual(str(user), "testuser (Test User)")
        self.assertEqual(user.player_id, 12345678)
        self.assertFalse(user.is_playing)  # Default value

    def test_email_subscription_model(self):
        """Test EmailSubscription model creation and constraints"""
        user = User.objects.create(
            player_id=12345678,
            username="testuser",
            url="https://www.chess.com/member/testuser",
            name="Test User",
            last_online=1640995200,
            joined=1609459200,
            status="premium",
        )

        subscription = EmailSubscription.objects.create(
            email="test@example.com", player=user
        )

        self.assertEqual(str(subscription), "test@example.com -> testuser")
        self.assertTrue(subscription.is_active)  # Default value

        # Test unique constraint
        with self.assertRaises(Exception):
            EmailSubscription.objects.create(email="test@example.com", player=user)

    def test_notification_log_model(self):
        """Test NotificationLog model creation"""
        user = User.objects.create(
            player_id=12345678,
            username="testuser",
            url="https://www.chess.com/member/testuser",
            name="Test User",
            last_online=1640995200,
            joined=1609459200,
            status="premium",
        )

        subscription = EmailSubscription.objects.create(
            email="test@example.com", player=user
        )

        log = NotificationLog.objects.create(
            subscription=subscription, notification_type="live_match", success=True
        )

        self.assertIn("test@example.com", str(log))
        self.assertIn("live_match", str(log))
        self.assertTrue(log.success)


class ManagementCommandTestCase(TestCase):
    """Test cases for Django management commands"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create(
            player_id=12345678,
            username="testuser",
            url="https://www.chess.com/member/testuser",
            name="Test User",
            last_online=1640995200,
            joined=1609459200,
            status="premium",
            is_playing=False,
        )

    @patch("chesscom_app.services.check_and_notify_all_users")
    def test_check_live_matches_command(self, mock_check_notify):
        """Test check_live_matches management command"""
        mock_check_notify.return_value = {
            "total_users_checked": 1,
            "notifications_sent": 0,
            "errors": [],
        }

        # This should not raise an exception
        call_command("check_live_matches")

        mock_check_notify.assert_called_once()
