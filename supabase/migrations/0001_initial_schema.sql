-- =============================================================================
-- MCQ Mentor - initial schema
-- Run via Supabase MCP `apply_migration` or `psql` against your project.
-- Project ref: umbohpysrqowpmcpnjlz
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.material_status as enum ('uploaded', 'extracted', 'failed', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.material_file_type as enum ('pdf', 'txt', 'md', 'docx', 'csv', 'json', 'pasted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_set_mode as enum ('extract_existing', 'generate_mcq', 'generate_short');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_source as enum ('extracted', 'ai_generated', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.difficulty_level as enum ('easy', 'medium', 'hard');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.quiz_mode as enum ('practice', 'exam', 'mistakes');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.mastery_status as enum ('new_mistake', 'needs_practice', 'improving', 'mastered');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_provider as enum ('openai', 'anthropic', 'google', 'none');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- profiles  (1-1 with auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'student',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- user_settings (per-user AI provider + key + preferences)
-- -----------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  ai_provider          public.ai_provider not null default 'none',
  ai_api_key_encrypted text,
  ai_model             text,
  default_difficulty   public.difficulty_level not null default 'medium',
  questions_per_quiz   int not null default 10 check (questions_per_quiz between 1 and 100),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- learning_materials
-- -----------------------------------------------------------------------------
create table if not exists public.learning_materials (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  title              text not null,
  original_file_name text,
  file_type          public.material_file_type not null,
  storage_path       text,
  extracted_text     text,
  subject            text,
  chapter            text,
  topic              text,
  exam_type          text,
  status             public.material_status not null default 'uploaded',
  size_bytes         bigint,
  page_count         int,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists learning_materials_user_id_idx on public.learning_materials(user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- question_sets
-- -----------------------------------------------------------------------------
create table if not exists public.question_sets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  material_id     uuid references public.learning_materials(id) on delete set null,
  title           text not null,
  mode            public.question_set_mode not null,
  total_questions int not null default 0,
  difficulty      public.difficulty_level,
  subject         text,
  chapter         text,
  topic           text,
  created_at      timestamptz not null default now()
);
create index if not exists question_sets_user_id_idx on public.question_sets(user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- questions
--   options_json:  jsonb array  [{"key":"A","text":"..."} , ...]
--   correct_answer: matches a key in options_json (or model answer for short)
-- -----------------------------------------------------------------------------
create table if not exists public.questions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  question_set_id uuid not null references public.question_sets(id) on delete cascade,
  material_id     uuid references public.learning_materials(id) on delete set null,
  position        int not null default 0,
  question_text   text not null,
  options_json    jsonb not null default '[]'::jsonb,
  correct_answer  text,
  explanation     text,
  key_points      text,
  subject         text,
  chapter         text,
  topic           text,
  difficulty      public.difficulty_level,
  source_type     public.question_source not null default 'ai_generated',
  source_chunk    text,
  created_at      timestamptz not null default now()
);
create index if not exists questions_set_idx on public.questions(question_set_id, position);
create index if not exists questions_user_idx on public.questions(user_id);

-- -----------------------------------------------------------------------------
-- quiz_attempts
-- -----------------------------------------------------------------------------
create table if not exists public.quiz_attempts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  question_set_id   uuid not null references public.question_sets(id) on delete cascade,
  mode              public.quiz_mode not null default 'practice',
  score             int not null default 0,
  total_questions   int not null default 0,
  percentage        numeric(5,2) not null default 0,
  time_spent_seconds int not null default 0,
  is_submitted      boolean not null default false,
  started_at        timestamptz not null default now(),
  submitted_at      timestamptz
);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts(user_id, started_at desc);

-- -----------------------------------------------------------------------------
-- question_attempts (per-question record inside a quiz attempt)
-- -----------------------------------------------------------------------------
create table if not exists public.question_attempts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  quiz_attempt_id    uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id        uuid not null references public.questions(id) on delete cascade,
  selected_answer    text,
  correct_answer     text,
  is_correct         boolean,
  is_marked          boolean not null default false,
  time_spent_seconds int not null default 0,
  created_at         timestamptz not null default now(),
  unique (quiz_attempt_id, question_id)
);
create index if not exists question_attempts_user_idx on public.question_attempts(user_id);
create index if not exists question_attempts_attempt_idx on public.question_attempts(quiz_attempt_id);

-- -----------------------------------------------------------------------------
-- mistake_bank (one row per (user, question) pair)
-- -----------------------------------------------------------------------------
create table if not exists public.mistake_bank (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  question_id              uuid not null references public.questions(id) on delete cascade,
  first_wrong_attempt_id   uuid references public.question_attempts(id) on delete set null,
  latest_attempt_id        uuid references public.question_attempts(id) on delete set null,
  wrong_count              int not null default 1,
  correct_after_wrong_count int not null default 0,
  mastery_status           public.mastery_status not null default 'new_mistake',
  last_practiced_at        timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (user_id, question_id)
);
create index if not exists mistake_bank_user_idx on public.mistake_bank(user_id, mastery_status);

-- -----------------------------------------------------------------------------
-- practice_sessions (a quiz built from the mistake bank)
-- -----------------------------------------------------------------------------
create table if not exists public.practice_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  session_type    text not null default 'mistakes_all',
  filter_json     jsonb not null default '{}'::jsonb,
  quiz_attempt_id uuid references public.quiz_attempts(id) on delete set null,
  total_questions int not null default 0,
  score           int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists practice_sessions_user_idx on public.practice_sessions(user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at trigger helper
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ begin
  create trigger profiles_set_updated_at         before update on public.profiles         for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger user_settings_set_updated_at    before update on public.user_settings    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger learning_materials_set_updated_at before update on public.learning_materials for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger mistake_bank_set_updated_at     before update on public.mistake_bank     for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- Bootstrap profile + settings when a new auth user appears
do $$ begin
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
exception when duplicate_object then null; end $$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- Every table is scoped strictly to the owner via user_id (or id on profiles).
-- =============================================================================
alter table public.profiles           enable row level security;
alter table public.user_settings      enable row level security;
alter table public.learning_materials enable row level security;
alter table public.question_sets      enable row level security;
alter table public.questions          enable row level security;
alter table public.quiz_attempts      enable row level security;
alter table public.question_attempts  enable row level security;
alter table public.mistake_bank       enable row level security;
alter table public.practice_sessions  enable row level security;

-- Reusable policy generator could be done with dynamic SQL, but explicit policies
-- are clearer and easier to audit.

-- profiles -----------------------------------------------------------------
drop policy if exists "profiles self read"   on public.profiles;
drop policy if exists "profiles self write"  on public.profiles;
create policy "profiles self read"  on public.profiles for select using (auth.uid() = id);
create policy "profiles self write" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- user_settings ------------------------------------------------------------
drop policy if exists "user_settings self all" on public.user_settings;
create policy "user_settings self all" on public.user_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- learning_materials ------------------------------------------------------
drop policy if exists "materials self all" on public.learning_materials;
create policy "materials self all" on public.learning_materials for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- question_sets -----------------------------------------------------------
drop policy if exists "question_sets self all" on public.question_sets;
create policy "question_sets self all" on public.question_sets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- questions ---------------------------------------------------------------
drop policy if exists "questions self all" on public.questions;
create policy "questions self all" on public.questions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- quiz_attempts -----------------------------------------------------------
drop policy if exists "quiz_attempts self all" on public.quiz_attempts;
create policy "quiz_attempts self all" on public.quiz_attempts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- question_attempts -------------------------------------------------------
drop policy if exists "question_attempts self all" on public.question_attempts;
create policy "question_attempts self all" on public.question_attempts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- mistake_bank ------------------------------------------------------------
drop policy if exists "mistake_bank self all" on public.mistake_bank;
create policy "mistake_bank self all" on public.mistake_bank for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- practice_sessions -------------------------------------------------------
drop policy if exists "practice_sessions self all" on public.practice_sessions;
create policy "practice_sessions self all" on public.practice_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
