import { Activity, ActivitySource, Message, Session } from '@/lib/db/schema';
import { DialogueDecision, FormativeEvaluation } from './schemas';

export class MockEducationalAIProvider {
  /**
   * Generates a deterministic Socratic dialogue decision based on stage, sources, and student input.
   * Enforces strict source grounding, prompt injection resistance, and rubric protection.
   */
  async generateDialogueTurn(params: {
    activity: Activity;
    sources: ActivitySource[];
    session: Session;
    history: Message[];
    studentMessage: string;
    messageKind: 'normal' | 'clarification' | 'question' | 'hint';
  }): Promise<DialogueDecision> {
    const { activity, sources, session, studentMessage, messageKind } = params;
    const currentStage = session.current_stage;
    const studentAlias = session.student_alias;

    // 1. Filter usable sources with actual snapshot text
    const usableSources = sources.filter(
      (s) => s.source_snapshot && s.source_snapshot.trim().length > 0
    );

    // 2. Prompt Injection & System Prompt Extraction Defense
    const isInjectionAttempt =
      studentMessage.includes('ignore previous instructions') ||
      studentMessage.includes('تجاهل التعليمات') ||
      studentMessage.includes('تجاهل كل الأوامر') ||
      studentMessage.includes('ما هو موجه النظام') ||
      studentMessage.includes('ما هو السيستم برومبت') ||
      studentMessage.includes('system prompt');

    if (isInjectionAttempt) {
      return {
        reply: `في مختبر التفكير الناقد، نلتزم حصراً بمناقشة الأفكار واستكشاف الأدلة العلمية المتعلقة بموضوعنا: "${activity.topic}". لا يمكنني كشف تعليمات النظام أو تجاوز الضوابط المعتمدة. كيف تود استكمال الحوار حول القضية؟`,
        next_stage: currentStage,
        question_type: 'clarification',
        used_source_ids: [],
        unsupported_claim_refused: true,
      };
    }

    // 3. Rubric & Evaluation Extraction Defense
    const isRubricExtractionAttempt =
      studentMessage.includes('ما هي درجاتي') ||
      studentMessage.includes('كم درجتي') ||
      studentMessage.includes('قيم إجابتي بدرجة') ||
      studentMessage.includes('أعطني بنود التقييم') ||
      studentMessage.includes('ما هو الروبورك') ||
      studentMessage.includes('كشف الروبورك') ||
      studentMessage.includes('rubric');

    if (isRubricExtractionAttempt) {
      return {
        reply: `التقييم النهائي وتوزيع الدرجات يتم بواسطة معلمك بعد مراجعة تقرير الجلسة المكتملة. دوري هنا هو مساعدتك كشريك حواري على تفكيك الأفكار واختبار الأدلة دون إصدار درجات. كيف ترى قوة الحجة التي طرحتها للتو؟`,
        next_stage: currentStage,
        question_type: 'reflection_prompt',
        used_source_ids: [],
        unsupported_claim_refused: true,
      };
    }

    // 4. Strict grounding check when NO usable source text exists
    if (activity.strict_source && usableSources.length === 0) {
      return {
        reply: `تنبيه منهجي يا ${studentAlias}: لا توجد نصوص مصادر معتمدة وموثقة مرفقة بهذا النشاط حتى الآن. لتجنب افتراض بيانات غير محققة، يرجى التركيز على التحليل المفاهيمي والاستدلال المنطقي لقضية "${activity.topic}". كيف يمكنك صياغة تحليلك بالاعتماد على التفكير المنطقي البحت؟`,
        next_stage: currentStage === 'baseline' ? 'understanding' : currentStage,
        question_type: 'clarification',
        used_source_ids: [],
        unsupported_claim_refused: false,
      };
    }

    const source1 = usableSources[0] || {
      id: 'src-default-1',
      citation_label: '[المصدر المعتمد]',
      title: 'المصدر المعتمد',
      source_snapshot: '',
    };
    const source2 = usableSources[1] || source1;

    // 5. Handling specific student action types
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

    // 6. Check for weak, off-topic, or evasive student answers
    const isWeakAnswer =
      studentMessage.trim().length < 6 ||
      studentMessage.trim() === 'ما أعرف' ||
      studentMessage.trim() === 'لا أدري' ||
      studentMessage.trim() === 'نعم' ||
      studentMessage.trim() === 'لا';

    if (isWeakAnswer) {
      return {
        reply: `لا بأس يا ${studentAlias}، التفكير الناقد يبدأ بالتأمل الهادئ. لنبسط الأمر خطوة بخطوة: ما أول فكرة تخطر ببالك عند التفكير في موضوع "${activity.topic}"؟ يمكنك الاستعانة بأي مثال من حياتك اليومية لتوضيح رأيك.`,
        next_stage: currentStage === 'baseline' ? 'understanding' : currentStage,
        stage_objective_satisfied: false,
        readiness_reasoning: 'الإجابة مقتضبة وغير كافية لتحقيق هدف المرحلة الحالية؛ يتم تثبيت المرحلة مع تقديم سؤال سقراطي ميسر.',
        question_type: 'clarification',
        used_source_ids: [source1.id],
        unsupported_claim_refused: false,
      };
    }

    // 7. Check for baseless / ungrounded claims when strict grounding is on
    const isUnsupported =
      activity.strict_source &&
      (studentMessage.includes('فضائيين') ||
        studentMessage.includes('مؤامرة سحرية') ||
        studentMessage.includes('خرافة مطلقة') ||
        studentMessage.includes('أرقام خيالية') ||
        studentMessage.includes('دراسة سرية لم تنشر'));

    if (isUnsupported) {
      return {
        reply: `وجهة نظر تستحق التوقف والمناقشة يا ${studentAlias}، لكن هذا الادعاء لا يجد سنداً في نصوص المصادر العلمية المعتمدة مثل ${source1.citation_label}. في مختبر التفكير الناقد، نميز بين الافتراضات الشخصية وبين الأدلة القابلة للاختبار. كيف يمكننا إعادة بناء حجتك بالاستناد إلى البيانات الموثقة لدينا؟`,
        next_stage: currentStage === 'baseline' ? 'understanding' : currentStage,
        stage_objective_satisfied: false,
        readiness_reasoning: 'تم تقديم ادعاء غير مدعوم بمصادر؛ يجب تثبيت المرحلة حتى يتم تقديم دليل معتمد.',
        question_type: 'evidence_request',
        used_source_ids: [source1.id],
        unsupported_claim_refused: true,
      };
    }

    // 8. Strict Fixed Order: Understanding -> Evidence -> Source Check -> Counter-argument -> Reflection
    switch (currentStage) {
      case 'baseline':
      case 'understanding':
        return {
          reply: `تحديد دقيق ومفهوم رائع يا ${studentAlias}! والآن لننتقل من المفاهيم النظرية إلى عالم البيانات الحقيقية: إذا ألقينا نظرة فاحصة على ${source1.citation_label}، نجد قفزة تاريخية في مستويات ثاني أكسيد الكربون إلى أكثر من 415 جزءاً في المليون. ما هو الدليل أو الرقم الأكثر حسماً في رأيك داخل المصدر الذي يربط هذا الارتفاع بالأنشطة الصناعية تحديداً؟`,
          next_stage: 'evidence',
          stage_objective_satisfied: true,
          readiness_reasoning: 'حقق الطالب الفهم الأولي للمفاهيم بنجاح ويستعد لتوظيف الأدلة.',
          question_type: 'evidence_request',
          used_source_ids: [source1.id],
          unsupported_claim_refused: false,
        };

      case 'evidence':
        return {
          reply: `استدلال قوي واستشهاد موفق بالبيانات يا ${studentAlias}! ولكن في التفكير الناقد نسأل دائماً: كيف نتحقق من مصداقية وسياق هذه البيانات؟ عند فحص ${source2.citation_label} وسجلات العينات الجليدية الممتدة لـ 800,000 عام، ما الذي يجعل هذه الطريقة العلمية مصدراً موثوقاً نبني عليه استنتاجاتنا حول ماضي الأرض وحاضرها؟`,
          next_stage: 'source_check',
          stage_objective_satisfied: true,
          readiness_reasoning: 'استشهد الطالب بالأدلة العلمية بنجاح ويستعد لتقييم موثوقية المصادر.',
          question_type: 'causal_probe',
          used_source_ids: [source2.id],
          unsupported_claim_refused: false,
        };

      case 'source_check':
        return {
          reply: `تحليل منهجي سليم لموثوقية المصادر يا ${studentAlias}! والآن، بصفتي شريكك في هذه المناظرة، سأضعك أمام حجة الرأي الآخر القائل بأن: "${activity.ai_stance}". إذا افترضنا جدلاً أن النشاط الشمسي هو المحرك الأساسي، كيف ستستخدم البيانات العلمية الواردة في ${source1.citation_label} و ${source2.citation_label} للرد على هذه الحجة وتفنيدها بإنصاف ومنطق رصين؟`,
          next_stage: 'counter_argument',
          stage_objective_satisfied: true,
          readiness_reasoning: 'ناقش الطالب موثوقية المصدر بنجاح وينتقل لاختبار الحجج المضادة.',
          question_type: 'counter_example',
          used_source_ids: [source1.id, source2.id],
          unsupported_claim_refused: false,
        };

      case 'counter_argument':
        return {
          reply: `أبدعت يا ${studentAlias} في تفنيد الحجة المضادة ومناقشتها بمرونة وانفتاح ذهني لافت! لقد خضت جميع مراحل الحوار السقراطي باقتدار؛ والآن حان وقت التركيب المعرفي: بعد كل ما استعرضناه من أدلة وبصمات حرارية وحجج مضادة، ما الفكرة التي أصبحت أكثر ثقة بها، وما الجانب الذي لا زلت ترى أنه يستحق مزيداً من البحث والاستكشاف؟ يمكنك الآن الانتقال لنموذج التأمل الختامي.`,
          next_stage: 'reflection',
          stage_objective_satisfied: true,
          readiness_reasoning: 'أثبت الطالب مرونة في تفنيد الحجة المضادة وجاهز للتأمل الختامي.',
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
          stage_objective_satisfied: true,
          readiness_reasoning: 'اكتملت الجلسة.',
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

    const msg1 = studentMessages[0];
    const msg2 = studentMessages[1] || msg1;
    const msg3 = studentMessages[2] || msg2 || msg1;

    const quote1 = msg1?.content || session.initial_reason || 'النشاط البشري يؤثر على المناخ';
    const quote2 = session.strongest_evidence || msg2?.content || 'البيانات تشير إلى ارتفاع الحرارة';
    const quote3 = session.final_reflection || msg3?.content || 'تعلمت مراجعة الأدلة والسببية';

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
          message_id: msg1?.id || 'session-initial-reason',
        },
        {
          quote: quote2,
          stage: 'evidence',
          criterion_id: activity.rubric_config[1]?.id || 'crit-2',
          relevance: 'استدلال بالبيانات المطروحة في المصادر العلمية المعتمدة لتدعيم الحجة',
          message_id: msg2?.id || 'session-strongest-evidence',
        },
        {
          quote: quote3,
          stage: 'reflection',
          criterion_id: activity.rubric_config[2]?.id || 'crit-3',
          relevance: 'تأمل معرفي وإدراك لأهمية فحص الحجج المضادة بإنصاف',
          message_id: msg3?.id || 'session-final-reflection',
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
