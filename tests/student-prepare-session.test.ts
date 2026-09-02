import { describe, it, expect } from 'vitest';
import { getAuthenticatedStudent } from '../src/lib/auth/get-student';
import { storage } from '../src/lib/db/storage';
import { generateSessionToken, hashSessionToken, STUDENT_SESSION_COOKIE } from '../src/lib/auth/student-session';
import { SEED_ACTIVITY } from '../src/lib/db/seed';
import { NextRequest } from 'next/server';

describe('Student Prepare Session Authentication & Error Handling', () => {
  it('should successfully authenticate and load a valid active session without leaking evaluation data', async () => {
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);

    const session = await storage.createSession(SEED_ACTIVITY.id, 'طالب_متميز', tokenHash);
    expect(session).toBeDefined();
    expect(session.status).toBe('active');

    const req = new NextRequest(`http://localhost:3000/api/student/session`, {
      headers: {
        cookie: `${STUDENT_SESSION_COOKIE}=${rawToken}`,
      },
    });

    const studentCtx = await getAuthenticatedStudent(req, session.id);
    expect(studentCtx).not.toBeNull();
    expect(studentCtx?.session.id).toBe(session.id);
    expect(studentCtx?.session.student_alias).toBe('طالب_متميز');
    expect(studentCtx?.activity.id).toBe(SEED_ACTIVITY.id);

    // Verify no evaluation scores or teacher data leaked
    expect((studentCtx?.session as any).evaluations).toBeUndefined();
    expect((studentCtx?.session as any).rubric_scores).toBeUndefined();
  });

  it('should reject missing, invalid, or mismatched session tokens without creating records or leaking DB internals', async () => {
    // 1. Completely bogus session token
    const bogusReq = new NextRequest(`http://localhost:3000/api/student/session`, {
      headers: {
        cookie: `${STUDENT_SESSION_COOKIE}=bogus-non-existent-token-12345`,
      },
    });

    const bogusCtx = await getAuthenticatedStudent(bogusReq);
    expect(bogusCtx).toBeNull();

    // 2. Missing cookie altogether
    const emptyReq = new NextRequest(`http://localhost:3000/api/student/session`);
    const emptyCtx = await getAuthenticatedStudent(emptyReq);
    expect(emptyCtx).toBeNull();

    // 3. Mismatched session ID
    const validRawToken = generateSessionToken();
    const validHash = hashSessionToken(validRawToken);
    const session = await storage.createSession(SEED_ACTIVITY.id, 'طالب_آخر', validHash);

    const mismatchReq = new NextRequest(`http://localhost:3000/api/student/session`, {
      headers: {
        cookie: `${STUDENT_SESSION_COOKIE}=${validRawToken}`,
      },
    });

    const mismatchCtx = await getAuthenticatedStudent(mismatchReq, 'wrong-session-id-999');
    expect(mismatchCtx).toBeNull();
  });
});
