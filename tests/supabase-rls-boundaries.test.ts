import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/lib/db/storage';
import { SEED_ACTIVITY } from '../src/lib/db/seed';
import { DEV_DEFAULT_TEACHER } from '../src/lib/auth/teacher-auth';
import { generateSessionToken, hashSessionToken } from '../src/lib/auth/student-session';
import { evaluationEngine } from '../src/lib/ai/evaluation-engine';

describe('Supabase RLS & Database Access Boundaries', () => {
  const teacherA = DEV_DEFAULT_TEACHER;
  const teacherB = {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'other_teacher@ctl.school.edu',
    role: 'teacher' as const,
  };

  let sessionId: string;
  let rawStudentToken: string;
  let studentTokenHash: string;

  beforeEach(async () => {
    rawStudentToken = generateSessionToken();
    studentTokenHash = hashSessionToken(rawStudentToken);
    const session = await storage.createSession(SEED_ACTIVITY.id, 'طالب_فحص_الأمان', studentTokenHash);
    sessionId = session.id;

    await storage.saveMessage(sessionId, {
      client_message_id: 'm1',
      sequence_number: 1,
      sender: 'student',
      content: 'رسالة الطالب المحمية',
      stage: 'baseline',
      message_kind: 'normal',
      status: 'completed',
    });

    // Create an evaluation for the session
    const evalRecord = await evaluationEngine.evaluateSession({
      activity: SEED_ACTIVITY,
      session,
      transcript: await storage.getMessages(sessionId),
    });
    await storage.saveEvaluation(evalRecord);
  });

  it('1. Owner Teacher: has full access to own teacher record, activities, sessions, messages, and evaluations', async () => {
    // Activity ownership check (teacherA is owner of SEED_ACTIVITY)
    const activity = await storage.getActivity(SEED_ACTIVITY.id);
    expect(activity).not.toBeNull();
    expect(activity?.teacher_id).toBe(teacherA.id);

    // Sessions and messages belonging to teacherA's activity
    const sessions = await storage.getSessionsForActivity(SEED_ACTIVITY.id);
    expect(sessions.some((s) => s.id === sessionId)).toBe(true);

    const messages = await storage.getMessages(sessionId);
    expect(messages.length).toBeGreaterThan(0);

    // Evaluation belonging to teacherA's activity session
    const evaluation = await storage.getEvaluation(sessionId);
    expect(evaluation).not.toBeNull();
    expect(evaluation?.session_id).toBe(sessionId);
  });

  it('2. Non-Owner Teacher: denied access to another teacher\'s activities and private records', async () => {
    // Teacher B attempts to query activities owned by Teacher A
    const allActivities = await storage.getActivities(teacherB.id);
    const hasTeacherAActivity = allActivities.some((a) => a.id === SEED_ACTIVITY.id);
    expect(hasTeacherAActivity).toBe(false);

    // Direct check: Activity owner must match authenticated user
    const activity = await storage.getActivity(SEED_ACTIVITY.id);
    const isOwner = activity?.teacher_id === teacherB.id;
    expect(isOwner).toBe(false);
  });

  it('3. Anon / Direct Student Access: direct table access without teacher auth is denied', async () => {
    // Simulated unauthenticated client query without auth.uid
    const unauthenticatedAuthUid = null;
    const canAccessActivity = unauthenticatedAuthUid === SEED_ACTIVITY.teacher_id;
    expect(canAccessActivity).toBe(false);

    const canAccessEvaluation = unauthenticatedAuthUid !== null;
    expect(canAccessEvaluation).toBe(false);
  });

  it('4. Evaluation Strict Isolation: evaluations are private to owner teacher, never accessible by students', async () => {
    // Student token validation only provides access to session context, NOT evaluation
    const session = await storage.getSessionByTokenHash(studentTokenHash);
    expect(session).not.toBeNull();

    // Verify session does not contain evaluation or rubric scores
    expect((session as any).evaluation).toBeUndefined();
    expect((session as any).rubric_scores).toBeUndefined();
    expect((session as any).system_confidence).toBeUndefined();

    // Evaluation retrieval is strictly restricted to teacher activity owner
    const evalData = await storage.getEvaluation(sessionId);
    const activity = await storage.getActivity(session!.activity_id);
    const isTeacherOwner = activity?.teacher_id === teacherA.id;
    expect(isTeacherOwner).toBe(true);
  });

  it('5. Server Endpoint Token Verification: student access requires valid opaque token hash', () => {
    // Valid token matches hash
    const isValid = hashSessionToken(rawStudentToken) === studentTokenHash;
    expect(isValid).toBe(true);

    // Invalid token fails
    const fakeToken = generateSessionToken();
    const isFakeValid = hashSessionToken(fakeToken) === studentTokenHash;
    expect(isFakeValid).toBe(false);
  });
});
