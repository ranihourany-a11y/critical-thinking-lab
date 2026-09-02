'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/shared/Header';
import { ActivityCard } from '@/components/teacher/ActivityCard';
import { Activity } from '@/lib/db/schema';

export default function TeacherDashboardPage() {
  const { data, isLoading, error } = useQuery<{ activities: Activity[] }>({
    queryKey: ['teacher-activities'],
    queryFn: async () => {
      const res = await fetch('/api/teacher/activities');
      if (!res.ok) throw new Error('Failed to fetch activities');
      return res.json();
    },
  });

  const activities = data?.activities || [];
  const activeCount = activities.filter((a) => a.status === 'active').length;
  const draftCount = activities.filter((a) => a.status === 'draft').length;

  return (
    <div className="min-h-screen flex flex-col bg-brand-slate-50">
      <Header
        role="teacher"
        title="مختبر التفكير الناقد"
        subtitle="لوحة تحكم وإدارة الأنشطة الصفية"
        rightElement={
          <Link
            href="/teacher/activities/new"
            className="inline-flex items-center gap-1.5 font-bold text-sm bg-brand-teal text-white hover:bg-brand-teal-700 px-4 py-2 rounded-xl transition-colors shadow-sm min-h-[44px]"
          >
            <span>+</span>
            <span>إنشاء نشاط جديد</span>
          </Link>
        }
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-brand-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-brand-slate-500 block">
                إجمالي الأنشطة
              </span>
              <span className="text-3xl font-black text-brand-navy mt-1 block">
                {activities.length}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-brand-slate-100 flex items-center justify-center text-2xl">
              📚
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-brand-teal-100 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-brand-teal-800 block">
                الأنشطة النشطة حالياً
              </span>
              <span className="text-3xl font-black text-brand-teal mt-1 block">
                {activeCount}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-brand-teal-50 flex items-center justify-center text-2xl text-brand-teal">
              🟢
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-brand-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-brand-slate-500 block">
                المسودات غير المنشورة
              </span>
              <span className="text-3xl font-black text-brand-slate-700 mt-1 block">
                {draftCount}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-brand-slate-100 flex items-center justify-center text-2xl">
              📁
            </div>
          </div>
        </div>

        {/* Activities Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-brand-navy">الأنشطة الصفية</h2>
            <Link
              href="/teacher/activities/new"
              className="text-xs font-bold text-brand-teal hover:underline"
            >
              + إضافة نشاط جديد
            </Link>
          </div>

          {isLoading ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-brand-slate-200 text-sm text-brand-slate-500">
              جاري تحميل الأنشطة...
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-brand-slate-300 p-6 space-y-3">
              <div className="text-4xl">📝</div>
              <h3 className="text-lg font-bold text-brand-navy">لا توجد أنشطة مضافة بعد</h3>
              <p className="text-sm text-brand-slate-500 max-w-sm mx-auto">
                أنشئ أول نشاط للتفكير الناقد بالمعالج ذي الـ 6 خطوات وشارك الرمز مع طلابك!
              </p>
              <Link
                href="/teacher/activities/new"
                className="inline-flex items-center font-bold text-sm bg-brand-teal text-white px-5 py-2.5 rounded-xl shadow-sm hover:bg-brand-teal-700 transition-colors"
              >
                إنشاء نشاطك الأول الآن ➔
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activities.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
