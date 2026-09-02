'use client';

import React, { useState } from 'react';
import { Evaluation, Message, RubricCriterion, Session } from '@/lib/db/schema';
import { Card, CardHeader } from '../shared/Card';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { Textarea } from '../shared/Textarea';
import { toast } from 'sonner';

export interface EvaluationInspectorProps {
  session: Session;
  activity: {
    id: string;
    title: string;
    topic: string;
    grade_level?: number;
    rubric_config: RubricCriterion[];
  };
  messages: Message[];
  evaluation: Evaluation | null;
}

const GRADE_LEVEL_LABELS: Record<number, string> = {
  7: 'الصف السابع',
  8: 'الصف الثامن',
  9: 'الصف التاسع',
  10: 'أول ثانوي',
  11: 'ثاني ثانوي',
  12: 'ثالث ثانوي',
};

const STAGE_LABELS: Record<string, string> = {
  baseline: 'المرحلة المبدئية',
  understanding: 'فحص الفهم',
  evidence: 'طلب الأدلة',
  source_check: 'فحص المصادر والتحيزات',
  causal_reasoning: 'الاستدلال السببي',
  counter_argument: 'الحجج المضادة',
  reflection: 'التأمل المعرفي والتركيب',
  submitted: 'مكتمل ومسلّم',
};

