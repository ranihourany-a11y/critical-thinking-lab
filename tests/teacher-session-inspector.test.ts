import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/lib/db/storage';
import { SEED_ACTIVITY } from '../src/lib/db/seed';
import { DEV_DEFAULT_TEACHER } from '../src/lib/auth/teacher-auth';
import { generateSessionToken, hashSessionToken } from '../src/lib/auth/student-session';
import { GET as teacherSessionGetHandler } from '../src/app/api/teacher/sessions/[id]/route';
import { evaluationEngine } from '../src/lib/ai/evaluation-engine';
import { NextRequest } from 'next/server';

describe('Teacher Session Inspector - Comprehensive Verification', () => {
  let sessionId: string;
  let rawStudentToken: string;
  let studentTokenHash: string;
  let teacherCookie: string;

  beforeEach(async () => {
    rawStudentToken = generateSessionToken();
    studentTokenHash = hashSessionToken(rawStudentToken);
    const session = await storage.createSession(SEED_ACTIVITY.id, 'طالب_فحص_المعلم', studentTokenHash);
    sessionId = session.id;

    const teacherAuthPayload = {
      id: DEV_DEFAULT_TEACHER.id,
      email: DEV_DEFAULT_TEACHER.email,
      role: 'teacher' as const,
    };
    const encodedTeacher = Buffer.from(JSON.stringify(teacherAuthPayload)).toString('base64');
    teacherCookie = `ctl_teacher_session=${encodedTeacher}`;

    // Simulate multiple turns with persisted hint count
    await storage.saveMessage(sessionId, {
      client_message_id: 'msg-turn-1-student',
      sequence_number: 1,
      sender: 'student',
      content: 'الاحتباس الحراري ناتج عن زيادة الغازات الدفيئة في الغلاف الجوي بسبب النشاط البشري',
      stage: 'understanding',
      message_kind: 'normal',
      status: 'completed',
    });

    await storage.saveMessage(sessionId, {
      client_message_id: 'msg-turn-2-expert',
      sequence_number: 2,
      sender: 'expert',
      content: 'ما هو الدليل المقاس الذي يربط بين حرق الوقود وتغير تركيز غاز الكربون؟',
      stage: 'evidence',
      message_kind: 'question',
      status: 'completed',
    });

    await storage.saveMessage(sessionId, {
      client_message_id: 'msg-turn-3-student',
      sequence_number: 3,
      sender: 'student',
      content: 'أحتاج تلميحاً حول نظائر الكربون وتوزيعها',
      stage: 'evidence',
      message_kind: 'hint',
      status: 'completed',
    });

    // Update session stage & hint count in persisted storage
    await storage.updateSessionStage(sessionId, 'source_check', true);

    await storage.saveMessage(sessionId, {
      client_message_id: 'msg-turn-4-expert',
      sequence_number: 4,
      sender: 'expert',
      content: 'لاحظ نسبة كربون-13 إلى كربون-12 في عينات الجليد',
      stage: 'source_check',
      message_kind: 'hint',
      status: 'completed',
    });
  });

  it('1. Chronological Message Order: returns all persisted messages exactly once and in strict sequence order without truncation', async () => {
    const req = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      headers: { cookie: teacherCookie },
    });
    const res = await teacherSessionGetHandler(req, {
      params: Promise.resolve({ id: sessionId }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);

    const messages = data.messages;
    expect(messages.length).toBe(4);

    // Strict chronological sequence ordering
    for (let i = 0; i < messages.length - 1; i++) {
      expect(messages[i].sequence_number).toBeLessThan(messages[i + 1].sequence_number);
    }

    expect(messages[0].sender).toBe('student');
    expect(messages[0].content).toContain('الاحتباس الحراري ناتج');
    expect(messages[1].sender).toBe('expert');
    expect(messages[2].message_kind).toBe('hint');
  });

  it('2. Accurate Persisted Hint Count: hint count derives strictly from persisted session records', async () => {
    const req = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      headers: { cookie: teacherCookie },
    });
    const res = await teacherSessionGetHandler(req, {
      params: Promise.resolve({ id: sessionId }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.session.hint_count).toBe(1);
  });

  it('3. Verified Quotes link to exact student message IDs', async () => {
    const session = (await storage.getSessionById(sessionId))!;
    const messages = await storage.getMessages(sessionId);

    const evalRecord = await evaluationEngine.evaluateSession({
      activity: SEED_ACTIVITY,
      session,
      transcript: messages,
    });
    await storage.saveEvaluation(evalRecord);

    const req = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      headers: { cookie: teacherCookie },
    });
    const res = await teacherSessionGetHandler(req, {
      params: Promise.resolve({ id: sessionId }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.evaluation).not.toBeNull();
    expect(data.evaluation.verified_quotes.length).toBeGreaterThan(0);

    const studentMessageIds = new Set(
      messages.filter((m) => m.sender === 'student').map((m) => m.id)
    );

    for (const vq of data.evaluation.verified_quotes) {
      if (vq.message_id && vq.message_id !== 'session-reflection') {
        expect(studentMessageIds.has(vq.message_id)).toBe(true);
      }
    }
  });

  it('4. Missing Evaluation Empty State: returns null evaluation when none has been generated', async () => {
    const req = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      headers: { cookie: teacherCookie },
    });
    const res = await teacherSessionGetHandler(req, {
      params: Promise.resolve({ id: sessionId }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.evaluation).toBeNull();
  });

  it('5. Prohibited Private Fields Absent: student tokens, hashes, prompts, and secrets are never in inspector payload', async () => {
    const req = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      headers: { cookie: teacherCookie },
    });
    const res = await teacherSessionGetHandler(req, {
      params: Promise.resolve({ id: sessionId }),
    });

    const data = await res.json();
    const serialized = JSON.stringify(data);

    // No raw token or token hash
    expect(data.session.session_token_hash).toBeUndefined();
    expect(serialized).not.toContain(rawStudentToken);
    expect(serialized).not.toContain(studentTokenHash);

    // No system prompt / internal secret keys
    expect(serialized).not.toContain('buildSocraticSystemPrompt');
    expect(serialized).not.toContain('SERVICE_ROLE');
    expect(serialized).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
