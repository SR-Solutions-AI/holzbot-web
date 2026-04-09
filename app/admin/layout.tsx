 'use client'

import { useEffect, useState } from 'react'
import DashboardHeader from '../dashboard/DashboardHeader'
import DashboardFooter from '../dashboard/DashboardFooter'
import DashboardContentTransition from '../dashboard/DashboardContentTransition'
import DashboardScaleWrapper from '../dashboard/DashboardScaleWrapper'
import { Cloud, Sparkles, BrainCircuit } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

const ADMIN_STATUS = {
  cloudflare: 'Operational',
  openaiLeft: '62%',
  geminiLeft: '34%',
  openaiRpm: '8.4k RPM',
  geminiRpm: '3.1k RPM',
  openaiReset: 'Resets in 02:18',
  geminiReset: 'Resets in 05:42',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [detailMode, setDetailMode] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setDetailMode((v) => !v), 4000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <DashboardScaleWrapper>
      <div className="flex flex-col h-screen min-h-screen bg-transparent overflow-hidden">
        <DashboardHeader />
        <div className="w-full border-b border-black/30 bg-[#FF9F0F] px-3 py-2 text-white">
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-center gap-2 text-xs sm:gap-3 sm:text-sm">
            <StatusPill
              icon={<Cloud size={14} />}
              label="Cloudflare systems"
              value={detailMode ? 'WAF + CDN + DNS healthy' : ADMIN_STATUS.cloudflare}
              detailValue={detailMode ? 'No incidents in last 24h' : 'Edge status: Stable'}
              detailMode={detailMode}
            />
            <StatusPill
              icon={<BrainCircuit size={14} />}
              label="OpenAI usage left"
              value={detailMode ? ADMIN_STATUS.openaiRpm : ADMIN_STATUS.openaiLeft}
              detailValue={detailMode ? ADMIN_STATUS.openaiReset : 'Tokens left'}
              detailMode={detailMode}
            />
            <StatusPill
              icon={<Sparkles size={14} />}
              label="Gemini usage left"
              value={detailMode ? ADMIN_STATUS.geminiRpm : ADMIN_STATUS.geminiLeft}
              detailValue={detailMode ? ADMIN_STATUS.geminiReset : 'Tokens left'}
              detailMode={detailMode}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 p-4 w-full">
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
  value,
  detailValue,
  detailMode,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detailValue: string
  detailMode: boolean
}) {
  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.4 }}
      className="group inline-flex h-10 w-[430px] items-center justify-between gap-3 rounded-lg border border-white/35 bg-black/20 px-3.5 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,.2)] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/60 hover:bg-black/28 hover:shadow-[0_8px_18px_rgba(0,0,0,.3)]"
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-black/20 shrink-0 transition-transform duration-300 group-hover:scale-110">
        {icon}
      </span>
      <div className="min-w-0 flex-1 leading-tight text-center sm:text-left">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`value-${label}-${detailMode ? 'details' : 'tokens'}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="flex items-center gap-2 whitespace-nowrap min-w-0"
          >
            <span className="font-medium text-white/95 shrink-0">{label}</span>
            <span className="font-bold text-white truncate">{value}</span>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="hidden sm:block w-[120px] text-right text-[11px] text-white/80 whitespace-nowrap overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`detail-${label}-${detailMode ? 'details' : 'tokens'}`}
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
    </motion.div>
  )
}
