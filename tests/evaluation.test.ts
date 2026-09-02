import { describe, it, expect } from 'vitest';
import { FormativeEvaluationEngine } from '../src/lib/ai/evaluation-engine';
import { FormativeEvaluationSchema } from '../src/lib/ai/schemas';
import { SEED_ACTIVITY } from '../src/lib/db/seed';
import { Message, Session } from '../src/lib/db/schema';

describe('Formative Evaluation & Quote Verification', () => {
  const engine = new FormativeEvaluationEngine();

  const mockSession: Session = {
    id: 'eval-session-1',
    activity_id: SEED_ACTIVITY.id,
    student_alias: 'يوسف',
    session_token_hash: 'hash-eval-1',
    initial_stance: 'الوقود الأحفوري يرفع حرارة الأرض',
    initial_reason: 'بسبب انبعاثات غاز ثاني أكسيد الكربون من المصانع',
    initial_confidence: 4,
    final_stance: 'النشاط البشري هو العامل الحاسم في الاحترار العالمي',
    final_confidence: 5,
    strongest_evidence: 'بيانات نظائر الكربون تثبت أن الزيادة ناتجة عن حرق الوقود الأحفوري',
    strongest_counterargument: 'البعض يرى أن الدورات الشمسية هي السبب ولكن قياسات ناسا تثبت تبريد الستراتوسفير',
    remaining_uncertainty: 'أود معرفة كيف تؤثر تيارات المحيطات العميقة على تخزين الحرارة',
    final_reflection: 'تعلمت أن التفكير الناقد يتطلب فحص بصمة الدليل العلمي والتمييز بين الارتباط والسببية',
    current_stage: 'submitted',
    hint_count: 1,
    status: 'submitted',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockTranscript: Message[] = [
    {
      id: 'm1',
      session_id: mockSession.id,
      client_message_id: 'c1',
      sequence_number: 1,
      sender: 'student',
      content: 'أعتقد أن الغازات الدفيئة تحبس الحرارة في طبقة التروبوسفير',
      stage: 'understanding',
      message_kind: 'normal',
      status: 'completed',
      created_at: new Date().toISOString(),
    },
    {
      id: 'm2',
      session_id: mockSession.id,
      client_message_id: 'c2',
      sequence_number: 2,
      sender: 'expert',
      content: 'ما هو دليلك على أن السبب ليس نشاطاً شمسياً؟',
      stage: 'evidence',
      message_kind: 'normal',
      status: 'completed',
      created_at: new Date().toISOString(),
    },
    {
      id: 'm3',
      session_id: mockSession.id,
      client_message_id: 'c3',
      sequence_number: 3,
      sender: 'student',
      content: 'بيانات ناسا توضح أن طبقة الستراتوسفير تبرد بينما التروبوسفير تسخن وهذا يثبت تأثير الدفيئة',
      stage: 'evidence',
      message_kind: 'normal',
      status: 'completed',
      created_at: new Date().toISOString(),
    },
  ];

  it('should generate a valid formative evaluation conforming to schema', async () => {
    const evaluation = await engine.evaluateSession({
      activity: SEED_ACTIVITY,
      session: mockSession,
      transcript: mockTranscript,
    });

    expect(evaluation.id).toBeDefined();
    expect(evaluation.session_id).toBe(mockSession.id);
    expect(evaluation.rubric_scores.length).toBe(SEED_ACTIVITY.rubric_config.length);

    // Validate scores are within 0-4
    for (const scoreItem of evaluation.rubric_scores) {
      expect(scoreItem.score).toBeGreaterThanOrEqual(0);
      expect(scoreItem.score).toBeLessThanOrEqual(4);
      expect(scoreItem.rationale.length).toBeGreaterThan(5);
    }

    expect(evaluation.strengths.length).toBeGreaterThan(0);
    expect(evaluation.suggested_feedback.length).toBeGreaterThan(10);
    expect(evaluation.system_confidence).toBeGreaterThanOrEqual(0);
    expect(evaluation.system_confidence).toBeLessThanOrEqual(1);
  });

  it('should verify that cited quotes occur in student transcript and flag non-matching quotes', () => {
    const mockEval = {
      rubric_scores: [
        {
          criterion_id: 'crit-evidence-use',
          score: 4,
          rationale: 'استشهد بالبيانات',
          quotes: ['بيانات ناسا توضح أن طبقة الستراتوسفير تبرد'],
        },
      ],
      verified_quotes: [
        {
          quote: 'بيانات ناسا توضح أن طبقة الستراتوسفير تبرد',
          stage: 'evidence' as const,
          criterion_id: 'crit-evidence-use',
          relevance: 'استدلال بالبصمة الحرارية',
        },
        {
          quote: 'نص وهمي لم يقله الطالب إطلاقاً في أي مكان',
          stage: 'counter_argument' as const,
          criterion_id: 'crit-counter-arguments',
          relevance: 'غير حقيقي',
        },
      ],
      strengths: ['استدلال قوي'],
      misconceptions: [],
      suggested_feedback: 'عمل رائع',
      system_confidence: 0.9,
    };

    const { verifiedEvaluation, passed } = engine.verifyTranscriptQuotes(
      mockEval,
      mockSession,
      mockTranscript
    );

    expect(passed).toBe(false); // Because one quote was fake
    expect(verifiedEvaluation.verified_quotes.length).toBe(1); // Fake quote filtered
    expect(verifiedEvaluation.verified_quotes[0].quote).toBe('بيانات ناسا توضح أن طبقة الستراتوسفير تبرد');
  });
});
