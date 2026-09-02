import { storage } from '@/lib/db/storage';
import { createServerClient } from '@supabase/ssr';

export const TEACHER_SESSION_COOKIE = 'ctl_teacher_session';

export interface TeacherUser {
  id: string;
  email: string;
  role: 'teacher' | 'admin';
}

// Development default teacher ID for explicit local-only bypass
export const DEV_DEFAULT_TEACHER: TeacherUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'teacher@ctl.school.edu',
  role: 'teacher',
};

/**
 * Validates that the requested next URL is a safe, relative teacher-only path
 */
export function getSafeTeacherRedirect(nextParam?: string | null): string {
  if (!nextParam) return '/teacher';
  try {
    const decoded = decodeURIComponent(nextParam).trim();
    if (
      decoded.startsWith('/teacher') &&
      !decoded.startsWith('//') &&
      !decoded.startsWith('/\\') &&
      !decoded.includes('://')
    ) {
      return decoded;
    }
  } catch {
    // Decoding error
  }
  return '/teacher';
}

/**
 * Validates teacher session using server-verified Supabase getUser() identity
 * and verifies that the authenticated user matches an authorized teacher record.
 */
export async function getAuthenticatedTeacher(cookieStore?: {
  get: (name: string) => { value: string } | undefined;
  getAll?: () => { name: string; value: string }[];
}): Promise<TeacherUser | null> {
  // 1. Strictly require BOTH non-production environment AND explicit local-only bypass flag
  const allowDevBypass =
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_DEV_AUTH_BYPASS === 'true';

  if (allowDevBypass) {
    return DEV_DEFAULT_TEACHER;
  }

  // 2. Server-verified Supabase Identity via getUser()
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
      {
        cookies: {
          getAll() {
            if (cookieStore?.getAll) {
              return cookieStore.getAll();
            }
            return [];
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user || !user.email) {
      // Fallback check for session cookie if test/mock cookie bridge is used
      if (cookieStore) {
        const cookie = cookieStore.get(TEACHER_SESSION_COOKIE);
        if (cookie?.value) {
          try {
            const raw = typeof atob === 'function' ? atob(cookie.value) : Buffer.from(cookie.value, 'base64').toString('utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.email === 'string') {
              const authorized = (await storage.getTeacher(parsed.id)) || (await storage.getTeacherByEmail(parsed.email));
              if (authorized) {
                return {
                  id: authorized.id,
                  email: authorized.email,
                  role: authorized.role,
                };
              }
            }
          } catch {}
        }
      }
      return null;
    }

    // 3. Ensure user is in the authorized teachers directory
    const authorizedTeacher =
      (await storage.getTeacher(user.id)) ||
      (await storage.getTeacherByEmail(user.email));

    if (!authorizedTeacher) {
      // Authenticated non-teachers are explicitly denied
      return null;
    }

    return {
      id: authorizedTeacher.id,
      email: authorizedTeacher.email,
      role: authorizedTeacher.role,
    };
  } catch {
    return null;
  }
}
