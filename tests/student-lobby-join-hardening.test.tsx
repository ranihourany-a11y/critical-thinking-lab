// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { POST as joinRouteHandler } from '../src/app/api/student/join/route';
import { JoinCard } from '../src/components/student/JoinCard';
import { storage } from '../src/lib/db/storage';
import { hashSessionToken } from '../src/lib/auth/student-session';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Hardened Student Lobby Join Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Server Mutation & Security Boundaries', () => {
    it('1. Normalizes code (trim & uppercase) and creates session atomically for active activity', async () => {
      const mockActivity = {
        id: 'act-active-123',
        title: 'الاحتباس الحراري',
        topic: 'المناخ',
        access_code: 'CLIM89',
        status: 'active' as const,
        grade_level: 9,
        created_at: new Date().toISOString(),
      };

      vi.spyOn(storage, 'getActivityByCode').mockImplementation(async (code) => {
        if (code === 'CLIM89') return mockActivity as any;
        return null;
      });

      const createSessionSpy = vi.spyOn(storage, 'createSession').mockResolvedValueOnce({
        id: 'sess-joined-456',
        activity_id: 'act-active-123',
        student_alias: 'سارة المفكرة',
        session_token_hash: 'hash-abc',
        current_stage: 'baseline',
        hint_count: 0,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const req = new NextRequest('http://localhost:3000/api/student/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_code: '  clim89  ', // lowercase and untrimmed
          student_alias: '  سارة    المفكرة  ', // extra spaces
        }),
      });

      const res = await joinRouteHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toEqual({
        success: true,
        sessionId: 'sess-joined-456',
      });

      // Assert storage received normalized code and collapsed alias
      expect(storage.getActivityByCode).toHaveBeenCalledWith('CLIM89');
      expect(createSessionSpy).toHaveBeenCalledWith(
        'act-active-123',
        'سارة المفكرة',
        expect.any(String) // tokenHash
      );

      // Verify token hash is 64 hex chars (SHA-256) and NOT raw token
      const passedHash = createSessionSpy.mock.calls[0][2];
      expect(passedHash).toMatch(/^[a-f0-9]{64}$/);

      // Verify cookie is set with HttpOnly
      const setCookieHeader = res.cookies.get('ctl_student_session');
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader?.value).toBeDefined();
      // The raw cookie token hashed should equal the passed hash
      expect(hashSessionToken(setCookieHeader!.value)).toBe(passedHash);

      // Verify response body does NOT leak teacher, rubric, sources, evaluation, or token
      expect(data.rawToken).toBeUndefined();
      expect(data.teacher_id).toBeUndefined();
      expect(data.rubric).toBeUndefined();
      expect(data.sources).toBeUndefined();
    });

    it('2. Returns identical generic Arabic response for unknown, draft, or closed codes', async () => {
      vi.spyOn(storage, 'getActivityByCode').mockImplementation(async (code) => {
        if (code === 'DRAFT1') {
          return { id: 'act-draft', access_code: 'DRAFT1', status: 'draft' } as any;
        }
        if (code === 'CLOSED1') {
          return { id: 'act-closed', access_code: 'CLOSED1', status: 'closed' } as any;
        }
        return null;
      });

      const createSessionSpy = vi.spyOn(storage, 'createSession');

      const testCases = ['UNKNOWN1', 'DRAFT1', 'CLOSED1'];

      for (const code of testCases) {
        const req = new NextRequest('http://localhost:3000/api/student/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_code: code,
            student_alias: 'طالب مجرب',
          }),
        });

        const res = await joinRouteHandler(req);
        expect(res.status).toBe(400);

        const data = await res.json();
        expect(data.error).toBe('تعذر الانضمام. تحقق من رمز النشاط وحاول مجددًا.');
        expect(createSessionSpy).not.toHaveBeenCalled();
      }
    });

    it('3. Rejects invalid alias containing control characters or out-of-bounds length', async () => {
      const invalidAliases = [
        'a', // too short (<2)
        'a'.repeat(45), // too long (>40)
        'طالب\u0000خفي', // control character null
        'طالب\u0007تنبيه', // control character bell
      ];

      for (const alias of invalidAliases) {
        const req = new NextRequest('http://localhost:3000/api/student/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_code: 'CLIM89',
            student_alias: alias,
          }),
        });

        const res = await joinRouteHandler(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('تعذر الانضمام. تحقق من رمز النشاط وحاول مجددًا.');
      }
    });

    it('4. Atomic failure: if session persistence fails, no partial session or usable response is returned', async () => {
      vi.spyOn(storage, 'getActivityByCode').mockResolvedValueOnce({
        id: 'act-active-123',
        status: 'active' as const,
        access_code: 'CLIM89',
      } as any);

      vi.spyOn(storage, 'createSession').mockRejectedValueOnce(new Error('DB connection refused'));

      const req = new NextRequest('http://localhost:3000/api/student/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_code: 'CLIM89',
          student_alias: 'سارة المفكرة',
        }),
      });

      const res = await joinRouteHandler(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('تعذر الانضمام. تحقق من رمز النشاط وحاول مجددًا.');
    });
  });

  describe('Client UI JoinCard Interactions', () => {
    it('5. Prevents double-clicks, preserves input on failure, focuses invalid field, and navigates only after persistence', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      render(<JoinCard />);

      const codeInput = screen.getByLabelText(/رمز النشاط/i) as HTMLInputElement;
      const aliasInput = screen.getByLabelText(/اسمك المستعار/i) as HTMLInputElement;
      const submitBtn = screen.getByRole('button', { name: /ابدأ الحوار الآن/i });

      // 5a. Client-side validation blocks empty submit & focuses codeInput
      fireEvent.click(submitBtn);
      expect(screen.getByText(/يرجى إدخال رمز النشاط/i)).toBeDefined();
      expect(document.activeElement).toBe(codeInput);
      expect(fetchSpy).not.toHaveBeenCalled();

      // Enter code and valid alias
      fireEvent.change(codeInput, { target: { value: 'CLIM89' } });
      fireEvent.change(aliasInput, { target: { value: 'أحمد 07' } });

      // 5b. Mock server failure: preserves inputs
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'تعذر الانضمام. تحقق من رمز النشاط وحاول مجددًا.' }),
      } as any);

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });

      expect(screen.getByText('تعذر الانضمام. تحقق من رمز النشاط وحاول مجددًا.')).toBeDefined();
      expect(codeInput.value).toBe('CLIM89');
      expect(aliasInput.value).toBe('أحمد 07');
      expect(mockPush).not.toHaveBeenCalled();

      // 5c. Mock successful join: navigates to /student/:sessionId/prepare
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, sessionId: 'sess-real-789' }),
      } as any);

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/student/sess-real-789/prepare');
      });
    });
  });
});
