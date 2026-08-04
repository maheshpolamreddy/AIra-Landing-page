/**
 * Shared weekly-exam JSON store for the landing API.
 * Used when Firestore is unavailable, and as a deploy-time seed.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'

export type WeeklyExamSessionDto = {
  id: string
  weekKey: string
  day: 'saturday' | 'sunday'
  title: string
  examId: string
  subjectId?: string
  mode: 'mock' | 'pyq'
  startsAt: string
  endsAt: string
  status: 'draft' | 'published' | 'archived'
  createdBy: string
  updatedAt: string
}

const DATA_PATH = path.join(process.cwd(), 'data', 'weekly-exam-schedules.json')

declare global {
  // eslint-disable-next-line no-var
  var __airaWeeklyExamMemory: WeeklyExamSessionDto[] | undefined
}

function readDisk(): WeeklyExamSessionDto[] {
  try {
    if (!existsSync(DATA_PATH)) return []
    const raw = readFileSync(DATA_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeDisk(sessions: WeeklyExamSessionDto[]) {
  try {
    mkdirSync(path.dirname(DATA_PATH), { recursive: true })
    writeFileSync(DATA_PATH, JSON.stringify(sessions, null, 2), 'utf8')
  } catch {
    // Vercel production FS is read-only — memory still serves warm instances
  }
}

export function loadWeeklyExams(): WeeklyExamSessionDto[] {
  if (!globalThis.__airaWeeklyExamMemory) {
    globalThis.__airaWeeklyExamMemory = readDisk()
  }
  return globalThis.__airaWeeklyExamMemory
}

export function upsertWeeklyExam(session: WeeklyExamSessionDto): WeeklyExamSessionDto[] {
  const list = loadWeeklyExams().filter((s) => s.id !== session.id)
  list.push(session)
  list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  globalThis.__airaWeeklyExamMemory = list
  writeDisk(list)
  return list
}

export function listPublishedWeeklyExams(): WeeklyExamSessionDto[] {
  return loadWeeklyExams().filter((s) => s.status === 'published')
}
