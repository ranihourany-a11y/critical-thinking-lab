import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/shared/Header';
import { ActivityWizard } from '@/components/teacher/ActivityWizard';

export default function NewActivityPage() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-slate-50">
      <Header
        role="teacher"
        title="مختبر التفكير الناقد"
        subtitle="معالج إنشاء نشاط جديد"
        rightElement={
          <Link
            href="/teacher"
            className="text-xs font-bold text-brand-slate-600 hover:text-brand-navy px-3 py-1.5 rounded-lg border border-brand-slate-200 bg-white"
          >
            ← العودة للوحة التحكم
          </Link>
        }
      />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        <ActivityWizard />
      </main>
    </div>
  );
}
