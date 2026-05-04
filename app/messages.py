import json
import logging

import pika

from kreddapp import env


logger = logging.getLogger(__name__)


class MessagePublisher:
    def __init__(self, rabbitmq_url: str, worker_queue: str) -> None:
        self._rabbitmq_url: str = rabbitmq_url
        self._worker_queue: str = worker_queue
        self._connection: pika.BlockingConnection | None = None
        self._channel: pika.BlockingChannel | None = None

    @classmethod
    def from_environment_variables(cls) -> "MessagePublisher":
        return cls(
            rabbitmq_url=env.RABBITMQ_URL,
            worker_queue=env.WORKER_QUEUE,
        )

    def __enter__(self) -> "MessagePublisher":
        self._connection = pika.BlockingConnection(
            pika.URLParameters(self._rabbitmq_url)
        )
        self._channel = self._connection.channel()
        self._channel.queue_declare(queue=self._worker_queue, durable=True)
        return self

    def __exit__(self, *args) -> None:
        self._connection.close()

    def _publish(self, message: dict) -> None:
        self._channel.basic_publish(
            exchange="",
            routing_key=self._worker_queue,
            body=json.dumps(message),
            properties=pika.BasicProperties(delivery_mode=2),
        )
        logger.debug("Dispatched message %s to RabbitMQ", message)

    def publish_message_outreach(self, outreach_id: int) -> None:
        self._publish(
            {"type": "outreach", "version": 1, "data": {"outreach_id": outreach_id}}
        )

    def publish_message_signup(self, user_id: int) -> None:
        self._publish(
            {
                "type": "staff_notification.signup",
                "version": 1,
                "data": {"user_id": user_id},
            }
        )

    def publish_message_staff_outreach(self, outreach_id: int) -> None:
        self._publish(
            {
                "type": "staff_notification.outreach",
                "version": 1,
                "data": {"outreach_id": outreach_id},
            }
        )

    def publish_message_password_reset(
        self, password_reset_id: int, token: str
    ) -> None:
        self._publish(
            {
                "type": "password_reset",
                "version": 1,
                "data": {
                    "password_reset_id": password_reset_id,
                    "token": token,
                },
            }
        )

    def publish_message_staff_topic(self, topic_id: int) -> None:
        self._publish(
            {
                "type": "staff_notification.topic",
                "version": 1,
                "data": {"topic_id": topic_id},
            }
        )
