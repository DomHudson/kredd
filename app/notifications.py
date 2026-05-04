import logging
import smtplib
from email.message import EmailMessage

from django.template.loader import render_to_string
from django.contrib.auth import get_user_model

from app import constants, scoring
from kreddapp import env


logger = logging.getLogger(__name__)


class EmailClient:
    def __init__(self, host: str, port: int, address: str, app_password: str):
        self._host = host
        self._port = port
        self._address = address
        self._app_password = app_password
        self._smtp: smtplib.SMTP | None = None

    @classmethod
    def from_environment_variables(cls) -> "EmailClient":
        return cls(
            host=env.GMAIL_SMTP_HOST,
            port=env.GMAIL_PORT,
            address=env.GMAIL_ADDRESS,
            app_password=env.GMAIL_APP_PASSWORD,
        )

    def __enter__(self) -> "EmailClient":
        self._smtp = smtplib.SMTP(self._host, self._port)
        self._smtp.__enter__()
        self._smtp.starttls()
        self._smtp.login(self._address, self._app_password)
        return self

    def __exit__(self, *args) -> None:
        return self._smtp.__exit__(*args)

    def send_email(
        self, to: str, subject: str, body: str, html_body: str | None = None
    ) -> None:
        msg = EmailMessage()
        msg["From"] = f"Kredd <{self._address}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        if html_body:
            msg.add_alternative(html_body, subtype="html")
        self._smtp.send_message(msg)
        logger.debug("Email sent to %s — subject: %s", to, subject)


def send_staff_email(subject: str, body: str, html_body: str | None = None) -> None:
    if not env.GMAIL_APP_PASSWORD:
        logger.warning("No Gmail app password set - skipping staff notification(s).")
        return

    staff_emails = list(
        get_user_model().objects.filter(is_staff=True).values_list("email", flat=True)
    )
    if not staff_emails:
        logger.warning("No staff users found to notify.")
        return

    with EmailClient.from_environment_variables() as client:
        for email in staff_emails:
            client.send_email(to=email, subject=subject, body=body, html_body=html_body)


def send_staff_topic_notification(topic) -> None:
    html_body = render_to_string(
        "emails/staff_topic_notification.html",
        {
            "site_url": env.SITE_URL,
            "topic": topic,
        },
    )
    plain_body = (
        f"New topic created on Kredd.\n\n"
        f"Name: {topic.name}\n"
        f"Owner: {topic.user.first_name} {topic.user.last_name} <{topic.user.email}>\n"
        f"Questions: {topic.question_set.count()}\n"
    )
    send_staff_email(
        subject=f"Staff Notification: New Topic — {topic.name}",
        body=plain_body,
        html_body=html_body,
    )


def send_staff_outreach_notification(outreach) -> None:
    html_body = render_to_string(
        "emails/staff_outreach_notification.html",
        {
            "site_url": env.SITE_URL,
            "outreach": outreach,
        },
    )
    plain_body = (
        f"New outreach on Kredd.\n\n"
        f"Name: {outreach.first_name} {outreach.last_name}\n"
        f"Email: {outreach.email}\n"
        f"Topic: {outreach.topic.name}\n"
        f"Submitted: {outreach.created_at.strftime('%d %b %Y, %H:%M')} UTC\n"
    )
    send_staff_email(
        subject=f"Staff Notification: New Outreach from {outreach.first_name} {outreach.last_name}",
        body=plain_body,
        html_body=html_body,
    )


def send_staff_signup_notifications(user) -> None:
    plain_body = (
        f"New signup on Kredd.\n\n"
        f"Name: {user.first_name} {user.last_name}\n"
        f"Email: {user.email}\n"
        f"Signed up: {user.date_joined.strftime('%d %b %Y, %H:%M')} UTC\n"
    )
    html_body = render_to_string(
        "emails/signup_notification.html",
        {
            "site_url": env.SITE_URL,
            "user": user,
        },
    )

    send_staff_email(
        subject="Staff Notification: New Signup",
        body=plain_body,
        html_body=html_body,
    )


def send_password_reset_notification(user, token: str) -> None:
    if not env.GMAIL_APP_PASSWORD:
        logger.warning("No Gmail app password set - skipping password reset email.")
        return

    reset_url = f"{env.SITE_URL}/resetpassword?token={token}"
    html_body = render_to_string(
        "emails/password_reset.html",
        {"site_url": env.SITE_URL, "user": user, "reset_url": reset_url},
    )
    plain_body = (
        f"Hi {user.first_name},\n\n"
        f"We received a request to reset your Kredd password. "
        f"Open the link below to choose a new one:\n\n"
        f"{reset_url}\n\n"
        f"If you didn't request this, you can safely ignore this email.\n"
    )
    with EmailClient.from_environment_variables() as client:
        client.send_email(
            to=user.email,
            subject="Reset your password",
            body=plain_body,
            html_body=html_body,
        )


def send_outreach_notification(
    outreach, outreach_scorer_result: scoring.OutreachScorerResult
) -> None:
    if not env.GMAIL_APP_PASSWORD:
        logger.warning("No Gmail app password set - skipping email notification.")
        return

    if outreach_scorer_result.score >= constants.SCORE_GREEN_THRESHOLD:
        score_color = "#22c55e"  # Green
    elif outreach_scorer_result.score >= constants.SCORE_AMBER_THRESHOLD:
        score_color = "#f59e0b"  # Amber
    else:
        score_color = "#ef4444"  # Red

    score_pct = round(outreach_scorer_result.score * 100)

    responses = outreach.outreachquestionresponse_set.select_related("question").all()

    html_body = render_to_string(
        "emails/outreach_notification.html",
        {
            "site_url": env.SITE_URL,
            "outreach": outreach,
            "llm_summary": outreach_scorer_result.llm_data["rationale"],
            "score_display": score_pct,
            "score_color": score_color,
            "responses": responses,
        },
    )

    plain = (
        f"New outreach from {outreach.first_name} {outreach.last_name}\n\n"
        f"Email: {outreach.email}\n"
        f"Topic: {outreach.topic.name}\n"
        f"LinkedIn: {outreach.linkedin_url or 'None provided'}\n"
        f"Score: {score_pct}\n"
        f"{outreach_scorer_result.llm_data['rationale']}"
    )

    with EmailClient.from_environment_variables() as client:
        client.send_email(
            to=outreach.topic.user.email,
            subject=f"{outreach.topic.name}: Outreach from {outreach.first_name} {outreach.last_name}",
            body=plain,
            html_body=html_body,
        )
