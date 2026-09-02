'use client';

import React, { useEffect, useRef } from 'react';
import { Message } from '@/lib/db/schema';
import { Button } from '../shared/Button';
import { Badge } from '../shared/Badge';
import { clsx } from 'clsx';

export interface ChatFeedProps {
  messages: Message[];
  isLoading: boolean;
  isRetrying?: boolean;
  onRetry?: (clientMessageId: string) => void;
  failedClientMsgId?: string | null;
}

export function ChatFeed({
  messages,
  isLoading,
  isRetrying = false,
  onRetry,
  failedClientMsgId,
}: ChatFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isRetrying]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-brand-slate-50 min-h-[350px]">
      {messages.length === 0 && (
        <div className="text-center py-12 px-4 max-w-md mx-auto">
          <div className="w-12 h-12 bg-brand-teal-50 text-brand-teal rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">
            💬
          </div>
          <h3 className="text-base font-bold text-brand-navy mb-1">مرحباً بك في ساحة الحوار</h3>
          <p className="text-sm text-brand-slate-500">
            سيبدأ المرشد السقراطي بطرح سؤال فاحص لاستكشاف مبررات موقفك. اكتب ردك بحرية واستند إلى
            المصادر المعتمدة!
          </p>
        </div>
      )}

      {messages.map((msg, index) => {
        const isStudent = msg.sender === 'student';
        const isFailed = msg.status === 'failed' || (isStudent && failedClientMsgId === msg.client_message_id);

        return (
          <div
            key={msg.id || msg.client_message_id || index}
            className={clsx('flex flex-col', isStudent ? 'items-start' : 'items-end')}
          >
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-xs font-bold text-brand-slate-600">
                {isStudent ? 'أنت (الطالب)' : 'الخبير السقراطي 🏛️'}
              </span>
              {msg.message_kind === 'hint' && (
                <Badge variant="amber" size="sm">
                  تلميح مرشد
                </Badge>
              )}
              {msg.message_kind === 'clarification' && (
                <Badge variant="slate" size="sm">
                  توضيح
                </Badge>
              )}
            </div>

            <div
              className={clsx(
                'max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl leading-relaxed text-base transition-all',
                isStudent
                  ? 'bg-brand-navy text-white rounded-tr-xs shadow-sm'
                  : 'bg-white text-brand-navy border-2 border-brand-teal-100 rounded-tl-xs shadow-sm'
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              <div
                className={clsx(
                  'flex items-center justify-between gap-4 mt-2 pt-2 text-[11px] border-t',
                  isStudent ? 'border-brand-navy-700 text-brand-navy-200' : 'border-brand-slate-100 text-brand-slate-400'
                )}
              >
                <span>
                  {new Date(msg.created_at || Date.now()).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {isStudent && (
                  <span className="text-emerald-300 font-semibold">✓ تم حفظ إجابتك</span>
                )}
              </div>
            </div>

            {isFailed && onRetry && (
              <div
                className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-amber-900 shadow-xs"
                role="alert"
              >
                <div className="flex items-center gap-2">
                  <span className="text-emerald-700 font-bold">✓ تم حفظ إجابتك.</span>
                  <span className="text-amber-800">تعذر وصول رد الخبير.</span>
                </div>
                <Button
                  size="sm"
                  variant="amber"
                  onClick={() => onRetry(msg.client_message_id)}
                  isLoading={isRetrying}
                  disabled={isRetrying || isLoading}
                  className="text-xs py-1 px-3 min-h-[36px] font-bold"
                >
                  إعادة محاولة الرد 🔄
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-xs font-bold text-brand-slate-600">المرشد السقراطي</span>
            <Badge variant="teal" size="sm">
              يفكر في سؤالك...
            </Badge>
          </div>
          <div className="bg-white border-2 border-brand-teal-100 p-4 rounded-2xl rounded-tl-xs shadow-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-teal animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 rounded-full bg-brand-teal animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 rounded-full bg-brand-teal animate-bounce"></div>
            <span className="text-xs text-brand-slate-500 mr-2 font-medium">
              جاري فحص المصادر وصياغة التحدي السقراطي...
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
