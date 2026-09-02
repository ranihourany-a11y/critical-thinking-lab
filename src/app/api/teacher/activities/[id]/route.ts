import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedTeacher } from '@/lib/auth/teacher-auth';
import { storage } from '@/lib/db/storage';
import { z } from 'zod';

const UpdateStatusSchema = z.object({
  status: z.enum(['draft', 'active', 'closed']),
});

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

    const activity = await storage.getActivity(id);
    if (!activity) {
      return NextResponse.json({ error: 'النشاط غير موجود' }, { status: 404 });
    }

    if (activity.teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'غير مصرح بالوصول لهذا النشاط' }, { status: 403 });
    }

    const sources = await storage.getSources(id);
    const sessions = await storage.getSessionsForActivity(id);

    return NextResponse.json({
      activity: {
        ...activity,
        sources,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        student_alias: s.student_alias,
        current_stage: s.current_stage,
        hint_count: s.hint_count,
        status: s.status,
        initial_confidence: s.initial_confidence,
        final_confidence: s.final_confidence,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching activity details:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب تفاصيل النشاط' }, { status: 500 });
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

    const activity = await storage.getActivity(id);
    if (!activity) {
      return NextResponse.json({ error: 'النشاط غير موجود' }, { status: 404 });
    }

    if (activity.teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'غير مصرح بتعديل هذا النشاط' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = UpdateStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'حالة النشاط غير صالحة' }, { status: 400 });
    }

    const updated = await storage.updateActivityStatus(id, parsed.data.status);
    return NextResponse.json({ activity: updated });
  } catch (error) {
    console.error('Error updating activity status:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث حالة النشاط' }, { status: 500 });
  }
}
