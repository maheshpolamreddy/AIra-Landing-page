# Aɪra — Functional Requirements Document (FRD)

| Field | Value |
|-------|--------|
| **Document type** | Functional Requirements Document |
| **Product** | Aɪra (AIra) — AI Tutor Platform |
| **Version** | 1.0 |
| **Status** | Derived from complete codebase + forward product needs |
| **Repos** | Landing: [AIra-Landing-page](https://github.com/maheshpolamreddy/AIra-Landing-page) · Tutor: [AIra---AI-tutor](https://github.com/maheshpolamreddy/AIra---AI-tutor) |
| **Production** | Landing: https://aira-landing-page-elite.vercel.app/ · Tutor: Vercel project `ai-ra-app` |
| **Related** | `AUTH_UNIFICATION.md`, PRD (product vision) |

---

## 1. Purpose of this document

This FRD defines **what the system must do**, function by function, for the Aɪra platform end-to-end.

It covers:

1. **As-built functions** — behaviour already implemented in Landing (Next.js) and Tutor (Vite/React).
2. **Required next functions** — capabilities needed to complete Aɪra as a production-grade AI tutor for students, teachers, schools, parents, and competitive aspirants.

Priority legend used throughout:

| Tag | Meaning |
|-----|---------|
| **P0** | Must-have for a trustworthy student product |
| **P1** | Should-have for growth / quality |
| **P2** | Nice-to-have / later phase |
| **[LIVE]** | Implemented in current codebase |
| **[PARTIAL]** | Partially implemented |
| **[NEEDED]** | Not implemented; required for product completeness |

---

## 2. Product scope

### 2.1 In scope

| Area | Description |
|------|-------------|
| Marketing & acquisition | Landing pages, pricing, contact, waitlist, AI counselor demo |
| Identity | Signup, login, password reset, role resolution, session across Landing ↔ Tutor |
| Student learning | Curriculum browser, AI teaching classroom, studio resources, dashboard |
| Competitive prep | Exam catalog, mocks, PYQs, weekly tests, analytics, AI explanation |
| Teacher / Admin shells | Dashboards (live data wiring is future work) |
| Platform glue | Same-origin rewrites, shared Firebase project, TTS/chat APIs |
| Collaboration ops | Dual-repo GitHub + Vercel deploy workflow assumptions |

### 2.2 Out of scope (current code; listed as future FRs where relevant)

- Payment gateway settlement & invoicing engines (FR specified as **[NEEDED]**)
- Full live parent portal (FR specified as **[NEEDED]**)
- Native iOS/Android apps (responsive web is in scope)
- Human tutoring marketplace

### 2.3 System context

```text
┌──────────────────────────────────────────────────────────────┐
│ Browser (same origin in production)                          │
│                                                              │
│  Landing (Next.js on Vercel)                                 │
│   Routes: /, /login, /signup, /pricing, /contact, /assistant │
│   APIs:   /api/chat, /api/tts, /api/welcome, /api/waitlist   │
│                                                              │
│  Rewrites ──► Tutor SPA (Vite on Vercel ai-ra-app)           │
│   Routes: /student/*, /teacher/*, /admin/*, /dev/*           │
└──────────────────────────────────────────────────────────────┘
         │                         │
         ▼                         ▼
  Firebase Auth + Firestore    LLM providers + Sarvam TTS
  (shared: aira-landingpage)   (Groq / multi-model in Tutor)
```

**Local development rule:** Landing proxies Tutor via `TUTOR_DEV_URL` (default `http://127.0.0.1:5173`). Landing must **never** rewrite `/api/*` to the Tutor SPA.

---

## 3. Actors

| Actor | Description | Primary entry |
|-------|-------------|---------------|
| **Visitor** | Unauthenticated prospect | Landing `/` |
| **Student** | Learner (board + competitive) | `/signup` → `/student/mode-selection` |
| **Teacher** | Classroom educator | Invited login → `/teacher/dashboard` |
| **Admin / Principal** | School governance | Invited login → `/admin/dashboard` |
| **Parent** *(future)* | Guardian of student | Linked account |
| **School buyer** | Procurement / demo requester | `/contact`, `/login?intent=school` |
| **Professional learner** *(future)* | Adult upskilling | Waitlist / future portal |
| **System** | Cron, email, AI, analytics | Background jobs / APIs |
| **Developer** | Collaborator deploying code | GitHub + Vercel |

---

## 4. Functional requirements by module

### FR-MKT — Marketing & acquisition (Landing)

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-MKT-001 | P0 | LIVE | System shall present a brand-first homepage with hero, features, courses, how-it-works, and primary CTA to start trial / signup. |
| FR-MKT-002 | P0 | LIVE | System shall expose About, Pricing, Contact, Privacy, Terms, and Cookies pages. |
| FR-MKT-003 | P1 | LIVE | System shall allow visitors to submit a contact/demo form; messages shall be stored in Firestore `contact_messages`. |
| FR-MKT-004 | P1 | LIVE | System shall accept waitlist emails for unavailable courses / professional track via `/api/waitlist`. |
| FR-MKT-005 | P1 | LIVE | System shall provide a floating AI counselor and `/assistant` full-page experience with streaming chat and TTS. |
| FR-MKT-006 | P2 | PARTIAL | System shall support Professional and Schools audience navigation; Professional shall remain gated as coming-soon until courses are live. |
| FR-MKT-007 | P2 | LIVE | Blog and Careers pages may exist as placeholders until content is published. |
| FR-MKT-008 | P1 | NEEDED | Pricing page and pricing modal shall present **one consistent** plan matrix (tiers, prices, annual discount). |
| FR-MKT-009 | P1 | NEEDED | Marketing course cards shall not display placeholder “proof” metrics as live statistics. |

**Detailed behaviour — AI counselor (LIVE)**

1. User opens floating orb or `/assistant`.
2. User sends a message → `POST /api/chat` streams model response (Groq).
3. Optional TTS via `POST /api/tts` (Sarvam); talking-head uses pre-recorded video (not LiveAvatar runtime today).
4. Counselor shall not claim access to private learning records unless authenticated in-app counselor is implemented (see FR-GUI).

---

### FR-AUTH — Authentication & identity

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-AUTH-001 | P0 | LIVE | System shall allow email/password signup with display name, email, role, DOB, and password. |
| FR-AUTH-002 | P0 | LIVE | On signup success, system shall create Firebase Auth user and write profile to Firestore `users/{uid}` including `role`. |
| FR-AUTH-003 | P0 | LIVE | System shall allow email/password login and resolve role (hint + Firestore) before redirecting to role home. |
| FR-AUTH-004 | P1 | LIVE | System shall support Google sign-in; Apple/Microsoft may be feature-flagged via env. |
| FR-AUTH-005 | P0 | LIVE | System shall support forgot-password via Firebase reset email. |
| FR-AUTH-006 | P1 | LIVE | After signup, system shall attempt welcome email via `/api/welcome` (Bearer ID token); failure shall **not** block account creation. |
| FR-AUTH-007 | P0 | LIVE | Unauthenticated access to Tutor protected routes shall redirect to Landing `/login` with safe return handling. |
| FR-AUTH-008 | P0 | LIVE | Sign-out shall clear Firebase session and role hint; Landing shall honour `?signedOut=1`. |
| FR-AUTH-009 | P0 | LIVE | Post-login homes: `student` → `/student/mode-selection` (or remembered student home); `teacher` → `/teacher/dashboard`; `admin` → `/admin/dashboard`. |
| FR-AUTH-010 | P0 | NEEDED | Teacher and Admin roles shall be **invite-only**; public signup shall not offer self-serve Admin/Principal. |
| FR-AUTH-011 | P0 | NEEDED | System shall capture student academic profile: board, grade, medium of instruction, target exams. |
| FR-AUTH-012 | P1 | NEEDED | System shall support parent–child account linking with verified consent. |
| FR-AUTH-013 | P1 | PARTIAL | Roll-number auth exists in Tutor store only; either migrate to Landing or remove from product surface. |
| FR-AUTH-014 | P0 | NEEDED | System shall provide account deletion and personal data export (DPDP-aligned). |
| FR-AUTH-015 | P2 | LIVE | Dev/demo role switcher at `/dev/demo-roles` shall be limited to DEV or authenticated admin. |

**Detailed signup flow (LIVE)**

```text
Visitor → /signup → validate form → createUserWithEmailAndPassword
  → updateProfile(displayName) → saveUserProfile(role, DOB, …)
  → POST /api/welcome (best effort) → hard navigate to role home
```

**Detailed login flow (LIVE)**

```text
Visitor → /login → email/password or social
  → read aira:role hint and/or Firestore users/{uid}.role
  → if student and aira:student-home set → that path
  → else role default home
```

---

### FR-MODE — Student domain selection

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-MODE-001 | P0 | LIVE | After student login (no remembered home), system shall present Mode Selection: Curriculum vs Competitive. |
| FR-MODE-002 | P1 | LIVE | Selecting a mode shall persist `aira:student-home` so subsequent logins can skip the picker when appropriate. |
| FR-MODE-003 | P2 | LIVE | Legacy profession onboarding at `/student/onboarding` may remain reachable; primary path is school curriculum / competitive. |
| FR-MODE-004 | P0 | NEEDED | First-time students shall complete a short diagnostic (board/grade + baseline quiz) before or immediately after mode selection. |

---

### FR-CUR — Curriculum navigation & progress

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-CUR-001 | P0 | LIVE | Student shall browse Grades 6–10 and 11–12 Science: subjects → chapters → topics. |
| FR-CUR-002 | P0 | LIVE | System shall track completion per `gradeId-subjectId` and compute progress percentage. |
| FR-CUR-003 | P0 | LIVE | Selecting a topic shall open Teaching at `/student/learn/:topicId`. |
| FR-CUR-004 | P1 | LIVE | Topics without content shall show “Topics Coming Soon” rather than a broken lesson. |
| FR-CUR-005 | P0 | NEEDED | Curriculum trees shall map to named boards (CBSE / State / ICSE) with board-specific chapters. |
| FR-CUR-006 | P0 | NEEDED | For a declared launch board+grades, core subjects shall meet a completeness SLA (no blocking Coming Soon). |
| FR-CUR-007 | P1 | NEEDED | System shall enforce prerequisite topics when mastery of prior concepts is below threshold. |
| FR-CUR-008 | P1 | NEEDED | Schools shall optionally upload or select a syllabus overlay for their sections. |

**Progress update rules (LIVE)**

- Topic marked complete via teaching completion sync and/or quiz score ≥ **70%**.
- Progress stored in user-scoped local persistence (`curriculumStore`).

---

### FR-TEACH — AI Teaching classroom

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-TEACH-001 | P0 | LIVE | Teaching UI shall provide three panels: Unified Chat, Classroom Board, Studio. |
| FR-TEACH-002 | P0 | LIVE | Lessons shall advance step-by-step with visual sync (diagrams / board content). |
| FR-TEACH-003 | P0 | LIVE | System shall narrate steps via TTS (Web Speech and/or Sarvam Indic voices). |
| FR-TEACH-004 | P0 | LIVE | Student shall ask doubts in chat (text or speech); system shall enter doubt mode and answer in tutor context. |
| FR-TEACH-005 | P0 | LIVE | System shall present verification quizzes within the teaching flow. |
| FR-TEACH-006 | P1 | LIVE | Student may attach PDF/DOC for context (pdfjs / mammoth). |
| FR-TEACH-007 | P0 | LIVE | System shall persist last step per topic (`lastStepByTopicId`) for resume. |
| FR-TEACH-008 | P0 | LIVE | On completion / qualifying quiz, system shall sync curriculum + analytics via learning sync utilities. |
| FR-TEACH-009 | P0 | NEEDED | Tutoring shall adapt difficulty mid-lesson based on doubt frequency, quiz misses, and time-on-step. |
| FR-TEACH-010 | P1 | NEEDED | Student shall choose Socratic (question-led) vs Lecture mode. |
| FR-TEACH-011 | P1 | NEEDED | Student shall bookmark steps and replay from a step index. |
| FR-TEACH-012 | P1 | NEEDED | Student shall annotate the board (highlight confusion regions). |
| FR-TEACH-013 | P0 | NEEDED | Student chat shall enforce age-appropriate safety filters and abuse limits. |
| FR-TEACH-014 | P2 | PARTIAL | Photoreal / LiveAvatar teacher: SDK may exist unused; product shall either integrate or remove dependency. |
| FR-TEACH-015 | P1 | NEEDED | Low-bandwidth mode shall prefer text + compressed visuals when media fails. |

**Detailed teaching session flow (LIVE)**

```text
Open topic → load curated lesson or generate content
  → render step on Board + optional TTS
  → student chat / doubt / attach file
  → verification quiz
  → mark progress + session analytics
  → optional Studio generation (notes / cards / maps)
```

---

### FR-STUDIO — Study resources

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-STUDIO-001 | P0 | LIVE | From Studio, student shall generate Notes, Mind Maps, Flashcards, and Summaries for the active topic. |
| FR-STUDIO-002 | P1 | LIVE | Flashcards shall support spaced-repetition fields (interval, ease; again/hard/good/easy). |
| FR-STUDIO-003 | P1 | LIVE | Student shall export resources to PDF/DOCX. |
| FR-STUDIO-004 | P1 | LIVE | If AI generation fails, system shall fall back to grounded mock content rather than hard-failing the UI. |
| FR-STUDIO-005 | P0 | NEEDED | Resources shall sync to the cloud per user so libraries appear on all devices. |
| FR-STUDIO-006 | P1 | NEEDED | Student shall edit and pin personal notes on top of AI output; versions shall be retained. |
| FR-STUDIO-007 | P1 | NEEDED | Student/teacher shall share a resource pack via link or class assignment. |
| FR-STUDIO-008 | P2 | NEEDED | System shall generate a print-ready one-page chapter sheet. |

---

### FR-COMP — Competitive exam suite

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-COMP-001 | P0 | LIVE | Competitive hub shall expose sections: Available Exams, Weekly Tests, Topic Quizzes, AI Explanation, PYQs, Mock Tests, Analytics. |
| FR-COMP-002 | P0 | LIVE | System shall list major exams (JEE Main/Advanced, NEET, EAMCET, POLYCET, NTSE, Olympiads, and others in catalog). |
| FR-COMP-003 | P0 | LIVE | Student shall take timed attempts; attempts shall persist (local competitive store; last N attempts retained). |
| FR-COMP-004 | P1 | LIVE | System shall derive accuracy, readiness-style insights, weak/strong subjects, and tips. |
| FR-COMP-005 | P1 | LIVE | AI Explanation flow shall open a competitive teaching lesson from selected exam context. |
| FR-COMP-006 | P0 | NEEDED | Top launch exams shall use **authentic** PYQ banks and vetted solutions (not only procedural generation). |
| FR-COMP-007 | P0 | NEEDED | Exam engine shall honour official pattern: sections, timers, negative marking, navigation rules. |
| FR-COMP-008 | P1 | NEEDED | Student shall set target exam date; system shall generate a backwards study plan. |
| FR-COMP-009 | P1 | NEEDED | System shall estimate percentile/rank against anonymized cohort when enough data exists. |
| FR-COMP-010 | P1 | NEEDED | Missed questions shall auto-populate a formula / mistake notebook. |

---

### FR-DASH — Student Curriculum Hub

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-DASH-001 | P0 | LIVE | `/student/dashboard` shall present Curriculum Hub with live (local) candidate learning metrics. |
| FR-DASH-002 | P0 | LIVE | Hub shall show KPIs: study time, quiz accuracy, streak, topics completed, curriculum %. |
| FR-DASH-003 | P0 | LIVE | Hub shall include Continue Learning, subject progress, recent activity, weekly journey. |
| FR-DASH-004 | P1 | LIVE | Hub shall include strength/focus, study library, achievements, recommended topics (search/filter). |
| FR-DASH-005 | P1 | LIVE | Hub may surface competitive readiness insights alongside curriculum metrics. |
| FR-DASH-006 | P0 | NEEDED | All Hub metrics shall read from cloud-backed learning events so values match across devices. |
| FR-DASH-007 | P1 | NEEDED | Hub shall show a generated “This week’s study plan” from goals + weak topics + available hours. |
| FR-DASH-008 | P1 | NEEDED | System shall support streak/goal reminders (in-app; optional email/WhatsApp). |
| FR-DASH-009 | P1 | NEEDED | System shall generate a parent-ready weekly report (PDF or share link). |

---

### FR-TCH — Teacher functions

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-TCH-001 | P1 | LIVE | `/teacher/dashboard` shall render class analytics UI (filters, student list, weak topics, intervention concepts). |
| FR-TCH-002 | P1 | LIVE | Teacher settings/profile routes shall be available under `/teacher/*`. |
| FR-TCH-003 | P0 | NEEDED | Dashboard shall bind to **live** roster and learning events for the teacher’s classes (replace `MOCK_*`). |
| FR-TCH-004 | P0 | NEEDED | Teacher shall create assignments (topic, quiz, mock) with due dates and track completion. |
| FR-TCH-005 | P1 | NEEDED | Teacher shall ask a class co-pilot questions (e.g., who needs help on Optics) grounded in real data. |
| FR-TCH-006 | P1 | NEEDED | Teacher shall approve/reject AI-generated lesson packs for school use. |

---

### FR-ADM — Admin / school governance

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-ADM-001 | P1 | LIVE | `/admin/dashboard` shall render governance UI (teacher overview, student diagnosis concepts). |
| FR-ADM-002 | P0 | NEEDED | Admin shall manage org hierarchy: school → grades → sections → memberships. |
| FR-ADM-003 | P0 | NEEDED | Admin shall manage seat licenses and invite teachers/students. |
| FR-ADM-004 | P1 | NEEDED | Admin shall view systemic weakness across grades from live aggregates. |
| FR-ADM-005 | P1 | NEEDED | System shall retain audit logs for role changes, exports, and sensitive access. |
| FR-ADM-006 | P2 | NEEDED | Light white-label: school logo/name on student shell. |

---

### FR-SET — Settings, profile, accessibility

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-SET-001 | P0 | LIVE | Settings shall include Account, Learning, Accessibility, AI Tutor, Privacy sections. |
| FR-SET-002 | P1 | LIVE | Theme: light / dark / system; font size; reduce animations; high contrast. |
| FR-SET-003 | P0 | LIVE | Accessibility shall configure Indic TTS languages and Sarvam speakers where available. |
| FR-SET-004 | P1 | LIVE | Profile shall show stats, learning-style check, achievements (sample tiles for non-students clearly marked illustrative). |
| FR-SET-005 | P1 | PARTIAL | UI language setting exists via i18n scaffold but only English strings are provided; full locale packs are required for Hindi-first expansion. |
| FR-SET-006 | P1 | NEEDED | Settings that affect learning identity shall be user-scoped and cloud-synced (today settings persist globally on device). |

---

### FR-GUI — Guidance counselor (productized)

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-GUI-001 | P1 | LIVE | Marketing counselor provides general guidance chat + voice on Landing. |
| FR-GUI-002 | P1 | NEEDED | Authenticated in-app counselor shall use the student’s mastery, goals, and attempts to recommend next actions. |
| FR-GUI-003 | P1 | NEEDED | Stream/career guidance for Class 10/12 shall follow structured pathways (not open-ended chat only). |

---

### FR-BILL — Plans & entitlements

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-BILL-001 | P1 | LIVE | Marketing shall describe Free / Pro / Enterprise style plans. |
| FR-BILL-002 | P0 | NEEDED | System shall integrate payments (UPI/cards) and create subscriptions. |
| FR-BILL-003 | P0 | NEEDED | System shall enforce entitlements (e.g., daily AI minutes, mock limits, export limits) by plan. |
| FR-BILL-004 | P1 | NEEDED | Enterprise shall support annual contracts / seat invoicing workflows. |
| FR-BILL-005 | P2 | NEEDED | Referral and scholarship codes shall adjust entitlements. |

---

### FR-DATA — Persistence, sync & privacy

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-DATA-001 | P0 | LIVE | Auth identity and role shall live in Firebase Auth + Firestore. |
| FR-DATA-002 | P0 | LIVE | Learning stores (curriculum, analytics, teaching cursor, resources, competitive attempts, user onboarding) shall persist locally, namespaced by user id. |
| FR-DATA-003 | P0 | LIVE | Logout shall not wipe another user’s namespaced learning buckets; re-login restores same-browser data for that uid. |
| FR-DATA-004 | P0 | NEEDED | System shall write-through learning events and resources to a cloud store keyed by `uid` (and org/class when applicable). |
| FR-DATA-005 | P1 | NEEDED | Local storage shall act as offline cache with conflict policy (last-write-wins or server authoritative). |
| FR-DATA-006 | P0 | NEEDED | Firestore security rules shall cover all written collections (including waitlist) with least privilege. |
| FR-DATA-007 | P0 | NEEDED | Retention, deletion, and export behaviours shall be documented and implemented. |

**As-built local stores (Tutor)**

| Store | Persisted content |
|-------|-------------------|
| `authStore` | role, isDemo, demo user fields |
| `curriculumStore` | progress map, last grade/subject |
| `analyticsStore` | sessions, achievements, metrics |
| `teachingStore` | last step by topic |
| `resourceStore` | notes, mind maps, flashcards, summaries |
| `competitiveStore` | attempts |
| `userStore` | profile / onboarding / profession selection |
| `settingsStore` | preferences (currently not uid-scoped) |

---

### FR-API — Interfaces & integrations

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-API-001 | P0 | LIVE | Landing shall own `/api/chat`, `/api/tts`, `/api/tts/health`, `/api/welcome`, `/api/waitlist` in the marketing host. |
| FR-API-002 | P0 | LIVE | Production Landing rewrites shall send `/student/*`, `/teacher/*`, `/admin/*`, `/dev/*` to Tutor host without proxying `/api/*`. |
| FR-API-003 | P0 | LIVE | Dev Landing rewrites shall target `TUTOR_DEV_URL` for Tutor paths and Vite HMR assets as configured. |
| FR-API-004 | P1 | LIVE | Tutor may expose serverless TTS/waitlist when accessed on its own Vercel host. |
| FR-API-005 | P0 | NEEDED | Authenticated Learning API shall expose CRUD/events for progress, sessions, resources, attempts, assignments. |
| FR-API-006 | P1 | NEEDED | AI gateway shall enforce per-user rate limits and cost budgets. |

---

### FR-NFR-FUNC — Functional quality attributes (testable)

These are functionalised NFRs (observable behaviours):

| ID | Priority | Status | Requirement |
|----|----------|--------|-------------|
| FR-NFR-001 | P0 | LIVE | App shells shall lazy-load major routes and show a full-page loader while auth resolves (with timeout failsafe). |
| FR-NFR-002 | P0 | LIVE | Teaching and competitive UIs shall be usable on mobile viewports (adaptive panels / nav). |
| FR-NFR-003 | P1 | LIVE | Accessibility controls (font, contrast, reduce motion, TTS) shall take effect without redeploy. |
| FR-NFR-004 | P0 | NEEDED | Critical student loop shall have automated E2E coverage in CI (signup/demo → lesson → quiz → dashboard). |
| FR-NFR-005 | P1 | NEEDED | System shall emit product analytics for funnel steps (signup, first lesson, first mock) without PII in event names. |

---

## 5. End-to-end functional scenarios

### Scenario S1 — New student first lesson **[LIVE core / NEEDED diagnostic]**

| Step | Actor | System response |
|------|-------|-----------------|
| 1 | Visitor | Opens Landing, clicks Start Free Trial |
| 2 | Visitor | Completes signup as student |
| 3 | System | Creates Auth + Firestore profile; sends welcome email (best effort) |
| 4 | System | Redirects to `/student/mode-selection` |
| 4b **[NEEDED]** | Student | Completes board/grade profile + diagnostic |
| 5 | Student | Chooses Curriculum Mode |
| 6 | Student | Opens grade → subject → topic |
| 7 | System | Loads Teaching classroom; resumes cursor if any |
| 8 | Student | Completes steps / quiz ≥70% |
| 9 | System | Updates curriculum progress + analytics |
| 10 | Student | Opens Curriculum Hub; sees updated KPIs |

### Scenario S2 — Competitive mock attempt **[LIVE / deepen authenticity NEEDED]**

| Step | Actor | System response |
|------|-------|-----------------|
| 1 | Student | Opens Competitive Mode hub |
| 2 | Student | Selects exam → Mock Tests |
| 3 | System | Starts timed Live Exam panel |
| 4 | Student | Submits attempt |
| 5 | System | Stores attempt; updates readiness/weak topics |
| 6 | Student | Opens AI Explanation for missed areas |

### Scenario S3 — Returning student multi-device **[PARTIAL → NEEDED]**

| Step | Actor | System response |
|------|-------|-----------------|
| 1 | Student | Learns on Device A |
| 2 | System **[LIVE]** | Persists to local uid namespace on Device A |
| 3 | Student | Logs in on Device B |
| 4 | System **[NEEDED]** | Hydrates Hub/progress from cloud; Device B matches Device A |

### Scenario S4 — Teacher intervention **[NEEDED]**

| Step | Actor | System response |
|------|-------|-----------------|
| 1 | Admin | Invites teacher to Section 9-A |
| 2 | Teacher | Opens live dashboard |
| 3 | System | Shows weak chapter Optics for 12 students |
| 4 | Teacher | Assigns “Light – Reflection” lesson + 10Q quiz due Friday |
| 5 | System | Notifies students; tracks completion |

### Scenario S5 — School demo lead **[LIVE]**

| Step | Actor | System response |
|------|-------|-----------------|
| 1 | Buyer | Opens `/contact` or Enterprise CTA |
| 2 | Buyer | Submits demo request |
| 3 | System | Writes `contact_messages` for sales follow-up |

---

## 6. Business rules

| ID | Rule |
|----|------|
| BR-001 | Default public self-serve role is **Student** only (target); Teacher/Admin require invite (**NEEDED** enforcement). |
| BR-002 | Quiz score ≥ **70%** may complete a curriculum topic (LIVE). |
| BR-003 | Welcome email is best-effort and idempotent (`welcomeEmailSent`) (LIVE). |
| BR-004 | Redirect targets after auth must be allow-listed / same-app safe (LIVE). |
| BR-005 | Landing `/api/*` must remain on Landing host in all environments (LIVE architecture rule). |
| BR-006 | Learning data is private to `uid`; teachers see only rostered students (**NEEDED** with cloud model). |
| BR-007 | Free tier AI usage shall be rate-limited once entitlements exist (**NEEDED**). |
| BR-008 | Competitive negative marking shall match exam policy when pattern engine ships (**NEEDED**). |
| BR-009 | Demo/guest modes must not write into another Firebase user’s cloud learning records (**NEEDED** when cloud sync lands). |
| BR-010 | Legal/billing copy must not claim features that are not enforced in product. |

---

## 7. Forward-looking feature set (AI Tutor completeness)

The following capabilities are required to take Aɪra from “strong teaching SPA” to “complete AI tutor platform.” Each maps to FRs above.

### 7.1 Student intelligence layer
- Diagnostic onboarding and academic profile  
- Concept-level mastery graph (not only topic %)  
- Adaptive lesson difficulty and daily mixed revision  
- Error taxonomy (careless / conceptual / calculation)  
- Personalized weekly study plan + reminders  

### 7.2 Content & exam truth
- Board-complete curated curriculum for launch grades  
- Internal CMS for lesson editors  
- Authentic PYQ/mock banks for JEE Main & NEET first  
- Official exam pattern engine  

### 7.3 Cloud learning platform
- Learning events API + multi-device sync  
- Cloud resource library  
- Realtime Hub updates  
- Offline cache with sync  

### 7.4 Institution suite
- Live teacher dashboards  
- Assignments & interventions  
- Admin org, seats, audit logs  
- Parent weekly reports  

### 7.5 Trust, safety, monetization
- Invite-only elevated roles  
- Chat safety / abuse limits  
- DPDP deletion & export  
- Subscriptions + entitlement gates  
- Consistent pricing surface  

### 7.6 Experience upgrades
- Hindi-first UI localization  
- Optional LiveAvatar (or remove unused SDK)  
- In-app counselor grounded on real mastery  
- Low-bandwidth teaching mode  

---

## 8. Data entities (logical)

| Entity | Key fields | Source today | Target |
|--------|------------|--------------|--------|
| User | uid, email, name, role, DOB | Firestore | + board, grade, goals |
| LearningSession | topicId, duration, quizScore, % | local analytics | cloud events |
| CurriculumProgress | gradeSubjectKey, completedTopicIds | local | cloud |
| Resource | type, topicId, content, sr fields | local | cloud |
| CompetitiveAttempt | examId, mode, score, answers | local | cloud |
| Assignment | classId, payload, dueAt | — | cloud |
| Organization | school, sections, seats | — | cloud |
| Subscription | plan, status, limits | — | billing provider + DB |
| ContactMessage | name, email, body | Firestore | unchanged |
| WaitlistEntry | email, course/track | API | Firestore w/ rules |

---

## 9. External interfaces

| Interface | Direction | Function |
|-----------|-----------|----------|
| Firebase Auth | In/Out | Identity |
| Firestore | In/Out | Profiles, leads, flags |
| Groq / other LLMs | Out | Chat, teaching, generation |
| Sarvam TTS | Out | Speech audio |
| SMTP (Nodemailer) | Out | Welcome email |
| Vercel | Deploy | Landing + Tutor hosting |
| Payment provider **[NEEDED]** | Out | Subscriptions |
| WhatsApp/Email notify **[NEEDED]** | Out | Reminders / parent digests |

---

## 10. Assumptions & constraints

1. Landing and Tutor remain separate repos with same-origin production composition via rewrites.  
2. Both collaborators have equal GitHub rights; production deploys from `main` on Vercel.  
3. Shared Firebase project `aira-landingpage` is the identity source of truth.  
4. AI outputs may be imperfect; UI must degrade gracefully (already true for several generators).  
5. TypeScript build on Landing may ignore type errors today (`ignoreBuildErrors`); quality bar should tighten over time.  
6. No native apps in v1; responsive web is the client.

---

## 11. Acceptance criteria (testable release gates)

### Gate A — Student MVP (hardening)

- [ ] Signup as student → mode selection → curriculum topic → teaching → quiz → Hub KPI change on **same browser**.  
- [ ] Unauthenticated `/student/dashboard` redirects to Landing login.  
- [ ] Landing `/api/tts` and `/api/chat` respond on Landing origin (not swallowed by Tutor rewrite).  
- [ ] Welcome email failure does not block signup.  
- [ ] Admin/Teacher no longer self-selectable on public signup **[NEEDED before public scale]**.

### Gate B — Multi-device truth

- [ ] Progress and resources created on Device A appear on Device B after login.  
- [ ] Hub KPIs match summed cloud sessions within agreed tolerance.

### Gate C — Competitive authenticity (launch exams)

- [ ] JEE Main or NEET mock uses vetted item bank and correct negative marking.  
- [ ] Attempt review shows per-question correct/incorrect + explanation entry point.

### Gate D — Institution pilot

- [ ] Teacher sees live weak topics for a real roster (≥1 class).  
- [ ] Teacher assignment appears on student Hub / notifications.  
- [ ] Admin can invite teacher and view seat usage.

---

## 12. Traceability (code → FR modules)

| Code area | FR modules |
|-----------|------------|
| `app/` Landing pages, `components/hero.tsx`, courses | FR-MKT |
| `lib/firebase/auth.ts`, `app/login`, `app/signup` | FR-AUTH |
| `AUTH_UNIFICATION.md`, `vercel.json`, `next.config.mjs` | FR-API, FR-AUTH |
| Tutor `StudentModeSelectionPage.tsx` | FR-MODE |
| `CurriculumPage.tsx`, `curriculumStore`, `schoolCurriculum.ts` | FR-CUR |
| `TeachingPage.tsx`, `teachingStore`, visual sync | FR-TEACH |
| `resourceStore`, Studio viewers | FR-STUDIO |
| `StudentCompetitivePage`, `competitiveStore`, exam flows | FR-COMP |
| `DashboardPage.tsx`, `components/dashboard/*` | FR-DASH |
| `TeacherDashboardPage`, `AdminDashboardPage`, `mockAnalytics` | FR-TCH, FR-ADM |
| `SettingsPage`, `ProfilePage`, `i18n.ts` | FR-SET |
| `app/api/*`, Tutor `api/*.mjs` | FR-API |
| `learningIdentity.ts`, Zustand persist | FR-DATA |

---

## 13. Delivery notes for two-developer workflow

Functional changes that cross repos (auth redirects, proxy paths, shared Firestore fields) require:

1. Feature branch + PR per repo.  
2. Merge order: Tutor behaviour first when Landing only consumes it; Landing first when auth/API contracts change.  
3. Preview deploy validation of Scenario S1 before promoting `main`.  
4. No secrets in git; SMTP/LLM keys only in Vercel / local `.env.local`.

---

## 14. Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-08-09 | Initial FRD from full Landing + Tutor codebase inventory, including forward FRs for AI tutor completeness |

---

## 15. Summary

Aɪra’s **implemented functional core** is a unified auth shell plus a rich student product: curriculum browsing, visual AI classroom, studio resources, competitive practice, and a Curriculum Hub dashboard.

The **critical functional gaps** to close end-to-end are: invite-gated roles, **cloud learning sync**, board-complete content, authentic exam banks, live teacher/admin data, entitlements/billing, and safety/privacy controls.

This FRD is the functional contract for building those gaps without regressing the LIVE student teaching experience.
