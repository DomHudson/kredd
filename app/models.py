from datetime import timedelta

from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.contrib.sessions.backends.db import SessionStore as DBStore
from django.contrib.sessions.base_session import AbstractBaseSession
from django.db import models
from django.utils import timezone

from kreddapp import env


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, first_name="", last_name=""):
        if not email:
            raise ValueError("Email is required")
        user = self.model(
            email=self.normalize_email(email),
            first_name=first_name,
            last_name=last_name,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password):
        user = self.create_user(email, password)
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=64)
    last_name = models.CharField(max_length=64)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()


class Topic(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
    )
    name = models.CharField(max_length=32)
    description = models.TextField(default="")
    submission_instructions = models.TextField(default="")
    url_suffix = models.CharField(
        max_length=136,
        unique=True,
        null=False,
        db_collation="utf8mb4_bin",
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    closed_at = models.DateTimeField(null=True, default=None)

    @property
    def absolute_url(self):
        return "/".join((env.SITE_URL, "contact", self.url_suffix))


class Question(models.Model):
    topic = models.ForeignKey(
        Topic,
        on_delete=models.CASCADE,
    )
    text = models.TextField(null=False)
    model_answer = models.TextField(null=False)


class Outreach(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.PROTECT)
    first_name = models.CharField(max_length=64)
    last_name = models.CharField(max_length=64)
    email = models.EmailField()
    linkedin_url = models.URLField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, default=None)
    feedback = models.BooleanField(null=True, default=None)
    feedback_at = models.DateTimeField(null=True, default=None)


class OutreachAnalysis(models.Model):
    outreach = models.ForeignKey(
        Outreach,
        on_delete=models.CASCADE,
    )
    summary = models.TextField(null=False)
    score = models.FloatField(null=False)
    relevance_score = models.FloatField(null=False)
    completeness_score = models.FloatField(null=False)
    credibility_score = models.FloatField(null=False)
    created_at = models.DateTimeField(auto_now_add=True)
    llm_response = models.TextField(default="")
    model_name = models.CharField(max_length=128, default="")


class OutreachAnalysisFollowUp(models.Model):
    outreach_analysis = models.ForeignKey(
        OutreachAnalysis,
        on_delete=models.CASCADE,
    )
    text = models.TextField(null=False)


class OutreachAttachment(models.Model):
    outreach = models.ForeignKey(
        Outreach, on_delete=models.CASCADE, related_name="attachments"
    )
    filename = models.CharField(max_length=255)
    storage_key = models.CharField(max_length=512)
    file_size = models.IntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)


class OutreachQuestionResponse(models.Model):
    outreach = models.ForeignKey(Outreach, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.PROTECT)
    response = models.TextField()


class OutreachView(models.Model):
    outreach = models.ForeignKey(
        Outreach, on_delete=models.CASCADE, related_name="views"
    )
    viewed_at = models.DateTimeField(auto_now_add=True)


class OnboardingPrefill(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
    )
    inbound_description = models.TextField(default="")
    role_description = models.TextField(default="")
    llm_response = models.TextField(default="")
    model_name = models.CharField(max_length=128, default="")
    created_at = models.DateTimeField(auto_now_add=True)


class PasswordResetQuerySet(models.QuerySet):
    def valid(self):
        return self.filter(
            used_at__isnull=True,
            invalidated_at__isnull=True,
            created_at__gte=(
                timezone.now() - timedelta(seconds=env.PASSWORD_RESET_TTL_SECONDS)
            ),
        )


class PasswordReset(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, default=None)
    invalidated_at = models.DateTimeField(null=True, default=None)
    token_hash = models.CharField(max_length=64, unique=True)
    requester_ip = models.GenericIPAddressField(null=True, default=None)
    requester_user_agent = models.TextField(default="")
    used_ip = models.GenericIPAddressField(null=True, default=None)
    used_user_agent = models.TextField(default="")

    objects = PasswordResetQuerySet.as_manager()


class NewTopicPrefill(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
    )
    description = models.TextField(default="")
    llm_response = models.TextField(default="")
    model_name = models.CharField(max_length=128, default="")
    created_at = models.DateTimeField(auto_now_add=True)


class UserSession(AbstractBaseSession):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.CASCADE,
    )

    @classmethod
    def get_session_store_class(cls):
        return UserSessionStore


class UserSessionStore(DBStore):
    @classmethod
    def get_model_class(cls):
        return UserSession

    def create_model_instance(self, data):
        obj = super().create_model_instance(data)
        try:
            obj.user_id = int(data["_auth_user_id"])
        except (KeyError, ValueError, TypeError):
            obj.user_id = None
        return obj
