import { z } from 'zod';

export const PedagogicalStageEnum = z.enum([
  'baseline',
  'understanding',
  'evidence',
  'source_check',
  'causal_reasoning',
  'counter_argument',
  'reflection',
  'submitted',
]);

export const DialogueDecisionSchema = z.object({
  reply: z.string().describe('النص المرئي الموجه للطالب باللغة العربية بأسلوب سقراطي رصين'),
  next_stage: PedagogicalStageEnum.describe('المرحلة البيداغوجية التالية المعتمدة'),
  question_type: z.enum([
    'clarification',
    'evidence_request',
    'causal_probe',
    'counter_example',
    'reflection_prompt',
    'hint',
  ]),
  used_source_ids: z.array(z.string()).describe('معرفات المصادر المعتمدة المستخدمة في الرد'),
  unsupported_claim_refused: z
    .boolean()
    .describe('صحيح إذا تضمن كلام الطالب أو استفساره ادعاءات غير مدعومة بنصوص المصادر المتاحة'),
});

export type DialogueDecision = z.infer<typeof DialogueDecisionSchema>;

export const EvaluationCriterionScoreSchema = z.object({
  criterion_id: z.string(),
  score: z.number().int().min(0).max(4).describe('الدرجة من 0 إلى 4 بحسب معايير الروبورك'),
  rationale: z.string().describe('التعليل التربوي الدقيق لهذه الدرجة'),
  quotes: z
    .array(z.string())
    .describe('اقتباسات حرفية دقيقة من كلام الطالب داخل سجل الحوار تثبت هذه الدرجة'),
});

export const FormativeEvaluationSchema = z.object({
  rubric_scores: z.array(EvaluationCriterionScoreSchema),
  verified_quotes: z.array(
    z.object({
      quote: z.string().describe('الاقتباس الحرفي من الطالب'),
      stage: PedagogicalStageEnum,
      criterion_id: z.string(),
      relevance: z.string().describe('سبب دلالة هذا الاقتباس'),
    })
  ),
  strengths: z.array(z.string()).min(1).describe('نقاط القوة الملحوظة في تفكير وحجج الطالب'),
  misconceptions: z
    .array(z.string())
    .describe('المغالطات المنطقية أو الفهم الخاطئ إن وجد (أو نقاط الضعف الاستدلالية)'),
  suggested_feedback: z
    .string()
    .min(10)
    .describe('تغذية راجعة بنائية وتشجيعية مقترحة للمعلم لمشاركتها مع الطالب'),
  system_confidence: z
    .number()
    .min(0.0)
    .max(1.0)
    .describe('درجة ثقة النموذج في التقييم من 0 إلى 1'),
});

export type FormativeEvaluation = z.infer<typeof FormativeEvaluationSchema>;
