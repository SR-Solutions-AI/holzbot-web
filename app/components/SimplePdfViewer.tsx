'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import 'pdfjs-dist/legacy/build/pdf.worker.min.mjs'

type Props = {
  /** URL sau ArrayBuffer pentru PDF */
  src: string | ArrayBuffer | null
  /** înălțime maximă la care vrem scroll (optional) */
  maxHeight?: number | string
  className?: string
  /** densitatea de pixeli; 1–2 recomandat */
  pixelRatio?: number
}

/** Canvas pentru o singură pagină (lazy render cu IntersectionObserver) */
function PageCanvas({
  pdf,
  pageNumber,
  containerWidth,
  pixelRatio,
}: {
  pdf: pdfjs.PDFDocumentProxy
  pageNumber: number
  containerWidth: number
  pixelRatio: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const holderRef = useRef<HTMLDivElement | null>(null)
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null)
  const [rendered, setRendered] = useState(false)

  const renderPage = useCallback(async () => {
    if (!canvasRef.current) return

    // Anulează un render anterior (dacă există)
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel() } catch {}
      renderTaskRef.current = null
    }

    const page = await pdf.getPage(pageNumber)

    // 1) viewport în **CSS px** (fără DPR)
    const v1 = page.getViewport({ scale: 1 })
    const scaleCss = containerWidth / v1.width
    const viewport = page.getViewport({ scale: scaleCss })

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    // 2) dimensiuni reale ale canvasului (device pixels)
    const dpr = Math.max(1, pixelRatio || 1)
    canvas.width = Math.floor(viewport.width * dpr)
    canvas.height = Math.floor(viewport.height * dpr)

    // 3) dimensiuni CSS (în px logici) — fără round ca să nu introducem offset
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    canvas.style.display = 'block'

    // 4) reset transform + clear ca să nu „alunece” conținutul
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 5) randare cu transform pentru DPR (recomandat de pdf.js)
    const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined
    const task = page.render({
    canvas,                 // 👈 elementul <canvas>
    canvasContext: ctx,
    viewport,
    transform,              // poate fi undefined dacă dpr === 1
    })
    renderTaskRef.current = task
    try {
      await task.promise
      setRendered(true)
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') console.error(e)
    } finally {
      if (renderTaskRef.current === task) renderTaskRef.current = null
    }
  }, [containerWidth, pageNumber, pdf, pixelRatio])

  useEffect(() => {
    if (!holderRef.current) return
    const el = holderRef.current
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          renderPage()
          io.disconnect()
        }
      },
      { rootMargin: '200px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [renderPage])

  useEffect(() => {
    let t: any
    if (rendered) t = setTimeout(() => renderPage(), 60)
    return () => clearTimeout(t)
  }, [containerWidth, rendered, renderPage])

  return (
    <div
      ref={holderRef}
      // fără overflow-hidden/padding aici – pune-le pe wrapperul *extern* dacă vrei
      className="mx-auto my-6 rounded-2xl overflow-hidden bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-black/10"
      style={{ width: containerWidth, marginBottom: 10}}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}


export default function SimplePdfViewer({
  src,
  maxHeight = '75vh',
  className = '',
  pixelRatio = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1.5 : 1.5),
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [containerWidth, setContainerWidth] = useState(820) // fallback
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // worker (Next 15 + ESM): folosim worker-ul inclus în pachet
  // (importul 'pdfjs-dist/build/pdf.worker.min.mjs' activează automat worker-ul)

  useEffect(() => {
  if (!src) { setPdf(null); setNumPages(0); return }
  let canceled = false
  setLoading(true); setError(null);

  (async () => {
    try {
      const data = typeof src === 'string' ? { url: src } : { data: src }
      const doc = await pdfjs.getDocument({ ...data, verbosity: 0 }).promise
      if (canceled) { try { await doc.destroy() } catch {} ; return }
      setPdf(doc); setNumPages(doc.numPages)
    } catch (e: any) {
      if (!canceled) setError(e?.message || 'Nu am putut încărca PDF-ul.')
    } finally {
      if (!canceled) setLoading(false)
    }
  })()

  return () => {
    canceled = true
    // închide doc-ul precedent pentru a evita handle-uri deschise
    try { pdf?.destroy() } catch {}
  }
}, [src])  // eslint-disable-line


  // măsurăm lățimea disponibilă pentru pagină (și refacem la resize)
  useEffect(() => {
    function measure() {
      const w = wrapRef.current?.clientWidth
      if (w) setContainerWidth(Math.max(280, Math.min(1200, w)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const pages = useMemo(() => {
    if (!pdf || !numPages) return []
    return new Array(numPages).fill(0).map((_, i) => i + 1)
  }, [pdf, numPages])

  return (
    <div
      ref={wrapRef}
      className={[
        'overflow-auto pretty-scroll',
        className,
        ].join(' ')}
      style={{ maxHeight }}
    >
      {loading && (
        <div className="py-10 text-center text-neutral-200">PDF wird generiert…</div>
      )}
      {error && (
        <div className="py-6 px-4 bg-black/20 rounded-lg border border-red-400/40 text-red-200">
          {error}
        </div>
      )}
      {pdf && pages.map((p) => (
        <PageCanvas
          key={p}
          pdf={pdf}
          pageNumber={p}
          containerWidth={containerWidth - 8 /* mic padding optic */}
          pixelRatio={pixelRatio}
        />
      ))}
      {!loading && !error && !pdf && (
        <div className="py-8 text-center text-neutral-300">Es gab ein Problem beim erstellen des PDFs...</div>
      )}
    </div>
  )
}
