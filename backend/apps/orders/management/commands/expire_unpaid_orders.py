import json

from django.core.management.base import BaseCommand, CommandError

from apps.orders.expiration import process_unpaid_expirations
from apps.users.models import User


class Command(BaseCommand):
    processor = staticmethod(process_unpaid_expirations)
    help = "Expire unpaid PENDING orders at persisted T1; never resolve REPORTED/T2 payments."

    def add_arguments(self, parser):
        parser.add_argument("--actor-email", required=True)
        parser.add_argument("--limit", type=int, default=100)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        actor = User.objects.filter(
            email__iexact=options["actor_email"].strip(), role=User.Role.ADMIN, is_active=True
        ).first()
        if actor is None:
            raise CommandError("Indica un administrador activo existente como actor de auditoría.")
        try:
            result = self.processor(actor, limit=options["limit"], dry_run=options["dry_run"])
        except ValueError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(json.dumps(result))
        if result["failed"]:
            raise CommandError(
                "Hay pedidos sin procesar; revisar logs y conciliar antes del reintento."
            )
