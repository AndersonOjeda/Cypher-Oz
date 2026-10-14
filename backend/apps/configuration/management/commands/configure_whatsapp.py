from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.configuration.models import SettingChange, StoreSetting
from apps.configuration.views import SettingsSerializer


class Command(BaseCommand):
    help = "Configure the commercial WhatsApp channel; never sends messages."

    def add_arguments(self, parser):
        parser.add_argument("--number")
        parser.add_argument("--message")
        parser.add_argument("--disable", action="store_true")

    def handle(self, *args, **options):
        with transaction.atomic():
            rows = list(StoreSetting.objects.select_for_update().order_by("key"))
            current = {row.key: row.value for row in rows}
            changes = {"whatsapp_enabled": not options["disable"]}
            if options["number"] is not None:
                changes["whatsapp_number"] = options["number"]
            if options["message"] is not None:
                changes["whatsapp_message"] = options["message"]
            serializer = SettingsSerializer(data={**current, **changes})
            if not serializer.is_valid():
                raise CommandError(str(serializer.errors))
            for key, value in changes.items():
                SettingChange.objects.create(key=key, previous_value=current[key], new_value=value)
                StoreSetting.objects.filter(key=key).update(value=value)
        self.stdout.write(self.style.SUCCESS("WhatsApp configuration updated."))
