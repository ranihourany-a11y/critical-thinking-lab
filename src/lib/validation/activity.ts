import { z } from 'zod';

export const RubricLevelSchema = z.object({
  score: z.number().int().min(0).max(4),
  descriptor: z.string().min(1, 'الوصف مطلوب'),
});

export const RubricCriterionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2, 'عنوان المعيار مطلوب'),
  description: z.string().min(3, 'شرح المعيار مطلوب'),
  weight: z.number().int().min(1).max(100),
  levels: z.array(RubricLevelSchema).length(5, 'يجب تحديد جميع مستويات التقييم من 0 إلى 4'),
});

export const ActivitySourceSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, 'عنوان المصدر مطلوب'),
  source_type: z.enum(['text', 'url']),
  source_snapshot: z.string().min(20, 'نص المصدر المعتمد يجب ألا يقل عن 20 حرفاً'),
  source_url: z.string().url('رابط المصدر غير صالح').optional().nullable().or(z.literal('')),
  citation_label: z.string().min(2, 'رمز التوثيق مطلوب (مثال: [تقرير IPCC])'),
});

export const CreateActivitySchema = z
  .object({
    title: z.string().min(3, 'عنوان النشاط يجب ألا يقل عن 3 أحرف'),
    topic: z.string().min(3, 'الموضوع يجب ألا يقل عن 3 أحرف'),
    grade_level: z.union([
      z.literal(7),
      z.literal(8),
      z.literal(9),
      z.literal(10),
      z.literal(11),
      z.literal(12),
    ]),
    language: z.string().default('ar'),
    stance_mode: z.enum(['contrarian', 'advocate', 'adaptive']),
    ai_stance: z.string().min(5, 'موقف الذكاء الاصطناعي مطلوب'),
    strict_source: z.boolean().default(true),
    max_turns: z.number().int().min(4).max(20).default(8),
    rubric_config: z.array(RubricCriterionSchema).min(1, 'يجب إضافة معيار تقييم واحد على الأقل'),
    sources: z.array(ActivitySourceSchema).default([]),
    status: z.enum(['draft', 'active', 'closed']).default('active'),
  })
  .refine(
    (data) => {
      if (data.strict_source && data.status === 'active') {
        return (
          data.sources.length > 0 &&
          data.sources.every((s) => s.source_snapshot && s.source_snapshot.trim().length >= 30)
        );
      }
      return true;
    },
    {
      message: 'عند تفعيل التوثيق الصارم للمصادر وتنشيط النشاط، يجب توفير نص مرجعي معتمد لا يقل عن 30 حرفاً',
      path: ['sources'],
    }
  )
  .refine(
    (data) => {
      const totalWeight = data.rubric_config.reduce((sum, item) => sum + item.weight, 0);
      return totalWeight === 100;
    },
    {
      message: 'مجموع أوزان معايير التقييم يجب أن يساوي 100%',
      path: ['rubric_config'],
    }
  );

export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;
