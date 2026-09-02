'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader } from '../shared/Card';
import { Input } from '../shared/Input';
import { Textarea } from '../shared/Textarea';
import { Button } from '../shared/Button';
import { Badge } from '../shared/Badge';
import { CLIMATE_CHANGE_RUBRIC } from '@/lib/db/seed';
import { GradeLevel, GRADE_LEVEL_OPTIONS, getGradeLabel, RubricCriterion } from '@/lib/db/schema';
import { toast } from 'sonner';

export function ActivityWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 1. Basic Info
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(8);
  const [language, setLanguage] = useState('ar');

  // 2. AI Stance
  const [stanceMode, setStanceMode] = useState<'contrarian' | 'advocate' | 'adaptive'>('contrarian');
  const [aiStance, setAiStance] = useState('');

  // 3. Sources & Strict Grounding
  const [strictSource, setStrictSource] = useState(true);
  const [sources, setSources] = useState<
    { title: string; citation_label: string; source_snapshot: string; source_url?: string }[]
  >([
    {
      title: '',
      citation_label: '[المصدر 1]',
      source_snapshot: '',
      source_url: '',
    },
  ]);

  // 4. Dialogue Levels
  const [maxTurns, setMaxTurns] = useState(8);

  // 5. Rubric Configuration
  const [rubricConfig, setRubricConfig] = useState<RubricCriterion[]>(CLIMATE_CHANGE_RUBRIC);

  const totalRubricWeight = rubricConfig.reduce((acc, curr) => acc + curr.weight, 0);

  const validateCurrentStep = (): boolean => {
    const errs: Record<string, string> = {};

    if (step === 1) {
      if (!title.trim() || title.trim().length < 3) errs.title = 'عنوان النشاط مطلوب (3 أحرف على الأقل)';
      if (!topic.trim() || topic.trim().length < 3) errs.topic = 'موضوع النشاط مطلوب';
    }

    if (step === 2) {
      if (!aiStance.trim() || aiStance.trim().length < 5)
        errs.aiStance = 'موقف الذكاء الاصطناعي مطلوب لتوجيه المناظرة السقراطية';
    }

    if (step === 3) {
      if (strictSource) {
        if (sources.length === 0) {
          errs.sources = 'عند تفعيل التوثيق الصارم، يجب إضافة مصدر واحد على الأقل.';
        } else {
          const invalidSource = sources.find((s) => !s.source_snapshot || s.source_snapshot.trim().length < 30);
          if (invalidSource) {
            errs.sources = 'يجب توفير نص مرجعي معتمد لا يقل عن 30 حرفاً لكل مصدر عند تفعيل التوثيق الصارم.';
          }
        }
      }
    }

    if (step === 5) {
      if (totalRubricWeight !== 100) {
        errs.rubric = `مجموع أوزان المعايير الحالية هو ${totalRubricWeight}%. يجب أن يساوي 100%.`;
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setStep((prev) => Math.min(prev + 1, 6));
    }
  };

  const handlePrev = () => {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleAddSource = () => {
    setSources((prev) => [
      ...prev,
      {
        title: '',
        citation_label: `[المصدر ${prev.length + 1}]`,
        source_snapshot: '',
        source_url: '',
      },
    ]);
  };

  const handleRemoveSource = (index: number) => {
    setSources((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (publishStatus: 'active' | 'draft') => {
    if (!validateCurrentStep()) return;

    setIsLoading(true);

    try {
      const payload = {
        title: title.trim(),
        topic: topic.trim(),
        grade_level: gradeLevel,
        language,
        stance_mode: stanceMode,
        ai_stance: aiStance.trim(),
        strict_source: strictSource,
        max_turns: maxTurns,
        rubric_config: rubricConfig,
        sources: sources
          .filter((s) => s.title.trim() && s.source_snapshot.trim())
          .map((s) => ({
            title: s.title.trim(),
            source_type: 'text' as const,
            source_snapshot: s.source_snapshot.trim(),
            source_url: s.source_url?.trim() || null,
            citation_label: s.citation_label.trim() || '[مصدر]',
          })),
        status: publishStatus,
      };

      const res = await fetch('/api/teacher/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || 'حدث خطأ أثناء حفظ النشاط';
        toast.error(msg);
        setIsLoading(false);
        return;
      }

      toast.success(
        publishStatus === 'active'
          ? `تم إنشاء وتنشيط النشاط بنجاح! رمز النشاط: ${data.activity.access_code}`
          : 'تم حفظ مسودة النشاط بنجاح!'
      );
      router.push(`/teacher/activities/${data.activity.id}`);
    } catch (err) {
      console.error('Error submitting activity:', err);
      toast.error('حدث خطأ في الاتصال بالخادم.');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step Indicators */}
      <div className="bg-white p-4 rounded-2xl border border-brand-slate-200 shadow-xs">
        <div className="flex items-center justify-between overflow-x-auto gap-2">
          {[
            { num: 1, label: 'المعلومات الأساسية' },
            { num: 2, label: 'موقف الذكاء الاصطناعي' },
            { num: 3, label: 'المصادر والتوثيق' },
            { num: 4, label: 'مستويات الحوار' },
            { num: 5, label: 'معايير التقييم (Rubric)' },
            { num: 6, label: 'المراجعة والتفعيل' },
          ].map((st) => (
            <button
              type="button"
              key={st.num}
              onClick={() => {
                if (st.num < step) setStep(st.num);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap min-h-[44px] ${
                step === st.num
                  ? 'bg-brand-teal text-white shadow-sm'
                  : step > st.num
                  ? 'bg-brand-slate-100 text-brand-navy hover:bg-brand-slate-200'
                  : 'text-brand-slate-400 opacity-60'
              }`}
            >
              <span>{st.num}</span>
              <span>{st.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Card variant="bordered" className="bg-white shadow-md">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <CardHeader
              title="الخطوة 1: المعلومات الأساسية للنشاط"
              subtitle="حدد عنوان القضية وموضوع التفكير الناقد والمرحلة الدراسية"
            />
            <Input
              label="عنوان النشاط (السؤال المحوري):"
              placeholder="مثال: هل يساهم النشاط البشري في زيادة الاحتباس الحراري؟"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
              required
            />
            <Input
              label="موضوع القضية وسياقها:"
              placeholder="مثال: التغير المناخي والأنشطة البشرية مقابل العوامل الطبيعية"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              error={errors.topic}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="grade-level-select" className="block text-sm font-semibold text-brand-navy mb-1.5">
                  المرحلة الدراسية المستهدفة:
                </label>
                <select
                  id="grade-level-select"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(parseInt(e.target.value, 10) as GradeLevel)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-slate-300 bg-white text-base min-h-[44px] font-semibold text-brand-navy focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                >
                  {GRADE_LEVEL_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-brand-navy mb-1.5">
                  لغة الحوار:
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-brand-slate-300 bg-white text-base min-h-[44px]"
                >
                  <option value="ar">اللغة العربية الفصحى (افتراضي)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: AI Stance Mode */}
        {step === 2 && (
          <div className="space-y-4">
            <CardHeader
              title="الخطوة 2: تهيئة موقف ونمط الذكاء الاصطناعي"
              subtitle="حدد كيف سيتفاعل المرشد السقراطي لمناظرة وتحدي تفكير الطلاب"
            />
            <div>
              <label className="block text-sm font-semibold text-brand-navy mb-2">
                نمط التفاعل البيداغوجي:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'contrarian',
                    title: 'تحدي معاكس (Contrarian)',
                    desc: 'يتبنى الرأي المعاكس لموقف الطالب لدفع التفكير العميق',
                  },
                  {
                    id: 'advocate',
                    title: 'منافح بالأدلة (Advocate)',
                    desc: 'يدافع عن موقف علمي محدد بالأدلة والوثائق',
                  },
                  {
                    id: 'adaptive',
                    title: 'سقراطي متكيف (Adaptive)',
                    desc: 'يتكيف مع قوة حجة الطالب ويختبر الثغرات المنطقية',
                  },
                ].map((mode) => (
                  <button
                    type="button"
                    key={mode.id}
                    onClick={() => setStanceMode(mode.id as any)}
                    className={`p-3 rounded-xl border text-right transition-all min-h-[64px] ${
                      stanceMode === mode.id
                        ? 'bg-brand-teal-50 border-brand-teal ring-1 ring-brand-teal'
                        : 'bg-white border-brand-slate-200 hover:bg-brand-slate-50'
                    }`}
                  >
                    <div className="font-bold text-sm text-brand-navy">{mode.title}</div>
                    <div className="text-xs text-brand-slate-500 mt-1">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              label="موقف الذكاء الاصطناعي المحدد في المناظرة:"
              placeholder="مثال: يطرح الذكاء الاصطناعي وجهة النظر القائلة بأن تغير المناخ ناتج عن دورات طبيعية لحث الطالب على إثبات العكس بالأدلة..."
              value={aiStance}
              onChange={(e) => setAiStance(e.target.value)}
              rows={3}
              error={errors.aiStance}
              required
            />
          </div>
        )}

        {/* Step 3: Sources & Strict Grounding */}
        {step === 3 && (
          <div className="space-y-4">
            <CardHeader
              title="الخطوة 3: المصادر العلمية المعتمدة والتوثيق الصارم"
              subtitle="أضف مقتطفات النصوص الموثقة التي يعتمد عليها الذكاء الاصطناعي حصراً في الردود"
            />

            <div className="p-4 bg-brand-slate-50 rounded-xl border border-brand-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-brand-navy">
                  تفعيل التوثيق الصارم للمصادر (Strict Source Grounding)
                </div>
                <div className="text-xs text-brand-slate-500 mt-0.5">
                  يمنع الذكاء الاصطناعي من اختلاق أي بيانات أو حقائق خارج النصوص المعتمدة أدناه
                </div>
              </div>
              <input
                type="checkbox"
                checked={strictSource}
                onChange={(e) => setStrictSource(e.target.checked)}
                className="w-5 h-5 accent-brand-teal cursor-pointer"
              />
            </div>

            {errors.sources && (
              <p className="text-sm font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg">
                {errors.sources}
              </p>
            )}

            <div className="space-y-4">
              {sources.map((src, idx) => (
                <div
                  key={idx}
                  className="p-4 border border-brand-slate-200 rounded-xl bg-white space-y-3 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-teal">المصدر رقم {idx + 1}</span>
                    {sources.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSource(idx)}
                        className="text-xs text-red-600 hover:underline cursor-pointer"
                      >
                        حذف المصدر
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <Input
                        label="عنوان المصدر أو الجهة:"
                        placeholder="مثال: تقرير الهيئة الحكومية الدولية (IPCC)"
                        value={src.title}
                        onChange={(e) => {
                          const updated = [...sources];
                          updated[idx].title = e.target.value;
                          setSources(updated);
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        label="رمز التوثيق في الحوار:"
                        placeholder="مثال: [تقرير IPCC]"
                        value={src.citation_label}
                        onChange={(e) => {
                          const updated = [...sources];
                          updated[idx].citation_label = e.target.value;
                          setSources(updated);
                        }}
                      />
                    </div>
                  </div>

                  <Textarea
                    label="نص المصدر المعتمد (Source Snapshot Text):"
                    placeholder="الصق المقتطف العلمي أو البيانات المحققة هنا..."
                    rows={4}
                    value={src.source_snapshot}
                    onChange={(e) => {
                      const updated = [...sources];
                      updated[idx].source_snapshot = e.target.value;
                      setSources(updated);
                    }}
                  />

                  <Input
                    label="رابط المصدر كمرجع إضافي (اختياري):"
                    placeholder="https://..."
                    value={src.source_url || ''}
                    onChange={(e) => {
                      const updated = [...sources];
                      updated[idx].source_url = e.target.value;
                      setSources(updated);
                    }}
                  />
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSource}
                className="w-full text-xs font-bold"
              >
                + إضافة مصدر علمي آخر
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Dialogue Levels */}
        {step === 4 && (
          <div className="space-y-4">
            <CardHeader
              title="الخطوة 4: مراحل الحوار والحدود الزمنية"
              subtitle="ضبط عدد جولات الحوار القصوى وآلية التدرج السقراطي"
            />
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-navy">
                الحد الأقصى لجولات حوار الطالب (Max Turns):
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={4}
                  max={16}
                  step={1}
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(parseInt(e.target.value, 10))}
                  className="flex-1 accent-brand-teal"
                />
                <span className="font-extrabold text-brand-navy px-3 py-1 bg-brand-slate-100 rounded-lg border">
                  {maxTurns} جولات
                </span>
              </div>
              <p className="text-xs text-brand-slate-500">
                الموصى به لطلاب الصفوف 7–9 هو 8 جولات لضمان استيعاب المراحل البيداغوجية السبع دون إرهاق.
              </p>
            </div>

            <div className="p-4 bg-brand-teal-50 border border-brand-teal-200 rounded-xl space-y-2 mt-4">
              <div className="font-bold text-sm text-brand-teal-900">
                المسار البيداغوجي الإلزامي:
              </div>
              <div className="text-xs text-brand-teal-800 leading-relaxed">
                استكشاف الموقف المبدئي ➔ فحص المفاهيم ➔ المطالبة بالأدلة ➔ موثوقية المصادر ➔ التحليل السببي ➔ مواجهة الرأي المخالف ➔ التأمل والتركيب الختامي.
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Rubric Criteria & Weights */}
        {step === 5 && (
          <div className="space-y-4">
            <CardHeader
              title="الخطوة 5: مصفوفة معايير التقييم (Rubric Configuration)"
              subtitle="مراجعة وتعديل معايير التفكير الناقد وأوزانها النسبية (يجب أن يساوي المجموع 100%)"
            />

            <div className="flex items-center justify-between p-3 bg-brand-slate-100 rounded-xl border">
              <span className="text-sm font-bold text-brand-navy">مجموع الأوزان الحالية:</span>
              <span
                className={`text-base font-extrabold px-3 py-0.5 rounded-lg border ${
                  totalRubricWeight === 100
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-red-50 text-red-800 border-red-300'
                }`}
              >
                {totalRubricWeight}% / 100%
              </span>
            </div>

            {errors.rubric && (
              <p className="text-sm font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg">
                {errors.rubric}
              </p>
            )}

            <div className="space-y-3">
              {rubricConfig.map((crit, idx) => (
                <div key={crit.id} className="p-4 border border-brand-slate-200 rounded-xl bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-brand-navy">
                      {idx + 1}. {crit.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-brand-slate-500 font-semibold">الوزن %:</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={crit.weight}
                        onChange={(e) => {
                          const updated = [...rubricConfig];
                          updated[idx].weight = parseInt(e.target.value, 10) || 0;
                          setRubricConfig(updated);
                        }}
                        className="w-18 px-2 py-1 border rounded-md text-center text-sm font-bold"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-brand-slate-600">{crit.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 6: Review and Activate */}
        {step === 6 && (
          <div className="space-y-4">
            <CardHeader
              title="الخطوة 6: مراجعة وتفعيل النشاط"
              subtitle="تأكد من اكتمال كافة الإعدادات قبل إتاحة النشاط للطلاب"
            />

            <div className="p-4 bg-brand-slate-50 border border-brand-slate-200 rounded-xl space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-brand-slate-500">العنوان: </span>
                  <span className="font-bold text-brand-navy">{title}</span>
                </div>
                <div>
                  <span className="text-brand-slate-500">المرحلة: </span>
                  <span className="font-bold text-brand-navy">{getGradeLabel(gradeLevel)}</span>
                </div>
                <div>
                  <span className="text-brand-slate-500">موقف الذكاء الاصطناعي: </span>
                  <span className="font-semibold text-brand-navy">{aiStance}</span>
                </div>
                <div>
                  <span className="text-brand-slate-500">التوثيق الصارم: </span>
                  <Badge variant={strictSource ? 'teal' : 'slate'} size="sm">
                    {strictSource ? 'مفعّل بالأدلة' : 'غير مفعّل'}
                  </Badge>
                </div>
                <div>
                  <span className="text-brand-slate-500">عدد المصادر: </span>
                  <span className="font-bold text-brand-navy">{sources.length} مصادر</span>
                </div>
                <div>
                  <span className="text-brand-slate-500">جولات الحوار: </span>
                  <span className="font-bold text-brand-navy">{maxTurns} جولات</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => handleSubmit('active')}
                className="flex-1 font-bold shadow-md"
                isLoading={isLoading}
              >
                تنشيط وإطلاق النشاط للطلاب 🚀
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => handleSubmit('draft')}
                className="font-semibold"
                disabled={isLoading}
              >
                حفظ كمسودة غير نشطة 📁
              </Button>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-brand-slate-200 mt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={handlePrev}
            disabled={step === 1 || isLoading}
            className="text-sm font-semibold"
          >
            ← الخطوة السابقة
          </Button>

          {step < 6 && (
            <Button
              type="button"
              variant="primary"
              onClick={handleNext}
              className="text-sm font-bold shadow-sm"
            >
              الخطوة التالية →
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
