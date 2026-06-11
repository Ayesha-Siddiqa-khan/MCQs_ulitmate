// Frontend types — mirror app/schemas/*.py on the backend. Keep them in sync.

export type Difficulty = "easy" | "medium" | "hard";

export type AIProvider = "openai" | "anthropic" | "google";
export type AIProviderOrNone = AIProvider | "none";

export type MaterialFileType =
  | "pdf"
  | "txt"
  | "md"
  | "docx"
  | "csv"
  | "json"
  | "pasted";

export type MaterialStatus = "uploaded" | "extracted" | "failed" | "manual";

export type StorageMode = "saved" | "temporary";

export type QuestionSetMode = "extract_existing" | "generate_mcq" | "generate_short";

export type QuestionSource = "extracted" | "ai_generated" | "manual";

export type QuizMode = "practice" | "exam" | "mistakes";

export type MasteryStatus = "new_mistake" | "needs_practice" | "improving" | "mastered";

export interface Option {
  key: string;
  text: string;
}

export interface Material {
  id: string;
  title: string;
  original_file_name: string | null;
  file_type: MaterialFileType;
  storage_path: string | null;
  extracted_text: string | null;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  exam_type: string | null;
  status: MaterialStatus;
  storage_mode: StorageMode;
  expires_at: string | null;
  size_bytes: number | null;
  page_count: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ExtractTextResponse {
  material_id: string;
  text: string;
  page_count: number | null;
  warning: string | null;
}

export interface MaterialUsage {
  used: number;
  limit: number;
  remaining: number;
}

export interface DeleteMaterialResponse {
  material_id: string;
  deleted: Record<string, number>;
  storage_paths_removed: number;
  warning: string | null;
}

export interface ExtractPreviewResponse {
  material_id: string;
  total_detected: number;
  with_answers: number;
  without_answers: number;
  with_explanations: number;
  duplicates: number;
  confidence: string;
  warnings: string[];
  answer_sources?: Record<string, number>;
}

export interface ExtractExistingMCQsResponse extends QuestionSet {
  questions: Question[];
  answers_detected: number;
  answers_missing: number;
  can_auto_grade: boolean;
}

export interface UploadLimits {
  max_upload_mb: number;
  max_materials_per_user: number;
  allowed_extensions: string[];
}

export interface SaveTemporaryRequest {
  save_mode: "save_material" | "save_mistakes_only" | "discard";
}

export interface SaveTemporaryResponse {
  material_id: string;
  action: string;
  message: string;
}

export interface Question {
  id: string;
  question_set_id: string;
  material_id: string | null;
  position: number;
  question_text: string;
  options: Option[];
  correct_answer: string | null;
  explanation: string | null;
  key_points: string | null;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  difficulty: Difficulty | null;
  source_type: QuestionSource;
  created_at: string | null;
}

export interface QuestionPublic {
  id: string;
  position: number;
  question_text: string;
  options: Option[];
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  difficulty: Difficulty | null;
}

export interface QuestionSet {
  id: string;
  material_id: string | null;
  title: string;
  mode: QuestionSetMode;
  total_questions: number;
  difficulty: Difficulty | null;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  created_at: string | null;
}

export interface QuestionSetDetail extends QuestionSet {
  questions: Question[];
}

export interface UserSettings {
  ai_provider: AIProviderOrNone;
  ai_model: string | null;
  has_api_key: boolean;
  default_difficulty: Difficulty;
  questions_per_quiz: number;
}

export interface DeleteStudentDataResponse {
  deleted: Record<string, number>;
  storage_paths_removed: number;
  warning: string | null;
}

export interface UpdateSettingsRequest {
  ai_provider?: AIProviderOrNone | null;
  ai_model?: string | null;
  ai_api_key?: string | null;
  default_difficulty?: Difficulty | null;
  questions_per_quiz?: number | null;
  clear_api_key?: boolean;
}

export interface RecentMaterial {
  id: string;
  title: string;
  file_type: string;
  created_at: string | null;
}

export interface RecentAttempt {
  id: string;
  question_set_id: string;
  title: string | null;
  score: number;
  total_questions: number;
  percentage: number;
  submitted_at: string | null;
}

export interface DashboardSummary {
  total_quizzes: number;
  average_score: number;
  accuracy_trend: number[];
  total_wrong_questions: number;
  mastered_mistakes: number;
  weak_topics: string[];
  recent_uploads: RecentMaterial[];
  recent_attempts: RecentAttempt[];
  continue_practice_attempt_id: string | null;
}

export interface Mistake {
  id: string;
  question_id: string;
  wrong_count: number;
  correct_after_wrong_count: number;
  mastery_status: MasteryStatus;
  last_practiced_at: string | null;
  created_at: string | null;
  question: Question | null;
}

export interface MistakeListItem {
  id: string;
  question_id: string;
  wrong_count: number;
  correct_after_wrong_count: number;
  mastery_status: MasteryStatus;
  last_practiced_at: string | null;
  created_at: string | null;
  question_text: string | null;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  difficulty: string | null;
}

export interface PaginatedMistakes {
  items: MistakeListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  counts: Record<string, number>;
}

export interface PaginatedMaterials {
  items: MaterialListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface MaterialListItem {
  id: string;
  title: string;
  original_file_name: string | null;
  file_type: MaterialFileType;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  exam_type: string | null;
  status: MaterialStatus;
  storage_mode: StorageMode;
  expires_at: string | null;
  size_bytes: number | null;
  page_count: number | null;
  created_at: string | null;
}

export interface PaginatedQuestionSets {
  items: QuestionSet[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface MistakeFilter {
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  difficulty?: Difficulty | null;
  only_unmastered?: boolean;
  only_repeated?: boolean;
  limit?: number;
  session_type?:
    | "mistakes_all"
    | "mistakes_by_subject"
    | "mistakes_by_chapter"
    | "mistakes_by_difficulty"
    | "mistakes_repeated"
    | "mistakes_unmastered";
}

export interface MistakeRecommendation {
  label: string;
  reason: string;
  count: number;
  filter: MistakeFilter;
}

export interface DeleteMistakesResponse {
  deleted: number;
  status: MasteryStatus | null;
}

export interface StartPracticeResponse {
  practice_session_id: string;
  quiz_attempt_id: string;
  question_set_id: string;
  total_questions: number;
}

export interface StartQuizResponse {
  attempt_id: string;
  question_set_id: string;
  mode: QuizMode;
  started_at: string;
  questions: QuestionPublic[];
}

export interface QuizAttemptDetail {
  attempt_id: string;
  question_set_id: string;
  mode: QuizMode;
  total_questions: number;
  is_submitted: boolean;
  started_at: string;
  questions: QuestionPublic[];
}

export interface AnswerRequest {
  question_id: string;
  selected_answer: string | null;
  is_marked?: boolean;
  time_spent_seconds?: number;
}

export interface SubmitQuizRequest {
  answers: AnswerRequest[];
  time_spent_seconds?: number;
}

export interface QuestionResult {
  question: Question;
  selected_answer: string | null;
  is_correct: boolean | null;
  is_marked: boolean;
  time_spent_seconds: number;
}

export interface TopicBreakdown {
  label: string;
  correct: number;
  total: number;
}

export interface QuizResult {
  attempt_id: string;
  question_set_id: string;
  score: number;
  total_questions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  percentage: number;
  time_spent_seconds: number;
  submitted_at: string | null;
  questions: QuestionResult[];
  topic_breakdown: TopicBreakdown[];
  difficulty_breakdown: TopicBreakdown[];
}

export interface ApiError {
  detail: string;
  status: number;
}
