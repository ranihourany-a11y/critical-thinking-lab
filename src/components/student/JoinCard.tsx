'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '../shared/Card';
import { Input } from '../shared/Input';
import { Button } from '../shared/Button';
import { toast } from 'sonner';

export function JoinCard() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState('');
  const [studentAlias, setStudentAlias] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = accessCode.trim().toUpperCase();
    const cleanAlias = studentAlias.trim();

    if (!cleanCode) {
      setError('يرجى إدخال رمز النشاط');
      return;
    }

    if (!cleanAlias || cleanAlias.length < 2) {
      setError('يرجى إدخال اسمك المستعار (حرفان على الأقل)');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/student/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_code: cleanCode,
          student_alias: cleanAlias,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error || 'تعذر الانضمام إلى النشاط';
        setError(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
        return;
      }

      toast.success(`أهلاً بك يا ${cleanAlias}! جاري الانتقال للنشاط...`);
      router.push(`/student/${data.sessionId}/prepare`);
    } catch (err) {
      console.error('Join error:', err);
      const msg = 'تعذر الاتصال بالخادم. يرجى التحقق من الاتصال والمحاولة ثانية.';
      setError(msg);
      toast.error(msg);
      setIsLoading(false);
    }
  };

  return (
    <Card variant="bordered" className="max-w-md w-full shadow-lg border-brand-slate-200 bg-white">
      <CardHeader
        title="انضم إلى حوار التفكير الناقد"
        subtitle="أدخل رمز النشاط الذي زودك به المعلم واسمك المستعار للبدء"
      />

      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        <Input
          label="رمز النشاط (Activity Code):"
          id="access-code"
          placeholder="مثال: CLIM89"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
          maxLength={10}
          autoFocus
          className="text-center font-mono text-xl tracking-widest uppercase font-bold"
        />

        <Input
          label="اسمك المستعار أو كودك في الصف:"
          id="student-alias"
          placeholder="مثال: أحمد 07 أو باحث المستقبل"
          value={studentAlias}
          onChange={(e) => setStudentAlias(e.target.value)}
          maxLength={40}
        />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2 text-base font-bold shadow-md"
          isLoading={isLoading}
        >
          ابدأ الحوار الآن 🚀
        </Button>

        <div className="pt-3 border-t border-brand-slate-100 text-center">
          <p className="text-xs text-brand-slate-500">
            لا يتطلب حساب ذكاء اصطناعي أو بريد إلكتروني. حوار آمن وخاص مع المعلم.
          </p>
        </div>
      </form>
    </Card>
  );
}
