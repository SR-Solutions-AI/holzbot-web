'use client'

import { useEffect, useState, useCallback } from 'react'
import DashboardHeader from '../dashboard/DashboardHeader'
import DashboardFooter from '../dashboard/DashboardFooter'
import DashboardContentTransition from '../dashboard/DashboardContentTransition'
import DashboardScaleWrapper from '../dashboard/DashboardScaleWrapper'
import { Cloud, Sparkles, Database } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { apiFetch } from '../lib/supabaseClient'

// --- Types ---
type ExternalStatus = { indicator: string; description: string }
type GeminiStats = {
  callsToday: number
  tokensToday: number
  costCentsToday: number
  successRate: number
  runsToday: number
  costCentsWeek: number
  lastRunAt: string | null
}
type ServiceStatus = {
  cloudflare: ExternalStatus
  supabase: ExternalStatus
  gemini: GeminiStats
} | null

function indicatorToDot(indicator: string): 'green' | 'yellow' | 'red' | 'gray' {
  if (indicator === 'none') return 'green'
  if (indicator === 'minor') return 'yellow'
  if (indicator === 'major' || indicator === 'critical') return 'red'
  return 'gray'
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatCents(cents: number): string {
  if (cents < 1) return `$${(cents / 100).toFixed(3)}`
  return `$${(cents / 100).toFixed(2)}`
}

function formatDescription(desc: string): string {
  // Cloudflare/Supabase descriptions can be long; shorten common ones
  if (!desc || desc === 'Unknown') return '—'
  if (desc.toLowerCase().includes('all systems operational')) return 'All systems OK'
  if (desc.toLowerCase().includes('operational')) return 'Operational'
  return desc.length > 28 ? desc.slice(0, 26) + '…' : desc
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [detailMode, setDetailMode] = useState(false)
  const [status, setStatus] = useState<ServiceStatus>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiFetch('/admin/service-status')
      setStatus(data)
    } catch {
      // keep previous value on error
    } finally {
      setLoading(false)
    }
  }, [])

  // alternate detail/primary every 4s
  useEffect(() => {
    const id = window.setInterval(() => setDetailMode((v) => !v), 4000)
    return () => window.clearInterval(id)
  }, [])

  // fetch on mount, then every 60s
  useEffect(() => {
    void fetchStatus()
    const id = window.setInterval(() => void fetchStatus(), 60_000)
    return () => window.clearInterval(id)
  }, [fetchStatus])

  // --- Cloudflare pill values ---
  const cfDot = indicatorToDot(status?.cloudflare.indicator ?? 'unknown')
  const cfValue = loading ? '…' : formatDescription(status?.cloudflare.description ?? 'Unknown')
  const cfDetail = loading ? '' : status?.cloudflare.indicator === 'none' ? 'No active incidents' : (status?.cloudflare.description ?? '—')
  const cfTooltip = status ? [
    { label: 'Status', value: status.cloudflare.description || '—' },
    { label: 'Indicator', value: status.cloudflare.indicator || '—' },
  ] : []

  // --- Supabase pill values ---
  const sbDot = indicatorToDot(status?.supabase.indicator ?? 'unknown')
  const sbValue = loading ? '…' : formatDescription(status?.supabase.description ?? 'Unknown')
  const sbDetail = loading ? '' : status?.supabase.indicator === 'none' ? 'No active incidents' : (status?.supabase.description ?? '—')
  const sbTooltip = status ? [
    { label: 'Status', value: status.supabase.description || '—' },
    { label: 'Indicator', value: status.supabase.indicator || '—' },
  ] : []

  // --- Gemini pill values (alternating) ---
  const g = status?.gemini
  const geminiDot: 'green' | 'yellow' | 'red' | 'gray' = loading
    ? 'gray'
    : !g || g.callsToday === 0
    ? 'green'
    : g.successRate >= 90 ? 'green' : g.successRate >= 70 ? 'yellow' : 'red'

  const geminiPrimary = loading ? '…' : g
    ? detailMode
      ? `${formatTokens(g.tokensToday)} tokens`
      : `${g.callsToday} calls today`
    : '—'

  const geminiDetail = loading ? '' : g
    ? detailMode
      ? `${formatCents(g.costCentsToday)} today`
      : `${g.successRate}% success`
    : '—'

  const geminiTooltip = g ? [
    { label: 'Calls today', value: String(g.callsToday) },
    { label: 'Runs today', value: String(g.runsToday) },
    { label: 'Tokens today', value: formatTokens(g.tokensToday) },
    { label: 'Cost today', value: formatCents(g.costCentsToday) },
    { label: 'Cost this week', value: formatCents(g.costCentsWeek) },
    { label: 'Success rate', value: `${g.successRate}%` },
    { label: 'Last run', value: g.lastRunAt ? new Date(g.lastRunAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—' },
  ] : []

  return (
    <DashboardScaleWrapper>
      <div className="flex flex-col h-screen min-h-screen bg-transparent">
        <DashboardHeader />
        <div className="relative z-200 w-full border-b border-black/30 bg-[#FF9F0F] px-3 py-2 text-white">
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-center gap-2 text-xs sm:gap-3 sm:text-sm">
            <StatusPill
              icon={<Cloud size={14} />}
              label="Cloudflare"
              dot={cfDot}
              value={cfValue}
              detailValue={cfDetail}
              detailMode={detailMode}
              loading={loading}
              tooltip={cfTooltip}
            />
            <StatusPill
              icon={<Database size={14} />}
              label="Supabase"
              dot={sbDot}
              value={sbValue}
              detailValue={sbDetail}
              detailMode={detailMode}
              loading={loading}
              tooltip={sbTooltip}
            />
            <StatusPill
              icon={<Sparkles size={14} />}
              label="Gemini API"
              dot={geminiDot}
              value={geminiPrimary}
              detailValue={geminiDetail}
              detailMode={detailMode}
              loading={loading}
              tooltip={geminiTooltip}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden p-4 w-full">
          <DashboardContentTransition>{children}</DashboardContentTransition>
        </div>

        <DashboardFooter />
      </div>
    </DashboardScaleWrapper>
  )
}

function StatusPill({
  icon,
  label,
  dot,
  value,
  detailValue,
  detailMode,
  loading,
  tooltip,
}: {
  icon: React.ReactNode
  label: string
  dot: 'green' | 'yellow' | 'red' | 'gray'
  value: string
  detailValue: string
  detailMode: boolean
  loading?: boolean
  tooltip?: { label: string; value: string }[]
}) {
  const dotColors: Record<string, string> = {
    green: 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,.8)]',
    yellow: 'bg-yellow-300 shadow-[0_0_6px_rgba(253,224,71,.8)]',
    red: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,.8)]',
    gray: 'bg-white/40',
  }

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.4 }}
      className="group relative inline-flex h-10 w-[340px] items-center justify-between gap-3 rounded-lg border border-white/35 bg-black/20 px-3.5 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,.2)] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/60 hover:bg-black/28 hover:shadow-[0_8px_18px_rgba(0,0,0,.3)]"
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-black/20 shrink-0 transition-transform duration-300 group-hover:scale-110">
        {icon}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`value-${label}-${detailMode}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="flex items-center gap-2 whitespace-nowrap min-w-0"
          >
            <span className="font-medium text-white/90 shrink-0 text-xs">{label}</span>
            <span className={['font-bold text-white truncate text-xs', loading ? 'opacity-50' : ''].join(' ')}>{value}</span>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:block w-[100px] text-right text-[11px] text-white/80 whitespace-nowrap overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={`detail-${label}-${detailMode}`}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="inline-block truncate max-w-full"
            >
              {detailValue}
            </motion.span>
          </AnimatePresence>
        </div>
        <span className={['h-2 w-2 rounded-full shrink-0', dotColors[dot]].join(' ')} />
      </div>

      {/* Hover tooltip */}
      {tooltip && tooltip.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-full z-9999 mt-2 w-52 -translate-x-1/2 rounded-xl border border-white/20 bg-[#1a1209] px-4 py-3 opacity-0 shadow-2xl transition-opacity duration-150 group-hover:opacity-100">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/50">{label}</div>
          <div className="space-y-1.5">
            {tooltip.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-white/60">{row.label}</span>
                <span className="text-[11px] font-semibold text-white">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
