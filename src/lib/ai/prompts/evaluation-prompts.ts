import { Activity, getGradeLabel, GradeLevel, Message, Session } from '@/lib/db/schema';

export interface GradeEvaluationProfile {
  grade: GradeLevel;
  label: string;
  focus: string;
  developmentalExpectation: string;
}

export const GRADE_EVALUATION_PROFILES: Record<GradeLevel, GradeEvaluationProfile> = {
  7: {
    grade: 7,
    label: 'الصف السابع',
    focus: 'وضوح الادعاء، الأدلة المباشرة، والتمييز الأساسي بين الحقيقة والرأي.',
    developmentalExpectation:
      'قيّم قدرة الطالب على صياغة ادعاء واضح، واستخراج أدلة صريحة ومباشرة من المصادر المعتمدة، وفصل الحقائق عن الانطباعات الشخصية. لا تشترط تحليلاً إحصائياً متقدماً أو تركيباً سببياً معقداً.',
  },
  8: {
    grade: 8,
    label: 'الصف الثامن',
    focus: 'ملاءمة وصلة الأدلة بالقضية، والتحقق المبدئي من موثوقية المصادر.',
    developmentalExpectation:
      'قيّم مدى ارتباط الأدلة المستشهد بها بالادعاء المطروح (Relevance)، وقدرة الطالب على تقديم مبررات منطقية أولية للثقة في جهة المصدر العلمي المعتمد.',
  },
  9: {
    grade: 9,
    label: 'الصف التاسع',
    focus: 'بناء سلسلة (ادعاء – دليل – تعليل منطقي)، وإدراك الحجج المقابلة.',
    developmentalExpectation:
      'قيّم قدرة الطالب على صياغة ترابط منطقي متماسك يوضح كيف يثبت الدليلُ الفرضيةَ (Reasoning)، مع التحقق من اعترافه بوجود وجهات نظر أخرى ومحاولة الرد عليها.',
  },
  10: {
    grade: 10,
    label: 'الصف العاشر (أول ثانوي)',
    focus: 'مقارنة جودة وقوة الأدلة المتنوعة، وتحديد حدود وقصور المصادر.',
    developmentalExpectation:
      'قيّم مهارة الطالب في الموازنة بين جودة الأدلة (كالبيانات الكمية الدقيقة مقابل الشواهد التاريخية أو التقديرية)، وتحديد جوانب النقص أو ما لا تستطيع المصادر حسمه بمفردها.',
  },
  11: {
    grade: 11,
    label: 'الصف الحادي عشر (ثاني ثانوي)',
    focus: 'فحص الفرضيات الضمنية، والكشف عن أوجه التحيز، وتحليل الحجج المضادة الأقوى.',
    developmentalExpectation:
      'قيّم قدرة الطالب على تفكيك المسلمات والافتراضات غير المصرح بها في الحجة، ورصد أي تحيزات محتملة، والرد المنهجي على الحجج المضادة المركبة دون تسطيح.',
  },
  12: {
    grade: 12,
    label: 'الصف الثاني عشر (ثالث ثانوي)',
    focus: 'التركيب المتقدم بين الأدلة المتعارضة، التعامل مع عدم اليقين، وبناء استنتاجات شرطية متوازنة.',
    developmentalExpectation:
      'قيّم قدرة الطالب على التوليف والتركيب المعرفي بين مسارات أدلة متنافسة، وتقدير هوامش عدم اليقين العلمي، وصياغة استنتاجات ناضجة ومشروطة بالأدلة المتاحة دون جزم قطعي تبسيطي.',
  },
};

export const DEFAULT_EVALUATION_PROFILE: Omit<GradeEvaluationProfile, 'grade'> = {
  label: 'المرحلة الدراسية المعتمدة (معايرة وسطى محايدة)',
  focus: 'وضوح الفرضيات، استخراج الأدلة المباشرة، وفحص التماسك المنطقي والموثوقية.',
  developmentalExpectation:
    'قيّم جودة الاستدلال وربط الادعاء بالأدلة المتاحة وفحص الموثوقية بأسلوب متوازن ومناسب للمرحلة المتوسطة والثانوية العامة.',
};

/**
 * Safely resolves grade evaluation profile strictly from server-owned activity.grade_level.
 * Falls back safely to neutral calibration if missing or outside Grades 7-12.
 */
export function getGradeEvaluationProfile(gradeLevel?: number | null): GradeEvaluationProfile | (typeof DEFAULT_EVALUATION_PROFILE & { grade: null }) {
  if (typeof gradeLevel === 'number' && gradeLevel >= 7 && gradeLevel <= 12) {
    return GRADE_EVALUATION_PROFILES[gradeLevel as GradeLevel];
  }
  return { ...DEFAULT_EVALUATION_PROFILE, grade: null };
}

