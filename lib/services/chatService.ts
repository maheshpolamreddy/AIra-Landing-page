/**
 * Landing counselor chat — calls product `/api/chat` (Groq stream).
 * Never uses mockAdapter.
 */

function extractSseText(raw: string): string {
  const parts: string[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const json = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>
      }
      const delta = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content
      if (delta) parts.push(delta)
    } catch {
      // plain text chunk
      parts.push(payload)
    }
  }
  return parts.join('')
}

export async function sendCounselorMessage(userMessage: string): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    let detail = ''
    try {
      const err = (await response.json()) as { error?: string }
      detail = err.error ? `: ${err.error}` : ''
    } catch {
      /* ignore */
    }
    throw new Error(`Chat request failed (${response.status})${detail}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = (await response.json()) as { reply?: string; text?: string; content?: string }
    return data.reply || data.text || data.content || 'Sorry — I could not generate a reply.'
  }

  if (!response.body) {
    return 'Sorry — I could not generate a reply.'
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let raw = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    raw += decoder.decode(value, { stream: true })
  }

  const fromSse = extractSseText(raw).trim()
  if (fromSse) return fromSse
  return raw.trim() || 'Sorry — I could not generate a reply.'
}
