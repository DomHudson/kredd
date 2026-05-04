import logging
import uuid

from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.http import require_POST
from kreddapp import env

from app import models, storage
from app.api.helpers import api_login_required


logger = logging.getLogger(__name__)


@require_POST
def upload_attachment(request, outreach_id):
    try:
        outreach = models.Outreach.objects.get(id=outreach_id)
    except models.Outreach.DoesNotExist:
        return JsonResponse({"error": "Not found."}, status=404)

    file = request.FILES.get("file")
    if not file:
        return JsonResponse({"error": "No file provided."}, status=400)

    if file.size > env.MAX_ATTACHMENT_BYTES:
        return JsonResponse({"error": "File exceeds 10 MB limit."}, status=400)

    key = f"outreaches/{outreach_id}/{uuid.uuid4()}/{file.name}"
    try:
        storage.ensure_bucket()
        storage.upload(key, file, file.content_type or "application/octet-stream")
    except Exception:
        logger.exception("Failed to upload attachment for outreach id=%s", outreach_id)
        return JsonResponse({"error": "Upload failed."}, status=500)

    attachment = models.OutreachAttachment.objects.create(
        outreach=outreach,
        filename=file.name,
        storage_key=key,
        file_size=file.size,
    )
    return JsonResponse(
        {
            "id": attachment.id,
            "filename": attachment.filename,
            "file_size": attachment.file_size,
        }
    )


@api_login_required
def download_attachment(request, outreach_id, attachment_id):
    try:
        attachment = models.OutreachAttachment.objects.select_related(
            "outreach__topic__user"
        ).get(id=attachment_id, outreach_id=outreach_id)
    except models.OutreachAttachment.DoesNotExist:
        return JsonResponse({"error": "Not found."}, status=404)
    if attachment.outreach.topic.user != request.get_effective_user():
        return JsonResponse({"error": "Not found."}, status=404)

    try:
        body, content_type, content_length = storage.stream(attachment.storage_key)
    except Exception:
        logger.exception("Failed to stream attachment id=%s", attachment_id)
        return JsonResponse({"error": "Download failed."}, status=500)

    response = StreamingHttpResponse(body.iter_chunks(), content_type=content_type)
    response["Content-Length"] = content_length
    response["Content-Disposition"] = f'attachment; filename="{attachment.filename}"'
    return response
