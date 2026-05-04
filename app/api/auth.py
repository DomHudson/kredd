from django.contrib.auth import authenticate, get_user_model, login, logout
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from app import messages, models, password_reset
from app.api.helpers import api_login_required


@api_login_required
def me_view(request):
    u = request.get_effective_user()
    return JsonResponse(
        {
            "id": u.id,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "is_staff": u.is_staff,
            "is_onboarded": models.Topic.objects.filter(user=u).exists(),
            "is_impersonating": request.impersonated_user is not None,
        }
    )


@require_POST
@api_login_required
def update_me(request):
    data = request.get_json()
    u = request.get_effective_user()
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    new_password = data.get("new_password", "").strip()
    current_password = data.get("current_password", "").strip()

    if not first_name or not last_name:
        return JsonResponse({"error": "First and last name are required."}, status=400)

    if new_password:
        if not current_password:
            return JsonResponse(
                {"error": "Current password is required to set a new password."},
                status=400,
            )
        if not u.check_password(current_password):
            return JsonResponse({"error": "Current password is incorrect."}, status=400)
        u.set_password(new_password)

    u.first_name = first_name
    u.last_name = last_name
    u.save()
    # Re-authenticate so the session stays valid after a password change.
    login(request, u)
    return JsonResponse({"success": True})


@require_POST
def login_view(request):
    data = request.get_json()
    user = authenticate(request, email=data.get("email"), password=data.get("password"))
    if user is not None:
        login(request, user)
        return JsonResponse({"success": True})
    return JsonResponse({"success": False, "error": "Invalid credentials"}, status=401)


@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({"success": True})


@require_POST
def password_reset_request_view(request):
    data = request.get_json()
    email = data.get("email", "").strip()
    if email:
        password_reset.request_password_reset(
            email=email,
            ip=request.get_client_ip(),
            user_agent=request.get_user_agent(),
        )
    return JsonResponse({}, status=200)


@require_GET
def password_reset_validate_view(request):
    token = request.GET.get("token", "")
    if not token:
        return JsonResponse({"valid": False})
    reset = password_reset.find_valid_reset_by_token(token)
    return JsonResponse({"valid": reset is not None})


@require_POST
def password_reset_confirm_view(request):
    data = request.get_json()
    token = data.get("token", "")
    new_password = data.get("password", "")
    if not token or not new_password:
        return JsonResponse({}, status=400)

    ok = password_reset.confirm_password_reset(
        token=token,
        new_password=new_password,
        ip=request.get_client_ip(),
        user_agent=request.get_user_agent(),
    )
    if not ok:
        return JsonResponse({}, status=400)
    return JsonResponse({"success": True})


@require_POST
def signup_view(request):
    user_model = get_user_model()
    data = request.get_json()
    email = data.get("email", "").strip()
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    password = data.get("password", "")
    if not email or not first_name or not last_name or not password:
        return JsonResponse(
            {"success": False, "error": "All fields are required."}, status=400
        )
    if user_model.objects.filter(email=email).exists():
        return JsonResponse(
            {"success": False, "error": "Email already registered."}, status=400
        )
    user = user_model.objects.create_user(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
    )
    login(request, user)
    with messages.MessagePublisher.from_environment_variables() as publisher:
        publisher.publish_message_signup(user.id)
    return JsonResponse({"success": True})
