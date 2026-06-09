-- Add missing foreign key indexes for performance
-- These indexes speed up JOINs and filtered queries on FK columns

-- mistake_bank indexes
CREATE INDEX IF NOT EXISTS idx_mistake_bank_user_id ON public.mistake_bank(user_id);
CREATE INDEX IF NOT EXISTS idx_mistake_bank_question_id ON public.mistake_bank(question_id);
CREATE INDEX IF NOT EXISTS idx_mistake_bank_first_wrong_attempt_id ON public.mistake_bank(first_wrong_attempt_id);
CREATE INDEX IF NOT EXISTS idx_mistake_bank_latest_attempt_id ON public.mistake_bank(latest_attempt_id);
CREATE INDEX IF NOT EXISTS idx_mistake_bank_mastery_status ON public.mistake_bank(mastery_status);

-- question_attempts indexes
CREATE INDEX IF NOT EXISTS idx_question_attempts_user_id ON public.question_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_quiz_attempt_id ON public.question_attempts(quiz_attempt_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_question_id ON public.question_attempts(question_id);

-- question_sets indexes
CREATE INDEX IF NOT EXISTS idx_question_sets_user_id ON public.question_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_material_id ON public.question_sets(material_id);

-- questions indexes
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON public.questions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_question_set_id ON public.questions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_questions_material_id ON public.questions(material_id);

-- quiz_attempts indexes
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_question_set_id ON public.quiz_attempts(question_set_id);

-- practice_sessions indexes
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id ON public.practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_quiz_attempt_id ON public.practice_sessions(quiz_attempt_id);

-- learning_materials indexes
CREATE INDEX IF NOT EXISTS idx_learning_materials_user_id ON public.learning_materials(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_materials_status ON public.learning_materials(status);

-- user_settings indexes
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- Optimize RLS policies by wrapping auth.uid() in (select ...)
-- This prevents per-row re-evaluation of auth.uid()

-- Drop and recreate policies for learning_materials
DROP POLICY IF EXISTS "Users can view own materials" ON public.learning_materials;
CREATE POLICY "Users can view own materials" ON public.learning_materials
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own materials" ON public.learning_materials;
CREATE POLICY "Users can insert own materials" ON public.learning_materials
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own materials" ON public.learning_materials;
CREATE POLICY "Users can update own materials" ON public.learning_materials
    FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own materials" ON public.learning_materials;
CREATE POLICY "Users can delete own materials" ON public.learning_materials
    FOR DELETE USING ((select auth.uid()) = user_id);

-- Drop and recreate policies for question_sets
DROP POLICY IF EXISTS "Users can view own question_sets" ON public.question_sets;
CREATE POLICY "Users can view own question_sets" ON public.question_sets
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own question_sets" ON public.question_sets;
CREATE POLICY "Users can insert own question_sets" ON public.question_sets
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own question_sets" ON public.question_sets;
CREATE POLICY "Users can update own question_sets" ON public.question_sets
    FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own question_sets" ON public.question_sets;
CREATE POLICY "Users can delete own question_sets" ON public.question_sets
    FOR DELETE USING ((select auth.uid()) = user_id);

-- Drop and recreate policies for questions
DROP POLICY IF EXISTS "Users can view own questions" ON public.questions;
CREATE POLICY "Users can view own questions" ON public.questions
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own questions" ON public.questions;
CREATE POLICY "Users can insert own questions" ON public.questions
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own questions" ON public.questions;
CREATE POLICY "Users can update own questions" ON public.questions
    FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own questions" ON public.questions;
CREATE POLICY "Users can delete own questions" ON public.questions
    FOR DELETE USING ((select auth.uid()) = user_id);

-- Drop and recreate policies for quiz_attempts
DROP POLICY IF EXISTS "Users can view own quiz_attempts" ON public.quiz_attempts;
CREATE POLICY "Users can view own quiz_attempts" ON public.quiz_attempts
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own quiz_attempts" ON public.quiz_attempts;
CREATE POLICY "Users can insert own quiz_attempts" ON public.quiz_attempts
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own quiz_attempts" ON public.quiz_attempts;
CREATE POLICY "Users can update own quiz_attempts" ON public.quiz_attempts
    FOR UPDATE USING ((select auth.uid()) = user_id);

-- Drop and recreate policies for question_attempts
DROP POLICY IF EXISTS "Users can view own question_attempts" ON public.question_attempts;
CREATE POLICY "Users can view own question_attempts" ON public.question_attempts
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own question_attempts" ON public.question_attempts;
CREATE POLICY "Users can insert own question_attempts" ON public.question_attempts
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own question_attempts" ON public.question_attempts;
CREATE POLICY "Users can update own question_attempts" ON public.question_attempts
    FOR UPDATE USING ((select auth.uid()) = user_id);

-- Drop and recreate policies for mistake_bank
DROP POLICY IF EXISTS "Users can view own mistake_bank" ON public.mistake_bank;
CREATE POLICY "Users can view own mistake_bank" ON public.mistake_bank
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own mistake_bank" ON public.mistake_bank;
CREATE POLICY "Users can insert own mistake_bank" ON public.mistake_bank
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own mistake_bank" ON public.mistake_bank;
CREATE POLICY "Users can update own mistake_bank" ON public.mistake_bank
    FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own mistake_bank" ON public.mistake_bank;
CREATE POLICY "Users can delete own mistake_bank" ON public.mistake_bank
    FOR DELETE USING ((select auth.uid()) = user_id);

-- Drop and recreate policies for practice_sessions
DROP POLICY IF EXISTS "Users can view own practice_sessions" ON public.practice_sessions;
CREATE POLICY "Users can view own practice_sessions" ON public.practice_sessions
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own practice_sessions" ON public.practice_sessions;
CREATE POLICY "Users can insert own practice_sessions" ON public.practice_sessions
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- Drop and recreate policies for user_settings
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings" ON public.user_settings
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings
    FOR UPDATE USING ((select auth.uid()) = user_id);

-- Drop and recreate policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING ((select auth.uid()) = id);

-- Fix set_updated_at function search_path
ALTER FUNCTION public.set_updated_at() SECURITY DEFINER;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
