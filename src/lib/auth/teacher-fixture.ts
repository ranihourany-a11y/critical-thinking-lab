import 'server-only';

export interface TeacherUser {
  id: string;
  email: string;
  role: 'teacher' | 'admin';
}

// Development default teacher fixture for server-side auth, database seeding, and testing
export const DEV_DEFAULT_TEACHER: TeacherUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'teacher@ctl.school.edu',
  role: 'teacher',
};
