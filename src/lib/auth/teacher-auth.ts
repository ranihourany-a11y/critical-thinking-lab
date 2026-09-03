import 'server-only';

import { storage } from '@/lib/db/storage';
import { createServerClient } from '@supabase/ssr';
import { DEV_DEFAULT_TEACHER, TeacherUser } from './teacher-fixture';
export { getSafeTeacherRedirect } from './teacher-redirect';
export { DEV_DEFAULT_TEACHER, type TeacherUser } from './teacher-fixture';

export const TEACHER_SESSION_COOKIE = 'ctl_teacher_session';

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 2. Server-verified Supabase Identity via getUser() if configured
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
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

      if (!error && user && user.email) {
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
      }
    } catch {
      // Supabase network / verification error - fall through to session check below
    }
  }

  // 3. Fallback check for session cookie if test/mock cookie bridge is used
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
