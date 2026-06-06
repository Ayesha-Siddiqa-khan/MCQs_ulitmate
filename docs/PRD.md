# Product Requirements Document — MCQ Mentor

**Owner:** Rising
**Status:** v0.1 (vertical slice scope)
**Last updated:** 2026-06-06

## 1. Product summary

MCQ Mentor is a student-focused exam-practice web app. A student uploads study material (PDF, DOCX, CSV, JSON, or pasted text), the app extracts the text, generates multiple-choice and short-answer questions using the student's own AI provider key, lets the student attempt a quiz, then surfaces a dashboard and a mistake bank so the student can drill only the questions they keep getting wrong.

The product is single-tenant per user. There is no admin panel, no billing, and no multi-user collaboration in this version.

## 2. Target user

- Primary: a single student preparing for an exam, language test, certification, or course.
- Secondary: a self-paced learner who collects PDFs/notes over time and wants to convert them into reviewable questions.

Non-goals for v0.1:

- Classrooms, teachers, assignments, or grading on behalf of others.
- Public question libraries or sharing.
- Real-time collaboration.

## 3. Core user journey

1. Sign up with email + password (Supabase Auth).
2. (Optional) Add an AI provider key (OpenAI, Anthropic, or Google) on the Settings page. The key is encrypted at rest with Fernet.
3. Add study material: upload a PDF/DOCX/CSV/JSON, or paste text.
4. Open the material and click "Generate MCQs". The backend calls the chosen provider with the extracted text and writes a new question set.
5. Open the question set, start a quiz, answer all questions, submit.
6. View the results page with score, correct/wrong breakdown, and explanations.
7. Visit the Mistakes page to see every wrong answer, with a mastery status badge.
8. Click "Start practice session" to build a new quiz from open mistakes, take it, and watch mastery progress.

## 4. Functional requirements

| ID | Requirement |
| --- | --- |
| F-1 | Users can sign up, log in, and log out. Sessions are managed by Supabase Auth. |
| F-2 | A `profiles` row and an empty `user_settings` row are auto-created on signup via a database trigger. |
| F-3 | Users can save an AI provider + API key. The key is encrypted before it touches the DB. The plaintext is never returned to the frontend. |
| F-4 | Users can upload PDF, DOCX, CSV, or JSON files up to 20 MB. They can also paste text directly. |
| F-5 | Uploaded files go to the `materials` Supabase Storage bucket, scoped to `<user_id>/<material_id>/<filename>`. RLS prevents cross-user access. |
| F-6 | The backend extracts text from uploads. PDF uses pypdf, DOCX uses python-docx. Failures are surfaced as `material.error_message`, not silent success. |
| F-7 | Users can trigger AI MCQ generation. The user must have a saved key for the chosen provider. No key returns `400` with a clear message. |
| F-8 | Generated questions are stored in `questions` with `type ∈ {mcq, short}`, `options_json`, `correct_answer`, `model_answer`, and an optional explanation. |
| F-9 | If a material already contains extractable MCQs (e.g. a JSON dump of an existing quiz), the user can also import them with the strict regex parser. |
| F-10 | Users can start a quiz attempt, answer each question (radio for MCQ, textarea for short), and submit. The backend grades deterministically. |
| F-11 | Wrong answers are upserted into `mistake_bank` with a mastery state machine: `new_mistake` → `needs_practice` → `improving` → `mastered`. |
| F-12 | The Mistakes page lists every mistake with status, wrong count, and correct-after-wrong count. |
| F-13 | "Start practice session" builds a fresh ephemeral `question_set` from the user's open mistakes. The standard quiz pipeline handles it. |
| F-14 | The dashboard shows total materials, total question sets, total attempts, total open mistakes, mastery breakdown, and top 5 recommendations. |

## 5. Non-functional requirements

- **Latency:** Quiz submit → results page render < 2 s for sets of 50 questions. Generation can be slow and is shown with a pending state.
- **Privacy:** A user's material and questions are visible only to that user. Enforced by RLS on every student-owned table and the `materials` storage bucket.
- **Secret safety:** API keys are encrypted with Fernet (AES-128-CBC + HMAC). The backend never logs the plaintext. The frontend never stores it in `localStorage` and never sends it anywhere except the encrypted endpoint.
- **Vercel-deployable:** The frontend must build and run on Vercel with no environment-specific code.
- **No silent fakes:** Every feature that is incomplete must be marked with a TODO comment and surface a clear error in the UI.

## 6. Out of scope (v0.1)

- Email verification, password reset, or social sign-in beyond Supabase defaults.
- OCR for scanned PDFs (returns an `error_message` and a TODO).
- Streaming question generation.
- Billing, quotas, or rate limits.
- Multi-language UI (English only).
- Mobile native apps.
- Sharing, public links, or instructor dashboards.

## 7. Success metrics

For v0.1 the goal is a verified, end-to-end slice, not scale. Success is:

- A new user can sign up, add a key, upload a PDF, generate 10 MCQs, take the quiz, submit, see results, and start a practice session — all in one sitting, without manual intervention.
- A second test user cannot read or modify the first user's data, verified through a Supabase MCP RLS check.
- Backend `uv run pytest` is green. Frontend `npm run lint`, `npx tsc --noEmit`, and `npm run build` are green.
- A Playwright smoke test covers the full happy path.

## 8. Open questions

- Do we want to add OCR later (Tesseract via a sidecar)? Decision: defer to v0.2.
- Do we want a "regenerate" button on bad question sets? Decision: defer; not blocking.
- Do we want a per-provider default in `user_settings`? Decision: yes, already in schema.
