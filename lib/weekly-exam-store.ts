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
  // Keep a process-wide in-memory copy for warm serverless instances.
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
  const disk = readDisk()
  if (!globalThis.__airaWeeklyExamMemory) {
    globalThis.__airaWeeklyExamMemory = disk
    return disk
  }

  // Merge disk + memory by updatedAt so file edits and in-memory POSTs stay consistent.
  const byId = new Map<string, WeeklyExamSessionDto>()
  for (const s of disk) byId.set(s.id, s)
  for (const s of globalThis.__airaWeeklyExamMemory) {
    const existing = byId.get(s.id)
    if (!existing || s.updatedAt >= existing.updatedAt) byId.set(s.id, s)
  }
  const merged = [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  globalThis.__airaWeeklyExamMemory = merged
  return merged
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
