'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/shared/Header';
import { Card, CardHeader } from '@/components/shared/Card';
import { Badge } from '@/components/shared/Badge';
import { Button } from '@/components/shared/Button';
import { ParticipantTracker } from '@/components/teacher/ParticipantTracker';
import { getGradeLabel } from '@/lib/db/schema';
import { toast } from 'sonner';

export default function TeacherActivityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const activityId = params.activityId as string;

  const [activeTab, setActiveTab] = useState<'participants' | 'sources' | 'rubric'>('participants');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['teacher-activity-detail', activityId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/activities/${activityId}`);
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
  });

  const activity = data?.activity;

  const handleCopyCode = () => {
    if (activity?.access_code) {
      navigator.clipboard.writeText(activity.access_code);
      toast.success(`تم نسخ رمز النشاط: ${activity.access_code}`);
    }
  };

  const handleToggleStatus = async () => {
    if (!activity) return;
    const nextStatus = activity.status === 'active' ? 'closed' : 'active';
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/teacher/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const resData = await res.json();
      if (!res.ok) {
        toast.error(resData.error || 'تعذر تحديث حالة النشاط');
        return;
      }
      toast.success(`تم تحديث حالة النشاط إلى: ${nextStatus === 'active' ? 'نشط' : 'مغلق'}`);
      refetch();
    } catch (err) {
      console.error('Status error:', err);
      toast.error('حدث خطأ أثناء تحديث الحالة');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-slate-50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-brand-teal border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-brand-navy">جاري تحميل بيانات النشاط...</p>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-slate-50">
        <Header role="teacher" />
        <main className="flex-1 flex items-center justify-center p-6">
          <Card variant="bordered" className="text-center p-8 bg-white max-w-md">
            <h3 className="text-lg font-bold text-brand-navy mb-2">النشاط غير موجود</h3>
            <Link
              href="/teacher"
              className="text-sm font-bold text-brand-teal hover:underline"
            >
              ← العودة للوحة التحكم
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-slate-50">
      <Header
        role="teacher"
        title="مختبر التفكير الناقد"
        subtitle={`إدارة نشاط: ${activity.title}`}
        rightElement={
          <Link
            href="/teacher"
            className="text-xs font-bold text-brand-slate-600 hover:text-brand-navy px-3 py-1.5 rounded-lg border border-brand-slate-200 bg-white min-h-[36px] inline-flex items-center"
          >
            ← لوحة المعلم
          </Link>
        }
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Activity Details & Code Header Card */}
        <Card variant="bordered" className="bg-white shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={activity.status === 'active' ? 'teal' : 'danger'}>
                  {activity.status === 'active' ? 'متاح ومفتوح للطلاب' : 'مغلق مؤقتاً'}
                </Badge>
                <Badge variant="navy" size="sm">
                  {getGradeLabel(activity.grade_level)}
                </Badge>
                <Badge variant="amber" size="sm">
                  نمط: {activity.stance_mode}
                </Badge>
              </div>
              <h1 className="text-2xl font-black text-brand-navy leading-snug">
                {activity.title}
              </h1>
              <p className="text-sm text-brand-slate-500 mt-1">{activity.topic}</p>
            </div>

            {/* Access Code Box */}
            <div className="flex flex-col items-center sm:items-end gap-2 p-3 bg-brand-slate-50 border border-brand-slate-200 rounded-2xl">
              <span className="text-xs font-bold text-brand-slate-500">رمز الانضمام الصفي:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-black text-brand-navy tracking-widest px-3 py-1 bg-white rounded-xl border border-brand-slate-300">
                  {activity.access_code}
                </span>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleCopyCode}
                  className="text-xs font-bold min-h-[44px]"
                >
                  📋 نسخ
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-brand-slate-500">موقف الذكاء الاصطناعي:</span>
              <strong className="text-brand-navy">{activity.ai_stance}</strong>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={activity.status === 'active' ? 'outline' : 'primary'}
                size="sm"
                onClick={handleToggleStatus}
                isLoading={isUpdatingStatus}
                className="text-xs min-h-[36px]"
              >
                {activity.status === 'active' ? 'إغلاق النشاط 🔒' : 'إعادة فتح النشاط 🟢'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-brand-slate-200 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('participants')}
            className={`px-4 py-2 font-bold text-sm rounded-xl transition-colors min-h-[44px] ${
              activeTab === 'participants'
                ? 'bg-brand-teal text-white shadow-xs'
                : 'text-brand-slate-600 hover:bg-brand-slate-100'
            }`}
          >
            👥 متابعة الطلاب والجلسات
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sources')}
            className={`px-4 py-2 font-bold text-sm rounded-xl transition-colors min-h-[44px] ${
              activeTab === 'sources'
                ? 'bg-brand-teal text-white shadow-xs'
                : 'text-brand-slate-600 hover:bg-brand-slate-100'
            }`}
          >
            📖 المصادر المعتمدة ({activity.sources?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rubric')}
            className={`px-4 py-2 font-bold text-sm rounded-xl transition-colors min-h-[44px] ${
              activeTab === 'rubric'
                ? 'bg-brand-teal text-white shadow-xs'
                : 'text-brand-slate-600 hover:bg-brand-slate-100'
            }`}
          >
            📊 معايير التقييم (Rubric)
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'participants' && (
          <ParticipantTracker activityId={activityId} activityStatus={activity.status} />
        )}

        {activeTab === 'sources' && (
          <div className="space-y-4">
            {activity.sources?.map((s: any, idx: number) => (
              <Card key={s.id || idx} variant="bordered" className="bg-white">
                <CardHeader
                  title={`${s.citation_label} — ${s.title}`}
                  action={
                    s.source_url ? (
                      <a
                        href={s.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-teal hover:underline font-semibold"
                      >
                        رابط المصدر ↗
                      </a>
                    ) : null
                  }
                />
                <div className="p-4 bg-brand-slate-50 rounded-xl text-xs leading-relaxed text-brand-slate-800 whitespace-pre-wrap border border-brand-slate-200">
                  {s.source_snapshot}
                </div>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'rubric' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activity.rubric_config?.map((rc: any, idx: number) => (
              <Card key={rc.id || idx} variant="bordered" className="bg-white space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-bold text-sm text-brand-navy">
                    {idx + 1}. {rc.title}
                  </h3>
                  <Badge variant="teal" size="sm">
                    الوزن: {rc.weight}%
                  </Badge>
                </div>
                <p className="text-xs text-brand-slate-600">{rc.description}</p>
                <div className="space-y-1.5 pt-2">
                  {rc.levels?.map((lvl: any) => (
                    <div
                      key={lvl.score}
                      className="p-2 bg-brand-slate-50 rounded-lg text-[11px] flex items-start gap-2"
                    >
                      <span className="font-bold text-brand-teal px-1.5 py-0.5 bg-white rounded border">
                        {lvl.score}/4
                      </span>
                      <span className="text-brand-slate-700">{lvl.descriptor}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
