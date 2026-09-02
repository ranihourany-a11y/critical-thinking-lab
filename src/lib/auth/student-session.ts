import crypto from 'crypto';

export const STUDENT_SESSION_COOKIE = 'ctl_student_session';

/**
 * Generates a cryptographically strong random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes the SHA-256 hash of a session token
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Cookie options for the student session token
 */
export function getStudentCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    name: STUDENT_SESSION_COOKIE,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}
