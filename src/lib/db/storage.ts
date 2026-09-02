import {
  Activity,
  ActivitySource,
  ActivityStatus,
  Evaluation,
  Message,
  MessageStatus,
  PedagogicalStage,
  Session,
  Teacher,
  DEV_DEFAULT_TEACHER,
} from './schema';
import { CLIMATE_CHANGE_SOURCES, SEED_ACTIVITY } from './seed';
import { CreateActivityInput } from '../validation/activity';

// In-memory / persistent runtime data store
interface DatabaseStore {
  teachers: Map<string, Teacher>;
  activities: Map<string, Activity>;
  sources: Map<string, ActivitySource[]>;
  sessions: Map<string, Session>;
  messages: Map<string, Message[]>;
  evaluations: Map<string, Evaluation>;
}

// Global singleton in Node environment
const globalForStore = globalThis as unknown as { ctlStore?: DatabaseStore };

function initStore(): DatabaseStore {
  const store: DatabaseStore = {
    teachers: new Map(),
    activities: new Map(),
    sources: new Map(),
    sessions: new Map(),
    messages: new Map(),
    evaluations: new Map(),
  };

  // Seed default teacher
  store.teachers.set(DEV_DEFAULT_TEACHER.id, {
    ...DEV_DEFAULT_TEACHER,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Seed default climate activity
  store.activities.set(SEED_ACTIVITY.id, { ...SEED_ACTIVITY });

  const seededSources: ActivitySource[] = CLIMATE_CHANGE_SOURCES.map((s, idx) => ({
    id: `src-seed-${idx + 1}`,
    activity_id: SEED_ACTIVITY.id,
    title: s.title,
    source_type: s.source_type,
    source_snapshot: s.source_snapshot,
    source_url: s.source_url || null,
    citation_label: s.citation_label,
    created_at: new Date().toISOString(),
  }));
  store.sources.set(SEED_ACTIVITY.id, seededSources);

  return store;
}

export const dbStore: DatabaseStore = globalForStore.ctlStore || (globalForStore.ctlStore = initStore());

export class StorageService {
  // Teacher operations
  async getTeacher(id: string): Promise<Teacher | null> {
    return dbStore.teachers.get(id) || null;
  }

  async getTeacherByEmail(email: string): Promise<Teacher | null> {
    const normalized = email.trim().toLowerCase();
    for (const t of dbStore.teachers.values()) {
      if (t.email.toLowerCase() === normalized) {
        return t;
      }
    }
    return null;
  }

  // Activity operations
  async getActivities(teacherId: string): Promise<Activity[]> {
    const list = Array.from(dbStore.activities.values()).filter((a) => a.teacher_id === teacherId);
    return list.map((a) => ({
      ...a,
      sources: dbStore.sources.get(a.id) || [],
    }));
  }

  async getActivity(id: string): Promise<Activity | null> {
    const activity = dbStore.activities.get(id);
    if (!activity) return null;
    return {
      ...activity,
      sources: dbStore.sources.get(activity.id) || [],
    };
  }

  async getActivityByCode(code: string): Promise<Activity | null> {
    const normalized = code.trim().toUpperCase();
    const activity = Array.from(dbStore.activities.values()).find(
      (a) => a.access_code.toUpperCase() === normalized || (normalized === 'CLIM89' && a.id === SEED_ACTIVITY.id)
    );
    if (!activity) return null;
    return {
      ...activity,
      sources: dbStore.sources.get(activity.id) || [],
    };
  }

  async createActivity(teacherId: string, input: CreateActivityInput): Promise<Activity> {
    const activityId = crypto.randomUUID();
    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newActivity: Activity = {
      id: activityId,
      teacher_id: teacherId,
      title: input.title,
      topic: input.topic,
      grade_level: input.grade_level,
      language: input.language || 'ar',
      stance_mode: input.stance_mode,
      ai_stance: input.ai_stance,
      strict_source: input.strict_source,
      rubric_config: input.rubric_config,
      access_code: accessCode,
      max_turns: input.max_turns,
      status: input.status,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    dbStore.activities.set(activityId, newActivity);

    const sources: ActivitySource[] = (input.sources || []).map((s, idx) => ({
      id: s.id || crypto.randomUUID(),
      activity_id: activityId,
      title: s.title,
      source_type: s.source_type,
      source_snapshot: s.source_snapshot,
      source_url: s.source_url || null,
      citation_label: s.citation_label || `[المصدر ${idx + 1}]`,
      created_at: new Date().toISOString(),
    }));

    dbStore.sources.set(activityId, sources);

    return {
      ...newActivity,
      sources,
    };
  }

  async updateActivityStatus(id: string, status: ActivityStatus): Promise<Activity | null> {
    const activity = dbStore.activities.get(id);
    if (!activity) return null;
    activity.status = status;
    activity.updated_at = new Date().toISOString();
    dbStore.activities.set(id, activity);
    return activity;
  }

  async getSources(activityId: string): Promise<ActivitySource[]> {
    return dbStore.sources.get(activityId) || [];
  }

  // Session operations
  async createSession(activityId: string, studentAlias: string, tokenHash: string): Promise<Session> {
    const sessionId = crypto.randomUUID();
    const session: Session = {
      id: sessionId,
      activity_id: activityId,
      student_alias: studentAlias,
      session_token_hash: tokenHash,
      initial_stance: null,
      initial_reason: null,
      initial_confidence: null,
      final_stance: null,
      final_confidence: null,
      strongest_evidence: null,
      strongest_counterargument: null,
      remaining_uncertainty: null,
      final_reflection: null,
      current_stage: 'baseline',
      hint_count: 0,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    dbStore.sessions.set(sessionId, session);
    dbStore.messages.set(sessionId, []);
    return session;
  }

  async getSessionByTokenHash(tokenHash: string): Promise<Session | null> {
    for (const session of dbStore.sessions.values()) {
      if (session.session_token_hash === tokenHash) {
        return session;
      }
    }
    return null;
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    return dbStore.sessions.get(sessionId) || null;
  }

  async getSessionsForActivity(activityId: string): Promise<Session[]> {
    return Array.from(dbStore.sessions.values()).filter((s) => s.activity_id === activityId);
  }

  async updateSessionPrepare(
    sessionId: string,
    data: { initial_stance: string; initial_reason: string; initial_confidence: number }
  ): Promise<Session | null> {
    const session = dbStore.sessions.get(sessionId);
    if (!session) return null;

    session.initial_stance = data.initial_stance;
    session.initial_reason = data.initial_reason;
    session.initial_confidence = data.initial_confidence;
    session.updated_at = new Date().toISOString();
    dbStore.sessions.set(sessionId, session);
    return session;
  }

  async updateSessionStage(
    sessionId: string,
    nextStage: PedagogicalStage,
    hintUsed: boolean = false
  ): Promise<Session | null> {
    const session = dbStore.sessions.get(sessionId);
    if (!session) return null;

    session.current_stage = nextStage;
    if (hintUsed) {
      session.hint_count += 1;
    }
    session.updated_at = new Date().toISOString();
    dbStore.sessions.set(sessionId, session);
    return session;
  }

  async updateSessionReflection(
    sessionId: string,
    data: {
      final_stance: string;
      final_confidence: number;
      strongest_evidence: string;
      strongest_counterargument: string;
      remaining_uncertainty: string;
      final_reflection: string;
    }
  ): Promise<Session | null> {
    const session = dbStore.sessions.get(sessionId);
    if (!session) return null;

    const previousSnapshot = { ...session };
    try {
      const updated: Session = {
        ...session,
        final_stance: data.final_stance,
        final_confidence: data.final_confidence,
        strongest_evidence: data.strongest_evidence,
        strongest_counterargument: data.strongest_counterargument,
        remaining_uncertainty: data.remaining_uncertainty,
        final_reflection: data.final_reflection,
        current_stage: 'submitted',
        status: 'submitted',
        updated_at: new Date().toISOString(),
      };

      dbStore.sessions.set(sessionId, updated);
      return updated;
    } catch (err) {
      dbStore.sessions.set(sessionId, previousSnapshot);
      throw err;
    }
  }

  // Message operations (Atomic)
  async getMessages(sessionId: string): Promise<Message[]> {
    const list = dbStore.messages.get(sessionId) || [];
    return [...list].sort((a, b) => a.sequence_number - b.sequence_number);
  }

  async getMessageByClientId(sessionId: string, clientMessageId: string): Promise<Message | null> {
    const list = dbStore.messages.get(sessionId) || [];
    return list.find((m) => m.client_message_id === clientMessageId) || null;
  }

  async saveMessage(
    sessionId: string,
    msg: Omit<Message, 'id' | 'session_id' | 'created_at'>
  ): Promise<Message> {
    const list = dbStore.messages.get(sessionId) || [];
    const existing = list.find((m) => m.client_message_id === msg.client_message_id);
    if (existing) {
      return existing;
    }

    const message: Message = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      ...msg,
      created_at: new Date().toISOString(),
    };

    list.push(message);
    dbStore.messages.set(sessionId, list);
    return message;
  }

  async updateMessageStatus(sessionId: string, messageId: string, status: MessageStatus): Promise<void> {
    const list = dbStore.messages.get(sessionId) || [];
    const found = list.find((m) => m.id === messageId);
    if (found) {
      found.status = status;
    }
  }

  // Evaluation operations
  async getEvaluation(sessionId: string): Promise<Evaluation | null> {
    return dbStore.evaluations.get(sessionId) || null;
  }

  async saveEvaluation(evaluation: Evaluation): Promise<Evaluation> {
    dbStore.evaluations.set(evaluation.session_id, evaluation);
    return evaluation;
  }

  async updateEvaluationApproval(
    sessionId: string,
    approved: boolean,
    feedback?: string
  ): Promise<Evaluation | null> {
    const evalRecord = dbStore.evaluations.get(sessionId);
    if (!evalRecord) return null;

    evalRecord.teacher_approved = approved;
    if (feedback !== undefined) {
      evalRecord.suggested_feedback = feedback;
    }
    evalRecord.updated_at = new Date().toISOString();
    dbStore.evaluations.set(sessionId, evalRecord);
    return evalRecord;
  }
}

export const storage = new StorageService();
