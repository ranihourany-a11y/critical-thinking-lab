import 'server-only';

import { Activity, ActivitySource, PedagogicalStage, RubricCriterion } from './schema';
import { DEV_DEFAULT_TEACHER } from '@/lib/auth/teacher-fixture';

export const CLIMATE_FIVE_STAGES: PedagogicalStage[] = [
  'understanding',
  'evidence',
  'source_check',
  'counter_argument',
  'reflection',
];

export const CLIMATE_CHANGE_RUBRIC: RubricCriterion[] = [
  {
    id: 'crit-claim-clarity',
    title: 'وضوح الادعاء وتحديد الموقف (Claim Clarity)',
    description: 'تحديد ادعاء صريح وواضح وفصل الرأي الشخصي عن الحقائق المبنية على أسس معرفية سليمة.',
    weight: 20,
    levels: [
      { score: 0, descriptor: 'غياب الموقف الصريح أو تقديم ادعاء مبهم غير محدد المعالم.' },
      { score: 1, descriptor: 'صياغة ادعاء عام مع خلط واضح بين الرأي الذاتي والحقيقة.' },
      { score: 2, descriptor: 'تحديد موقف مفهوم مع تمايز أولي بين وجهة النظر والبيانات.' },
      { score: 3, descriptor: 'ادعاء محدد ومصاغ بدقة يفصل بوضوح بين الفرضية والدليل.' },
      { score: 4, descriptor: 'ادعاء فكري محكم ومتبصر يحدد نطاق المسألة وسياقها بدقة بالغة.' },
    ],
  },
  {
    id: 'crit-evidence-use',
    title: 'توظيف الأدلة والبيانات العلمية (Evidence Use)',
    description: 'استخراج الأدلة الكمية من المصادر المعتمدة وتوظيفها بشكل منهجي لدعم الحجة المركزية.',
    weight: 25,
    levels: [
      { score: 0, descriptor: 'لم يوظف أي دليل علمي معتمد أو استند إلى بيانات مغلوطة.' },
      { score: 1, descriptor: 'إشارة عابرة إلى الأرقام دون ربط تحليلي أو توثيق سليم.' },
      { score: 2, descriptor: 'توظيف دليل علمي واحد بشكل مقبول مع قصور في التسلسل الاستدلالي.' },
      { score: 3, descriptor: 'توظيف أدلة دقيقة ومتنوعة (كأرقام الحرارة وتركيزات الكربون) لدعم الموقف بفاعلية.' },
      { score: 4, descriptor: 'توظيف استدلالي بارع لبيانات متعددة ومقارنة الإحصاءات بإتقان منهجي تام.' },
    ],
  },
  {
    id: 'crit-source-evaluation',
    title: 'فحص موثوقية المصادر ونطاقها (Source Evaluation)',
    description: 'تقييم منهجية المصادر المعتمدة وإدراك معايير التحقق والتمييز بين المحركات الطبيعية والبشرية.',
    weight: 20,
    levels: [
      { score: 0, descriptor: 'غياب فحص المصدر أو قبول المعلومات دون تدقيق في جهة الإصدار.' },
      { score: 1, descriptor: 'فحص سطحي يكتفي بذكر اسم الجهة دون نقد للمنهجية أو سياق الرصد.' },
      { score: 2, descriptor: 'تقييم أولي لموثوقية المصدر مع إدراك أساسي لأهمية الرصد العلمي المستقل.' },
      { score: 3, descriptor: 'تقييم نقدي جيد يوضح منهجية القياس وموثوقية الهيئات المرجعية وسياق بياناتها.' },
      { score: 4, descriptor: 'تقييم منهجي رصين يوازن بين موثوقية الهيئات، ونطاق الدراسات، وحدود القياس العلمي.' },
    ],
  },
  {
    id: 'crit-counter-arguments',
    title: 'التعامل مع الرأي المخالف والحجج المضادة (Counter-Argument)',
    description: 'استيعاب الحجج المستندة إلى المحركات الطبيعية وفحص قدرتها على تفسير نمط الاحترار الأخير بموضوعية.',
    weight: 20,
    levels: [
      { score: 0, descriptor: 'تجاهل تام للرأي المخالف أو رفضه دون مبرر منطقي أو دليل علمي.' },
      { score: 1, descriptor: 'اعتراف شكلي بوجود حجة مقابلة مع عجز عن الرد عليها علمياً.' },
      { score: 2, descriptor: 'مناقشة الرأي المخالف جزئياً مع محاولة تفنيد تستند إلى أدلة مقبولة.' },
      { score: 3, descriptor: 'تفنيد موضوعي للحجة المضادة يوضح لماذا لا تكفي العوامل الطبيعية لتفسير وتيرة الاحترار.' },
      { score: 4, descriptor: 'تحليل نقدي متقدم يفكك الفرضيات المقابلة بإنصاف ويوضح بطلانها استناداً إلى البصمة الحرارية.' },
    ],
  },
  {
    id: 'crit-reflection-synthesis',
    title: 'التأمل والتركيب المعرفي (Reflection & Synthesis)',
    description: 'إظهار التواضع المعرفي والتركيب بين الأدلة ومراجعة مستوى الثقة وتقديم خلاصة فكرية متوازنة.',
    weight: 15,
    levels: [
      { score: 0, descriptor: 'جمود فكري وادعاء الجزم التام دون أي مراجعة أو تأمل ذاتي.' },
      { score: 1, descriptor: 'تأمل مقتضب يكرر الموقف السابق دون إظهار أي تطور في زاوية النظر.' },
      { score: 2, descriptor: 'تأمل مقبول يعترف بنقاط القوة والضعف في التحليل بنظرة أولية.' },
      { score: 3, descriptor: 'تأمل ناضج يوضح كيف أسهمت الأدلة في ضبط مستوى الثقة وصياغة فهم تركيبي أعمق.' },
      { score: 4, descriptor: 'تركيب معرفي رفيع يعكس وعياً بحدود اليقين، ويجمع ببراعة بين قوة الأدلة والتواضع العلمي.' },
    ],
  },
];

