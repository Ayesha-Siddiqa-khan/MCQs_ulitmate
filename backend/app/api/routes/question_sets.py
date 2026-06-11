"""Question-set endpoints: extract existing MCQs OR generate via LLM."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.core.config import Settings, get_settings
from app.core.security import CurrentUserDep
from app.db.supabase_client import get_user_client
from app.schemas.common import GeneratedQuestion, QuestionSetMode, QuestionSource
from app.schemas.questions import (
    ExtractExistingMCQsRequest,
    ExtractExistingMCQsResponse,
    GenerateMCQRequest,
    Option,
    PaginatedQuestionSets,
    QuestionOut,
    QuestionSetDetail,
    QuestionSetOut,
)
from app.services.extraction.mcq_parser import extract_existing_mcqs_with_rich_text, extract_existing_mcqs_with_stats
from app.services.generation.mcq_generator import generate_mcqs
from app.services.generation.provider_factory import resolve_provider
from app.services.generation.providers import ProviderError
from app.services.generation.short_question_generator import generate_short_questions

router = APIRouter(prefix="/question-sets", tags=["question-sets"])


def _load_material_text(db: Client, material_id: str) -> tuple[dict, str]:
    row = (
        db.table("learning_materials")
        .select("id, title, file_type, storage_path, extracted_text, subject, chapter, topic")
        .eq("id", material_id)
        .maybe_single()
        .execute()
    ).data
    if row is None:
        raise HTTPException(status_code=404, detail="material not found")
    text = (row.get("extracted_text") or "").strip()
    if not text:
        raise HTTPException(
            status_code=400,
            detail="material has no extracted text yet. Run extract-text first.",
        )
    return row, text


def _persist_set(
    db: Client,
    user_id: str,
    material_id: str | None,
    title: str,
    mode: QuestionSetMode,
    difficulty: str | None,
    questions: list[GeneratedQuestion],
    source_type: QuestionSource,
    subject: str | None = None,
    chapter: str | None = None,
    topic: str | None = None,
) -> tuple[dict, list[dict]]:
    if not questions:
        raise HTTPException(status_code=422, detail="no questions could be created from the material")
    qset = (
        db.table("question_sets")
        .insert(
            {
                "user_id": user_id,
                "material_id": material_id,
                "title": title[:200],
                "mode": mode.value,
                "total_questions": len(questions),
                "difficulty": difficulty,
                "subject": subject,
                "chapter": chapter,
                "topic": topic,
            }
        )
        .execute()
        .data[0]
    )
    rows = []
    for i, q in enumerate(questions):
        rows.append(
            {
                "user_id": user_id,
                "question_set_id": qset["id"],
                "material_id": material_id,
                "position": i,
                "question_text": q.question_text,
                "options_json": [o.model_dump() for o in q.options],
                "correct_answer": q.correct_answer,
                "explanation": q.explanation,
                "key_points": q.key_points,
                "subject": subject,
                "chapter": q.chapter or chapter,
                "topic": q.topic or topic,
                "difficulty": (q.difficulty.value if q.difficulty else difficulty),
                "source_type": source_type.value,
                "source_chunk": q.source_chunk,
            }
        )
    inserted = db.table("questions").insert(rows).execute().data
    return qset, inserted


@router.post("/extract-existing-mcqs", response_model=ExtractExistingMCQsResponse, status_code=201)
async def extract_existing(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    payload: ExtractExistingMCQsRequest,
) -> ExtractExistingMCQsResponse:
    material, text = _load_material_text(db, payload.material_id)

    # Try to get rich text for bold detection (PDFs only)
    rich_lines = None
    file_type = material.get("file_type", "")
    storage_path = material.get("storage_path", "")
    if file_type == "pdf" and storage_path:
        try:
            data = db.storage.from_("materials").download(storage_path)
            if data:
                from app.services.extraction.pdf_extractor import extract_pdf_rich
                rich_result = extract_pdf_rich(data)
                rich_lines = rich_result.rich_lines
        except Exception:
            pass  # Fall back to plain text parsing

    questions = extract_existing_mcqs_with_rich_text(text, rich_lines=rich_lines)
    with_answers = sum(1 for q in questions if q.correct_answer is not None)
    without_answers = len(questions) - with_answers

    if not questions:
        raise HTTPException(
            status_code=422,
            detail=(
                "No MCQs detected. The file must contain numbered questions with A-G options."
            ),
        )

    title = payload.title or f"Extracted MCQs - {material['title']}"
    qset, inserted = _persist_set(
        db=db,
        user_id=user.id,
        material_id=material["id"],
        title=title,
        mode=QuestionSetMode.extract_existing,
        difficulty=None,
        questions=questions,
        source_type=QuestionSource.extracted,
        subject=material.get("subject"),
        chapter=material.get("chapter"),
        topic=material.get("topic"),
    )
    return ExtractExistingMCQsResponse(
        **qset,
        questions=[_row_to_question(r) for r in inserted],
        answers_detected=with_answers,
        answers_missing=without_answers,
        can_auto_grade=with_answers > 0,
    )


@router.post("/generate", response_model=QuestionSetDetail, status_code=201)
async def generate(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    settings: Annotated[Settings, Depends(get_settings)],
    payload: GenerateMCQRequest,
) -> QuestionSetDetail:
    material, text = _load_material_text(db, payload.material_id)
    cfg = resolve_provider(user.id, db, settings)
    try:
        if payload.mode is QuestionSetMode.generate_short:
            questions = await generate_short_questions(cfg, text, payload.count, payload.difficulty, payload.topic)
        else:
            questions = await generate_mcqs(cfg, text, payload.count, payload.difficulty, payload.topic)
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    title = payload.title or f"{material['title']} \u2014 {payload.mode.value}"
    qset, inserted = _persist_set(
        db=db,
        user_id=user.id,
        material_id=material["id"],
        title=title,
        mode=payload.mode,
        difficulty=payload.difficulty.value,
        questions=questions,
        source_type=QuestionSource.ai_generated,
        subject=payload.subject or material.get("subject"),
        chapter=payload.chapter or material.get("chapter"),
        topic=payload.topic or material.get("topic"),
    )
    return QuestionSetDetail(**qset, questions=[_row_to_question(r) for r in inserted])


@router.get("", response_model=PaginatedQuestionSets)
async def list_sets(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    page: int = 1,
    page_size: int = 50,
) -> PaginatedQuestionSets:
    """List user's question sets with pagination."""
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    offset = (page - 1) * page_size

    count_res = (
        db.table("question_sets")
        .select("id", count="exact")
        .execute()
    )
    total = count_res.count or 0
    total_pages = max(1, (total + page_size - 1) // page_size)

    res = (
        db.table("question_sets")
        .select("id, material_id, title, mode, total_questions, difficulty, subject, chapter, topic, created_at")
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    items = [QuestionSetOut(**r) for r in (res.data or [])]
    return PaginatedQuestionSets(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{set_id}", response_model=QuestionSetDetail)
async def get_set(
    set_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
) -> QuestionSetDetail:
    qset = (
        db.table("question_sets")
        .select("*")
        .eq("id", set_id)
        .maybe_single()
        .execute()
    ).data
    if qset is None:
        raise HTTPException(status_code=404, detail="not found")
    qs = (
        db.table("questions")
        .select("*")
        .eq("question_set_id", set_id)
        .order("position")
        .execute()
    ).data or []
    return QuestionSetDetail(**qset, questions=[_row_to_question(q) for q in qs])


def _row_to_question(row: dict) -> QuestionOut:
    opts = row.get("options_json") or []
    options = [Option(**o) for o in opts if isinstance(o, dict)]
    return QuestionOut(
        id=row["id"],
        question_set_id=row["question_set_id"],
        material_id=row.get("material_id"),
        position=row.get("position", 0),
        question_text=row["question_text"],
        options=options,
        correct_answer=row.get("correct_answer"),
        explanation=row.get("explanation"),
        key_points=row.get("key_points"),
        subject=row.get("subject"),
        chapter=row.get("chapter"),
        topic=row.get("topic"),
        difficulty=row.get("difficulty"),
        source_type=row.get("source_type") or "ai_generated",
        created_at=row.get("created_at"),
    )


# --- Answer editing for unsolved MCQs ---


class UpdateAnswerRequest(BaseModel):
    correct_answer: str | None = None
    explanation: str | None = None


class BulkUpdateAnswersRequest(BaseModel):
    answers: dict[str, str | None]  # question_id -> correct_answer (A/B/C/D or null)


@router.patch("/{set_id}/questions/{question_id}", response_model=QuestionOut)
async def update_question_answer(
    set_id: str,
    question_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    payload: UpdateAnswerRequest,
) -> QuestionOut:
    """Update correct_answer for a single question (manual answer entry)."""
    qrow = (
        db.table("questions")
        .select("*")
        .eq("id", question_id)
        .eq("question_set_id", set_id)
        .maybe_single()
        .execute()
    ).data
    if qrow is None:
        raise HTTPException(status_code=404, detail="question not found")

    update: dict = {}
    if payload.correct_answer is not None:
        if payload.correct_answer.upper() not in {"A", "B", "C", "D", "E", "F", "G"}:
            raise HTTPException(status_code=422, detail="correct_answer must be A, B, C, D, E, F, or G")
        update["correct_answer"] = payload.correct_answer.upper()
    if payload.explanation is not None:
        update["explanation"] = payload.explanation

    if update:
        db.table("questions").update(update).eq("id", question_id).execute()
        qrow.update(update)

    return _row_to_question(qrow)


@router.post("/{set_id}/answers", response_model=QuestionSetDetail)
async def bulk_update_answers(
    set_id: str,
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    payload: BulkUpdateAnswersRequest,
) -> QuestionSetDetail:
    """Bulk update correct_answer for multiple questions (manual answer entry)."""
    qset = (
        db.table("question_sets")
        .select("*")
        .eq("id", set_id)
        .maybe_single()
        .execute()
    ).data
    if qset is None:
        raise HTTPException(status_code=404, detail="question set not found")

    for qid, answer in payload.answers.items():
        if answer is not None and answer.upper() not in {"A", "B", "C", "D", "E", "F", "G"}:
            raise HTTPException(
                status_code=422,
                detail=f"invalid answer '{answer}' for question {qid}. Must be A, B, C, D, E, F, or G.",
            )
        db.table("questions").update(
            {"correct_answer": answer.upper() if answer else None}
        ).eq("id", qid).eq("question_set_id", set_id).execute()

    qs = (
        db.table("questions")
        .select("*")
        .eq("question_set_id", set_id)
        .order("position")
        .execute()
    ).data or []
    return QuestionSetDetail(**qset, questions=[_row_to_question(q) for q in qs])
