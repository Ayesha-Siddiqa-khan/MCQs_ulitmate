"""Turn extracted study text into a list of GeneratedQuestion objects.

The prompt is strict about grounding (no outside knowledge) and structure
(strict JSON array). The model output is then re-validated with pydantic so a
broken response can never silently corrupt the database.
"""
from __future__ import annotations

from textwrap import dedent

from pydantic import ValidationError

from app.schemas.common import Difficulty, GeneratedQuestion, Option
from app.services.generation.providers import ProviderConfig, ProviderError, generate_json

_MCQ_SYSTEM = dedent(
    """
    You are MCQ Mentor, a study assistant that creates exam-quality multiple
    choice questions from a student's own study material.

    Hard rules:
    - Use ONLY information present in the supplied material. Do not invent
      facts. If the material is insufficient for the requested count, return
      fewer questions instead of fabricating.
    - Each question must have exactly 4 options labeled A, B, C, D.
    - Exactly one option must be correct. Distractors must be plausible and
      drawn from the same topic; never use jokes or obviously wrong text.
    - Avoid duplicate options.
    - Every question must include a short explanation (1-3 sentences) grounded
      in the source material.
    - Return STRICT JSON in the shape:
      {
        "questions": [
          {
            "question_text": "...",
            "options": [
              {"key": "A", "text": "..."},
              {"key": "B", "text": "..."},
              {"key": "C", "text": "..."},
              {"key": "D", "text": "..."}
            ],
            "correct_answer": "B",
            "explanation": "...",
            "difficulty": "easy|medium|hard",
            "topic": "optional topic name"
          }
        ]
      }
    - Do not include any prose outside the JSON object.
    """
).strip()


def _user_prompt(material: str, count: int, difficulty: Difficulty, hint: str | None) -> str:
    extra = f"\nTopic hint: {hint}\n" if hint else ""
    return dedent(
        f"""
        Generate up to {count} {difficulty.value}-difficulty multiple-choice
        questions from the material below.
        {extra}
        --- BEGIN MATERIAL ---
        {material[:18000]}
        --- END MATERIAL ---
        """
    ).strip()


def _coerce(item: dict) -> GeneratedQuestion | None:
    try:
        opts_in = item.get("options") or []
        options = [
            Option(key=str(o.get("key") or "").upper()[:4] or chr(65 + i), text=str(o.get("text") or "").strip())
            for i, o in enumerate(opts_in)
            if isinstance(o, dict) and str(o.get("text") or "").strip()
        ]
        if len(options) < 2:
            return None
        diff = item.get("difficulty")
        try:
            difficulty = Difficulty(diff) if diff else None
        except ValueError:
            difficulty = None
        return GeneratedQuestion(
            question_text=str(item.get("question_text") or "").strip(),
            options=options,
            correct_answer=(str(item["correct_answer"]).upper() if item.get("correct_answer") else None),
            explanation=str(item.get("explanation") or "").strip() or None,
            difficulty=difficulty,
            topic=(str(item["topic"]).strip() if item.get("topic") else None),
        )
    except (ValidationError, TypeError, ValueError):
        return None


async def generate_mcqs(
    cfg: ProviderConfig,
    material: str,
    count: int,
    difficulty: Difficulty,
    topic_hint: str | None = None,
) -> list[GeneratedQuestion]:
    if not material or len(material.strip()) < 80:
        raise ProviderError(
            "Material is too short to generate meaningful questions. "
            "Please upload more content or paste a longer passage."
        )
    raw = await generate_json(cfg, _MCQ_SYSTEM, _user_prompt(material, count, difficulty, topic_hint))
    out: list[GeneratedQuestion] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        q = _coerce(item)
        if q is None or not q.question_text:
            continue
        out.append(q)
    return out
