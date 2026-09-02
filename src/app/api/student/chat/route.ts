import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStudent } from '@/lib/auth/get-student';
import { StudentChatTurnSchema } from '@/lib/validation/session';
import { storage } from '@/lib/db/storage';
import { dialogueEngine } from '@/lib/ai/dialogue-engine';

export async function POST(req: NextRequest) {
  try {
    const studentCtx = await getAuthenticatedStudent(req);
    if (!studentCtx) {
      return NextResponse.json({ error: 'غير مصرح - رمز الجلسة غير صالح' }, { status: 401 });
    }

    const { session, activity } = studentCtx;

    if (session.status !== 'active') {
      return NextResponse.json(
        { error: 'هذه الجلسة مقفلة أو تم إرسالها مسبقاً' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = StudentChatTurnSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'بيانات غير صالحة', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { client_message_id, content, message_kind } = parsed.data;

    const existingMessages = await storage.getMessages(session.id);
    const studentTurnsCount = existingMessages.filter((m) => m.sender === 'student').length;

    if (studentTurnsCount >= activity.max_turns) {
      return NextResponse.json(
        {
          error: 'تم الوصول إلى الحد الأقصى من جولات الحوار لهذا النشاط. يرجى الانتقال إلى نموذج التأمل الختامي.',
          shouldReflect: true,
        },
        { status: 400 }
      );
    }

    // 1. Idempotency check: has this client_message_id already been processed?
    const alreadySaved = existingMessages.find((m) => m.client_message_id === client_message_id);
    if (alreadySaved) {
      // Find if there is an expert message after it
      const nextExpertMsg = existingMessages.find(
        (m) => m.sender === 'expert' && m.sequence_number === alreadySaved.sequence_number + 1
      );
      if (nextExpertMsg) {
        return NextResponse.json({
          reply: nextExpertMsg.content,
          stage: nextExpertMsg.stage,
          messageKind: nextExpertMsg.message_kind,
          studentMessageSaved: true,
          replayed: true,
        });
      }
    }

    // 2. Pre-save student message
    const studentSeq = existingMessages.length + 1;
    const studentMessage = await storage.saveMessage(session.id, {
      client_message_id,
      sequence_number: studentSeq,
      sender: 'student',
      content,
      stage: session.current_stage,
      message_kind,
      status: 'completed',
    });

    const sources = await storage.getSources(activity.id);

    // 3. Invoke Socratic Dialogue Engine
    try {
      const decision = await dialogueEngine.processTurn({
        activity,
        sources,
        session,
        history: existingMessages,
        studentMessage: content,
        messageKind: message_kind,
      });

      // 4. Save Expert Response
      const expertSeq = studentSeq + 1;
      const expertMessage = await storage.saveMessage(session.id, {
        client_message_id: `expert-${client_message_id}`,
        sequence_number: expertSeq,
        sender: 'expert',
        content: decision.reply,
        stage: decision.next_stage,
        message_kind: decision.question_type === 'hint' ? 'hint' : 'normal',
        status: 'completed',
      });

      // 5. Update session stage and hint count
      const isHint = message_kind === 'hint';
      await storage.updateSessionStage(session.id, decision.next_stage, isHint);

      return NextResponse.json({
        reply: decision.reply,
        stage: decision.next_stage,
        questionType: decision.question_type,
        usedSourceIds: decision.used_source_ids,
        studentMessageSaved: true,
        expertMessageId: expertMessage.id,
      });
    } catch (aiError) {
      console.error('AI provider generation failed during chat turn:', aiError);
      // Student message is safely stored. Return recoverable state.
      return NextResponse.json(
        {
          error: 'AI_PROVIDER_TEMPORARY_ERROR',
          recoverable: true,
          message: 'تم حفظ رسالتك بنجاح في سجل الحوار، ولكن تعذر وصول رد المرشد مؤقتاً. يمكنك إعادة المحاولة بأمان.',
          studentMessageSaved: true,
          clientMessageId: client_message_id,
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Error during student chat turn:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم أثناء معالجة الحوار' }, { status: 500 });
  }
}
