import json

from django.contrib.auth import get_user_model


class AppRequestMiddleware:
    """Injects helper methods onto every request."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.get_json = lambda: json.loads(request.body)

        # Resolve impersonation — only honoured for authenticated staff.
        request.impersonated_user = self._get_impersonated_user(request)
        request.get_effective_user = lambda: request.impersonated_user or request.user  # noqa: RU001
        request.get_client_ip = lambda: self._get_client_ip(request)
        request.get_user_agent = lambda: self._get_user_agent(request)

        return self.get_response(request)

    @staticmethod
    def _get_impersonated_user(request):
        if not request.user.is_authenticated or not request.user.is_staff:
            return None

        user_id = request.session.get("impersonate_user_id")

        if not user_id:
            return None

        user_model = get_user_model()

        try:
            return user_model.objects.get(pk=user_id)
        except user_model.DoesNotExist:
            request.session.pop("impersonate_user_id", None)
            return None

    @staticmethod
    def _get_client_ip(request) -> str | None:
        return request.META.get("HTTP_X_FORWARDED_FOR")

    @staticmethod
    def _get_user_agent(request) -> str:
        return request.META.get("HTTP_USER_AGENT", "")
