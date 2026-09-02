'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/shared/Header';
import { StageProgressBar } from '@/components/student/StageProgressBar';
import { ChatFeed } from '@/components/student/ChatFeed';
import { ActionButtons } from '@/components/student/ActionButtons';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { Message, PedagogicalStage } from '@/lib/db/schema';
import { toast } from 'sonner';

export default function StudentDebatePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStage, setCurrentStage] = useState<PedagogicalStage>('baseline');
  const [hintCount, setHintCount] = useState(0);

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ type: 'auth' | 'network'; message: string } | null>(null);

  const [inputContent, setInputContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [failedClientMsgId, setFailedClientMsgId] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [showSourcesModal, setShowSourcesModal] = useState(false);

  // Authoritative session restoration loader (zero inserts, zero AI calls)
  const loadAuthoritativeSession = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch('/api/student/session');

      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          setLoadError({
            type: 'auth',
            message: 'تعذر استعادة الجلسة. يرجى التحقق من الرابط أو الانضمام من جديد.',
          });
          return;
        }
        throw new Error('Server error');
      }

      const data = await res.json();

      // Verify session ID matches route
      if (data.session.id !== sessionId) {
        setLoadError({
          type: 'auth',
          message: 'تعذر استعادة الجلسة. يرجى التحقق من الرابط أو الانضمام من جديد.',
        });
        return;
      }

      // Reconcile and deduplicate messages
      const fetchedMessages: Message[] = data.messages || [];
      const deduplicated: Message[] = [];
      const seenKeys = new Set<string>();

      for (const msg of fetchedMessages) {
        const key = msg.id || msg.client_message_id;
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key);
          deduplicated.push(msg);
        }
      }

      // Sort chronologically by sequence_number or created_at
      deduplicated.sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0));

      setSession(data.session);
      setActivity(data.activity);
      setMessages(deduplicated);
      setCurrentStage(data.session.current_stage || 'baseline');
      setHintCount(data.session.hint_count || 0);

      // Check for pending / recoverable student message awaiting expert response
      if (deduplicated.length > 0) {
        const lastMsg = deduplicated[deduplicated.length - 1];
        if (lastMsg.sender === 'student') {
          // Last message was student, meaning expert response failed or was interrupted
          const recoverClientMsgId = lastMsg.client_message_id || lastMsg.id;
          setFailedClientMsgId(recoverClientMsgId);
          setLiveAnnouncement('تم استعادة الجلسة بنجاح. إجابتك محفوظة بانتظار استلام رد الخبير.');
        } else {
          setFailedClientMsgId(null);
          setLiveAnnouncement('تم استعادة جلسة الحوار السقراطي بنجاح.');
        }
      }
    } catch (err) {
      console.error('Error restoring student session:', err);
      setLoadError({
        type: 'network',
        message: 'تعذر استعادة الجلسة',
      });
    } finally {
      setIsInitialLoading(false);
    }
  }, [sessionId]);

  // Initial load on mount
  useEffect(() => {
    loadAuthoritativeSession();
  }, [loadAuthoritativeSession]);

  // Handle student send turn
  const handleSendTurn = async (contentToSend: string, kind: 'normal' | 'clarification' | 'question' | 'hint' = 'normal') => {
    if (!contentToSend.trim() || isLoading || isRetrying) return;

    const clientMsgId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setFailedClientMsgId(null);
    setLiveAnnouncement('جاري إرسال إجابتك واستشارة الخبير السقراطي...');

    // Optimistic local student message
    const optimisticStudentMsg: Message = {
      id: `opt-${clientMsgId}`,
      session_id: sessionId,
      client_message_id: clientMsgId,
      sequence_number: messages.length + 1,
      sender: 'student',
      content: contentToSend.trim(),
      stage: currentStage,
      message_kind: kind,
      status: 'completed',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticStudentMsg]);
    setInputContent('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/student/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_message_id: clientMsgId,
          content: contentToSend.trim(),
          message_kind: kind,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.shouldReflect) {
          toast.info(data.error);
          router.push(`/student/${sessionId}/reflection`);
          return;
        }

        // Recoverable state: student message is saved in DB, but AI failed
        setFailedClientMsgId(clientMsgId);
        setLiveAnnouncement('تم حفظ إجابتك بنجاح ولكن تعذر وصول رد الخبير. يمكنك استخدام زر إعادة المحاولة.');
        toast.error(data.message || 'تعذر وصول رد الخبير مؤقتاً.');
        return;
      }

      // Successful expert response
      const expertMsg: Message = {
        id: data.expertMessageId || `expert-${Date.now()}`,
        session_id: sessionId,
        client_message_id: `expert-${clientMsgId}`,
        sequence_number: messages.length + 2,
        sender: 'expert',
        content: data.reply,
        stage: data.stage,
        message_kind: data.questionType === 'hint' ? 'hint' : 'normal',
        status: 'completed',
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => {
        // Prevent duplicate insertions
        if (prev.some((m) => m.client_message_id === expertMsg.client_message_id)) {
          return prev;
        }
        return [...prev, expertMsg];
      });

      setCurrentStage(data.stage);
      setFailedClientMsgId(null);
      setLiveAnnouncement('تم استلام رد الخبير السقراطي بنجاح.');
      if (kind === 'hint') {
        setHintCount((c) => c + 1);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setFailedClientMsgId(clientMsgId);
      setLiveAnnouncement('حدث خطأ في الاتصال. يمكنك إعادة المحاولة.');
      toast.error('حدث خطأ في الاتصال. يمكنك إعادة المحاولة.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle retry for failed turn using the exact same client_message_id and content
  const handleRetry = async (clientMessageId: string) => {
    if (isRetrying || isLoading) return;

    const targetMsg = messages.find(
      (m) => m.client_message_id === clientMessageId || m.id === clientMessageId
    );
    if (!targetMsg) return;

    setIsRetrying(true);
    setLiveAnnouncement('جاري إعادة محاولة استلام رد الخبير السقراطي...');

    try {
      const res = await fetch('/api/student/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_message_id: targetMsg.client_message_id || targetMsg.id,
          content: targetMsg.content,
          message_kind: targetMsg.message_kind,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLiveAnnouncement('تعذر وصول رد الخبير. يرجى المحاولة مرة أخرى.');
        toast.error(data.message || 'تعذر وصول رد الخبير مؤقتاً.');
        return;
      }

      const expertMsg: Message = {
        id: data.expertMessageId || `expert-${Date.now()}`,
        session_id: sessionId,
        client_message_id: `expert-${targetMsg.client_message_id || targetMsg.id}`,
        sequence_number: targetMsg.sequence_number + 1,
        sender: 'expert',
        content: data.reply,
        stage: data.stage,
        message_kind: data.questionType === 'hint' ? 'hint' : 'normal',
        status: 'completed',
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => {
        // Prevent duplicate insertions
        if (prev.some((m) => m.client_message_id === expertMsg.client_message_id)) {
          return prev;
        }
        return [...prev, expertMsg];
      });

      setCurrentStage(data.stage);
      setFailedClientMsgId(null);
      setLiveAnnouncement('تم استلام رد الخبير السقراطي بنجاح.');
      toast.success('تم استلام رد الخبير السقراطي بنجاح!');
    } catch (err) {
      console.error('Retry error:', err);
      setLiveAnnouncement('حدث خطأ أثناء إعادة المحاولة');
      toast.error('حدث خطأ أثناء إعادة المحاولة');
    } finally {
      setIsRetrying(false);
    }
  };

  const [composerKind, setComposerKind] = useState<'normal' | 'question'>('normal');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Helper action click
  const handleActionClick = (kind: 'clarification' | 'question' | 'hint') => {
    if (kind === 'hint') {
      if (hintCount >= 3) {
        toast.info('تم استنفاد جميع التلميحات المتاحة (3 من 3).');
        return;
      }
      handleSendTurn('أحتاج تلميحاً يوجه تفكيري في الأدلة المتاحة.', 'hint');
    } else if (kind === 'clarification') {
      const lastExpert = [...messages].reverse().find((m) => m.sender === 'expert');
      const clarificationText = lastExpert
        ? `هل يمكنك توضيح السؤال السابق ("${lastExpert.content.substring(0, 70)}...") بمثال أبسط؟`
        : 'هل يمكنك توضيح السؤال السابق بمثال أبسط؟';
      handleSendTurn(clarificationText, 'clarification');
    } else if (kind === 'question') {
      setComposerKind('question');
      setLiveAnnouncement('تم تفعيل وضع طرح السؤال. اكتب سؤالك ثم اضغط إرسال.');
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  const isCompleted =
    session?.status === 'submitted' || session?.status === 'completed' || session?.status === 'locked';

  const isInReflection = currentStage === 'reflection' || currentStage === 'submitted';

  const isReadyForReflection =
    isInReflection ||
    currentStage === 'counter_argument' ||
    messages.filter((m) => m.sender === 'student').length >= (activity?.max_turns || 8);

  // Initial loading state
  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-slate-50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-brand-teal border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-brand-navy">جاري استعادة جلسة الحوار...</p>
        </div>
      </div>
    );
  }

  // Auth or recovery error state
  if (loadError?.type === 'auth') {
    return (
      <div className="min-h-screen flex flex-col bg-brand-slate-50">
        <Header role="student" />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="p-8 bg-white border border-brand-slate-200 rounded-2xl shadow-sm text-center max-w-md space-y-4">
            <div className="text-3xl">🔒</div>
            <h3 className="font-bold text-lg text-brand-navy">تعذر استعادة الجلسة</h3>
            <p className="text-sm text-brand-slate-600 leading-relaxed">{loadError.message}</p>
            <Link
              href="/"
              className="inline-flex items-center justify-center font-bold text-sm bg-brand-teal text-white hover:bg-brand-teal-700 px-5 py-2.5 rounded-xl transition-colors min-h-[44px]"
            >
              الانضمام لجلسة جديدة
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-slate-50">
      <Header
        role="student"
        title={activity?.title || 'مختبر التفكير الناقد'}
        subtitle={`الطالب: ${session?.student_alias || ''}`}
        rightElement={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSourcesModal(!showSourcesModal)}
              className="text-xs bg-white min-h-[36px]"
            >
              📖 المصادر المعتمدة ({activity?.sources?.length || 0})
            </Button>
            {!isCompleted && (
              <Link
                href={`/student/${sessionId}/reflection`}
                className="text-xs font-bold bg-brand-teal text-white hover:bg-brand-teal-700 px-3 py-1.5 rounded-xl transition-colors min-h-[36px] inline-flex items-center"
              >
                التأمل الختامي ➔
              </Link>
            )}
          </div>
        }
      />

      {/* Pedagogical Stage Progression Bar */}
      <StageProgressBar currentStage={currentStage} />

      {/* Main Debate Viewport */}
      <main className="flex-1 max-w-4xl w-full mx-auto flex flex-col p-2 sm:p-4">
        {/* Temporary Network Error Notice with Retry */}
        {loadError?.type === 'network' && (
          <div
            role="alert"
            className="mb-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900 shadow-xs"
          >
            <span className="font-bold">⚠️ {loadError.message}. يتم عرض البيانات المتوفرة محلياً.</span>
            <Button
              type="button"
              variant="amber"
              size="sm"
              onClick={loadAuthoritativeSession}
              className="text-xs font-bold min-h-[36px]"
            >
              إعادة المحاولة 🔄
            </Button>
          </div>
        )}

        {/* Locked Completed State Banner */}
        {isCompleted && (
          <div className="mb-4 p-5 bg-emerald-50 border border-emerald-300 rounded-2xl text-center space-y-2 shadow-xs">
            <div className="text-2xl">✅</div>
            <h3 className="font-bold text-base text-emerald-900">تم إرسال الحوار إلى الأستاذ</h3>
            <p className="text-xs text-emerald-800 max-w-md mx-auto">
              لقد أكملت جميع مراحل الحوار والتأمل وتم إرسال سجل إجاباتك لمعلمك بنجاح. الجلسة مكتملة ومغلقة للتعديل.
            </p>
          </div>
        )}

        {/* Reflection Continuation Banner */}
        {!isCompleted && isReadyForReflection && (
          <div className="mb-3 p-3.5 bg-brand-amber-50 border border-brand-amber-300 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌟</span>
              <div>
                <span className="text-xs font-bold text-brand-amber-900 block">
                  أحسنت! لقد استكملت مراحل المناظرة السقراطية بنجاح
                </span>
                <span className="text-[11px] text-brand-amber-800">
                  يمكنك الآن الانتقال لنموذج التأمل الختامي لتسجيل موقفك النهائي ومشاركته مع المعلم.
                </span>
              </div>
            </div>
            <Link
              href={`/student/${sessionId}/reflection`}
              className="font-bold text-xs bg-brand-amber text-white hover:bg-brand-amber-700 px-4 py-2 rounded-xl transition-colors shrink-0 shadow-sm min-h-[40px] inline-flex items-center"
            >
              ابدأ التأمل النهائي ←
            </Link>
          </div>
        )}

        {/* Sources Drawer Overlay Modal */}
        {showSourcesModal && activity?.sources && (
          <div className="mb-4 p-4 bg-white border-2 border-brand-teal-200 rounded-2xl shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-brand-navy flex items-center gap-2">
                <span>📚 المصادر العلمية المعتمدة للنشاط</span>
                <Badge variant="teal" size="sm">
                  موثقة ومعتمدة
                </Badge>
              </h3>
              <button
                type="button"
                onClick={() => setShowSourcesModal(false)}
                className="text-xs font-bold text-brand-slate-500 hover:text-brand-navy cursor-pointer px-2 py-1"
              >
                ✕ إغلاق
              </button>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {activity.sources.map((s: any) => (
                <div
                  key={s.id}
                  className="p-3 bg-brand-slate-50 border border-brand-slate-200 rounded-xl text-xs space-y-1"
                >
                  <div className="font-bold text-brand-teal-900">
                    {s.citation_label} - {s.title}
                  </div>
                  <p className="text-brand-slate-700 leading-relaxed whitespace-pre-wrap">
                    {s.source_snapshot}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accessible live status announcement region */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {liveAnnouncement}
        </div>

        {/* Chat Feed */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-brand-slate-200 shadow-xs overflow-hidden">
          <ChatFeed
            messages={messages}
            isLoading={isLoading}
            isRetrying={isRetrying}
            onRetry={handleRetry}
            failedClientMsgId={failedClientMsgId}
          />

          {/* Helper Actions & Chat Input Footer (disabled if completed or in reflection) */}
          {!isCompleted && !isInReflection && (
            <div className="p-3 sm:p-4 bg-white border-t border-brand-slate-200 space-y-2">
              <ActionButtons
                onAction={handleActionClick}
                hintCount={hintCount}
                disabled={isLoading || isRetrying}
              />

              {composerKind === 'question' && (
                <div className="flex items-center justify-between bg-brand-slate-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-navy">
                  <span>❓ وضع طرح سؤال على المرشد السقراطي</span>
                  <button
                    type="button"
                    onClick={() => {
                      setComposerKind('normal');
                      setLiveAnnouncement('تم العودة لوضع الإجابة الطبيعي.');
                    }}
                    className="text-brand-slate-500 hover:text-brand-navy text-[11px] cursor-pointer"
                  >
                    ✕ إلغاء
                  </button>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!inputContent.trim()) return;
                  handleSendTurn(inputContent, composerKind);
                  setComposerKind('normal');
                }}
                className="flex items-end gap-2"
              >
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={inputContent}
                    onChange={(e) => setInputContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!inputContent.trim()) return;
                        handleSendTurn(inputContent, composerKind);
                        setComposerKind('normal');
                      }
                    }}
                    placeholder={
                      composerKind === 'question'
                        ? 'اطرح سؤالك أو استفسارك هنا على المرشد السقراطي... (اضغط Enter للإرسال)'
                        : 'اكتب ردك أو دليلك هنا... (اضغط Enter للإرسال)'
                    }
                    rows={2}
                    maxLength={1000}
                    disabled={isLoading}
                    className="w-full px-4 py-2.5 rounded-xl border border-brand-slate-300 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal text-base leading-relaxed resize-none bg-white text-brand-navy min-h-[52px]"
                  />
                  <span className="absolute bottom-1.5 left-2 text-[10px] text-brand-slate-400 font-mono">
                    {inputContent.length}/1000
                  </span>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={!inputContent.trim() || isLoading}
                  className="font-bold px-6 min-h-[52px] shadow-sm"
                >
                  إرسال ↵
                </Button>
              </form>
            </div>
          )}

          {/* If In Reflection or Completed, show guidance instead of composer */}
          {isInReflection && !isCompleted && (
            <div className="p-4 bg-brand-slate-50 border-t border-brand-slate-200 text-center space-y-2">
              <p className="text-xs font-semibold text-brand-slate-600">
                لقد انتقلت إلى مرحلة التأمل الختامي. نموذج الحوار مقفل للمتابعة.
              </p>
              <Link
                href={`/student/${sessionId}/reflection`}
                className="inline-flex items-center justify-center text-xs font-bold bg-brand-teal text-white hover:bg-brand-teal-700 px-4 py-2 rounded-xl transition-colors min-h-[36px]"
              >
                متابعة التأمل الختامي ←
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
