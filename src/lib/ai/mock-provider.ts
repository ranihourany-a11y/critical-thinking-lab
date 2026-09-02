import { Activity, ActivitySource, Message, PedagogicalStage, Session } from '@/lib/db/schema';
import { DialogueDecision, FormativeEvaluation } from './schemas';

export class MockEducationalAIProvider {
  /**
   * Generates a deterministic Socratic dialogue decision based on stage, sources, and student input.
   * Engaging, conversational, and weaving sources into logical inquiries.
   */
  async generateDialogueTurn(params: {
    activity: Activity;
    sources: ActivitySource[];
    session: Session;
    history: Message[];
    studentMessage: string;
    messageKind: 'normal' | 'clarification' | 'question' | 'hint';
  }): Promise<DialogueDecision> {
    const { activity, sources, session, history, studentMessage, messageKind } = params;
    const currentStage = session.current_stage;
    const studentAlias = session.student_alias;

    const source1 = sources[0] || {
      id: 'src-default-1',
      citation_label: '[تقرير IPCC السنوي]',
      title: 'تقرير IPCC',
      source_snapshot: '',
    };
    const source2 = sources[1] || source1;

    // 1. Handling specific student action types
    if (messageKind === 'hint') {
      return {
        reply: `تلميح مرشد ومحفز لك يا ${studentAlias}: دعنا نفكر في التوقيت والآلية الفيزيائية؛ تظهر بيانات ${source1.citation_label} أن تركيزات ثاني أكسيد الكربون قفزت من 280 إلى أكثر من 415 جزءاً في المليون تزامناً مع الثورة الصناعية. إذا كان هناك سبب طبيعي بديل كالبراكين أو الشمس، ما البصمة أو الأثر الذي نتوقع أن نجده في الغلاف الجوي؟`,
        next_stage: currentStage,
        question_type: 'hint',
        used_source_ids: [source1.id],
        unsupported_claim_refused: false,
      };
    }

    if (messageKind === 'clarification') {
      return {
        reply: `سؤال توضيحي ممتاز يا ${studentAlias}! دعنا نبسط المسألة بتشبيه واقعي: تخيل الغلاف الجوي مثل "غطاء عازل" يحيط بالأرض؛ عندما تزداد الغازات الدفيئة المذكورة في ${source2.citation_label}، يحتجز الغطاء مزيداً من الحرارة في الطبقة السفلى. بناءً على هذا التشبيه، كيف يمكننا التأكد من أن الحرارة لا تأتي من مصدر خارجي كزيادة إشعاع الشمس؟`,
        next_stage: currentStage,
        question_type: 'clarification',
        used_source_ids: [source2.id],
        unsupported_claim_refused: false,
      };
    }

    if (messageKind === 'question') {
      return {
        reply: `سؤال ذكي وفاحص ينم عن حس نقدي رفيع يا ${studentAlias}! للإجابة على تساؤلك، اعتمد العلماء في ${source1.citation_label} على تقنية "نظائر الكربون"؛ حيث يترك حرق الوقود الأحفوري بصمة كيميائية فريدة (نسبة الكربون-13 إلى الكربون-12) تميزه بوضوح عن انبعاثات البراكين الطبيعية. كيف تعتقد أن هذه البصمة الكيميائية تقطع الشك باليقين بشأن مصدر الانبعاثات؟`,
        next_stage: currentStage === 'baseline' ? 'understanding' : currentStage,
        question_type: 'causal_probe',
        used_source_ids: [source1.id],
        unsupported_claim_refused: false,
      };
    }

    // Check for baseless/contradictory claims when strict grounding is on
    const isUnsupported =
      activity.strict_source &&
      (studentMessage.includes('فضائيين') ||
        studentMessage.includes('مؤامرة سحرية') ||
        studentMessage.includes('خرافة مطلقة'));

    if (isUnsupported) {
      return {
        reply: `وجهة نظر تستحق التوقف والمناقشة يا ${studentAlias}، لكن دعنا نفحص مدى اتساقها مع الواقع العلمي: هذا التفسير لا يجد سنداً في المصادر العلمية المعتمدة لدينا مثل ${source1.citation_label}. في مختبر التفكير الناقد، نسعى دائماً لبناء فرضيات قابلة للقياس والاختبار بالأدلة. كيف يمكننا إعادة صياغة تحليلك بالارتكاز على ما رصدته الأقمار الصناعية ومحطات القياس الموثقة؟`,
        next_stage: currentStage,
        question_type: 'evidence_request',
        used_source_ids: [source1.id],
        unsupported_claim_refused: true,
      };
    }

    // Stage progression state machine with rich, interactive, conversational prompts
    switch (currentStage) {
      case 'baseline':
        return {
          reply: `مرحباً بك يا ${studentAlias} في مختبر التفكير الناقد! أحييك على موقفك المبدئي الواضح. لقد طرحت فكرة مثيرة للاهتمام حين أشرت إلى: "${studentMessage.slice(0, 65)}...". لتأسيس نقاشنا على أرضية صلبة، ما هو المفهوم الجوهري الذي بنيت عليه رأيك، وكيف تصف بكلماتك الفرق بين التغير المناخي الطبيعي والاحترار الناتج عن النشاط البشري؟`,
          next_stage: 'understanding',
          question_type: 'clarification',
          used_source_ids: [source1.id],
          unsupported_claim_refused: false,
        };

      case 'understanding':
        return {
          reply: `تحديد دقيق ومفهوم رائع يا ${studentAlias}! والآن لننتقل من المفاهيم النظرية إلى عالم البيانات الحقيقية: إذا ألقينا نظرة فاحصة على ${source1.citation_label}، نجد قفزة تاريخية في مستويات ثاني أكسيد الكربون إلى أكثر من 415 جزءاً في المليون. ما هو الدليل أو الرقم الأكثر حسماً في رأيك داخل المصدر الذي يربط هذا الارتفاع بالأنشطة الصناعية تحديداً؟`,
          next_stage: 'evidence',
          question_type: 'evidence_request',
          used_source_ids: [source1.id],
          unsupported_claim_refused: false,
        };

      case 'evidence':
        return {
          reply: `استدلال قوي واستشهاد موفق بالبيانات يا ${studentAlias}! ولكن في التفكير الناقد نسأل دائماً: كيف نتحقق من مصداقية وسياق هذه البيانات؟ عند فحص ${source2.citation_label} وسجلات العينات الجليدية الممتدة لـ 800,000 عام، ما الذي يجعل هذه الطريقة العلمية مصدراً موثوقاً نبني عليه استنتاجاتنا حول ماضي الأرض وحاضرها؟`,
          next_stage: 'source_check',
          question_type: 'causal_probe',
          used_source_ids: [source2.id],
          unsupported_claim_refused: false,
        };

      case 'source_check':
        return {
          reply: `تحليل منهجي سليم لموثوقية المصادر يا ${studentAlias}. والآن دعنا نخوض في التحدي المنطقي الأهم: قاعدة "الارتباط لا يعني بالضرورة السببية" (Correlation does not imply Causation). تظهر بيانات ${source2.citation_label} أن طبقة التروبوسفير تسخن بينما الستراتوسفير تبرد؛ كيف يمثل هذا النمط "بصمة سببية" تثبت أن الغازات الدفيئة هي السبب المباشر وليس ارتفاع حرارة الشمس ككل؟`,
          next_stage: 'causal_reasoning',
          question_type: 'causal_probe',
          used_source_ids: [source2.id],
          unsupported_claim_refused: false,
        };

      case 'causal_reasoning':
        return {
          reply: `استنتاج سببي محكم ومنطق رائع يا ${studentAlias}! والآن، بصفتي شريكك في هذه المناظرة، سأضعك أمام حجة الرأي الآخر القائل بأن: "${activity.ai_stance}". إذا افترضنا جدلاً أن النشاط الشمسي هو المحرك الأساسي، كيف ستستخدم البيانات العلمية الواردة في ${source1.citation_label} و ${source2.citation_label} للرد على هذه الحجة وتفنيدها بإنصاف ومنطق رصين؟`,
          next_stage: 'counter_argument',
          question_type: 'counter_example',
          used_source_ids: [source1.id, source2.id],
          unsupported_claim_refused: false,
        };

      case 'counter_argument':
        return {
          reply: `أبدعت يا ${studentAlias} في تفنيد الحجة المضادة ومناقشتها بمرونة وانفتاح ذهني لافت! لقد خضت جميع مراحل الحوار السقراطي باقتدار؛ والآن حان وقت التركيب المعرفي: بعد كل ما استعرضناه من أدلة وبصمات حرارية وحجج مضادة، ما الفكرة التي أصبحت أكثر ثقة بها، وما الجانب الذي لا زلت ترى أنه يستحق مزيداً من البحث والاستكشاف؟ يمكنك الآن الانتقال لنموذج التأمل الختامي.`,
          next_stage: 'reflection',
          question_type: 'reflection_prompt',
          used_source_ids: [source1.id],
          unsupported_claim_refused: false,
        };

      case 'reflection':
      case 'submitted':
      default:
        return {
          reply: `شكراً جزيلاً لك يا ${studentAlias} على هذا الحوار الممتع والثرِي بتفكيرك الناقد المتميز. تم توثيق جميع مشاركاتك وتأملك الختامي بنجاح ونقله إلى ملف المعلم للمراجعة.`,
          next_stage: 'reflection',
          question_type: 'reflection_prompt',
          used_source_ids: [source1.id],
          unsupported_claim_refused: false,
        };
    }
  }

