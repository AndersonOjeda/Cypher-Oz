from django.urls import path

from .views import AdjustmentView, EntryView, InventoryView, MovementsView

urlpatterns = [
    path("", InventoryView.as_view()),
    path("entries/", EntryView.as_view()),
    path("adjustments/", AdjustmentView.as_view()),
    path("movements/", MovementsView.as_view()),
]
