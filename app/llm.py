import json
import logging
import typing

import jsonschema
import requests

from app import schemas
from kreddapp import env


_JSON_SCHEMA_NEW_TOPIC_PREFILL: dict = schemas.load_schema("new_topic_prefill.json")
_JSON_SCHEMA_ONBOARDING_PREFILL: dict = schemas.load_schema("onboarding_prefill.json")
_JSON_SCHEMA_OUTREACH_ANALYSIS: dict = schemas.load_schema("outreach_analysis.json")
_LOGGER: logging.Logger = logging.getLogger(__name__)
_SYSTEM_PROMPT: str = "You are an expert assistant."


class QAEntry(typing.TypedDict):
    text: str
    model_answer: str
    submitted_answer: str


def assess_outreach_fit(
    topic_name: str, entries: list[QAEntry], max_tokens: int = 5000
) -> str:
    questions = []
    for question_number, entry in enumerate(entries, 1):
        questions.append(f"""
        - Receiving User's Question {question_number}:
        <USER_INPUT_QUESTION_{question_number}>
        {entry["text"]}
        </USER_INPUT_QUESTION_{question_number}>

        - Receiving User's Example of a Good Answer:
        <USER_INPUT_MODEL_ANSWER_{question_number}>
        {entry["model_answer"]}
        </USER_INPUT_MODEL_ANSWER_{question_number}>

        - Sending User's Actual Answer:
        <USER_INPUT_ANSWER_{question_number}>
        {entry["submitted_answer"]}
        </USER_INPUT_ANSWER_{question_number}>
        """)

    prompt = (
        """You are assisting a user (receiving user) to estimate the fit of an inbound email against their criteria.
        You will be provided questions the receiving user wishes to know on the topic, and the answers provided in the inbound email.

        Your task is to predict:
            - An overall assessment of fit: (ENUM either "low", "medium", or "high")
            - A concise one-sentence summary of the reason for your assessment (e.g. "Strong product-market fit with proven enterprise traction and clear partnership value proposition."), AVOID any needless filler words.
            - Three subscores (each is an integer in the range [0, 100]):
                - Relevance - How well the pitch aligns with the user's priorities
                - Completeness - Depth and thoroughness of responses
                - Credibility - Evidence of track record and proof points
            - 1-4 concise one-sentence follow up questions for more information, that would help the user estimate the quality of fit. AVOID any needless filler words.

        Do NOT use any preamble. The entire response must be valid JSON, no matter what the input is.
        Do NOT include any explanations or reasoning - just the valid JSON.
        Be concise.

        Return in this format:
        {
            "overall_assessment": "medium",
            "rationale": "Interesting sustainability angle but unclear alignment with current priorities and limited scale.",
            "relevance_score": 52,
            "completeness_score": 96,
            "credibility_score": 53,
            "followups": [
                "How do you measure and verify the carbon reduction claims?",
                "What industries have you had the most success in?"
            ]
        }
        """
        f"""
        The information we have from the user is:
        - Receiving User's Name of this Topic of Emails:
        <USER_INPUT_TOPIC_NAME>
        {topic_name}
        </USER_INPUT_TOPIC_NAME>
        """ + "".join(questions)
    )

    raw_response = _call_anthropic_api(
        prompt=prompt,
        max_tokens=max_tokens,
        system_prompt=_SYSTEM_PROMPT,
    )

    try:
        data = json.loads(maybe_strip_markdown(raw_response))
        jsonschema.validate(data, schema=_JSON_SCHEMA_OUTREACH_ANALYSIS)
    except json.decoder.JSONDecodeError:
        _LOGGER.error("Failed to parse LLM's JSON. Response: %s", raw_response)
        return {}, raw_response
    except jsonschema.ValidationError as e:
        _LOGGER.error("JSON schema validation failed: %s", e)
        return {}, raw_response

    return data, raw_response


