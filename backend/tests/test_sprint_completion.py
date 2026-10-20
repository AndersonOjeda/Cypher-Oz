from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.orders.expiration import process_payment_deadlines
from apps.orders.models import Payment, PaymentStatusHistory

pytest_plugins = ["tests.test_sprint6_backend", "tests.test_sprint7_backend"]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "ids", ["²,1", "1,2,invalid", "-1,2", "0,2", "1,99999999999999999999999999999999999"]
)
def test_compare_invalid_identifiers_return_400(ids):
    assert APIClient().get("/api/v1/products/compare/", {"ids": ids}).status_code == 400


@pytest.mark.parametrize("count", [3, 4])
def test_comparison_three_four_products_and_missing_attributes(sprint7_setup, count):
    from apps.catalog.models import Product

    s = sprint7_setup
    base = s["prod_lg"]
    products = [base, s["prod_samsung"]]
    for index in range(count - 2):
        products.append(
            Product.objects.create(
                name=f"Other {index}",
                slug=f"other-{index}",
                category=base.category,
                brand=base.brand,
                is_active=True,
            )
        )
    query = ",".join(str(product.pk) for product in products)
    response = APIClient().get("/api/v1/products/compare/", {"ids": query})
    assert response.status_code == 200
    assert len(response.data["products"]) == count
    assert response.data["products"][-1]["attributes"]["resolucion"]["value"] == "N/A"
    assert (
        APIClient()
        .get("/api/v1/products/compare/", {"ids": query + "," + str(base.pk)})
        .status_code
        == 400
    )


def rejected_order(s):
    order = s["make_order"](s["user"], payment_status="REPORTED")
    api = APIClient()
    api.force_authenticate(s["admin"])
    response = api.post(
        f"/api/v1/admin/payments/{order.payment.pk}/reject/",
        {"reason": "Referencia no acreditada"},
        format="json",
    )
    assert response.status_code == 200
    order.payment.refresh_from_db()
    return order


def test_rejection_persists_reason_and_24_hour_deadline(sprint6_setup):
    before = timezone.now()
    order = rejected_order(sprint6_setup)
    assert (
        before + timedelta(hours=24)
        <= order.payment.correction_deadline_at
        <= timezone.now() + timedelta(hours=24)
    )
    assert (
        PaymentStatusHistory.objects.get(payment=order.payment, status="REJECTED").reason
        == "Referencia no acreditada"
    )


