'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/shared/Header';
import { Card, CardHeader } from '@/components/shared/Card';
import { Input } from '@/components/shared/Input';
import { Button } from '@/components/shared/Button';
import { createClient } from '@/lib/supabase/client';
import { getSafeTeacherRedirect } from '@/lib/auth/teacher-auth';

function TeacherLoginForm() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next');
  const safeNext = getSafeTeacherRedirect(rawNext);
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);

    try {
      const supabase = createClient();
      const redirectUrl = new URL('/auth/callback', window.location.origin);
      redirectUrl.searchParams.set('next', safeNext);

      await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectUrl.toString(),
        },
      });
    } catch (err) {
      console.error('Magic link sign-in error:', err);
    } finally {
      setIsLoading(false);
      // Always display the exact same confirmation response to prevent email enumeration
      setSubmitted(true);
    }
  };

  return (
    <Card variant="bordered" className="max-w-md w-full shadow-lg bg-white">
      <CardHeader
        title="تسجيل دخول المعلم"
        subtitle="أدخل بريدك الإلكتروني المدرسي المعتمد لتلقي رابط تسجيل الدخول الآمن"
      />

      {errorParam === 'unauthorized' && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
          ⚠️ هذا الحساب غير مسجل ضمن قائمة المعلمين المصرح لهم بالوصول.
        </div>
      )}

      {errorParam === 'invalid_token' && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
          ⚠️ رابط تسجيل الدخول غير صالح أو انتهت صلاحيته. يرجى طلب رابط جديد.
        </div>
      )}

      {submitted ? (
        <div className="space-y-4 text-center py-4">
          <div className="w-14 h-14 bg-brand-teal-50 text-brand-teal rounded-2xl flex items-center justify-center text-3xl mx-auto border border-brand-teal-200">
            📩
          </div>
          <div className="p-4 bg-brand-teal-50 border border-brand-teal-200 rounded-xl text-sm font-bold text-brand-teal-900 leading-relaxed">
            إذا كان البريد معتمدًا، فستصلك رسالة تتضمن رابط الدخول.
          </div>
          <p className="text-xs text-brand-slate-500">
            تحقق من صندوق الوارد أو البريد غير الهام (Spam) وانقر على الرابط للمتابعة.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSubmitted(false);
              setEmail('');
            }}
            className="font-bold text-xs"
          >
            إرسال إلى بريد آخر
          </Button>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4 mt-2">
          <Input
            label="البريد الإلكتروني للمعلم:"
            id="teacher-email"
            name="email"
            type="email"
            placeholder="name@school.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoFocus
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full text-base font-bold shadow-md"
            isLoading={isLoading}
          >
            إرسال رابط الدخول الآمن (Magic Link) ✉️
          </Button>

          <div className="pt-3 border-t border-brand-slate-100 text-center">
            <p className="text-xs text-brand-slate-500">
              يتم التحقق الآمن عبر البريد الإلكتروني المعتمد دون الحاجة لكلمات مرور.
            </p>
          </div>
        </form>
      )}
    </Card>
  );
}

export default function TeacherLoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-slate-50">
      <Header role="public" title="مختبر التفكير الناقد" subtitle="بوابة المعلمين والمشرفين" />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <React.Suspense
          fallback={
            <Card variant="bordered" className="max-w-md w-full shadow-lg bg-white p-8 text-center text-sm font-semibold text-brand-slate-500">
              جاري التحميل...
            </Card>
          }
        >
          <TeacherLoginForm />
        </React.Suspense>
      </main>
    </div>
  );
}
