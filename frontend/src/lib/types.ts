export type QuestionType = "mcq" | "short";

export interface MCQOption {
  key: string;
  text: string;
}

export interface Question {
  id: string;
  question_set_id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  options_json: MCQOption[] | null;
  correct_answer: string | null;
  model_answer: string | null;
  explanation: string | null;
  topic: string | null;
  source_chunk: string | null;
  created_at: string;
}

export interface QuestionSet {
  id: string;
  user_id: string;
  learning_material_id: string | null;
  title: string;
  description: string | null;
  question_type: QuestionType;
  generation_mode: "extracted" | "ai" | "hybrid";
  source_provider: string | null;
  question_count: number;
  created_at: string;
}

export interface QuestionSetWithQuestions extends QuestionSet {
  questions: Question[];
}

export type MasteryStatus = "new_mistake" | "needs_practice" | "improving" | "mastered";

export interface Mistake {
  id: string;
  user_id: string;
  question_id: string;
  status: MasteryStatus;
  wrong_attempts: number;
  correct_after_wrong: number;
  last_wrong_at: string;
  last_correct_at: string | null;
  updated_at: string;
  question: Question;
}

export interface PracticeSession {
  id: string;
  user_id: string;
  question_set_id: string;
  created_at: string;
}

export type AttemptStatus = "in_progress" | "submitted" | "abandoned";

export interface QuizAttempt {
  id: string;
  user_id: string;
  question_set_id: string;
  practice_session_id: string | null;
  status: AttemptStatus;
  started_at: string;
  submitted_at: string | null;
  total_questions: number;
  correct_count: number;
  score_percent: number;
}

export interface QuestionAttemptResult {
  question_id: string;
  position: number;
  prompt: string;
  user_answer: string | null;
  correct_answer: string | null;
  model_answer: string | null;
  options_json: MCQOption[] | null;
  is_correct: boolean | null;
  answered: boolean;
  explanation: string | null;
}

export interface QuizResult {
  attempt: QuizAttempt;
  breakdown: QuestionAttemptResult[];
  question_set_title: string;
}

export interface Material {
  id: string;
  user_id: string;
  title: string;
  source_type: "pdf" | "docx" | "text" | "csv" | "json";
  storage_path: string | null;
  raw_text: string | null;
  char_count: number;
  status: "pending" | "extracting" | "ready" | "error";
  error_message: string | null;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  preferred_provider: "openai" | "anthropic" | "google" | null;
  has_api_key: boolean;
  updated_at: string;
}

export interface DashboardSummary {
  total_materials: number;
  total_question_sets: number;
  total_attempts: number;
  total_mistakes: number;
  mastery_breakdown: Record<MasteryStatus, number>;
  recent_attempts: QuizAttempt[];
}

export type AIProvider = "openai" | "anthropic" | "google";

export interface ApiError {
  detail: string;
  status: number;
}
