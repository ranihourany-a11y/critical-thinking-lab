import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Input } from '../src/components/shared/Input';
import { JoinCard } from '../src/components/student/JoinCard';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('Form Accessibility & Validation', () => {
  it('should render inputs with proper label associations, aria-describedby, and aria-invalid only on error', () => {
    // Normal valid input
    const validHtml = renderToStaticMarkup(
      React.createElement(Input, {
        id: 'access-code',
        label: 'رمز النشاط',
        name: 'accessCode',
        required: true,
        autoComplete: 'one-time-code',
      })
    );

    expect(validHtml).toContain('for="access-code"');
    expect(validHtml).toContain('id="access-code"');
    expect(validHtml).toContain('name="accessCode"');
    expect(validHtml).toContain('required=""');
    expect(validHtml).toContain('one-time-code');
    expect(validHtml).not.toContain('aria-invalid');
    expect(validHtml).not.toContain('aria-describedby');

    // Input with error
    const errorHtml = renderToStaticMarkup(
      React.createElement(Input, {
        id: 'access-code',
        label: 'رمز النشاط',
        name: 'accessCode',
        error: 'يرجى إدخال رمز النشاط',
      })
    );

    expect(errorHtml).toContain('aria-invalid="true"');
    expect(errorHtml).toContain('aria-describedby="access-code-error"');
    expect(errorHtml).toContain('id="access-code-error"');
    expect(errorHtml).toContain('يرجى إدخال رمز النشاط');
  });

  it('should render JoinCard with stable names, required fields, and appropriate autocomplete', () => {
    const html = renderToStaticMarkup(React.createElement(JoinCard));

    expect(html).toContain('name="accessCode"');
    expect(html).toContain('name="studentAlias"');
    expect(html).toContain('one-time-code');
    expect(html).toContain('nickname');
    expect(html).toContain('for="access-code"');
    expect(html).toContain('for="student-alias"');
  });
});
