# MCQ Mentor - Backend

FastAPI service that handles:

- Material upload (PDF, TXT, MD, DOCX, CSV, JSON) and Supabase Storage write
- Text extraction (PDF / DOCX / CSV / JSON / Markdown / TXT)
- MCQ extraction from solved PDFs (heuristic parser)
- MCQ + short-answer generation via student's selected AI provider (OpenAI / Anthropic / Google)
- Quiz lifecycle (start, answer, submit, score)
- Mistake bank updates and mastery transitions
- Dashboard summary

## Local dev

```bash
cd backend
uv sync --extra dev
cp .env.example .env
# fill SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
# SUPABASE_JWT_SECRET, ENCRYPTION_KEY (and AI fallbacks if you want them)
uv run uvicorn app.main:app --reload --port 8000
```

> `backend/.env` is loaded automatically. To point at a different file, set
> `BACKEND_ENV_FILE=/abs/path/.env` in your shell.

> `APP_ENV=production` triggers fail-fast startup if any Supabase secret is
> missing. Leave it unset (or `=development`) while iterating locally.

## Layout

```
app/
  main.py
  api/routes/        materials, question_sets, quiz_attempts, mistakes, dashboard, settings
  core/              config, security
  schemas/           pydantic request/response models
  services/
    extraction/      pdf, text, docx, csv, json parsers
    generation/      mcq_generator, short_question_generator, providers/
    quiz/            scoring, mistake updates, recommendations
  db/                supabase_client
tests/
```

## Auth model

The backend trusts Supabase. Every protected route requires `Authorization: Bearer <access_token>` (the JWT minted by Supabase Auth). `app/core/security.py` validates it with `SUPABASE_JWT_SECRET` and yields a `current_user` dependency.

## AI providers

Students pick a provider in **Settings** and paste their own key. Keys are encrypted with Fernet using the server's `ENCRYPTION_KEY` (derived from `SUPABASE_JWT_SECRET` if not set). The backend never logs raw keys. No provider configured = generation endpoints respond 400 with a clear message rather than returning fake questions.
