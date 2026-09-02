import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStudent } from '@/lib/auth/get-student';
import { StudentRetrySchema } from '@/lib/validation/session';
import { storage } from '@/lib/db/storage';
import { dialogueEngine } from '@/lib/ai/dialogue-engine';

export async function POST(req: NextRequest) {
  try {
    const studentCtx = await getAuthenticatedStudent(req);
    if (!studentCtx) {
      return NextResponse.json({ error: 'غير مصرح - رمز الجلسة غير صالح' }, { status: 401 });
    }

    const { session, activity } = studentCtx;
    const body = await req.json();
    const parsed = StudentRetrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'بيانات غير صالحة', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { client_message_id } = parsed.data;
    const existingMessages = await storage.getMessages(session.id);
    const targetStudentMsg = existingMessages.find((m) => m.client_message_id === client_message_id);

    if (!targetStudentMsg) {
      return NextResponse.json(
        { error: 'الرسالة المطلوب إعادة محاولتها غير موجودة في السجل' },
        { status: 404 }
      );
    }

    // Check if an expert message already answered it
    const existingExpert = existingMessages.find(
      (m) => m.sender === 'expert' && m.sequence_number === targetStudentMsg.sequence_number + 1
    );

    if (existingExpert) {
      return NextResponse.json({
        reply: existingExpert.content,
        stage: existingExpert.stage,
        replayed: true,
        studentMessageSaved: true,
      });
    }

    // Call dialogue engine again
    const sources = await storage.getSources(activity.id);
    const historyBefore = existingMessages.filter(
      (m) => m.sequence_number < targetStudentMsg.sequence_number
    );

    const decision = await dialogueEngine.processTurn({
      activity,
      sources,
      session,
      history: historyBefore,
      studentMessage: targetStudentMsg.content,
      messageKind: targetStudentMsg.message_kind,
    });

    const expertSeq = targetStudentMsg.sequence_number + 1;
    await storage.saveMessage(session.id, {
      client_message_id: `expert-${client_message_id}`,
      sequence_number: expertSeq,
      sender: 'expert',
      content: decision.reply,
      stage: decision.next_stage,
      message_kind: decision.question_type === 'hint' ? 'hint' : 'normal',
      status: 'completed',
    });

    await storage.updateSessionStage(
      session.id,
      decision.next_stage,
      targetStudentMsg.message_kind === 'hint'
    );

    return NextResponse.json({
      reply: decision.reply,
      stage: decision.next_stage,
      questionType: decision.question_type,
      usedSourceIds: decision.used_source_ids,
      studentMessageSaved: true,
      retried: true,
    });
  } catch (error) {
    console.error('Error during retry turn:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إعادة المحاولة' }, { status: 500 });
  }
}
