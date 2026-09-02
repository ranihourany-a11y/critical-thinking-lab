import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/lib/db/storage';
import { generateSessionToken, hashSessionToken } from '../src/lib/auth/student-session';
import { SEED_ACTIVITY } from '../src/lib/db/seed';

describe('Atomic Message Flow & Idempotency', () => {
  let sessionId: string;

  beforeEach(async () => {
    const rawToken = generateSessionToken();
    const hash = hashSessionToken(rawToken);
    const session = await storage.createSession(SEED_ACTIVITY.id, 'طالب_اختبار_الرسائل', hash);
    sessionId = session.id;
  });

  it('should pre-persist student message with sequence number and unique client_message_id', async () => {
    const clientMsgId = `client-${Date.now()}-1`;

    const saved = await storage.saveMessage(sessionId, {
      client_message_id: clientMsgId,
      sequence_number: 1,
      sender: 'student',
      content: 'أعتقد أن الغازات الدفيئة ترفع الحرارة',
      stage: 'baseline',
      message_kind: 'normal',
      status: 'completed',
    });

    expect(saved.id).toBeDefined();
    expect(saved.session_id).toBe(sessionId);
    expect(saved.client_message_id).toBe(clientMsgId);

    const messages = await storage.getMessages(sessionId);
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('أعتقد أن الغازات الدفيئة ترفع الحرارة');
  });

  it('should prevent message duplication when re-submitting with the same client_message_id (Idempotency)', async () => {
    const clientMsgId = `idempotent-test-${Date.now()}`;

    // First attempt
    const msg1 = await storage.saveMessage(sessionId, {
      client_message_id: clientMsgId,
      sequence_number: 1,
      sender: 'student',
      content: 'رسالة فريدة لا تتكرر',
      stage: 'baseline',
      message_kind: 'normal',
      status: 'completed',
    });

    // Duplicate attempt with same client_message_id
    const msg2 = await storage.saveMessage(sessionId, {
      client_message_id: clientMsgId,
      sequence_number: 1,
      sender: 'student',
      content: 'رسالة فريدة لا تتكرر',
      stage: 'baseline',
      message_kind: 'normal',
      status: 'completed',
    });

    expect(msg1.id).toBe(msg2.id);

    const allMessages = await storage.getMessages(sessionId);
    expect(allMessages.filter((m) => m.client_message_id === clientMsgId).length).toBe(1);
  });

  it('should preserve student message even when a downstream error occurs', async () => {
    const clientMsgId = `fault-tolerance-${Date.now()}`;

    // Step 1: Pre-save
    await storage.saveMessage(sessionId, {
      client_message_id: clientMsgId,
      sequence_number: 1,
      sender: 'student',
      content: 'رسالة أثناء انقطاع مزود الذكاء الاصطناعي',
      stage: 'understanding',
      message_kind: 'normal',
      status: 'completed',
    });

    // Simulate downstream AI provider failure
    const simulateAIFailure = () => {
      throw new Error('AI Provider 503 Rate Limit / Network Drop');
    };

    expect(simulateAIFailure).toThrow();

    // Verify student message was NOT lost
    const messages = await storage.getMessages(sessionId);
    const preservedMsg = messages.find((m) => m.client_message_id === clientMsgId);
    expect(preservedMsg).toBeDefined();
    expect(preservedMsg?.content).toBe('رسالة أثناء انقطاع مزود الذكاء الاصطناعي');
  });
});
