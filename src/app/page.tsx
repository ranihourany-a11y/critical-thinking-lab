import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/shared/Header';
import { JoinCard } from '@/components/student/JoinCard';

export const metadata: Metadata = {
  title: 'مختبر التفكير الناقد | منصة الحوار السقراطي للتعليم المتوسط',
  description:
    'تطبيق تعليمي تفاعلي باللغة العربية لتعزيز مهارات التفكير الناقد وحل المشكلات عبر الحوار السقراطي الموجه بالأدلة والمصادر.',
  alternates: {
    canonical: '/',
  },
};

export default function LobbyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-slate-50">
      <Header role="public" />

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Main Join Card */}
          <JoinCard />

          {/* Secondary Teacher Link */}
          <div className="text-center p-4 bg-white rounded-2xl border border-brand-slate-200 shadow-xs">
            <span className="text-xs text-brand-slate-500 block mb-1">هل أنت معلم أو مشرف تربوي؟</span>
            <Link
              href="/teacher"
              className="inline-flex items-center justify-center text-sm font-bold text-brand-teal hover:text-brand-teal-800 transition-colors py-1 min-h-[44px]"
            >
              الدخول إلى لوحة المعلم وإنشاء الأنشطة ←
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-brand-slate-400 border-t border-brand-slate-200 bg-white">
        مختبر التفكير الناقد — منصة تعليمية قائمة على الأدلة والحوار السقراطي (الصفوف 7–9)
      </footer>
    </div>
  );
}
