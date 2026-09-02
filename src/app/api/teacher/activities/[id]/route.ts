import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedTeacher } from '@/lib/auth/teacher-auth';
import { storage } from '@/lib/db/storage';
import { validateActivityActivation } from '@/lib/validation/activity';
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
      return NextResponse.json(
        { error: 'حالة النشاط غير صالحة', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // If changing to or maintaining active status, enforce server-side activation gate
    if (parsed.data.status === 'active') {
      const sources = await storage.getSources(id);
      const combined = { ...activity, status: 'active', ...(body || {}) };
      const activationCheck = validateActivityActivation(combined, body.sources || sources);

      if (!activationCheck.valid) {
        return NextResponse.json(
          {
            error: 'ACTIVATION_VALIDATION_FAILED',
            message: 'لا يمكن تفعيل هذا النشاط قبل استيفاء جميع شروط الجاهزية والتفعيل.',
            details: activationCheck.errors,
          },
          { status: 400 }
        );
      }
    }

    const updated = await storage.updateActivityStatus(id, parsed.data.status);
    return NextResponse.json({ activity: updated });
  } catch (error) {
    console.error('Error updating activity status:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث حالة النشاط' }, { status: 500 });
  }
}
