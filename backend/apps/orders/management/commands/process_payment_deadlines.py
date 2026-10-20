from apps.orders.expiration import process_payment_deadlines

from .expire_unpaid_orders import Command as ExpiryCommand


class Command(ExpiryCommand):
    help = "Procesar T1, alertar T2 y vencer correcciones rechazadas; transaccional e idempotente."
    processor = staticmethod(process_payment_deadlines)
