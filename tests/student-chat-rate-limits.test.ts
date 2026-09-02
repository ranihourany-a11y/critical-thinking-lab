import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage, dbStore } from '../src/lib/db/storage';
import { SEED_ACTIVITY } from '../src/lib/db/seed';
import { generateSessionToken, hashSessionToken, STUDENT_SESSION_COOKIE } from '../src/lib/auth/student-session';
import { dialogueEngine } from '../src/lib/ai/dialogue-engine';
import { POST as studentChatHandler } from '../src/app/api/student/chat/route';
import { NextRequest } from 'next/server';

describe('Student Chat Rate Limiting, Input Validation & Abuse Hardening', () => {
  let sessionId: string;
  let rawStudentToken: string;

  beforeEach(async () => {
    await storage.updateActivityStatus(SEED_ACTIVITY.id, 'active');
    rawStudentToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawStudentToken);
    const session = await storage.createSession(SEED_ACTIVITY.id, 'طالب_فحص_الحدود', tokenHash);
    sessionId = session.id;
  });

  it('1. Oversized input: rejects messages > 2,000 characters with 400 and performs zero inserts / zero AI calls', async () => {
    const processTurnSpy = vi.spyOn(dialogueEngine, 'processTurn');
    const saveMessageSpy = vi.spyOn(storage, 'saveMessage');

    const oversizedText = 'أ'.repeat(2001);
    const req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: `oversized-${Date.now()}`,
        content: oversizedText,
        message_kind: 'normal',
      }),
    });

    const res = await studentChatHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('بيانات غير صالحة');
    expect(processTurnSpy).not.toHaveBeenCalled();
    expect(saveMessageSpy).not.toHaveBeenCalled();

    processTurnSpy.mockRestore();
    saveMessageSpy.mockRestore();
  });

  it('2. Inactive/Completed session & closed activity: rejects with 403 and zero inserts / zero AI calls', async () => {
    const processTurnSpy = vi.spyOn(dialogueEngine, 'processTurn');
    const saveMessageSpy = vi.spyOn(storage, 'saveMessage');

    // Case 2a: Session is marked 'submitted'
    const session = (await storage.getSessionById(sessionId))!;
    session.status = 'submitted';

    saveMessageSpy.mockClear();
    processTurnSpy.mockClear();

    const req1 = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: `submitted-sess-${Date.now()}`,
        content: 'رسالة بعد انتهاء الجلسة',
        message_kind: 'normal',
      }),
    });

    const res1 = await studentChatHandler(req1);
    expect(res1.status).toBe(403);
    expect(processTurnSpy).not.toHaveBeenCalled();
    expect(saveMessageSpy).not.toHaveBeenCalled();

    // Reset session
    session.status = 'active';

    // Case 2b: Activity is closed
    const storedAct = dbStore.activities.get(SEED_ACTIVITY.id)!;
    const originalActivityStatus = storedAct.status;
    storedAct.status = 'closed';

    saveMessageSpy.mockClear();
    processTurnSpy.mockClear();

    const req2 = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: `closed-act-${Date.now()}`,
        content: 'رسالة لنشاط مغلق',
        message_kind: 'normal',
      }),
    });

    const res2 = await studentChatHandler(req2);
    expect(res2.status).toBe(403);
    expect(processTurnSpy).not.toHaveBeenCalled();
    expect(saveMessageSpy).not.toHaveBeenCalled();

    storedAct.status = originalActivityStatus;
    processTurnSpy.mockRestore();
    saveMessageSpy.mockRestore();
  });

  it('3. Cooldown: returns 429 Too Many Requests with Retry-After if < 1.5s since last student message', async () => {
    // Manually persist a student message with current timestamp
    await storage.saveMessage(sessionId, {
      client_message_id: `prev-msg-${Date.now()}`,
      sequence_number: 1,
      sender: 'student',
      content: 'الرسالة الأولى',
      stage: 'baseline',
      message_kind: 'normal',
      status: 'completed',
    });

    const processTurnSpy = vi.spyOn(dialogueEngine, 'processTurn');
    const saveMessageSpy = vi.spyOn(storage, 'saveMessage');

    // Immediate second message (0ms elapsed < 1500ms)
    const req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: `rapid-msg-${Date.now()}`,
        content: 'الرسالة السريعة جداً بدون انتظار',
        message_kind: 'normal',
      }),
    });

    const res = await studentChatHandler(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeDefined();
    expect(data.error).toBe('RATE_LIMIT_COOLDOWN');
    expect(data.message).toContain('يرجى التمهل قليلاً');

    expect(processTurnSpy).not.toHaveBeenCalled();
    expect(saveMessageSpy).not.toHaveBeenCalled();

    processTurnSpy.mockRestore();
    saveMessageSpy.mockRestore();
  });

  it('4. Turn Cap: rejects with 400 when session reaches 60 student turns with zero inserts / zero AI calls', async () => {
    // Populate session with 60 student messages
    for (let i = 1; i <= 60; i++) {
      await storage.saveMessage(sessionId, {
        client_message_id: `cap-turn-${i}`,
        sequence_number: i,
        sender: 'student',
        content: `رسالة رقم ${i}`,
        stage: 'understanding',
        message_kind: 'normal',
        status: 'completed',
      });
    }

    const processTurnSpy = vi.spyOn(dialogueEngine, 'processTurn');
    const saveMessageSpy = vi.spyOn(storage, 'saveMessage');

    const req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: `turn-61-${Date.now()}`,
        content: 'محاولة إرسال الجولة رقم 61 بعد الوصول للحد الأقصى',
        message_kind: 'normal',
      }),
    });

    const res = await studentChatHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.shouldReflect).toBe(true);
    expect(data.error).toContain('تم الوصول إلى الحد الأقصى');

    expect(processTurnSpy).not.toHaveBeenCalled();
    expect(saveMessageSpy).not.toHaveBeenCalled();

    processTurnSpy.mockRestore();
    saveMessageSpy.mockRestore();
  });

  it('5. Valid request: succeeds and processes turn normally', async () => {
    const req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: `valid-${Date.now()}`,
        content: 'أرى أن النشاط الصناعي ساهم بشكل رئيسي في زيادة الغازات الدفيئة',
        message_kind: 'normal',
      }),
    });

    const res = await studentChatHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.reply).toBeDefined();
    expect(data.studentMessageSaved).toBe(true);
  });
});
