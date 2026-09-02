import { describe, it, expect } from 'vitest';
import { SocraticDialogueEngine } from '../src/lib/ai/dialogue-engine';
import { SEED_ACTIVITY, CLIMATE_CHANGE_SOURCES } from '../src/lib/db/seed';
import { Session, ActivitySource } from '../src/lib/db/schema';

describe('SocraticDialogueEngine & Pedagogical Stages', () => {
  const engine = new SocraticDialogueEngine();

  const mockSources: ActivitySource[] = CLIMATE_CHANGE_SOURCES.map((s, idx) => ({
    id: `src-${idx + 1}`,
    activity_id: SEED_ACTIVITY.id,
    title: s.title,
    source_type: s.source_type,
    source_snapshot: s.source_snapshot,
    source_url: s.source_url || null,
    citation_label: s.citation_label,
    created_at: new Date().toISOString(),
  }));

  it('should advance from baseline to understanding stage with an engaging, interactive Socratic probe', async () => {
    const mockSession: Session = {
      id: 'sess-1',
      activity_id: SEED_ACTIVITY.id,
      student_alias: 'سارة',
      session_token_hash: 'hash-1',
      initial_stance: 'الأنشطة البشرية تسبب تغير المناخ',
      initial_reason: 'بسبب انبعاثات المصانع والسيارات',
      initial_confidence: 4,
      final_stance: null,
      final_confidence: null,
      strongest_evidence: null,
      strongest_counterargument: null,
      remaining_uncertainty: null,
      final_reflection: null,
      current_stage: 'baseline',
      hint_count: 0,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const decision = await engine.processTurn({
      activity: SEED_ACTIVITY,
      sources: mockSources,
      session: mockSession,
      history: [],
      studentMessage: 'أعتقد أن انبعاثات المصانع والوقود الأحفوري هي السبب الأساسي للاحتباس الحراري',
      messageKind: 'normal',
    });

    expect(decision.next_stage).toBe('understanding');
    expect(decision.reply).toContain('سارة');
    expect(decision.used_source_ids.length).toBeGreaterThan(0);
    expect(decision.unsupported_claim_refused).toBe(false);
    expect(decision.reply.includes('؟')).toBe(true); // Poses thought-provoking question
  });

  it('should accept reasoned logical analogies connected to sources without false rejections', async () => {
    const mockSession: Session = {
      id: 'sess-analogy',
      activity_id: SEED_ACTIVITY.id,
      student_alias: 'ليلى',
      session_token_hash: 'hash-analogy',
      initial_stance: 'الغازات الدفيئة تشبه الغطاء الحراري العازل للأرض',
      initial_reason: 'لأنها تحبس الأشعة تحت الحمراء في طبقة التروبوسفير',
      initial_confidence: 4,
      final_stance: null,
      final_confidence: null,
      strongest_evidence: null,
      strongest_counterargument: null,
      remaining_uncertainty: null,
      final_reflection: null,
      current_stage: 'causal_reasoning',
      hint_count: 0,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const decision = await engine.processTurn({
      activity: SEED_ACTIVITY,
      sources: mockSources,
      session: mockSession,
      history: [],
      studentMessage: 'يمكننا تشبيه زيادة ثاني أكسيد الكربون بغطاء إضافي يمنع تسرب الحرارة ويسخن الطبقة القريبة منا',
      messageKind: 'normal',
    });

    expect(decision.unsupported_claim_refused).toBe(false);
    expect(decision.next_stage).toBe('counter_argument');
    expect(decision.reply).toContain('ليلى');
    expect(decision.used_source_ids.length).toBeGreaterThan(0);
  });

  it('should refuse unsupported claims when strict source grounding is active', async () => {
    const mockSession: Session = {
      id: 'sess-2',
      activity_id: SEED_ACTIVITY.id,
      student_alias: 'خالد',
      session_token_hash: 'hash-2',
      initial_stance: 'مؤامرة',
      initial_reason: 'أظن أن الأمر سببه فضائيين يغيرون الطقس',
      initial_confidence: 5,
      final_stance: null,
      final_confidence: null,
      strongest_evidence: null,
      strongest_counterargument: null,
      remaining_uncertainty: null,
      final_reflection: null,
      current_stage: 'evidence',
      hint_count: 0,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const decision = await engine.processTurn({
      activity: SEED_ACTIVITY,
      sources: mockSources,
      session: mockSession,
      history: [],
      studentMessage: 'هناك فضائيين يغيرون المناخ بسفنهم الفضائية',
      messageKind: 'normal',
    });

    expect(decision.unsupported_claim_refused).toBe(true);
    expect(decision.reply).toContain('المصادر');
  });

  it('should provide a grounded hint without advancing stage when messageKind is hint', async () => {
    const mockSession: Session = {
      id: 'sess-3',
      activity_id: SEED_ACTIVITY.id,
      student_alias: 'عمر',
      session_token_hash: 'hash-3',
      initial_stance: 'متردد',
      initial_reason: null,
      initial_confidence: 2,
      final_stance: null,
      final_confidence: null,
      strongest_evidence: null,
      strongest_counterargument: null,
      remaining_uncertainty: null,
      final_reflection: null,
      current_stage: 'evidence',
      hint_count: 1,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const decision = await engine.processTurn({
      activity: SEED_ACTIVITY,
      sources: mockSources,
      session: mockSession,
      history: [],
      studentMessage: 'أحتاج تلميحاً يوضح الدليل في المصدر',
      messageKind: 'hint',
    });

    expect(decision.question_type).toBe('hint');
    expect(decision.next_stage).toBe('evidence');
    expect(decision.reply).toContain('تلميح مرشد');
  });
});
