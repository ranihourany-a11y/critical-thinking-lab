import { describe, it, expect } from 'vitest';
import { GRADE_LEVEL_OPTIONS, getGradeLabel } from '../src/lib/db/schema';
import { CreateActivitySchema, UpdateActivitySchema } from '../src/lib/validation/activity';

describe('Grades 7–12 Scope & Validation', () => {
  it('should have exactly six approved grade options in the specified order with Grade 8 default', () => {
    expect(GRADE_LEVEL_OPTIONS).toHaveLength(6);

    const expected = [
      { value: 7, label: 'الصف السابع' },
      { value: 8, label: 'الصف الثامن' },
      { value: 9, label: 'الصف التاسع' },
      { value: 10, label: 'أول ثانوي' },
      { value: 11, label: 'ثاني ثانوي' },
      { value: 12, label: 'ثالث ثانوي' },
    ];

    expect(GRADE_LEVEL_OPTIONS).toEqual(expected);

    // Verify helper labels
    expect(getGradeLabel(7)).toBe('الصف السابع');
    expect(getGradeLabel(8)).toBe('الصف الثامن');
    expect(getGradeLabel(9)).toBe('الصف التاسع');
    expect(getGradeLabel(10)).toBe('أول ثانوي');
    expect(getGradeLabel(11)).toBe('ثاني ثانوي');
    expect(getGradeLabel(12)).toBe('ثالث ثانوي');
  });

  it('should accept all six approved grade values in create and update validation, and reject unsupported values', () => {
    const validBase = {
      title: 'نشاط التفكير الناقد الموسع',
      topic: 'الذكاء الاصطناعي والمستقبل',
      language: 'ar',
      stance_mode: 'contrarian' as const,
      ai_stance: 'الذكاء الاصطناعي لا يمتلك أي سلبيات',
      strict_source: false,
      max_turns: 8,
      rubric_config: [
        {
          id: 'c1',
          title: 'الاستدلال',
          description: 'شرح',
          weight: 100,
          levels: [
            { score: 0, descriptor: '0' },
            { score: 1, descriptor: '1' },
            { score: 2, descriptor: '2' },
            { score: 3, descriptor: '3' },
            { score: 4, descriptor: '4' },
          ],
        },
      ],
      sources: [],
      status: 'active' as const,
    };

    // Test all 6 approved values in CreateActivitySchema
    for (const val of [7, 8, 9, 10, 11, 12]) {
      const parsedCreate = CreateActivitySchema.safeParse({
        ...validBase,
        grade_level: val,
      });
      expect(parsedCreate.success).toBe(true);

      const parsedUpdate = UpdateActivitySchema.safeParse({
        grade_level: val,
      });
      expect(parsedUpdate.success).toBe(true);
    }

    // Test rejection of unsupported values
    for (const invalid of [0, 6, 13, 100, -1]) {
      const parsedCreate = CreateActivitySchema.safeParse({
        ...validBase,
        grade_level: invalid,
      });
      expect(parsedCreate.success).toBe(false);

      const parsedUpdate = UpdateActivitySchema.safeParse({
        grade_level: invalid,
      });
      expect(parsedUpdate.success).toBe(false);
    }
  });
});
