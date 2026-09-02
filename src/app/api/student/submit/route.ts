import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStudent } from '@/lib/auth/get-student';
import { StudentReflectionSchema } from '@/lib/validation/session';
import { storage } from '@/lib/db/storage';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate student via opaque session token hash
    const studentCtx = await getAuthenticatedStudent(req);
    if (!studentCtx) {
      return NextResponse.json({ error: 'غير مصرح - رمز الجلسة غير صالح' }, { status: 401 });
    }

    const { session } = studentCtx;

    const body = await req.json();
    const parsed = StudentReflectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'بيانات التأمل غير مكتملة', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // 2. Idempotent Retry & Conflict Handling for already submitted/locked sessions
    if (session.status === 'submitted' || session.status === 'locked') {
      const isIdentical =
        session.final_stance === parsed.data.final_stance &&
        session.final_confidence === parsed.data.final_confidence &&
        session.strongest_evidence === parsed.data.strongest_evidence &&
        session.strongest_counterargument === parsed.data.strongest_counterargument &&
        session.remaining_uncertainty === parsed.data.remaining_uncertainty &&
        session.final_reflection === parsed.data.final_reflection;

      if (isIdentical) {
        return NextResponse.json({
          success: true,
          message: 'تم إرسال الحوار إلى الأستاذ',
          sessionId: session.id,
          replayed: true,
        });
      } else {
        return NextResponse.json(
          {
            error: 'CONFLICT_ALREADY_SUBMITTED',
            message: 'تم إرسال هذا الحوار مسبقاً ببيانات مختلفة، والجلسة مغلقة ضد التعديل.',
          },
          { status: 409 }
        );
      }
    }

    // 3. Require authoritative Reflection stage
    if (session.current_stage !== 'reflection') {
      return NextResponse.json(
        {
          error: 'INVALID_STAGE',
          message: 'يجب إكمال جولات الحوار السقراطي والوصول إلى مرحلة التأمل الختامي قبل إرسال النموذج.',
        },
        { status: 403 }
      );
    }

    // 4. Save all reflection fields and lock session status to 'submitted' in one transaction
    try {
      const updatedSession = await storage.updateSessionReflection(session.id, parsed.data);
      if (!updatedSession) {
        return NextResponse.json(
          {
            error: 'FAILED_TO_SUBMIT_REFLECTION',
            retryable: true,
            message: 'تعذر حفظ التأمل وتأكيد إرسال الجلسة. يرجى إعادة المحاولة.',
          },
          { status: 500 }
        );
      }
    } catch (saveError) {
      console.error('Failed to commit reflection and lock session:', saveError);
      return NextResponse.json(
        {
          error: 'FAILED_TO_SUBMIT_REFLECTION',
          retryable: true,
          message: 'تعذر حفظ التأمل وتأكيد إرسال الجلسة. يرجى إعادة المحاولة.',
        },
        { status: 500 }
      );
    }

    // 5. Return success confirmation without scores or evaluation details
    return NextResponse.json({
      success: true,
      message: 'تم إرسال الحوار إلى الأستاذ',
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Error submitting student reflection:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إرسال التأمل' }, { status: 500 });
  }
}
