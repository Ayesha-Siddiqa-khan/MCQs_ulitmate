"""Question-set endpoints: extract existing MCQs OR generate via LLM."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.core.config import Settings, get_settings
from app.core.security import CurrentUserDep
from app.db.supabase_client import get_user_client
from app.schemas.common import GeneratedQuestion, QuestionSetMode, QuestionSource
from app.schemas.questions import (
    ExtractExistingMCQsRequest,
    GenerateMCQRequest,
    Option,
    QuestionOut,
    QuestionSetDetail,
    QuestionSetOut,
)
from app.services.extraction.mcq_parser import extract_existing_mcqs
from app.services.generation.mcq_generator import generate_mcqs
from app.services.generation.provider_factory import resolve_provider
from app.services.generation.providers import ProviderError
from app.services.generation.short_question_generator import generate_short_questions

router = APIRouter(prefix="/question-sets", tags=["question-sets"])


def _load_material_text(db: Client, material_id: str) -> tuple[dict, str]:
    row = (
        db.table("learning_materials")
        .select("*")
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


@router.post("/extract-existing-mcqs", response_model=QuestionSetDetail, status_code=201)
async def extract_existing(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
    payload: ExtractExistingMCQsRequest,
) -> QuestionSetDetail:
    material, text = _load_material_text(db, payload.material_id)
    questions = extract_existing_mcqs(text)
    if not questions:
        raise HTTPException(
            status_code=422,
            detail=(
                "No solved MCQs detected. Use a PDF/text file with numbered questions, A-D "
                "options, and either inline answers or an answer key section at the end."
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
    return QuestionSetDetail(
        **qset,
        questions=[_row_to_question(r) for r in inserted],
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


@router.get("", response_model=list[QuestionSetOut])
async def list_sets(
    user: CurrentUserDep,
    db: Annotated[Client, Depends(get_user_client)],
) -> list[QuestionSetOut]:
    res = db.table("question_sets").select("*").order("created_at", desc=True).execute()
    return [QuestionSetOut(**r) for r in (res.data or [])]


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
