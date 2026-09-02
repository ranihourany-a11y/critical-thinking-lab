import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStudent } from '@/lib/auth/get-student';
import { StudentReflectionSchema } from '@/lib/validation/session';
import { storage } from '@/lib/db/storage';
import { evaluationEngine } from '@/lib/ai/evaluation-engine';

export async function POST(req: NextRequest) {
  try {
    const studentCtx = await getAuthenticatedStudent(req);
    if (!studentCtx) {
      return NextResponse.json({ error: 'غير مصرح - رمز الجلسة غير صالح' }, { status: 401 });
    }

    const { session, activity } = studentCtx;

    if (session.status === 'submitted') {
      return NextResponse.json({
        success: true,
        message: 'تم إرسال هذا الحوار إلى الأستاذ مسبقاً',
        sessionId: session.id,
      });
    }

    const body = await req.json();
    const parsed = StudentReflectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'بيانات التأمل غير مكتملة', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // 1. Update session to submitted & lock it
    const updatedSession = await storage.updateSessionReflection(session.id, parsed.data);
    if (!updatedSession) {
      return NextResponse.json({ error: 'تعذر تحديث الجلسة' }, { status: 500 });
    }

    // 2. Trigger formative evaluation for teacher review in the background
    const transcript = await storage.getMessages(session.id);
    try {
      const evaluation = await evaluationEngine.evaluateSession({
        activity,
        session: updatedSession,
        transcript,
      });
      await storage.saveEvaluation(evaluation);
    } catch (evalErr) {
      console.error('Background evaluation generation error:', evalErr);
    }

    // 3. Return only success confirmation — NEVER expose evaluation data or scores to the student
    return NextResponse.json({
      success: true,
      message: 'تم إرسال الحوار والتأمل إلى الأستاذ بنجاح',
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Error submitting student reflection:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إرسال التأمل' }, { status: 500 });
  }
}
