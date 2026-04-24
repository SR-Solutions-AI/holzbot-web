'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, User, Database, Settings, ChevronDown, Building2, FileText, Home, Coins, FlaskConical, Server } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { apiFetch } from '../lib/supabaseClient'
import { useCallback, useEffect, useState, useRef } from 'react'

// --- CONFIG ---
const LOGO_IMAGE_URL = '/logo.png'

const VPS_PLACEHOLDER_DETAILS = {
  os: '—',
  status: '—',
  cpu: '—',
  memory: '—',
  disk: '—',
  incoming: '—',
  outgoing: '—',
  bandwidth: '—',
} as const

type VpsNavbarDetails = {
  os: string
  status: string
  cpu: string
  memory: string
  disk: string
  incoming: string
  outgoing: string
  bandwidth: string
}

type VpsNavbarVm = {
  cpuPercent: number | null
  fetchedAt: string
  error: string | null
  details: VpsNavbarDetails
}

type VpsNavbarResponse = {
  configured: boolean
  testing: VpsNavbarVm
  production: VpsNavbarVm
}

export default function DashboardHeader() {
  const pathname = usePathname()
  const isAdminRoute = pathname?.startsWith('/admin')
  const isPreisdatenbank = pathname?.includes('/preisdatenbank')
  const isSettingsArea = pathname?.includes('/settings') || isPreisdatenbank
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [me, setMe] = useState<{
    user?: { email?: string | null; role?: string | null; can_manage_org?: boolean }
    tenant?: { id?: string; config?: any } | null
    tokens?: { display?: string; unlimited?: boolean } | null
  } | null>(null)
  const [wrongApp, setWrongApp] = useState<{ forApp: string; loginUrl: string } | null>(null)
  const [vpsNavbar, setVpsNavbar] = useState<VpsNavbarResponse | null>(null)
  const [vpsNavbarLoading, setVpsNavbarLoading] = useState(false)
  const mountedRef = useRef(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const role = (me?.user as any)?.role as string | undefined
  const canSeeOrgSettings =
    role === 'org_leader' || role === 'admin' || (me?.user as any)?.can_manage_org === true
  const isSiteAdmin = role === 'admin'
  const tokenDisplay = isAdminRoute || isSiteAdmin ? null : me?.tokens?.display
  const hasTenant = Boolean(me?.tenant?.id)
  const canSeeOfferCustomization = !isSiteAdmin
  // ADMIN vede doar interfața admin; USER și ORGANIZATION LEADER văd Preisdatenbank
  const canSeePreisdatenbank = !isSiteAdmin

  // --- FUNCTIA DE LOGOUT (FIXED) ---
  const handleLogout = async () => {
    const clearClientAuthState = () => {
      try { sessionStorage.removeItem('holzbot_dashboard_offer') } catch {}
      try { sessionStorage.removeItem('holzbot_dashboard_running') } catch {}
      try {
        const keys: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith('sb-')) keys.push(key)
        }
        for (const key of keys) localStorage.removeItem(key)
      } catch {}
    }

    try {
        await supabase.auth.signOut({ scope: 'global' })
    } catch (e) {
        console.error("Eroare la sign out:", e)
    } finally {
        clearClientAuthState()
        window.location.href = '/'
    }
  }

  const fetchMe = useCallback(async () => {
    try {
      const data = await apiFetch('/me')
      if (!mountedRef.current) return
      // Conturile betonbau (Betonbot) nu au acces aici: sign out + mesaj (fără redirect)
      if (data?.tenant?.slug === 'betonbau') {
        await supabase.auth.signOut()
        setMe(null)
        setWrongApp({ forApp: 'Betonbot', loginUrl: process.env.NEXT_PUBLIC_BETONBOT_ORIGIN ? `${process.env.NEXT_PUBLIC_BETONBOT_ORIGIN}/login` : 'http://localhost:3600/login' })
        return
      }
      setWrongApp(null)
      setMe(data)
    } catch {
      if (mountedRef.current) setMe(null)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void fetchMe()
    const onTenantConfigSaved = () => void fetchMe()
    const onTokensRefresh = () => void fetchMe()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void fetchMe()
    }
    window.addEventListener('tenant-config:saved', onTenantConfigSaved)
    window.addEventListener('tokens:refresh', onTokensRefresh)
    document.addEventListener('visibilitychange', onVisibility)
    const intervalMs = 30_000
    const intervalId = window.setInterval(() => void fetchMe(), intervalMs)
    return () => {
      mountedRef.current = false
      window.removeEventListener('tenant-config:saved', onTenantConfigSaved)
      window.removeEventListener('tokens:refresh', onTokensRefresh)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(intervalId)
    }
  }, [fetchMe])

  /** Admin navbar: Hostinger-backed CPU % (holzbot-api GET /admin/vps-status). */
  useEffect(() => {
    if (!isAdminRoute) {
      setVpsNavbar(null)
      setVpsNavbarLoading(false)
      return
    }
    let cancelled = false
    const pollMs = 45_000
    const load = async () => {
      try {
        if (!cancelled) setVpsNavbarLoading(true)
        const data = (await apiFetch('/admin/vps-status', { timeoutMs: 25_000 })) as VpsNavbarResponse
        if (!cancelled) setVpsNavbar(data)
      } catch {
        if (!cancelled) setVpsNavbar(null)
      } finally {
        if (!cancelled) setVpsNavbarLoading(false)
      }
    }
    void load()
    const id = window.setInterval(() => void load(), pollMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [isAdminRoute])

  useEffect(() => {
    void fetchMe()
  }, [pathname, fetchMe])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const email = me?.user?.email || null
  const tenantConfig = (me?.tenant as any)?.config
  const pdfAssetLogo = tenantConfig?.pdf?.assets?.logo_url as string | undefined
  const tenantLogoUrlRaw =
    (tenantConfig?.logo_url ?? tenantConfig?.logoUrl ?? pdfAssetLogo) as string | undefined
  const tenantLogoUrl = (() => {
    const s = tenantLogoUrlRaw?.trim()
    if (!s) return undefined
    if (s.startsWith('//')) return `https:${s}`
    if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('/')) return s
    return undefined
  })()

  if (wrongApp) {
    return (
      <header className="h-[4.5rem] flex items-center justify-center bg-coffee-850 border-b border-black/50 shrink-0 z-40">
        <div className="text-center px-4">
          <p className="text-sand/90 text-sm">
            Dieses Konto ist für {wrongApp.forApp}. Bitte melden Sie sich dort an:
          </p>
          <a href={wrongApp.loginUrl} className="text-[#FF9F0F] font-medium underline mt-1 inline-block">
            {wrongApp.loginUrl}
          </a>
        </div>
      </header>
    )
  }

  return (
    <header className="h-[4.5rem] flex items-center bg-coffee-850 border-b border-black/50 shadow-soft relative shrink-0 z-40">
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{ background: 'radial-gradient(40% 100% at 0% 0%, rgba(216,162,94,.35), transparent 60%)' }}
        />
        
        {/* Flex: logo left, title centered on viewport, actions inset from right with looser spacing */}
        <div className="relative z-10 flex w-full min-w-0 items-center gap-4 px-3 sm:px-8">
          {/* Left: tenant logo */}
          <div className="flex h-12 shrink-0 items-center gap-3 sm:h-14 min-w-0 max-w-[min(360px,45vw)]">
            {isAdminRoute ? (
              <div className="flex items-center gap-2">
                <VpsStatusChip
                  label="Testing"
                  cpuPercent={vpsNavbar?.testing.cpuPercent ?? null}
                  loading={vpsNavbarLoading && !vpsNavbar}
                  error={vpsNavbar?.testing.error ?? (vpsNavbar === null ? 'Could not load status' : null)}
                  icon={<FlaskConical size={12} className="text-[#FFB84D]" />}
                  details={vpsNavbar?.testing.details ?? { ...VPS_PLACEHOLDER_DETAILS }}
                />
                <VpsStatusChip
                  label="Production"
                  cpuPercent={vpsNavbar?.production.cpuPercent ?? null}
                  loading={vpsNavbarLoading && !vpsNavbar}
                  error={vpsNavbar?.production.error ?? (vpsNavbar === null ? 'Could not load status' : null)}
                  icon={<Server size={12} className="text-[#FFB84D]" />}
                  details={vpsNavbar?.production.details ?? { ...VPS_PLACEHOLDER_DETAILS }}
                />
              </div>
            ) : tenantLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenantLogoUrl}
                alt="Logo"
                className="h-10 sm:h-12 w-auto max-h-full max-w-full object-contain object-left"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : null}
          </div>

          {/* Center: Holzbot — true viewport center */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_IMAGE_URL}
              alt="Holzbot"
              className="h-8 sm:h-10 w-auto object-contain"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>

          {/* Right: email + Projekte-Kontingent + settings + logout — pulled slightly toward center, more air */}
          <div className="relative z-10 ml-auto flex min-w-0 items-center gap-3 sm:gap-5 pr-1 sm:pr-2">
            <div className="flex min-w-0 flex-col items-end gap-1 text-[11px] sm:text-sm sm:gap-1.5">
              <div className="flex max-w-[11rem] min-w-0 items-center gap-2 text-sand/70 sm:max-w-[16rem]">
                <User size={16} className="shrink-0" />
                <span className="min-w-0 truncate text-right" title={email ?? undefined}>
                  {email || ''}
                </span>
              </div>
              {hasTenant && tokenDisplay ? (
                <div
                  className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-normal text-white"
                  title="Projekte: noch verfügbar / Monatslimit (Kalender Berlin)"
                >
                  <Coins size={16} className="shrink-0 opacity-90" aria-hidden />
                  <span className="tabular-nums">{tokenDisplay}</span>
                  {!me?.tokens?.unlimited ? <span>Projekte</span> : null}
                </div>
              ) : null}
            </div>
            {!isAdminRoute && !isSiteAdmin ? (
              <div className="relative shrink-0" ref={dropdownRef}>
                <>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen((o) => !o)}
                    className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl font-bold text-[#ffffff] shadow-lg transition-all duration-200 ease-out bg-gradient-to-b from-[#e08414] to-[#f79116] hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(216,162,94,0.3)] active:translate-y-[1px] active:scale-95"
                    title="Einstellungen"
                  >
                    <Settings size={18} className="shrink-0" />
                    <span className="hidden sm:inline">Einstellungen</span>
                    <ChevronDown size={16} className={`shrink-0 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {settingsOpen && (
                    <div className="absolute right-0 top-full mt-1 py-1 w-72 rounded-xl bg-coffee-850 border border-white/20 shadow-xl z-50">
                      <Link
                        href="/dashboard"
                        onClick={() => setSettingsOpen(false)}
                        className="flex items-start gap-2 px-4 py-2.5 text-left text-white hover:bg-white/10 rounded-lg mx-1 whitespace-normal leading-snug"
                      >
                        <Home size={18} className="shrink-0 text-sand/80" />
                        <span className="leading-snug">Angebot generieren</span>
                      </Link>
                      {canSeeOrgSettings && (
                        <Link
                          href="/dashboard/settings/organisation"
                          onClick={() => setSettingsOpen(false)}
                          className="flex items-start gap-2 px-4 py-2.5 text-left text-white hover:bg-white/10 rounded-lg mx-1 whitespace-normal leading-snug"
                        >
                          <Building2 size={18} className="shrink-0 text-sand/80" />
                          <span className="leading-snug">Organisationseinstellungen</span>
                        </Link>
                      )}
                      {canSeeOfferCustomization && (
                        <Link
                          href="/dashboard/settings/angebotsanpassung"
                          onClick={() => setSettingsOpen(false)}
                          className="flex items-start gap-2 px-4 py-2.5 text-left text-white hover:bg-white/10 rounded-lg mx-1 whitespace-normal leading-snug"
                        >
                          <FileText size={18} className="shrink-0 text-sand/80" />
                          <span className="leading-snug">Angebotsanpassung</span>
                        </Link>
                      )}
                      {canSeePreisdatenbank && (
                        <Link
                          href="/dashboard/preisdatenbank"
                          onClick={() => setSettingsOpen(false)}
                          className="flex items-start gap-2 px-4 py-2.5 text-left text-white hover:bg-white/10 rounded-lg mx-1 whitespace-normal leading-snug"
                        >
                          <Database size={18} className="shrink-0 text-sand/80" />
                          <span className="leading-snug">Preisdatenbank</span>
                        </Link>
                      )}
                    </div>
                  )}
                </>
              </div>
            ) : null}
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-normal text-[#ffffff] shadow-md transition-all duration-200 ease-out border border-white/30 bg-coffee-850 hover:bg-coffee-800 hover:border-[#FF9F0F]/50"
              title="Log Out"
            >
              <span className="hidden sm:inline">Log Out</span>
              <LogOut size={18} />
            </button>
          </div>
        </div>
    </header>
  )
}

function VpsStatusChip({
  label,
  cpuPercent,
  loading,
  error,
  icon,
  details,
}: {
  label: string
  cpuPercent: number | null
  loading?: boolean
  error?: string | null
  icon: React.ReactNode
  details: {
    os: string
    status: string
    cpu: string
    memory: string
    disk: string
    incoming: string
    outgoing: string
    bandwidth: string
  }
}) {
  const width =
    cpuPercent === null || !Number.isFinite(cpuPercent)
      ? 0
      : Math.max(0, Math.min(100, Math.round(cpuPercent * 10) / 10))
  const pctLabel =
    loading && cpuPercent === null ? '…' : cpuPercent === null || !Number.isFinite(cpuPercent) ? '—' : `${width}%`
  const title = error && error !== 'Could not load status' ? error : undefined
  return (
    <div
      className="group relative min-w-[152px] rounded-xl border border-white/12 bg-black/30 px-3 py-2 transition-colors duration-150 hover:border-white/20 hover:bg-black/45"
      title={title}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/6 text-[#FFB84D]">
          {icon}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-sand/50">VPS</span>
          <span className="block text-xs font-semibold text-sand/95">{label}</span>
        </div>
        <span className="shrink-0 text-xs font-bold text-[#FFD29A]">{pctLabel}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
        <div className="h-full rounded-full bg-[#FF9F0F]" style={{ width: `${width}%` }} />
      </div>

      <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-[310px] origin-top-left rounded-xl border border-white/15 bg-black/90 p-3 text-sand opacity-0 shadow-lg backdrop-blur-sm translate-y-1 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[15px] font-bold text-white">{label}</div>
          <div className="inline-flex max-w-[160px] items-center gap-1 rounded-full border border-[#FF9F0F]/45 bg-[#FF9F0F]/14 px-2 py-0.5 text-[11px] font-semibold text-[#FFD29A]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9F0F]" />
            <span className="truncate">{details.status}</span>
          </div>
        </div>
        <div className="mb-2 text-[12px] text-sand/80">{details.os}</div>
        {error ? <div className="mb-2 text-[11px] text-red-300/90 break-words">{error}</div> : null}
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <DetailItem label="CPU usage" value={details.cpu} />
          <DetailItem label="Memory usage" value={details.memory} />
          <DetailItem label="Disk usage" value={details.disk} />
          <DetailItem label="Bandwidth" value={details.bandwidth} />
          <DetailItem label="Incoming traffic" value={details.incoming} />
          <DetailItem label="Outgoing traffic" value={details.outgoing} />
        </div>
      </div>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/15 px-2 py-1.5">
      <div className="text-[11px] text-sand/70">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold text-sand">{value}</div>
    </div>
  )
}

