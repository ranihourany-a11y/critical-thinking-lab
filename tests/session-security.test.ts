import { describe, it, expect, beforeEach } from 'vitest';
import { generateSessionToken, hashSessionToken } from '../src/lib/auth/student-session';
import { storage } from '../src/lib/db/storage';
import { SEED_ACTIVITY } from '../src/lib/db/seed';

describe('Session Security & Data Isolation', () => {
  it('should generate distinct cryptographically random tokens and consistent SHA-256 hashes', () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();

    expect(token1).not.toBe(token2);
    expect(token1.length).toBe(64); // 32 bytes hex = 64 characters

    const hash1 = hashSessionToken(token1);
    const hash2 = hashSessionToken(token1);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(token1);
  });

  it('should accept valid access code and reject invalid access codes', async () => {
    const validActivity = await storage.getActivityByCode('CLIM89');
    expect(validActivity).not.toBeNull();
    expect(validActivity?.id).toBe(SEED_ACTIVITY.id);

    // Case-insensitivity check
    const lowerCaseActivity = await storage.getActivityByCode('clim89');
    expect(lowerCaseActivity).not.toBeNull();

    const invalidActivity = await storage.getActivityByCode('INVALID_CODE_999');
    expect(invalidActivity).toBeNull();
  });

  it('should ensure student session storage does not expose teacher evaluations or rubric internal scores to student', async () => {
    const rawToken = generateSessionToken();
    const hash = hashSessionToken(rawToken);

    const session = await storage.createSession(SEED_ACTIVITY.id, 'طالب_تجربة', hash);
    expect(session.session_token_hash).toBe(hash);

    // Verify session contains no evaluation or teacher fields
    expect((session as any).evaluations).toBeUndefined();
    expect((session as any).rubric_scores).toBeUndefined();
    expect((session as any).teacher_feedback).toBeUndefined();

    // Verify fetching by hash works securely
    const retrieved = await storage.getSessionByTokenHash(hash);
    expect(retrieved?.id).toBe(session.id);
    expect(retrieved?.student_alias).toBe('طالب_تجربة');
  });

  it('should isolate teacher activities by teacher_id ownership', async () => {
    const teacher1Activities = await storage.getActivities('00000000-0000-0000-0000-000000000001');
    expect(teacher1Activities.length).toBeGreaterThan(0);

    const otherTeacherActivities = await storage.getActivities('other-unauthorized-teacher-id');
    expect(otherTeacherActivities.length).toBe(0);
  });

  it('should support and validate all grade levels 7 through 12 and map their Arabic labels', async () => {
    const { CreateActivitySchema } = await import('../src/lib/validation/activity');
    const { GRADE_LEVEL_OPTIONS, getGradeLabel } = await import('../src/lib/db/schema');

    // Verify option count
    expect(GRADE_LEVEL_OPTIONS.length).toBe(6);

    // Verify labels
    expect(getGradeLabel(7)).toBe('الصف السابع');
    expect(getGradeLabel(8)).toBe('الصف الثامن');
    expect(getGradeLabel(9)).toBe('الصف التاسع');
    expect(getGradeLabel(10)).toBe('أول ثانوي');
    expect(getGradeLabel(11)).toBe('ثاني ثانوي');
    expect(getGradeLabel(12)).toBe('ثالث ثانوي');

    const baseActivityPayload = {
      title: 'نشاط التفكير في الذكاء الاصطناعي',
      topic: 'أخلاقيات التقنية والمسؤولية الإنسانية',
      language: 'ar',
      stance_mode: 'contrarian' as const,
      ai_stance: 'الذكاء الاصطناعي لا يحمل أي مخاطر مستقبلية',
      strict_source: false,
      max_turns: 8,
      rubric_config: [
        {
          id: 'c1',
          title: 'معيار 1',
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

    // Test each valid grade from 7 to 12
    for (const g of [7, 8, 9, 10, 11, 12]) {
      const parsed = CreateActivitySchema.safeParse({
        ...baseActivityPayload,
        grade_level: g,
      });
      expect(parsed.success).toBe(true);
    }

    // Test invalid grades
    const invalidLow = CreateActivitySchema.safeParse({
      ...baseActivityPayload,
      grade_level: 6,
    });
    expect(invalidLow.success).toBe(false);

    const invalidHigh = CreateActivitySchema.safeParse({
      ...baseActivityPayload,
      grade_level: 13,
    });
    expect(invalidHigh.success).toBe(false);
  });
});
