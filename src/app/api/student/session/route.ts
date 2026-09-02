import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStudent } from '@/lib/auth/get-student';
import { StudentPrepareSchema } from '@/lib/validation/session';
import { storage } from '@/lib/db/storage';

export async function GET(req: NextRequest) {
  try {
    const studentCtx = await getAuthenticatedStudent(req);
    if (!studentCtx) {
      return NextResponse.json({ error: 'غير مصرح - رمز الجلسة غير صالح' }, { status: 401 });
    }

    const { session, activity } = studentCtx;
    const messages = await storage.getMessages(session.id);
    const sources = await storage.getSources(activity.id);

    // Sanitize output for student: NO evaluation data, NO rubric scores, NO prompts
    return NextResponse.json({
      session: {
        id: session.id,
        student_alias: session.student_alias,
        current_stage: session.current_stage,
        hint_count: session.hint_count,
        status: session.status,
        initial_stance: session.initial_stance,
        initial_confidence: session.initial_confidence,
      },
      activity: {
        id: activity.id,
        title: activity.title,
        topic: activity.topic,
        grade_level: activity.grade_level,
        max_turns: activity.max_turns,
        ai_stance: activity.ai_stance,
        sources: sources.map((s) => ({
          id: s.id,
          title: s.title,
          citation_label: s.citation_label,
          source_snapshot: s.source_snapshot,
        })),
      },
      messages: messages.map((m) => ({
        id: m.id,
        client_message_id: m.client_message_id,
        sequence_number: m.sequence_number,
        sender: m.sender,
        content: m.content,
        stage: m.stage,
        message_kind: m.message_kind,
        status: m.status,
        created_at: m.created_at,
      })),
    });
  } catch (error) {
    console.error('Error getting student session:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب الجلسة' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const studentCtx = await getAuthenticatedStudent(req);
    if (!studentCtx) {
      return NextResponse.json({ error: 'غير مصرح - رمز الجلسة غير صالح' }, { status: 401 });
    }

    const { session } = studentCtx;
    const body = await req.json();
    const parsed = StudentPrepareSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'بيانات غير صالحة', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = await storage.updateSessionPrepare(session.id, {
      initial_stance: parsed.data.initial_stance,
      initial_reason: parsed.data.initial_reason,
      initial_confidence: parsed.data.initial_confidence,
    });

    return NextResponse.json({
      success: true,
      session: {
        id: updated?.id,
        current_stage: updated?.current_stage,
        initial_stance: updated?.initial_stance,
      },
    });
  } catch (error) {
    console.error('Error updating prepare phase:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم أثناء تحديث الجلسة' }, { status: 500 });
  }
}
