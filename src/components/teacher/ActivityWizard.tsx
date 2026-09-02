'use client';

import React, { useState, useRef } from 'react';
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

  const totalRubricWeight = rubricConfig.reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);

  // Focus helper
  const focusField = (fieldId: string) => {
    setTimeout(() => {
      if (typeof document !== 'undefined') {
        const el = document.getElementById(fieldId);
        if (el) {
          el.focus();
          if (typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }, 50);
  };

  const validateForActivation = (): { valid: boolean; errs: Record<string, string>; firstInvalidStep: number; firstInvalidFieldId: string } => {
    const errs: Record<string, string> = {};
    let firstInvalidStep = 0;
    let firstInvalidFieldId = '';

    const registerError = (stepNum: number, fieldKey: string, fieldId: string, message: string) => {
      errs[fieldKey] = message;
      if (!firstInvalidStep || stepNum < firstInvalidStep) {
        firstInvalidStep = stepNum;
        firstInvalidFieldId = fieldId;
      }
    };

    // Step 1 check
    if (!title.trim() || title.trim().length < 3) {
      registerError(1, 'title', 'activity-title', 'عنوان النشاط مطلوب (3 أحرف على الأقل)');
    }
    if (!topic.trim() || topic.trim().length < 3) {
      registerError(1, 'topic', 'activity-topic', 'موضوع النشاط مطلوب (3 أحرف على الأقل)');
    }

    // Step 2 check
    if (!aiStance.trim() || aiStance.trim().length < 5) {
      registerError(2, 'aiStance', 'ai-stance-input', 'موقف الذكاء الاصطناعي مطلوب لتوجيه المناظرة السقراطية');
    }

    // Step 3 check
    if (strictSource) {
      const usableSources = sources.filter((s) => s.source_snapshot && s.source_snapshot.trim().length > 0);
      const urlOnlySources = sources.filter(
        (s) => (!s.source_snapshot || s.source_snapshot.trim().length === 0) && s.source_url && s.source_url.trim().length > 0
      );

      if (usableSources.length === 0) {
        const errorMsg =
          urlOnlySources.length > 0
            ? 'الروابط وحدها لا تكفي لتقييد الخبير. أضف نص المصدر.'
            : 'عند تفعيل التوثيق الصارم، يجب توفير نص مرجعي معتمد واحد على الأقل.';
        registerError(3, 'sources', 'source-snapshot-0', errorMsg);
      }
    }

    // Step 5 check
    if (totalRubricWeight !== 100) {
      registerError(5, 'rubric', 'rubric-weight-0', `مجموع أوزان المعايير الحالية هو ${totalRubricWeight}%. يجب أن يساوي 100%.`);
    }

    return {
      valid: Object.keys(errs).length === 0,
      errs,
      firstInvalidStep,
      firstInvalidFieldId,
    };
  };

  const handleNext = () => {
    setErrors({});
    setStep((prev) => Math.min(prev + 1, 6));
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
    if (isLoading) return;

    // Activation requires strict validation
    if (publishStatus === 'active') {
      const activationCheck = validateForActivation();
      if (!activationCheck.valid) {
        setErrors(activationCheck.errs);
        setStep(activationCheck.firstInvalidStep);
        focusField(activationCheck.firstInvalidFieldId);
        toast.error('يرجى تصحيح الحقول المطلوبة قبل تفعيل النشاط');
        return;
      }
    }

    setIsLoading(true);
    setErrors({});

    try {
      const payload = {
        title: title.trim() || (publishStatus === 'draft' ? 'مسودة نشاط جديد' : ''),
        topic: topic.trim(),
        grade_level: gradeLevel,
        language,
        stance_mode: stanceMode,
        ai_stance: aiStance.trim(),
        strict_source: strictSource,
        max_turns: maxTurns,
        rubric_config: rubricConfig,
        sources: sources
          .filter((s) => s.title.trim() || s.source_snapshot.trim() || s.source_url?.trim())
          .map((s, idx) => ({
            title: s.title.trim() || `مصدر ${idx + 1}`,
            source_type: 'text' as const,
            source_snapshot: s.source_snapshot.trim(),
            source_url: s.source_url?.trim() || null,
            citation_label: s.citation_label.trim() || `[المصدر ${idx + 1}]`,
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
        if (data.details) {
          const fieldErrs: Record<string, string> = {};
          let earliestStep = 6;
          let firstFieldId = '';

          for (const [key, msgs] of Object.entries(data.details as Record<string, string[]>)) {
            const msg = Array.isArray(msgs) ? msgs[0] : String(msgs);
            fieldErrs[key] = msg;

            if (key.includes('title') || key.includes('topic') || key.includes('grade_level')) {
              if (earliestStep > 1) {
                earliestStep = 1;
                firstFieldId = key.includes('title') ? 'activity-title' : 'activity-topic';
              }
            } else if (key.includes('ai_stance') || key.includes('stance_mode')) {
              if (earliestStep > 2) {
                earliestStep = 2;
                firstFieldId = 'ai-stance-input';
              }
            } else if (key.includes('sources')) {
              if (earliestStep > 3) {
                earliestStep = 3;
                firstFieldId = 'source-snapshot-0';
              }
            } else if (key.includes('rubric')) {
              if (earliestStep > 5) {
                earliestStep = 5;
                firstFieldId = 'rubric-weight-0';
              }
            }
          }

          setErrors(fieldErrs);
          if (earliestStep < 6) {
            setStep(earliestStep);
            if (firstFieldId) focusField(firstFieldId);
          }
        }

        const msg = data.message || data.error || 'حدث خطأ أثناء حفظ النشاط';
        toast.error(msg);
        setIsLoading(false);
        return;
      }

      toast.success(
        publishStatus === 'active'
          ? `تم تفعيل النشاط بنجاح! رمز النشاط: ${data.activity.access_code}`
          : 'تم حفظ النشاط كمسودة بنجاح'
      );
      router.push(`/teacher/activities/${data.activity.id}`);
    } catch (err) {
      console.error('Error submitting activity:', err);
      toast.error('حدث خطأ في الاتصال بالخادم.');
      setIsLoading(false);
    }
  };

  // Readiness checklist calculations for Step 6
  const hasValidTitleAndTopic = title.trim().length >= 3 && topic.trim().length >= 3;
  const hasValidAiStance = aiStance.trim().length >= 5;
  const hasUsableSourceText =
    !strictSource || sources.some((s) => s.source_snapshot && s.source_snapshot.trim().length > 0);
  const hasUrlOnlySources =
    strictSource &&
    !hasUsableSourceText &&
    sources.some((s) => s.source_url && s.source_url.trim().length > 0);
  const isRubric100 = totalRubricWeight === 100;
  const isFullyReadyForActivation =
    hasValidTitleAndTopic && hasValidAiStance && hasUsableSourceText && isRubric100;

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
                setErrors({});
                setStep(st.num);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap min-h-[44px] ${
                step === st.num
                  ? 'bg-brand-teal text-white shadow-sm'
                  : 'bg-brand-slate-100 text-brand-navy hover:bg-brand-slate-200'
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
              id="activity-title"
              label="عنوان النشاط (السؤال المحوري):"
              placeholder="مثال: هل يساهم النشاط البشري في زيادة الاحتباس الحراري؟"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
              required
            />
            <Input
              id="activity-topic"
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
                <label htmlFor="language-select" className="block text-sm font-semibold text-brand-navy mb-1.5">
                  لغة الحوار:
                </label>
                <select
                  id="language-select"
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
              id="ai-stance-input"
              label="موقف الذكاء الاصطناعي المحدد في المناظرة:"
              placeholder="مثال: يطرح الذكاء الاصطناعي وجهة النظر القائلة بأن تغير المناخ ناتج عن دورات طبيعية لحث الطالب على إثبات العكس بالأدلة..."
              value={aiStance}
              onChange={(e) => setAiStance(e.target.value)}
              rows={3}
              error={errors.aiStance || errors.ai_stance}
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
                id="strict-source-toggle"
                type="checkbox"
                checked={strictSource}
                onChange={(e) => setStrictSource(e.target.checked)}
                className="w-5 h-5 accent-brand-teal cursor-pointer"
              />
            </div>

            {errors.sources && (
              <p
                role="alert"
                aria-live="assertive"
                className="text-sm font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200"
              >
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
                        id={`source-title-${idx}`}
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
                        id={`source-citation-${idx}`}
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
                    id={`source-snapshot-${idx}`}
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
                    id={`source-url-${idx}`}
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
              <label htmlFor="max-turns-slider" className="block text-sm font-semibold text-brand-navy">
                الحد الأقصى لجولات حوار الطالب (Max Turns):
              </label>
              <div className="flex items-center gap-4">
                <input
                  id="max-turns-slider"
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

            <div
              role="status"
              aria-live="polite"
              className={`flex items-center justify-between p-3 rounded-xl border ${
                totalRubricWeight === 100
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-red-50 text-red-800 border-red-300'
              }`}
            >
              <span className="text-sm font-bold">حالة مجموع أوزان المعايير:</span>
              <span className="text-base font-extrabold px-3 py-0.5 rounded-lg border">
                المجموع: {totalRubricWeight} من 100
              </span>
            </div>

            {errors.rubric && (
              <p
                role="alert"
                aria-live="assertive"
                className="text-sm font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200"
              >
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
                      <label htmlFor={`rubric-weight-${idx}`} className="text-xs text-brand-slate-500 font-semibold">
                        الوزن %:
                      </label>
                      <input
                        id={`rubric-weight-${idx}`}
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
          <div className="space-y-5">
            <CardHeader
              title="الخطوة 6: مراجعة الجاهزية والتفعيل"
              subtitle="راجع اكتمال متطلبات التفعيل، أو احفظ النشاط كمسودة للعودة إليها لاحقاً"
            />

            {/* Readiness Summary Checklist */}
            <div
              aria-label="ملخص جاهزية التفعيل"
              className="p-4 bg-brand-slate-50 border border-brand-slate-200 rounded-xl space-y-3"
            >
              <h4 className="text-sm font-bold text-brand-navy mb-2">ملخص جاهزية النشاط للتفعيل:</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border">
                  <span className="text-brand-slate-600">العنوان والموضوع:</span>
                  <Badge variant={hasValidTitleAndTopic ? 'teal' : 'amber'} size="sm">
                    {hasValidTitleAndTopic ? 'مكتمل ✓' : 'غير مكتمل ✗'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border">
                  <span className="text-brand-slate-600">المرحلة الدراسية:</span>
                  <Badge variant="teal" size="sm">
                    {getGradeLabel(gradeLevel)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border">
                  <span className="text-brand-slate-600">موقف ونمط الذكاء الاصطناعي:</span>
                  <Badge variant={hasValidAiStance ? 'teal' : 'amber'} size="sm">
                    {hasValidAiStance ? 'مكتمل ✓' : 'غير مكتمل ✗'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border">
                  <span className="text-brand-slate-600">نصوص المصادر والتوثيق:</span>
                  <Badge variant={hasUsableSourceText ? 'teal' : 'amber'} size="sm">
                    {hasUsableSourceText ? 'موثق بنصوص ✓' : 'بحاجة لنص ✗'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border sm:col-span-2">
                  <span className="text-brand-slate-600">مجموع أوزان المعايير (Rubric):</span>
                  <div className="flex items-center gap-2">
                    <span
                      role="status"
                      aria-live="polite"
                      className="font-bold text-xs"
                    >
                      المجموع: {totalRubricWeight} من 100
                    </span>
                    <Badge variant={isRubric100 ? 'teal' : 'amber'} size="sm">
                      {isRubric100 ? '100% مكتمل ✓' : 'غير مكتمل ✗'}
                    </Badge>
                  </div>
                </div>
              </div>

              {hasUrlOnlySources && (
                <p
                  role="alert"
                  aria-live="polite"
                  className="text-xs font-semibold text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200"
                >
                  الروابط وحدها لا تكفي لتقييد الخبير. أضف نص المصدر.
                </p>
              )}
            </div>

            {/* Final Action Controls */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => handleSubmit('active')}
                className="flex-1 font-bold shadow-md"
                isLoading={isLoading}
                disabled={isLoading}
              >
                تفعيل النشاط 🚀
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => handleSubmit('draft')}
                className="font-semibold"
                disabled={isLoading}
              >
                حفظ كمسودة 📁
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
