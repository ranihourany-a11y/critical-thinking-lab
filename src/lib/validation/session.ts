import { z } from 'zod';

export const StudentJoinSchema = z.object({
  access_code: z
    .string()
    .min(1, 'رمز النشاط مطلوب')
    .transform((val) => val.trim().toUpperCase())
    .refine((val) => val.length >= 3 && val.length <= 20, {
      message: 'رمز النشاط يجب أن يكون بين 3 و 20 حرفاً',
    }),
  student_alias: z
    .string()
    .transform((val) => val.replace(/\s+/g, ' ').trim())
    .refine((val) => !/[\u0000-\u001F\u007F-\u009F]/.test(val), {
      message: 'الاسم المستعار يحتوي على رموز تحكم غير مسموحة',
    })
    .refine((val) => val.length >= 2 && val.length <= 40, {
      message: 'الاسم المستعار يجب أن يكون بين 2 و 40 حرفاً',
    }),
});

export const StudentPrepareSchema = z.object({
  initial_stance: z.string().min(2, 'يرجى تحديد موقفك بوضوح'),
  initial_reason: z.string().min(10, 'يرجى كتابة تبرير لا يقل عن 10 أحرف'),
  initial_confidence: z.number().int().min(1).max(5),
  rules_accepted: z.boolean().refine((val) => val === true, 'يجب الموافقة على قواعد الحوار'),
});

export const StudentChatTurnSchema = z.object({
  client_message_id: z.string().min(1, 'معرف الرسالة مطلوب (idempotency key)'),
  content: z
    .string()
    .trim()
    .min(1, 'نص الرسالة لا يمكن أن يكون فارغاً')
    .max(2000, 'تجاوزت الحد الأقصى لطول الرسالة (2000 حرف)'),
  message_kind: z.enum(['normal', 'clarification', 'question', 'hint']).default('normal'),
});

export const StudentRetrySchema = z.object({
  client_message_id: z.string().min(1, 'معرف الرسالة مطلوب'),
});

export const StudentReflectionSchema = z.object({
  final_stance: z.string().min(2, 'يرجى تحديد موقفك النهائي'),
  final_confidence: z.number().int().min(1).max(5),
  strongest_evidence: z.string().min(10, 'يرجى ذكر أقوى دليل تم التوصل إليه'),
  strongest_counterargument: z.string().min(10, 'يرجى ذكر أقوى حجة مضادة واجهتها'),
  remaining_uncertainty: z.string().min(5, 'يرجى ذكر ما زلت غير متأكد منه أو ترغب في استكشافه أكثر'),
  final_reflection: z.string().min(20, 'التأمل الختامي يجب ألا يقل عن 20 حرفاً'),
});

export const TeacherApprovalSchema = z.object({
  teacher_approved: z.boolean(),
  suggested_feedback: z.string().optional(),
});
