'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { apiFetch } from '../lib/supabaseClient'
import HistoryList from '../components/HistoryList'
import LiveFeed from '../components/LiveFeed'
import StepWizard from '../components/StepWizard'
import AdminDashboard from '../components/AdminDashboard'

export default function Home() {
  const [ready, setReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('❌ [DASHBOARD] Eroare la verificarea sesiunii:', error)
        window.location.href = '/login'
        return
      }
      
      if (!data.session) {
        console.log('⚠️ [DASHBOARD] Nu există sesiune, redirecționare la login')
        window.location.href = '/login'
      } else {
        console.log('✅ [DASHBOARD] Sesiune validă:', { userId: data.session.user.id })
        setReady(true)
      }
    })
  }, [])
  useEffect(() => {
    // IMPORTANT: keep hooks order stable across renders.
    // Only run once we're authenticated/ready.
    if (!ready) return
    let mounted = true
    ;(async () => {
      try {
        const me = await apiFetch('/me')
        const role = (me?.user?.role ?? null) as string | null
        if (mounted) setIsAdmin(role === 'admin')
      } catch {
        if (mounted) setIsAdmin(false)
      }
    })()
    return () => { mounted = false }
  }, [ready])

  if (!ready) return null

  return (
    <>
      {isAdmin ? (
        <AdminDashboard />
      ) : (
        <>
          {/* Stânga: proiecte */}
          <aside className="bg-panel/80 border border-black/40 rounded-xl2 p-3 shadow-soft flex flex-col min-w-0 h-full min-h-0">
            <div className="text-sand font-semibold mb-3 shrink-0">Projekt</div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <HistoryList variant="wood" />
            </div>
          </aside>

          {/* Mijloc: StepWizard */}
          <main className="bg-panel/80 border border-black/40 rounded-xl2 p-3 shadow-soft min-w-0 h-full min-h-0 overflow-hidden">
            <StepWizard />
          </main>
        </>
      )}

      {/* Dreapta: LiveFeed */}
      <div className="min-w-0 h-full min-h-0 overflow-hidden">
        <LiveFeed />
      </div>
    </>
  )
}
