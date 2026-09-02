import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage } from '../src/lib/db/storage';
import { SEED_ACTIVITY } from '../src/lib/db/seed';
import { generateSessionToken, hashSessionToken, STUDENT_SESSION_COOKIE } from '../src/lib/auth/student-session';
import { dialogueEngine } from '../src/lib/ai/dialogue-engine';
import { POST as studentChatHandler } from '../src/app/api/student/chat/route';
import { NextRequest } from 'next/server';

describe('Student Debate Arena - Recoverable AI Failures & Idempotent Retries', () => {
  let sessionId: string;
  let rawStudentToken: string;

  beforeEach(async () => {
    await storage.updateActivityStatus(SEED_ACTIVITY.id, 'active');
    rawStudentToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawStudentToken);
    const session = await storage.createSession(SEED_ACTIVITY.id, 'طالب_فحص_الاسترداد', tokenHash);
    sessionId = session.id;
  });

  it('1. First AI Failure after Student Persistence: saves student message, returns 503 recoverable error, saves no expert response, and does not prematurely advance stage', async () => {
    const clientMessageId = `turn-fail-1-${Date.now()}`;
    const studentContent = 'أرى أن الأدلة العلمية تثبت مسؤولية النشاط البشري عن التغير المناخي';

    // Mock dialogueEngine.processTurn to fail on first attempt
    const aiSpy = vi.spyOn(dialogueEngine, 'processTurn').mockRejectedValueOnce(new Error('AI Model Connection Timeout'));

    const req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: clientMessageId,
        content: studentContent,
        message_kind: 'normal',
      }),
    });

    const res = await studentChatHandler(req);
    const data = await res.json();

    // 1. Response status is 503 and indicates recoverable failure
    expect(res.status).toBe(503);
    expect(data.error).toBe('AI_PROVIDER_TEMPORARY_ERROR');
    expect(data.recoverable).toBe(true);
    expect(data.studentMessageSaved).toBe(true);
    expect(data.clientMessageId).toBe(clientMessageId);
    expect(data.message).toContain('تم حفظ رسالتك بنجاح');

    // 2. Exactly ONE student message persisted in storage
    const messages = await storage.getMessages(sessionId);
    expect(messages.length).toBe(1);
    expect(messages[0].sender).toBe('student');
    expect(messages[0].client_message_id).toBe(clientMessageId);
    expect(messages[0].content).toBe(studentContent);

    // 3. NO expert message fabricated or saved
    const expertMessages = messages.filter((m) => m.sender === 'expert');
    expect(expertMessages.length).toBe(0);

    // 4. Session stage is NOT prematurely advanced (remains baseline)
    const session = (await storage.getSessionById(sessionId))!;
    expect(session.current_stage).toBe('baseline');

    aiSpy.mockRestore();
  });

  it('2. Successful Retry: retrying with identical clientMessageId does NOT create a second student record, invokes AI, and persists one expert response', async () => {
    const clientMessageId = `turn-retry-2-${Date.now()}`;
    const studentContent = 'المصادر والبيانات تؤكد تسارع انبعاثات الكربون';

    // First attempt fails
    const failSpy = vi.spyOn(dialogueEngine, 'processTurn').mockRejectedValueOnce(new Error('AI Rate Limit Error'));

    const req1 = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: clientMessageId,
        content: studentContent,
        message_kind: 'normal',
      }),
    });

    const res1 = await studentChatHandler(req1);
    expect(res1.status).toBe(503);
    failSpy.mockRestore();

    // Second attempt (Retry) using the EXACT same client_message_id and content
    const req2 = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: clientMessageId,
        content: studentContent,
        message_kind: 'normal',
      }),
    });

    const res2 = await studentChatHandler(req2);
    const data2 = await res2.json();

    expect(res2.status).toBe(200);
    expect(data2.reply).toBeDefined();
    expect(data2.stage).toBe('evidence');
    expect(data2.studentMessageSaved).toBe(true);

    // Verify storage has exactly 1 student message and 1 expert response (total 2 messages)
    const messages = await storage.getMessages(sessionId);
    expect(messages.length).toBe(2);
    expect(messages[0].sender).toBe('student');
    expect(messages[0].client_message_id).toBe(clientMessageId);
    expect(messages[1].sender).toBe('expert');
    expect(messages[1].sequence_number).toBe(2);

    // Session stage properly advanced to authoritative stage
    const session = (await storage.getSessionById(sessionId))!;
    expect(session.current_stage).toBe('evidence');
  });

  it('3. Existing Expert Replay: duplicate retry after expert response is persisted returns replayed reply with ZERO AI calls and ZERO database inserts', async () => {
    const clientMessageId = `turn-replay-3-${Date.now()}`;
    const studentContent = 'أريد معرفة كيف نميز بين السبب والنتيجة';

    // Successful initial turn
    const req1 = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: clientMessageId,
        content: studentContent,
        message_kind: 'normal',
      }),
    });
    const res1 = await studentChatHandler(req1);
    expect(res1.status).toBe(200);

    const messagesBefore = await storage.getMessages(sessionId);
    const aiSpy = vi.spyOn(dialogueEngine, 'processTurn');

    // Duplicate request with the same clientMessageId
    const req2 = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`,
      },
      body: JSON.stringify({
        client_message_id: clientMessageId,
        content: studentContent,
        message_kind: 'normal',
      }),
    });
    const res2 = await studentChatHandler(req2);
    const data2 = await res2.json();

    expect(res2.status).toBe(200);
    expect(data2.replayed).toBe(true);
    expect(data2.reply).toBeDefined();

    // Zero AI calls and zero database mutations
    expect(aiSpy).not.toHaveBeenCalled();
    const messagesAfter = await storage.getMessages(sessionId);
    expect(messagesAfter.length).toBe(messagesBefore.length);

    aiSpy.mockRestore();
  });
});
