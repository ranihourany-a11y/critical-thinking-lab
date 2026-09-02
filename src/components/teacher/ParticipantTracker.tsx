'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { Session, PedagogicalStage } from '@/lib/db/schema';

export interface ParticipantSession {
  id: string;
  student_alias: string;
  current_stage: PedagogicalStage;
  status: string;
  hint_count: number;
  created_at: string;
  updated_at: string;
}

interface ParticipantTrackerProps {
  activityId: string;
  activityStatus?: string;
}

const STAGE_LABELS: Record<string, string> = {
  baseline: 'التحضير',
  understanding: 'فحص المفاهيم',
  evidence: 'المطالبة بالأدلة',
  source_check: 'موثوقية المصادر',
  causal_reasoning: 'التحليل السببي',
  counter_argument: 'مواجهة الرأي المخالف',
  reflection: 'التأمل والتركيب',
  submitted: 'تم التسليم',
};

const STATUS_LABELS: Record<string, { label: string; variant: 'teal' | 'success' | 'slate' | 'amber' }> = {
  active: { label: 'نشط', variant: 'teal' },
  submitted: { label: 'مكتمل', variant: 'success' },
  locked: { label: 'مكتمل', variant: 'success' },
  completed: { label: 'مكتمل', variant: 'success' },
  abandoned: { label: 'متوقف', variant: 'slate' },
};

