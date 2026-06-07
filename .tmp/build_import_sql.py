"""Generate a single SQL transaction that imports the parsed PDF MCQs
into the existing user's account. Run with:
  python build_import_sql.py > import.sql
Then execute the SQL via the supabase_execute_sql MCP tool.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

ROOT = Path(r"F:\Mobile apps projects\MCQs_ulitmate")
PARSED = ROOT / ".tmp" / "parsed_mcqs.json"
OUT = ROOT / ".tmp" / "import.sql"

USER_ID = "ba1a1cfa-884d-4aad-b2ee-c8a2f458d822"  # proeditorpakistanifeeling@gmail.com
SUBJECT = "Mathematics"
PDF_TITLE = "9th Math MCQs (Imported)"
PAGE_COUNT = 40

questions = json.loads(PARSED.read_text(encoding="utf-8"))

material_id = str(uuid.uuid4())

# Group questions by chapter
by_chapter: dict[int, list[dict]] = {}
for q in questions:
    by_chapter.setdefault(q["chapter"], []).append(q)

# Stable chapter order
chapter_titles = {
    1: "Matrices and Determinants",
    2: "Real and Complex Numbers",
    3: "Logarithms",
    4: "Algebraic Expressions and Algebraic Formulas",
    5: "Factorization",
    6: "Algebraic Manipulation",
    7: "Linear Equations and Inequalities",
    8: "Linear Graphs and Their Applications",
    9: "Introduction to Coordinate Geometry",
    10: "Congruent Triangles",
    11: "Parallelograms and Triangles",
    12: "Line Bisectors and Angle Bisectors",
    13: "Sides and Angles of a Triangle",
    14: "Ratio and Proportion",
    15: "Pythagoras Theorem",
    16: "Theorems Related to Areas",
    17: "Practical Geometry",
}

set_ids: dict[int, str] = {n: str(uuid.uuid4()) for n in by_chapter.keys()}

lines: list[str] = []
lines.append("BEGIN;")
lines.append("")
lines.append("-- Material row")
lines.append(
    f"""INSERT INTO public.learning_materials (
  id, user_id, title, file_type, status, size_bytes, page_count, subject, notes
) VALUES (
  '{material_id}'::uuid,
  '{USER_ID}'::uuid,
  '{PDF_TITLE}',
  'pasted',
  'extracted',
  102959,
  {PAGE_COUNT},
  '{SUBJECT}',
  'Imported from 9th_Math_MCQs_Clean_English_Pattern.pdf via chapter-aware parser.'
);"""
)
lines.append("")

# Question sets
lines.append("-- Question sets (one per chapter)")
values = []
for n in sorted(by_chapter.keys()):
    title = f"Ch{n}: {chapter_titles.get(n, '')}".strip(": ")
    total = len(by_chapter[n])
    values.append(
        f"('{set_ids[n]}', '{USER_ID}', '{material_id}', '{title.replace(chr(39), chr(39)+chr(39))}', 'extract_existing', {total}, {n})"
    )
lines.append("INSERT INTO public.question_sets (id, user_id, material_id, title, mode, total_questions, chapter) VALUES")
lines.append(",\n".join(values) + ";")
lines.append("")

# Questions
lines.append("-- Questions")
q_values: list[str] = []
for q in questions:
    qid = str(uuid.uuid4())
    chap = q["chapter"]
    set_id = set_ids[chap]
    pos = q["position"]
    qtext = q["question_text"].replace("'", "''")
    correct = q["correct_answer"]
    opts_json = json.dumps(q["options"], ensure_ascii=False).replace("'", "''")
    q_values.append(
        f"('{qid}', '{USER_ID}', '{set_id}', '{material_id}', {pos}, "
        f"'{qtext}'::text, '{opts_json}'::jsonb, '{correct}', 'extracted', {chap})"
    )
# Chunk into multiple INSERTs (each ~50 rows) for safety
CHUNK = 50
for i in range(0, len(q_values), CHUNK):
    chunk = q_values[i : i + CHUNK]
    lines.append(
        "INSERT INTO public.questions (id, user_id, question_set_id, material_id, position, question_text, options_json, correct_answer, source_type, chapter) VALUES"
    )
    lines.append(",\n".join(chunk) + ";")
    lines.append("")

lines.append("COMMIT;")
lines.append("")
lines.append(f"-- Summary")
lines.append(f"-- Material: {material_id}")
for n in sorted(set_ids.keys()):
    lines.append(f"--   Set Ch{n} ({chapter_titles.get(n, '')}): {set_ids[n]}  ({len(by_chapter[n])} questions)")
lines.append(f"--   TOTAL: {len(questions)} questions across {len(set_ids)} sets")

OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"wrote {OUT}  ({len(questions)} questions, {len(set_ids)} sets)")
