'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { Session } from '@/lib/db/schema';
import { STAGES_LIST } from '../student/StageProgressBar';

export function ParticipantTracker({ activityId }: { activityId: string }) {
  const { data, isLoading, refetch, isFetching } = useQuery<{
    activity: any;
    sessions: Session[];
  }>({
    queryKey: ['teacher-activity-sessions', activityId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/activities/${activityId}`);
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    refetchInterval: 5000, // Periodic live refresh
  });

  const sessions = data?.sessions || [];

  return (
    <div className="bg-white border border-brand-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-brand-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-brand-navy flex items-center gap-2">
            <span>متابعة الطلاب المشاركين</span>
            <span className="text-xs px-2.5 py-0.5 bg-brand-teal-50 text-brand-teal-800 rounded-full font-bold">
              {sessions.length} طالب
            </span>
          </h3>
          <p className="text-xs text-brand-slate-500 mt-0.5">
            يتم تحديث الحالة تلقائياً كل 5 ثوانٍ
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs min-h-[36px]"
        >
          {isFetching ? 'جاري التحديث...' : '🔄 تحديث يدوي'}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-sm text-brand-slate-400">
          جاري تحميل بيانات الطلاب...
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-10 bg-brand-slate-50 rounded-xl border border-dashed border-brand-slate-200">
          <div className="text-3xl mb-2">⏳</div>
          <p className="font-bold text-sm text-brand-navy">في انتظار انضمام الطلاب</p>
          <p className="text-xs text-brand-slate-500 mt-1">
            شارك رمز النشاط مع الطلاب في الصف ليظهر تقدمهم هنا مباشرة
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-brand-slate-200 text-xs font-bold text-brand-slate-500 bg-brand-slate-50">
                <th className="p-3 rounded-r-xl">اسم الطالب</th>
                <th className="p-3">المرحلة الحالية</th>
                <th className="p-3">التلميحات</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">تغير الثقة</th>
                <th className="p-3 text-left rounded-l-xl">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-slate-100">
              {sessions.map((s) => {
                const stageObj = STAGES_LIST.find((stg) => stg.key === s.current_stage);
                const isSubmitted = s.status === 'submitted';

                return (
                  <tr key={s.id} className="hover:bg-brand-slate-50 transition-colors">
                    <td className="p-3 font-bold text-brand-navy">{s.student_alias}</td>
                    <td className="p-3">
                      <span className="text-xs font-semibold text-brand-slate-700 bg-brand-slate-100 px-2 py-1 rounded-md">
                        {isSubmitted ? 'تم إنهاء التأمل' : stageObj?.label || s.current_stage}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-xs font-bold text-brand-amber-700">
                        {s.hint_count} / 3
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge variant={isSubmitted ? 'success' : 'teal'} size="sm">
                        {isSubmitted ? 'تم الإرسال ✓' : 'حوار جاري 💬'}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs">
                      {s.initial_confidence ? (
                        <span>
                          {s.initial_confidence}/5
                          {s.final_confidence ? ` ➔ ${s.final_confidence}/5` : ''}
                        </span>
                      ) : (
                        <span className="text-brand-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3 text-left">
                      <Link
                        href={`/teacher/sessions/${s.id}`}
                        className="inline-flex items-center text-xs font-bold text-brand-teal hover:text-brand-teal-800 bg-brand-teal-50 hover:bg-brand-teal-100 px-3 py-1.5 rounded-lg transition-colors min-h-[36px]"
                      >
                        فحص الحوار والتقييم 🔍
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
