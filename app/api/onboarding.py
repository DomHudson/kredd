from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from app import llm, messages, models
from app.api.helpers import api_login_required, generate_url_suffix
from kreddapp import env


@require_POST
@api_login_required
def complete_onboarding(request):
    data = request.get_json()
    topics = data.get("topics", [])

    if not topics:
        return JsonResponse({"error": "At least one topic is required."}, status=400)

    created = []
    with transaction.atomic():
        for topic in topics:
            questions = topic.get("questions", [])
            if not questions:
                return JsonResponse(
                    {
                        "error": f"Topic '{topic.get('name', '')}' must have at least one question."
                    },
                    status=400,
                )
            u = request.get_effective_user()
            topic = models.Topic.objects.create(
                user=u,
                name=topic["name"],
                description=topic.get("description", ""),
                url_suffix=generate_url_suffix(u),
            )
            models.Question.objects.bulk_create(
                models.Question(
                    topic=topic,
                    text=question["text"],
                    model_answer=question.get("model_answer", ""),
                )
                for question in questions
            )
            created.append(
                {"id": topic.id, "name": topic.name, "url": topic.absolute_url}
            )

    with messages.MessagePublisher.from_environment_variables() as publisher:
        for topic in created:
            publisher.publish_message_staff_topic(topic["id"])

    return JsonResponse({"topics": created})


@require_POST
@api_login_required
def onboarding_prefill(request):
    data = request.get_json()

    role_description = data.get("role", "").strip()
    inbound_description = data.get("description", "").strip()

    if not role_description and not inbound_description:
        return JsonResponse(
            {"error": "At least role or description must be populated."},
            status=400,
        )

    parsed, raw_response = llm.generate_onboarding_prefill(
        role_description=role_description, inbound_description=inbound_description
    )

    models.OnboardingPrefill.objects.create(
        user=request.get_effective_user(),
        inbound_description=inbound_description,
        role_description=role_description,
        llm_response=raw_response,
        model_name=env.CLAUDE_MODEL or "",
    )

    return JsonResponse(parsed)
