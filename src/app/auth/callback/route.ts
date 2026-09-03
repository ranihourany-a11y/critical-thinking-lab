import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getSafeTeacherRedirect } from '@/lib/auth/teacher-redirect';
import { storage } from '@/lib/db/storage';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  const safeNext = getSafeTeacherRedirect(nextParam);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/teacher/login?error=service_unavailable', origin));
  }

  if (code) {
    const response = NextResponse.redirect(new URL(safeNext, origin));

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        // 1. Verify against Supabase teachers table via authenticated session
        try {
          const { data: dbTeacher } = await supabase
            .from('teachers')
            .select('id, email, role, created_at, updated_at')
            .eq('id', user.id)
            .maybeSingle();

          if (dbTeacher) {
            await storage.upsertTeacher({
              id: dbTeacher.id,
              email: dbTeacher.email,
              role: dbTeacher.role as 'teacher' | 'admin',
              created_at: dbTeacher.created_at,
              updated_at: dbTeacher.updated_at,
            });
            return response;
          }
        } catch {
          // Fall through to memory / storage verification
        }

        // 2. Verify against in-memory storage fixtures
        const authorized =
          (await storage.getTeacher(user.id)) ||
          (await storage.getTeacherByEmail(user.email));

        if (authorized) {
          return response;
        }
      }

      // Authenticated non-teacher or unauthorized email
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/teacher/login?error=unauthorized', origin));
    }
  }

  // Code missing or exchange failed
  return NextResponse.redirect(new URL('/teacher/login?error=invalid_token', origin));
}