def test_correction_after_original_t1_persists_fresh_t2(sprint6_setup):
    s = sprint6_setup
    order = rejected_order(s)
    Payment.objects.filter(pk=order.payment.pk).update(
        report_deadline_at=timezone.now() - timedelta(days=2)
    )
    api = APIClient()
    api.force_authenticate(s["user"])
    response = api.post(
        f"/api/v1/orders/{order.number}/payment-report/",
        {"reference": "CORRECTED-123"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["status"] == "REPORTED"
    assert response.data["correction_deadline_at"] is None
    second = api.post(
        f"/api/v1/orders/{order.number}/payment-report/",
        {"reference": "CORRECTED-123"},
        format="json",
    )
    assert second.data["review_deadline_at"] == response.data["review_deadline_at"]


def test_correction_rejected_at_inclusive_boundary(sprint6_setup, monkeypatch):
    s = sprint6_setup
    order = rejected_order(s)
    monkeypatch.setattr(
        "apps.orders.services.timezone.now", lambda: order.payment.correction_deadline_at
    )
    api = APIClient()
    api.force_authenticate(s["user"])
    assert (
        api.post(
            f"/api/v1/orders/{order.number}/payment-report/",
            {"reference": "TOO-LATE-123"},
            format="json",
        ).status_code
        == 409
    )


def test_t2_alert_is_idempotent_and_does_not_cancel(sprint6_setup):
    s = sprint6_setup
    order = s["make_order"](s["user"], payment_status="REPORTED")
    Payment.objects.filter(pk=order.payment.pk).update(
        reported_at=timezone.now() - timedelta(days=3),
        review_deadline_at=timezone.now() - timedelta(days=1),
    )
    assert process_payment_deadlines(s["admin"], dry_run=True)["candidates"] == 1
    assert process_payment_deadlines(s["admin"])["alerted"] == 1
    assert process_payment_deadlines(s["admin"])["candidates"] == 0
    order.refresh_from_db()
    order.payment.refresh_from_db()
    assert (order.status, order.payment.status) == ("PENDING", "REPORTED")
    assert (
        PaymentStatusHistory.objects.filter(
            payment=order.payment, reason__startswith="Vencimiento T2"
        ).count()
        == 1
    )


def test_expired_rejection_cancels_and_restores_once(sprint6_setup):
    s = sprint6_setup
    order = rejected_order(s)
    Payment.objects.filter(pk=order.payment.pk).update(
        correction_deadline_at=timezone.now() - timedelta(seconds=1)
    )
    assert process_payment_deadlines(s["admin"])["cancelled"] == 1
    assert process_payment_deadlines(s["admin"])["cancelled"] == 0
    order.refresh_from_db()
    assert order.status == "CANCELLED"
    assert order.items.first().movement.reversal.quantity == 2


def test_real_cookie_admin_actions_require_csrf(sprint6_setup):
    s = sprint6_setup
    order = s["make_order"](s["user"], payment_status="REPORTED")
    api = APIClient(enforce_csrf_checks=True)
    token = api.get("/api/v1/auth/csrf/").data["csrfToken"]
    login = api.post(
        "/api/v1/auth/login/",
        {"email": s["admin"].email, "password": "Password123!"},
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert login.status_code == 200
    path = f"/api/v1/admin/payments/{order.payment.pk}/confirm/"
    assert api.post(path).status_code == 403
    assert api.post(path, HTTP_X_CSRFTOKEN=login.data["csrfToken"]).status_code == 200
    path = f"/api/v1/admin/orders/{order.number}/transition/"
    assert (
        api.post(
            path,
            {"target_status": "PREPARING"},
            format="json",
            HTTP_X_CSRFTOKEN=login.data["csrfToken"],
        ).status_code
        == 200
    )


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("winner", ["confirm", "cancel"])
def test_confirmation_and_cancellation_serialize_on_postgres(sprint6_setup, winner):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event

    from django.db import close_old_connections, connections, transaction

    from apps.inventory.models import InventoryBalance, StockMovement
    from apps.orders.services import (
        CheckoutConflict,
        cancel_order_by_user_or_admin,
        confirm_payment,
    )
    from tests.test_order_expiration import wait_for_lock

    s = sprint6_setup
    order = s["make_order"](s["user"], payment_status="REPORTED")
    held, release, started = Event(), Event(), Event()
    pid = []

    def act(action):
        if action == "confirm":
            return confirm_payment(s["admin"], order.payment.pk)
        return cancel_order_by_user_or_admin(s["user"], order.number)

    def first():
        close_old_connections()
        try:
            with transaction.atomic():
                act(winner)
                held.set()
                assert release.wait(15)
        finally:
            connections.close_all()

    def second():
        close_old_connections()
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute("SELECT pg_backend_pid()")
                pid.append(cursor.fetchone()[0])
            started.set()
            with pytest.raises(CheckoutConflict):
                act("cancel" if winner == "confirm" else "confirm")
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        a = pool.submit(first)
        try:
            assert held.wait(10)
            b = pool.submit(second)
            assert started.wait(10)
            wait_for_lock(pid[0])
        finally:
            release.set()
        a.result(timeout=20)
        b.result(timeout=20)
    order.refresh_from_db()
    order.payment.refresh_from_db()
    assert (order.status, order.payment.status) == (
        ("PENDING", "CONFIRMED") if winner == "confirm" else ("CANCELLED", "REPORTED")
    )
    assert StockMovement.objects.filter(type="CANCELLATION").count() == (
        0 if winner == "confirm" else 1
    )
    assert InventoryBalance.objects.get(variant=s["variant"]).available_quantity == (
        18 if winner == "confirm" else 20
    )
