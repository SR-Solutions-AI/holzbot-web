'use client'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import HistoryList from './components/HistoryList'
import LiveFeed from './components/LiveFeed'
import StepWizard from './components/StepWizard'

export default function Home() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) window.location.href = '/login'
      else setReady(true)
    })
  }, [])
  if (!ready) return null

  return (
    <>
      {/* Stânga: proiecte */}
      <aside className="bg-panel/80 border border-black/40 rounded-xl2 p-3 shadow-soft flex flex-col min-w-0 h-full min-h-0">
        <div className="text-sand font-semibold mb-3 shrink-0">Projekt</div>
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* HistoryList își gestionează singur scrollul; min-h-0 pe părinte e critic */}
          <HistoryList variant="wood" />
        </div>
      </aside>

      {/* Mijloc: viewer */}
      <main className="bg-panel/80 border border-black/40 rounded-xl2 p-3 shadow-soft min-w-0 h-full min-h-0 overflow-hidden">
        <StepWizard />
      </main>

      {/* Dreapta: LiveFeed direct, pe toată înălțimea */}
      <div className="min-w-0 h-full min-h-0 overflow-hidden">
        <LiveFeed />
      </div>
    </>
  )
}
