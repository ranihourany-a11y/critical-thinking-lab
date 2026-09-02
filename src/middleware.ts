import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedTeacher } from '@/lib/auth/teacher-auth';

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Protect all teacher routes except public login route
  if (pathname.startsWith('/teacher')) {
    if (pathname === '/teacher/login' || pathname.startsWith('/teacher/login/')) {
      return NextResponse.next();
    }

    const teacher = await getAuthenticatedTeacher(req.cookies);

    if (!teacher) {
      const loginUrl = new URL('/teacher/login', req.url);
      const targetPath = pathname + search;
      loginUrl.search = `next=${encodeURIComponent(targetPath)}`;
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/teacher', '/teacher/:path*'],
};