export const CLIMATE_CHANGE_SOURCES: Omit<ActivitySource, 'id' | 'activity_id' | 'created_at'>[] = [
  {
    title: 'تقرير الهيئة الحكومية الدولية المعنية بتغير المناخ (IPCC AR6 - موجز صانعي السياسات)',
    source_type: 'text',
    source_snapshot: `[المصدر 1: تقرير الهيئة الحكومية الدولية المعنية بتغير المناخ (IPCC AR6)]:
- تسبب انبعاثات غازات الدفيئة الناتجة عن الأنشطة البشرية الاحترار العالمي المرصود في العصر الحديث بصورة قاطعة؛ حيث ارتفع متوسط درجة حرارة سطح الأرض عالمياً في الفترة بين (2011–2020) بنحو 1.1 درجة مئوية فوق مستويات ما قبل الثورة الصناعية (1850–1900).
- يمثل الاحتباس الحراري الطبيعي آلية ضرورية تدعم الحياة على كوكب الأرض وتحافظ على دفئه، إلا أن الانبعاثات البشرية الإضافية تؤدي إلى تكثيف هذه الظاهرة واحتجاز مقادير متزايدة من الطاقة الحرارية.
- الدوافع الطبيعية مقابل التفسير البشري: تلعب المحركات الطبيعية (مثل الدورات البركانية والتباينات الطبيعية) دوراً في تقلب المناخ عبر التاريخ، لكن التقديرات العلمية تؤكد أنها عاجزة تماماً بمفردها عن تفسير حجم ونمط وسرعة الاحترار العالمي المقاس خلال العقود الأخيرة.`,
    source_url: 'https://www.ipcc.ch/report/ar6/syr/',
    citation_label: '[تقرير IPCC AR6]',
  },
  {
    title: 'أسباب تغير المناخ - وكالة الفضاء الأمريكية ناسا (NASA Global Climate Change)',
    source_type: 'text',
    source_snapshot: `[المصدر 2: وكالة الفضاء الأمريكية (NASA - أسباب تغير المناخ)]:
- تؤكد قياسات ناسا أن أنشطة الإنسان كحرق الوقود الأحفوري وإزالة الغابات والعمليات الزراعية والصناعية تضخ كميات ضخمة من الغازات الحابسة للحرارة، مما أدى لارتفاع تركيز غاز ثاني أكسيد الكربون (CO2) في الغلاف الجوي بنسبة تقارب 50% منذ عام 1750.
- التباين الشمسي يؤثر في مناخ الأرض عبر دورات زمنية، لكن بيانات الأقمار الصناعية لنشاط الشمس لا تظهر أي مسار تصاعدي يواكب وتيرة الاحترار الحديثة؛ كما تعجز النماذج المناخية عن محاكاة درجات الحرارة المرصودة دون إدراج غازات الدفيئة البشرية.
- الحجة المقابلة وفحص البصمة: تؤثر المحركات الطبيعية في المناخ، غير أن فحص طبقات الجو يثبت أن طبقة التروبوسفير السفلى ترتفع حرارتها بينما تبرد طبقة الستراتوسفير العليا، وهي البصمة الدالة حصراً على تأثير الغازات الدفيئة المحتبسة وليس على زيادة الإشعاع الشمسي العام.`,
    source_url: 'https://science.nasa.gov/climate-change/causes/',
    citation_label: '[وكالة ناسا NASA]',
  },
];

