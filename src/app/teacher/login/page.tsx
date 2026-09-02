'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/shared/Header';
import { Card, CardHeader } from '@/components/shared/Card';
import { Input } from '@/components/shared/Input';
import { Button } from '@/components/shared/Button';
import { toast } from 'sonner';

export default function TeacherLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('teacher@ctl.school.edu');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Development auto-login or magic link
    setTimeout(() => {
      toast.success('تم تسجيل الدخول كمعلم بنجاح!');
      router.push('/teacher');
    }, 600);
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-slate-50">
      <Header role="public" title="مختبر التفكير الناقد" subtitle="بوابة المعلمين والمشرفين" />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <Card variant="bordered" className="max-w-md w-full shadow-lg bg-white">
          <CardHeader
            title="تسجيل دخول المعلم"
            subtitle="أدخل بريدك الإلكتروني المدرسي للوصول إلى لوحة التحكم والأنشطة"
          />

          <form onSubmit={handleLogin} className="space-y-4 mt-2">
            <Input
              label="البريد الإلكتروني للمعلم:"
              type="email"
              placeholder="name@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full text-base font-bold shadow-md"
              isLoading={isLoading}
            >
              دخول مباشر إلى لوحة المعلم ➔
            </Button>

            <div className="p-3 bg-brand-teal-50 border border-brand-teal-200 rounded-xl text-xs text-brand-teal-900 leading-relaxed">
              💡 <strong>بيئة التطوير والاختبار:</strong> تسجيل الدخول مفعل تلقائياً كمعلم افتراضي لتسهيل إدارة الأنشطة ومراجعة تقييمات الطلاب.
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
