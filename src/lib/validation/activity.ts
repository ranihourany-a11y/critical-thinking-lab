import { z } from 'zod';
import { Activity, ActivitySource } from '@/lib/db/schema';

export const RubricLevelSchema = z.object({
  score: z.number().int().min(0).max(4),
  descriptor: z.string().min(1, 'الوصف مطلوب'),
});

export const RubricCriterionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'عنوان المعيار مطلوب'),
  description: z.string().min(1, 'شرح المعيار مطلوب'),
  weight: z.number().min(0.01).max(100),
  levels: z.array(RubricLevelSchema),
});

export const ActivitySourceSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'عنوان المصدر مطلوب'),
  source_type: z.enum(['text', 'url']),
  source_snapshot: z.string().default(''),
  source_url: z.string().url('رابط المصدر غير صالح').optional().nullable().or(z.literal('')),
  citation_label: z.string().min(1, 'رمز التوثيق مطلوب'),
});

export interface ActivationValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
}

/**
 * Server-side Activity Activation-Readiness Validator.
 * Strictly verifies all requirements before an activity can be set to 'active'.
 * Does not invoke AI or fetch external URLs.
 */
export function validateActivityActivation(
  activity: Record<string, any>,
  sources?: any[]
): ActivationValidationResult {
  const errors: Record<string, string[]> = {};
  const addError = (field: string, msg: string) => {
    if (!errors[field]) errors[field] = [];
    errors[field].push(msg);
  };

  // 1. Non-empty trimmed title and topic
  if (!activity.title || typeof activity.title !== 'string' || activity.title.trim().length === 0) {
    addError('title', 'عنوان النشاط مطلوب ولا يمكن أن يكون فارغاً');
  }

  if (!activity.topic || typeof activity.topic !== 'string' || activity.topic.trim().length === 0) {
    addError('topic', 'موضوع النشاط مطلوب ولا يمكن أن يكون فارغاً');
  }

  // 2. Canonical grade level 7–12
  if (
    typeof activity.grade_level !== 'number' ||
    !Number.isInteger(activity.grade_level) ||
    activity.grade_level < 7 ||
    activity.grade_level > 12
  ) {
    addError('grade_level', 'المرحلة الدراسية يجب أن تكون من الصف السابع حتى الثالث ثانوي (7–12)');
  }

  // 3. Stance mode & AI stance
  const validStanceModes = ['contrarian', 'advocate', 'adaptive'];
  if (!activity.stance_mode || !validStanceModes.includes(activity.stance_mode)) {
    addError('stance_mode', 'نمط الحوار المعتمد غير صالح');
  }

  if (!activity.ai_stance || typeof activity.ai_stance !== 'string' || activity.ai_stance.trim().length === 0) {
    addError('ai_stance', 'موقف الذكاء الاصطناعي مطلوب لتوجيه الحوار');
  }

  // 4. Rubric criteria
  const rubric = activity.rubric_config;
  if (!Array.isArray(rubric) || rubric.length === 0) {
    addError('rubric_config', 'يجب تحديد معيار تقييم واحد على الأقل للنشاط');
  } else {
    const titlesSet = new Set<string>();
    let totalWeight = 0;

    for (let i = 0; i < rubric.length; i++) {
      const criterion = rubric[i];
      const critTitle = criterion?.title ? String(criterion.title).trim() : '';

      if (!critTitle) {
        addError(`rubric_config.${i}.title`, 'عنوان المعيار مطلوب');
      } else {
        const lowerTitle = critTitle.toLowerCase();
        if (titlesSet.has(lowerTitle)) {
          addError(`rubric_config.${i}.title`, `اسم المعيار "${critTitle}" مكرر، يجب أن تكون أسماء المعايير فريدة`);
        }
        titlesSet.add(lowerTitle);
      }

      if (
        typeof criterion?.weight !== 'number' ||
        !Number.isFinite(criterion.weight) ||
        criterion.weight <= 0
      ) {
        addError(`rubric_config.${i}.weight`, 'وزن المعيار يجب أن يكون عدداً موجباً أكبر من الصفر');
      } else {
        totalWeight += criterion.weight;
      }

      if (!Array.isArray(criterion?.levels) || criterion.levels.length !== 5) {
        addError(`rubric_config.${i}.levels`, 'يجب تحديد جميع مستويات التقييم الخمسة من 0 إلى 4');
      } else {
        const seenScores = new Set<number>();
        for (const lvl of criterion.levels) {
          if (
            typeof lvl.score !== 'number' ||
            !Number.isInteger(lvl.score) ||
            lvl.score < 0 ||
            lvl.score > 4
          ) {
            addError(`rubric_config.${i}.levels`, 'درجات المستويات يجب أن تكون أعداداً صحيحة بين 0 و 4');
            break;
          }
          if (seenScores.has(lvl.score)) {
            addError(`rubric_config.${i}.levels`, 'مستويات التقييم يجب أن تغطي الدرجات من 0 إلى 4 دون تكرار');
            break;
          }
          seenScores.add(lvl.score);
        }
      }
    }

    // Safe decimal tolerance check: total weight must be exactly 100
    if (Math.abs(totalWeight - 100) > 0.001) {
      addError('rubric_config', `مجموع أوزان المعايير يجب أن يساوي 100% تماماً (المجموع الحالي: ${totalWeight}%)`);
    }
  }

  // 5. Strict source grounding check
  const allSources = sources || activity.sources || [];
  if (activity.strict_source) {
    const usableSources = allSources.filter(
      (s: any) => typeof s?.source_snapshot === 'string' && s.source_snapshot.trim().length > 0
    );

    if (usableSources.length === 0) {
      addError(
        'sources',
        'عند تفعيل التوثيق الصارم، يجب توفير نص مرجعي معتمد واحد على الأقل. روابط المصادر (URLs) وحدها لا تكفي كأدلة توثيق.'
      );
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export const CreateActivitySchema = z.object({
  title: z.string().min(1, 'عنوان النشاط مطلوب').default('مسودة نشاط جديد'),
  topic: z.string().default(''),
  grade_level: z.union([
    z.literal(7),
    z.literal(8),
    z.literal(9),
    z.literal(10),
    z.literal(11),
    z.literal(12),
  ]).default(8),
  language: z.string().default('ar'),
  stance_mode: z.enum(['contrarian', 'advocate', 'adaptive']).default('contrarian'),
  ai_stance: z.string().default(''),
  strict_source: z.boolean().default(true),
  max_turns: z.number().int().min(4).max(20).default(8),
  rubric_config: z.array(RubricCriterionSchema).default([]),
  sources: z.array(ActivitySourceSchema).default([]),
  status: z.enum(['draft', 'active', 'closed']).default('draft'),
});

export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;

export const UpdateActivitySchema = z.object({
  title: z.string().optional(),
  topic: z.string().optional(),
  grade_level: z.union([
    z.literal(7),
    z.literal(8),
    z.literal(9),
    z.literal(10),
    z.literal(11),
    z.literal(12),
  ]).optional(),
  language: z.string().optional(),
  stance_mode: z.enum(['contrarian', 'advocate', 'adaptive']).optional(),
  ai_stance: z.string().optional(),
  strict_source: z.boolean().optional(),
  max_turns: z.number().int().min(4).max(20).optional(),
  rubric_config: z.array(RubricCriterionSchema).optional(),
  sources: z.array(ActivitySourceSchema).optional(),
  status: z.enum(['draft', 'active', 'closed']).optional(),
});

export type UpdateActivityInput = z.infer<typeof UpdateActivitySchema>;
