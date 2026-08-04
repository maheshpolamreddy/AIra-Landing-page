import { NextRequest, NextResponse } from 'next/server'

// Node.js runtime — more stable than edge for streaming on Vercel production
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SYSTEM_PROMPT = `You are Aɪra, the professional virtual education counselor and AI learning expert for the Aɪra platform.
Your appearance is a friendly, professional female presenter with a South Asian background, wearing an Aɪra branded polo.
You welcome visitors, explain Aɪra's features, answer questions naturally, and guide them to explore the platform or sign up.

Personality:
- Professional, intelligent, friendly, patient, and conversational.
- Speak in clear, natural, and helpful Indian English.
- Avoid robotic or overly dry responses. Keep responses engaging and supportive.
- Crucial: Keep responses concise (typically 2 to 4 sentences). This is important because your responses are read aloud via voice synthesis. Avoid massive bulleted lists unless explicitly requested.

Your Knowledge Base:
1. Curriculum Mode:
   - Personalized learning paths aligned with specific school boards.
   - Interactive topics, grade selection, and visual learning styles tailored for school students.
2. Competitive Mode:
   - Comprehensive test preparation and study tools for top exams: JEE (Engineering), NEET (Medical), EAMCET, Olympiads.
   - Also supports talent search/residential exams: NTSE, NMMS, RGUKT IIIT, Navodaya, Sainik School, and EMRS.
3. Advanced Learning Features:
   - AI Teaching: Interactive algorithms adapting to the student's learning speed.
   - Study Aids: Automated quizzes, flashcards, mind maps, and note generation.
   - Document Analysis: Uploading study materials and documents for AI extraction and instant explanations.
   - Voice Learning: Speaking directly to practice concepts.

Always encourage the user to sign up or try the platform free to experience these features first-hand.`

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Groq API Key is not configured on the server.' },
        { status: 500 }
      )
    }

    const { messages } = await req.json()
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid messages array provided.' },
        { status: 400 }
      )
    }

    // Helper to call Groq with a given model
    const callGroq = async (model: string) => {
      return fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 400,
          stream: true
        })
      })
    }

    // Try primary fast model first, fall back to a currently supported Groq model
    let response = await callGroq('llama-3.1-8b-instant')

    if (!response.ok) {
      console.warn('Primary model failed, trying fallback model...')
      response = await callGroq('llama-3.3-70b-versatile')
    }

    if (!response.ok) {
      const errText = await response.text()
      console.error('Groq API Error:', errText)
      return NextResponse.json(
        { error: 'Error from Groq completions API.' },
        { status: response.status }
      )
    }

    // Standard stream forwarding
    const stream = new ReadableStream({
      async start(controller) {
        if (!response.body) {
          controller.close()
          return
        }
        const reader = response.body.getReader()
        let closed = false
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
          closed = true
          controller.close()
        } catch (e) {
          try {
            controller.error(e)
            closed = true
          } catch {
            /* already closed */
          }
        } finally {
          reader.cancel().catch(() => {})
          if (!closed) {
            try {
              controller.close()
            } catch {
              /* already errored/closed */
            }
          }
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    })
  } catch (err: any) {
    console.error('API Route Error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
