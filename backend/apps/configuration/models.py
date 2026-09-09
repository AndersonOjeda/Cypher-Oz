from django.conf import settings
from django.db import models


class StoreSetting(models.Model):
    key = models.CharField(max_length=80, unique=True)
    value = models.JSONField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "store_settings"


class SettingChange(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True)
    key = models.CharField(max_length=80)
    previous_value = models.JSONField()
    new_value = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
