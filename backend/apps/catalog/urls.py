from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    BrandViewSet,
    CatalogLimitsView,
    CategoryViewSet,
    ProductImageDetailView,
    ProductImagesView,
    ProductViewSet,
)

router = SimpleRouter()
router.register("categories", CategoryViewSet)
router.register("brands", BrandViewSet)
router.register("products", ProductViewSet)
urlpatterns = router.urls + [
    path("catalog/limits/", CatalogLimitsView.as_view()),
    path("products/<int:product_id>/images/", ProductImagesView.as_view()),
    path("products/<int:product_id>/images/<int:image_id>/", ProductImageDetailView.as_view()),
]
