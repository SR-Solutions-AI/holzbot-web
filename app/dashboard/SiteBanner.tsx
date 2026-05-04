'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/supabaseClient'
import { X } from 'lucide-react'

type BannerData = { message: string; bg_color: string } | null

export default function SiteBanner() {
  const [banner, setBanner] = useState<BannerData>(null)
  const [dismissed, setDismissed] = useState(false)

  const fetchBanner = async () => {
    try {
      const res = await apiFetch('/banner')
      setBanner(res?.banner ?? null)
      // If admin hid it, un-dismiss so it can reappear next time
      if (!res?.banner) setDismissed(false)
    } catch {
      // silent – don't break the dashboard if this fails
    }
  }

  useEffect(() => {
    void fetchBanner()
    const id = window.setInterval(() => void fetchBanner(), 30_000)
    return () => window.clearInterval(id)
  }, [])

  if (!banner || dismissed) return null

  return (
    <div
      className="relative flex w-full shrink-0 items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium text-white shadow-md"
      style={{ backgroundColor: banner.bg_color }}
    >
      <span className="text-center leading-snug">{banner.message}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-white/70 hover:text-white transition"
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}
