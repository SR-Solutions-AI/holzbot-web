'use client'

import { ChangeEvent, useMemo, useState } from 'react'

type Wall = {
  position?: [number, number][]
}

type AnalyzeResponse = {
  message?: string
  data?: {
    walls?: Wall[]
    rooms?: unknown[]
    doors?: unknown[]
  }
  error?: string
}

export default function RastaLabPage() {
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const wallSegments = useMemo(() => {
    if (!result?.data?.walls) return []
    return result.data.walls
      .map((wall) => wall.position)
      .filter((p): p is [number, number][] => Array.isArray(p) && p.length >= 2)
  }, [result])

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setPreviewUrl(URL.createObjectURL(file))
    setLoading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/rasta/analyze', {
        method: 'POST',
        body: formData,
      })

      const json = (await response.json()) as AnalyzeResponse
      if (!response.ok) {
        throw new Error(json.error || `Analyze failed (${response.status})`)
      }

      setResult(json)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Rasta Lab</h1>
        <p className="text-zinc-400">
          Upload a plan image and preview `walls` detected by local Rasta.
        </p>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-white hover:file:bg-orange-400"
          />
        </div>

        {loading && <p className="text-orange-300">Analyzing with Rasta...</p>}
        {error && <p className="text-red-300">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="text-lg font-semibold mb-3">Preview + walls overlay</h2>
            {!previewUrl ? (
              <p className="text-zinc-500 text-sm">No file selected yet.</p>
            ) : (
              <div className="relative inline-block max-w-full">
                <img src={previewUrl} alt="Uploaded plan preview" className="max-w-full h-auto rounded" />
                {wallSegments.length > 0 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {wallSegments.map((segment, idx) => {
                      const [a, b] = segment
                      return (
                        <line
                          key={idx}
                          x1={a[0]}
                          y1={a[1]}
                          x2={b[0]}
                          y2={b[1]}
                          stroke="#f97316"
                          strokeWidth={3}
                          strokeLinecap="round"
                        />
                      )
                    })}
                  </svg>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="text-lg font-semibold mb-3">Raw JSON output</h2>
            <pre className="text-xs overflow-auto max-h-[520px] bg-black/40 p-3 rounded">
              {result ? JSON.stringify(result, null, 2) : 'No result yet.'}
            </pre>
          </div>
        </div>
      </div>
    </main>
  )
}
