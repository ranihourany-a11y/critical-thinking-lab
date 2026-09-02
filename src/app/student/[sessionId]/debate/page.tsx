'use client';

import React, { useEffect, useState } from 'react';
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

  const [inputContent, setInputContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failedClientMsgId, setFailedClientMsgId] = useState<string | null>(null);
  const [showSourcesModal, setShowSourcesModal] = useState(false);

  // Fetch initial session & history
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/student/session');
        if (!res.ok) {
          toast.error('الجلسة غير صالحة أو انتهت');
          router.push('/');
          return;
        }
        const data = await res.json();
        setSession(data.session);
        setActivity(data.activity);
        setMessages(data.messages);
        setCurrentStage(data.session.current_stage || 'baseline');
        setHintCount(data.session.hint_count || 0);

        // If session was already submitted, redirect to submitted page
        if (data.session.status === 'submitted') {
          router.push(`/student/${sessionId}/submitted`);
        }
      } catch (err) {
        console.error('Error fetching debate data:', err);
        toast.error('تعذر جلب بيانات الحوار');
      }
    }
    loadData();
  }, [sessionId, router]);

  // Handle student send turn
  const handleSendTurn = async (contentToSend: string, kind: 'normal' | 'clarification' | 'question' | 'hint' = 'normal') => {
    if (!contentToSend.trim() || isLoading) return;

    const clientMsgId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setFailedClientMsgId(null);

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
        toast.error(data.message || 'تعذر وصول رد المرشد مؤقتاً.');
        setIsLoading(false);
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

      setMessages((prev) => [...prev, expertMsg]);
      setCurrentStage(data.stage);
      if (kind === 'hint') {
        setHintCount((c) => c + 1);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setFailedClientMsgId(clientMsgId);
      toast.error('حدث خطأ في الاتصال. يمكنك إعادة المحاولة.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle retry for failed turn
  const handleRetry = async (clientMessageId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/student/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_message_id: clientMessageId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'تعذر إعادة المحاولة.');
        setIsLoading(false);
        return;
      }

      const expertMsg: Message = {
        id: `expert-retried-${Date.now()}`,
        session_id: sessionId,
        client_message_id: `expert-${clientMessageId}`,
        sequence_number: messages.length + 1,
        sender: 'expert',
        content: data.reply,
        stage: data.stage,
        message_kind: data.questionType === 'hint' ? 'hint' : 'normal',
        status: 'completed',
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, expertMsg]);
      setCurrentStage(data.stage);
      setFailedClientMsgId(null);
      toast.success('تم استلام رد المرشد السقراطي بنجاح!');
    } catch (err) {
      console.error('Retry error:', err);
      toast.error('حدث خطأ أثناء إعادة المحاولة');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper action click
  const handleActionClick = (kind: 'clarification' | 'question' | 'hint') => {
    if (kind === 'hint') {
      handleSendTurn('أحتاج تلميحاً يوجه تفكيري في الأدلة المتاحة.', 'hint');
    } else if (kind === 'clarification') {
      handleSendTurn('هل يمكنك توضيح السؤال السابق بمثال أبسط؟', 'clarification');
    } else if (kind === 'question') {
      setInputContent('أود أن أسأل: ');
    }
  };

  const isReadyForReflection =
    currentStage === 'counter_argument' ||
    currentStage === 'reflection' ||
    messages.filter((m) => m.sender === 'student').length >= (activity?.max_turns || 8);

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
            <Link
              href={`/student/${sessionId}/reflection`}
              className="text-xs font-bold bg-brand-teal text-white hover:bg-brand-teal-700 px-3 py-1.5 rounded-xl transition-colors min-h-[36px] inline-flex items-center"
            >
              التأمل الختامي ➔
            </Link>
          </div>
        }
      />

      {/* Pedagogical Stage Progression Bar */}
      <StageProgressBar currentStage={currentStage} />

      {/* Main Debate Viewport */}
      <main className="flex-1 max-w-4xl w-full mx-auto flex flex-col p-2 sm:p-4">
        {/* Reflection Prompt Banner when student reached end stage */}
        {isReadyForReflection && (
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

        {/* Chat Feed */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-brand-slate-200 shadow-xs overflow-hidden">
          <ChatFeed
            messages={messages}
            isLoading={isLoading}
            onRetry={handleRetry}
            failedClientMsgId={failedClientMsgId}
          />

          {/* Helper Actions & Chat Input Footer */}
          <div className="p-3 sm:p-4 bg-white border-t border-brand-slate-200 space-y-2">
            <ActionButtons
              onAction={handleActionClick}
              hintCount={hintCount}
              disabled={isLoading}
            />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendTurn(inputContent);
              }}
              className="flex items-end gap-2"
            >
              <div className="flex-1 relative">
                <textarea
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendTurn(inputContent);
                    }
                  }}
                  placeholder="اكتب ردك أو دليلك هنا... (اضغط Enter للإرسال)"
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
        </div>
      </main>
    </div>
  );
}
