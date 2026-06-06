# MCQ Mentor

Vertical slice of a study app: upload material, generate multiple-choice questions with your own AI key, take quizzes, and practice only the questions you keep getting wrong.

## Stack
- **Frontend** — Next.js 16.2.7 (App Router, Turbopack, Tailwind v4, shadcn/ui)
- **Backend** — FastAPI 0.118+, Pydantic v2, Supabase Python SDK
- **Database / Auth / Storage** — Supabase Postgres with RLS on every student-owned table
- **AI providers** — OpenAI, Anthropic, Google (BYO key, encrypted at rest with Fernet)

## Repo layout
```
backend/        FastAPI service
frontend/       Next.js 16 app
supabase/       SQL migrations (run with the Supabase MCP or `supabase db push`)
```

## Run it

### 1. Supabase
Apply the two migrations in `supabase/migrations/` against your project. They create all tables, RLS policies, the `materials` storage bucket, and a `handle_new_user` trigger that auto-creates a `profiles` row + empty `user_settings` row for every new auth user.

You can use the Supabase MCP server after adding it to `~/.config/opencode/opencode.json` and running `opencode mcp auth supabase`. SQL lives in:
- `supabase/migrations/0001_initial_schema.sql` — tables, enums, RLS
- `supabase/migrations/0002_storage_bucket.sql` — `materials` bucket + storage RLS

### 2. Backend
```sh
cd backend
uv sync
cp .env.example .env       # then fill in Supabase URL, JWT secret, ENCRYPTION_KEY
uv run uvicorn app.main:app --reload --port 8000
```

Healthcheck: `GET http://localhost:8000/healthz` → `{"status":"ok"}`.

Required env:
- `SUPABASE_URL` — project URL
- `SUPABASE_JWT_SECRET` — used to verify incoming JWTs and as Fernet-key fallback
- `ENCRYPTION_KEY` — optional 32-byte url-safe base64 key. If absent, derived from `SUPABASE_JWT_SECRET`.
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` — **not used**. Each student brings their own key, stored encrypted in their `user_settings.api_key_encrypted`.

### 3. Frontend
```sh
cd frontend
cp .env.example .env.local
npm run dev
```
Opens on http://localhost:3000.

## What works in this slice

| Step | Where | What happens |
| --- | --- | --- |
| Sign up / log in | `/signup`, `/login` | Supabase Auth; trigger creates `profiles` + `user_settings`. |
| Save AI key | `/settings` | Provider + key sent to backend; encrypted with Fernet before insert. |
| Add material | `/materials/new` | Upload PDF/DOCX (text extracted server-side) or paste text. |
| Extract text | `POST /materials/{id}/re-extract` | pypdf or python-docx. Failures surface in `materials.error_message`. |
| Generate MCQs | material page → "Generate MCQs" | Strict-prompted provider call, Pydantic-validated, refuses to run without a key. |
| Take quiz | `/quiz/[attemptId]` | Single-question runner with progress + radio group / short answer. |
| Submit | `POST /quiz-attempts/{id}/submit` | Pydantic-graded; wrong answers upsert into `mistake_bank` with mastery FSM. |
| Mistakes | `/mistakes` | Lists `mistake_bank` rows with current mastery status. |
| Practice | `/practice` | Builds a fresh ephemeral `question_set` from your open mistakes; takes you through the standard quiz pipeline. |
| Dashboard | `/dashboard` | Summary stats + top 5 recommendations. |

## AI provider behavior
- No key → backend returns `400` with a clear message. Frontend shows it in an alert. No fake placeholders.
- Provider call failures are surfaced as `502` with the upstream error.
- The backend never logs the plaintext key. Storage is `user_settings.api_key_encrypted` (Fernet ciphertext).

## Mastery state machine
`new_mistake` → `needs_practice` (any subsequent wrong) → `improving` (1 correct after wrong) → `mastered` (≥2 corrects).
Idempotent upsert on `(user_id, question_id)` in `app/services/quiz/mistake_service.py`.

## What's intentionally not faked
- **OCR** for scanned PDFs is not implemented. PDFs without a text layer surface a clear `error_message` and a TODO comment, not a silent success.
- **DOCX with images/tables** is partially handled (paragraphs only).
- **Provider streaming** is not implemented — generation is a single request/response.

## Tests
```sh
cd backend && uv run pytest         # 4 tests (mcq parser, scoring)
cd frontend && npm run lint         # 0 errors, 0 warnings
cd frontend && npx tsc --noEmit     # 0 errors
cd frontend && npm run build        # production build succeeds
```

## Deploy
- Frontend → Vercel. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL`.
- Backend → any Python host (Render, Fly, Railway). Set the same env as `.env.example`. The JWT secret MUST match Supabase.

## Known limits of this slice
- No email confirmation flow beyond Supabase defaults.
- No question regeneration / re-roll on bad output.
- No user-visible deletion of question sets (backend supports it, UI doesn't).
- No multi-tenant admin / quota / billing.
- No mobile-specific UI; responsive only down to ~360px.
- No OCR (TODO in `app/services/extraction/pdf.py`).
