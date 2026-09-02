import { describe, it, expect, beforeEach } from 'vitest';
import { dialogueEngine, resolveAuthoritativeNextStage, SOCRATIC_STAGE_SEQUENCE } from '../src/lib/ai/dialogue-engine';
import { storage } from '../src/lib/db/storage';
import { SEED_ACTIVITY, CLIMATE_CHANGE_SOURCES } from '../src/lib/db/seed';
import { Session } from '../src/lib/db/schema';
import { generateSessionToken, hashSessionToken, STUDENT_SESSION_COOKIE } from '../src/lib/auth/student-session';
import { POST as studentChatHandler } from '../src/app/api/student/chat/route';
import { NextRequest } from 'next/server';

describe('Server-Owned Socratic Pedagogical Stage Progression', () => {
  let sessionId: string;
  let rawStudentToken: string;

  const activitySources = CLIMATE_CHANGE_SOURCES.map((s, idx) => ({
    id: `src-${idx + 1}`,
    activity_id: SEED_ACTIVITY.id,
    title: s.title,
    source_type: s.source_type,
    source_snapshot: s.source_snapshot,
    source_url: s.source_url || null,
    citation_label: s.citation_label,
    created_at: new Date().toISOString(),
  }));

  beforeEach(async () => {
    await storage.updateActivityStatus(SEED_ACTIVITY.id, 'active');
    rawStudentToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawStudentToken);
    const session = await storage.createSession(SEED_ACTIVITY.id, 'طالب_المراحل_التعليمية', tokenHash);
    sessionId = session.id;
  });

  it('1. Ordered Progression: advances sequentially through understanding -> evidence -> source_check -> counter_argument -> reflection', async () => {
    const session = (await storage.getSessionById(sessionId))!;

    // 1. From understanding -> evidence
    const turn1 = await dialogueEngine.processTurn({
      activity: SEED_ACTIVITY,
      sources: activitySources,
      session: { ...session, current_stage: 'understanding' },
      history: [],
      studentMessage: 'الفرق الأساسي هو أن التغير الطبيعي يستغرق آلاف السنين بينما الاحترار الحالي سريع جداً ومرتبط بالثورة الصناعية',
      messageKind: 'normal',
    });
    expect(turn1.next_stage).toBe('evidence');

    // 2. From evidence -> source_check
    const turn2 = await dialogueEngine.processTurn({
      activity: SEED_ACTIVITY,
      sources: activitySources,
      session: { ...session, current_stage: 'evidence' },
      history: [],
      studentMessage: 'تقرير IPCC يوضح ارتفاع تركيز ثاني أكسيد الكربون من 280 إلى 415 جزءاً في المليون مع بصمة الكربون-13',
      messageKind: 'normal',
    });
    expect(turn2.next_stage).toBe('source_check');

    // 3. From source_check -> counter_argument
    const turn3 = await dialogueEngine.processTurn({
      activity: SEED_ACTIVITY,
      sources: activitySources,
      session: { ...session, current_stage: 'source_check' },
      history: [],
      studentMessage: 'سجلات العينات الجليدية تمثل دليلاً مادياً مباشراً وموثوقاً لقياس الغازات المحبوسة في فقاعات الهواء عبر مئات آلاف السنين',
      messageKind: 'normal',
    });
    expect(turn3.next_stage).toBe('counter_argument');

    // 4. From counter_argument -> reflection
    const turn4 = await dialogueEngine.processTurn({
      activity: SEED_ACTIVITY,
      sources: activitySources,
      session: { ...session, current_stage: 'counter_argument' },
      history: [],
      studentMessage: 'إذا كان السبب هو الشمس لارتفعت حرارة جميع طبقات الجو، لكن برودة الستراتوسفير مع تسخين التروبوسفير يثبت التأثير البشري',
      messageKind: 'normal',
    });
    expect(turn4.next_stage).toBe('reflection');
  });

  it('2. Weak-Answer Retention: weak/unsupported answer stays at the same stage with scaffolded Socratic question', async () => {
    const session = (await storage.getSessionById(sessionId))!;

    const weakTurn = await dialogueEngine.processTurn({
      activity: SEED_ACTIVITY,
      sources: activitySources,
      session: { ...session, current_stage: 'understanding' },
      history: [],
      studentMessage: 'ما أعرف',
      messageKind: 'normal',
    });

    expect(weakTurn.next_stage).toBe('understanding');
    expect(weakTurn.stage_objective_satisfied).toBe(false);
    expect(weakTurn.reply).toContain('لا بأس يا طالب_المراحل_التعليمية');
    expect(weakTurn.reply).toContain('ما أول فكرة تخطر ببالك');
  });

  it('3. One-Step Maximum Rule: prevents multi-stage skipping even if proposed by model', () => {
    // Current is understanding, but decision mistakenly proposes reflection
    const clampedNext = resolveAuthoritativeNextStage(
      'understanding',
      {
        reply: 'إجابة ممتازة جداً',
        next_stage: 'reflection', // Forged skip
        stage_objective_satisfied: true,
        question_type: 'evidence_request',
        used_source_ids: [],
        unsupported_claim_refused: false,
      },
      'normal'
    );

    // Must be clamped to the very next stage only (evidence)
    expect(clampedNext).toBe('evidence');
  });

  it('4. Forged-Stage Rejection: server derives stage exclusively from session, ignoring client-forged stage inputs', async () => {
    const req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: `forged-stage-${Date.now()}`,
        content: 'تحديد دقيق للمفاهيم الأساسية والفرق بين المناخ والطقس',
        message_kind: 'normal',
        stage: 'reflection', // Attempt to inject/forge reflection stage
      }),
    });

    const res = await studentChatHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // Server starts from session baseline/understanding and advances only to evidence
    expect(data.stage).toBe('evidence');
  });

  it('5. Hint Non-Advancement: hint requests never advance the pedagogical stage', async () => {
    const session = (await storage.getSessionById(sessionId))!;

    const hintTurn = await dialogueEngine.processTurn({
      activity: SEED_ACTIVITY,
      sources: activitySources,
      session: { ...session, current_stage: 'evidence' },
      history: [],
      studentMessage: 'أحتاج مساعدة أو تلميح حول كيفية قراءة أرقام المصدر',
      messageKind: 'hint',
    });

    expect(hintTurn.next_stage).toBe('evidence');
    expect(hintTurn.question_type).toBe('hint');
  });

  it('6. Absence of Private Scoring Fields: student response contains only public stage and reply', async () => {
    const req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: `privacy-check-${Date.now()}`,
        content: 'المفاهيم واضحة وأريد استكشاف الأدلة',
        message_kind: 'normal',
      }),
    });

    const res = await studentChatHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.reply).toBeDefined();
    expect(data.stage).toBeDefined();
    expect(data.readiness_reasoning).toBeUndefined();
    expect(data.rubric_scores).toBeUndefined();
    expect(data.system_confidence).toBeUndefined();
    expect(data.evaluation).toBeUndefined();
  });
});
