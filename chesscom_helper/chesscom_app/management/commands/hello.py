# myapp/management/commands/hello.py

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Hello world."

    def handle(self, *args, **options):
        try:
            self.stdout.write(self.style.SUCCESS(f"Great job"))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Error doing literally nothing: {e}"))
