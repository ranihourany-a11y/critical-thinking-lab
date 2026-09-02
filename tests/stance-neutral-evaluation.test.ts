import { describe, it, expect, vi } from 'vitest';
import { evaluationEngine } from '../src/lib/ai/evaluation-engine';
import { buildEvaluationSystemPrompt } from '../src/lib/ai/prompts/evaluation-prompts';
import { Activity, Message, Session } from '../src/lib/db/schema';
import { SEED_ACTIVITY } from '../src/lib/db/seed';

describe('Stance-Neutral Formative Evaluation Engine', () => {
  const baseSession: Session = {
    id: 'session-stance-1',
    activity_id: SEED_ACTIVITY.id,
    student_alias: 'طالب_موقف_أ',
    session_token_hash: 'hash-1',
    current_stage: 'reflection',
    hint_count: 1,
    status: 'submitted',
    initial_stance: 'النشاط البشري هو المحرك الأساسي للاحتباس الحراري',
    initial_confidence: 4,
    initial_reason: 'تزايد انبعاثات الكربون منذ الثورة الصناعية يتطابق مع ارتفاع درجات الحرارة.',
    final_stance: 'النشاط البشري هو المحرك الأساسي للاحتباس الحراري',
    final_confidence: 4,
    strongest_evidence: 'بيانات IPCC توضح تجاوز تركيز CO2 حاجز 415 جزءاً في المليون.',
    strongest_counterargument: 'تغير النشاط الشمسي لا يفسر التبريد في طبقة الستراتوسفير.',
    remaining_uncertainty: 'مدى تسارع ذوبان الجليد في القطبين.',
    final_reflection: 'أدركت أهمية فحص البصمات الحرارية في الغلاف الجوي للتمييز بين الأسباب البشرية والطبيعية.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const transcriptA: Message[] = [
    {
      id: 'msg-a-1',
      session_id: 'session-stance-1',
      client_message_id: 'c-a-1',
      sequence_number: 1,
      sender: 'student',
      content: 'تزايد انبعاثات الكربون منذ الثورة الصناعية يتطابق مع ارتفاع درجات الحرارة وفق تقرير IPCC.',
      stage: 'understanding',
      message_kind: 'normal',
      status: 'completed',
      created_at: new Date().toISOString(),
    },
    {
      id: 'msg-a-2',
      session_id: 'session-stance-1',
      client_message_id: 'c-a-2',
      sequence_number: 2,
      sender: 'expert',
      content: 'ولكن ماذا عن دورات ميلانكوفيتش والنشاط الشمسي؟',
      stage: 'counter_argument',
      message_kind: 'normal',
      status: 'completed',
      created_at: new Date().toISOString(),
    },
    {
      id: 'msg-a-3',
      session_id: 'session-stance-1',
      client_message_id: 'c-a-3',
      sequence_number: 3,
      sender: 'student',
      content: 'دورات ميلانكوفيتش تعمل عبر آلاف السنين، بينما التسارع الحالي حدث خلال قرن ونصف فقط.',
      stage: 'counter_argument',
      message_kind: 'normal',
      status: 'completed',
      created_at: new Date().toISOString(),
    },
  ];

  // Mirrored session with opposite stance but identical reasoning depth
  const sessionB: Session = {
    ...baseSession,
    id: 'session-stance-2',
    student_alias: 'طالب_موقف_ب',
    initial_stance: 'العوامل الطبيعية والنشاط الشمسي تلعب الدور الأكبر في تغير المناخ',
    initial_confidence: 3,
    initial_reason: 'المناخ مر بفترات دافئة تاريخياً مثل العصر الروماني الوسيط.',
    final_stance: 'العوامل الطبيعية والنشاط الشمسي تلعب الدور الأكبر في تغير المناخ',
    final_confidence: 3,
    strongest_evidence: 'السجلات التاريخية تشير لتقلبات مناخية كبرى قبل وجود الصناعة.',
    strongest_counterargument: 'الارتفاع السريع للغازات الدفيئة في القرن الأخير.',
    remaining_uncertainty: 'حجم التأثير النسبي للبخار المائي.',
    final_reflection: 'تعلمت أن مناقشة المناخ تتطلب موازنة السجلات الجيولوجية طويلة المدى مع الرصد الحديث.',
  };

  const transcriptB: Message[] = [
    {
      id: 'msg-b-1',
      session_id: 'session-stance-2',
      client_message_id: 'c-b-1',
      sequence_number: 1,
      sender: 'student',
      content: 'المناخ مر بفترات دافئة تاريخياً مثل العصر الروماني الوسيط قبل عصر الوقود الأحفوري.',
      stage: 'understanding',
      message_kind: 'normal',
      status: 'completed',
      created_at: new Date().toISOString(),
    },
    {
      id: 'msg-b-2',
      session_id: 'session-stance-2',
      client_message_id: 'c-b-2',
      sequence_number: 2,
      sender: 'expert',
      content: 'كيف تفسر أن سرعة الاحترار الحالي لم يسبق لها مثيل في التاريخ الجيولوجي؟',
      stage: 'counter_argument',
      message_kind: 'normal',
      status: 'completed',
      created_at: new Date().toISOString(),
    },
    {
      id: 'msg-b-3',
      session_id: 'session-stance-2',
      client_message_id: 'c-b-3',
      sequence_number: 3,
      sender: 'student',
      content: 'السجلات الجيولوجية القديمة قد تفتقر إلى الدقة الزمنية العالية المتوفرة للأقمار الصناعية الحديثة.',
      stage: 'counter_argument',
      message_kind: 'normal',
      status: 'completed',
      created_at: new Date().toISOString(),
    },
  ];

  it('1. Identical Evaluation Directives: evaluation prompt imposes strict stance neutrality regardless of position', () => {
    const promptA = buildEvaluationSystemPrompt({
      activity: SEED_ACTIVITY,
      session: baseSession,
      transcript: transcriptA,
    });

    const promptB = buildEvaluationSystemPrompt({
      activity: SEED_ACTIVITY,
      session: sessionB,
      transcript: transcriptB,
    });

    // Both prompts must contain the exact stance-neutral evaluation rules
    expect(promptA).toContain('الحيادية التامة تجاه الموقف المختار');
    expect(promptB).toContain('الحيادية التامة تجاه الموقف المختار');
    expect(promptA).toContain('استبعاد كلام المرشد من أدلة التقييم');
    expect(promptB).toContain('استبعاد كلام المرشد من أدلة التقييم');
    expect(promptA).toContain('معايير الثبات وتغيير الموقف');
    expect(promptB).toContain('معايير الثبات وتغيير الموقف');
    expect(promptA).toContain('حيادية التغير في مستوى الثقة');
    expect(promptB).toContain('حيادية التغير في مستوى الثقة');
  });

  it('2. Exclusion of Expert Messages: expert messages cannot be used as scoring evidence or verified quotes', () => {
    const sampleEvaluation = {
      rubric_scores: [
        {
          criterion_id: SEED_ACTIVITY.rubric_config[0].id,
          score: 4,
          rationale: 'استدلال ممتاز',
          quotes: ['ولكن ماذا عن دورات ميلانكوفيتش والنشاط الشمسي؟'], // Expert quote!
        },
      ],
      verified_quotes: [
        {
          quote: 'ولكن ماذا عن دورات ميلانكوفيتش والنشاط الشمسي؟', // Expert quote!
          stage: 'counter_argument' as const,
          criterion_id: SEED_ACTIVITY.rubric_config[0].id,
          relevance: 'كلام المرشد',
        },
      ],
      strengths: ['التحليل السببي'],
      misconceptions: [],
      suggested_feedback: 'عمل رائع',
      system_confidence: 0.9,
    };

    const { verifiedEvaluation, passed } = evaluationEngine.verifyTranscriptQuotes(
      sampleEvaluation,
      baseSession,
      transcriptA
    );

    // Expert quote must be stripped and rejected
    expect(passed).toBe(false);
    expect(verifiedEvaluation.verified_quotes.length).toBe(0);
    expect(verifiedEvaluation.rubric_scores[0].quotes.length).toBe(0);
  });

  it('3. Stance Maintenance Support: evidence-based stance retention evaluates successfully with teacher_approved = false', async () => {
    const evalA = await evaluationEngine.evaluateSession({
      activity: SEED_ACTIVITY,
      session: baseSession,
      transcript: transcriptA,
    });

    expect(evalA.teacher_approved).toBe(false);
    expect(evalA.rubric_scores.length).toBe(SEED_ACTIVITY.rubric_config.length);
    expect(evalA.verified_quotes.length).toBeGreaterThan(0);

    // Verify all quotes are student-authored
    for (const vq of evalA.verified_quotes) {
      const isStudent = transcriptA.some((m) => m.sender === 'student' && m.content.includes(vq.quote)) ||
        [baseSession.initial_reason, baseSession.strongest_evidence, baseSession.final_reflection].some((r) => r && r.includes(vq.quote));
      expect(isStudent).toBe(true);
    }
  });

  it('4. Stance Neutrality Across Opposing Positions: opposite stance session evaluates with valid scores and intact rubric integrity', async () => {
    const evalB = await evaluationEngine.evaluateSession({
      activity: SEED_ACTIVITY,
      session: sessionB,
      transcript: transcriptB,
    });

    expect(evalB.teacher_approved).toBe(false);
    expect(evalB.rubric_scores.length).toBe(SEED_ACTIVITY.rubric_config.length);
    expect(evalB.system_confidence).toBeGreaterThan(0.8);

    for (const vq of evalB.verified_quotes) {
      const isStudent = transcriptB.some((m) => m.sender === 'student' && m.content.includes(vq.quote)) ||
        [sessionB.initial_reason, sessionB.strongest_evidence, sessionB.final_reflection].some((r) => r && r.includes(vq.quote));
      expect(isStudent).toBe(true);
    }
  });

  it('5. Zero Persistence on Malformed Output: invalid criteria or score out of range throws error without partial save', async () => {
    // Malformed output with invalid criterion
    const invalidMock = {
      rubric_scores: [
        {
          criterion_id: 'unknown-fake-criterion',
          score: 5, // Out of range (> 4)
          rationale: 'تقييم خاطئ',
          quotes: [],
        },
      ],
      verified_quotes: [],
      strengths: [],
      misconceptions: [],
      suggested_feedback: '',
      system_confidence: 0.9,
    };

    const spy = vi.spyOn(evaluationEngine, 'evaluateSession').mockRejectedValueOnce(
      new Error('MALFORMED_EVALUATION_OUTPUT')
    );

    await expect(
      evaluationEngine.evaluateSession({
        activity: SEED_ACTIVITY,
        session: baseSession,
        transcript: transcriptA,
      })
    ).rejects.toThrow('MALFORMED_EVALUATION_OUTPUT');

    spy.mockRestore();
  });
});
