import { describe, it, expect } from 'vitest';
import {
  SEED_ACTIVITY,
  CLIMATE_CHANGE_SOURCES,
  CLIMATE_CHANGE_RUBRIC,
  CLIMATE_FIVE_STAGES,
  seedDefaultClimateActivity,
} from '../src/lib/db/seed';
import { DEV_DEFAULT_TEACHER } from '../src/lib/auth/teacher-auth';

describe('Default Climate Critical-Thinking Activity Seed & Template', () => {
  it('1. Verifies exact activity configuration: title, Grade 8, draft status, strict grounding, advocate stance, code CLIMATE-27, and 5 stages', () => {
    // Title & Topic
    expect(SEED_ACTIVITY.title).toBe('هل يساهم النشاط البشري في زيادة الاحتباس الحراري؟');
    expect(SEED_ACTIVITY.topic).toBe('هل يساهم النشاط البشري في زيادة الاحتباس الحراري؟');

    // Grade Level 8
    expect(SEED_ACTIVITY.grade_level).toBe(8);

    // Canonical Status: draft (ready for teacher review and activation)
    expect(SEED_ACTIVITY.status).toBe('draft');

    // Strict Grounding Enabled
    expect(SEED_ACTIVITY.strict_source).toBe(true);

    // Supported Allowlisted Stance Mode: advocate (argues human activity causes recent warming)
    expect(SEED_ACTIVITY.stance_mode).toBe('advocate');
    expect(SEED_ACTIVITY.ai_stance).toContain('الأنشطة البشرية');
    expect(SEED_ACTIVITY.ai_stance).toContain('حرق الوقود الأحفوري');

    // Demonstration Code
    expect(SEED_ACTIVITY.access_code).toBe('CLIMATE-27');

    // Associated with stable seed teacher
    expect(SEED_ACTIVITY.teacher_id).toBe(DEV_DEFAULT_TEACHER.id);

    // Fixed five pedagogical stages
    expect(CLIMATE_FIVE_STAGES).toEqual([
      'understanding',
      'evidence',
      'source_check',
      'counter_argument',
      'reflection',
    ]);
    expect(CLIMATE_FIVE_STAGES.length).toBe(5);
  });

  it('2. Verifies Arabic source snapshots, clear source labels, and official reference URLs', () => {
    expect(CLIMATE_CHANGE_SOURCES.length).toBe(2);

    const ipccSource = CLIMATE_CHANGE_SOURCES.find((s) => s.citation_label === '[تقرير IPCC AR6]');
    const nasaSource = CLIMATE_CHANGE_SOURCES.find((s) => s.citation_label === '[وكالة ناسا NASA]');

    expect(ipccSource).toBeDefined();
    expect(nasaSource).toBeDefined();

    // Official URLs
    expect(ipccSource!.source_url).toBe('https://www.ipcc.ch/report/ar6/syr/');
    expect(nasaSource!.source_url).toBe('https://science.nasa.gov/climate-change/causes/');

    const combinedSnapshots = `${ipccSource!.source_snapshot}\n${nasaSource!.source_snapshot}`;

    // 1. IPCC AR6: human greenhouse-gas emissions caused recent global warming; 2011–2020 was ~1.1°C above 1850–1900
    expect(combinedSnapshots).toContain('1.1');
    expect(combinedSnapshots).toContain('2011–2020');
    expect(combinedSnapshots).toContain('1850–1900');
    expect(combinedSnapshots).toContain('انبعاثات غازات الدفيئة الناتجة عن الأنشطة البشرية');

    // 2. NASA: fossil-fuel, deforestation, agriculture, industry; atmospheric CO2 risen nearly 50% since 1750
    expect(combinedSnapshots).toContain('50%');
    expect(combinedSnapshots).toContain('1750');
    expect(combinedSnapshots).toContain('حرق الوقود الأحفوري');
    expect(combinedSnapshots).toContain('إزالة الغابات');

    // 3. NASA: solar variability affects climate but does not explain recent warming; models require greenhouse gases
    expect(combinedSnapshots).toContain('التباين الشمسي');
    expect(combinedSnapshots).toContain('النماذج المناخية');

    // 4. Natural greenhouse effect supports life while additional human emissions intensify heat retention
    expect(combinedSnapshots).toContain('الاحتباس الحراري الطبيعي');
    expect(combinedSnapshots).toContain('الحياة على كوكب الأرض');

    // 5. Fair counterpoint: natural drivers influence climate, but cannot explain magnitude/pattern of recent warming
    expect(combinedSnapshots).toContain('المحركات الطبيعية');
    expect(combinedSnapshots).toContain('البصمة');
  });

  it('3. Verifies rubric weights sum to exactly 100 with bounds 0-4', () => {
    expect(CLIMATE_CHANGE_RUBRIC.length).toBe(5);

    const weights = CLIMATE_CHANGE_RUBRIC.map((c) => c.weight);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // Weights: Claim clarity: 20, Evidence use: 25, Source evaluation: 20, Counter-argument: 20, Reflection/synthesis: 15
    expect(weights).toEqual([20, 25, 20, 20, 15]);
    expect(totalWeight).toBe(100);

    // All rubric criteria must define scores 0 to 4
    for (const criterion of CLIMATE_CHANGE_RUBRIC) {
      expect(criterion.levels.length).toBe(5);
      const scores = criterion.levels.map((l) => l.score);
      expect(scores).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it('4. Verifies idempotent seeding: rerun maintains exactly 1 activity and preserves unrelated data without mutation', () => {
    // Create an isolated mock store
    const mockStore: any = {
      teachers: new Map([
        ['other-teacher-id', { id: 'other-teacher-id', email: 'other@school.edu', role: 'teacher' }],
      ]),
      activities: new Map([
        ['other-activity-id', { id: 'other-activity-id', teacher_id: 'other-teacher-id', title: 'نشاط آخر' }],
      ]),
      sources: new Map([['other-activity-id', []]]),
    };

    // First seed run
    const result1 = seedDefaultClimateActivity(mockStore);
    expect(result1.activity.id).toBe(SEED_ACTIVITY.id);
    expect(mockStore.activities.size).toBe(2); // 1 other + 1 seed
    expect(mockStore.teachers.size).toBe(2); // 1 other + 1 default

    // Second seed run (rerun)
    const result2 = seedDefaultClimateActivity(mockStore);
    expect(result2.activity.id).toBe(SEED_ACTIVITY.id);
    expect(mockStore.activities.size).toBe(2); // exactly 1 climate activity + 1 other
    expect(mockStore.activities.get(SEED_ACTIVITY.id)!.title).toBe('هل يساهم النشاط البشري في زيادة الاحتباس الحراري؟');
    expect(mockStore.activities.get(SEED_ACTIVITY.id)!.status).toBe('draft');
    expect(mockStore.activities.get(SEED_ACTIVITY.id)!.access_code).toBe('CLIMATE-27');

    // Verify unrelated data remains completely untouched
    expect(mockStore.teachers.get('other-teacher-id')!.email).toBe('other@school.edu');
    expect(mockStore.activities.get('other-activity-id')!.title).toBe('نشاط آخر');
  });
});
