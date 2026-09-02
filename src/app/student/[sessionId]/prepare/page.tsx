'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/shared/Header';
import { Card, CardHeader } from '@/components/shared/Card';
import { Input } from '@/components/shared/Input';
import { Textarea } from '@/components/shared/Textarea';
import { ConfidenceSlider } from '@/components/shared/Slider';
import { Button } from '@/components/shared/Button';
import { Badge } from '@/components/shared/Badge';
import { getGradeLabel } from '@/lib/db/schema';
import { toast } from 'sonner';

export default function StudentPreparePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [sessionData, setSessionData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [initialStance, setInitialStance] = useState('');
  const [initialReason, setInitialReason] = useState('');
  const [initialConfidence, setInitialConfidence] = useState(3);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/student/session');
        if (!res.ok) {
          toast.error('الجلسة غير صالحة أو انتهت صلاحيتها');
          router.push('/');
          return;
        }
        const data = await res.json();
        setSessionData(data);
        if (data.session.initial_stance) {
          setInitialStance(data.session.initial_stance);
        }
        if (data.session.initial_confidence) {
          setInitialConfidence(data.session.initial_confidence);
        }
      } catch (err) {
        console.error('Error fetching session:', err);
        toast.error('تعذر جلب بيانات الجلسة');
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!initialStance.trim() || initialStance.trim().length < 2) {
      setError('يرجى كتابة موقفك الأولي بوضوح');
      return;
    }

    if (!initialReason.trim() || initialReason.trim().length < 10) {
      setError('يرجى تقديم تبرير لا يقل عن 10 أحرف يوضح سبب اتخاذ هذا الموقف');
      return;
    }

    if (!rulesAccepted) {
      setError('يرجى الموافقة على قواعد الحوار السقراطي للبدء');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/student/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initial_stance: initialStance.trim(),
          initial_reason: initialReason.trim(),
          initial_confidence: initialConfidence,
          rules_accepted: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || 'تعذر حفظ بيانات الإعداد';
        setError(msg);
        toast.error(msg);
        setIsSubmitting(false);
        return;
      }

      toast.success('تم تسجيل موقفك المبدئي! جاري الدخول للمناظرة...');
      router.push(`/student/${sessionId}/debate`);
    } catch (err) {
      console.error('Error submitting prepare data:', err);
      setError('حدث خطأ في الاتصال بالخادم');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-slate-50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-brand-teal border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-brand-navy">جاري تجهيز مختبر التفكير الناقد...</p>
        </div>
      </div>
    );
  }

  const activity = sessionData?.activity;

  return (
    <div className="min-h-screen flex flex-col bg-brand-slate-50">
      <Header
        role="student"
        title="مختبر التفكير الناقد"
        subtitle={`جلسة الطالب: ${sessionData?.session?.student_alias || ''}`}
      />

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Activity Presentation Card */}
        {activity && (
          <Card variant="navy" className="shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="teal" size="sm">
                {getGradeLabel(activity.grade_level)}
              </Badge>
              <Badge variant="amber" size="sm">
                {activity.max_turns} جولات نقاشية
              </Badge>
            </div>
            <h2 className="text-2xl font-black mb-2 leading-snug">{activity.title}</h2>
            <p className="text-sm text-brand-navy-100 leading-relaxed">{activity.topic}</p>

            {/* Sources Excerpt Pill */}
            {activity.sources && activity.sources.length > 0 && (
              <div className="mt-4 pt-4 border-t border-brand-navy-700 text-xs space-y-2">
                <span className="font-bold text-brand-teal-100 block">
                  📚 المصادر العلمية المتاحة للنشاط:
                </span>
                <div className="flex flex-wrap gap-2">
                  {activity.sources.map((s: any) => (
                    <span
                      key={s.id}
                      className="px-2.5 py-1 bg-brand-navy-800 rounded-lg text-white font-mono text-[11px]"
                    >
                      {s.citation_label} - {s.title}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Preparation Form */}
        <Card variant="bordered" className="bg-white shadow-md">
          <CardHeader
            title="المرحلة 1: تحديد الموقف المبدئي"
            subtitle="قبل أن تبدأ الحوار مع المرشد السقراطي، حدد رأيك وتبريرك الأولي ومستوى ثقتك"
          />

          <form onSubmit={handleSubmit} className="space-y-5 mt-4">
            <Input
              label="ما هو موقفك المبدئي من هذا السؤال؟"
              id="initial-stance"
              placeholder="مثال: أرى أن الأنشطة البشرية مثل حرق الوقود تلعب الدور الأكبر..."
              value={initialStance}
              onChange={(e) => setInitialStance(e.target.value)}
              required
            />

            <Textarea
              label="ما هو تبريرك أو تفسيرك الأولي لهذا الموقف؟"
              id="initial-reason"
              placeholder="اكتب الأسباب أو المعلومات التي جعلتك تتخذ هذا الموقف (لا يقل عن 10 أحرف)..."
              rows={3}
              value={initialReason}
              onChange={(e) => setInitialReason(e.target.value)}
              required
            />

            <ConfidenceSlider
              label="حدد مستوى ثقتك المبدئية في هذا الرأي (1 إلى 5):"
              value={initialConfidence}
              onChange={setInitialConfidence}
            />

            {/* Age-appropriate dialogue rules */}
            <div className="p-4 bg-brand-teal-50 border border-brand-teal-200 rounded-xl space-y-3">
              <h4 className="font-bold text-sm text-brand-teal-900">
                📜 قواعد الحوار السقراطي في مختبر التفكير الناقد:
              </h4>
              <ul className="text-xs text-brand-teal-800 space-y-1.5 list-disc list-inside">
                <li>الحوار يهدف لاستكشاف الأفكار وليس للفوز أو إثبات صحة مسبقة.</li>
                <li>استند دائماً إلى الأدلة والبيانات المتاحة في المصادر العلمية.</li>
                <li>المرشد السقراطي سيطرح عليك أسئلة فاحصة لفحص أسبابك وحججك المضادة.</li>
                <li>كن مستعداً لمراجعة موقفك وتعديل مستوى ثقتك متى ما اقتضت الأدلة.</li>
              </ul>

              <label className="flex items-center gap-3 pt-2 text-xs font-bold text-brand-navy cursor-pointer border-t border-brand-teal-200">
                <input
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={(e) => setRulesAccepted(e.target.checked)}
                  className="w-5 h-5 accent-brand-teal rounded cursor-pointer min-w-[20px]"
                />
                <span>أوافق على الالتزام بقواعد الحوار الهادف وأرغب في بدء المناظرة</span>
              </label>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full text-base font-bold shadow-md"
              isLoading={isSubmitting}
            >
              انطلق إلى ساحة الحوار 💬
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
