"""Deletion helpers for study data owned by the authenticated user."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from supabase import Client


@dataclass
class CleanupResult:
    deleted: dict[str, int] = field(default_factory=dict)
    storage_paths: list[str] = field(default_factory=list)


STUDY_TABLES = (
    "practice_sessions",
    "mistake_bank",
    "question_attempts",
    "quiz_attempts",
    "questions",
    "question_sets",
    "learning_materials",
)


def _ids(rows: Iterable[dict]) -> list[str]:
    return [row["id"] for row in rows if row.get("id")]


def _select_ids(query) -> list[str]:
    return _ids(query.select("id").execute().data or [])


def _delete_eq_for_user(db: Client, user_id: str, table: str, column: str, value: str) -> int:
    ids = _select_ids(db.table(table).select("id").eq("user_id", user_id).eq(column, value))
    if ids:
        db.table(table).delete().eq("user_id", user_id).in_("id", ids).execute()
    return len(ids)


def _delete_in_for_user(db: Client, user_id: str, table: str, column: str, values: list[str]) -> int:
    if not values:
        return 0
    deleted = 0
    for start in range(0, len(values), 100):
        batch = values[start : start + 100]
        ids = _select_ids(db.table(table).select("id").eq("user_id", user_id).in_(column, batch))
        if ids:
            db.table(table).delete().eq("user_id", user_id).in_("id", ids).execute()
            deleted += len(ids)
    return deleted


def _select_for_user(db: Client, user_id: str, table: str, columns: str, **eq_filters: str) -> list[dict]:
    query = db.table(table).select(columns).eq("user_id", user_id)
    for column, value in eq_filters.items():
        query = query.eq(column, value)
    return query.execute().data or []


def delete_material_tree(db: Client, user_id: str, material_id: str) -> CleanupResult | None:
    material = (
        db.table("learning_materials")
        .select("id, storage_path")
        .eq("user_id", user_id)
        .eq("id", material_id)
        .maybe_single()
        .execute()
        .data
    )
    if material is None:
        return None

    result = CleanupResult(deleted={table: 0 for table in STUDY_TABLES})
    if material.get("storage_path"):
        result.storage_paths.append(material["storage_path"])

    question_rows = _select_for_user(db, user_id, "questions", "id", material_id=material_id)
    question_ids = _ids(question_rows)
    qset_rows = _select_for_user(db, user_id, "question_sets", "id", material_id=material_id)
    qset_ids = _ids(qset_rows)
    attempt_ids: list[str] = []
    if qset_ids:
        for start in range(0, len(qset_ids), 100):
            attempt_ids.extend(
                _ids(
                    db.table("quiz_attempts")
                    .select("id")
                    .eq("user_id", user_id)
                    .in_("question_set_id", qset_ids[start : start + 100])
                    .execute()
                    .data
                    or []
                )
            )

    result.deleted["practice_sessions"] += _delete_in_for_user(
        db, user_id, "practice_sessions", "quiz_attempt_id", attempt_ids
    )
    result.deleted["mistake_bank"] += _delete_in_for_user(
        db, user_id, "mistake_bank", "question_id", question_ids
    )
    result.deleted["question_attempts"] += _delete_in_for_user(
        db, user_id, "question_attempts", "quiz_attempt_id", attempt_ids
    )
    result.deleted["question_attempts"] += _delete_in_for_user(
        db, user_id, "question_attempts", "question_id", question_ids
    )
    result.deleted["quiz_attempts"] += _delete_in_for_user(
        db, user_id, "quiz_attempts", "id", attempt_ids
    )
    result.deleted["questions"] += _delete_eq_for_user(db, user_id, "questions", "material_id", material_id)
    result.deleted["question_sets"] += _delete_eq_for_user(
        db, user_id, "question_sets", "material_id", material_id
    )
    result.deleted["learning_materials"] += _delete_eq_for_user(
        db, user_id, "learning_materials", "id", material_id
    )

    return result


def delete_all_study_data(db: Client, user_id: str) -> CleanupResult:
    materials = (
        db.table("learning_materials")
        .select("id, storage_path")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    result = CleanupResult(
        deleted={table: 0 for table in STUDY_TABLES},
        storage_paths=[row["storage_path"] for row in materials if row.get("storage_path")],
    )
    for table in STUDY_TABLES:
        rows = db.table(table).select("id").eq("user_id", user_id).execute().data or []
        result.deleted[table] = len(rows)
        if rows:
            db.table(table).delete().eq("user_id", user_id).execute()
    return result
