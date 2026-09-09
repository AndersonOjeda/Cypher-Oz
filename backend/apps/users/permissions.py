from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    message = "No tienes permisos para realizar esta acción."

    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.role == "ADMIN")
