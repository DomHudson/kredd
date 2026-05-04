import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from app import messages, models


def _hash_reset_token(token: str) -> str:
    return salted_hmac(
        "kredd.accounts.password_reset",
        token,
        secret=settings.SECRET_KEY,
        algorithm="sha256",
    ).hexdigest()


def _generate_reset_token() -> str:
    return secrets.token_urlsafe(48)


def invalidate_user_sessions(user) -> None:
    models.UserSession.objects.filter(user=user).delete()


def _invalidate_user_password_resets(user, now) -> None:
    models.PasswordReset.objects.filter(
        user=user, invalidated_at__isnull=True, used_at__isnull=True
    ).update(invalidated_at=now)


def request_password_reset(email: str, ip: str | None, user_agent: str) -> None:
    try:
        user = get_user_model().objects.get(email=email)
    except get_user_model().DoesNotExist:
        return

    token = _generate_reset_token()
    token_hash = _hash_reset_token(token)

    with transaction.atomic():
        _invalidate_user_password_resets(user, now=timezone.now())

        reset = models.PasswordReset.objects.create(
            user=user,
            token_hash=token_hash,
            requester_ip=ip,
            requester_user_agent=user_agent,
        )

        def _dispatch():
            with messages.MessagePublisher.from_environment_variables() as publisher:
                publisher.publish_message_password_reset(reset.id, token)

        transaction.on_commit(_dispatch)


def find_valid_reset_by_token(
    token: str, for_update: bool = False
) -> models.PasswordReset | None:
    qs = models.PasswordReset.objects.all()

    if for_update:
        qs = qs.select_for_update()

    try:
        return qs.valid().get(token_hash=_hash_reset_token(token))
    except models.PasswordReset.DoesNotExist:
        return None


def confirm_password_reset(
    token: str, new_password: str, ip: str | None, user_agent: str
) -> bool:
    with transaction.atomic():
        reset = find_valid_reset_by_token(token, for_update=True)
        if reset is None:
            return False
        now = timezone.now()
        reset.used_at = now
        reset.used_ip = ip
        reset.used_user_agent = user_agent
        reset.save(update_fields=["used_at", "used_ip", "used_user_agent"])

        user = reset.user
        user.set_password(new_password)
        user.save(update_fields=["password"])

        invalidate_user_sessions(user)
        _invalidate_user_password_resets(user, now=now)
    return True
