import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage } from '../src/lib/db/storage';
import { SEED_ACTIVITY } from '../src/lib/db/seed';
import { DEV_DEFAULT_TEACHER } from '../src/lib/auth/teacher-auth';
import { generateSessionToken, hashSessionToken, STUDENT_SESSION_COOKIE } from '../src/lib/auth/student-session';
import { POST as teacherEvaluationPostHandler } from '../src/app/api/teacher/sessions/[id]/route';
import { POST as studentChatHandler } from '../src/app/api/student/chat/route';
import { evaluationEngine } from '../src/lib/ai/evaluation-engine';
import { NextRequest } from 'next/server';

describe('Teacher On-Demand Private Evaluation Generation', () => {
  let sessionId: string;
  let rawStudentToken: string;
  let studentTokenHash: string;
  let teacherCookie: string;

  beforeEach(async () => {
    rawStudentToken = generateSessionToken();
    studentTokenHash = hashSessionToken(rawStudentToken);
    const session = await storage.createSession(SEED_ACTIVITY.id, 'طالب_التقييم_المباشر', studentTokenHash);
    sessionId = session.id;

    const teacherAuthPayload = {
      id: DEV_DEFAULT_TEACHER.id,
      email: DEV_DEFAULT_TEACHER.email,
      role: 'teacher' as const,
    };
    const encodedTeacher = Buffer.from(JSON.stringify(teacherAuthPayload)).toString('base64');
    teacherCookie = `ctl_teacher_session=${encodedTeacher}`;

    // Add student message
    await storage.saveMessage(sessionId, {
      client_message_id: 'msg-eval-1',
      sequence_number: 1,
      sender: 'student',
      content: 'الاحتباس الحراري يرتبط مباشرة بارتفاع نسب غازات الدفيئة وفق بيانات IPCC الموثقة',
      stage: 'understanding',
      message_kind: 'normal',
      status: 'completed',
    });

    // Complete session with reflection
    await storage.updateSessionReflection(sessionId, {
      final_stance: 'تأييد التحول الطاقي مع أدلة IPCC',
      final_confidence: 4,
      strongest_evidence: 'بيانات تركيز ثاني أكسيد الكربون ونظائر الكربون',
      strongest_counterargument: 'تكلفة التحول الطاقي على بعض القطاعات',
      remaining_uncertainty: 'سرعة نشر البطاريات العملاقة',
      final_reflection: 'تعلمت فحص الأدلة ونقد الحجج المضادة ومراجعة الفرضيات بعناية علمية',
    });
  });

  it('1. Successful Generation: generates private evaluation on completed session with teacher_approved = false', async () => {
    const req = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'POST',
      headers: { cookie: teacherCookie },
    });

    const res = await teacherEvaluationPostHandler(req, {
      params: Promise.resolve({ id: sessionId }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.evaluation).toBeDefined();
    expect(data.evaluation.session_id).toBe(sessionId);
    expect(data.evaluation.teacher_approved).toBe(false);
    expect(data.evaluation.rubric_scores.length).toBeGreaterThan(0);
    expect(data.evaluation.system_confidence).toBeGreaterThan(0);

    // Verify stored evaluation
    const storedEval = await storage.getEvaluation(sessionId);
    expect(storedEval).not.toBeNull();
    expect(storedEval?.teacher_approved).toBe(false);
  });

  it('2. Existing-Evaluation Reuse (Idempotency): returns existing evaluation with zero AI provider calls', async () => {
    // Generate initial evaluation
    const initialReq = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'POST',
      headers: { cookie: teacherCookie },
    });
    await teacherEvaluationPostHandler(initialReq, {
      params: Promise.resolve({ id: sessionId }),
    });

    // Spy on evaluateSession to ensure it is NOT called on repeat requests
    const engineSpy = vi.spyOn(evaluationEngine, 'evaluateSession');

    // Second on-demand request (double click or repeat)
    const repeatReq = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'POST',
      headers: { cookie: teacherCookie },
    });
    const repeatRes = await teacherEvaluationPostHandler(repeatReq, {
      params: Promise.resolve({ id: sessionId }),
    });

    const repeatData = await repeatRes.json();
    expect(repeatRes.status).toBe(200);
    expect(repeatData.replayed).toBe(true);
    expect(repeatData.evaluation).toBeDefined();
    expect(engineSpy).not.toHaveBeenCalled();

    engineSpy.mockRestore();
  });

  it('3. Rejection of Incomplete Sessions: rejects on-demand evaluation if session is still active/unsubmitted with 400', async () => {
    // Create an uncompleted session
    const uncompletedTokenHash = hashSessionToken(generateSessionToken());
    const uncompletedSession = await storage.createSession(
      SEED_ACTIVITY.id,
      'طالب_غير_مكتمل',
      uncompletedTokenHash
    );

    const req = new NextRequest(`http://localhost:3000/api/teacher/sessions/${uncompletedSession.id}`, {
      method: 'POST',
      headers: { cookie: teacherCookie },
    });

    const res = await teacherEvaluationPostHandler(req, {
      params: Promise.resolve({ id: uncompletedSession.id }),
    });

    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('SESSION_INCOMPLETE');
    expect(data.message).toContain('لا يمكن إنشاء التقييم إلا بعد إكمال الطالب');
  });

  it('4. Rejection of Unauthorized Teacher: rejects requests without teacher auth (401) or from non-owner (403)', async () => {
    // 4a: Unauthenticated -> 401
    const unauthReq = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'POST',
    });
    const unauthRes = await teacherEvaluationPostHandler(unauthReq, {
      params: Promise.resolve({ id: sessionId }),
    });
    expect(unauthRes.status).toBe(401);

    // 4b: Authorized teacher who is not the owner -> 403
    const { dbStore } = await import('../src/lib/db/storage');
    const otherTeacherPayload = {
      id: '00000000-0000-0000-0000-000000000099',
      email: 'other_teacher@ctl.school.edu',
      role: 'teacher' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    dbStore.teachers.set(otherTeacherPayload.id, otherTeacherPayload);

    const nonOwnerCookie = `ctl_teacher_session=${Buffer.from(JSON.stringify(otherTeacherPayload)).toString('base64')}`;
    const nonOwnerReq = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'POST',
      headers: { cookie: nonOwnerCookie },
    });
    const nonOwnerRes = await teacherEvaluationPostHandler(nonOwnerReq, {
      params: Promise.resolve({ id: sessionId }),
    });
    expect(nonOwnerRes.status).toBe(403);
  });

  it('5. Atomic Failure Handling: provider error saves no partial evaluation and returns retryable 500', async () => {
    const freshToken = generateSessionToken();
    const freshSession = await storage.createSession(
      SEED_ACTIVITY.id,
      'طالب_فحص_الخطأ',
      hashSessionToken(freshToken)
    );
    await storage.saveMessage(freshSession.id, {
      client_message_id: 'err-msg-1',
      sequence_number: 1,
      sender: 'student',
      content: 'رسالة الطالب',
      stage: 'understanding',
      message_kind: 'normal',
      status: 'completed',
    });
    await storage.updateSessionReflection(freshSession.id, {
      final_stance: 'موقف',
      final_confidence: 3,
      strongest_evidence: 'دليل قوي جداً لا يقل عن 10 أحرف',
      strongest_counterargument: 'حجة مضادة قوية لا تقل عن 10 أحرف',
      remaining_uncertainty: 'عدم يقين',
      final_reflection: 'تأمل نهائي مكتمل يحتوي على أكثر من عشرين حرفاً للتأكد من الصحة',
    });

    // Mock evaluationEngine.evaluateSession to throw error
    const engineSpy = vi.spyOn(evaluationEngine, 'evaluateSession').mockRejectedValueOnce(new Error('AI Engine Timeout'));

    const req = new NextRequest(`http://localhost:3000/api/teacher/sessions/${freshSession.id}`, {
      method: 'POST',
      headers: { cookie: teacherCookie },
    });

    const res = await teacherEvaluationPostHandler(req, {
      params: Promise.resolve({ id: freshSession.id }),
    });

    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.error).toBe('FAILED_TO_GENERATE_EVALUATION');
    expect(data.retryable).toBe(true);
    expect(data.message).toContain('تعذر إنشاء التقييم التحليلي');

    // Verify ZERO evaluation saved in storage
    const storedEval = await storage.getEvaluation(freshSession.id);
    expect(storedEval).toBeNull();

    engineSpy.mockRestore();
  });

  it('6. Absence of Evaluation Data from Student Responses: student chat/submit never receive evaluation payload', async () => {
    const studentChatReq = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: `chat-${Date.now()}`,
        content: 'سؤال للطالب',
        message_kind: 'normal',
      }),
    });

    const studentChatRes = await studentChatHandler(studentChatReq);
    const studentChatData = await studentChatRes.json();

    expect(studentChatData.rubric_scores).toBeUndefined();
    expect(studentChatData.evaluation).toBeUndefined();
    expect(studentChatData.system_confidence).toBeUndefined();
    expect(studentChatData.verified_quotes).toBeUndefined();
  });
});
