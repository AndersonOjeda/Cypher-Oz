from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is not None:
        details = response.data
        code = getattr(exc, "default_code", "validation_error")
        message = "Revisa los datos ingresados."
        if isinstance(details, dict) and "detail" in details:
            message = str(details["detail"])
        response.data = {"code": code, "message": message, "details": details}
        response["Cache-Control"] = "no-store"
    return response
