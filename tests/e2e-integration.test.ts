import { describe, it, expect } from 'vitest';
import { storage } from '../src/lib/db/storage';
import { SEED_ACTIVITY } from '../src/lib/db/seed';
import { dialogueEngine } from '../src/lib/ai/dialogue-engine';
import { evaluationEngine } from '../src/lib/ai/evaluation-engine';
import { generateSessionToken, hashSessionToken } from '../src/lib/auth/student-session';

describe('End-to-End Educational Workflow (Student Journey & Teacher Inspection)', () => {
  it('should complete the entire student-teacher lifecycle seamlessly', async () => {
    // 1. Teacher Activity Verification
    await storage.updateActivityStatus(SEED_ACTIVITY.id, 'active');
    const activity = await storage.getActivityByCode(SEED_ACTIVITY.access_code);
    expect(activity).not.toBeNull();
    expect(activity?.status).toBe('active');
    expect(activity?.title).toBe('هل يساهم النشاط البشري في زيادة الاحتباس الحراري؟');
    const sources = await storage.getSources(activity!.id);
    expect(sources.length).toBeGreaterThanOrEqual(2);

    // 2. Student Lobby Join
    const studentAlias = 'مريم 08';
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const session = await storage.createSession(activity!.id, studentAlias, tokenHash);

    expect(session.id).toBeDefined();
    expect(session.student_alias).toBe('مريم 08');
    expect(session.current_stage).toBe('baseline');

    // 3. Student Preparation Phase
    const preparedSession = await storage.updateSessionPrepare(session.id, {
      initial_stance: 'أرى أن النشاط البشري هو المحرك الرئيسي للاحتباس الحراري',
      initial_reason: 'بسبب انبعاثات ثاني أكسيد الكربون من الوقود الأحفوري وازدياد نسبة الغازات الدفيئة في الغلاف الجوي',
      initial_confidence: 4,
    });
    expect(preparedSession?.initial_confidence).toBe(4);

    // 4. Student Socratic Debate Turn 1 (Baseline -> Understanding)
    const turn1ClientMsgId = 'msg-turn-1';
    await storage.saveMessage(session.id, {
      client_message_id: turn1ClientMsgId,
      sequence_number: 1,
      sender: 'student',
      content: 'توضح تقارير الهيئة الحكومية الدولية أن نسبة ثاني أكسيد الكربون ارتفعت من 280 إلى 415 جزءاً في المليون بفعل الوقود الأحفوري',
      stage: preparedSession!.current_stage,
      message_kind: 'normal',
      status: 'completed',
    });

    const turn1Decision = await dialogueEngine.processTurn({
      activity: activity!,
      sources,
      session: preparedSession!,
      history: await storage.getMessages(session.id),
      studentMessage: 'توضح تقارير الهيئة الحكومية الدولية أن نسبة ثاني أكسيد الكربون ارتفعت من 280 إلى 415 جزءاً في المليون بفعل الوقود الأحفوري',
      messageKind: 'normal',
    });

    expect(turn1Decision.next_stage).toBe('understanding');
    expect(turn1Decision.reply.length).toBeGreaterThan(10);
    expect(turn1Decision.used_source_ids.length).toBeGreaterThan(0);

    // Persist Expert Turn 1
    await storage.saveMessage(session.id, {
      client_message_id: `expert-${turn1ClientMsgId}`,
      sequence_number: 2,
      sender: 'expert',
      content: turn1Decision.reply,
      stage: turn1Decision.next_stage,
      message_kind: 'normal',
      status: 'completed',
    });
    await storage.updateSessionStage(session.id, turn1Decision.next_stage, false);

    // 5. Student Helper Action: Hint Turn
    const hintClientMsgId = 'msg-hint-turn';
    const updatedSessionAfterTurn1 = await storage.getSessionById(session.id);
    const hintDecision = await dialogueEngine.processTurn({
      activity: activity!,
      sources,
      session: updatedSessionAfterTurn1!,
      history: await storage.getMessages(session.id),
      studentMessage: 'أحتاج تلميحاً يوجه تفكيري في الأدلة المتاحة.',
      messageKind: 'hint',
    });

    expect(hintDecision.question_type).toBe('hint');
    expect(hintDecision.reply).toContain('تلميح مرشد');

    await storage.saveMessage(session.id, {
      client_message_id: hintClientMsgId,
      sequence_number: 3,
      sender: 'student',
      content: 'أحتاج تلميحاً يوجه تفكيري في الأدلة المتاحة.',
      stage: updatedSessionAfterTurn1!.current_stage,
      message_kind: 'hint',
      status: 'completed',
    });

    await storage.saveMessage(session.id, {
      client_message_id: `expert-${hintClientMsgId}`,
      sequence_number: 4,
      sender: 'expert',
      content: hintDecision.reply,
      stage: hintDecision.next_stage,
      message_kind: 'hint',
      status: 'completed',
    });
    await storage.updateSessionStage(session.id, hintDecision.next_stage, true);

    const sessionAfterHint = await storage.getSessionById(session.id);
    expect(sessionAfterHint?.hint_count).toBe(1);

    // 6. Student Reflection Submission
    const reflectionSession = await storage.updateSessionReflection(session.id, {
      final_stance: 'النشاط البشري هو السبب الحاسم في الاحترار العالمي المعاصر',
      final_confidence: 5,
      strongest_evidence: 'تحليلات نظائر الكربون التي تثبت أن الزيادة مصدرها حرق الوقود الأحفوري وليس البراكين',
      strongest_counterargument: 'الادعاء القائل بأنها دورة شمسية طبيعية، ولكن ناسا أثبتت تبريد الستراتوسفير وتسخين التروبوسفير',
      remaining_uncertainty: 'كيفية تحسين دقة النماذج المناخية في التنبؤ بالتغيرات الإقليمية المحلية',
      final_reflection: 'تعلمت أهمية التمييز بين الارتباط والسببية وفحص البصمة الحرارية للأدلة العلمية المعتمدة',
    });

    expect(reflectionSession?.status).toBe('submitted');
    expect(reflectionSession?.current_stage).toBe('submitted');

    // 7. Formative Evaluation Generation (Teacher Private)
    const fullTranscript = await storage.getMessages(session.id);
    const evaluation = await evaluationEngine.evaluateSession({
      activity: activity!,
      session: reflectionSession!,
      transcript: fullTranscript,
    });
    await storage.saveEvaluation(evaluation);

    expect(evaluation.session_id).toBe(session.id);
    expect(evaluation.rubric_scores.length).toBe(activity!.rubric_config.length);
    expect(evaluation.strengths.length).toBeGreaterThan(0);
    expect(evaluation.teacher_approved).toBe(false);

    // 8. Teacher Inspection & Approval
    const teacherSessions = await storage.getSessionsForActivity(activity!.id);
    const targetSessionInList = teacherSessions.find((s) => s.id === session.id);
    expect(targetSessionInList).toBeDefined();
    expect(targetSessionInList?.status).toBe('submitted');

    const approvedEval = await storage.updateEvaluationApproval(
      session.id,
      true,
      'تفكير نقدي ممتاز يا مريم وقدرة متقدمة على توظيف بيانات نظائر الكربون والبصمة الحرارية.'
    );

    expect(approvedEval?.teacher_approved).toBe(true);
    expect(approvedEval?.suggested_feedback).toContain('تفكير نقدي ممتاز يا مريم');
  });
});
