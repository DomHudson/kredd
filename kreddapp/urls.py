from django.contrib import admin
from django.urls import path

import app.api.admin
import app.api.attachments
import app.api.auth
import app.api.topics
import app.api.onboarding
import app.api.outreaches


urlpatterns = [
    path("admin/django/", admin.site.urls),
    # API - Auth
    path("api/auth/me/", app.api.auth.me_view, name="api_me"),
    path("api/auth/me/update/", app.api.auth.update_me, name="api_update_me"),
    path("api/auth/login/", app.api.auth.login_view, name="api_login"),
    path("api/auth/logout/", app.api.auth.logout_view, name="api_logout"),
    path("api/auth/signup/", app.api.auth.signup_view, name="api_signup"),
    path(
        "api/auth/password-reset/request/",
        app.api.auth.password_reset_request_view,
        name="api_password_reset_request",
    ),
    path(
        "api/auth/password-reset/validate/",
        app.api.auth.password_reset_validate_view,
        name="api_password_reset_validate",
    ),
    path(
        "api/auth/password-reset/confirm/",
        app.api.auth.password_reset_confirm_view,
        name="api_password_reset_confirm",
    ),
    # API - Admin
    path(
        "api/admin/users/",
        app.api.admin.users_view,
        name="api_admin_users",
    ),
    path(
        "api/admin/users/<int:user_id>/set-active/",
        app.api.admin.set_active_view,
        name="api_set_user_active",
    ),
    path(
        "api/admin/users/<int:user_id>/set-staff/",
        app.api.admin.set_staff_view,
        name="api_set_user_staff",
    ),
    path(
        "api/admin/impersonate/<int:user_id>/",
        app.api.admin.impersonate_view,
        name="api_impersonate",
    ),
    path(
        "api/admin/impersonate/stop/",
        app.api.admin.stop_impersonating_view,
        name="api_stop_impersonate",
    ),
    path(
        "api/admin/users/<int:user_id>/force-logout/",
        app.api.admin.force_logout_view,
        name="api_force_logout",
    ),
    # API - Onboarding
    path(
        "api/onboarding/",
        app.api.onboarding.complete_onboarding,
        name="api_complete_onboarding",
    ),
    path(
        "api/onboarding/prefill/",
        app.api.onboarding.onboarding_prefill,
        name="api_onboarding_prefill",
    ),
    # API - Topics
    path(
        "api/topics/",
        app.api.topics.topics_view,
        name="api_topics",
    ),
    path(
        "api/topics/prefill/",
        app.api.topics.new_topic_prefill,
        name="api_new_topic_prefill",
    ),
    path(
        "api/topics/<int:topic_id>/close/",
        app.api.topics.set_topic_closed,
        name="api_topic_close",
    ),
    path(
        "api/topics/<str:url_suffix>/",
        app.api.topics.get_topic_public,
        name="api_topic_public",
    ),
    # API - Outreaches
    path(
        "api/outreaches/",
        app.api.outreaches.outreaches_view,
        name="api_outreaches",
    ),
    path(
        "api/outreaches/<int:outreach_id>/",
        app.api.outreaches.get_outreach_detailed,
        name="api_get_outreach",
    ),
    path(
        "api/outreaches/<int:outreach_id>/view/",
        app.api.outreaches.record_outreach_view,
        name="api_record_outreach_view",
    ),
    path(
        "api/outreaches/<int:outreach_id>/feedback/",
        app.api.outreaches.set_outreach_feedback,
        name="api_set_outreach_feedback",
    ),
    path(
        "api/outreaches/<int:outreach_id>/finalize/",
        app.api.outreaches.finalize_outreach,
        name="api_finalize_outreach",
    ),
    # API - Attachments
    path(
        "api/outreaches/<int:outreach_id>/attachments/",
        app.api.attachments.upload_attachment,
        name="api_upload_attachment",
    ),
    path(
        "api/outreaches/<int:outreach_id>/attachments/<int:attachment_id>/",
        app.api.attachments.download_attachment,
        name="api_download_attachment",
    ),
]
