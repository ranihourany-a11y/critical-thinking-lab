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

    return NextResponse.json({
      session,
      activity: {
        id: activity.id,
        title: activity.title,
        topic: activity.topic,
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

    const body = await req.json();
    const parsed = TeacherApprovalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'بيانات الاعتماد غير صالحة' }, { status: 400 });
    }

    const updated = await storage.updateEvaluationApproval(
      id,
      parsed.data.teacher_approved,
      parsed.data.suggested_feedback
    );

    return NextResponse.json({ evaluation: updated });
  } catch (error) {
    console.error('Error updating evaluation approval:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء اعتماد التقييم' }, { status: 500 });
  }
}
