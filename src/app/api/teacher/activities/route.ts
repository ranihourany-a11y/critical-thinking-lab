import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedTeacher } from '@/lib/auth/teacher-auth';
import { storage } from '@/lib/db/storage';
import { CreateActivitySchema } from '@/lib/validation/activity';

export async function GET(req: NextRequest) {
  try {
    const teacher = await getAuthenticatedTeacher(req.cookies);
    if (!teacher) {
      return NextResponse.json({ error: 'غير مصرح للمعلم' }, { status: 401 });
    }

    const activities = await storage.getActivities(teacher.id);
    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error fetching teacher activities:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب الأنشطة' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const teacher = await getAuthenticatedTeacher(req.cookies);
    if (!teacher) {
      return NextResponse.json({ error: 'غير مصرح للمعلم' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateActivitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'بيانات النشاط غير صالحة', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const newActivity = await storage.createActivity(teacher.id, parsed.data);
    return NextResponse.json({ activity: newActivity }, { status: 201 });
  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء النشاط' }, { status: 500 });
  }
}
