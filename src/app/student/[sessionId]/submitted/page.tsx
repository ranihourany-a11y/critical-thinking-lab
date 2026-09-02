'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/shared/Header';
import { Card } from '@/components/shared/Card';

export default function StudentSubmittedPage() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-slate-50">
      <Header role="student" title="مختبر التفكير الناقد" subtitle="اكتمال الجلسة" />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <Card variant="bordered" className="max-w-lg w-full text-center p-8 bg-white shadow-lg space-y-6">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto text-4xl shadow-inner border border-emerald-200">
            ✓
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-brand-navy">
              تم إرسال الحوار إلى الأستاذ
            </h2>
            <p className="text-base text-brand-slate-600 leading-relaxed">
              شكراً لمشاركتك المتميزة في مختبر التفكير الناقد. تم حفظ سجل الحوار وتأملك النهائي بنجاح،
              وسيقوم المعلم بمراجعته وتقديم التغذية الراجعة لك في الصف.
            </p>
          </div>

          <div className="p-4 bg-brand-slate-50 rounded-2xl border border-brand-slate-200 text-xs text-brand-slate-500 space-y-1">
            <p className="font-semibold text-brand-navy">حالة الجلسة: مكتملة ومغلقة 🔒</p>
            <p>لا يمكن إجراء تعديلات إضافية على هذا الحوار بعد الإرسال.</p>
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center font-bold text-sm bg-brand-navy text-white hover:bg-brand-navy-800 rounded-xl px-6 py-3 transition-colors shadow-sm min-h-[44px]"
            >
              العودة إلى الصفحة الرئيسية ➔
            </Link>
          </div>
        </Card>
      </main>

      <footer className="py-4 text-center text-xs text-brand-slate-400 border-t border-brand-slate-200 bg-white">
        مختبر التفكير الناقد — منصة تعليمية قائمة على الأدلة والحوار السقراطي
      </footer>
    </div>
  );
}
