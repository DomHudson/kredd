import logging
import typing

from app import constants, llm, models
from app.scoring import semantic_similarity


_LOGGER: logging.Logger = logging.getLogger(__name__)


class OutreachScorerResult:
    __slots__ = ("score", "llm_data", "llm_raw_response")

    def __init__(self, score: float, llm_data: dict, llm_raw_response: str):
        self.score: float = score
        self.llm_data: dict = llm_data
        self.llm_raw_response: str = llm_raw_response


class OutreachScorer:
    def __init__(
        self, similarity_scorer: semantic_similarity.SemanticSimilarityOutreachScorer
    ) -> None:
        self._similarity_scorer = similarity_scorer

    @classmethod
    def from_cross_encoder_path(cls, cross_encoder_path: str) -> typing.Self:
        return cls(
            similarity_scorer=semantic_similarity.SemanticSimilarityOutreachScorer.from_cross_encoder_path(
                cross_encoder_path
            )
        )

    def score(self, outreach: models.Outreach) -> OutreachScorerResult:
        responses = outreach.outreachquestionresponse_set.all()

        similarity_inputs = [
            semantic_similarity.SemanticSimilarityInput(
                model_answer=r.question.model_answer,
                submitted_answer=r.response,
                weight=1.0,
            )
            for r in responses
        ]

        entries = [
            llm.QAEntry(
                text=r.question.text,
                model_answer=r.question.model_answer,
                submitted_answer=r.response,
            )
            for r in responses
        ]

        semantic_score = self._similarity_scorer.score_inputs(similarity_inputs)
        llm_data, llm_raw_response = llm.assess_outreach_fit(
            outreach.topic.name, entries
        )

        return OutreachScorerResult(
            score=self._compute_score(semantic_score, llm_data),
            llm_data=llm_data,
            llm_raw_response=llm_raw_response,
        )

    @staticmethod
    def _compute_score(semantic_score: float, llm_data: dict) -> float:
        brackets = {
            "low": 0.0,
            "medium": constants.SCORE_AMBER_THRESHOLD,
            "high": constants.SCORE_GREEN_THRESHOLD,
        }
        next_bracket = {
            "low": constants.SCORE_AMBER_THRESHOLD,
            "medium": constants.SCORE_GREEN_THRESHOLD,
            "high": 1.0,
        }

        assessment = llm_data.get("overall_assessment", None)
        if assessment is None:
            _LOGGER.error("No overall assessment from LLM data. Setting score to 0.")
            return 0

        base = brackets[assessment]
        ceiling = next_bracket[assessment]

        return base + semantic_score * (ceiling - base)
