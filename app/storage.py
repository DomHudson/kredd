import logging

import boto3
from botocore.client import Config

from kreddapp import env


logger = logging.getLogger(__name__)


def _client():
    return boto3.client(
        "s3",
        endpoint_url=env.MINIO_ENDPOINT,
        aws_access_key_id=env.MINIO_ACCESS_KEY,
        aws_secret_access_key=env.MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
    )


def ensure_bucket():
    client = _client()
    try:
        client.head_bucket(Bucket=env.MINIO_BUCKET)
    except client.exceptions.ClientError:
        client.create_bucket(Bucket=env.MINIO_BUCKET)
        logger.info("Created MinIO bucket: %s", env.MINIO_BUCKET)


def upload(key: str, file_obj, content_type: str):
    _client().upload_fileobj(
        file_obj,
        env.MINIO_BUCKET,
        key,
        ExtraArgs={"ContentType": content_type},
    )


def stream(key: str):
    """Return the boto3 streaming body for a stored object."""
    response = _client().get_object(Bucket=env.MINIO_BUCKET, Key=key)
    return (
        response["Body"],
        response.get("ContentType", "application/octet-stream"),
        response["ContentLength"],
    )


def delete(key: str):
    _client().delete_object(Bucket=env.MINIO_BUCKET, Key=key)
