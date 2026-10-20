import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.db import connection
from django.http import HttpResponse
from django.test import RequestFactory, override_settings

from apps.core.performance import RequestPerformanceMiddleware


@pytest.mark.django_db
@override_settings(PERFORMANCE_LOG_ENABLED=True)
def test_request_timings_count_queries_without_logging_parameters():
    def view(request):
        with connection.cursor() as cursor:
            cursor.execute("SELECT %s", ["private-value"])
        return HttpResponse("ok")

    request = RequestFactory().get("/api/v1/products/?search=private-value")
    request.resolver_match = SimpleNamespace(route="api/v1/products/")
    with patch("apps.core.performance.logger.info") as log:
        response = RequestPerformanceMiddleware(view)(request)
    record = json.loads(log.call_args.args[0])
    assert record["queries"] == 1
    assert record["elapsed_ms"] >= record["db_ms"] >= 0
    assert record["status"] == 200
    assert "private-value" not in log.call_args.args[0]
    assert "app;dur=" in response["Server-Timing"]


@override_settings(PERFORMANCE_LOG_ENABLED=False)
def test_request_measurements_are_opt_in():
    with patch("apps.core.performance.logger.info") as log:
        response = RequestPerformanceMiddleware(lambda request: HttpResponse("ok"))(
            RequestFactory().get("/"),
        )
    assert "Server-Timing" not in response
    log.assert_not_called()
