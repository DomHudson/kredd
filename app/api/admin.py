from django.contrib.auth import get_user_model
from django.db.models import Count
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from app.api.helpers import api_staff_required
from app.password_reset import invalidate_user_sessions


@api_staff_required
def users_view(request):
    users = (
        get_user_model()
        .objects.order_by("id")
        .annotate(
            topic_count=Count("topic", distinct=True),
            outreach_count=Count("topic__outreach", distinct=True),
        )
        .values(
            "id",
            "first_name",
            "last_name",
            "email",
            "is_staff",
            "is_active",
            "last_login",
            "date_joined",
            "topic_count",
            "outreach_count",
        )
    )
    rows = [
        {
            **u,
            "last_login": u["last_login"].isoformat() if u["last_login"] else None,
            "date_joined": u["date_joined"].isoformat(),
            "is_onboarded": u["topic_count"] > 0,
        }
        for u in users
    ]
    return JsonResponse({"users": rows})


@require_POST
@api_staff_required
def set_active_view(request, user_id):
    user_model = get_user_model()
    try:
        user = user_model.objects.get(pk=user_id)
    except user_model.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    body = request.get_json()
    active = body.get("active")
    if not isinstance(active, bool):
        return JsonResponse({"error": "'active' must be a boolean."}, status=400)

    user.is_active = active
    user.save(update_fields=["is_active"])
    return JsonResponse({"success": True, "is_active": active})


@require_POST
@api_staff_required
def set_staff_view(request, user_id):
    user_model = get_user_model()
    try:
        user = user_model.objects.get(pk=user_id)
    except user_model.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    body = request.get_json()
    staff = body.get("staff")
    if not isinstance(staff, bool):
        return JsonResponse({"error": "'staff' must be a boolean."}, status=400)

    user.is_staff = staff
    user.is_superuser = staff
    user.save(update_fields=["is_staff", "is_superuser"])
    return JsonResponse({"success": True, "is_staff": staff})


@require_POST
@api_staff_required
def impersonate_view(request, user_id):
    user_model = get_user_model()
    try:
        user_model.objects.get(pk=user_id)
    except user_model.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    request.session["impersonate_user_id"] = user_id
    return JsonResponse({"success": True, "impersonating": user_id})


@require_POST
@api_staff_required
def stop_impersonating_view(request):
    request.session.pop("impersonate_user_id", None)
    return JsonResponse({"success": True})


@require_POST
@api_staff_required
def force_logout_view(request, user_id):
    user_model = get_user_model()
    try:
        user = user_model.objects.get(pk=user_id)
    except user_model.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    invalidate_user_sessions(user)
    return JsonResponse({"success": True})
