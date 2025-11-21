'use client'
import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/supabaseClient'

type OfferListItem = {
  id: string
  title?: string | null
  status?: string | null
  meta?: { referinta?: string | null } | null
  created_at: string
}

/** Dicționar UI (doar afișare) */
const DE = {
  fallbackProject: 'Projekt',
  locale: 'de-DE', // pentru afișarea datei
  translations: {
    'Ofertă nouă': 'Neues Angebot',
  },
} as const

/** Funcție mică de traducere pentru afișare */
function translateText(text?: string | null): string {
  if (!text) return ''
  const t = text.trim()
  return DE.translations[t] || t
}

export default function HistoryList({ variant='wood' }: { variant?: 'wood' | 'default' }) {
  const [items, setItems] = useState<OfferListItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  async function load() {
    const data = await apiFetch('/offers?limit=50')
    setItems((data.items || []) as OfferListItem[])
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const h = () => load()
    window.addEventListener('offers:refresh', h)
    return () => window.removeEventListener('offers:refresh', h)
  }, [])

  return (
    <div className="h-full overflow-y-auto hide-scroll space-y-3 pr-1">
      {items.map(it => {
        // Determinăm textul de afișat
        const rawDisplay = it?.meta?.referinta || it?.title || DE.fallbackProject
        const display = translateText(rawDisplay)

        return (
          <button
            key={it.id}
            onClick={() => {
              setSelected(it.id)
              window.dispatchEvent(new CustomEvent('offer:selected', { detail: { offerId: it.id } }))
            }}
            className={`list-btn ${selected===it.id ? 'list-btn--active' : ''}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium truncate">{display}</div>
            </div>
            <div className="text-xs text-neutral-200/80">
              {new Date(it.created_at).toLocaleString(DE.locale)}
            </div>
          </button>
        )
      })}
    </div>
  )
}
