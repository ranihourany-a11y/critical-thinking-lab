import { NextRequest, NextResponse } from 'next/server';
import { StudentJoinSchema } from '@/lib/validation/session';
import { storage } from '@/lib/db/storage';
import { generateSessionToken, getStudentCookieOptions, hashSessionToken } from '@/lib/auth/student-session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = StudentJoinSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'بيانات غير صالحة', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { access_code, student_alias } = parsed.data;

    const activity = await storage.getActivityByCode(access_code);
    if (!activity) {
      return NextResponse.json(
        { error: 'رمز النشاط غير صحيح أو غير موجود' },
        { status: 404 }
      );
    }

    if (activity.status !== 'active') {
      return NextResponse.json(
        { error: 'هذا النشاط مغلق حالياً أو غير متاح للانضمام' },
        { status: 403 }
      );
    }

    // Generate cryptographic token and hash
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);

    // Create student session
    const session = await storage.createSession(activity.id, student_alias, tokenHash);

    // Secure response with HttpOnly cookie containing rawToken
    const response = NextResponse.json({
      sessionId: session.id,
      studentAlias: session.student_alias,
      activity: {
        id: activity.id,
        title: activity.title,
        topic: activity.topic,
        gradeLevel: activity.grade_level,
        language: activity.language,
        maxTurns: activity.max_turns,
      },
    });

    const cookieOptions = getStudentCookieOptions();
    response.cookies.set(cookieOptions.name, rawToken, cookieOptions);

    return response;
  } catch (error) {
    console.error('Error joining student session:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم أثناء الانضمام' }, { status: 500 });
  }
}
