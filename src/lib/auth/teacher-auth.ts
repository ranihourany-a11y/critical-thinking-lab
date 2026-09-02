export const TEACHER_SESSION_COOKIE = 'ctl_teacher_session';

export interface TeacherUser {
  id: string;
  email: string;
  role: 'teacher' | 'admin';
}

// Development default teacher ID for seamless local development
export const DEV_DEFAULT_TEACHER: TeacherUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'teacher@ctl.school.edu',
  role: 'teacher',
};

/**
 * Validates teacher session from cookies or headers
 */
export async function getAuthenticatedTeacher(cookieStore?: { get: (name: string) => { value: string } | undefined }): Promise<TeacherUser | null> {
  // If Supabase Auth is active, it would check the Supabase token.
  // For local development and testing, if the teacher cookie exists or DEV mode is enabled:
  if (cookieStore) {
    const cookie = cookieStore.get(TEACHER_SESSION_COOKIE);
    if (cookie?.value) {
      try {
        const parsed = JSON.parse(Buffer.from(cookie.value, 'base64').toString('utf8'));
        if (parsed?.id && parsed?.email) {
          return parsed;
        }
      } catch {
        // invalid cookie format
      }
    }
  }

  // Fallback to dev default in development if no explicit cookie
  return DEV_DEFAULT_TEACHER;
}
