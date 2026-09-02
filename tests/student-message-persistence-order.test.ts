import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage } from '../src/lib/db/storage';
import { generateSessionToken, hashSessionToken, STUDENT_SESSION_COOKIE } from '../src/lib/auth/student-session';
import { SEED_ACTIVITY } from '../src/lib/db/seed';
import { dialogueEngine } from '../src/lib/ai/dialogue-engine';
import { POST as chatHandler } from '../src/app/api/student/chat/route';
import { NextRequest } from 'next/server';

describe('Hardened Student Message Persistence Order & AI Call Isolation', () => {
  let sessionId: string;
  let rawToken: string;

  beforeEach(async () => {
    await storage.updateActivityStatus(SEED_ACTIVITY.id, 'active');
    rawToken = generateSessionToken();
    const hash = hashSessionToken(rawToken);
    const session = await storage.createSession(SEED_ACTIVITY.id, 'طالب_اختبار_التسلسل', hash);
    sessionId = session.id;
  });

  it('1. should persist student message to storage BEFORE calling the AI provider', async () => {
    const clientMsgId = `order-test-${Date.now()}`;
    let studentPersistedBeforeAI = false;

    const processTurnSpy = vi.spyOn(dialogueEngine, 'processTurn').mockImplementation(async (params) => {
      // Check if student message is already persisted in storage at the time AI is called
      const messagesInDb = await storage.getMessages(sessionId);
      const studentMsg = messagesInDb.find((m) => m.client_message_id === clientMsgId);
      if (studentMsg && studentMsg.content === 'رسالة فحص التسلسل الزمني') {
        studentPersistedBeforeAI = true;
      }
      return {
        reply: 'رد المرشد السقراطي بعد التحقق',
        next_stage: 'understanding',
        question_type: 'clarification',
        used_source_ids: [],
        unsupported_claim_refused: false,
      };
    });

    const req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawToken}`,
      },
      body: JSON.stringify({
        client_message_id: clientMsgId,
        content: 'رسالة فحص التسلسل الزمني',
        message_kind: 'normal',
      }),
    });

    const res = await chatHandler(req);
    expect(res.status).toBe(200);
    expect(studentPersistedBeforeAI).toBe(true);

    processTurnSpy.mockRestore();
  });

  it('2. should NEVER call the AI provider if student message persistence fails', async () => {
    const clientMsgId = `failed-insert-${Date.now()}`;
    const processTurnSpy = vi.spyOn(dialogueEngine, 'processTurn');
    const saveMessageSpy = vi.spyOn(storage, 'saveMessage').mockRejectedValueOnce(new Error('DB connection pool exhausted'));

    const req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawToken}`,
      },
      body: JSON.stringify({
        client_message_id: clientMsgId,
        content: 'رسالة فشل الحفظ المبدئي',
        message_kind: 'normal',
      }),
    });

    const res = await chatHandler(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('FAILED_TO_SAVE_STUDENT_MESSAGE');
    expect(data.retryable).toBe(true);
    expect(data.message).toContain('تعذر حفظ رسالتك');
    expect(processTurnSpy).not.toHaveBeenCalled();

    saveMessageSpy.mockRestore();
    processTurnSpy.mockRestore();
  });

  it('3. should preserve the student message and NOT save an expert reply if AI provider fails', async () => {
    const clientMsgId = `ai-failure-${Date.now()}`;
    const processTurnSpy = vi.spyOn(dialogueEngine, 'processTurn').mockRejectedValueOnce(
      new Error('AI Provider 503 Overloaded')
    );

    const req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawToken}`,
      },
      body: JSON.stringify({
        client_message_id: clientMsgId,
        content: 'رسالة صامدة رغم عطل الذكاء الاصطناعي',
        message_kind: 'normal',
      }),
    });

    const res = await chatHandler(req);
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.error).toBe('AI_PROVIDER_TEMPORARY_ERROR');
    expect(data.recoverable).toBe(true);
    expect(data.studentMessageSaved).toBe(true);

    // Verify database state: Student message exists, but NO expert message was saved
    const messages = await storage.getMessages(sessionId);
    const studentMsg = messages.find((m) => m.client_message_id === clientMsgId);
    expect(studentMsg).toBeDefined();
    expect(studentMsg?.content).toBe('رسالة صامدة رغم عطل الذكاء الاصطناعي');

    const expertMsg = messages.find((m) => m.sender === 'expert');
    expect(expertMsg).toBeUndefined();

    processTurnSpy.mockRestore();
  });
});
