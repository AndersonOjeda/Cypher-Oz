"""Separate test database so performance regression tests can run concurrently."""

from .test import *  # noqa: F403

DATABASES["default"]["TEST"] = {"NAME": "test_tti_performance"}  # noqa: F405
