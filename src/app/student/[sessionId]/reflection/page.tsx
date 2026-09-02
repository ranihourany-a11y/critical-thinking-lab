'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/shared/Header';
import { ReflectionForm } from '@/components/student/ReflectionForm';
import { toast } from 'sonner';

export default function StudentReflectionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/student/session');
        if (!res.ok) {
          toast.error('الجلسة غير صالحة');
          router.push('/');
          return;
        }
        const data = await res.json();
        setSession(data.session);
        setActivity(data.activity);

        if (data.session.status === 'submitted') {
          router.push(`/student/${sessionId}/submitted`);
        }
      } catch (err) {
        console.error('Error fetching session:', err);
        toast.error('تعذر جلب بيانات الجلسة');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [sessionId, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-slate-50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-brand-teal border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-brand-navy">جاري تجهيز نموذج التأمل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-slate-50">
      <Header
        role="student"
        title={activity?.title || 'مختبر التفكير الناقد'}
        subtitle={`الطالب: ${session?.student_alias || ''} — مرحلة التأمل النهائي`}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6">
        <ReflectionForm
          sessionId={sessionId}
          initialStance={session?.initial_stance}
          initialConfidence={session?.initial_confidence}
        />
      </main>
    </div>
  );
}
