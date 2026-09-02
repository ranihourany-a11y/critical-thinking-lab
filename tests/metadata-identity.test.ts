import { describe, it, expect } from 'vitest';
import { metadata as rootMetadata } from '../src/app/layout';
import { metadata as homeMetadata } from '../src/app/page';
import { metadata as teacherMetadata } from '../src/app/teacher/layout';
import { metadata as studentMetadata } from '../src/app/student/layout';

describe('App Router Metadata Identity & Boundaries', () => {
  it('1. should configure metadataBase and root title template in root layout', () => {
    expect(rootMetadata.metadataBase).toBeDefined();
    expect(rootMetadata.metadataBase?.origin).toBe('https://critical-thinking-lab.vercel.app');

    const titleObj = rootMetadata.title as { default: string; template: string };
    expect(titleObj).toBeDefined();
    expect(titleObj.default).toContain('مختبر التفكير الناقد');
    expect(titleObj.template).toBe('%s | مختبر التفكير الناقد');
  });

  it('2. should preserve homepage title, Arabic description, and set canonical only for "/"', () => {
    expect(homeMetadata.title).toContain('مختبر التفكير الناقد');
    expect(homeMetadata.description).toContain('تطبيق تعليمي تفاعلي باللغة العربية');
    expect(homeMetadata.alternates?.canonical).toBe('/');
  });

  it('3. should set teacher title to "بوابة المعلم", preserve noindex, and omit canonical', () => {
    expect(teacherMetadata.title).toBe('بوابة المعلم');
    expect(teacherMetadata.robots).toEqual({
      index: false,
      follow: false,
      noarchive: true,
    });
    expect(teacherMetadata.alternates?.canonical).toBeUndefined();
  });

  it('4. should set student title to "جلسة التفكير الناقد", preserve noindex, and omit canonical', () => {
    expect(studentMetadata.title).toBe('جلسة التفكير الناقد');
    expect(studentMetadata.robots).toEqual({
      index: false,
      follow: false,
      noarchive: true,
    });
    expect(studentMetadata.alternates?.canonical).toBeUndefined();
  });
});
