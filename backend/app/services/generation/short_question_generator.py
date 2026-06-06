"""Short-answer question generator. Same provider pipeline as the MCQ generator."""
from __future__ import annotations

from textwrap import dedent

from app.schemas.common import Difficulty, GeneratedQuestion
from app.services.generation.providers import ProviderConfig, ProviderError, generate_json

_SHORT_SYSTEM = dedent(
    """
    You are MCQ Mentor. Create short-answer practice questions strictly from
    the student's material. Each question must have:
      - question_text (clear, single concept)
      - model_answer (1-3 sentences, grounded in the material)
      - key_points (3-5 bullet phrases the student should mention)
      - difficulty: easy | medium | hard
      - topic (optional)

    Return STRICT JSON in this shape:
    {
      "questions": [
        {
          "question_text": "...",
          "model_answer": "...",
          "key_points": ["...", "..."],
          "difficulty": "medium",
          "topic": "..."
        }
      ]
    }
    Do not invent content that is not in the material.
    """
).strip()


async def generate_short_questions(
    cfg: ProviderConfig,
    material: str,
    count: int,
    difficulty: Difficulty,
    topic_hint: str | None = None,
) -> list[GeneratedQuestion]:
    if not material or len(material.strip()) < 80:
        raise ProviderError("Material is too short for short-question generation.")
    user_prompt = dedent(
        f"""
        Generate up to {count} {difficulty.value}-difficulty short-answer
        questions from the material below.
        {f'Topic hint: {topic_hint}' if topic_hint else ''}

        --- BEGIN MATERIAL ---
        {material[:18000]}
        --- END MATERIAL ---
        """
    ).strip()

    raw = await generate_json(cfg, _SHORT_SYSTEM, user_prompt)
    out: list[GeneratedQuestion] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        kp = item.get("key_points") or []
        if isinstance(kp, list):
            kp_text = "\n- " + "\n- ".join(str(k).strip() for k in kp if str(k).strip())
        else:
            kp_text = str(kp).strip()
        diff = item.get("difficulty")
        try:
            difficulty_val = Difficulty(diff) if diff else None
        except ValueError:
            difficulty_val = None
        question = GeneratedQuestion(
            question_text=str(item.get("question_text") or "").strip(),
            options=[],  # short-answer questions have no options
            correct_answer=str(item.get("model_answer") or "").strip() or None,
            explanation=str(item.get("model_answer") or "").strip() or None,
            key_points=kp_text or None,
            difficulty=difficulty_val,
            topic=(str(item["topic"]).strip() if item.get("topic") else None),
        )
        if question.question_text:
            out.append(question)
    return out
