export type GradeLevel = 7 | 8 | 9 | 10 | 11 | 12;

export const GRADE_LEVEL_OPTIONS = [
  { value: 7, label: 'الصف السابع' },
  { value: 8, label: 'الصف الثامن' },
  { value: 9, label: 'الصف التاسع' },
  { value: 10, label: 'أول ثانوي (العاشر)' },
  { value: 11, label: 'ثاني ثانوي (الحادي عشر)' },
  { value: 12, label: 'ثالث ثانوي (الثاني عشر)' },
] as const;

export function getGradeLabel(grade: number): string {
  const found = GRADE_LEVEL_OPTIONS.find((g) => g.value === grade);
  return found ? found.label : `الصف ${grade}`;
}

export type ActivityStatus = 'draft' | 'active' | 'closed';

export type StanceMode = 'contrarian' | 'advocate' | 'adaptive';

export type PedagogicalStage =
  | 'baseline'
  | 'understanding'
  | 'evidence'
  | 'source_check'
  | 'causal_reasoning'
  | 'counter_argument'
  | 'reflection'
  | 'submitted';

export type SessionStatus = 'active' | 'submitted' | 'locked';

export type MessageSender = 'student' | 'expert';

export type MessageKind = 'normal' | 'clarification' | 'question' | 'hint';

export type MessageStatus = 'pending' | 'completed' | 'failed';

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  weight: number; // e.g. 25 (%)
  levels: {
    score: number; // 0, 1, 2, 3, 4
    descriptor: string;
  }[];
}

export interface Teacher {
  id: string;
  email: string;
  role: 'teacher' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface ActivitySource {
  id: string;
  activity_id: string;
  title: string;
  source_type: 'text' | 'url';
  source_snapshot: string;
  source_url?: string | null;
  citation_label: string;
  created_at: string;
}

export interface Activity {
  id: string;
  teacher_id: string;
  title: string;
  topic: string;
  grade_level: GradeLevel;
  language: string;
  stance_mode: StanceMode;
  ai_stance: string;
  strict_source: boolean;
  rubric_config: RubricCriterion[];
  access_code: string;
  max_turns: number;
  status: ActivityStatus;
  version: number;
  created_at: string;
  updated_at: string;
  sources?: ActivitySource[];
}

export interface Session {
  id: string;
  activity_id: string;
  student_alias: string;
  session_token_hash: string;
  initial_stance?: string | null;
  initial_reason?: string | null;
  initial_confidence?: number | null; // 1-5
  final_stance?: string | null;
  final_confidence?: number | null; // 1-5
  strongest_evidence?: string | null;
  strongest_counterargument?: string | null;
  remaining_uncertainty?: string | null;
  final_reflection?: string | null;
  current_stage: PedagogicalStage;
  hint_count: number;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  client_message_id: string;
  sequence_number: number;
  sender: MessageSender;
  content: string;
  stage: PedagogicalStage;
  message_kind: MessageKind;
  status: MessageStatus;
  created_at: string;
}

export interface VerifiedQuote {
  quote: string;
  stage: PedagogicalStage;
  criterion_id: string;
  relevance: string;
}

export interface EvaluationRubricScore {
  criterion_id: string;
  score: number; // 0-4
  rationale: string;
  quotes: string[];
}

export interface Evaluation {
  id: string;
  session_id: string;
  rubric_scores: EvaluationRubricScore[];
  verified_quotes: VerifiedQuote[];
  strengths: string[];
  misconceptions: string[];
  suggested_feedback: string;
  system_confidence: number; // 0.0 - 1.0
  metadata: {
    provider?: string;
    model?: string;
    prompt_version?: string;
    evaluated_at?: string;
    quote_verification_passed?: boolean;
  };
  teacher_approved: boolean;
  created_at: string;
  updated_at: string;
}
