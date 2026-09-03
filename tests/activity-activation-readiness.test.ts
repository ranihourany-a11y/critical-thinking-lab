import { describe, it, expect, beforeEach } from 'vitest';
import { storage, dbStore } from '../src/lib/db/storage';
import { DEV_DEFAULT_TEACHER } from '../src/lib/auth/teacher-auth';
import { POST as createActivityHandler } from '../src/app/api/teacher/activities/route';
import { PATCH as updateActivityPatchHandler } from '../src/app/api/teacher/activities/[id]/route';
import { validateActivityActivation } from '../src/lib/validation/activity';
import { NextRequest } from 'next/server';

describe('Activity Activation-Readiness Server Gate', () => {
  let teacherCookie: string;
  let teacherId: string;

  beforeEach(() => {
    teacherId = DEV_DEFAULT_TEACHER.id;
    const authPayload = {
      id: DEV_DEFAULT_TEACHER.id,
      email: DEV_DEFAULT_TEACHER.email,
      role: 'teacher' as const,
    };
    teacherCookie = `ctl_teacher_session=${Buffer.from(JSON.stringify(authPayload)).toString('base64')}`;
  });

  it('1. Incomplete Draft Saving: allows saving an incomplete activity as an inactive draft', async () => {
    const draftPayload = {
      title: 'مسودة نشاط غير مكتمل',
      topic: '', // empty topic allowed for draft
      status: 'draft',
      rubric_config: [], // incomplete rubric allowed for draft
      sources: [],
    };

    const req = new NextRequest('http://localhost:3000/api/teacher/activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: teacherCookie,
      },
      body: JSON.stringify(draftPayload),
    });

    const res = await createActivityHandler(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.activity.id).toBeDefined();
    expect(data.activity.status).toBe('draft');
    expect(data.activity.title).toBe('مسودة نشاط غير مكتمل');

    // Inspect real persisted database mutation payload: canonical 'status' exists, 'is_active' does not
    const stored = dbStore.activities.get(data.activity.id);
    expect(stored).toBeDefined();
    expect(stored?.status).toBe('draft');
    expect('is_active' in (stored as any)).toBe(false);
    expect((stored as any).is_active).toBeUndefined();
  });

  it('2. Strict Activation Rejection without Source Text: rejects activation if strict_source is on and sources have no text', async () => {
    const invalidActivePayload = {
      title: 'نشاط بيئي بدون نصوص',
      topic: 'أسباب الاحتباس الحراري',
      grade_level: 9,
      stance_mode: 'contrarian',
      ai_stance: 'الاحتباس الحراري طبيعي بالكامل',
      strict_source: true,
      status: 'active',
      rubric_config: [
        {
          id: 'crit-1',
          title: 'الاستدلال بالأدلة',
          description: 'توظيف البيانات',
          weight: 100,
          levels: [
            { score: 0, descriptor: 'معدوم' },
            { score: 1, descriptor: 'مبتدئ' },
            { score: 2, descriptor: 'متوسط' },
            { score: 3, descriptor: 'كفء' },
            { score: 4, descriptor: 'متميز' },
          ],
        },
      ],
      sources: [], // No source snapshot provided
    };

    const req = new NextRequest('http://localhost:3000/api/teacher/activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: teacherCookie,
      },
      body: JSON.stringify(invalidActivePayload),
    });

    const res = await createActivityHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('ACTIVATION_VALIDATION_FAILED');
    expect(data.details.sources).toBeDefined();
  });

  it('3. URL-Only Source Rejection: source URLs without extracted snapshot text fail strict activation readiness', () => {
    const activityWithUrlOnly = {
      title: 'نشاط ذكاء اصطناعي',
      topic: 'أخلاقيات الذكاء الاصطناعي',
      grade_level: 10,
      stance_mode: 'contrarian',
      ai_stance: 'الذكاء الاصطناعي لا يحتاج تنظيم',
      strict_source: true,
      rubric_config: [
        {
          id: 'crit-1',
          title: 'المعيار',
          description: 'الوصف',
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
      sources: [
        {
          id: 'src-1',
          title: 'رابط خارجي فقط',
          source_type: 'url' as const,
          source_url: 'https://example.com/study.pdf',
          source_snapshot: '', // Empty text snapshot!
          citation_label: '[دراسة 2024]',
        },
      ],
    };

    const result = validateActivityActivation(activityWithUrlOnly, activityWithUrlOnly.sources);
    expect(result.valid).toBe(false);
    expect(result.errors.sources).toBeDefined();
    expect(result.errors.sources[0]).toContain('روابط المصادر (URLs) وحدها لا تكفي');
  });

  it('4. Rubric Weight Total Rejection: rejects activation if rubric weights do not equal 100%', () => {
    const activityWithInvalidRubric = {
      title: 'نشاط روبورك غير مكتمل',
      topic: 'الطاقة المتجددة',
      grade_level: 11,
      stance_mode: 'adaptive',
      ai_stance: 'موقف متكيف',
      strict_source: false,
      rubric_config: [
        {
          id: 'crit-1',
          title: 'المعيار الأول',
          description: 'الوصف',
          weight: 40, // 40 + 30 = 70 != 100
          levels: [
            { score: 0, descriptor: '0' },
            { score: 1, descriptor: '1' },
            { score: 2, descriptor: '2' },
            { score: 3, descriptor: '3' },
            { score: 4, descriptor: '4' },
          ],
        },
        {
          id: 'crit-2',
          title: 'المعيار الثاني',
          description: 'الوصف',
          weight: 30,
          levels: [
            { score: 0, descriptor: '0' },
            { score: 1, descriptor: '1' },
            { score: 2, descriptor: '2' },
            { score: 3, descriptor: '3' },
            { score: 4, descriptor: '4' },
          ],
        },
      ],
    };

    const result = validateActivityActivation(activityWithInvalidRubric);
    expect(result.valid).toBe(false);
    expect(result.errors.rubric_config).toBeDefined();
    expect(result.errors.rubric_config[0]).toContain('100%');
  });

  it('5. Successful Valid Activation: allows creating and activating a fully qualified activity', async () => {
    const validActivePayload = {
      title: 'نشاط استكشاف المريخ',
      topic: 'هل الاستيطان البشري للمريخ مجدٍ اقتصادياً وعلمياً؟',
      grade_level: 12,
      stance_mode: 'contrarian',
      ai_stance: 'الاستيطان غير عملي والأولى التركيز على الأرض',
      strict_source: true,
      status: 'active',
      rubric_config: [
        {
          id: 'crit-1',
          title: 'تحليل البيانات العلمية',
          description: 'الاستدلال بالحقائق',
          weight: 50,
          levels: [
            { score: 0, descriptor: '0' },
            { score: 1, descriptor: '1' },
            { score: 2, descriptor: '2' },
            { score: 3, descriptor: '3' },
            { score: 4, descriptor: '4' },
          ],
        },
        {
          id: 'crit-2',
          title: 'التعامل مع الحجج المقابلة',
          description: 'تفنيد الحجة المضادة',
          weight: 50,
          levels: [
            { score: 0, descriptor: '0' },
            { score: 1, descriptor: '1' },
            { score: 2, descriptor: '2' },
            { score: 3, descriptor: '3' },
            { score: 4, descriptor: '4' },
          ],
        },
      ],
      sources: [
        {
          title: 'تقرير وكالة ناسا للمريخ',
          source_type: 'text',
          source_snapshot: 'تظهر قياسات مركبة بيرسيفيرنس وجود مركبات عضوية في فوهة جيزيرو وتحديات إشعاعية كبرى.',
          citation_label: '[تقرير ناسا 2024]',
        },
      ],
    };

    const req = new NextRequest('http://localhost:3000/api/teacher/activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: teacherCookie,
      },
      body: JSON.stringify(validActivePayload),
    });

    const res = await createActivityHandler(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.activity.id).toBeDefined();
    expect(data.activity.status).toBe('active');
    expect(data.activity.access_code).toBeDefined();

    // Inspect real persisted database mutation payload for active activity
    const stored = dbStore.activities.get(data.activity.id);
    expect(stored).toBeDefined();
    expect(stored?.status).toBe('active');
    expect('is_active' in (stored as any)).toBe(false);
    expect((stored as any).is_active).toBeUndefined();
  });

  it('6. Non-Owner Rejection: non-owner teacher cannot activate or modify an activity', async () => {
    // Create draft activity by teacher 1
    const draft = await storage.createActivity(teacherId, {
      title: 'نشاط معلم 1',
      topic: 'موضوع النشاط',
      grade_level: 8,
      status: 'draft',
      language: 'ar',
      stance_mode: 'contrarian',
      ai_stance: 'موقف',
      strict_source: false,
      max_turns: 8,
      rubric_config: [],
      sources: [],
    });

    // Other teacher credentials
    const otherTeacher = {
      id: '00000000-0000-0000-0000-000000000099',
      email: 'other_teacher_gate@ctl.school.edu',
      role: 'teacher' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    dbStore.teachers.set(otherTeacher.id, otherTeacher);
    const otherCookie = `ctl_teacher_session=${Buffer.from(JSON.stringify(otherTeacher)).toString('base64')}`;

    const patchReq = new NextRequest(`http://localhost:3000/api/teacher/activities/${draft.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: otherCookie,
      },
      body: JSON.stringify({ status: 'active' }),
    });

    const patchRes = await updateActivityPatchHandler(patchReq, {
      params: Promise.resolve({ id: draft.id }),
    });

    expect(patchRes.status).toBe(403);
  });

  it('7. Rollback & Atomic Invariance: failed activation of an incomplete draft leaves the draft status unchanged', async () => {
    // Save draft with missing rubric and source text
    const draft = await storage.createActivity(teacherId, {
      title: 'مسودة قيد الإعداد',
      topic: 'تغير المناخ',
      grade_level: 8,
      status: 'draft',
      language: 'ar',
      stance_mode: 'contrarian',
      ai_stance: 'موقف',
      strict_source: true,
      max_turns: 8,
      rubric_config: [],
      sources: [],
    });

    // Attempt to activate without fulfilling requirements
    const patchReq = new NextRequest(`http://localhost:3000/api/teacher/activities/${draft.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: teacherCookie,
      },
      body: JSON.stringify({ status: 'active' }),
    });

    const patchRes = await updateActivityPatchHandler(patchReq, {
      params: Promise.resolve({ id: draft.id }),
    });

    expect(patchRes.status).toBe(400);
    const patchData = await patchRes.json();
    expect(patchData.error).toBe('ACTIVATION_VALIDATION_FAILED');

    // Verify activity record remains in draft status without mutation
    const stored = await storage.getActivity(draft.id);
    expect(stored?.status).toBe('draft');
  });
});
