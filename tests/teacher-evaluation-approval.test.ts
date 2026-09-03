import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage, dbStore } from '../src/lib/db/storage';
import { SEED_ACTIVITY } from '../src/lib/db/seed';
import { DEV_DEFAULT_TEACHER } from '../src/lib/auth/teacher-auth';
import { generateSessionToken, hashSessionToken, STUDENT_SESSION_COOKIE } from '../src/lib/auth/student-session';
import { PATCH as teacherSessionPatchHandler } from '../src/app/api/teacher/sessions/[id]/route';
import { POST as studentChatHandler } from '../src/app/api/student/chat/route';
import { evaluationEngine } from '../src/lib/ai/evaluation-engine';
import { NextRequest } from 'next/server';

describe('Teacher Evaluation Approval & State Management Hardening', () => {
  let sessionId: string;
  let rawStudentToken: string;
  let studentTokenHash: string;
  let teacherCookie: string;

  beforeEach(async () => {
    rawStudentToken = generateSessionToken();
    studentTokenHash = hashSessionToken(rawStudentToken);
    const session = await storage.createSession(SEED_ACTIVITY.id, 'طالب_اعتماد_التقييم', studentTokenHash);
    sessionId = session.id;

    const teacherAuthPayload = {
      id: DEV_DEFAULT_TEACHER.id,
      email: DEV_DEFAULT_TEACHER.email,
      role: 'teacher' as const,
    };
    const encodedTeacher = Buffer.from(JSON.stringify(teacherAuthPayload)).toString('base64');
    teacherCookie = `ctl_teacher_session=${encodedTeacher}`;

    // Add student message and complete session
    await storage.saveMessage(sessionId, {
      client_message_id: 'msg-approve-1',
      sequence_number: 1,
      sender: 'student',
      content: 'أدلة IPCC تظهر نمطاً واضحاً للاحتباس الحراري',
      stage: 'understanding',
      message_kind: 'normal',
      status: 'completed',
    });

    const completedSession = await storage.updateSessionReflection(sessionId, {
      final_stance: 'موقف نهائي',
      final_confidence: 4,
      strongest_evidence: 'دليل قوي جداً للموقف النهائي',
      strongest_counterargument: 'حجة معارضة ومناقشتها',
      remaining_uncertainty: 'تساؤل متبقي',
      final_reflection: 'تأمل نهائي مكتمل يحتوي على أكثر من عشرين حرفاً للتأكد من الصحة',
    });

    // Create an initial evaluation with teacher_approved = false
    const evalRecord = await evaluationEngine.evaluateSession({
      activity: SEED_ACTIVITY,
      session: completedSession!,
      transcript: await storage.getMessages(sessionId),
    });
    evalRecord.teacher_approved = false;
    await storage.saveEvaluation(evalRecord);
  });

  it('1. Authorized Approval: sets teacher_approved = true through PATCH endpoint', async () => {
    const req = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: teacherCookie,
      },
      body: JSON.stringify({
        teacher_approved: true,
        suggested_feedback: 'عمل ممتاز في تحليل الأدلة ومراجعة الحجج المضادة.',
      }),
    });

    const res = await teacherSessionPatchHandler(req, {
      params: Promise.resolve({ id: sessionId }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.evaluation.teacher_approved).toBe(true);
    expect(data.evaluation.suggested_feedback).toBe('عمل ممتاز في تحليل الأدلة ومراجعة الحجج المضادة.');

    // Verify storage record
    const stored = await storage.getEvaluation(sessionId);
    expect(stored?.teacher_approved).toBe(true);
  });

  it('2. Authorized Revocation: sets teacher_approved = false when revoked by teacher', async () => {
    // First approve
    await storage.updateEvaluationApproval(sessionId, true, 'اعتماد مبدئي');

    const req = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: teacherCookie,
      },
      body: JSON.stringify({
        teacher_approved: false,
      }),
    });

    const res = await teacherSessionPatchHandler(req, {
      params: Promise.resolve({ id: sessionId }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.evaluation.teacher_approved).toBe(false);

    const stored = await storage.getEvaluation(sessionId);
    expect(stored?.teacher_approved).toBe(false);
  });

  it('3. Idempotent Repeated State: repeated PATCH with identical state returns success without side effects', async () => {
    await storage.updateEvaluationApproval(sessionId, true, 'تغذية راجعة');

    const req = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: teacherCookie,
      },
      body: JSON.stringify({
        teacher_approved: true,
        suggested_feedback: 'تغذية راجعة',
      }),
    });

    const res = await teacherSessionPatchHandler(req, {
      params: Promise.resolve({ id: sessionId }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.replayed).toBe(true);
    expect(data.evaluation.teacher_approved).toBe(true);
  });

  it('4. Rejection of Unauthorized or Non-Owner Teacher: returns 401 or 403', async () => {
    // 4a: Unauthenticated -> 401
    const unauthReq = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacher_approved: true }),
    });
    const unauthRes = await teacherSessionPatchHandler(unauthReq, {
      params: Promise.resolve({ id: sessionId }),
    });
    expect(unauthRes.status).toBe(401);

    // 4b: Non-owner teacher -> 403
    const otherTeacherPayload = {
      id: '00000000-0000-0000-0000-000000000088',
      email: 'other_teacher_approve@ctl.school.edu',
      role: 'teacher' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    dbStore.teachers.set(otherTeacherPayload.id, otherTeacherPayload);

    const nonOwnerCookie = `ctl_teacher_session=${Buffer.from(JSON.stringify(otherTeacherPayload)).toString('base64')}`;
    const nonOwnerReq = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: nonOwnerCookie,
      },
      body: JSON.stringify({ teacher_approved: true }),
    });
    const nonOwnerRes = await teacherSessionPatchHandler(nonOwnerReq, {
      params: Promise.resolve({ id: sessionId }),
    });
    expect(nonOwnerRes.status).toBe(403);
  });

  it('5. Rejection of Malformed Payloads: non-boolean teacher_approved is rejected with 400', async () => {
    const req = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: teacherCookie,
      },
      body: JSON.stringify({
        teacher_approved: 'invalid-string', // non-boolean
      }),
    });

    const res = await teacherSessionPatchHandler(req, {
      params: Promise.resolve({ id: sessionId }),
    });

    expect(res.status).toBe(400);
  });

  it('6. Integrity Guarantee: approval modifies only status/feedback without altering scores, quotes, or calling AI', async () => {
    const beforeEval = (await storage.getEvaluation(sessionId))!;
    const engineSpy = vi.spyOn(evaluationEngine, 'evaluateSession');

    const req = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: teacherCookie,
      },
      body: JSON.stringify({
        teacher_approved: true,
      }),
    });

    const res = await teacherSessionPatchHandler(req, {
      params: Promise.resolve({ id: sessionId }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(engineSpy).not.toHaveBeenCalled();

    // Verify evaluation data integrity
    const afterEval = data.evaluation;
    expect(afterEval.rubric_scores).toEqual(beforeEval.rubric_scores);
    expect(afterEval.verified_quotes).toEqual(beforeEval.verified_quotes);
    expect(afterEval.strengths).toEqual(beforeEval.strengths);
    expect(afterEval.misconceptions).toEqual(beforeEval.misconceptions);
    expect(afterEval.system_confidence).toEqual(beforeEval.system_confidence);

    engineSpy.mockRestore();
  });

  it('7. Complete Student Isolation: student requests cannot see or mutate teacher approval state', async () => {
    const studentReq = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: `isolated-chat-${Date.now()}`,
        content: 'سؤال طالب',
        message_kind: 'normal',
      }),
    });

    const res = await studentChatHandler(studentReq);
    const data = await res.json();

    expect(data.teacher_approved).toBeUndefined();
    expect(data.evaluation).toBeUndefined();
    expect(data.rubric_scores).toBeUndefined();
  });
});
