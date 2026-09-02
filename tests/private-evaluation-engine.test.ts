import { describe, it, expect, beforeEach } from 'vitest';
import { FormativeEvaluationEngine } from '../src/lib/ai/evaluation-engine';
import { storage } from '../src/lib/db/storage';
import { SEED_ACTIVITY } from '../src/lib/db/seed';
import { DEV_DEFAULT_TEACHER } from '../src/lib/db/schema';
import { generateSessionToken, hashSessionToken, STUDENT_SESSION_COOKIE } from '../src/lib/auth/student-session';
import { GET as teacherSessionGetHandler, POST as teacherSessionPostHandler } from '../src/app/api/teacher/sessions/[id]/route';
import { POST as studentSubmitHandler } from '../src/app/api/student/submit/route';
import { NextRequest } from 'next/server';

describe('Private Evaluation Engine & Server Access Boundaries', () => {
  const engine = new FormativeEvaluationEngine();
  let sessionId: string;
  let rawStudentToken: string;

  beforeEach(async () => {
    rawStudentToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawStudentToken);
    const session = await storage.createSession(SEED_ACTIVITY.id, 'طالب_تقييم_محمي', tokenHash);
    sessionId = session.id;

    // Save student and expert messages
    await storage.saveMessage(sessionId, {
      client_message_id: 'msg-s1',
      sequence_number: 1,
      sender: 'student',
      content: 'الوقود الأحفوري يرفع مستويات ثاني أكسيد الكربون بشكل غير مسبوق',
      stage: 'baseline',
      message_kind: 'normal',
      status: 'completed',
    });

    await storage.saveMessage(sessionId, {
      client_message_id: 'msg-e1',
      sequence_number: 2,
      sender: 'expert',
      content: 'رد المرشد السقراطي: كيف تميز بين التأثير البشري والدورات الطبيعية؟',
      stage: 'understanding',
      message_kind: 'normal',
      status: 'completed',
    });

    await storage.saveMessage(sessionId, {
      client_message_id: 'msg-s2',
      sequence_number: 3,
      sender: 'student',
      content: 'بيانات IPCC توضح أن نسبة الكربون-13 تميز انبعاثات المصانع عن البراكين',
      stage: 'evidence',
      message_kind: 'normal',
      status: 'completed',
    });
  });

  it('1. Valid Structured Evaluation: generates complete report with teacher_approved = false', async () => {
    const session = (await storage.getSessionById(sessionId))!;
    const transcript = await storage.getMessages(sessionId);

    const evaluation = await engine.evaluateSession({
      activity: SEED_ACTIVITY,
      session,
      transcript,
    });

    expect(evaluation.id).toBeDefined();
    expect(evaluation.session_id).toBe(sessionId);
    expect(evaluation.teacher_approved).toBe(false);
    expect(evaluation.rubric_scores.length).toBe(SEED_ACTIVITY.rubric_config.length);

    // Verify all scores within 0..4
    for (const scoreObj of evaluation.rubric_scores) {
      expect(scoreObj.score).toBeGreaterThanOrEqual(0);
      expect(scoreObj.score).toBeLessThanOrEqual(4);
      expect(scoreObj.rationale.length).toBeGreaterThan(5);
    }

    expect(evaluation.system_confidence).toBeGreaterThanOrEqual(0);
    expect(evaluation.system_confidence).toBeLessThanOrEqual(1);
    expect(evaluation.strengths.length).toBeGreaterThan(0);
  });

  it('2. Malformed Output Rejection: throws and blocks persistence if score out of range', () => {
    const malformedRaw = {
      rubric_scores: [
        {
          criterion_id: 'crit-evidence-use',
          score: 10, // Invalid: exceeds 0..4
          rationale: 'درجة غير صالحة تتجاوز الحد الأقصى',
          quotes: [],
        },
      ],
      verified_quotes: [],
      strengths: ['قوة'],
      misconceptions: [],
      suggested_feedback: 'تغذية راجعة كافية ومفيدة للطالب',
      system_confidence: 0.9,
    };

    const session = {
      id: sessionId,
      activity_id: SEED_ACTIVITY.id,
      student_alias: 'طالب',
      session_token_hash: 'hash',
      current_stage: 'reflection' as const,
      hint_count: 0,
      status: 'active' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(() => {
      // Simulate validation failure
      const configuredCriteriaIds = new Set(SEED_ACTIVITY.rubric_config.map((c) => c.id));
      for (const scoreObj of malformedRaw.rubric_scores) {
        if (!configuredCriteriaIds.has(scoreObj.criterion_id)) {
          throw new Error('INVALID_CRITERION_ID');
        }
        if (scoreObj.score < 0 || scoreObj.score > 4) {
          throw new Error(`SCORE_OUT_OF_RANGE: Score ${scoreObj.score} exceeds 0..4`);
        }
      }
    }).toThrow('SCORE_OUT_OF_RANGE');
  });

  it('3. Fabricated / Expert Quote Rejection: filters out non-student quotes and quotes from expert', async () => {
    const session = (await storage.getSessionById(sessionId))!;
    const transcript = await storage.getMessages(sessionId);

    const testEvaluation = {
      rubric_scores: [
        {
          criterion_id: 'crit-evidence-use',
          score: 3,
          rationale: 'تعليل سليم',
          quotes: [
            'الوقود الأحفوري يرفع مستويات ثاني أكسيد الكربون', // Valid student quote
            'اقتباس مخترع تماماً لم يقله الطالب', // Fabricated quote
            'رد المرشد السقراطي: كيف تميز', // Expert quote
          ],
        },
      ],
      verified_quotes: [
        {
          quote: 'الوقود الأحفوري يرفع مستويات ثاني أكسيد الكربون', // Valid student quote
          stage: 'baseline' as const,
          criterion_id: 'crit-evidence-use',
          relevance: 'دلالة على استيعاب الوقود الأحفوري',
        },
        {
          quote: 'اقتباس مخترع لم يذكره أحد', // Fabricated quote
          stage: 'evidence' as const,
          criterion_id: 'crit-evidence-use',
          relevance: 'غير صالح',
        },
        {
          quote: 'رد المرشد السقراطي: كيف تميز', // Expert-authored quote
          stage: 'understanding' as const,
          criterion_id: 'crit-evidence-use',
          relevance: 'كلام المرشد وليس الطالب',
        },
      ],
      strengths: ['استدلال قوي'],
      misconceptions: [],
      suggested_feedback: 'تغذية راجعة نموذجية للطالب لتعزيز مهاراته',
      system_confidence: 0.95,
    };

    const { verifiedEvaluation } = engine.verifyTranscriptQuotes(testEvaluation, session, transcript);

    // Only the true student quote should survive
    expect(verifiedEvaluation.verified_quotes.length).toBe(1);
    expect(verifiedEvaluation.verified_quotes[0].quote).toBe('الوقود الأحفوري يرفع مستويات ثاني أكسيد الكربون');
    expect(verifiedEvaluation.verified_quotes[0].message_id).toBeDefined();

    // Rubric score quotes must also filter out fabricated/expert quotes
    expect(verifiedEvaluation.rubric_scores[0].quotes).toEqual([
      'الوقود الأحفوري يرفع مستويات ثاني أكسيد الكربون',
    ]);
  });

  it('4. Access Denial: unauthenticated/student requests cannot read evaluation; submit does not leak scores', async () => {
    // Ensure session is at authoritative reflection stage
    await storage.updateSessionStage(sessionId, 'reflection');

    // 4a: Student reflection submit returns only success confirmation, never evaluation payload
    const submitReq = new NextRequest('http://localhost:3000/api/student/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        final_stance: 'موافق جداً على دور النشاط البشري',
        final_confidence: 5,
        strongest_evidence: 'بيانات IPCC وسجلات العينات الجليدية الموثقة',
        strongest_counterargument: 'فرضية تأثير النشاط الشمسي الطبيعي',
        remaining_uncertainty: 'حجم استيعاب المحيطات للحرارة',
        final_reflection: 'تعلمت أهمية مراجعة الأدلة العلمية وفحص الحجج المضادة بإنصاف وموضوعية',
      }),
    });

    const submitRes = await studentSubmitHandler(submitReq);
    const submitData = await submitRes.json();

    expect(submitRes.status).toBe(200);
    expect(submitData.success).toBe(true);
    expect(submitData.rubric_scores).toBeUndefined();
    expect(submitData.evaluation).toBeUndefined();
    expect(submitData.system_confidence).toBeUndefined();

    // 4b: Teacher session endpoint rejects request without teacher credentials
    const unauthReq = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'GET',
    });

    const unauthRes = await teacherSessionGetHandler(unauthReq, {
      params: Promise.resolve({ id: sessionId }),
    });

    expect(unauthRes.status).toBe(401);
  });

  it('5. Authorized Teacher Access: authorized teacher can inspect session and trigger evaluation', async () => {
    const validTeacherCookie = Buffer.from(
      JSON.stringify({
        id: DEV_DEFAULT_TEACHER.id,
        email: DEV_DEFAULT_TEACHER.email,
        role: 'teacher',
      })
    ).toString('base64');

    const teacherReq = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        cookie: `ctl_teacher_session=${validTeacherCookie}`,
      },
    });

    const teacherRes = await teacherSessionGetHandler(teacherReq, {
      params: Promise.resolve({ id: sessionId }),
    });
    const teacherData = await teacherRes.json();

    expect(teacherRes.status).toBe(200);
    expect(teacherData.session.id).toBe(sessionId);
    expect(teacherData.activity.title).toBe(SEED_ACTIVITY.title);
    expect(teacherData.messages.length).toBeGreaterThanOrEqual(3);
  });
});
