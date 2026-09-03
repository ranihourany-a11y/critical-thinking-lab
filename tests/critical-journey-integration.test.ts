import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage, dbStore } from '../src/lib/db/storage';
import { DEV_DEFAULT_TEACHER } from '../src/lib/auth/teacher-auth';
import { CLIMATE_CHANGE_RUBRIC } from '../src/lib/db/seed';
import { POST as teacherActivitiesPostHandler } from '../src/app/api/teacher/activities/route';
import {
  GET as teacherActivityGetHandler,
  PATCH as teacherActivityPatchHandler,
} from '../src/app/api/teacher/activities/[id]/route';
import {
  GET as teacherSessionGetHandler,
  POST as teacherSessionPostHandler,
  PATCH as teacherSessionPatchHandler,
} from '../src/app/api/teacher/sessions/[id]/route';
import { POST as studentJoinHandler } from '../src/app/api/student/join/route';
import {
  GET as studentSessionGetHandler,
  POST as studentSessionPostHandler,
} from '../src/app/api/student/session/route';
import { POST as studentChatHandler } from '../src/app/api/student/chat/route';
import { POST as studentSubmitHandler } from '../src/app/api/student/submit/route';
import { dialogueEngine } from '../src/lib/ai/dialogue-engine';
import { STUDENT_SESSION_COOKIE } from '../src/lib/auth/student-session';
import { TEACHER_SESSION_COOKIE } from '../src/lib/auth/teacher-auth';
import { NextRequest } from 'next/server';

