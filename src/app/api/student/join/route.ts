import { NextRequest, NextResponse } from 'next/server';
import { StudentJoinSchema } from '@/lib/validation/session';
import { storage } from '@/lib/db/storage';
import { generateSessionToken, getStudentCookieOptions, hashSessionToken } from '@/lib/auth/student-session';

const GENERIC_JOIN_ERROR = 'تعذر الانضمام. تحقق من رمز النشاط وحاول مجددًا.';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = StudentJoinSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: GENERIC_JOIN_ERROR, details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { access_code, student_alias } = parsed.data;

    const activity = await storage.getActivityByCode(access_code);
    if (!activity || activity.status !== 'active') {
      // Return identical generic error for unknown, draft, or closed codes
      return NextResponse.json(
        { error: GENERIC_JOIN_ERROR },
        { status: 400 }
      );
    }

    // Generate cryptographic token and hash
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);

    // Create student session atomically
    const session = await storage.createSession(activity.id, student_alias, tokenHash);
    if (!session || !session.id) {
      return NextResponse.json(
        { error: 'تعذر إنشاء الجلسة. يرجى المحاولة ثانية.' },
        { status: 500 }
      );
    }

    // Secure response: return ONLY sessionId, NO teacher_id, NO rubric, NO sources, NO evaluations, NO rawToken in body
    const response = NextResponse.json({
      success: true,
      sessionId: session.id,
    });

    const cookieOptions = getStudentCookieOptions();
    response.cookies.set(cookieOptions.name, rawToken, cookieOptions);

    return response;
  } catch (error) {
    console.error('Error joining student session:', error);
    return NextResponse.json(
      { error: GENERIC_JOIN_ERROR },
      { status: 500 }
    );
  }
}
