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
    rubric_config: RubricCriterion[];
  };
  messages: Message[];
  evaluation: Evaluation | null;
}

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

  const isApproved = evaluation?.teacher_approved || false;

  const handleApprove = async (approveStatus: boolean) => {
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
        toast.error(data.error || 'تعذر حفظ الاعتماد');
        setIsApproving(false);
        return;
      }

      setEvaluation(data.evaluation);
      toast.success(
        approveStatus ? 'تم اعتماد التقييم التربوي بنجاح!' : 'تم إلغاء اعتماد التقييم'
      );
    } catch (err) {
      console.error('Approval error:', err);
      toast.error('حدث خطأ في الاتصال بالخادم');
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Session Overview Card */}
      <Card variant="bordered" className="bg-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-slate-100 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-black text-brand-navy">
                طالب: {session.student_alias}
              </h2>
              <Badge variant={session.status === 'submitted' ? 'success' : 'teal'}>
                {session.status === 'submitted' ? 'مكتمل ومسلّم ✓' : 'حوار جاري'}
              </Badge>
              {isApproved && (
                <Badge variant="amber" size="sm">
                  معتمد من المعلم 🌟
                </Badge>
              )}
            </div>
            <p className="text-sm text-brand-slate-500">
              النشاط: <strong className="text-brand-navy">{activity.title}</strong>
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-brand-slate-400 block">تاريخ البدء:</span>
            <span className="text-xs font-bold text-brand-slate-700">
              {new Date(session.created_at).toLocaleString('ar-EG')}
            </span>
          </div>
        </div>

        {/* Position Evolution Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-brand-slate-50 rounded-xl border border-brand-slate-200">
            <div className="text-xs font-bold text-brand-slate-500 mb-1">
              الموقف المبدئي قبل الحوار:
            </div>
            <p className="font-bold text-brand-navy text-sm">
              "{session.initial_stance || 'لم يحدد'}"
            </p>
            {session.initial_reason && (
              <p className="text-xs text-brand-slate-600 mt-2 bg-white p-2 rounded-lg border border-brand-slate-100">
                <strong>المبرر: </strong> {session.initial_reason}
              </p>
            )}
            <div className="mt-3 text-xs font-semibold text-brand-teal">
              مستوى الثقة الأولي: {session.initial_confidence || '-'}/5
            </div>
          </div>

          <div className="p-4 bg-brand-teal-50 rounded-xl border border-brand-teal-200">
            <div className="text-xs font-bold text-brand-teal-800 mb-1">
              الموقف النهائي بعد الحوار السقراطي:
            </div>
            <p className="font-bold text-brand-teal-950 text-sm">
              "{session.final_stance || 'لم يقدم التأمل بعد'}"
            </p>
            {session.final_reflection && (
              <p className="text-xs text-brand-teal-900 mt-2 bg-white p-2 rounded-lg border border-brand-teal-100">
                <strong>التأمل: </strong> {session.final_reflection}
              </p>
            )}
            <div className="mt-3 text-xs font-semibold text-brand-teal-800">
              مستوى الثقة النهائي: {session.final_confidence || '-'}/5
            </div>
          </div>
        </div>

        {/* Detailed Reflection Insights */}
        {session.status === 'submitted' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-brand-slate-100 text-xs">
            <div className="p-3 bg-white border border-brand-slate-200 rounded-xl">
              <span className="font-bold text-brand-navy block mb-1">أقوى دليل اعتمده:</span>
              <p className="text-brand-slate-600">{session.strongest_evidence || '-'}</p>
            </div>
            <div className="p-3 bg-white border border-brand-slate-200 rounded-xl">
              <span className="font-bold text-brand-navy block mb-1">أقوى حجة مضادة واجهها:</span>
              <p className="text-brand-slate-600">{session.strongest_counterargument || '-'}</p>
            </div>
            <div className="p-3 bg-white border border-brand-slate-200 rounded-xl">
              <span className="font-bold text-brand-navy block mb-1">ما زال غير متأكد منه:</span>
              <p className="text-brand-slate-600">{session.remaining_uncertainty || '-'}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Formative Evaluation & Rubric Card */}
      {evaluation ? (
        <Card variant="bordered" className="bg-white shadow-md border-brand-teal-200">
          <CardHeader
            title="التقييم التكويني ومصفوفة الروبورك (Formative Evaluation)"
            subtitle="تقييم تشخيصي خاص بالمعلم مبني على معايير التفكير الناقد واقتباسات الحوار الحقيقية"
            action={
              <Badge variant="teal" size="md">
                درجة ثقة التقييم: {(evaluation.system_confidence * 100).toFixed(0)}%
              </Badge>
            }
          />

          {/* Rubric Scores Table */}
          <div className="overflow-x-auto my-4">
            <table className="w-full text-right text-sm">
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
                    <tr key={item.criterion_id} className="hover:bg-brand-slate-50">
                      <td className="p-3 font-bold text-brand-navy">
                        {criterion?.title || item.criterion_id}
                      </td>
                      <td className="p-3 text-xs font-semibold text-brand-slate-500">
                        {criterion?.weight || 25}%
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-black px-2.5 py-1 rounded-lg text-xs border ${
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
                      <td className="p-3 text-xs text-brand-slate-600 max-w-md">
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
                📌 الاقتباسات الحرفية المحققة من كلام الطالب (Verified Quotes):
              </h4>
              <div className="space-y-2">
                {evaluation.verified_quotes.map((vq, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-lg border border-brand-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-brand-teal">"{vq.quote}"</span>
                      <p className="text-brand-slate-500 mt-0.5">{vq.relevance}</p>
                    </div>
                    <Badge variant="slate" size="sm">
                      مرحلة: {vq.stage}
                    </Badge>
                  </div>
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
                  <li key={idx}>{str}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <h4 className="font-bold text-sm text-amber-900">
                ⚠️ المغالطات أو فرص التطوير المنطقي:
              </h4>
              <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                {evaluation.misconceptions.map((misc, idx) => (
                  <li key={idx}>{misc}</li>
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

            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-xs text-brand-slate-500 block">
                  الحالة: {isApproved ? 'معتمد رسمي من المعلم' : 'مسودة تقييم تكويني'}
                </span>
              </div>

              <div className="flex gap-2">
                {isApproved ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => handleApprove(false)}
                    isLoading={isApproving}
                    className="text-xs text-red-600 hover:border-red-400"
                  >
                    إلغاء الاعتماد ✕
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => handleApprove(true)}
                    isLoading={isApproving}
                    className="font-bold shadow-sm"
                  >
                    اعتماد التقييم ومشاركته مع الطالب ✓
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div className="p-6 bg-brand-slate-50 border border-dashed border-brand-slate-300 rounded-2xl text-center">
          <p className="font-bold text-brand-navy text-base mb-1">
            التقييم التكويني غير متاح حالياً
          </p>
          <p className="text-xs text-brand-slate-500">
            سيتم إنشاء التقييم آلياً بمجرد إرسال الطالب لتأمله النهائي وإكمال الحوار.
          </p>
        </div>
      )}

      {/* Full Transcript Feed */}
      <Card variant="default" className="bg-white shadow-xs">
        <CardHeader
          title="سجل الحوار الكامل (Transcript)"
          subtitle={`إجمالي الرسائل المتبادلة: ${messages.length} رسائل`}
        />

        <div className="space-y-4 max-h-[500px] overflow-y-auto p-4 bg-brand-slate-50 rounded-xl border border-brand-slate-200">
          {messages.map((m, idx) => {
            const isStudent = m.sender === 'student';
            return (
              <div
                key={m.id || idx}
                className={`p-3 rounded-xl text-sm ${
                  isStudent
                    ? 'bg-brand-navy text-white mr-auto max-w-[85%]'
                    : 'bg-white text-brand-navy border border-brand-teal-100 ml-auto max-w-[85%]'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1 opacity-80">
                  <span className="font-bold">
                    {isStudent ? `الطالب (${session.student_alias})` : 'المرشد السقراطي'}
                  </span>
                  <span>مرحلة: {m.stage}</span>
                </div>
                <p className="whitespace-pre-wrap">{m.content}</p>
                <div className="text-[10px] opacity-60 mt-1 text-left">
                  {new Date(m.created_at).toLocaleTimeString('ar-EG')}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