describe('Critical Educational Journey Integration: End-to-End Workflow', () => {
  const ownerTeacher = {
    id: DEV_DEFAULT_TEACHER.id,
    email: DEV_DEFAULT_TEACHER.email,
    role: 'teacher' as const,
  };
  const ownerCookie = `${TEACHER_SESSION_COOKIE}=${Buffer.from(JSON.stringify(ownerTeacher)).toString('base64')}`;

  const nonOwnerTeacher = {
    id: '00000000-0000-0000-0000-000000000099',
    email: 'intruder@other.school.edu',
    role: 'teacher' as const,
  };
  const nonOwnerCookie = `${TEACHER_SESSION_COOKIE}=${Buffer.from(JSON.stringify(nonOwnerTeacher)).toString('base64')}`;

  beforeEach(async () => {
    // Register both teachers in storage
    dbStore.teachers.set(ownerTeacher.id, {
      id: ownerTeacher.id,
      email: ownerTeacher.email,
      role: 'teacher',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    dbStore.teachers.set(nonOwnerTeacher.id, {
      id: nonOwnerTeacher.id,
      email: nonOwnerTeacher.email,
      role: 'teacher',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  it('executes the full teacher/student critical journey seamlessly with strict security and privacy gates', async () => {
    // =========================================================================
    // STEP 1: Authorized Teacher Saves an Incomplete Draft Activity
    // =========================================================================
    const draftPayload = {
      title: 'مناظرة الطاقة النظيفة والتنمية المستدامة',
      topic: 'هل التحول السريع للطاقة المتجددة يضمن حماية المناخ والعدالة الاقتصادية؟',
      grade_level: 9,
      language: 'ar',
      max_turns: 10,
      stance_mode: 'advocate' as const,
      ai_stance: 'التحول للطاقة النظيفة هو الخيار العلمي الوحيد لحماية الكوكب وتقليل الانبعاثات الحرارية.',
      strict_source: true,
      status: 'draft' as const,
      rubric_config: CLIMATE_CHANGE_RUBRIC,
      sources: [
        {
          title: 'تقرير الوكالة الدولية للطاقة المتجددة (IRENA)',
          source_type: 'text' as const,
          citation_label: '[IRENA 2023]',
          source_snapshot: 'توضح بيانات IRENA أن تكلفة توليد الكهرباء من الطاقة الشمسية انخفضت بنسبة 88% خلال العقد الأخير، مما يجعلها منافساً اقتصادياً حاسماً للوقود الأحفوري.',
          source_url: 'https://www.irena.org/publications',
        },
        {
          title: 'دراسة مرصد المناخ الاقتصادي',
          source_type: 'text' as const,
          citation_label: '[مرصد المناخ]',
          source_snapshot: 'التحول الطاقي يوفر ملايين فرص العمل الجديدة لكنه يتطلب استثمارات استباقية في شبكات النقل وتخزين الطاقة لضمان أمن التزود.',
          source_url: 'https://example.org/climate-economy',
        },
      ],
    };

    const draftReq = new NextRequest('http://localhost:3000/api/teacher/activities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: ownerCookie,
      },
      body: JSON.stringify(draftPayload),
    });

    const draftRes = await teacherActivitiesPostHandler(draftReq);
    expect(draftRes.status).toBe(201);
    const draftData = await draftRes.json();
    const createdActivity = draftData.activity;

    expect(createdActivity.id).toBeDefined();
    expect(createdActivity.status).toBe('draft');
    expect(createdActivity.access_code).toBeDefined();
    const accessCode = createdActivity.access_code;

    // =========================================================================
    // STEP 2: Student Tries to Join Draft Activity -> Generically Rejected
    // =========================================================================
    const earlyJoinReq = new NextRequest('http://localhost:3000/api/student/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_code: accessCode,
        student_alias: 'سارة_المناظرة',
      }),
    });

    const earlyJoinRes = await studentJoinHandler(earlyJoinReq);
    expect(earlyJoinRes.status).toBe(400);
    const earlyJoinData = await earlyJoinRes.json();
    expect(earlyJoinData.error).toBe('تعذر الانضمام. تحقق من رمز النشاط وحاول مجددًا.');

    // =========================================================================
    // STEP 3: Teacher Activates the Activity (Activation Readiness Gate)
    // =========================================================================
    const activateReq = new NextRequest(`http://localhost:3000/api/teacher/activities/${createdActivity.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: ownerCookie,
      },
      body: JSON.stringify({
        status: 'active',
      }),
    });

    const activateRes = await teacherActivityPatchHandler(activateReq, {
      params: Promise.resolve({ id: createdActivity.id }),
    });
    expect(activateRes.status).toBe(200);
    const activateData = await activateRes.json();
    expect(activateData.activity.status).toBe('active');

    // =========================================================================
    // STEP 4: Student Joins Active Activity & Submits Preparation
    // =========================================================================
    const joinReq = new NextRequest('http://localhost:3000/api/student/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_code: accessCode.toLowerCase(), // Verify case-insensitive join
        student_alias: 'سارة_المناظرة',
      }),
    });

    const joinRes = await studentJoinHandler(joinReq);
    expect(joinRes.status).toBe(200);
    const joinData = await joinRes.json();
    expect(joinData.sessionId).toBeDefined();
    const sessionId = joinData.sessionId;

    // Extract student cookie
    const setCookieHeader = joinRes.cookies.get(STUDENT_SESSION_COOKIE);
    expect(setCookieHeader).toBeDefined();
    const rawStudentToken = setCookieHeader!.value;
    const studentCookie = `${STUDENT_SESSION_COOKIE}=${rawStudentToken}`;

    // Student Submits Preparation (Initial Stance & Confidence)
    const prepReq = new NextRequest('http://localhost:3000/api/student/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: studentCookie,
      },
      body: JSON.stringify({
        initial_stance: 'أؤيد التحول السريع للطاقة الشمسية والرياح كأولوية قصوى لحماية المناخ',
        initial_reason: 'لأن انخفاض تكلفة توليد الكهرباء الشمسية بنسبة 88% يثبت جدواها الاقتصادية والبيئية معاً',
        initial_confidence: 4,
        rules_accepted: true,
      }),
    });

    const prepRes = await studentSessionPostHandler(prepReq);
    expect(prepRes.status).toBe(200);
    const prepData = await prepRes.json();
    expect(prepData.session.current_stage).toBe('baseline');

    // =========================================================================
    // STEP 5: Socratic Debate across Stages with Persistence Order Verification
    // =========================================================================
    // Verify persistence order: student message MUST be saved before dialogue AI is called
    let studentPersistedBeforeAI = false;
    const originalSaveMessage = storage.saveMessage.bind(storage);
    vi.spyOn(storage, 'saveMessage').mockImplementation(async (sId, msg) => {
      const saved = await originalSaveMessage(sId, msg);
      return saved;
    });

    const processTurnSpy = vi.spyOn(dialogueEngine, 'processTurn').mockImplementation(async (params) => {
      const messagesSoFar = await storage.getMessages(sessionId);
      const studentMsg = messagesSoFar.find((m) => m.sender === 'student' && m.client_message_id === 'turn-1-student');
      if (studentMsg) {
        studentPersistedBeforeAI = true;
      }
      return {
        reply: 'تحليل دقيق ومهم يا سارة_المناظرة! ولكن كيف تدعمين هذا الرأي بالأرقام المقارنة الواردة في تقرير IRENA؟',
        next_stage: 'evidence',
        question_type: 'evidence_request',
        used_source_ids: [draftPayload.sources[0].title],
        unsupported_claim_refused: false,
        stage_objective_satisfied: true,
      };
    });

    // Turn 1: Understanding -> advances to Evidence
    const turn1Req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: studentCookie,
      },
      body: JSON.stringify({
        client_message_id: 'turn-1-student',
        content: 'تقرير IRENA يؤكد أن التحول لم يعد عبئاً مالياً بل فرصة تنموية حقيقية',
        message_kind: 'normal',
      }),
    });

    const turn1Res = await studentChatHandler(turn1Req);
    expect(turn1Res.status).toBe(200);
    const turn1Data = await turn1Res.json();
    expect(turn1Data.stage).toBe('evidence');
    expect(studentPersistedBeforeAI).toBe(true);
    processTurnSpy.mockRestore();

    const agePreviousMessages = async () => {
      const msgs = await storage.getMessages(sessionId);
      msgs.forEach((m) => {
        m.created_at = new Date(Date.now() - 3000).toISOString();
      });
    };

    // Turn 2: Evidence -> advances to Source Check
    await agePreviousMessages();
    const turn2Req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: studentCookie,
      },
      body: JSON.stringify({
        client_message_id: 'turn-2-student',
        content: 'البيانات تثبت هبوط التكلفة بنسبة 88% مما يجعل الاستثمار في الطاقة المتجددة أكثر ربحية واستدامة من الاستمرار في النفط والغاز',
        message_kind: 'normal',
      }),
    });

    const turn2Res = await studentChatHandler(turn2Req);
    expect(turn2Res.status).toBe(200);
    const turn2Data = await turn2Res.json();
    expect(turn2Data.stage).toBe('source_check');

    // Turn 3: Student Requests a Hint -> Stage remains unchanged, hint_count increments
    await agePreviousMessages();
    const hintReq = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: studentCookie,
      },
      body: JSON.stringify({
        client_message_id: 'turn-3-hint',
        content: 'أحتاج تلميحاً حول كيفية تقييم مدى موثوقية مصادر دراسات الطاقة.',
        message_kind: 'hint',
      }),
    });

    const hintRes = await studentChatHandler(hintReq);
    expect(hintRes.status).toBe(200);
    const hintData = await hintRes.json();
    // Crucial: hint must NEVER advance the stage
    expect(hintData.stage).toBe('source_check');

    const sessionAfterHint = await storage.getSessionById(sessionId);
    expect(sessionAfterHint?.hint_count).toBe(1);

    // Turn 4: Source Check -> advances to Counter Argument
    await agePreviousMessages();
    const turn4Req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: studentCookie,
      },
      body: JSON.stringify({
        client_message_id: 'turn-4-student',
        content: 'وكالة IRENA منظمة حكومية دولية تضم 168 دولة، وتعتمد في تقاريرها على سجلات التكلفة العالمية الميدانية المدققة',
        message_kind: 'normal',
      }),
    });

    const turn4Res = await studentChatHandler(turn4Req);
    expect(turn4Res.status).toBe(200);
    const turn4Data = await turn4Res.json();
    expect(turn4Data.stage).toBe('counter_argument');

    // Turn 5: Counter Argument -> advances to Reflection
    await agePreviousMessages();
    const turn5Req = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: studentCookie,
      },
      body: JSON.stringify({
        client_message_id: 'turn-5-student',
        content: 'الحجة المعارضة تشير لمشكلة تقطع الطاقة الشمسية والرياح، والرد العلمي هو تطوير بطاريات التخزين وربط الشبكات الإقليمية الذكية',
        message_kind: 'normal',
      }),
    });

    const turn5Res = await studentChatHandler(turn5Req);
    expect(turn5Res.status).toBe(200);
    const turn5Data = await turn5Res.json();
    expect(turn5Data.stage).toBe('reflection');

    // =========================================================================
    // STEP 6: Student Submits Post-Debate Reflection & Locks Session
    // =========================================================================
    const reflectionPayload = {
      final_stance: 'التحول للطاقة النظيفة حتمي وضروري مع ضرورة الاستثمار في التخزين وتطوير الشبكات لدعم الاستقرار',
      final_confidence: 5,
      strongest_evidence: 'انخفاض تكلفة التوليد الشمسي بنسبة 88% وفق تقرير IRENA الموثوق',
      strongest_counterargument: 'تحدي تقطع التوليد واستقرار التزود في فترات الذروة المناخية',
      remaining_uncertainty: 'السرعة التي يمكن بها للدول النامية تمويل البنية التحتية لشبكات التخزين',
      final_reflection: 'تعلمت أهمية التفكير النقدي في موازنة الأدلة الاقتصادية مع الجدوى التقنية وفحص المصادر المحايدة',
    };

    const submitReq = new NextRequest('http://localhost:3000/api/student/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: studentCookie,
      },
      body: JSON.stringify(reflectionPayload),
    });

    const submitRes = await studentSubmitHandler(submitReq);
    expect(submitRes.status).toBe(200);
    const submitData = await submitRes.json();
    expect(submitData.success).toBe(true);

    // Verify session status is locked to 'submitted'
    const lockedSession = await storage.getSessionById(sessionId);
    expect(lockedSession?.status).toBe('submitted');

    // Verify subsequent chat attempts on locked session are rejected with 403
    const blockedChatReq = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: studentCookie,
      },
      body: JSON.stringify({
        client_message_id: 'post-lock-attempt',
        content: 'هل يمكنني إرسال فكرة جديدة؟',
        message_kind: 'normal',
      }),
    });
    const blockedChatRes = await studentChatHandler(blockedChatReq);
    expect(blockedChatRes.status).toBe(403);

    // =========================================================================
    // STEP 7: Teacher Participant Tracker & Session Inspector
    // =========================================================================
    // 7A. Teacher Tracker sees the session with correct stage and hint count
    const trackerReq = new NextRequest(`http://localhost:3000/api/teacher/activities/${createdActivity.id}`, {
      method: 'GET',
      headers: { cookie: ownerCookie },
    });
    const trackerRes = await teacherActivityGetHandler(trackerReq, {
      params: Promise.resolve({ id: createdActivity.id }),
    });
    expect(trackerRes.status).toBe(200);
    const trackerData = await trackerRes.json();
    const sessionSummary = trackerData.sessions.find((s: any) => s.id === sessionId);
    expect(sessionSummary).toBeDefined();
    expect(sessionSummary.student_alias).toBe('سارة_المناظرة');
    expect(sessionSummary.status).toBe('submitted');
    expect(sessionSummary.hint_count).toBe(1);

    // 7B. Non-Owner Teacher Rejection Gate
    const unauthorizedInspectorReq = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'GET',
      headers: { cookie: nonOwnerCookie },
    });
    const unauthorizedInspectorRes = await teacherSessionGetHandler(unauthorizedInspectorReq, {
      params: Promise.resolve({ id: sessionId }),
    });
    expect(unauthorizedInspectorRes.status).toBe(403);

    // 7C. Invalid Student Token Rejection Gate
    const invalidTokenReq = new NextRequest('http://localhost:3000/api/student/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${STUDENT_SESSION_COOKIE}=invalid-forged-token-999`,
      },
      body: JSON.stringify({
        client_message_id: 'forged-msg',
        content: 'محاولة اختراق',
        message_kind: 'normal',
      }),
    });
    const invalidTokenRes = await studentChatHandler(invalidTokenReq);
    expect(invalidTokenRes.status).toBe(401);

    // 7D. Authorized Owner Inspector sees complete ordered transcript
    const inspectorReq = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'GET',
      headers: { cookie: ownerCookie },
    });
    const inspectorRes = await teacherSessionGetHandler(inspectorReq, {
      params: Promise.resolve({ id: sessionId }),
    });
    expect(inspectorRes.status).toBe(200);
    const inspectorData = await inspectorRes.json();

    // Verify transcript ordering & sequence numbers
    const messages = inspectorData.messages;
    expect(messages.length).toBeGreaterThanOrEqual(10);
    for (let i = 0; i < messages.length - 1; i++) {
      expect(messages[i].sequence_number).toBeLessThan(messages[i + 1].sequence_number);
    }
    // Verify session token hash is stripped
    expect(inspectorData.session.session_token_hash).toBeUndefined();
    expect(inspectorData.session.hint_count).toBe(1);

    // =========================================================================
    // STEP 8: Generate Formative Evaluation, Verify Quotes, & Approve
    // =========================================================================
    const evalGenReq = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'POST',
      headers: { cookie: ownerCookie },
    });
    const evalGenRes = await teacherSessionPostHandler(evalGenReq, {
      params: Promise.resolve({ id: sessionId }),
    });
    expect(evalGenRes.status).toBe(200);
    const evalGenData = await evalGenRes.json();
    const evaluation = evalGenData.evaluation;

    expect(evaluation).toBeDefined();
    expect(evaluation.session_id).toBe(sessionId);
    expect(evaluation.teacher_approved).toBe(false);

    // Verify that every verified quote is actually present in the student's conversation or reflection
    const allStudentTexts = [
      'تقرير IRENA يؤكد أن التحول لم يعد عبئاً مالياً بل فرصة تنموية حقيقية',
      'البيانات تثبت هبوط التكلفة بنسبة 88%',
      'أؤيد التحول السريع للطاقة الشمسية والرياح كأولوية قصوى لحماية المناخ',
      reflectionPayload.strongest_evidence,
      reflectionPayload.final_reflection,
      reflectionPayload.final_stance,
    ];

    for (const vQuote of evaluation.verified_quotes) {
      expect(vQuote.quote).toBeDefined();
      expect(vQuote.quote.length).toBeGreaterThan(0);
      const isMatchedInStudentText = allStudentTexts.some((txt) =>
        txt.includes(vQuote.quote) || vQuote.quote.includes(txt.slice(0, 20))
      );
      expect(isMatchedInStudentText).toBe(true);
    }

    // Teacher approves the evaluation with feedback
    const approveReq = new NextRequest(`http://localhost:3000/api/teacher/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: ownerCookie,
      },
      body: JSON.stringify({
        teacher_approved: true,
        suggested_feedback: 'تفكير نقدي متميز وبناء حجج قائم على بيانات اقتصادية صلبة ومصادر موثوقة يا سارة.',
      }),
    });
    const approveRes = await teacherSessionPatchHandler(approveReq, {
      params: Promise.resolve({ id: sessionId }),
    });
    expect(approveRes.status).toBe(200);
    const approveData = await approveRes.json();
    expect(approveData.evaluation.teacher_approved).toBe(true);
    expect(approveData.evaluation.suggested_feedback).toContain('تفكير نقدي متميز');

    // =========================================================================
    // STEP 9: Student Endpoints NEVER Expose Private Evaluation Data
    // =========================================================================
    const studentCheckReq = new NextRequest('http://localhost:3000/api/student/session', {
      method: 'GET',
      headers: { cookie: studentCookie },
    });
    const studentCheckRes = await studentSessionGetHandler(studentCheckReq);
    expect(studentCheckRes.status).toBe(200);
    const studentViewData = await studentCheckRes.json();

    // Verify absolute student isolation: NO evaluation, NO rubric scores, NO teacher comments, NO system confidence
    expect(studentViewData.evaluation).toBeUndefined();
    expect(studentViewData.rubric_scores).toBeUndefined();
    expect(studentViewData.teacher_feedback).toBeUndefined();
    expect(studentViewData.system_confidence).toBeUndefined();
    expect(studentViewData.activity.rubric_config).toBeUndefined();
  });
});
