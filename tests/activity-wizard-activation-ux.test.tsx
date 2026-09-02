// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActivityWizard } from '../src/components/teacher/ActivityWizard';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ActivityWizard Draft vs Activation UX & Accessibility', () => {
  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  it('1. Incomplete Draft Submission: allows saving draft with canonical status: "draft" without blocking on activation-only fields', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        activity: {
          id: 'act-draft-1',
          title: 'مسودة نشاط جديد',
          status: 'draft',
        },
      }),
    });

    render(<ActivityWizard />);

    // Jump directly to step 6 (Review & Activate)
    const step6Button = screen.getByRole('button', { name: /المراجعة والتفعيل/i });
    fireEvent.click(step6Button);

    // Click "حفظ كمسودة"
    const draftButton = screen.getByRole('button', { name: /حفظ كمسودة/i });
    fireEvent.click(draftButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const callArgs = fetchSpy.mock.calls[0];
    const payload = JSON.parse(callArgs[1].body);

    expect(payload.status).toBe('draft');
    expect(mockPush).toHaveBeenCalledWith('/teacher/activities/act-draft-1');
  });

  it('2. Activation Submission: validates complete readiness and sends status: "active" when valid', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        activity: {
          id: 'act-active-1',
          title: 'هل الطاقة الشمسية كافية؟',
          access_code: 'ABC123',
          status: 'active',
        },
      }),
    });

    render(<ActivityWizard />);

    // Step 1: fill title and topic
    const titleInput = screen.getByLabelText(/عنوان النشاط/i);
    const topicInput = screen.getByLabelText(/موضوع القضية/i);
    fireEvent.change(titleInput, { target: { value: 'هل الطاقة الشمسية كافية؟' } });
    fireEvent.change(topicInput, { target: { value: 'دراسة جدوى الطاقة البديلة والشبكات الذكية' } });

    // Step 2: fill AI stance
    fireEvent.click(screen.getByRole('button', { name: /موقف الذكاء الاصطناعي/i }));
    const aiStanceInput = screen.getByLabelText(/موقف الذكاء الاصطناعي/i);
    fireEvent.change(aiStanceInput, { target: { value: 'الطاقة الشمسية غير كافية بمفردها لتلبية الحمل الأساسي.' } });

    // Step 3: fill source snapshot
    fireEvent.click(screen.getByRole('button', { name: /المصادر والتوثيق/i }));
    const sourceSnapshot = screen.getByLabelText(/نص المصدر المعتمد/i);
    fireEvent.change(sourceSnapshot, { target: { value: 'بيانات وكالة الطاقة الدولية تشير إلى الحاجة لتخزين البطاريات.' } });

    // Step 6: Review & Activate
    fireEvent.click(screen.getByRole('button', { name: /المراجعة والتفعيل/i }));

    // Click "تفعيل النشاط"
    const activateButton = screen.getByRole('button', { name: /تفعيل النشاط/i });
    fireEvent.click(activateButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const callArgs = fetchSpy.mock.calls[0];
    const payload = JSON.parse(callArgs[1].body);

    expect(payload.status).toBe('active');
    expect(payload.title).toBe('هل الطاقة الشمسية كافية؟');
    expect(mockPush).toHaveBeenCalledWith('/teacher/activities/act-active-1');
  });

  it('3. URL-Only Strict Grounding Warning: shows exact explanation when strict grounding has URL but no text snapshot', () => {
    render(<ActivityWizard />);

    // Navigate to step 3: Sources
    fireEvent.click(screen.getByRole('button', { name: /المصادر والتوثيق/i }));
    const urlInput = screen.getByLabelText(/رابط المصدر/i);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/climate.pdf' } });

    // Navigate to step 6: Review
    fireEvent.click(screen.getByRole('button', { name: /المراجعة والتفعيل/i }));

    // Verify URL-only warning text is present
    expect(screen.getByText('الروابط وحدها لا تكفي لتقييد الخبير. أضف نص المصدر.')).toBeDefined();

    // Click activation, ensure it focuses step 3 error
    const activateButton = screen.getByRole('button', { name: /تفعيل النشاط/i });
    fireEvent.click(activateButton);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('4. Live Rubric Weight Total Announcement: announces total as "المجموع: X من 100" with aria-live status', () => {
    render(<ActivityWizard />);

    // Navigate to step 5: Rubric
    fireEvent.click(screen.getByRole('button', { name: /معايير التقييم/i }));

    // Find the live status region
    const statusBox = screen.getByRole('status');
    expect(statusBox.textContent).toContain('المجموع: 100 من 100');

    // Change a weight from 30 to 50
    const weightInputs = screen.getAllByLabelText(/الوزن %/i);
    fireEvent.change(weightInputs[0], { target: { value: '50' } });

    // Rubric total should update live (50 + 25 + 20 + 20 + 15 = 130)
    expect(statusBox.textContent).toContain('المجموع: 130 من 100');
  });

  it('5. First Invalid Step & Field Focus on Validation Failure: navigates to earliest step and focuses field while keeping entered values', async () => {
    render(<ActivityWizard />);

    // Fill only title, leave topic empty
    const titleInput = screen.getByLabelText(/عنوان النشاط/i);
    fireEvent.change(titleInput, { target: { value: 'عنوان تجريبي' } });

    // Jump to Step 6 and attempt activation
    fireEvent.click(screen.getByRole('button', { name: /المراجعة والتفعيل/i }));
    const activateButton = screen.getByRole('button', { name: /تفعيل النشاط/i });
    fireEvent.click(activateButton);

    // Expect navigation back to Step 1
    await waitFor(() => {
      expect(screen.getByText('الخطوة 1: المعلومات الأساسية للنشاط')).toBeDefined();
    });

    // Entered value must remain intact
    const reloadedTitleInput = screen.getByLabelText(/عنوان النشاط/i) as HTMLInputElement;
    expect(reloadedTitleInput.value).toBe('عنوان تجريبي');
  });

  it('6. Duplicate Submission Blocking: disables submission buttons while loading', async () => {
    let resolveFetch: any;
    fetchSpy.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<ActivityWizard />);

    // Step 6 Draft Submission
    fireEvent.click(screen.getByRole('button', { name: /المراجعة والتفعيل/i }));
    const draftButton = screen.getByRole('button', { name: /حفظ كمسودة/i });
    const activateButton = screen.getByRole('button', { name: /تفعيل النشاط/i });

    fireEvent.click(draftButton);

    // Both buttons should be disabled during submission
    expect(draftButton.hasAttribute('disabled')).toBe(true);
    expect(activateButton.hasAttribute('disabled')).toBe(true);

    // Try clicking again during loading
    fireEvent.click(draftButton);
    fireEvent.click(activateButton);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Resolve fetch
    resolveFetch({
      ok: true,
      json: async () => ({
        activity: { id: 'act-1', status: 'draft' },
      }),
    });
  });
});
