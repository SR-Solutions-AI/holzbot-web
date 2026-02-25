'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, User, Database } from 'lucide-react' 
import { supabase } from '../lib/supabaseClient' 
import { apiFetch } from '../lib/supabaseClient'
import { useEffect, useState, useRef } from 'react'

// --- CONFIG ---
const LOGO_IMAGE_URL = '/logo.png' 

export default function DashboardHeader() {
  const pathname = usePathname()
  const isPreisdatenbank = pathname?.includes('/preisdatenbank')
  const [me, setMe] = useState<{ user?: { email?: string | null }, tenant?: { config?: any } | null } | null>(null)
  const mountedRef = useRef(true)

  // --- FUNCTIA DE LOGOUT (FIXED) ---
  const handleLogout = async () => {
    // 1. Încercăm să dăm sign out la Supabase
    try {
        await supabase.auth.signOut()
    } catch (e) {
        console.error("Eroare la sign out:", e)
    } finally {
        // 2. IMPORTANT: Folosim window.location.href in loc de router.push
        // Asta forteaza un refresh complet al paginii și curăță memoria
        window.location.href = '/'
    }
  }

  const fetchMe = async () => {
    try {
      const data = await apiFetch('/me')
      if (mountedRef.current) setMe(data)
    } catch {
      if (mountedRef.current) setMe(null)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    fetchMe()
    const onTenantConfigSaved = () => fetchMe()
    window.addEventListener('tenant-config:saved', onTenantConfigSaved)
    return () => {
      mountedRef.current = false
      window.removeEventListener('tenant-config:saved', onTenantConfigSaved)
    }
  }, [])

  const email = me?.user?.email || null
  const role = (me as any)?.user?.role as string | undefined
  const tenantConfig = (me?.tenant as any)?.config
  const tenantLogoUrlRaw =
    (tenantConfig?.logo_url ?? tenantConfig?.logoUrl) as string | undefined
  const tenantLogoUrl =
    role === 'admin' ? undefined : (tenantLogoUrlRaw && tenantLogoUrlRaw.startsWith('http') ? tenantLogoUrlRaw : undefined)

  return (
    <header className="h-[4.5rem] flex items-center bg-coffee-850 border-b border-black/50 shadow-soft relative shrink-0 z-40">
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{ background: 'radial-gradient(40% 100% at 0% 0%, rgba(216,162,94,.35), transparent 60%)' }}
        />
        
        {/* Full-width header content: left + center + right pushed to edges */}
        <div className="relative z-10 w-full grid grid-cols-3 items-center px-2 sm:px-6">
          {/* Left: tenant logo */}
          <div className="flex items-center gap-3 min-w-0 h-12 sm:h-14">
            {tenantLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenantLogoUrl}
                alt="Logo"
                className="h-10 sm:h-12 w-auto max-w-[160px] object-contain object-left"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : null}
          </div>

          {/* Center: Holzbot logo only */}
          <div className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_IMAGE_URL}
              alt="Holzbot"
              className="h-8 sm:h-10 w-auto object-contain"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>

          {/* Right: email + Preisdatenbank/Angebote + logout */}
          <div className="flex justify-end items-center gap-2 sm:gap-3 min-w-0">
            <div className="hidden sm:flex items-center gap-2 text-xs sm:text-sm text-sand/70 truncate max-w-[200px]">
              <User size={16} className="flex-shrink-0" />
              <span className="truncate">{email || ''}</span>
            </div>
            {isPreisdatenbank ? (
              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl font-bold text-[#ffffff] shadow-lg transition-all duration-200 ease-out bg-gradient-to-b from-[#e08414] to-[#f79116] hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(216,162,94,0.3)] active:translate-y-[1px] active:scale-95"
                title="Zurück zu Angebot generieren"
              >
                <span className="hidden sm:inline">Angebot generieren</span>
              </Link>
            ) : (
              <Link
                href="/dashboard/preisdatenbank"
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl font-bold text-[#ffffff] shadow-lg transition-all duration-200 ease-out bg-gradient-to-b from-[#e08414] to-[#f79116] hover:brightness-110 hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(216,162,94,0.3)] active:translate-y-[1px] active:scale-95"
                title="Preisdatenbank"
              >
                <Database size={18} className="shrink-0" />
                <span className="hidden sm:inline">Preisdatenbank</span>
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[#ffffff] shadow-md transition-all duration-200 ease-out border border-white/30 bg-coffee-850 hover:bg-coffee-800 hover:border-[#FF9F0F]/50"
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

