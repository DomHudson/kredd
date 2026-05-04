import logging

from decouple import config


logger = logging.getLogger(__name__)

_DEFAULT_SECRET_KEY = (
    "django-insecure-x!^h2)po4h&1@==-b4bo10cn$b%-3=!3dkv@^8s6#x+u#glcqj"
)

SECRET_KEY = config("KREDD_DJANGO_SECRET_KEY", default=_DEFAULT_SECRET_KEY)
if SECRET_KEY == _DEFAULT_SECRET_KEY:
    logger.warning(
        "KREDD_DJANGO_SECRET_KEY is set to the default insecure value — do not run in production."
    )

DEBUG = config("KREDD_DJANGO_DEBUG", default=False, cast=bool)
if DEBUG:
    logger.warning("DEBUG mode is enabled — do not run in production.")


CLAUDE_API_KEY = config("KREDD_CLAUDE_API_KEY", default="")
CLAUDE_MODEL = config("KREDD_CLAUDE_MODEL", default="claude-haiku-4-5-20251001")

DB_NAME = config("KREDD_DB_NAME", default="kredd")
DB_USER = config("KREDD_DB_USER", default="root")
DB_PASSWORD = config("KREDD_DB_PASSWORD", default="root")
DB_HOST = config("KREDD_DB_HOST", default="127.0.0.1")
DB_PORT = config("KREDD_DB_PORT", default="3306")

GMAIL_ADDRESS = config("KREDD_GMAIL_ADDRESS", default="hello@kredd.io")
GMAIL_APP_PASSWORD = config("KREDD_GMAIL_APP_PASSWORD", default="")
GMAIL_PORT = config("KREDD_GMAIL_PORT", default=587, cast=int)
GMAIL_SMTP_HOST = config("KREDD_GMAIL_SMTP_HOST", default="smtp.gmail.com")

MAX_ATTACHMENT_BYTES = config(
    "KREDD_MAX_ATTACHMENT_BYTES", default=10 * 1024 * 1024, cast=int
)  # Default = 10 MB

MINIO_ENDPOINT = config("KREDD_MINIO_ENDPOINT", default="http://localhost:9000")
MINIO_ACCESS_KEY = config("KREDD_MINIO_ACCESS_KEY", default="kredd_minio")
MINIO_SECRET_KEY = config("KREDD_MINIO_SECRET_KEY", default="kredd_minio_secret")
MINIO_BUCKET = config("KREDD_MINIO_BUCKET", default="attachments")

PASSWORD_RESET_TTL_SECONDS = config(
    "KREDD_PASSWORD_RESET_TTL_SECONDS", default=24 * 60 * 60, cast=int
)

RABBITMQ_URL = config(
    "KREDD_RABBITMQ_URL", default="amqp://guest:guest@localhost:5672/"
)
WORKER_QUEUE = config("KREDD_WORKER_QUEUE", default="outreach_processing")

SEMANTIC_SIMILARITY_MODEL = config(
    "KREDD_SEMANTIC_SIMILARITY_MODEL", default="/app/ml_models/stsb-TinyBERT-L4"
)

SITE_URL = config("KREDD_SITE_URL", default="http://127.0.0.1")
