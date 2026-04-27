'use client'

import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

export type VpsNavbarMetricPanels = {
  cpuPercent: number | null
  memoryPercent: number | null
  diskPercent: number | null
  memoryUsedBytes: number | null
  memoryTotalBytes: number | null
  diskUsedBytes: number | null
  diskTotalBytes: number | null
  rxBps: number | null
  txBps: number | null
  trafficInBytes: number | null
  trafficOutBytes: number | null
}

export type VpsMetricHistorySample = {
  /** Dedupe / ordering when the same chip re-polls. */
  fetchedAt: string
  cpu: number
  mem: number
  disk: number
  rx: number
  tx: number
  /** Cumulative bytes (Hostinger); 0 when using push-only metrics. */
  trafficIn: number
  trafficOut: number
}

function formatBytes(n: number | null): string {
  if (n === null || !Number.isFinite(n) || n < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const digits = i === 0 ? 0 : v >= 100 ? 0 : v >= 10 ? 1 : 2
  return `${v.toFixed(digits)} ${units[i]}`
}

function formatBps(bps: number): string {
  if (!Number.isFinite(bps) || bps < 0) return '—'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s']
  let v = bps
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const digits = i === 0 ? 0 : v >= 100 ? 0 : v >= 10 ? 1 : 2
  return `${v.toFixed(digits)} ${units[i]}`
}

function pctPrimary(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—'
  const c = Math.min(100, Math.max(0, Math.round(n * 10) / 10))
  return `${c % 1 === 0 ? String(Math.round(c)) : c.toFixed(1)}%`
}

function widenSeries(s: number[]): number[] {
  if (s.length === 0) return [0, 0]
  if (s.length === 1) return [s[0]!, s[0]!]
  return s
}

function MiniSparkline({ series }: { series: number[] }) {
  const w = 58
  const h = 36
  const pad = 3
  const stroke = '#FF9F0F'
  const s = widenSeries(series.filter((x) => Number.isFinite(x)))
  if (s.length === 0) {
    return <svg width={w} height={h} className="shrink-0" aria-hidden />
  }
  const min = Math.min(...s)
  const max = Math.max(...s)
  const span = max - min || 1e-12
  const pts = s
    .map((v, i) => {
      const x = pad + (i / (s.length - 1)) * (w - 2 * pad)
      const y = pad + (1 - (v - min) / span) * (h - 2 * pad)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} className="shrink-0" viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
        opacity={0.92}
      />
    </svg>
  )
}

function MiniDonut({ percent }: { percent: number | null }) {
  const p = percent === null || !Number.isFinite(percent) ? 0 : Math.min(100, Math.max(0, percent))
  const r = 17
  const c = 2 * Math.PI * r
  const offset = c * (1 - p / 100)
  return (
    <svg width={46} height={46} viewBox="0 0 46 46" className="shrink-0" aria-hidden>
      <circle cx="23" cy="23" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
      <circle
        cx="23"
        cy="23"
        r={r}
        fill="none"
        stroke="#FF9F0F"
        strokeWidth="5"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 23 23)"
      />
    </svg>
  )
}

function HostMetricCard({
  label,
  primary,
  secondary,
  right,
}: {
  label: string
  primary: string
  secondary?: string | null
  right: ReactNode
}) {
  return (
    <div className="flex min-h-[86px] flex-row items-stretch justify-between gap-1.5 rounded-xl border border-white/12 bg-black/35 px-2.5 py-2 shadow-inner">
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <div className="flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sand/50">
          <ChevronRight size={11} className="shrink-0 text-[#FF9F0F]/80" aria-hidden />
          {label}
        </div>
        <div className="truncate text-[17px] font-bold leading-snug tracking-tight text-white">{primary}</div>
        {secondary ? <div className="line-clamp-2 text-[10px] leading-snug text-sand/65">{secondary}</div> : null}
      </div>
      <div className="flex shrink-0 items-center justify-end pr-0.5">{right}</div>
    </div>
  )
}

type Props = {
  panels: VpsNavbarMetricPanels
  history: VpsMetricHistorySample[]
}

