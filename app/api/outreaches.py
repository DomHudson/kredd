import logging

from django.db.models import Count, Exists, OuterRef, Subquery
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from app import messages, models
from app.api.helpers import api_login_required


logger = logging.getLogger(__name__)


def outreaches_view(request):
    if request.method == "GET":
        return _get_outreaches(request)
    if request.method == "POST":
        return _create_outreach(request)
    return JsonResponse({"error": "Method not allowed."}, status=405)


_latest_analysis_score = Subquery(
    models.OutreachAnalysis.objects.filter(outreach=OuterRef("pk"))
    .order_by("-created_at")
    .values("score")[:1]
)

_latest_analysis_summary = Subquery(
    models.OutreachAnalysis.objects.filter(outreach=OuterRef("pk"))
    .order_by("-created_at")
    .values("summary")[:1]
)


@api_login_required
def _get_outreaches(request):
    outreaches = (
        models.Outreach.objects.filter(topic__user=request.get_effective_user())
        .select_related("topic")
        .annotate(
            is_unread=~Exists(
                models.OutreachView.objects.filter(outreach=OuterRef("pk"))
            ),
            attachment_count=Count("attachments"),
            latest_score=_latest_analysis_score,
            latest_summary=_latest_analysis_summary,
        )
        .order_by("-created_at")
    )
    return JsonResponse(
        {
            "outreaches": [
                {
                    "id": o.id,
                    "first_name": o.first_name,
                    "last_name": o.last_name,
                    "email": o.email,
                    "topic": {"id": o.topic.id, "name": o.topic.name},
                    "created_at": o.created_at.strftime("%d %b %Y, %H:%M"),
                    "analysis": {
                        "score": round(o.latest_score * 100),
                        "summary": o.latest_summary,
                    }
                    if o.latest_score is not None
                    else None,
                    "is_unread": o.is_unread,
                    "attachment_count": o.attachment_count,
                }
                for o in outreaches
            ]
        }
    )


def _create_outreach(request):
    data = request.get_json()
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    email = data.get("email", "").strip()
    linkedin_url = data.get("linkedin_url", "").strip()
    responses = data.get("responses", {})
    if not first_name or not last_name or not email:
        return JsonResponse(
            {"success": False, "error": "All fields are required."}, status=400
        )
    try:
        topic = models.Topic.objects.get(id=data.get("topic_id"))
    except models.Topic.DoesNotExist:
        return JsonResponse({"success": False, "error": "Topic not found."}, status=404)

    if topic.closed_at is not None:
        return JsonResponse({"success": False, "error": "Topic closed."}, status=403)

    outreach = models.Outreach.objects.create(
        topic=topic,
        first_name=first_name,
        last_name=last_name,
        email=email,
        linkedin_url=linkedin_url,
    )
    for question_id, response_text in responses.items():
        try:
            question = models.Question.objects.get(id=question_id, topic=topic)
        except models.Question.DoesNotExist:
            logger.error(
                "Question id=%s not found for topic id=%s during outreach submission",
                question_id,
                topic.id,
            )
            continue
        models.OutreachQuestionResponse.objects.create(
            outreach=outreach,
            question=question,
            response=response_text,
        )
    return JsonResponse({"success": True, "id": outreach.id})


def _get_latest_outreach_analysis(outreach) -> dict | None:
    analysis = (
        models.OutreachAnalysis.objects.filter(outreach=outreach)
        .order_by("-created_at")
        .first()
    )

    if analysis is None:
        return None

    follow_ups = models.OutreachAnalysisFollowUp.objects.filter(
        outreach_analysis=analysis
    )
    return {
        "summary": analysis.summary,
        "score": analysis.score,
        "relevance_score": analysis.relevance_score,
        "completeness_score": analysis.completeness_score,
        "credibility_score": analysis.credibility_score,
        "follow_ups": [{"id": f.id, "text": f.text} for f in follow_ups],
    }


@api_login_required
def get_outreach_detailed(request, outreach_id):
    try:
        outreach = models.Outreach.objects.select_related("topic").get(id=outreach_id)
    except models.Outreach.DoesNotExist:
        return JsonResponse({"error": "Not found."}, status=404)
    if outreach.topic.user != request.get_effective_user():
        return JsonResponse({"error": "Not found."}, status=404)

    attachments = models.OutreachAttachment.objects.filter(outreach=outreach)
    responses = models.OutreachQuestionResponse.objects.filter(
        outreach=outreach
    ).select_related("question")

    return JsonResponse(
        {
            "id": outreach.id,
            "topic": {"id": outreach.topic.id, "name": outreach.topic.name},
            "first_name": outreach.first_name,
            "last_name": outreach.last_name,
            "email": outreach.email,
            "linkedin_url": outreach.linkedin_url
            if "linkedin.com/" in outreach.linkedin_url.lower()
            else "",
            "created_at": outreach.created_at.strftime("%d %b %Y, %H:%M"),
            "feedback": outreach.feedback,
            "analysis": _get_latest_outreach_analysis(outreach),
            "attachments": [
                {"id": a.id, "filename": a.filename, "file_size": a.file_size}
                for a in attachments
            ],
            "responses": [
                {
                    "question_id": r.question.id,
                    "text": r.question.text,
                    "response": r.response,
                }
                for r in responses
            ],
        }
    )


@require_POST
@api_login_required
def record_outreach_view(request, outreach_id):
    try:
        outreach = models.Outreach.objects.select_related("topic").get(id=outreach_id)
    except models.Outreach.DoesNotExist:
        return JsonResponse({"error": "Not found."}, status=404)
    if outreach.topic.user != request.get_effective_user():
        return JsonResponse({"error": "Not found."}, status=404)
    models.OutreachView.objects.create(outreach=outreach)
    return JsonResponse({}, status=201)


@require_POST
@api_login_required
def set_outreach_feedback(request, outreach_id):
    try:
        outreach = models.Outreach.objects.get(id=outreach_id)
    except models.Outreach.DoesNotExist:
        return JsonResponse({"error": "Not found."}, status=404)
    if outreach.topic.user != request.get_effective_user():
        return JsonResponse({"error": "Not found."}, status=404)
    data = request.get_json()
    value = data.get("value")  # True, False, or None
    if value not in (True, False, None):
        return JsonResponse(
            {"error": "value must be true, false, or null."}, status=400
        )
    # Toggle off if same value sent again
    if outreach.feedback == value:
        outreach.feedback = None
        outreach.feedback_at = None
    else:
        outreach.feedback = value
        outreach.feedback_at = timezone.now()
    outreach.save(update_fields=["feedback", "feedback_at"])
    return JsonResponse({"feedback": outreach.feedback})


@require_POST
def finalize_outreach(request, outreach_id):
    try:
        outreach = models.Outreach.objects.get(id=outreach_id)
    except models.Outreach.DoesNotExist:
        return JsonResponse({"error": "Not found."}, status=404)
    if outreach.processed_at is not None:
        return JsonResponse(
            {"error": "Outreach has already been submitted."}, status=409
        )
    with messages.MessagePublisher.from_environment_variables() as publisher:
        publisher.publish_message_outreach(outreach.id)
        publisher.publish_message_staff_outreach(outreach.id)
    return JsonResponse({"success": True})
