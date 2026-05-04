import logging

from django.db import transaction
from django.db.models import Count, OuterRef, Subquery
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from app import constants, llm, messages, models
from app.api.helpers import api_login_required, generate_url_suffix
from kreddapp import env


logger = logging.getLogger(__name__)


def _fit_count_subquery(score_min, score_max=None):
    latest_score = Subquery(
        models.OutreachAnalysis.objects.filter(outreach=OuterRef("pk"))
        .order_by("-created_at")
        .values("score")[:1]
    )
    qs = (
        models.Outreach.objects.filter(topic=OuterRef("pk"))
        .annotate(latest_score=latest_score)
        .filter(latest_score__gte=score_min)
    )
    if score_max is not None:
        qs = qs.filter(latest_score__lt=score_max)
    return Subquery(qs.values("topic").annotate(c=Count("id")).values("c")[:1])


@api_login_required
def topics_view(request):
    if request.method == "GET":
        topics = models.Topic.objects.filter(
            user=request.get_effective_user()
        ).annotate(
            outreach_count=Count("outreach"),
            strong_fit_count=_fit_count_subquery(constants.SCORE_GREEN_THRESHOLD),
            potential_fit_count=_fit_count_subquery(
                constants.SCORE_AMBER_THRESHOLD, constants.SCORE_GREEN_THRESHOLD
            ),
            weak_fit_count=_fit_count_subquery(0.0, constants.SCORE_AMBER_THRESHOLD),
        )
        return JsonResponse(
            {
                "topics": [
                    {
                        "id": i.id,
                        "name": i.name,
                        "description": i.description,
                        "url": i.absolute_url,
                        "outreach_count": i.outreach_count,
                        "closed_at": i.closed_at.isoformat() if i.closed_at else None,
                        "stats": {
                            "strong_fit": i.strong_fit_count or 0,
                            "potential_fit": i.potential_fit_count or 0,
                            "weak_fit": i.weak_fit_count or 0,
                        },
                    }
                    for i in topics
                ]
            }
        )

    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed."}, status=405)

    data = request.get_json()
    name = (data.get("name") or "").strip()
    questions = data.get("questions", [])

    if not name:
        return JsonResponse({"error": "Name is required."}, status=400)
    if not questions:
        return JsonResponse({"error": "At least one question is required."}, status=400)

    with transaction.atomic():
        u = request.get_effective_user()
        topic = models.Topic.objects.create(
            user=u,
            name=name,
            description=data.get("description", ""),
            submission_instructions=data.get("submission_instructions", ""),
            url_suffix=generate_url_suffix(u),
        )
        models.Question.objects.bulk_create(
            [
                models.Question(
                    topic=topic,
                    text=question.get("text", ""),
                    model_answer=question.get("model_answer", ""),
                )
                for question in questions
            ]
        )

    with messages.MessagePublisher.from_environment_variables() as publisher:
        publisher.publish_message_staff_topic(topic.id)
    return JsonResponse({"id": topic.id, "url": topic.absolute_url})


@require_POST
@api_login_required
def new_topic_prefill(request):
    data = request.get_json()
    description = data.get("description", "").strip()

    if not description:
        return JsonResponse({"error": "Description is required."}, status=400)

    parsed, raw_response = llm.generate_new_topic_prefill(
        description=description,
    )

    models.NewTopicPrefill.objects.create(
        user=request.get_effective_user(),
        description=description,
        llm_response=raw_response,
        model_name=env.CLAUDE_MODEL or "",
    )

    return JsonResponse(parsed)


@require_POST
@api_login_required
def set_topic_closed(request, topic_id):
    try:
        topic = models.Topic.objects.get(id=topic_id, user=request.get_effective_user())
    except models.Topic.DoesNotExist:
        return JsonResponse({"error": "Not found."}, status=404)
    data = request.get_json()
    closed = data.get("closed")
    if closed not in (True, False):
        return JsonResponse({"error": "closed must be true or false."}, status=400)
    topic.closed_at = timezone.now() if closed else None
    topic.save(update_fields=["closed_at"])
    return JsonResponse(
        {"closed_at": topic.closed_at.isoformat() if topic.closed_at else None}
    )


def get_topic_public(_request, url_suffix):
    try:
        topic = (
            models.Topic.objects.select_related("user")
            .prefetch_related("question_set")
            .get(url_suffix=url_suffix)
        )
    except models.Topic.DoesNotExist:
        return JsonResponse({"error": "Not found."}, status=404)

    return JsonResponse(
        {
            "topic": {
                "id": topic.id,
                "submission_instructions": topic.submission_instructions,
                "owner_first_name": topic.user.first_name,
                "owner_last_name": topic.user.last_name,
                "closed_at": topic.closed_at.isoformat() if topic.closed_at else None,
            },
            "questions": [
                {"id": r.id, "text": r.text} for r in topic.question_set.all()
            ],
        }
    )
