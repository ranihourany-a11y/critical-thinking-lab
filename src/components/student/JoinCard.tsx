'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '../shared/Card';
import { Input } from '../shared/Input';
import { Button } from '../shared/Button';
import { toast } from 'sonner';

export function JoinCard() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState('');
  const [studentAlias, setStudentAlias] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ accessCode?: string; studentAlias?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const accessCodeRef = useRef<HTMLInputElement>(null);
  const studentAliasRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Prevent double-clicks / duplicate submissions

    setGeneralError(null);
    const errors: { accessCode?: string; studentAlias?: string } = {};

    const cleanCode = accessCode.trim().toUpperCase();
    const cleanAlias = studentAlias.replace(/\s+/g, ' ').trim();

    if (!cleanCode || cleanCode.length < 3 || cleanCode.length > 20) {
      errors.accessCode = 'يرجى إدخال رمز النشاط (بين 3 و 20 حرفاً)';
    }

    if (!cleanAlias || cleanAlias.length < 2 || cleanAlias.length > 40) {
      errors.studentAlias = 'يرجى إدخال اسمك المستعار (بين 2 و 40 حرفاً)';
    } else if (/[\u0000-\u001F\u007F-\u009F]/.test(cleanAlias)) {
      errors.studentAlias = 'الاسم المستعار يحتوي على رموز تحكم غير مسموحة';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.accessCode) {
        accessCodeRef.current?.focus();
      } else if (errors.studentAlias) {
        studentAliasRef.current?.focus();
      }
      return; // Block request when validation fails, preserving input state
    }

    setFieldErrors({});
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
        const errorMsg = data.error || 'تعذر الانضمام. تحقق من رمز النشاط وحاول مجددًا.';
        setGeneralError(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
        return;
      }

      toast.success(`أهلاً بك يا ${cleanAlias}! جاري الانتقال للنشاط...`);
      // Navigate only to the server-returned session ID after confirmed persistence
      router.push(`/student/${data.sessionId}/prepare`);
    } catch (err) {
      console.error('Join error:', err);
      const msg = 'تعذر الاتصال بالخادم. يرجى التحقق من الاتصال والمحاولة ثانية.';
      setGeneralError(msg);
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

      <form onSubmit={handleSubmit} noValidate className="space-y-4 mt-2">
        <Input
          ref={accessCodeRef}
          label="رمز النشاط (Activity Code):"
          id="access-code"
          name="accessCode"
          placeholder="مثال: CLIM89"
          value={accessCode}
          disabled={isLoading}
          onChange={(e) => {
            setAccessCode(e.target.value.toUpperCase());
            if (fieldErrors.accessCode) {
              setFieldErrors((prev) => ({ ...prev, accessCode: undefined }));
            }
          }}
          error={fieldErrors.accessCode}
          maxLength={20}
          required
          autoComplete="one-time-code"
          autoFocus
          className="text-center font-mono text-xl tracking-widest uppercase font-bold"
        />

        <Input
          ref={studentAliasRef}
          label="اسمك المستعار أو كودك في الصف:"
          id="student-alias"
          name="studentAlias"
          placeholder="مثال: أحمد 07 أو باحث المستقبل"
          value={studentAlias}
          disabled={isLoading}
          onChange={(e) => {
            setStudentAlias(e.target.value);
            if (fieldErrors.studentAlias) {
              setFieldErrors((prev) => ({ ...prev, studentAlias: undefined }));
            }
          }}
          error={fieldErrors.studentAlias}
          maxLength={40}
          required
          autoComplete="nickname"
        />

        {generalError && (
          <div
            role="alert"
            aria-live="polite"
            className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700"
          >
            {generalError}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2 text-base font-bold shadow-md"
          isLoading={isLoading}
          disabled={isLoading}
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
