from rest_framework.routers import SimpleRouter

from .views import PromotionViewSet

router = SimpleRouter()
router.register("", PromotionViewSet, basename="promotions")

urlpatterns = router.urls
