"""Opt-in request measurements without recording SQL, parameters or user data."""

import json
import logging
import os
from time import perf_counter, time

from django.conf import settings
from django.db import connection

logger = logging.getLogger("tti.performance")


class RequestPerformanceMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not getattr(settings, "PERFORMANCE_LOG_ENABLED", False):
            return self.get_response(request)
        started = perf_counter()
        query_count = 0
        database_seconds = 0.0

        def measure(execute, sql, params, many, context):
            nonlocal query_count, database_seconds
            query_count += 1
            query_started = perf_counter()
            try:
                return execute(sql, params, many, context)
            finally:
                database_seconds += perf_counter() - query_started

        with connection.execute_wrapper(measure):
            response = self.get_response(request)
        elapsed_ms = (perf_counter() - started) * 1000
        database_ms = database_seconds * 1000
        route = request.resolver_match.route if request.resolver_match else "unmatched"
        logger.info(json.dumps({
            "time": time(), "process": os.getpid(),
            "route": route, "method": request.method, "status": response.status_code,
            "elapsed_ms": round(elapsed_ms, 2), "db_ms": round(database_ms, 2),
            "queries": query_count,
        }))
        response["Server-Timing"] = f"app;dur={elapsed_ms:.2f}, db;dur={database_ms:.2f}"
        return response