export function VpsAdminMetricsPopoverContent({ panels, history }: Props) {
  const cpuSeries = history.map((h) => h.cpu)
  const memSeries = history.map((h) => h.mem)
  const rxSeries = history.map((h) => h.rx)
  const txSeries = history.map((h) => h.tx)
  const trafficInSeries = history.map((h) => h.trafficIn)
  const trafficOutSeries = history.map((h) => h.trafficOut)
  const trafficSumSeries = history.map((h) => h.trafficIn + h.trafficOut)
  const liveSumSeries = history.map((h) => h.rx + h.tx)

  const memSub =
    panels.memoryUsedBytes != null && panels.memoryTotalBytes != null && panels.memoryTotalBytes > 0
      ? `${formatBytes(panels.memoryUsedBytes)} / ${formatBytes(panels.memoryTotalBytes)}`
      : null

  const diskSub =
    panels.diskUsedBytes != null && panels.diskTotalBytes != null && panels.diskTotalBytes > 0
      ? `${formatBytes(panels.diskUsedBytes)} / ${formatBytes(panels.diskTotalBytes)}`
      : null

  const useLiveNet = panels.rxBps != null && panels.txBps != null

  const inPrimary = useLiveNet
    ? formatBps(panels.rxBps!)
    : panels.trafficInBytes != null
      ? formatBytes(panels.trafficInBytes)
      : '—'

  const outPrimary = useLiveNet
    ? formatBps(panels.txBps!)
    : panels.trafficOutBytes != null
      ? formatBytes(panels.trafficOutBytes)
      : '—'

  const bwPrimary = useLiveNet
    ? formatBps((panels.rxBps ?? 0) + (panels.txBps ?? 0))
    : panels.trafficInBytes != null && panels.trafficOutBytes != null
      ? formatBytes(panels.trafficInBytes + panels.trafficOutBytes)
      : '—'

  const bwSub = useLiveNet ? 'Live rate (in+out)' : 'Hostinger window (bytes)'

  const diskPctForRing =
    panels.diskPercent ??
    (panels.diskUsedBytes != null && panels.diskTotalBytes != null && panels.diskTotalBytes > 0
      ? (100 * panels.diskUsedBytes) / panels.diskTotalBytes
      : null)

  const cpuSpark = cpuSeries.length ? cpuSeries : [panels.cpuPercent ?? 0]
  const memSpark = memSeries.length ? memSeries : [panels.memoryPercent ?? 0]

  return (
    <div className="grid w-[min(94vw,540px)] grid-cols-3 gap-2">
      <HostMetricCard
        label="CPU usage"
        primary={pctPrimary(panels.cpuPercent)}
        secondary={null}
        right={<MiniSparkline series={cpuSpark} />}
      />
      <HostMetricCard
        label="Memory usage"
        primary={pctPrimary(panels.memoryPercent)}
        secondary={memSub}
        right={<MiniSparkline series={memSpark} />}
      />
      <HostMetricCard
        label="Disk usage"
        primary={pctPrimary(panels.diskPercent)}
        secondary={diskSub}
        right={<MiniDonut percent={diskPctForRing} />}
      />
      <HostMetricCard
        label="Incoming"
        primary={inPrimary}
        secondary={useLiveNet ? 'Bytes / second' : 'Bytes (window)'}
        right={
          useLiveNet ? (
            <MiniSparkline series={rxSeries.length ? rxSeries : [panels.rxBps ?? 0]} />
          ) : (
            <MiniSparkline series={trafficInSeries.length ? trafficInSeries : [panels.trafficInBytes ?? 0]} />
          )
        }
      />
      <HostMetricCard
        label="Outgoing"
        primary={outPrimary}
        secondary={useLiveNet ? 'Bytes / second' : 'Bytes (window)'}
        right={
          useLiveNet ? (
            <MiniSparkline series={txSeries.length ? txSeries : [panels.txBps ?? 0]} />
          ) : (
            <MiniSparkline series={trafficOutSeries.length ? trafficOutSeries : [panels.trafficOutBytes ?? 0]} />
          )
        }
      />
      <HostMetricCard
        label="Bandwidth"
        primary={bwPrimary}
        secondary={bwSub}
        right={
          useLiveNet ? (
            <MiniSparkline series={liveSumSeries.length ? liveSumSeries : [(panels.rxBps ?? 0) + (panels.txBps ?? 0)]} />
          ) : (
            <MiniSparkline
              series={
                trafficSumSeries.length
                  ? trafficSumSeries
                  : [(panels.trafficInBytes ?? 0) + (panels.trafficOutBytes ?? 0)]
              }
            />
          )
        }
      />
    </div>
  )
}