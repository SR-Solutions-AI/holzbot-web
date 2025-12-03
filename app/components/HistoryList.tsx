
'use client'
import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/supabaseClient'
import { Plus, Loader2 } from 'lucide-react'

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
  const dict = DE.translations as Record<string, string>
  return dict[t] || t
}

export default function HistoryList({ variant='wood' }: { variant?: 'wood' | 'default' }) {
  const [items, setItems] = useState<OfferListItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  
  // State pentru a bloca interfața în timpul creării
  const [isCreating, setIsCreating] = useState(false)

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

  // [FIX CRITIC] Funcția de handler securizată cu Timestamp
  const handleNewProject = () => {
    // 1. Blocaj local: Dacă deja creăm, ignorăm orice alt click
    if (isCreating) return

    // 2. Activăm blocarea vizuală
    setIsCreating(true)
    setSelected(null)

    // 3. [IMPORTANT] Generăm ID-ul unic pentru a preveni duplicatele în StepWizard
    const uniqueId = Date.now()

    // 4. Lansăm evenimentul cu ID-ul unic
    window.dispatchEvent(new CustomEvent('offer:new', { 
      detail: { creationId: uniqueId } 
    }))

    // 5. Deblocăm butonul după 2 secunde (timp suficient să se proceseze startul)
    setTimeout(() => {
      setIsCreating(false)
    }, 2000)
  }

  return (
    <div className="h-full flex flex-col">
      
      {/* Button pentru proiect nou - Design Premium & Logică Securizată */}
      <div className="mb-4 px-1 shrink-0">
        <button
          onClick={handleNewProject}
          disabled={isCreating}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[#ffffff] shadow-lg transition-all duration-200 ease-out
            
            /* Stil normal (Gradient subtil) */
            bg-gradient-to-b from-[#e08414] to-[#f79116]
            
            /* Hover (doar dacă nu e disabled) */
            ${!isCreating ? 'hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(216,162,94,0.3)] active:translate-y-[1px] active:scale-95' : ''}
            
            /* Stil Disabled (când creăm) */
            disabled:opacity-70 disabled:cursor-wait disabled:transform-none disabled:shadow-none
          `}
        >
          {isCreating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Plus size={18} />
          )}
          
          {isCreating ? 'Wird erstellt...' : 'Neues Projekt'}
        </button>
      </div>

      {/* Liste der Projekte */}
      <div className="flex-1 overflow-y-auto hide-scroll space-y-3 pr-1 min-h-0">
        {items.map(it => {
          // Determinăm textul de afișat
          const rawDisplay = it?.meta?.referinta || it?.title || DE.fallbackProject
          const display = translateText(rawDisplay)

          return (
            <button
              key={it.id}
              disabled={isCreating} // Blocăm selecția în timp ce se creează unul nou
              onClick={() => {
                if (isCreating) return
                setSelected(it.id)
                window.dispatchEvent(new CustomEvent('offer:selected', { detail: { offerId: it.id } }))
              }}
              className={`list-btn ${selected===it.id ? 'list-btn--active' : ''} ${isCreating ? 'opacity-50 cursor-not-allowed' : ''}`}
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
    </div>
  )
}
