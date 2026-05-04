import functools
import random
import string

from django.http import JsonResponse

from app import models


def api_login_required(view_func):
    """Like @login_required but returns 401 JSON instead of redirecting."""

    @functools.wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Authentication required."}, status=401)
        return view_func(request, *args, **kwargs)

    return wrapper


def api_staff_required(view_func):
    """Requires the user to be authenticated and is_staff."""

    @functools.wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Authentication required."}, status=401)
        if not request.user.is_staff:
            return JsonResponse({"error": "Staff access required."}, status=403)
        return view_func(request, *args, **kwargs)

    return wrapper


def generate_url_suffix(user, random_suffix_length: int = 6) -> str:
    while True:
        url_suffix = "-".join(
            (
                user.first_name.lower(),
                user.last_name.lower(),
                "".join(random.choices(string.ascii_letters, k=random_suffix_length)),
            )
        )
        if not models.Topic.objects.filter(url_suffix=url_suffix).exists():
            return url_suffix
