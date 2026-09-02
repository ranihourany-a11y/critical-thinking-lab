import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedTeacher } from '@/lib/auth/teacher-auth';
import { storage } from '@/lib/db/storage';
import { TeacherApprovalSchema } from '@/lib/validation/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const teacher = await getAuthenticatedTeacher(req.cookies);
    if (!teacher) {
      return NextResponse.json({ error: 'غير مصرح للمعلم' }, { status: 401 });
    }

    const session = await storage.getSessionById(id);
    if (!session) {
      return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 });
    }

    const activity = await storage.getActivity(session.activity_id);
    if (!activity || activity.teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'غير مصرح بالوصول لبيانات هذه الجلسة' }, { status: 403 });
    }

    const messages = await storage.getMessages(id);
    const evaluation = await storage.getEvaluation(id);

    // Sanitize session to ensure student token hashes are never exposed to clients
    const { session_token_hash, ...safeSession } = session;

    return NextResponse.json({
      session: safeSession,
      activity: {
        id: activity.id,
        title: activity.title,
        topic: activity.topic,
        grade_level: activity.grade_level,
        rubric_config: activity.rubric_config,
      },
      messages,
      evaluation,
    });
  } catch (error) {
    console.error('Error fetching teacher session inspection:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب بيانات الجلسة' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const teacher = await getAuthenticatedTeacher(req.cookies);
    if (!teacher) {
      return NextResponse.json({ error: 'غير مصرح للمعلم' }, { status: 401 });
    }

    const session = await storage.getSessionById(id);
    if (!session) {
      return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 });
    }

    const activity = await storage.getActivity(session.activity_id);
    if (!activity || activity.teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'غير مصرح بتعديل هذه الجلسة' }, { status: 403 });
    }

    // 1. Revalidate that session is completed
    if (session.status !== 'submitted' && session.status !== 'locked') {
      return NextResponse.json(
        {
          error: 'SESSION_INCOMPLETE',
          message: 'لا يمكن اعتماد التقييم لجلسة غير مكتملة.',
        },
        { status: 400 }
      );
    }

    // 2. Require an existing evaluation
    const existingEvaluation = await storage.getEvaluation(id);
    if (!existingEvaluation) {
      return NextResponse.json(
        {
          error: 'EVALUATION_NOT_FOUND',
          message: 'لا يوجد تقرير تقييم لهذه الجلسة لاعتماده.',
        },
        { status: 404 }
      );
    }

    // 3. Parse and validate payload strictly
    const body = await req.json();
    const parsed = TeacherApprovalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'INVALID_APPROVAL_DATA',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 4. Idempotency: if state is already identical, return current record without side effects
    if (
      existingEvaluation.teacher_approved === parsed.data.teacher_approved &&
      (parsed.data.suggested_feedback === undefined ||
        existingEvaluation.suggested_feedback === parsed.data.suggested_feedback)
    ) {
      return NextResponse.json({
        evaluation: existingEvaluation,
        replayed: true,
      });
    }

    // 5. Update approval state atomically without touching scores or invoking AI
    const updated = await storage.updateEvaluationApproval(
      id,
      parsed.data.teacher_approved,
      parsed.data.suggested_feedback
    );

    return NextResponse.json({ evaluation: updated });
  } catch (error) {
    console.error('Error updating evaluation approval:', error);
    return NextResponse.json(
      {
        error: 'FAILED_TO_UPDATE_APPROVAL',
        retryable: true,
        message: 'تعذر تحديث حالة اعتماد التقييم. يرجى المحاولة مرة أخرى.',
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const teacher = await getAuthenticatedTeacher(req.cookies);
    if (!teacher) {
      return NextResponse.json({ error: 'غير مصرح للمعلم' }, { status: 401 });
    }

    const session = await storage.getSessionById(id);
    if (!session) {
      return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 });
    }

    const activity = await storage.getActivity(session.activity_id);
    if (!activity || activity.teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'غير مصرح بالوصول لبيانات هذه الجلسة' }, { status: 403 });
    }

    // 1. Revalidate that session is completed
    if (session.status !== 'submitted' && session.status !== 'locked') {
      return NextResponse.json(
        {
          error: 'SESSION_INCOMPLETE',
          message: 'لا يمكن إنشاء التقييم إلا بعد إكمال الطالب للجلسة وإرسال التأمل الختامي.',
        },
        { status: 400 }
      );
    }

    // 2. Reuse existing evaluation without invoking AI provider again (Idempotency)
    const existingEvaluation = await storage.getEvaluation(id);
    if (existingEvaluation) {
      return NextResponse.json({
        evaluation: existingEvaluation,
        replayed: true,
      });
    }

    // 3. Revalidate persisted transcript presence
    const transcript = await storage.getMessages(id);
    if (transcript.length === 0) {
      return NextResponse.json(
        {
          error: 'NO_TRANSCRIPT',
          message: 'لا يوجد سجل حوار مسجل لهذه الجلسة لتقييمه.',
        },
        { status: 400 }
      );
    }

    // 4. Generate evaluation strictly from server-persisted records
    const { evaluationEngine } = await import('@/lib/ai/evaluation-engine');
    const evaluation = await evaluationEngine.evaluateSession({
      activity,
      session,
      transcript,
    });

    // Enforce default teacher_approved to false for newly generated evaluation
    evaluation.teacher_approved = false;
    await storage.saveEvaluation(evaluation);

    return NextResponse.json({ evaluation });
  } catch (error) {
    console.error('Error generating evaluation on-demand:', error);
    return NextResponse.json(
      {
        error: 'FAILED_TO_GENERATE_EVALUATION',
        retryable: true,
        message: 'تعذر إنشاء التقييم التحليلي في الوقت الحالي. يرجى المحاولة مرة أخرى.',
      },
      { status: 500 }
    );
  }
}
