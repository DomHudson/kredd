import logging
import typing

from sentence_transformers import CrossEncoder


class SemanticSimilarityInput:
    __slots__ = ("model_answer", "submitted_answer", "weight")

    def __init__(self, model_answer: str, submitted_answer: str, weight: float) -> None:
        self.model_answer = model_answer
        self.submitted_answer = submitted_answer
        self.weight = weight


class SemanticSimilarityOutreachScorer:
    logger: logging.Logger = logging.getLogger(__name__)

    def __init__(self, cross_encoder: CrossEncoder) -> None:
        self._cross_encoder = cross_encoder

    @classmethod
    def from_cross_encoder_path(cls, cross_encoder_path: str) -> typing.Self:
        cls.logger.info("Loading cross encoder from %s", cross_encoder_path)

        cross_encoder = CrossEncoder(cross_encoder_path)

        return cls(cross_encoder=cross_encoder)

    def score_inputs(self, inputs: list[SemanticSimilarityInput]) -> float:
        total = 0.0

        for i in inputs:
            if not i.submitted_answer:
                # Empty submitted answer counts as a similarity of zero.
                continue

            total += (
                self._cross_encoder.predict(
                    [(i.model_answer, i.submitted_answer)],
                    show_progress_bar=False,
                    chunk_size=1,
                )[0]
                * i.weight
            )

        return total / len(inputs)
