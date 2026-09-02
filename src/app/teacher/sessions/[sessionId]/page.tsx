'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/shared/Header';
import { Card } from '@/components/shared/Card';
import { EvaluationInspector } from '@/components/teacher/EvaluationInspector';

export default function TeacherSessionInspectorPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['teacher-session-detail', sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch session detail');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-slate-50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-brand-teal border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-brand-navy">جاري فحص سجل جلسة الطالب...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.session) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-slate-50">
        <Header role="teacher" />
        <main className="flex-1 flex items-center justify-center p-6">
          <Card variant="bordered" className="text-center p-8 bg-white max-w-md space-y-3">
            <h3 className="text-lg font-bold text-brand-navy">تعذر العثور على الجلسة</h3>
            <p className="text-sm text-brand-slate-500">
              ربما تم حذف الجلسة أو ليس لديك الصلاحية للاطلاع عليها.
            </p>
            <Link
              href="/teacher"
              className="inline-flex items-center text-sm font-bold text-brand-teal hover:underline"
            >
              ← العودة للوحة المعلم
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
        subtitle={`فحص جلسة الطالب: ${data.session.student_alias}`}
        rightElement={
          <Link
            href={`/teacher/activities/${data.session.activity_id}`}
            className="text-xs font-bold text-brand-slate-600 hover:text-brand-navy px-3 py-1.5 rounded-lg border border-brand-slate-200 bg-white min-h-[36px] inline-flex items-center"
          >
            ← العودة للنشاط
          </Link>
        }
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        <EvaluationInspector
          session={data.session}
          activity={data.activity}
          messages={data.messages || []}
          evaluation={data.evaluation}
        />
      </main>
    </div>
  );
}
