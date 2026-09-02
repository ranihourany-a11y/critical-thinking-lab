import React from 'react';
import Link from 'next/link';

export function Header({
  role = 'student',
  title,
  subtitle,
  rightElement,
}: {
  role?: 'student' | 'teacher' | 'public';
  title?: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
}) {
  return (
    <header className="w-full bg-white border-b border-brand-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={role === 'teacher' ? '/teacher' : '/'}
            className="flex items-center gap-3 group focus:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-navy flex items-center justify-center text-white font-black text-xl group-hover:bg-brand-teal transition-colors">
              ن
            </div>
            <div>
              <h1 className="text-lg font-bold text-brand-navy leading-tight group-hover:text-brand-teal transition-colors">
                {title || 'مختبر التفكير الناقد'}
              </h1>
              <p className="text-xs text-brand-slate-500">
                {subtitle || (role === 'teacher' ? 'لوحة تحكم المعلم' : 'منصة الحوار السقراطي')}
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {rightElement}
          {role === 'public' && (
            <Link
              href="/teacher"
              className="text-sm font-semibold text-brand-slate-600 hover:text-brand-teal px-3 py-1.5 rounded-lg border border-brand-slate-200 hover:border-brand-teal transition-colors min-h-[44px] inline-flex items-center"
            >
              بوابة المعلمين
            </Link>
          )}
          {role === 'teacher' && (
            <Link
              href="/"
              className="text-sm font-semibold text-brand-slate-600 hover:text-brand-teal px-3 py-1.5 rounded-lg border border-brand-slate-200 hover:border-brand-teal transition-colors min-h-[44px] inline-flex items-center"
            >
              بوابة الطلاب
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
