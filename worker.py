import json
import logging
import time

import django

django.setup()
import django.db  # noqa: E402
from django.contrib.auth import get_user_model  # noqa: E402
import pika  # noqa: E402

from app import notifications  # noqa: E402
from app import models  # noqa: E402
from app.scoring import OutreachScorer  # noqa: E402
from kreddapp import env  # noqa: E402


logging.basicConfig(level=logging.DEBUG)
logging.getLogger("pika").setLevel(logging.INFO)  # Pika is extremely noisy.

logger: logging.Logger = logging.getLogger(__name__)
scorer: OutreachScorer = OutreachScorer.from_cross_encoder_path(
    env.SEMANTIC_SIMILARITY_MODEL
)


def process_outreach(outreach_id: int):
    logger.info("Processing outreach id=%s", outreach_id)

    outreach = (
        models.Outreach.objects.select_related("topic__user")
        .prefetch_related("attachments", "outreachquestionresponse_set__question")
        .get(id=outreach_id)
    )

    if models.OutreachAnalysis.objects.filter(outreach=outreach).exists():
        raise Exception(f"Outreach id={outreach_id} already processed, skipping")

    result = scorer.score(outreach)

    if not result.llm_data:
        raise Exception(
            f"LLM analysis failed for outreach id=%{outreach_id}, skipping analysis creation"
        )

    analysis = models.OutreachAnalysis.objects.create(
        outreach=outreach,
        score=result.score,
        summary=result.llm_data["rationale"],
        relevance_score=result.llm_data["relevance_score"] / 100,
        completeness_score=result.llm_data["completeness_score"] / 100,
        credibility_score=result.llm_data["credibility_score"] / 100,
        llm_response=result.llm_raw_response,
        model_name=env.CLAUDE_MODEL or "",
    )
    models.OutreachAnalysisFollowUp.objects.bulk_create(
        models.OutreachAnalysisFollowUp(outreach_analysis=analysis, text=text)
        for text in (t.strip() for t in result.llm_data.get("followups", []))
        if text
    )

    notifications.send_outreach_notification(outreach, result)
    logger.info("Outreach id=%s processed", outreach_id)


def process_staff_notification_topic(topic_id: int):
    logger.info("Processing staff topic notification for topic id=%s", topic_id)
    try:
        topic = (
            models.Topic.objects.select_related("user")
            .prefetch_related("question_set")
            .get(id=topic_id)
        )
    except models.Topic.DoesNotExist:
        logger.error("Topic id=%s not found for staff notification", topic_id)
        return
    notifications.send_staff_topic_notification(topic)
    logger.info("Staff topic notification sent for topic id=%s", topic_id)


def process_staff_notification_outreach(outreach_id: int):
    logger.info(
        "Processing staff outreach notification for outreach id=%s", outreach_id
    )
    try:
        outreach = models.Outreach.objects.select_related("topic__user").get(
            id=outreach_id
        )
    except models.Outreach.DoesNotExist:
        logger.error("Outreach id=%s not found for staff notification", outreach_id)
        return
    notifications.send_staff_outreach_notification(outreach)
    logger.info("Staff outreach notification sent for outreach id=%s", outreach_id)


def process_password_reset(password_reset_id: int, token: str):
    logger.info("Processing password reset id=%s", password_reset_id)
    try:
        reset = models.PasswordReset.objects.select_related("user").get(
            id=password_reset_id
        )
    except models.PasswordReset.DoesNotExist:
        logger.error("PasswordReset id=%s not found", password_reset_id)
        return
    notifications.send_password_reset_notification(reset.user, token)
    logger.info("Password reset email sent for id=%s", password_reset_id)


def process_staff_notification_signup(user_id: int):
    logger.info("Processing signup notification for user id=%s", user_id)
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error("User id=%s not found for signup notification", user_id)
        return
    notifications.send_staff_signup_notifications(user)
    logger.info("Signup notification sent for user id=%s", user_id)


def process(channel, method, properties, body):
    django.db.close_old_connections()

    try:
        message = json.loads(body)

        message_type = message.get("type")
        data = message.get("data", {})

        if message_type == "outreach":
            process_outreach(data["outreach_id"])
        elif message_type == "staff_notification.topic":
            process_staff_notification_topic(data["topic_id"])
        elif message_type == "staff_notification.outreach":
            process_staff_notification_outreach(data["outreach_id"])
        elif message_type == "staff_notification.signup":
            process_staff_notification_signup(data["user_id"])
        elif message_type == "password_reset":
            process_password_reset(data["password_reset_id"], data["token"])
        else:
            raise Exception(f"Unknown message type: {message}")

        channel.basic_ack(delivery_tag=method.delivery_tag)

    except Exception:
        logger.exception("Task failed")
        # TODO - update to requeue the first N times, and then send to dead letter exchange.
        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    finally:
        django.db.close_old_connections()


def main():
    while True:
        try:
            connection = pika.BlockingConnection(pika.URLParameters(env.RABBITMQ_URL))
            channel = connection.channel()
            channel.queue_declare(queue=env.WORKER_QUEUE, durable=True)
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=env.WORKER_QUEUE, on_message_callback=process)
            logger.info("Worker started, waiting for messages...")
            channel.start_consuming()
        except Exception as e:
            logger.error(
                "Connection lost due to exception, retrying in 1s... Exception: %s", e
            )
            # TODO - exponential backoff
            time.sleep(1)


if __name__ == "__main__":
    main()