export function ParticipantTracker({ activityId, activityStatus = 'active' }: ParticipantTrackerProps) {
  const [sessions, setSessions] = useState<ParticipantSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const sessionsRef = useRef<ParticipantSession[]>([]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const fetchSessions = useCallback(
    async (isManual = false) => {
      if (isManual) {
        setIsRefreshing(true);
      }

      try {
        const res = await fetch(`/api/teacher/activities/${activityId}`);
        if (!res.ok) {
          throw new Error('فشل جلب بيانات المشاركين');
        }

        const data = await res.json();
        if (isMountedRef.current) {
          const newSessions: ParticipantSession[] = data.sessions || [];
          setSessions(newSessions);
          setErrorMessage(null);
          setLastUpdatedTime(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          setLiveAnnouncement(`تم تحديث بيانات المشاركين بنجاح (${newSessions.length} طالب)`);
        }
      } catch (err) {
        if (isMountedRef.current) {
          // Preserve last successful data on temporary refresh errors
          setErrorMessage('تعذر تحديث البيانات مؤقتاً، يتم عرض آخر بيانات متوفرة.');
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [activityId]
  );

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    fetchSessions();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchSessions]);

  // 10-second polling only while page is visible and activity is active
  useEffect(() => {
    if (activityStatus !== 'active') return;

    let timer: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchSessions(false);
        }
      }, 10000); // exactly 10 seconds
    };

    const stopPolling = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchSessions(false);
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activityStatus, fetchSessions]);

  // Summary counts derived strictly from persisted sessions
  const totalCount = sessions.length;
  const inPreparationCount = sessions.filter(
    (s) => s.current_stage === 'baseline' && s.status !== 'completed' && s.status !== 'submitted' && s.status !== 'locked'
  ).length;
  const inDialogueCount = sessions.filter(
    (s) =>
      [
        'understanding',
        'evidence',
        'source_check',
        'causal_reasoning',
        'counter_argument',
      ].includes(s.current_stage) &&
      s.status !== 'completed' &&
      s.status !== 'submitted' &&
      s.status !== 'locked'
  ).length;
  const inReflectionCount = sessions.filter(
    (s) => s.current_stage === 'reflection' && s.status !== 'completed' && s.status !== 'submitted' && s.status !== 'locked'
  ).length;
  const completedCount = sessions.filter(
    (s) => s.status === 'completed' || s.status === 'submitted' || s.status === 'locked' || s.current_stage === 'submitted'
  ).length;

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '-';
    try {
      return new Date(timeStr).toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="bg-white border border-brand-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-brand-navy flex items-center gap-2">
            <span>متابعة الطلاب المشاركين</span>
            <span className="text-xs px-2.5 py-0.5 bg-brand-teal-50 text-brand-teal-800 rounded-full font-bold">
              {totalCount} طالب
            </span>
          </h3>
          <p className="text-xs text-brand-slate-500 mt-0.5">
            {activityStatus === 'active'
              ? 'يتم التحديث التلقائي كل 10 ثوانٍ أثناء فتح الصفحة'
              : 'النشاط مغلق، التحديث التلقائي متوقف'}
            {lastUpdatedTime && ` • آخر تحديث: ${lastUpdatedTime}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchSessions(true)}
            disabled={isRefreshing || isLoading}
            className="text-xs font-bold min-h-[36px]"
          >
            {isRefreshing ? 'جاري التحديث...' : 'تحديث الآن 🔄'}
          </Button>
        </div>
      </div>

      {/* Accessible Live Region */}
      <div role="status" aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </div>

      {/* Non-destructive error message */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs font-semibold flex items-center justify-between"
        >
          <span>⚠️ {errorMessage}</span>
          <button
            type="button"
            onClick={() => fetchSessions(true)}
            className="text-xs text-amber-900 underline font-bold"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Summary Counts Bar */}
      <div
        aria-label="إحصائيات تقدم الطلاب"
        className="grid grid-cols-2 sm:grid-cols-5 gap-3"
      >
        <div className="p-3.5 bg-brand-slate-50 rounded-xl border border-brand-slate-200 text-center">
          <div className="text-xs font-semibold text-brand-slate-500">إجمالي المشاركين</div>
          <div className="text-xl font-extrabold text-brand-navy mt-1">{totalCount}</div>
        </div>

        <div className="p-3.5 bg-brand-teal-50/50 rounded-xl border border-brand-teal-100 text-center">
          <div className="text-xs font-semibold text-brand-teal-900">في التحضير</div>
          <div className="text-xl font-extrabold text-brand-teal mt-1">{inPreparationCount}</div>
        </div>

        <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 text-center">
          <div className="text-xs font-semibold text-blue-900">في الحوار</div>
          <div className="text-xl font-extrabold text-blue-700 mt-1">{inDialogueCount}</div>
        </div>

        <div className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-100 text-center">
          <div className="text-xs font-semibold text-purple-900">في التأمل</div>
          <div className="text-xl font-extrabold text-purple-700 mt-1">{inReflectionCount}</div>
        </div>

        <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100 text-center col-span-2 sm:col-span-1">
          <div className="text-xs font-semibold text-emerald-900">مكتمل</div>
          <div className="text-xl font-extrabold text-emerald-700 mt-1">{completedCount}</div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="text-center py-12 space-y-2">
          <div className="w-8 h-8 border-4 border-brand-teal border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-brand-navy">جاري تحميل بيانات المشاركين...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 bg-brand-slate-50 rounded-2xl border border-dashed border-brand-slate-200 space-y-2">
          <div className="text-3xl">👥</div>
          <h4 className="font-bold text-base text-brand-navy">لم ينضم أي طالب بعد</h4>
          <p className="text-xs text-brand-slate-500 max-w-sm mx-auto">
            شارك رمز النشاط مع طلاب الصف للبدء في المناظرة السقراطية، وسيظهر تقدمهم هنا تلقائياً.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-slate-200">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-brand-slate-200 text-xs font-bold text-brand-slate-600 bg-brand-slate-50">
                <th className="p-3">اسم الطالب (Alias)</th>
                <th className="p-3">المرحلة البيداغوجية</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">التلميحات</th>
                <th className="p-3">آخر نشاط</th>
                <th className="p-3 text-left">فحص الجلسة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-slate-100 bg-white">
              {sessions.map((s) => {
                const statusMeta = STATUS_LABELS[s.status] || { label: s.status, variant: 'slate' };
                const stageLabel = STAGE_LABELS[s.current_stage] || s.current_stage;

                return (
                  <tr key={s.id} className="hover:bg-brand-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-brand-navy">{s.student_alias}</td>
                    <td className="p-3">
                      <span className="text-xs font-semibold text-brand-slate-800 bg-brand-slate-100 px-2.5 py-1 rounded-lg">
                        {s.status === 'completed' || s.status === 'submitted'
                          ? 'إنهاء التأمل والتركيب'
                          : stageLabel}
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge variant={statusMeta.variant} size="sm">
                        {statusMeta.label}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        {s.hint_count} / 3
                      </span>
                    </td>
                    <td className="p-3 text-xs text-brand-slate-500 font-mono">
                      {formatTime(s.updated_at || s.created_at)}
                    </td>
                    <td className="p-3 text-left">
                      <Link
                        href={`/teacher/sessions/${s.id}`}
                        className="inline-flex items-center text-xs font-bold text-brand-teal hover:text-brand-teal-800 bg-brand-teal-50 hover:bg-brand-teal-100 px-3 py-1.5 rounded-lg transition-colors min-h-[36px]"
                      >
                        فحص الجلسة 🔍
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
