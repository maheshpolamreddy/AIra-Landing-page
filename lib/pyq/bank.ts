import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export type BankQuestion = {
  id: string
  year: number
  paper: number
  subject: string
  questionNumber: number
  questionType: string
  content: {
    text: string
    latex: string[]
    images: string[]
    imageAssets?: {
      id: string
      type: string
      url: string
      altText?: string
      sourcePage?: number | null
    }[]
    tables: unknown[]
  }
  options: { label: string; text: string }[]
  answer: { kind: string; values?: string[]; value?: string } | null
  answerStatus: string
  answerSource?: string
  answerProvenance?: Record<string, unknown> | null
  aiSolution?: string | null
  aiModel?: string | null
  scoringEligible?: boolean
  visualStatus?: string
  source: Record<string, unknown>
  paperSource?: string
}

type BankFile = {
  questions: BankQuestion[]
}

const SESSION_DIR = path.join(process.cwd(), 'data', 'pyq-sessions')

function bankPaths(): string[] {
  return [
    path.join(process.cwd(), 'data', 'pyq-bank-eligible.json'),
    // Dev convenience: tutor reports path when monorepo-adjacent
    path.join(
      process.env.USERPROFILE || '',
      'Projects',
      'AIra---AI-tutor',
      'data',
      'pyq',
      'jee-advanced',
      'reports',
      'bank-eligible.json',
    ),
  ]
}

export function loadPyqBank(): BankQuestion[] {
  for (const p of bankPaths()) {
    if (!existsSync(p)) continue
    const raw = JSON.parse(readFileSync(p, 'utf8')) as BankFile
    return Array.isArray(raw.questions) ? raw.questions : []
  }
  return []
}

export function stripAnswers(q: BankQuestion) {
  const {
    answer: _a,
    answerStatus: _s,
    answerSource: _src,
    answerProvenance: _p,
    aiSolution: _ai,
    aiModel: _m,
    scoringEligible: _e,
    ...rest
  } = q as BankQuestion & {
    answerStatus?: string
    answerSource?: string
    answerProvenance?: unknown
    aiSolution?: unknown
    aiModel?: unknown
    scoringEligible?: unknown
  }
  return rest
}