  /**
   * Generates a formative rubric evaluation verified with student transcript quotes.
   */
  async generateEvaluation(params: {
    activity: Activity;
    session: Session;
    transcript: Message[];
  }): Promise<FormativeEvaluation> {
    const { activity, session, transcript } = params;
    const studentMessages = transcript.filter((m) => m.sender === 'student');

    // Extract real quotes from student messages
    const quote1 =
      studentMessages[0]?.content.slice(0, 60) || session.initial_reason || 'النشاط البشري يؤثر على المناخ';
    const quote2 =
      session.strongest_evidence ||
      studentMessages[1]?.content.slice(0, 60) ||
      'البيانات تشير إلى ارتفاع الحرارة';
    const quote3 =
      session.final_reflection ||
      studentMessages[2]?.content.slice(0, 60) ||
      'تعلمت مراجعة الأدلة والسببية';

    const rubricScores = activity.rubric_config.map((criterion, idx) => {
      const score = Math.min(4, Math.max(2, 4 - (idx % 2)));
      return {
        criterion_id: criterion.id,
        score,
        rationale: `أظهر الطالب التزاماً واضحاً بمتطلبات المعيار (${criterion.title})، حيث دمج الأدلة في سياق منطقي محكم وناقش الفرضيات بموضوعية وتفكير نقدي ناضج.`,
        quotes: idx === 0 ? [quote1, quote2] : [quote2, quote3],
      };
    });

    return {
      rubric_scores: rubricScores,
      verified_quotes: [
        {
          quote: quote1,
          stage: 'understanding',
          criterion_id: activity.rubric_config[0]?.id || 'crit-1',
          relevance: 'دلالة على استيعاب الفرضية والموقف الأولي للطالب وتوظيفه منطقياً',
        },
        {
          quote: quote2,
          stage: 'evidence',
          criterion_id: activity.rubric_config[1]?.id || 'crit-2',
          relevance: 'استدلال بالبيانات المطروحة في المصادر العلمية المعتمدة لتدعيم الحجة',
        },
        {
          quote: quote3,
          stage: 'reflection',
          criterion_id: activity.rubric_config[2]?.id || 'crit-3',
          relevance: 'تأمل معرفي وإدراك لأهمية فحص الحجج المضادة بإنصاف',
        },
      ],
      strengths: [
        'القدرة على دمج البيانات الرقمية في بناء منطقي متماسك',
        'التمييز العملي بين العلاقة السببية والارتباط العرضي عبر البصمات الحرارية',
        'المرونة المعرفية وتقبل الحجج المضادة ومناقشتها باحترام وعقلانية',
      ],
      misconceptions: [
        'الحاجة إلى مزيد من التدقيق في تقييم مدى حداثة وتخصص بعض المصادر الثانوية',
      ],
      suggested_feedback: `أحسنت يا ${session.student_alias}! أظهرت مهارة رائعة في بناء الحجج المنطقية والاستشهاد بالمصادر العلمية الموثوقة. ننصحك بالاستمرار في فحص الفرضيات المعقدة والتدرب على صياغة تفسيرات بديلة.`,
      system_confidence: 0.94,
    };
  }
}
