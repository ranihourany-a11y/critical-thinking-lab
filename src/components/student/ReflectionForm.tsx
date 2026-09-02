'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '../shared/Card';
import { Input } from '../shared/Input';
import { Textarea } from '../shared/Textarea';
import { ConfidenceSlider } from '../shared/Slider';
import { Button } from '../shared/Button';
import { toast } from 'sonner';

export interface ReflectionFormProps {
  sessionId: string;
  initialStance?: string | null;
  initialConfidence?: number | null;
}

export function ReflectionForm({
  sessionId,
  initialStance,
  initialConfidence,
}: ReflectionFormProps) {
  const router = useRouter();

  const [finalStance, setFinalStance] = useState(initialStance || '');
  const [finalConfidence, setFinalConfidence] = useState(initialConfidence || 3);
  const [strongestEvidence, setStrongestEvidence] = useState('');
  const [strongestCounterargument, setStrongestCounterargument] = useState('');
  const [remainingUncertainty, setRemainingUncertainty] = useState('');
  const [finalReflection, setFinalReflection] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!finalStance.trim()) {
      setError('يرجى تحديد موقفك النهائي بعد الحوار');
      return;
    }

    if (!strongestEvidence.trim() || strongestEvidence.trim().length < 10) {
      setError('يرجى كتابة أقوى دليل اعتمدت عليه (10 أحرف على الأقل)');
      return;
    }

    if (!strongestCounterargument.trim() || strongestCounterargument.trim().length < 10) {
      setError('يرجى كتابة أقوى حجة مضادة واجهتها في الحوار');
      return;
    }

    if (!remainingUncertainty.trim() || remainingUncertainty.trim().length < 5) {
      setError('يرجى توضيح ما زلت غير متأكد منه');
      return;
    }

    if (!finalReflection.trim() || finalReflection.trim().length < 20) {
      setError('يرجى كتابة تأملك الختامي لما تعلمته (20 حرفاً على الأقل)');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/student/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          final_stance: finalStance.trim(),
          final_confidence: finalConfidence,
          strongest_evidence: strongestEvidence.trim(),
          strongest_counterargument: strongestCounterargument.trim(),
          remaining_uncertainty: remainingUncertainty.trim(),
          final_reflection: finalReflection.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || 'تعذر إرسال التأمل';
        setError(msg);
        toast.error(msg);
        setIsSubmitting(false);
        return;
      }

      toast.success('تم إرسال الحوار إلى الأستاذ بنجاح!');
      router.push(`/student/${sessionId}/submitted`);
    } catch (err) {
      console.error('Submission error:', err);
      const msg = 'حدث خطأ في الاتصال. يرجى إعادة المحاولة.';
      setError(msg);
      toast.error(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <Card variant="bordered" className="max-w-3xl mx-auto shadow-md bg-white">
      <CardHeader
        title="التأمل والتركيب الختامي (Final Reflection)"
        subtitle="بعد أن خضت الحوار السقراطي وتعرفت على الأدلة والحجج المضادة، لخص موقفك النهائي وتأملك المعرفي"
      />

      <form onSubmit={handleSubmit} className="space-y-6 mt-4">
        {initialStance && (
          <div className="p-4 bg-brand-slate-50 border border-brand-slate-200 rounded-xl text-sm">
            <span className="font-bold text-brand-navy">موقفك المبدئي السابق: </span>
            <span className="text-brand-slate-700">"{initialStance}"</span>
            {initialConfidence && (
              <span className="text-xs text-brand-teal font-semibold mr-2">
                (مستوى الثقة السابق: {initialConfidence}/5)
              </span>
            )}
          </div>
        )}

        <Input
          label="1. ما هو موقفك النهائي الآن بعد انتهاء الحوار؟"
          id="final-stance"
          placeholder="هل حافظت على موقفك أم قمت بتعديله أو تطويره؟"
          value={finalStance}
          onChange={(e) => setFinalStance(e.target.value)}
          required
        />

        <ConfidenceSlider
          label="2. حدد مستوى ثقتك في موقفك النهائي بناءً على ما فحصته من أدلة:"
          value={finalConfidence}
          onChange={setFinalConfidence}
          id="final-confidence"
        />

        <Textarea
          label="3. ما هو أقوى دليل علمي أو منطقي استندت إليه لدعم موقفك؟"
          id="strongest-evidence"
          placeholder="اذكر الدليل والمصدر المعتمد الذي اعتمدت عليه..."
          value={strongestEvidence}
          onChange={(e) => setStrongestEvidence(e.target.value)}
          rows={3}
          required
        />

        <Textarea
          label="4. ما هي أقوى حجة مضادة واجهتها خلال الحوار وكيف فكرت فيها؟"
          id="strongest-counterargument"
          placeholder="اذكر الحجة المعارضة وكيف يمكن التعامل معها بإنصاف..."
          value={strongestCounterargument}
          onChange={(e) => setStrongestCounterargument(e.target.value)}
          rows={3}
          required
        />

        <Input
          label="5. ما هي النقطة أو التساؤل الذي ما زلت غير متأكد منه تماماً وترغب في استكشافه أكثر؟"
          id="remaining-uncertainty"
          placeholder="التواضع المعرفي يعني الاعتراف بما لا نعلمه بيقين..."
          value={remainingUncertainty}
          onChange={(e) => setRemainingUncertainty(e.target.value)}
          required
        />

        <Textarea
          label="6. الخلاصة والتأمل الختامي: كيف ساعدك هذا الحوار في التفكير النقدي؟"
          id="final-reflection"
          placeholder="لخص تجربتك وما تعلمته حول فحص الأدلة والتمييز بين السببية والارتباط..."
          value={finalReflection}
          onChange={(e) => setFinalReflection(e.target.value)}
          rows={4}
          required
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
          className="w-full text-base font-bold shadow-md"
          isLoading={isSubmitting}
        >
          إرسال الحوار والتأمل إلى المعلم 📤
        </Button>
      </form>
    </Card>
  );
}
