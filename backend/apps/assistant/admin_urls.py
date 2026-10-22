from django.urls import path

from .admin_views import CatalogPreparationView, ProductIntakeView

urlpatterns = [
    path("intake/", ProductIntakeView.as_view()),
    path("catalog/", CatalogPreparationView.as_view()),
]
