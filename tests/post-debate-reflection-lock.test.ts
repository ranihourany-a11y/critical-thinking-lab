import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage, dbStore } from '../src/lib/db/storage';
import { SEED_ACTIVITY } from '../src/lib/db/seed';
import { generateSessionToken, hashSessionToken, STUDENT_SESSION_COOKIE } from '../src/lib/auth/student-session';
import { POST as studentSubmitHandler } from '../src/app/api/student/submit/route';
import { POST as studentChatHandler } from '../src/app/api/student/chat/route';
import { NextRequest } from 'next/server';

describe('Post-Debate Reflection Submission & Session Lock Hardening', () => {
  let sessionId: string;
  let rawStudentToken: string;

  const validReflectionPayload = {
    final_stance: 'موقفي النهائي هو تأييد الحاجة للانتقال الطاقي مع مراعاة العدالة الاقتصادية',
    final_confidence: 4,
    strongest_evidence: 'تقرير IPCC الذي يثبت الارتفاع المتسارع لغازات الاحتباس الحراري',
    strongest_counterargument: 'الحجة القائلة بأن تكلفة التحول قد تؤثر على الدول النامية',
    remaining_uncertainty: 'التساؤل حول سرعة نضج تقنيات تخزين الطاقة المتجددة',
    final_reflection: 'تعلمت من هذا الحوار كيفية فحص مصادر الأدلة والتمييز بين الارتباط الإحصائي والسببية الفيزيائية',
  };

  beforeEach(async () => {
    await storage.updateActivityStatus(SEED_ACTIVITY.id, 'active');
    rawStudentToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawStudentToken);
    const session = await storage.createSession(SEED_ACTIVITY.id, 'طالب_التأمل_النهائي', tokenHash);
    sessionId = session.id;

    // Advance session stage to authoritative 'reflection'
    const storedSession = dbStore.sessions.get(sessionId)!;
    storedSession.current_stage = 'reflection';
  });

  it('1. Atomic Success: saves all reflection fields, locks session to submitted, and returns RTL confirmation without scores', async () => {
    const req = new NextRequest('http://localhost:3000/api/student/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify(validReflectionPayload),
    });

    const res = await studentSubmitHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('تم إرسال الحوار إلى الأستاذ');
    expect(data.rubric_scores).toBeUndefined();
    expect(data.evaluation).toBeUndefined();

    // Verify persisted session state
    const lockedSession = (await storage.getSessionById(sessionId))!;
    expect(lockedSession.status).toBe('submitted');
    expect(lockedSession.current_stage).toBe('submitted');
    expect(lockedSession.final_stance).toBe(validReflectionPayload.final_stance);
    expect(lockedSession.final_confidence).toBe(4);
    expect(lockedSession.final_reflection).toBe(validReflectionPayload.final_reflection);
  });

  it('2. Rollback on Failure: write failure leaves session active and unchanged, returning retryable Arabic error', async () => {
    const updateSpy = vi.spyOn(storage, 'updateSessionReflection').mockRejectedValueOnce(new Error('DB Write Failure'));

    const req = new NextRequest('http://localhost:3000/api/student/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify(validReflectionPayload),
    });

    const res = await studentSubmitHandler(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.retryable).toBe(true);
    expect(data.message).toContain('تعذر حفظ التأمل');

    // Session remains active
    const unchangedSession = (await storage.getSessionById(sessionId))!;
    expect(unchangedSession.status).toBe('active');
    expect(unchangedSession.current_stage).toBe('reflection');

    updateSpy.mockRestore();
  });

  it('3. Identical Retry: resubmitting exact same payload returns 200 idempotent confirmation', async () => {
    // Initial successful submit
    await storage.updateSessionReflection(sessionId, validReflectionPayload);

    const req = new NextRequest('http://localhost:3000/api/student/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify(validReflectionPayload),
    });

    const res = await studentSubmitHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.replayed).toBe(true);
    expect(data.message).toBe('تم إرسال الحوار إلى الأستاذ');
  });

  it('4. Conflicting Resubmission: submitting different payload after completion returns 409 Conflict', async () => {
    // Initial submit
    await storage.updateSessionReflection(sessionId, validReflectionPayload);

    const conflictingPayload = {
      ...validReflectionPayload,
      final_stance: 'موقف معدل تماماً بعد قفل الجلسة وإرسالها',
    };

    const req = new NextRequest('http://localhost:3000/api/student/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify(conflictingPayload),
    });

    const res = await studentSubmitHandler(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe('CONFLICT_ALREADY_SUBMITTED');
    expect(data.message).toContain('تم إرسال هذا الحوار مسبقاً ببيانات مختلفة');
  });

  it('5. Blocked Post-Completion Chat: chat/hint endpoints reject mutations on completed session with 403', async () => {
    // Lock session to submitted
    await storage.updateSessionReflection(sessionId, validReflectionPayload);

    const req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: `post-submit-msg-${Date.now()}`,
        content: 'رسالة إضافية بعد إرسال التأمل النهائي',
        message_kind: 'normal',
      }),
    });

    const res = await studentChatHandler(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('مقفلة أو تم إرسالها');
  });

  it('6. Non-Reflection Stage Blocked: rejects submission if session has not reached reflection stage', async () => {
    const storedSession = dbStore.sessions.get(sessionId)!;
    storedSession.current_stage = 'understanding'; // Not yet in reflection

    const req = new NextRequest('http://localhost:3000/api/student/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify(validReflectionPayload),
    });

    const res = await studentSubmitHandler(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('INVALID_STAGE');
    expect(data.message).toContain('يجب إكمال جولات الحوار السقراطي');
  });
});