export function EvaluationInspector({
  session,
  activity,
  messages,
  evaluation: initialEvaluation,
}: EvaluationInspectorProps) {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(initialEvaluation);
  const [feedback, setFeedback] = useState(
    initialEvaluation?.suggested_feedback || ''
  );
  const [isApproving, setIsApproving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const isApproved = evaluation?.teacher_approved || false;
  const gradeLabel = activity.grade_level ? (GRADE_LEVEL_LABELS[activity.grade_level] || `الصف ${activity.grade_level}`) : 'غير محدد';
  const persistedHintCount = session.hint_count ?? 0;

  const handleGenerateEvaluation = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/teacher/sessions/${session.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'تعذر إنشاء التقييم التحليلي. يرجى المحاولة مرة أخرى.');
        setIsGenerating(false);
        return;
      }

      setEvaluation(data.evaluation);
      if (data.evaluation?.suggested_feedback) {
        setFeedback(data.evaluation.suggested_feedback);
      }
      toast.success('تم إنشاء التقييم التحليلي بنجاح!');
    } catch (err) {
      console.error('Generation error:', err);
      toast.error('تعذر إنشاء التقييم التحليلي. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Chronologically sorted messages (without truncation)
  const sortedMessages = [...messages].sort(
    (a, b) => a.sequence_number - b.sequence_number
  );

  const handleApprove = async (approveStatus: boolean) => {
    if (isApproving) return;
    setIsApproving(true);
    try {
      const res = await fetch(`/api/teacher/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_approved: approveStatus,
          suggested_feedback: feedback,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'تعذر تحديث حالة اعتماد التقييم. يرجى المحاولة مرة أخرى.');
        setIsApproving(false);
        return;
      }

      setEvaluation(data.evaluation);
      setShowApproveConfirm(false);
      toast.success(
        approveStatus ? 'تم اعتماد التقييم من الأستاذ بنجاح!' : 'تم إلغاء اعتماد التقييم'
      );
    } catch (err) {
      console.error('Approval error:', err);
      toast.error('تعذر تحديث حالة اعتماد التقييم. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleScrollToQuote = (messageId?: string) => {
    if (!messageId) return;
    setHighlightedMsgId(messageId);

    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setTimeout(() => {
      setHighlightedMsgId(null);
    }, 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto" dir="rtl">
      {/* 1. Session Overview Card */}
      <Card variant="bordered" className="bg-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-slate-100 pb-4 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-2xl font-black text-brand-navy">
                الطالب: {session.student_alias}
              </h2>
              <Badge variant={session.status === 'submitted' ? 'success' : 'teal'}>
                {session.status === 'submitted' ? 'مكتمل ومسلّم ✓' : 'حوار جاري'}
              </Badge>
              <Badge variant="slate" size="sm">
                المرحلة: {gradeLabel}
              </Badge>
              <Badge variant="amber" size="sm">
                التلميحات: {persistedHintCount}
              </Badge>
              {evaluation && (
                <Badge variant={isApproved ? 'success' : 'amber'} size="sm">
                  {isApproved ? 'تم اعتماد التقييم من الأستاذ 🌟' : 'بانتظار مراجعة الأستاذ ⏳'}
                </Badge>
              )}
            </div>
            <p className="text-sm text-brand-slate-500">
              النشاط: <strong className="text-brand-navy">{activity.title}</strong>
            </p>
          </div>

          <div className="text-right sm:text-left text-xs space-y-0.5 text-brand-slate-400">
            <div>
              بدء الجلسة:{' '}
              <span className="font-bold text-brand-slate-700">
                {new Date(session.created_at).toLocaleString('ar-EG')}
              </span>
            </div>
            <div>
              آخر تحديث:{' '}
              <span className="font-bold text-brand-slate-700">
                {new Date(session.updated_at).toLocaleString('ar-EG')}
              </span>
            </div>
          </div>
        </div>

        {/* Stance & Reflection Evolution Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-brand-slate-50 rounded-xl border border-brand-slate-200 space-y-2">
            <h3 className="text-xs font-bold text-brand-slate-500">
              الموقف المبدئي قبل الحوار:
            </h3>
            <p className="font-bold text-brand-navy text-sm">
              "{session.initial_stance || 'لم يحدد'}"
            </p>
            {session.initial_reason && (
              <div className="text-xs text-brand-slate-600 bg-white p-2.5 rounded-lg border border-brand-slate-100">
                <strong className="text-brand-navy block mb-0.5">المبرر الأولي:</strong>
                <p className="whitespace-pre-wrap">{session.initial_reason}</p>
              </div>
            )}
            <div className="text-xs font-semibold text-brand-teal pt-1">
              مستوى الثقة المبدئي: {session.initial_confidence ? `${session.initial_confidence} / 5` : 'غير محدد'}
            </div>
          </div>

          <div className="p-4 bg-brand-teal-50 rounded-xl border border-brand-teal-200 space-y-2">
            <h3 className="text-xs font-bold text-brand-teal-800">
              الموقف النهائي والتأمل المعرفي:
            </h3>
            <p className="font-bold text-brand-teal-950 text-sm">
              "{session.final_stance || 'لم يقدم التأمل بعد'}"
            </p>
            {session.final_reflection && (
              <div className="text-xs text-brand-teal-900 bg-white p-2.5 rounded-lg border border-brand-teal-100">
                <strong className="text-brand-teal-950 block mb-0.5">التأمل الختامي:</strong>
                <p className="whitespace-pre-wrap">{session.final_reflection}</p>
              </div>
            )}
            <div className="text-xs font-semibold text-brand-teal-800 pt-1">
              مستوى الثقة النهائي: {session.final_confidence ? `${session.final_confidence} / 5` : 'غير محدد'}
            </div>
          </div>
        </div>

        {/* Detailed Reflection Elements */}
        {session.status === 'submitted' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-brand-slate-100 text-xs">
            <div className="p-3 bg-white border border-brand-slate-200 rounded-xl">
              <span className="font-bold text-brand-navy block mb-1">أقوى دليل اعتمده:</span>
              <p className="text-brand-slate-600 leading-relaxed">{session.strongest_evidence || '—'}</p>
            </div>
            <div className="p-3 bg-white border border-brand-slate-200 rounded-xl">
              <span className="font-bold text-brand-navy block mb-1">أقوى حجة مضادة واجهها:</span>
              <p className="text-brand-slate-600 leading-relaxed">{session.strongest_counterargument || '—'}</p>
            </div>
            <div className="p-3 bg-white border border-brand-slate-200 rounded-xl">
              <span className="font-bold text-brand-navy block mb-1">ما زال غير متأكد منه:</span>
              <p className="text-brand-slate-600 leading-relaxed">{session.remaining_uncertainty || '—'}</p>
            </div>
          </div>
        )}
      </Card>

      {/* 2. Private Formative Evaluation Section */}
      {evaluation ? (
        <Card variant="bordered" className="bg-white shadow-md border-brand-teal-200">
          <CardHeader
            title="التقييم التكويني ومصفوفة الروبورك (تقييم داخلي خاص بالمعلم)"
            subtitle="تقييم تحليلي خاص بالمعلم مبني على معايير التفكير الناقد واقتباسات الحوار الحقيقية"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isApproved ? 'success' : 'amber'} size="md">
                  {isApproved ? 'تم اعتماد التقييم من الأستاذ' : 'بانتظار مراجعة الأستاذ'}
                </Badge>
                <Badge variant="teal" size="md">
                  ثقة النظام (داخلي): {(evaluation.system_confidence * 100).toFixed(0)}%
                </Badge>
              </div>
            }
          />

          {/* Rubric Scores Table */}
          <div className="overflow-x-auto my-4">
            <table className="w-full text-right text-sm border-collapse">
              <thead>
                <tr className="border-b border-brand-slate-200 bg-brand-slate-50 text-xs font-bold text-brand-slate-600">
                  <th className="p-3">معيار التفكير الناقد</th>
                  <th className="p-3">الوزن</th>
                  <th className="p-3">المستوى والدرجة</th>
                  <th className="p-3">التعليل التربوي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-slate-100">
                {evaluation.rubric_scores.map((item) => {
                  const criterion = activity.rubric_config.find((c) => c.id === item.criterion_id);
                  return (
                    <tr key={item.criterion_id} className="hover:bg-brand-slate-50 transition-colors">
                      <td className="p-3 font-bold text-brand-navy">
                        {criterion?.title || item.criterion_id}
                      </td>
                      <td className="p-3 text-xs font-semibold text-brand-slate-500">
                        {criterion?.weight || 25}%
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block font-black px-2.5 py-1 rounded-lg text-xs border ${
                            item.score >= 3
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : item.score === 2
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-red-50 text-red-800 border-red-300'
                          }`}
                        >
                          {item.score} / 4
                        </span>
                      </td>
                      <td className="p-3 text-xs text-brand-slate-600 max-w-md leading-relaxed">
                        {item.rationale}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Verified Quotes from Transcript */}
          {evaluation.verified_quotes && evaluation.verified_quotes.length > 0 && (
            <div className="my-4 p-4 bg-brand-slate-50 rounded-xl border border-brand-slate-200 space-y-3">
              <h4 className="font-bold text-sm text-brand-navy">
                📌 الاقتباسات الحرفية المحققة من كلام الطالب (انقر للانتقال للرسالة):
              </h4>
              <div className="space-y-2">
                {evaluation.verified_quotes.map((vq, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleScrollToQuote(vq.message_id)}
                    className="w-full text-right p-3 bg-white hover:bg-brand-teal-50 focus:bg-brand-teal-50 focus:ring-2 focus:ring-brand-teal rounded-lg border border-brand-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-brand-teal block">"{vq.quote}"</span>
                      <p className="text-brand-slate-500 mt-0.5">{vq.relevance}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="slate" size="sm">
                        مرحلة: {STAGE_LABELS[vq.stage] || vq.stage}
                      </Badge>
                      <span className="text-[11px] font-bold text-brand-teal underline">عرض في السجل ↵</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Strengths and Misconceptions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <h4 className="font-bold text-sm text-emerald-900">
                🌱 نقاط القوة الاستدلالية الملحوظة:
              </h4>
              <ul className="text-xs text-emerald-800 space-y-1 list-disc list-inside">
                {evaluation.strengths.map((str, idx) => (
                  <li key={idx} className="leading-relaxed">{str}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <h4 className="font-bold text-sm text-amber-900">
                ⚠️ المغالطات أو فرص التطوير المنطقي:
              </h4>
              <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                {evaluation.misconceptions.map((misc, idx) => (
                  <li key={idx} className="leading-relaxed">{misc}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Teacher Feedback & Approval Control */}
          <div className="mt-6 pt-6 border-t border-brand-slate-200 space-y-4">
            <Textarea
              label="التغذية الراجعة المقترحة للطالب (يمكنك تعديلها قبل المشاركة):"
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-brand-slate-600 block">
                  حالة الاعتماد: {isApproved ? 'تم اعتماد التقييم من الأستاذ' : 'بانتظار مراجعة الأستاذ'}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {isApproved ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => handleApprove(false)}
                    isLoading={isApproving}
                    disabled={isApproving}
                    className="text-xs text-red-600 hover:border-red-400 min-h-[40px]"
                  >
                    إلغاء الاعتماد ✕
                  </Button>
                ) : showApproveConfirm ? (
                  <div className="flex flex-wrap items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-xs font-bold text-amber-900">
                      تأكيد اعتماد التقييم؟
                    </span>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprove(true)}
                      isLoading={isApproving}
                      disabled={isApproving}
                      className="font-bold min-h-[36px]"
                    >
                      تأكيد الاعتماد ✓
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowApproveConfirm(false)}
                      disabled={isApproving}
                      className="min-h-[36px]"
                    >
                      تراجع
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => setShowApproveConfirm(true)}
                    isLoading={isApproving}
                    disabled={isApproving}
                    className="font-bold shadow-sm min-h-[40px]"
                  >
                    اعتماد التقييم ✓
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card variant="bordered" className="p-8 bg-brand-slate-50 border-dashed border-brand-slate-300 text-center space-y-4">
          <div className="w-12 h-12 bg-brand-slate-200 text-brand-slate-500 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            ℹ
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-brand-navy text-base">
              لم يُنشأ التقييم التحليلي بعد
            </h3>
            <p className="text-xs text-brand-slate-500 max-w-md mx-auto leading-relaxed">
              {session.status === 'submitted' || session.status === 'locked'
                ? 'أكمل الطالب الجلسة وقدّم تأمله المعرفي. يمكنك الآن إنشاء تقرير التقييم التحليلي وروبورك التفكير الناقد.'
                : 'الجلسة ما زالت جارية. سيكون زر إنشاء التقييم متاحاً فور إرسال الطالب للتأمل النهائي.'}
            </p>
          </div>

          {(session.status === 'submitted' || session.status === 'locked') && (
            <div>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleGenerateEvaluation}
                isLoading={isGenerating}
                disabled={isGenerating}
                className="font-bold shadow-sm min-h-[44px] px-6 text-sm"
              >
                إنشاء التقييم التحليلي 🪄
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* 3. Full Transcript Feed */}
      <Card variant="default" className="bg-white shadow-xs">
        <CardHeader
          title="سجل الحوار الكامل (Transcript)"
          subtitle={`إجمالي الرسائل المتبادلة: ${sortedMessages.length} رسائل بالترتيب الزمني`}
        />

        <ol className="space-y-4 max-h-[600px] overflow-y-auto p-4 bg-brand-slate-50 rounded-xl border border-brand-slate-200 list-none">
          {sortedMessages.map((m, idx) => {
            const isStudent = m.sender === 'student';
            const isHighlighted = highlightedMsgId === m.id || (m.client_message_id && highlightedMsgId === m.client_message_id);

            return (
              <li
                key={m.id || m.client_message_id || idx}
                id={`msg-${m.id}`}
                className={`p-4 rounded-xl text-sm transition-all duration-300 ${
                  isHighlighted
                    ? 'ring-4 ring-brand-teal shadow-md'
                    : ''
                } ${
                  isStudent
                    ? 'bg-brand-navy text-white mr-auto max-w-[88%] shadow-xs'
                    : 'bg-white text-brand-navy border border-brand-teal-100 ml-auto max-w-[88%] shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5 opacity-90 border-b border-white/10 pb-1">
                  <span className="font-black">
                    {isStudent ? `الطالب (${session.student_alias})` : 'الخبير السقراطي'}
                  </span>
                  <span className="text-[11px] font-semibold opacity-80">
                    {STAGE_LABELS[m.stage] || m.stage}
                  </span>
                </div>
                <p className="whitespace-pre-wrap leading-relaxed text-sm">{m.content}</p>
                <div className="flex items-center justify-between text-[10px] opacity-70 mt-2 pt-1 border-t border-white/10">
                  <span>جولة #{m.sequence_number}</span>
                  <span>{new Date(m.created_at).toLocaleTimeString('ar-EG')}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
