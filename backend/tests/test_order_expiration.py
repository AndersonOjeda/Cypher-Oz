import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from io import StringIO
from threading import Event
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import close_old_connections, connections, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.configuration.models import StoreSetting
from apps.inventory.models import InventoryBalance, StockMovement
from apps.orders.expiration import expire_unpaid_order, process_unpaid_expirations
from apps.orders.models import Order, Payment
from apps.orders.services import CheckoutConflict, report_payment

from .test_sprint5_backend import sprint5_setup as sprint5_setup


def due_order(setup):
    order = setup["make_order"](setup["user"])
    Payment.objects.filter(order=order).update(
        report_deadline_at=timezone.now() - timedelta(seconds=1)
    )
    order.payment.refresh_from_db()
    return order


def test_expiry_command_dry_run_then_single_atomic_restitution(sprint5_setup):
    order = due_order(sprint5_setup)
    original_deadline = order.payment.report_deadline_at
    # Future configuration must not postpone an existing payment's T1.
    StoreSetting.objects.filter(key="unpaid_order_timeout_hours").update(value=999)
    options = {"actor_email": sprint5_setup["admin"].email}
    output = StringIO()
    call_command("expire_unpaid_orders", dry_run=True, stdout=output, **options)
    assert json.loads(output.getvalue())["candidates"] == 1
    order.refresh_from_db()
    assert order.status == "PENDING"
    for expected in [1, 0]:
        output = StringIO()
        call_command("expire_unpaid_orders", stdout=output, **options)
        assert json.loads(output.getvalue())["cancelled"] == expected
    order.refresh_from_db()
    order.payment.refresh_from_db()
    assert order.status == "CANCELLED"
    assert order.payment.status == "PENDING"
    assert order.payment.report_deadline_at == original_deadline
    assert not order.payment.history.exists()
    history = order.history.get(status="CANCELLED")
    assert history.actor == sprint5_setup["admin"]
    movement = StockMovement.objects.get(type="CANCELLATION")
    assert movement.reversal_of_id == order.items.get().movement_id
    assert movement.actor == sprint5_setup["admin"]
    assert "Vencimiento T1" in movement.reason
    assert InventoryBalance.objects.get(variant=sprint5_setup["variant"]).available_quantity == 15
    with pytest.raises(CheckoutConflict):
        report_payment(sprint5_setup["user"], order.number, "LATE-REFERENCE")


@pytest.mark.parametrize(
    "order_status,payment_status",
    [
        ("PENDING", "REPORTED"),
        ("PENDING", "CONFIRMED"),
        ("PENDING", "REJECTED"),
        ("PREPARING", "PENDING"),
        ("SHIPPED", "CONFIRMED"),
        ("DELIVERED", "CONFIRMED"),
        ("CANCELLED", "PENDING"),
    ],
)
def test_t1_does_not_resolve_other_states_or_t2(sprint5_setup, order_status, payment_status):
    order = due_order(sprint5_setup)
    Order.objects.filter(pk=order.pk).update(status=order_status)
    Payment.objects.filter(order=order).update(
        status=payment_status,
        reference="REPORTED-REF",
        reported_at=timezone.now() - timedelta(hours=2),
        review_deadline_at=timezone.now() - timedelta(seconds=1)
        if payment_status != "REPORTED"
        else timezone.now() - timedelta(hours=1),
    )
    assert not expire_unpaid_order(sprint5_setup["admin"], order.number)
    assert process_unpaid_expirations(sprint5_setup["admin"])["candidates"] == 0
    assert not StockMovement.objects.filter(type="CANCELLATION").exists()


def test_expiry_uses_inclusive_persisted_boundary(sprint5_setup):
    order = sprint5_setup["make_order"](sprint5_setup["user"])
    deadline = order.payment.report_deadline_at
    with patch("apps.orders.expiration.now", return_value=deadline - timedelta(microseconds=1)):
        assert not expire_unpaid_order(sprint5_setup["admin"], order.number)
    with patch("apps.orders.expiration.now", return_value=deadline):
        assert expire_unpaid_order(sprint5_setup["admin"], order.number)


def test_expiry_rejects_non_admin_and_inactive_audit_actor(sprint5_setup):
    order = due_order(sprint5_setup)
    with pytest.raises(PermissionDenied):
        expire_unpaid_order(sprint5_setup["user"], order.number)
    admin = sprint5_setup["admin"]
    admin.is_active = False
    admin.save(update_fields=["is_active"])
    with pytest.raises(PermissionDenied):
        expire_unpaid_order(admin, order.number)
    with pytest.raises(CommandError):
        call_command("expire_unpaid_orders", actor_email=admin.email)
    assert not order.history.exists()


@pytest.mark.parametrize("limit", [0, -1, 1001, True])
def test_expiry_batch_rejects_invalid_limits(sprint5_setup, limit):
    with pytest.raises(ValueError):
        process_unpaid_expirations(sprint5_setup["admin"], limit=limit)


def test_expiry_batch_is_bounded_and_can_resume(sprint5_setup):
    due_order(sprint5_setup)
    due_order(sprint5_setup)
    for _ in range(2):
        assert process_unpaid_expirations(sprint5_setup["admin"], limit=1)["cancelled"] == 1
    assert Order.objects.filter(status="CANCELLED").count() == 2
    assert StockMovement.objects.filter(type="CANCELLATION").count() == 2
    assert InventoryBalance.objects.get(variant=sprint5_setup["variant"]).available_quantity == 15


