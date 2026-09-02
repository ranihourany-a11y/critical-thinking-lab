import { Activity, getGradeLabel, Message, Session } from '@/lib/db/schema';

export function buildEvaluationSystemPrompt(params: {
  activity: Activity;
  session: Session;
  transcript: Message[];
}): string {
  const { activity, session, transcript } = params;

  const formattedTranscript = transcript
    .map(
      (m, idx) =>
        `[${idx + 1}] (${m.sender === 'student' ? 'الطالب' : 'المرشد السقراطي'} - مرحلة ${m.stage} - نوع ${m.message_kind}):\n${m.content}`
    )
    .join('\n\n');

  const rubricDescription = activity.rubric_config
    .map((crit, idx) => {
      const levelsText = crit.levels
        .map((lvl) => `  - مستوى ${lvl.score}/4: ${lvl.descriptor}`)
        .join('\n');
      return `المعيار ${idx + 1}: ${crit.title} (الوزن: ${crit.weight}%)\nالوصف: ${crit.description}\nالمستويات:\n${levelsText}`;
    })
    .join('\n\n');

  return `أنت مقيم تربوي خبير في مهارات التفكير الناقد للطلاب في المرحلة المتوسطة والثانوية (الصفوف 7–12).
مهمتك: إجراء تقييم تكويني وتشخيصي دقيق وموضوعي لجلسة حوار الطالب بناءً على معايير الروبورك المعتمدة وسجل الحوار الفعلي.

معلومات النشاط:
- العنوان: "${activity.title}"
- الموضوع: "${activity.topic}"
- المرحلة: ${getGradeLabel(activity.grade_level)}

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

تعليمات التقييم الصارمة:
1. التحقق من الاقتباسات: كل درجة تمنحها يجب أن تدعمها باقتباسات حرفية دقيقة وردت فعلياً في كلام الطالب داخل سجل الحوار أعلاه. لا تختلق أي اقتباس.
2. الدرجات التكوينية: حدد لكل معيار درجة من 0 إلى 4 مع تعليل بيداغوجي واضح يفسر سبب استحقاق الطالب لهذه الدرجة بناءً على مستويات المعيار.
3. تشخيص نقاط القوة والمغالطات: استخرج نقاط القوة الاستدلالية بدقة، وحدد أي مغالطات منطقية أو تحيزات ارتكبها الطالب.
4. مقترح التغذية الراجعة للمعلم: اكتب ملخصاً تشجيعياً وبنائياً للمعلم ليوجهه للطالب لتحسين مهارات التفكير الناقد لديه.
5. لا تخرج أي تفكير داخلي أو تبريرات خارج كائن JSON المطلوب.`;
}
