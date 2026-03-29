import { NextResponse } from 'next/server'

const RASTA_ANALYZE_URL = 'http://127.0.0.1:8020/analyze'

export async function POST(req: Request) {
  try {
    const incoming = await req.formData()
    const file = incoming.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file field.' }, { status: 400 })
    }

    const formData = new FormData()
    formData.append('file', file, file.name || 'upload.png')

    const response = await fetch(RASTA_ANALYZE_URL, {
      method: 'POST',
      body: formData,
    })

    const text = await response.text()
    return new NextResponse(text, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') ?? 'application/json',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