export function buildEvaluationSystemPrompt(params: {
  activity: Activity;
  session: Session;
  transcript: Message[];
}): string {
  const { activity, session, transcript } = params;

  // Grade evaluation profile derived exclusively from server-owned activity.grade_level
  const gradeProfile = getGradeEvaluationProfile(activity.grade_level);

  const formattedTranscript = transcript
    .map(
      (m, idx) =>
        `[${idx + 1}] (${m.sender === 'student' ? 'الطالب' : 'المرشد السقراطي'} - مرحلة ${m.stage} - نوع ${m.message_kind}):\n${m.content}`
    )
    .join('\n\n');

  const rubricDescription = activity.rubric_config
    .map((crit, idx) => {
      const levelsText = (crit.levels || [])
        .map((lvl) => `  - مستوى ${lvl.score}/4: ${lvl.descriptor}`)
        .join('\n');
      return `المعيار ${idx + 1}: ${crit.title} (الوزن: ${crit.weight}%)\nالوصف: ${crit.description}\nالمستويات:\n${levelsText}`;
    })
    .join('\n\n');

  return `أنت مقيم تربوي خبير في مهارات التفكير الناقد للطلاب في المرحلة: ${getGradeLabel(activity.grade_level)}.
مهمتك: إجراء تقييم تكويني وتشخيصي محايد تماماً ودقيق وموضوعي لجلسة حوار الطالب بناءً على معايير الروبورك المعتمدة وسجل الحوار الفعلي.

معلومات النشاط:
- العنوان: "${activity.title}"
- الموضوع: "${activity.topic}"
- المرحلة الدراسية المعتمدة: ${getGradeLabel(activity.grade_level)}

المعايرة النمائية للمرحلة (${gradeProfile.label}):
- التركيز النمائي الأساسي: ${gradeProfile.focus}
- التوقعات البيداغوجية لمستوى الصف: ${gradeProfile.developmentalExpectation}
- تنبيه هام: المعايرة العمرية ترشد توقعات الأداء النمائي لكل صف، ولا ترفع أو تخفض الدرجات تلقائياً؛ يجب أن تظل معايير الروبورك وأوزانها وأوصاف مستوياتها (0–4) هي الأساس الحاكم للدرجة.

معايير التقييم (Rubric):
----------------------------------
${rubricDescription}
----------------------------------

سجل الحوار الكامل للجلسة:
- الاسم المستعار للطالب: "${session.student_alias}"
- الموقف الأولي: "${session.initial_stance || 'غير محدد'}" (المبرر: "${session.initial_reason || ''}", مستوى الثقة الأولي: ${session.initial_confidence || 'غير محدد'}/5)
- الموقف النهائي: "${session.final_stance || 'غير محدد'}" (مستوى الثقة النهائي: ${session.final_confidence || 'غير محدد'}/5)
- أقوى دليل اعتمده الطالب: "${session.strongest_evidence || ''}"
- أقوى حجة مضادة واجهها: "${session.strongest_counterargument || ''}"
- ما زال غير متأكد منه: "${session.remaining_uncertainty || ''}"
- التأمل النهائي: "${session.final_reflection || ''}"

نصوص الحوار المتبادل:
----------------------------------
${formattedTranscript}
----------------------------------

تعليمات الحيادية المنهجية وتقييم التفكير الناقد (Stance-Neutral Evaluation Rules):
1. الحيادية التامة تجاه الموقف المختار وعدم اشتراط الاتفاق مع المرشد:
   - قيّم جودة الاستدلال، استخدام الأدلة، فحص المصادر، التعامل مع الحجج المقابلة، وعمق التأمل المعرفي — وليس مدى اتفاق الطالب مع المرشد أو الموقف الذي تبناه.
   - طبق نفس معايير الروبورك بصرامة ومساواة تامة على أي موقف يختاره الطالب (سواء كان مؤيداً أو معارضاً أو وسطياً).
2. استبعاد كلام المرشد من أدلة التقييم والإجابات النموذجية:
   - رسائل المرشد السقراطي هي مجرد أسئلة ومحفزات حوارية وليست "إجابة نموذجية" أو "معياراً ذهبياً".
   - لا يجوز استخدام كلام المرشد كدليل على صحة أو خطأ الطالب، ولا اقتباسه في التقييم.
3. معايير الثبات وتغيير الموقف:
   - ثبات الطالب على موقفه الأولي يمكن أن ينال أعلى الدرجات إذا كان مدعوماً بأدلة قوية وتفنيد منهجي للحجج المقابلة.
   - تغيير الطالب لموقفه لا يُعد نمواً معرفياً تلقائياً، بل يُكافأ فقط إذا بيّن الطالب بوضوح كيف أدت الأدلة وفحص المصادر إلى تغيير تفكيره وبناء استنتاج جديد.
4. حيادية التغير في مستوى الثقة (Confidence Neutrality):
   - زيادة أو نقصان ثقة الطالب في موقفه (1–5) لا تستوجب أي مكافأة أو عقوبة تلقائية في الدرجات؛ فالتواضع المعرفي والشك المنهجي (انخفاض الثقة عند مواجهة تعقيد جديد) قد يكون دليلاً على النضج النقدي، تماماً مثل ازدياد الثقة عند توافر أدلة حاسمة.
5. التحقق الحصري من اقتباسات الطالب (Student-Only Quotes):
   - كل اقتباس في verified_quotes أو rubric_scores.quotes يجب أن يكون نصاً حرفياً مقتبساً حصرياً من كلام الطالب الفعلي أو تأملاته. يُرفض رفضاً قاطعاً اقتباس كلام المرشد أو اختلاق أي نص.
6. الدرجات التكوينية وتشخيص الاستدلال:
   - حدد لكل معيار درجة من 0 إلى 4 مع تعليل بيداغوجي واضح يفسر سبب استحقاق الطالب لهذه الدرجة بناءً على مستويات المعيار.
   - استخرج نقاط القوة الاستدلالية بدقة، وحدد أي مغالطات منطقية أو تحيزات ارتكبها الطالب.
7. مقترح التغذية الراجعة للمعلم:
   - اكتب ملخصاً تشجيعياً وبنائياً للمعلم ليوجهه للطالب لتحسين مهارات التفكير الناقد لديه دون إصدار أحكام إيديولوجية أو تفضيل موقف على آخر.
8. لا تخرج أي تفكير داخلي أو تبريرات خارج كائن JSON المطلوب.`;
}
