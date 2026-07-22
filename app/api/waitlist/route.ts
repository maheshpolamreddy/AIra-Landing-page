import { saveWaitlistEntry } from '@/lib/firebase/firestore'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, courseId, courseName } = body as {
    email?: string
    courseId?: string
    courseName?: string
  }

  const normalizedEmail = String(email ?? '').trim().toLowerCase()
  const normalizedCourseId = String(courseId ?? '').trim()
  const normalizedCourseName = String(courseName ?? '').trim()

  if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
    return Response.json({ error: 'Valid email is required' }, { status: 400 })
  }
  if (!normalizedCourseId || !normalizedCourseName) {
    return Response.json({ error: 'Course is required' }, { status: 400 })
  }

  try {
    const docRef = await saveWaitlistEntry({
      email: normalizedEmail,
      courseId: normalizedCourseId,
      courseName: normalizedCourseName,
    })

    console.info('[waitlist] saved', {
      id: docRef.id,
      courseId: normalizedCourseId,
      email: normalizedEmail.replace(/(.{2}).+(@.+)/, '$1***$2'),
    })

    return Response.json({ ok: true, id: docRef.id })
  } catch (error) {
    console.error('[waitlist] failed', {
      courseId: normalizedCourseId,
      error,
    })
    return Response.json(
      { error: 'Unable to save waitlist signup. Please try again.' },
      { status: 500 },
    )
  }
}