export const SEED_ACTIVITY: Activity = {
  id: '00000000-0000-0000-0000-000000000101',
  teacher_id: DEV_DEFAULT_TEACHER.id,
  title: 'هل يساهم النشاط البشري في زيادة الاحتباس الحراري؟',
  topic: 'هل يساهم النشاط البشري في زيادة الاحتباس الحراري؟',
  grade_level: 8,
  language: 'ar',
  stance_mode: 'advocate',
  ai_stance: 'تؤكد الأدلة العلمية المقاسة أن الأنشطة البشرية، وفي مقدمتها حرق الوقود الأحفوري وإزالة الغابات، هي المحرك الحاسم لارتفاع تركيزات غازات الدفيئة والاحترار العالمي المتسارع.',
  strict_source: true,
  rubric_config: CLIMATE_CHANGE_RUBRIC,
  access_code: 'CLIMATE-27',
  max_turns: 8,
  status: 'draft',
  version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Idempotently seeds the default climate critical-thinking template.
 * Preserves stable identities and modifies only the default template and teacher.
 */
export function seedDefaultClimateActivity(store?: any): {
  activity: Activity;
  sources: ActivitySource[];
} {
  const targetStore = store || (globalThis as any).ctlStore || {
    teachers: new Map(),
    activities: new Map(),
    sources: new Map(),
  };

  // Ensure default teacher exists without mutating other teachers
  if (targetStore.teachers && !targetStore.teachers.has(DEV_DEFAULT_TEACHER.id)) {
    targetStore.teachers.set(DEV_DEFAULT_TEACHER.id, {
      ...DEV_DEFAULT_TEACHER,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // Idempotently set SEED_ACTIVITY
  const existing = targetStore.activities?.get(SEED_ACTIVITY.id);
  const activity: Activity = {
    ...SEED_ACTIVITY,
    created_at: existing?.created_at || SEED_ACTIVITY.created_at,
    updated_at: new Date().toISOString(),
  };
  if (targetStore.activities) {
    targetStore.activities.set(SEED_ACTIVITY.id, activity);
  }

  // Idempotently set sources
  const sources: ActivitySource[] = CLIMATE_CHANGE_SOURCES.map((s, idx) => ({
    id: `src-seed-${idx + 1}`,
    activity_id: SEED_ACTIVITY.id,
    title: s.title,
    source_type: s.source_type,
    source_snapshot: s.source_snapshot,
    source_url: s.source_url || null,
    citation_label: s.citation_label,
    created_at: new Date().toISOString(),
  }));

  if (targetStore.sources) {
    targetStore.sources.set(SEED_ACTIVITY.id, sources);
  }

  return { activity, sources };
}