def generate_onboarding_prefill(
    role_description: str, inbound_description: str, max_tokens: int = 5000
) -> tuple[dict, str]:
    prompt = (
        """I will provide you with what we know about a user: their job role and their description of what emails they get. Note that both of these fields are optional to the user.
        Your task is to predict between 2 and 4 categories of emails they would like help managing - we call these 'topics'. They should each be 3 or fewer words.
        For each 'topic', also predict a one sentence description of the topic, and between 2 and 4 SHORT questions (called 'questions') for information that they will likely want to know on these topics from people who reach out to them on that topic, and a model answer on what a good response may look like to this question.

        Do NOT use any preamble. The entire response must be valid JSON, no matter what the input is.
        Do NOT include any explanations or reasoning - just the valid JSON.
        Be concise.

        Return in this format:
        {
            "topics": [
                {
                    "name": "",
                    "description": "",
                    "questions": [
                        {
                            "text": "",
                            "model_answer": "",
                        }
                    ]
                }
            ]
        }
        """
        f"""
        The information we have from the user is:
        - User's Role:
        <USER_INPUT_ROLE_DESCRIPTION>
        {role_description}
        </USER_INPUT_ROLE_DESCRIPTION>

        - What inbound emails does the user get?
        <USER_INPUT_INBOUND_DESCRIPTION>
        {inbound_description}
        </USER_INPUT_INBOUND_DESCRIPTION>
        """
    )

    raw_response = _call_anthropic_api(
        prompt=prompt,
        max_tokens=max_tokens,
        system_prompt=_SYSTEM_PROMPT,
    )

    try:
        data = json.loads(maybe_strip_markdown(raw_response))
        jsonschema.validate(data, schema=_JSON_SCHEMA_ONBOARDING_PREFILL)
    except json.decoder.JSONDecodeError:
        _LOGGER.error("Failed to parse LLM's JSON. Response: %s", raw_response)
        return {}, raw_response
    except jsonschema.ValidationError as e:
        _LOGGER.error("JSON schema validation failed: %s", e)
        return {}, raw_response

    return data, raw_response


def generate_new_topic_prefill(
    description: str, max_tokens: int = 5000
) -> tuple[dict, str]:
    prompt = (
        """A third-party user has provided a description of a category (topic) of emails that they receive.
        Your task is to predict:
         1. A title for this topic Should be no more than 3 words.
         2. A one sentence description of the topic.
         3. Between 2 and 4 SHORT questions (called 'questions') for information that they will likely want to know on these topics from people who reach out to them on that topic, and a model answer on what a good response may look like to this question.

        Do NOT use any preamble. The entire response must be valid JSON, no matter what the input is.
        Do NOT include any explanations or reasoning - just the valid JSON.
        Be concise.

        Return in this format:
        {
            "name": "",
            "description": "",
            "questions": [
                {
                    "text": "",
                    "model_answer": "",
                }
            ]
        }
        """
        f"""
        The topic description we have from the user is:
        <USER_INPUT_TOPIC_DESCRIPTION>
        {description}
        </USER_INPUT_TOPIC_DESCRIPTION>
        """
    )

    raw_response = _call_anthropic_api(
        prompt=prompt,
        max_tokens=max_tokens,
        system_prompt=_SYSTEM_PROMPT,
    )

    try:
        data = json.loads(maybe_strip_markdown(raw_response))
        jsonschema.validate(data, schema=_JSON_SCHEMA_NEW_TOPIC_PREFILL)
    except json.decoder.JSONDecodeError:
        _LOGGER.error("Failed to parse LLM's JSON. Response: %s", raw_response)
        return {}, raw_response
    except jsonschema.ValidationError as e:
        _LOGGER.error("JSON schema validation failed: %s", e)
        return {}, raw_response

    return data, raw_response


def _call_anthropic_api(
    prompt: str, max_tokens: int, system_prompt: str | None = None
) -> str:
    if not env.CLAUDE_API_KEY or not env.CLAUDE_MODEL:
        _LOGGER.warning("No Claude API key or model provided. Skipping LLM call.")
        return ""

    payload = {
        "model": env.CLAUDE_MODEL,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }

    if system_prompt:
        payload["system"] = system_prompt

    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": env.CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json=payload,
    )
    response.raise_for_status()
    return response.json()["content"][0]["text"]


def maybe_strip_markdown(response: str) -> str:
    if response.startswith("```json"):
        response = response[8:]
    if response.endswith("```"):
        response = response[:-3]

    return response