def test_failed_restitution_rolls_back_cancellation_and_command_reports_failure(sprint5_setup):
    order = due_order(sprint5_setup)
    InventoryBalance.objects.filter(variant=sprint5_setup["variant"]).delete()
    output = StringIO()
    with pytest.raises(CommandError):
        call_command(
            "expire_unpaid_orders", actor_email=sprint5_setup["admin"].email, stdout=output
        )
    assert json.loads(output.getvalue())["failed"] == [str(order.number)]
    order.refresh_from_db()
    assert order.status == "PENDING"
    assert not order.history.exists()
    assert not StockMovement.objects.filter(type="CANCELLATION").exists()


def test_failure_after_inventory_write_rolls_back_everything(sprint5_setup):
    order = due_order(sprint5_setup)
    from apps.orders.services import restore_cancelled_order_inventory

    def fail_after_write(*args):
        restore_cancelled_order_inventory(*args)
        raise RuntimeError("Failure after inventory write")

    with patch(
        "apps.orders.expiration.restore_cancelled_order_inventory", side_effect=fail_after_write
    ):
        result = process_unpaid_expirations(sprint5_setup["admin"])
    assert result["failed"] == [str(order.number)]
    order.refresh_from_db()
    assert order.status == "PENDING"
    assert not order.history.exists()
    assert not StockMovement.objects.filter(type="CANCELLATION").exists()
    assert InventoryBalance.objects.get(variant=sprint5_setup["variant"]).available_quantity == 13


def wait_for_lock(pid):
    """Observe a real PostgreSQL row-lock wait, rather than rely on thread timing."""
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT wait_event_type FROM pg_stat_activity WHERE pid = %s", [pid])
            row = cursor.fetchone()
        if row and row[0] == "Lock":
            return
        time.sleep(0.01)
    raise AssertionError("The competing worker never waited on the PostgreSQL lock")


@pytest.mark.django_db(transaction=True)
def test_overlapping_expiry_runs_only_cancel_once(sprint5_setup):
    order = due_order(sprint5_setup)
    started = [Event(), Event()]
    pids = [None, None]

    def run(index):
        close_old_connections()
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute("SELECT pg_backend_pid()")
                pids[index] = cursor.fetchone()[0]
            started[index].set()
            return process_unpaid_expirations(sprint5_setup["admin"])
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        with transaction.atomic():
            Order.objects.select_for_update().get(pk=order.pk)
            futures = [pool.submit(run, index) for index in range(2)]
            for index in range(2):
                assert started[index].wait(10)
                wait_for_lock(pids[index])
        results = [future.result(timeout=20) for future in futures]
    assert sum(result["cancelled"] for result in results) == 1
    assert sum(result["skipped"] for result in results) == 1
    assert order.history.filter(status="CANCELLED").count() == 1
    assert StockMovement.objects.filter(type="CANCELLATION").count() == 1
    assert InventoryBalance.objects.get(variant=sprint5_setup["variant"]).available_quantity == 15


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("winner", ["report", "expiration"])
def test_report_and_real_expiry_runner_serialize_without_lost_stock(sprint5_setup, winner):
    user, actor = sprint5_setup["user"], sprint5_setup["admin"]
    order = sprint5_setup["make_order"](user)
    deadline = timezone.now() + timedelta(hours=1)
    if winner == "expiration":
        deadline = timezone.now() - timedelta(seconds=1)
    Payment.objects.filter(order=order).update(report_deadline_at=deadline)
    locked, release, contender_started = Event(), Event(), Event()
    pid = []

    def first():
        close_old_connections()
        try:
            with transaction.atomic():
                Order.objects.select_for_update().get(pk=order.pk)
                if winner == "report":
                    report_payment(user, order.number, "RACE-REF")
                else:
                    assert expire_unpaid_order(actor, order.number)
                locked.set()
                assert release.wait(15)
        finally:
            connections.close_all()

    def second():
        close_old_connections()
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute("SELECT pg_backend_pid()")
                pid.append(cursor.fetchone()[0])
            contender_started.set()
            if winner == "report":
                # The actual runner sees T1 due but must recheck the locked payment.
                return process_unpaid_expirations(actor)
            try:
                report_payment(user, order.number, "RACE-REF")
            except CheckoutConflict:
                return "rejected"
            raise AssertionError("An expired/cancelled order accepted a payment report")
        finally:
            connections.close_all()

    with (
        patch("apps.orders.expiration.now", return_value=deadline),
        ThreadPoolExecutor(max_workers=2) as pool,
    ):
        first_future = pool.submit(first)
        try:
            assert locked.wait(10)
            second_future = pool.submit(second)
            assert contender_started.wait(10)
            wait_for_lock(pid[0])
        finally:
            release.set()
        first_future.result(timeout=20)
        outcome = second_future.result(timeout=20)
    order.refresh_from_db()
    order.payment.refresh_from_db()
    if winner == "report":
        assert outcome["cancelled"] == 0
        assert outcome["skipped"] == 1
        assert order.status == "PENDING"
        assert order.payment.status == "REPORTED"
        assert order.payment.history.filter(status="REPORTED", actor=user).count() == 1
        assert not order.history.exists()
        assert not StockMovement.objects.filter(type="CANCELLATION").exists()
        expected_stock = 13
    else:
        assert outcome == "rejected"
        assert order.status == "CANCELLED"
        assert order.payment.status == "PENDING"
        assert order.history.filter(status="CANCELLED", actor=actor).count() == 1
        assert not order.payment.history.exists()
        assert StockMovement.objects.filter(type="CANCELLATION").count() == 1
        expected_stock = 15
    assert (
        InventoryBalance.objects.get(variant=sprint5_setup["variant"]).available_quantity
        == expected_stock
    )
    assert not expire_unpaid_order(actor, order.number)
