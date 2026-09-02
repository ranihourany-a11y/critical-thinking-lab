import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStudent } from '@/lib/auth/get-student';
import { StudentChatTurnSchema } from '@/lib/validation/session';
import { storage } from '@/lib/db/storage';
import { dialogueEngine } from '@/lib/ai/dialogue-engine';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate student via opaque session token hash
    const studentCtx = await getAuthenticatedStudent(req);
    if (!studentCtx) {
      return NextResponse.json({ error: 'غير مصرح - رمز الجلسة غير صالح' }, { status: 401 });
    }

    const { session, activity } = studentCtx;

    // 2. Validate active activity and non-completed session
    if (activity.status !== 'active') {
      return NextResponse.json(
        { error: 'هذا النشاط غير متاح حالياً أو تم إغلاقه بواسطة المعلم' },
        { status: 403 }
      );
    }

    if (session.status !== 'active') {
      return NextResponse.json(
        { error: 'هذه الجلسة مقفلة أو تم إرسالها مسبقاً' },
        { status: 403 }
      );
    }

    // 3. Validate student input (trimmed 1 to 2,000 characters)
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
    const studentMessages = existingMessages.filter((m) => m.sender === 'student');
    const studentTurnsCount = studentMessages.length;

    // 4. Cap at maximum 60 student turns per session
    const maxAllowedTurns = Math.min(activity.max_turns || 60, 60);
    if (studentTurnsCount >= maxAllowedTurns) {
      return NextResponse.json(
        {
          error: 'تم الوصول إلى الحد الأقصى من جولات الحوار لهذا النشاط. يرجى الانتقال إلى نموذج التأمل الختامي.',
          shouldReflect: true,
        },
        { status: 400 }
      );
    }

    // 5. Idempotency Check: if client_message_id already exists, return replayed response
    const alreadySaved = existingMessages.find((m) => m.client_message_id === client_message_id);
    if (alreadySaved) {
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

    // 6. Cooldown Check: At least 1.5s (1500ms) since previous accepted student message
    if (!alreadySaved && studentMessages.length > 0) {
      const latestStudentMsg = [...studentMessages].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      if (latestStudentMsg) {
        const lastTime = new Date(latestStudentMsg.created_at).getTime();
        const now = Date.now();
        const elapsed = now - lastTime;

        if (elapsed < 1500) {
          const retryAfterSeconds = Math.max(1, Math.ceil((1500 - elapsed) / 1000));
          return NextResponse.json(
            {
              error: 'RATE_LIMIT_COOLDOWN',
              message: 'يرجى التمهل قليلاً قبل إرسال الرسالة التالية (فترة انتظار قصيرة).',
            },
            {
              status: 429,
              headers: {
                'Retry-After': String(retryAfterSeconds),
              },
            }
          );
        }
      }
    }

    // 7. Insert the student message and await successful persistence
    let studentMessage;
    if (alreadySaved) {
      studentMessage = alreadySaved;
    } else {
      try {
        const studentSeq = existingMessages.length + 1;
        studentMessage = await storage.saveMessage(session.id, {
          client_message_id,
          sequence_number: studentSeq,
          sender: 'student',
          content,
          stage: session.current_stage,
          message_kind,
          status: 'completed',
        });
      } catch (dbError) {
        console.error('Failed to persist student message before AI call:', dbError);
        return NextResponse.json(
          {
            error: 'FAILED_TO_SAVE_STUDENT_MESSAGE',
            retryable: true,
            message: 'تعذر حفظ رسالتك في سجل الحوار. يرجى المحاولة مرة أخرى.',
          },
          { status: 500 }
        );
      }
    }

    // 8. Only after student insert succeeds, invoke the dialogue AI provider
    const sources = await storage.getSources(activity.id);
    let decision;
    try {
      decision = await dialogueEngine.processTurn({
        activity,
        sources,
        session: session.current_stage === 'baseline' ? { ...session, current_stage: 'understanding' } : session,
        history: existingMessages,
        studentMessage: content,
        messageKind: message_kind,
      });
    } catch (aiError) {
      console.error('AI provider generation failed during chat turn:', aiError);
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

    // 9. Persist the completed expert response
    try {
      const expertSeq = studentMessage.sequence_number + 1;
      const expertMessage = await storage.saveMessage(session.id, {
        client_message_id: `expert-${client_message_id}`,
        sequence_number: expertSeq,
        sender: 'expert',
        content: decision.reply,
        stage: decision.next_stage,
        message_kind: decision.question_type === 'hint' ? 'hint' : 'normal',
        status: 'completed',
      });

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
    } catch (expertDbError) {
      console.error('Failed to persist expert response:', expertDbError);
      return NextResponse.json(
        {
          error: 'FAILED_TO_SAVE_EXPERT_MESSAGE',
          recoverable: true,
          message: 'تم توليد الرد ولكن تعذر حفظه في السجل. يرجى إعادة المحاولة.',
          studentMessageSaved: true,
          clientMessageId: client_message_id,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error during student chat turn:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم أثناء معالجة الحوار' }, { status: 500 });
  }
}
