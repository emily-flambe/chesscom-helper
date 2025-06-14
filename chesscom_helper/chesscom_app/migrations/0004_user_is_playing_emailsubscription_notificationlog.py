# Generated migration for notification system
# Run this after applying previous migrations

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('chesscom_app', '0003_delete_dummy'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='is_playing',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='EmailSubscription',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(max_length=254)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('is_active', models.BooleanField(default=True)),
                ('player', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subscriptions', to='chesscom_app.user')),
            ],
            options={
                'unique_together': {('email', 'player')},
            },
        ),
        migrations.CreateModel(
            name='NotificationLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                ('notification_type', models.CharField(default='live_match', max_length=50)),
                ('success', models.BooleanField(default=True)),
                ('error_message', models.TextField(blank=True, null=True)),
                ('subscription', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='chesscom_app.emailsubscription')),
            ],
        ),
    ]