/** Scored-exam eligibility — AI_DERIVED never auto-eligible. */
export function isBankEligible(q: BankQuestion): boolean {
  if (q.scoringEligible === false) return false
  if (q.questionType === 'UNKNOWN') return false
  if (q.paperSource === 'REVIEW_REQUIRED') return false
  if (q.answerStatus === 'VERIFIED_FROM_SOURCE') return true
  if (q.answerStatus === 'EXTERNAL_VERIFIED') return true
  return false
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedInt(seed: string) {
  return createHash('sha256').update(seed).digest().readUInt32BE(0)
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** True when the question has a student-safe cropped original diagram/figure. */
export function hasCleanDiagram(q: BankQuestion): boolean {
  const assets = q.content?.imageAssets || []
  if (
    assets.some(
      (a) =>
        a?.type === 'CROPPED_FIGURE' ||
        (typeof a?.url === 'string' && /crop-q/i.test(a.url)),
    )
  ) {
    return true
  }
  return (q.content?.images || []).some((u) => /crop-q/i.test(String(u)))
}

/**
 * Pick a Mixed PYQ set from real eligible bank questions.
 * Always mixes in diagrammatic questions when the pool has them.
 */
export function pickMixedQuestions(
  pool: BankQuestion[],
  input: {
    count: number
    physics?: number
    chemistry?: number
    mathematics?: number
  },
  rand: () => number,
): BankQuestion[] {
  if (pool.length < input.count) {
    throw Object.assign(
      new Error(`Insufficient questions: need ${input.count}, have ${pool.length}`),
      { code: 'INSUFFICIENT_POOL' },
    )
  }

  const bySub = {
    PHYSICS: pool.filter((q) => q.subject === 'PHYSICS'),
    CHEMISTRY: pool.filter((q) => q.subject === 'CHEMISTRY'),
    MATHEMATICS: pool.filter((q) => q.subject === 'MATHEMATICS'),
  }

  let selected: BankQuestion[]

  if (input.physics != null || input.chemistry != null || input.mathematics != null) {
    const targets = {
      PHYSICS: input.physics ?? 0,
      CHEMISTRY: input.chemistry ?? 0,
      MATHEMATICS: input.mathematics ?? 0,
    }
    const total = targets.PHYSICS + targets.CHEMISTRY + targets.MATHEMATICS
    if (total !== input.count) {
      throw Object.assign(new Error('Subject counts must equal count'), { code: 'INVALID_COUNTS' })
    }
    selected = []
    for (const [sub, n] of Object.entries(targets) as [keyof typeof bySub, number][]) {
      const available = shuffle(bySub[sub], rand)
      if (available.length < n) {
        throw Object.assign(new Error(`Insufficient ${sub}: need ${n}, have ${available.length}`), {
          code: 'INSUFFICIENT_POOL',
        })
      }
      // Prefer diagrammatic within each subject quota
      const withFig = available.filter(hasCleanDiagram)
      const withoutFig = available.filter((q) => !hasCleanDiagram(q))
      const takeFig = Math.min(withFig.length, Math.max(0, Math.ceil(n * 0.3)))
      const pickedSub = [...withFig.slice(0, takeFig), ...withoutFig, ...withFig.slice(takeFig)].slice(
        0,
        n,
      )
      selected.push(...pickedSub)
    }
    selected = shuffle(selected, rand)
  } else {
    const withFig = shuffle(
      pool.filter(hasCleanDiagram),
      rand,
    )
    const withoutFig = shuffle(
      pool.filter((q) => !hasCleanDiagram(q)),
      rand,
    )

    // Guarantee diagram mix every Mixed exam when any exist
    const diagramQuota =
      withFig.length === 0
        ? 0
        : input.count <= 2
          ? Math.min(1, withFig.length)
          : Math.min(withFig.length, Math.max(1, Math.round(input.count * 0.3)))

    selected = []
    const used = new Set<string>()

    for (const q of withFig) {
      if (selected.length >= diagramQuota) break
      selected.push(q)
      used.add(q.id)
    }

    // Year diversity for the remainder
    const restPool = shuffle(
      pool.filter((q) => !used.has(q.id)),
      rand,
    )
    const yearsInPool = [...new Set(restPool.map((q) => q.year))]
    if (yearsInPool.length >= 2 && selected.length < input.count) {
      const byYear = new Map<number, BankQuestion[]>()
      for (const q of restPool) {
        if (!byYear.has(q.year)) byYear.set(q.year, [])
        byYear.get(q.year)!.push(q)
      }
      for (const y of shuffle(yearsInPool, rand)) {
        if (selected.length >= input.count) break
        const list = byYear.get(y) || []
        const q = list.find((x) => !used.has(x.id))
        if (!q) continue
        selected.push(q)
        used.add(q.id)
      }
    }

    for (const q of [...withoutFig, ...withFig]) {
      if (selected.length >= input.count) break
      if (used.has(q.id)) continue
      selected.push(q)
      used.add(q.id)
    }

    selected = shuffle(selected, rand)
  }

  if (selected.length < input.count) {
    throw Object.assign(
      new Error(`Insufficient questions after mix: need ${input.count}, have ${selected.length}`),
      { code: 'INSUFFICIENT_POOL' },
    )
  }

  return selected.slice(0, input.count)
}

export function buildMixedSession(input: {
  count: number
  years?: number[]
  physics?: number
  chemistry?: number
  mathematics?: number
  seed?: string
}) {
  const seed = input.seed || randomBytes(8).toString('hex')
  const rand = mulberry32(seedInt(seed))
  let pool = loadPyqBank().filter(isBankEligible)
  if (input.years?.length) {
    pool = pool.filter((q) => input.years!.includes(q.year))
  }

  const selected = pickMixedQuestions(pool, input, rand)

  const sessionId = `pyq-mixed-${seed}`
  const serverAnswers: Record<
    string,
    { answer: BankQuestion['answer']; answerStatus: string; answerSource?: string }
  > = {}
  for (const q of selected) {
    serverAnswers[q.id] = {
      answer: q.answer,
      answerStatus: q.answerStatus,
      answerSource: q.answerSource,
    }
  }

  const diagramCount = selected.filter(hasCleanDiagram).length

  const session = {
    examSessionId: sessionId,
    exam: 'JEE_ADVANCED' as const,
    mode: 'MIXED_PYQ' as const,
    generatedAt: new Date().toISOString(),
    seed,
    config: input,
    questionIds: selected.map((q) => q.id),
    yearsUsed: [...new Set(selected.map((q) => q.year))].sort((a, b) => a - b),
    diagramQuestionCount: diagramCount,
    studentQuestions: selected.map((q, i) => ({
      sessionOrder: i,
      ...stripAnswers(q),
      sourceType: 'PYQ' as const,
      exam: 'JEE_ADVANCED' as const,
    })),
    _serverAnswers: serverAnswers,
  }

  mkdirSync(SESSION_DIR, { recursive: true })
  writeFileSync(path.join(SESSION_DIR, `${sessionId}.json`), JSON.stringify(session), 'utf8')

  const { _serverAnswers: _, ...client } = session
  return client
}

export function buildOriginalSession(year: number, paper: number) {
  const pool = loadPyqBank()
    .filter((q) => q.year === year && q.paper === paper && isBankEligible(q))
    .sort((a, b) => a.questionNumber - b.questionNumber)

  if (!pool.length) {
    throw Object.assign(new Error(`No verified PYQs for ${year} paper ${paper}`), {
      code: 'INSUFFICIENT_POOL',
    })
  }

  const seed = `${year}-p${paper}`
  const sessionId = `pyq-original-${seed}`
  const serverAnswers: Record<
    string,
    { answer: BankQuestion['answer']; answerStatus: string; answerSource?: string }
  > = {}
  for (const q of pool) {
    serverAnswers[q.id] = {
      answer: q.answer,
      answerStatus: q.answerStatus,
      answerSource: q.answerSource,
    }
  }

  const session = {
    examSessionId: sessionId,
    exam: 'JEE_ADVANCED' as const,
    mode: 'ORIGINAL_PAPER' as const,
    generatedAt: new Date().toISOString(),
    seed,
    config: { year, paper },
    questionIds: pool.map((q) => q.id),
    yearsUsed: [year],
    studentQuestions: pool.map((q, i) => ({
      sessionOrder: i,
      ...stripAnswers(q),
      sourceType: 'PYQ' as const,
      exam: 'JEE_ADVANCED' as const,
    })),
    _serverAnswers: serverAnswers,
  }

  mkdirSync(SESSION_DIR, { recursive: true })
  writeFileSync(path.join(SESSION_DIR, `${sessionId}.json`), JSON.stringify(session), 'utf8')
  const { _serverAnswers: _, ...client } = session
  return client
}

export function loadSession(sessionId: string) {
  const p = path.join(SESSION_DIR, `${sessionId}.json`)
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8')) as {
    examSessionId: string
    studentQuestions: { id: string; options: { label: string }[]; questionType: string }[]
    _serverAnswers: Record<
      string,
      | { kind: string; values?: string[]; value?: string }
      | {
          answer: { kind: string; values?: string[]; value?: string } | null
          answerStatus?: string
          answerSource?: string
        }
      | null
    >
  }
}

function unwrapServerAnswer(
  entry:
    | { kind: string; values?: string[]; value?: string }
    | {
        answer: { kind: string; values?: string[]; value?: string } | null
        answerStatus?: string
        answerSource?: string
      }
    | null
    | undefined,
) {
  if (!entry) return null
  if ('answer' in entry) return entry.answer
  if ('kind' in entry) return entry
  return null
}

export function scoreSession(
  sessionId: string,
  answers: Record<string, string | string[] | number | null | undefined>,
) {
  const session = loadSession(sessionId)
  if (!session) {
    throw Object.assign(new Error('Session not found'), { code: 'NOT_FOUND' })
  }

  let correct = 0
  let incorrect = 0
  let unanswered = 0
  const details: unknown[] = []

  for (const q of session.studentQuestions) {
    const key = unwrapServerAnswer(session._serverAnswers[q.id])
    const given = answers[q.id]
    if (given == null || given === '' || (Array.isArray(given) && given.length === 0)) {
      unanswered += 1
      details.push({ id: q.id, result: 'unanswered' })
      continue
    }

    let ok = false
    if (key?.kind === 'OPTIONS' && key.values) {
      const givenLabels = (Array.isArray(given) ? given : [String(given)]).map((x) =>
        String(x).toUpperCase(),
      )
      const expected = [...key.values].map((x) => x.toUpperCase()).sort()
      const got = [...givenLabels].sort()
      ok = expected.length === got.length && expected.every((v, i) => v === got[i])
    } else if (key?.kind === 'NUMERIC' && key.value != null) {
      ok = String(given).trim() === String(key.value).trim()
    }

    if (ok) correct += 1
    else incorrect += 1
    details.push({ id: q.id, result: ok ? 'correct' : 'incorrect' })
  }

  // Default JEE-style until year-specific schemes are loaded
  const score = correct * 4 - incorrect
  return { score, correct, incorrect, unanswered, details }
}
