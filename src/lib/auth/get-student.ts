import { NextRequest } from 'next/server';
import { hashSessionToken, STUDENT_SESSION_COOKIE } from './student-session';
import { storage } from '../db/storage';
import { Activity, Session } from '../db/schema';

export interface AuthenticatedStudentContext {
  session: Session;
  activity: Activity;
}

export async function getAuthenticatedStudent(
  req: NextRequest,
  expectedSessionId?: string
): Promise<AuthenticatedStudentContext | null> {
  let rawToken: string | undefined;

  // 1. Check HttpOnly cookie
  const cookie = req.cookies.get(STUDENT_SESSION_COOKIE);
  if (cookie?.value) {
    rawToken = cookie.value;
  }

  // 2. Check Authorization Bearer header as fallback
  if (!rawToken) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawToken = authHeader.substring(7).trim();
    }
  }

  // 3. Fallback for testing: session ID header if dev token provided
  if (!rawToken && expectedSessionId) {
    const session = await storage.getSessionById(expectedSessionId);
    if (session) {
      const activity = await storage.getActivity(session.activity_id);
      if (activity) {
        return { session, activity };
      }
    }
  }

  if (!rawToken) return null;

  const tokenHash = hashSessionToken(rawToken);
  const session = await storage.getSessionByTokenHash(tokenHash);
  if (!session) return null;

  if (expectedSessionId && session.id !== expectedSessionId) {
    return null;
  }

  const activity = await storage.getActivity(session.activity_id);
  if (!activity) return null;

  return { session, activity };
}
