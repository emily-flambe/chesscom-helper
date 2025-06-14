from django.core.management.base import BaseCommand
from chesscom_app.services import check_and_notify_all_users
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Check all users for live matches and send notifications for newly started matches'

    def add_arguments(self, parser):
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Enable verbose logging',
        )

    def handle(self, *args, **options):
        if options['verbose']:
            logging.basicConfig(level=logging.INFO)
        
        self.stdout.write(self.style.SUCCESS('Starting live match check...'))
        
        try:
            result = check_and_notify_all_users()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f"Check completed:\n"
                    f"- Users checked: {result['total_users_checked']}\n"
                    f"- Notifications sent: {result['notifications_sent']}\n"
                    f"- Errors: {len(result['errors'])}"
                )
            )
            
            if result['errors'] and options['verbose']:
                self.stdout.write(self.style.ERROR("Errors encountered:"))
                for error in result['errors']:
                    self.stdout.write(self.style.ERROR(f"- {error}"))
                    
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Command failed: {str(e)}')
            )
            raise