'use client'

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, apiFetch } from '../lib/supabaseClient'
import {
  Activity,
  BarChart3,
  Building2,
  Check,
  ChevronLeft,
  Clock3,
  Download,
  FileText,
  Filter,
  Gauge,
  Globe,
  Images,
  SquarePen,
  Upload,
  Layers3,
  List,
  Send,
  Sparkles,
  TrendingUp,
  Users2,
  Phone,
  Mail,
  Shield,
  FolderKanban,
  Coins,
  Search,
  X,
} from 'lucide-react'
import { DatePickerPopover } from '../components/DatePickerPopover'
import { SelectSun } from '../components/SunSelect'
import { OfferHistoryFilterForm } from '../components/OfferHistoryFilterForm'
import {
  fetchAdminTenants,
  fetchAdminTenantOffers,
  fetchAdminTenantWorkspace,
  fetchAdminStatisticsSummary,
  type AdminTenant,
  type AdminTenantOffer,
  type AdminTenantWorkspace,
  type AdminStatisticsSummary,
} from '../lib/adminApi'

/** Dashboard center logo; used as client header fallback when no `logoSrc`. */
const HOLZBOT_LOGO_PLACEHOLDER = '/logo.png'

type DummyOrg = { id: string; name: string }
type OrgMeta = {
  companyName: string
  phone: string
  email: string
  address: string
  logoLabel: string
  /** Client logo in header (paths under /public, e.g. /images/…). */
  logoSrc?: string
  codePrefix: string
  plan: string
  tokenBalance: string
  users: Array<{ name: string; role: 'Admin' | 'Member' }>
}

const DUMMY_ORGS: DummyOrg[] = [
  { id: 'org-1', name: 'Chiemgauer Holzhaus' },
  { id: 'org-2', name: 'Holzbau Eder' },
  { id: 'org-3', name: 'Alpen Timber Works' },
  { id: 'org-4', name: 'Nordic Frame Studio' },
  { id: 'org-5', name: 'Bavaria Roof Systems' },
  { id: 'org-6', name: 'Oakline Construction' },
]

const ORG_META: Record<string, OrgMeta> = {
  'org-1': {
    companyName: 'Chiemgauer Holzhaus',
    phone: '+49 861 4477 290',
    email: 'office@chiemgauer-holzhaus.de',
    address: 'Hochfellnstr. 18, Traunstein',
    logoLabel: 'CH',
    logoSrc: '/clients/chiemgauer.png',
    codePrefix: 'CHH',
    plan: 'Enterprise',
    tokenBalance: '18,440',
    users: [
      { name: 'Max', role: 'Admin' },
      { name: 'Florian', role: 'Member' },
      { name: 'Hans', role: 'Member' },
    ],
  },
  'org-2': {
    companyName: 'Holzbau Eder',
    phone: '+49 8031 1812 77',
    email: 'team@holzbau-eder.de',
    address: 'Wendelsteinweg 7, Rosenheim',
    logoLabel: 'HE',
    codePrefix: 'HBE',
    plan: 'Pro',
    tokenBalance: '9,120',
    users: [
      { name: 'Mara', role: 'Admin' },
      { name: 'Lukas', role: 'Member' },
    ],
  },
  'org-3': {
    companyName: 'Alpen Timber Works',
    phone: '+43 512 770 112',
    email: 'ops@alpentimber.at',
    address: 'Innrain 93, Innsbruck',
    logoLabel: 'AT',
    codePrefix: 'ATW',
    plan: 'Enterprise',
    tokenBalance: '22,300',
    users: [
      { name: 'Tobias', role: 'Admin' },
      { name: 'Sofia', role: 'Member' },
      { name: 'Lea', role: 'Member' },
    ],
  },
  'org-4': {
    companyName: 'Nordic Frame Studio',
    phone: '+46 8 402 44 10',
    email: 'hello@nordicframe.se',
    address: 'Sveavagen 64, Stockholm',
    logoLabel: 'NF',
    codePrefix: 'NFS',
    plan: 'Pro',
    tokenBalance: '7,980',
    users: [
      { name: 'Erik', role: 'Admin' },
      { name: 'Nora', role: 'Member' },
    ],
  },
  'org-5': {
    companyName: 'Bavaria Roof Systems',
    phone: '+49 89 271 70 33',
    email: 'support@bavaria-roof.de',
    address: 'Landsberger Str. 120, Munchen',
    logoLabel: 'BR',
    codePrefix: 'BRS',
    plan: 'Scale',
    tokenBalance: '13,550',
    users: [
      { name: 'Paul', role: 'Admin' },
      { name: 'Nico', role: 'Member' },
      { name: 'Mihai', role: 'Member' },
    ],
  },
  'org-6': {
    companyName: 'Oakline Construction',
    phone: '+49 711 990 04 21',
    email: 'projects@oakline.de',
    address: 'Neckarstr. 55, Stuttgart',
    logoLabel: 'OC',
    codePrefix: 'OCL',
    plan: 'Pro',
    tokenBalance: '8,660',
    users: [
      { name: 'Anna', role: 'Admin' },
      { name: 'Daria', role: 'Member' },
    ],
  },
}

const RANGE_OPTIONS = ['1w', '2w', '1m', '3m', '6m', '1y', 'custom'] as const
type RangeOption = (typeof RANGE_OPTIONS)[number]
const THROUGHPUT_SERIES = [
  { label: 'W1', offers: 142, avgTime: '7m 12s' },
  { label: 'W2', offers: 158, avgTime: '6m 58s' },
  { label: 'W3', offers: 151, avgTime: '6m 41s' },
  { label: 'W4', offers: 176, avgTime: '6m 28s' },
  { label: 'W5', offers: 168, avgTime: '6m 22s' },
  { label: 'W6', offers: 189, avgTime: '6m 08s' },
  { label: 'W7', offers: 194, avgTime: '5m 59s' },
  { label: 'W8', offers: 203, avgTime: '5m 54s' },
] as const

/** Same W1–W8 window as throughput chart — demo series for KPI sparklines. */
const KPI_SPARK_OFFERS = [1688, 1724, 1690, 1848, 1812, 1960, 2024, 2184] as const
/** Daily avg processing time trend (seconds); card headline stays a separate aggregate. */
const KPI_SPARK_PROC_SECONDS = [432, 418, 401, 388, 382, 368, 359, 402] as const
/** Net clients per week (acquired − churn, illustrative). */
const KPI_SPARK_CLIENTS_NET = [5, 7, 4, 9, 8, 10, 11, 12] as const
const KPI_SPARK_INCIDENTS = [34, 31, 28, 30, 29, 27, 25, 27] as const
const DATA_MOAT_ITEMS = [
  { title: 'Plan segmentation', markedPlans: 14382 },
  { title: 'Wall detection', markedPlans: 9744 },
  { title: 'Rooms detection', markedPlans: 7219 },
  { title: 'Doors', markedPlans: 18108 },
  { title: 'Windows', markedPlans: 22991 },
] as const
const PIPELINE_STAGES = [
  { label: 'Plan segmentation', value: 93, processed: '14,382', failed: '74', avg: '1.8s', trend: '+2.1%' },
  { label: 'Wall detection', value: 88, processed: '9,744', failed: '112', avg: '2.6s', trend: '+0.9%' },
  { label: 'Room extraction', value: 81, processed: '7,219', failed: '167', avg: '3.1s', trend: '-0.4%' },
  { label: 'Door/window parsing', value: 76, processed: '18,108', failed: '242', avg: '3.8s', trend: '-1.2%' },
  { label: 'Quote synthesis', value: 69, processed: '6,004', failed: '318', avg: '4.4s', trend: '-2.6%' },
] as const
const AVG_COST_PER_RUN_CENTS = 84

type OrgUserEditable = {
  name: string
  email: string
  role: 'Admin' | 'Member'
  password: string
  /** When set, row comes from Supabase; the edit modal does not persist changes. */
  sourceProfileId?: string
}

function parseTokenBalanceString(s: string): number {
  const n = parseInt(s.replace(/,/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

function profileRoleToUi(role: string | null): 'Admin' | 'Member' {
  const r = (role ?? '').toLowerCase()
  return r === 'admin' ? 'Admin' : 'Member'
}

/** When an org comes only from the API (no ORG_META entry), use this for organisation workspace placeholders. */
function buildSyntheticOrgMeta(t: AdminTenant): OrgMeta {
  const raw = (t.slug || t.name || 'org').replace(/[^a-z0-9]/gi, '')
  const codePrefix = raw.slice(0, 3).toUpperCase() || 'ORG'
  const displayName = t.name?.trim() || t.slug || 'Organization'
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'OR'
  return {
    companyName: displayName,
    phone: '—',
    email: '—',
    address: '—',
    logoLabel: initials,
    codePrefix,
    plan: '—',
    tokenBalance: '0',
    users: [{ name: '—', role: 'Member' }],
  }
}

function seedOrgUsersFromMeta(meta: OrgMeta): OrgUserEditable[] {
  const domain = meta.email.includes('@') ? meta.email.split('@')[1]! : 'org.local'
  return meta.users.map((u, i) => {
    const slug = u.name.toLowerCase().replace(/[^a-z]/g, '') || 'user'
    return {
      name: u.name,
      email: `${slug}${i || ''}@${domain}`,
      role: u.role,
      password: '',
    }
  })
}

const ORG_PROJECT_TITLES = [
  'Neubau Angebot',
  'Dachstuhl revision',
  'Mengenermittlung MFH',
  'Sanierung Holzbau',
  'Carport + Anbau',
  'Treppenhaus Angebot',
  'Fenster & Turen Paket',
  'Wintergarten quote',
  'Gewerbehalle shell',
  'Einfamilienhaus full',
  'Dachausbau offer',
  'Garage Holzkonstruktion',
] as const
/** Wizard offer types for Projects filter (same slugs as HistoryList / OfferHistoryFilterForm). */
const ADMIN_OFFER_TYPE_OPTIONS = [
  { id: 'adm-meng', slug: 'mengenermittlung' },
  { id: 'adm-dach', slug: 'dachstuhl' },
  { id: 'adm-neu', slug: 'neubau' },
] as const

const ORG_PROJECT_DURATIONS = [
  '6m 12s',
  '15m 36s',
  '9m 04s',
  '22m 18s',
  '11m 41s',
  '7m 55s',
  '18m 02s',
  '5m 48s',
  '13m 27s',
  '8m 33s',
  '19m 09s',
  '10m 14s',
] as const

/**
 * Activity heatmap: 5 fixed steps (Less → More), same hexes as the legend swatches.
 * Ramp from deep brown → brand orange (#ff9f0f).
 */
const ACTIVITY_HEATMAP_STEPS = ['#352b22', '#5a3d26', '#8b5c24', '#c97810', '#ff9f0f'] as const
const ACTIVITY_HEATMAP_EMPTY = '#1e1a16'

function activityHeatmapStepIndex(runs: number, maxRuns: number): number {
  if (runs <= 0) return -1
  const denom = Math.max(1, maxRuns)
  const step = Math.ceil((runs / denom) * ACTIVITY_HEATMAP_STEPS.length) - 1
  return Math.min(ACTIVITY_HEATMAP_STEPS.length - 1, Math.max(0, step))
}

function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDeltaPct(current: number, previous: number): string {
  if (previous === 0 && current === 0) return '0%'
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const pct = ((current - previous) / previous) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function formatRefreshLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const sec = (Date.now() - d.getTime()) / 1000
  if (sec < 45) return 'just now'
  if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))}m ago`
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatMeanWallSeconds(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '—'
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m <= 0) return `${r}s`
  return `${m}m ${String(r).padStart(2, '0')}s`
}

function bumpDayCount(map: Map<string, number>, iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return
  const key = toYMD(d)
  map.set(key, (map.get(key) ?? 0) + 1)
}

type AdminOrgProjectStatus = 'Running' | 'Queued' | 'Completed' | 'Failed' | 'Cancelled'

type AdminOrgProjectRow = {
  id: string
  ref: string
  /** Offer kind label (English; same rules as HistoryList type badge). */
  offerKindLabel: string
  dateLabel: string
  title: string
  duration: string
  /** Explains total vs last-run duration (English tooltip). */
  durationTooltip?: string
  status: AdminOrgProjectStatus
  /** DB status string for HistoryList-style badge. */
  rawOfferStatus: string
  historyStatusLabel: string
  historyStatusBadgeClass: string
  owner?: string | null
  ownerMemberId: string
  offerSlug: string
  createdAt: Date
  createdAtIso: string
  pipelineFinishedAtIso?: string | null
  durationWallSeconds?: number | null
  lastRunDurationSeconds?: number | null
  /** True when row comes from `fetchAdminTenantOffers` (not demo seed data). */
  isLiveRow?: boolean
}

function formatDurationSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  if (sec < 60) return `${Math.round(sec)}s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  const mr = m % 60
  return mr > 0 ? `${h}h ${mr}m` : `${h}h`
}

function formatEnDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Normalize default Romanian wizard title for English admin UI. */
const ADMIN_OFFER_TITLE_EN: Record<string, string> = {
  'ofertă nouă': 'New offer',
}

function translateAdminOfferDisplay(text: string): string {
  const k = text.trim().toLowerCase()
  return ADMIN_OFFER_TITLE_EN[k] || text
}

/** Same signals as HistoryList `getOfferTypeBadgeLabel`; English labels for admin cards. */
function adminOfferKindLabelEn(
  meta: AdminTenantOffer['meta_for_kind'] | undefined,
  offerTypeSlug: string | null | undefined,
): string {
  const m = meta ?? {}
  const slug = (offerTypeSlug || '').toLowerCase()
  const wizardPkg = (m.wizard_package || '').toString().toLowerCase()
  const isRoofOffer = m.roof_only_offer === true || wizardPkg === 'dachstuhl' || slug === 'dachstuhl'
  const isMeasurementsOnly = m.measurements_only_offer === true
  const slugIsMengen = slug === 'mengen' || slug === 'mengenermittlung'
  const treatAsMeasurements = isMeasurementsOnly || slugIsMengen

  if (treatAsMeasurements && isRoofOffer) return 'Roof takeoff'
  if (treatAsMeasurements && !isRoofOffer) return 'House takeoff'
  if (isRoofOffer) return 'Roof offer'
  return 'House offer'
}

/** Status pill: English labels, same colours as HistoryList-style badges. */
function historyStatusPresentation(status?: string | null): { label: string; className: string } {
  const s = (status || '').toLowerCase()
  if (s === 'draft' || s === 'entwurf') {
    return { label: 'Draft', className: 'border-sand/30 bg-sand/10 text-sand' }
  }
  if (s === 'processing' || s === 'running' || s === 'laufend') {
    return { label: 'Running', className: 'border-yellow-400/40 bg-yellow-400/15 text-yellow-300' }
  }
  if (s === 'done' || s === 'finished' || s === 'fertig' || s === 'ready') {
    return { label: 'Completed', className: 'border-[#FF9F0F]/60 bg-[#FF9F0F]/15 text-[#FF9F0F]' }
  }
  if (s === 'cancelled') {
    return { label: 'Cancelled', className: 'border-red-500/40 bg-red-500/10 text-red-300' }
  }
  if (s === 'failed') {
    return { label: 'Failed', className: 'border-red-500/45 bg-red-500/12 text-red-200/95' }
  }
  return { label: status?.trim() ? status : '—', className: 'border-white/22 bg-white/10 text-sand/88' }
}

function projectDurationTooltip(o: AdminTenantOffer): string {
  const lines: string[] = []
  if (o.duration_wall_seconds != null && o.duration_wall_seconds >= 0) {
    lines.push(
      `Total: wall time from when the offer was created until the end of the latest finished compute run (${formatDurationSeconds(o.duration_wall_seconds)}).`,
    )
  }
  if (o.last_run_duration_seconds != null && o.last_run_duration_seconds >= 0) {
    lines.push(
      `Last run: duration of the most recent run only, start→end (${formatDurationSeconds(o.last_run_duration_seconds)}).`,
    )
  }
  return lines.join(' ')
}

function pickProjectDurationLabel(o: AdminTenantOffer): string {
  const st = (o.status || '').toLowerCase()
  if (o.duration_wall_seconds != null && o.duration_wall_seconds >= 0) {
    return `${formatDurationSeconds(o.duration_wall_seconds)} (total)`
  }
  if ((st === 'processing' || st === 'running' || st === 'laufend') && o.created_at) {
    const elapsed = (Date.now() - new Date(o.created_at).getTime()) / 1000
    return `${formatDurationSeconds(elapsed)} · running`
  }
  if (o.last_run_duration_seconds != null && o.last_run_duration_seconds >= 0) {
    return `${formatDurationSeconds(o.last_run_duration_seconds)} (last run)`
  }
  return '—'
}

function mapAdminTenantOfferToRow(o: AdminTenantOffer): AdminOrgProjectRow {
  const created = new Date(o.created_at)
  const headline = translateAdminOfferDisplay(o.display_title ?? o.title)
  const hist = historyStatusPresentation(o.status)
  return {
    id: o.id,
    ref: o.ref,
    offerKindLabel: adminOfferKindLabelEn(o.meta_for_kind ?? {}, o.offer_type_slug),
    dateLabel: formatEnDateTime(o.created_at),
    title: headline,
    duration: pickProjectDurationLabel(o),
    durationTooltip: projectDurationTooltip(o) || undefined,
    status: o.status_ui,
    rawOfferStatus: o.status,
    historyStatusLabel: hist.label,
    historyStatusBadgeClass: hist.className,
    owner: o.owner_name,
    ownerMemberId: o.owner_id ?? '—',
    offerSlug: o.offer_type_slug ?? 'neubau',
    createdAt: Number.isNaN(created.getTime()) ? new Date() : created,
    createdAtIso: o.created_at,
    pipelineFinishedAtIso: o.pipeline_finished_at,
    durationWallSeconds: o.duration_wall_seconds,
    lastRunDurationSeconds: o.last_run_duration_seconds,
    isLiveRow: true,
  }
}

/** Align DB offer_type slugs with admin filter options (see OfferHistoryFilterForm). */
function offerSlugMatchesAdminFilter(offerSlug: string, filterSlug: string | undefined): boolean {
  if (!filterSlug) return true
  if (filterSlug === 'neubau') return offerSlug === 'neubau' || offerSlug === 'full_house'
  if (filterSlug === 'mengenermittlung') return offerSlug === 'mengenermittlung' || offerSlug === 'mengen'
  if (filterSlug === 'dachstuhl') return offerSlug === 'dachstuhl'
  return offerSlug === filterSlug
}

export default function AdminPage() {
  const [ready, setReady] = useState(false)
  const [activeView, setActiveView] = useState<'statistics' | 'organization'>('statistics')
  const [selectedOrgId, setSelectedOrgId] = useState<string>(DUMMY_ORGS[0].id)
  const [selectedRange, setSelectedRange] = useState<RangeOption>('1m')
  const [orgFilters, setOrgFilters] = useState<string[]>([DUMMY_ORGS[0].id])
  const [audienceMode, setAudienceMode] = useState<'all' | 'custom'>('all')
  const [customUsersOpen, setCustomUsersOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleTimezone, setScheduleTimezone] = useState('Europe/Berlin')
  const [tokensModalOpen, setTokensModalOpen] = useState(false)
  const [tokensAddAmount, setTokensAddAmount] = useState('2500')
  const [tokenBalancesByOrg, setTokenBalancesByOrg] = useState<Record<string, number>>({})
  const [orgEditableUsers, setOrgEditableUsers] = useState<Record<string, OrgUserEditable[]>>({})
  const [editMemberModalOpen, setEditMemberModalOpen] = useState(false)
  const [editMemberDraft, setEditMemberDraft] = useState<OrgUserEditable | null>(null)
  const [editMemberIndex, setEditMemberIndex] = useState<number | null>(null)
  const [projSearchOpen, setProjSearchOpen] = useState(false)
  const [projSearch, setProjSearch] = useState('')
  const [projFilterOpen, setProjFilterOpen] = useState(false)
  const [projDraftOfferTypeId, setProjDraftOfferTypeId] = useState('')
  const [projDraftDateFrom, setProjDraftDateFrom] = useState('')
  const [projDraftDateTo, setProjDraftDateTo] = useState('')
  const [projDraftUserIds, setProjDraftUserIds] = useState<string[]>([])
  const [projAppliedOfferTypeId, setProjAppliedOfferTypeId] = useState('')
  const [projAppliedDateFrom, setProjAppliedDateFrom] = useState('')
  const [projAppliedDateTo, setProjAppliedDateTo] = useState('')
  const [projAppliedUserIds, setProjAppliedUserIds] = useState<string[]>([])
  const [customMode, setCustomMode] = useState<'manual' | 'plans' | 'offerTypes'>('manual')
  const [manualUsers, setManualUsers] = useState<string[]>(['Anna Keller', 'Lukas Meier'])
  const [planBucket, setPlanBucket] = useState<'all' | '0-10' | '11-30' | '31+'>('11-30')
  const [offerTypeTargets, setOfferTypeTargets] = useState<string[]>(['Neubau'])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const statsScrollRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef({ dragging: false, startY: 0, startTop: 0 })
  const [statsThumb, setStatsThumb] = useState({ height: 40, top: 0 })
  const [statsScrollVisible, setStatsScrollVisible] = useState(false)
  const pipelineScrollRef = useRef<HTMLDivElement>(null)
  const projFilterWrapRef = useRef<HTMLDivElement>(null)
  const projFilterButtonRef = useRef<HTMLButtonElement>(null)
  const projFilterPanelRef = useRef<HTMLDivElement>(null)
  const [projFilterPanelPos, setProjFilterPanelPos] = useState({ top: 0, left: 0 })
  const pipelineDragRef = useRef({ dragging: false, startY: 0, startTop: 0 })
  const [pipelineThumb, setPipelineThumb] = useState({ height: 40, top: 0 })
  const [pipelineScrollVisible, setPipelineScrollVisible] = useState(false)
  const [selectedProjectRef, setSelectedProjectRef] = useState<string | null>(null)
  const [adminTenants, setAdminTenants] = useState<AdminTenant[]>([])
  const [adminTenantsStatus, setAdminTenantsStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [adminTenantsError, setAdminTenantsError] = useState<string | null>(null)
  const [tenantOffers, setTenantOffers] = useState<AdminTenantOffer[]>([])
  const [tenantOffersStatus, setTenantOffersStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [tenantOffersError, setTenantOffersError] = useState<string | null>(null)
  /** Tenant id for which `tenantOffers` is valid; avoids showing previous org's list after `selectedOrgId` changes (effect runs after paint). */
  const [tenantOffersLoadedForId, setTenantOffersLoadedForId] = useState<string | null>(null)
  const [tenantWorkspace, setTenantWorkspace] = useState<{
    status: 'idle' | 'loading' | 'ok' | 'error'
    data: AdminTenantWorkspace | null
    error: string | null
    loadedForTenantId: string | null
  }>({ status: 'idle', data: null, error: null, loadedForTenantId: null })
  const [statsSummary, setStatsSummary] = useState<AdminStatisticsSummary | null>(null)
  const [statsStatus, setStatsStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [statsError, setStatsError] = useState<string | null>(null)

  const heatmapTipHideRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [heatmapTooltip, setHeatmapTooltip] = useState<{
    left: number
    top: number
    dateStr: string
    runs: number
    live: boolean
    swatch: string
  } | null>(null)

  useEffect(() => {
    return () => {
      if (heatmapTipHideRef.current) clearTimeout(heatmapTipHideRef.current)
    }
  }, [])

  useEffect(() => {
    if (activeView !== 'organization') {
      setHeatmapTooltip(null)
      if (heatmapTipHideRef.current) {
        clearTimeout(heatmapTipHideRef.current)
        heatmapTipHideRef.current = null
      }
    }
  }, [activeView])

  useEffect(() => {
    setHeatmapTooltip(null)
    if (heatmapTipHideRef.current) {
      clearTimeout(heatmapTipHideRef.current)
      heatmapTipHideRef.current = null
    }
  }, [selectedOrgId])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        window.location.href = '/login'
        return
      }
      try {
        const me = await apiFetch('/me')
        const role = (me?.user?.role ?? null) as string | null
        if (role !== 'admin') {
          window.location.href = '/dashboard'
          return
        }
        if (mounted) setReady(true)
      } catch {
        window.location.href = '/dashboard'
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setAdminTenantsStatus('loading')
    setAdminTenantsError(null)
    ;(async () => {
      try {
        const res = await fetchAdminTenants()
        if (cancelled) return
        setAdminTenants(res.items ?? [])
        setAdminTenantsStatus('ok')
      } catch (e: unknown) {
        if (cancelled) return
        setAdminTenantsStatus('error')
        setAdminTenantsError(e instanceof Error ? e.message : 'Failed to load organizations')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ready])

  /** DB-backed orgs once loaded; until then dummy list keeps layout stable. */
  const clientOrgs: DummyOrg[] = useMemo(() => {
    if (adminTenantsStatus === 'ok') {
      if (adminTenants.length === 0) return DUMMY_ORGS
      return adminTenants.map((t) => ({ id: t.id, name: t.name }))
    }
    return DUMMY_ORGS
  }, [adminTenants, adminTenantsStatus])

  const hasLiveOrgList = adminTenantsStatus === 'ok' && adminTenants.length > 0

  useEffect(() => {
    if (adminTenantsStatus !== 'ok') return
    if (adminTenants.length === 0) {
      setSelectedOrgId(DUMMY_ORGS[0]!.id)
      setOrgFilters(DUMMY_ORGS.map((o) => o.id))
      return
    }
    const ids = new Set(adminTenants.map((t) => t.id))
    setSelectedOrgId((prev) => (ids.has(prev) ? prev : adminTenants[0]!.id))
    setOrgFilters((prev) => {
      const next = prev.filter((id) => ids.has(id))
      if (next.length > 0) return next
      return [adminTenants[0]!.id]
    })
  }, [adminTenants, adminTenantsStatus])

  const usingLiveProjects =
    adminTenantsStatus === 'ok' && adminTenants.length > 0 && adminTenants.some((t) => t.id === selectedOrgId)

  useEffect(() => {
    setTenantOffers([])
    setTenantOffersLoadedForId(null)
    setTenantOffersStatus('idle')
    setTenantOffersError(null)
    if (!usingLiveProjects) return
    const tenantId = selectedOrgId
    let cancelled = false
    setTenantOffersStatus('loading')
    setTenantOffersError(null)
    ;(async () => {
      try {
        const res = await fetchAdminTenantOffers(tenantId, { limit: 100 })
        if (cancelled) return
        setTenantOffers(res.items ?? [])
        setTenantOffersLoadedForId(tenantId)
        setTenantOffersStatus('ok')
      } catch (e: unknown) {
        if (cancelled) return
        setTenantOffersStatus('error')
        setTenantOffersError(e instanceof Error ? e.message : 'Could not load projects.')
        setTenantOffers([])
        setTenantOffersLoadedForId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedOrgId, usingLiveProjects])

  useEffect(() => {
    setTenantWorkspace({ status: 'idle', data: null, error: null, loadedForTenantId: null })
    if (!usingLiveProjects) return
    const tenantId = selectedOrgId
    let cancelled = false
    setTenantWorkspace({ status: 'loading', data: null, error: null, loadedForTenantId: null })
    ;(async () => {
      try {
        const data = await fetchAdminTenantWorkspace(tenantId)
        if (cancelled) return
        setTenantWorkspace({ status: 'ok', data, error: null, loadedForTenantId: tenantId })
      } catch (e: unknown) {
        if (cancelled) return
        setTenantWorkspace({
          status: 'error',
          data: null,
          error: e instanceof Error ? e.message : 'Could not load organization.',
          loadedForTenantId: null,
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedOrgId, usingLiveProjects])

  useEffect(() => {
    if (!ready || activeView !== 'statistics') return
    if (!hasLiveOrgList) {
      setStatsStatus('idle')
      setStatsSummary(null)
      setStatsError(null)
      return
    }
    if (!dateFrom || !dateTo) return
    let cancelled = false
    setStatsStatus('loading')
    setStatsError(null)
    const filtered = orgFilters.filter((id) => adminTenants.some((t) => t.id === id))
    const tenantIds = filtered.length > 0 ? filtered : adminTenants.map((t) => t.id)
    ;(async () => {
      try {
        const data = await fetchAdminStatisticsSummary({ from: dateFrom, to: dateTo, tenantIds })
        if (cancelled) return
        setStatsSummary(data)
        setStatsStatus('ok')
      } catch (e: unknown) {
        if (cancelled) return
        setStatsStatus('error')
        setStatsError(e instanceof Error ? e.message : 'Could not load statistics.')
        setStatsSummary(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    ready,
    activeView,
    hasLiveOrgList,
    dateFrom,
    dateTo,
    orgFilters.join(','),
    adminTenants.map((t) => t.id).join(','),
  ])

  const liveWorkspace =
    usingLiveProjects &&
    tenantWorkspace.status === 'ok' &&
    tenantWorkspace.loadedForTenantId === selectedOrgId &&
    tenantWorkspace.data
      ? tenantWorkspace.data
      : null

  const selectedOrg = useMemo(() => {
    const o = clientOrgs.find((org) => org.id === selectedOrgId)
    if (o) return o
    return clientOrgs[0] ?? DUMMY_ORGS[0]
  }, [clientOrgs, selectedOrgId])

  const selectedOrgNames = useMemo(
    () => clientOrgs.filter((org) => orgFilters.includes(org.id)).map((org) => org.name),
    [orgFilters, clientOrgs],
  )

  const throughputChartPoints = useMemo(() => {
    if (!hasLiveOrgList) {
      return THROUGHPUT_SERIES.map((p) => ({
        label: p.label,
        offers: p.offers,
        avgTime: p.avgTime,
      }))
    }
    if (statsStatus === 'ok' && statsSummary) {
      return statsSummary.throughput.map((p) => ({
        label: p.label,
        offers: p.offers,
        avgTime: p.avg_time_label,
      }))
    }
    return Array.from({ length: 8 }, (_, i) => ({
      label: `·${i + 1}`,
      offers: 0,
      avgTime: '—',
    }))
  }, [hasLiveOrgList, statsStatus, statsSummary])

  const statisticsKpi = useMemo(() => {
    type Row = { value: string; delta: string }
    const pendingStats =
      hasLiveOrgList && (statsStatus === 'loading' || (statsStatus === 'idle' && !statsSummary))
    const loadingRow: Row = { value: pendingStats ? '…' : '—', delta: '—' }
    const zeroSpark = Array.from({ length: 8 }, () => 0)
    if (!hasLiveOrgList) {
      return {
        refreshLabel: 'just now',
        throughputSub: { offers: '1,381', avg: '6m 17s' },
        offers: { value: '2,184', delta: '+12.8%' } satisfies Row,
        proc: { value: '6m 42s', delta: '-8.1%' } satisfies Row,
        clients: { value: '38 / 4', delta: '+6.2%' } satisfies Row,
        incidents: { value: '27', delta: '-11.4%' } satisfies Row,
        sparkOffers: [...KPI_SPARK_OFFERS],
        sparkProc: [...KPI_SPARK_PROC_SECONDS],
        sparkClients: [...KPI_SPARK_CLIENTS_NET],
        sparkIncidents: [...KPI_SPARK_INCIDENTS],
        sparkCaption: '8-week trend',
        procCaption: 'Daily avg (lower is better)',
        clientsCaption: 'Net new / week',
      }
    }
    if (statsStatus === 'ok' && statsSummary) {
      const t = statsSummary.totals
      const procDelta =
        t.mean_wall_seconds_current != null && t.mean_wall_seconds_previous != null
          ? formatDeltaPct(t.mean_wall_seconds_current, t.mean_wall_seconds_previous)
          : '—'
      const segCaption = 'Segments in selected range'
      return {
        refreshLabel: formatRefreshLabel(statsSummary.refreshed_at),
        throughputSub: {
          offers: t.offers_current.toLocaleString('en-US'),
          avg: formatMeanWallSeconds(t.mean_wall_seconds_current),
        },
        offers: {
          value: t.offers_current.toLocaleString('en-US'),
          delta: formatDeltaPct(t.offers_current, t.offers_previous),
        },
        proc: {
          value: formatMeanWallSeconds(t.mean_wall_seconds_current),
          delta: procDelta,
        },
        clients: {
          value: `${t.profiles_acquired_current}/${t.profiles_churn_current}`,
          delta: formatDeltaPct(t.profiles_acquired_current, t.profiles_acquired_previous),
        },
        incidents: {
          value: String(t.incidents_current),
          delta: formatDeltaPct(t.incidents_current, t.incidents_previous),
        },
        sparkOffers: [...statsSummary.kpi_series.offers],
        sparkProc: [...statsSummary.kpi_series.avg_wall_seconds],
        sparkClients: [...statsSummary.kpi_series.clients_net],
        sparkIncidents: [...statsSummary.kpi_series.incidents],
        sparkCaption: segCaption,
        procCaption: 'Mean wall time per segment',
        clientsCaption: 'New members per segment (churn not tracked)',
      }
    }
    return {
      refreshLabel: statsStatus === 'loading' ? '…' : '—',
      throughputSub: { offers: '—', avg: '—' },
      offers: loadingRow,
      proc: loadingRow,
      clients: loadingRow,
      incidents: loadingRow,
      sparkOffers: zeroSpark,
      sparkProc: zeroSpark,
      sparkClients: zeroSpark,
      sparkIncidents: zeroSpark,
      sparkCaption: '—',
      procCaption: '—',
      clientsCaption: '—',
    }
  }, [hasLiveOrgList, statsStatus, statsSummary])

  const selectedOrgMeta = useMemo(() => {
    const hardcoded = ORG_META[selectedOrgId]
    if (hardcoded) return hardcoded
    const t = adminTenants.find((x) => x.id === selectedOrgId)
    const base = t ? buildSyntheticOrgMeta(t) : ORG_META['org-1']
    if (!t || !liveWorkspace) return base
    const ws = liveWorkspace
    const displayName = ws.tenant.name?.trim() || t.name || ws.tenant.slug
    const raw = (ws.tenant.slug || displayName).replace(/[^a-z0-9]/gi, '')
    const codePrefix = raw.slice(0, 3).toUpperCase() || 'ORG'
    const initials =
      displayName
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'OR'
    const dash = (s: string) => (s.trim() ? s : '—')
    return {
      ...base,
      companyName: displayName,
      phone: dash(ws.branding.phone),
      email: dash(ws.branding.email),
      address: dash(ws.branding.address),
      logoLabel: initials,
      codePrefix,
      plan: ws.tokens.tier_label,
      tokenBalance: ws.tokens.unlimited ? '999999' : String(ws.tokens.remaining ?? 0),
      users: ws.profiles.map((p) => ({
        name: p.full_name?.trim() || p.email?.trim() || '—',
        role: profileRoleToUi(p.role),
      })),
    }
  }, [selectedOrgId, adminTenants, liveWorkspace])

  /** Uploaded tenant logo (API) — shown in client workspace header instead of static placeholder. */
  const selectedOrgTenantLogoUrl = useMemo(() => {
    if (adminTenantsStatus !== 'ok') return null
    return adminTenants.find((t) => t.id === selectedOrgId)?.logo_url ?? null
  }, [adminTenants, adminTenantsStatus, selectedOrgId])

  const orgTokenBalanceDisplay = useMemo(() => {
    if (liveWorkspace) {
      const tok = liveWorkspace.tokens
      if (tok.unlimited || tok.limit === null) return '∞'
      if (tok.remaining !== null) return tok.remaining.toLocaleString('en-US')
      return '—'
    }
    const stored = tokenBalancesByOrg[selectedOrgId]
    const n = stored ?? parseTokenBalanceString(selectedOrgMeta.tokenBalance)
    return n.toLocaleString('en-US')
  }, [liveWorkspace, tokenBalancesByOrg, selectedOrgId, selectedOrgMeta])

  const orgUsersList = useMemo((): OrgUserEditable[] => {
    if (liveWorkspace) {
      return liveWorkspace.profiles.map((p) => ({
        name: p.full_name?.trim() || p.email?.trim() || '—',
        email: p.email?.trim() ?? '',
        role: profileRoleToUi(p.role),
        password: '',
        sourceProfileId: p.id,
      }))
    }
    return orgEditableUsers[selectedOrgId] ?? seedOrgUsersFromMeta(selectedOrgMeta)
  }, [liveWorkspace, orgEditableUsers, selectedOrgId, selectedOrgMeta])

  useEffect(() => {
    if (activeView !== 'organization') return
    if (liveWorkspace) return
    setOrgEditableUsers((prev) => {
      if (prev[selectedOrgId]) return prev
      return { ...prev, [selectedOrgId]: seedOrgUsersFromMeta(selectedOrgMeta) }
    })
  }, [activeView, selectedOrgId, selectedOrgMeta, liveWorkspace])

  useEffect(() => {
    setSelectedProjectRef(null)
  }, [selectedOrgId])

  const orgDummyProjects = useMemo((): AdminOrgProjectRow[] => {
    const seed = selectedOrgId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    const pfx = selectedOrgMeta.codePrefix
    const userCount = Math.max(1, selectedOrgMeta.users.length)
    const offerCycle = ['mengenermittlung', 'dachstuhl', 'neubau'] as const
    return Array.from({ length: 12 }).map((_, idx) => {
      const dayOffset = (seed + idx * 11) % 48
      const d = new Date()
      d.setDate(d.getDate() - dayOffset)
      d.setHours(12, 0, 0, 0)
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const yyyy = d.getFullYear()
      const statusRoll = (seed + idx * 7) % 10
      const status = statusRoll === 0 ? 'Running' : statusRoll === 1 ? 'Queued' : 'Completed'
      const ownerIdx = idx % userCount
      const ownerUser = selectedOrgMeta.users[ownerIdx]
      const ref = `${pfx}-${yyyy}-${String(120 + idx).padStart(3, '0')}`
      const slug = offerCycle[idx % 3]
      const rawStatus = status === 'Running' ? 'processing' : status === 'Queued' ? 'draft' : 'ready'
      const hist = historyStatusPresentation(rawStatus)
      return {
        id: ref,
        ref,
        offerKindLabel: adminOfferKindLabelEn({}, slug),
        dateLabel: `${dd}.${mm}.${yyyy} · 12:00`,
        title: ORG_PROJECT_TITLES[idx % ORG_PROJECT_TITLES.length],
        duration: ORG_PROJECT_DURATIONS[idx % ORG_PROJECT_DURATIONS.length],
        status: status as AdminOrgProjectStatus,
        rawOfferStatus: rawStatus,
        historyStatusLabel: hist.label,
        historyStatusBadgeClass: hist.className,
        owner: ownerUser?.name,
        ownerMemberId: `adm-${selectedOrgId}-u${ownerIdx}`,
        offerSlug: slug,
        createdAt: d,
        createdAtIso: d.toISOString(),
        pipelineFinishedAtIso: null,
        durationWallSeconds: null,
        lastRunDurationSeconds: null,
        isLiveRow: false,
      }
    })
  }, [selectedOrgId, selectedOrgMeta])

  const tenantOffersMatchSelection =
    usingLiveProjects && tenantOffersStatus === 'ok' && tenantOffersLoadedForId === selectedOrgId

  /** Last 365 calendar days: demo = seeded random; live = counts from loaded offers (created + pipeline finished per day). */
  const orgDailyRunsYear = useMemo(() => {
    const days = 365
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (usingLiveProjects) {
      if (!tenantOffersMatchSelection) {
        return Array.from({ length: days }).map((_, idx) => {
          const date = new Date(today)
          date.setDate(today.getDate() - (days - 1 - idx))
          return { date, runs: 0 }
        })
      }
      const counts = new Map<string, number>()
      for (const o of tenantOffers) {
        bumpDayCount(counts, o.created_at)
        if (o.pipeline_finished_at) bumpDayCount(counts, o.pipeline_finished_at)
      }
      return Array.from({ length: days }).map((_, idx) => {
        const date = new Date(today)
        date.setDate(today.getDate() - (days - 1 - idx))
        return { date, runs: counts.get(toYMD(date)) ?? 0 }
      })
    }

    const seed = selectedOrgId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    return Array.from({ length: days }).map((_, idx) => {
      const date = new Date(today)
      date.setDate(today.getDate() - (days - 1 - idx))
      const runs = (seed + idx * 13 + (idx % 7) * 5) % 11
      return { date, runs }
    })
  }, [selectedOrgId, usingLiveProjects, tenantOffersMatchSelection, tenantOffers])

  const orgRunsWeeks = useMemo(() => {
    const weeks: Array<Array<{ date: Date; runs: number }>> = []
    for (let i = 0; i < orgDailyRunsYear.length; i += 7) {
      weeks.push(orgDailyRunsYear.slice(i, i + 7))
    }
    return weeks
  }, [orgDailyRunsYear])

  const activityHeatmapMax = useMemo(
    () => Math.max(1, ...orgDailyRunsYear.map((d) => d.runs)),
    [orgDailyRunsYear],
  )

  const orgProjectsBase = useMemo((): AdminOrgProjectRow[] => {
    if (usingLiveProjects) {
      if (!tenantOffersMatchSelection) return []
      return tenantOffers.map(mapAdminTenantOfferToRow)
    }
    return orgDummyProjects
  }, [usingLiveProjects, tenantOffersMatchSelection, tenantOffers, orgDummyProjects])

  const projFilterOrgMembers = useMemo(() => {
    if (tenantOffersMatchSelection) {
      const m = new Map<string, { id: string; email: string | null; full_name: string }>()
      for (const o of tenantOffers) {
        if (o.owner_id) {
          m.set(o.owner_id, { id: o.owner_id, email: null, full_name: o.owner_name?.trim() || '—' })
        }
      }
      return Array.from(m.values())
    }
    return orgUsersList.map((u, idx) => ({
      id: `adm-${selectedOrgId}-u${idx}`,
      email: null as string | null,
      full_name: u.name,
    }))
  }, [tenantOffersMatchSelection, tenantOffers, orgUsersList, selectedOrgId])

  const hasActiveProjFilters =
    Boolean(projAppliedOfferTypeId) ||
    Boolean(projAppliedDateFrom) ||
    Boolean(projAppliedDateTo) ||
    projAppliedUserIds.length > 0

  const filteredOrgProjects = useMemo(() => {
    let list = orgProjectsBase
    if (projAppliedOfferTypeId) {
      const opt = ADMIN_OFFER_TYPE_OPTIONS.find((o) => o.id === projAppliedOfferTypeId)
      const slug = opt?.slug as string | undefined
      list = list.filter((p) => offerSlugMatchesAdminFilter(p.offerSlug, slug))
    }
    if (projAppliedDateFrom) {
      const from = new Date(projAppliedDateFrom)
      from.setHours(0, 0, 0, 0)
      list = list.filter((p) => p.createdAt >= from)
    }
    if (projAppliedDateTo) {
      const to = new Date(projAppliedDateTo)
      to.setHours(23, 59, 59, 999)
      list = list.filter((p) => p.createdAt <= to)
    }
    if (projAppliedUserIds.length > 0) {
      list = list.filter((p) => projAppliedUserIds.includes(p.ownerMemberId))
    }
    const q = projSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.ref.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q) ||
          (p.owner && p.owner.toLowerCase().includes(q)),
      )
    }
    return list
  }, [
    orgProjectsBase,
    projAppliedOfferTypeId,
    projAppliedDateFrom,
    projAppliedDateTo,
    projAppliedUserIds,
    projSearch,
  ])

  const showTenantProjectsLoading =
    usingLiveProjects &&
    tenantOffersStatus !== 'error' &&
    (tenantOffersStatus === 'loading' ||
      tenantOffersStatus === 'idle' ||
      (tenantOffersStatus === 'ok' && tenantOffersLoadedForId !== selectedOrgId))
  const showTenantProjectsError = usingLiveProjects && tenantOffersStatus === 'error'

  const selectedOrgProject = useMemo(() => {
    if (!selectedProjectRef) return null
    return orgProjectsBase.find((p) => p.id === selectedProjectRef) ?? null
  }, [selectedProjectRef, orgProjectsBase])

  const projectUploadedFiles = useMemo(() => {
    if (!selectedOrgProject) return []
    const d = selectedOrgProject.dateLabel
    return [
      { id: 'u1', name: 'Grundriss_EG.pdf', meta: '2.4 MB', at: d },
      { id: 'u2', name: 'Ansicht_Sued.png', meta: '890 KB', at: d },
      { id: 'u3', name: 'Stellplaene.zip', meta: '12 MB', at: d },
    ]
  }, [selectedOrgProject])

  const projectPipelineSteps = useMemo(() => {
    if (!selectedOrgProject) return []
    const u = selectedOrgProject.owner ?? '—'
    const d = selectedOrgProject.dateLabel
    return [
      { step: 'Form steps', at: `${d} · 09:12`, duration: '38s', user: u },
      { step: 'Extracted measurements', at: `${d} · 09:13`, duration: '1m 02s', user: u },
      { step: 'Attributed prices', at: `${d} · 09:15`, duration: '2m 18s', user: u },
      { step: 'Extracted pricing', at: `${d} · 09:17`, duration: '55s', user: u },
    ]
  }, [selectedOrgProject])

  const toggleProjUserFilter = (id: string) => {
    setProjDraftUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const applyProjFilters = () => {
    setProjAppliedOfferTypeId(projDraftOfferTypeId)
    setProjAppliedDateFrom(projDraftDateFrom)
    setProjAppliedDateTo(projDraftDateTo)
    setProjAppliedUserIds(projDraftUserIds)
    setProjFilterOpen(false)
  }

  const resetProjDraftFilters = () => {
    setProjDraftOfferTypeId('')
    setProjDraftDateFrom('')
    setProjDraftDateTo('')
    setProjDraftUserIds([])
    setProjFilterOpen(false)
  }

  useLayoutEffect(() => {
    if (!projFilterOpen) return
    const place = () => {
      const btn = projFilterButtonRef.current
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const w = 280
      const gap = 8
      const margin = 8
      let left = rect.right - w
      left = Math.max(margin, Math.min(left, window.innerWidth - w - margin))
      const estH = 480
      // Open above the trigger by default (bottom of panel sits just above the button)
      let top = rect.top - estH - gap
      if (top < margin) {
        top = rect.bottom + gap
      }
      if (top + estH > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - estH - margin)
      }
      setProjFilterPanelPos({ top, left })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [projFilterOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as Node
      const el = e.target as HTMLElement
      if (el.closest?.('[data-offer-history-offer-type-menu]')) return
      if (el.closest?.('[data-holzbot-date-picker-portal]')) return
      if (projFilterWrapRef.current?.contains(t)) return
      if (projFilterPanelRef.current?.contains(t)) return
      setProjFilterOpen(false)
    }
    if (projFilterOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [projFilterOpen])

  useEffect(() => {
    if (!orgFilters.length) setOrgFilters([selectedOrgId])
  }, [orgFilters.length, selectedOrgId])

  useEffect(() => {
    const today = new Date()
    const to = toYMD(today)
    const fromDate = new Date(today)
    fromDate.setMonth(fromDate.getMonth() - 1)
    const from = toYMD(fromDate)
    setDateFrom(from)
    setDateTo(to)
  }, [])

  const applyRangePreset = (preset: RangeOption) => {
    setSelectedRange(preset)
    if (preset === 'custom') return
    const today = new Date()
    const fromDate = new Date(today)
    if (preset === '1w') fromDate.setDate(today.getDate() - 7)
    if (preset === '2w') fromDate.setDate(today.getDate() - 14)
    if (preset === '1m') fromDate.setMonth(today.getMonth() - 1)
    if (preset === '3m') fromDate.setMonth(today.getMonth() - 3)
    if (preset === '6m') fromDate.setMonth(today.getMonth() - 6)
    if (preset === '1y') fromDate.setFullYear(today.getFullYear() - 1)
    setDateFrom(toYMD(fromDate))
    setDateTo(toYMD(today))
  }

  useEffect(() => {
    const el = statsScrollRef.current
    if (!el) return
    const updateThumb = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      const hasOverflow = scrollHeight > clientHeight + 1
      setStatsScrollVisible(hasOverflow)
      if (!hasOverflow) {
        setStatsThumb({ height: 0, top: 0 })
        return
      }
      const ratio = clientHeight / scrollHeight
      const height = Math.max(30, Math.round(clientHeight * ratio))
      const maxTop = Math.max(0, clientHeight - height)
      const top = Math.round((scrollTop / (scrollHeight - clientHeight)) * maxTop)
      setStatsThumb({ height, top })
    }
    updateThumb()
    const rafId = requestAnimationFrame(updateThumb)
    const timeoutId = window.setTimeout(updateThumb, 120)
    el.addEventListener('scroll', updateThumb)
    window.addEventListener('resize', updateThumb)
    return () => {
      cancelAnimationFrame(rafId)
      window.clearTimeout(timeoutId)
      el.removeEventListener('scroll', updateThumb)
      window.removeEventListener('resize', updateThumb)
    }
  }, [ready, activeView, selectedProjectRef])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = statsScrollRef.current
      if (!el || !dragStateRef.current.dragging) return
      const delta = e.clientY - dragStateRef.current.startY
      const nextTop = dragStateRef.current.startTop + delta
      const maxTop = Math.max(0, el.clientHeight - statsThumb.height)
      const clampedTop = Math.max(0, Math.min(maxTop, nextTop))
      const ratio = maxTop > 0 ? clampedTop / maxTop : 0
      el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
    }
    const onUp = () => {
      dragStateRef.current.dragging = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [statsThumb.height])

  useEffect(() => {
    const el = pipelineScrollRef.current
    if (!el) return
    const updateThumb = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      const hasOverflow = scrollHeight > clientHeight + 1
      setPipelineScrollVisible(hasOverflow)
      if (!hasOverflow) {
        setPipelineThumb({ height: 0, top: 0 })
        return
      }
      const ratio = clientHeight / scrollHeight
      const height = Math.max(24, Math.round(clientHeight * ratio))
      const maxTop = Math.max(0, clientHeight - height)
      const top = Math.round((scrollTop / (scrollHeight - clientHeight)) * maxTop)
      setPipelineThumb({ height, top })
    }
    updateThumb()
    const rafId = requestAnimationFrame(updateThumb)
    const timeoutId = window.setTimeout(updateThumb, 120)
    el.addEventListener('scroll', updateThumb)
    window.addEventListener('resize', updateThumb)
    return () => {
      cancelAnimationFrame(rafId)
      window.clearTimeout(timeoutId)
      el.removeEventListener('scroll', updateThumb)
      window.removeEventListener('resize', updateThumb)
    }
  }, [ready, activeView])

  useEffect(() => {
    const el = statsScrollRef.current
    if (!el) return
    const rafId = requestAnimationFrame(() => el.dispatchEvent(new Event('scroll')))
    return () => cancelAnimationFrame(rafId)
  }, [
    selectedRange,
    dateFrom,
    dateTo,
    orgFilters.join(','),
    customUsersOpen,
    scheduleOpen,
    activeView,
    selectedOrgId,
    selectedProjectRef,
  ])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = pipelineScrollRef.current
      if (!el || !pipelineDragRef.current.dragging) return
      const delta = e.clientY - pipelineDragRef.current.startY
      const nextTop = pipelineDragRef.current.startTop + delta
      const maxTop = Math.max(0, el.clientHeight - pipelineThumb.height)
      const clampedTop = Math.max(0, Math.min(maxTop, nextTop))
      const ratio = maxTop > 0 ? clampedTop / maxTop : 0
      el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
    }
    const onUp = () => {
      pipelineDragRef.current.dragging = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [pipelineThumb.height])

  const handleStatsTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = statsScrollRef.current
    if (!el) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const maxTop = Math.max(0, el.clientHeight - statsThumb.height)
    const targetTop = Math.max(0, Math.min(maxTop, clickY - statsThumb.height / 2))
    const ratio = maxTop > 0 ? targetTop / maxTop : 0
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
  }

  const handleStatsThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragStateRef.current.dragging = true
    dragStateRef.current.startY = e.clientY
    dragStateRef.current.startTop = statsThumb.top
  }

  const handlePipelineTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = pipelineScrollRef.current
    if (!el) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const maxTop = Math.max(0, el.clientHeight - pipelineThumb.height)
    const targetTop = Math.max(0, Math.min(maxTop, clickY - pipelineThumb.height / 2))
    const ratio = maxTop > 0 ? targetTop / maxTop : 0
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
  }

  const handlePipelineThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    pipelineDragRef.current.dragging = true
    pipelineDragRef.current.startY = e.clientY
    pipelineDragRef.current.startTop = pipelineThumb.top
  }

  if (!ready) return null

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
.admin-scroll {
  overflow-y: scroll !important;
  overflow-x: auto !important;
  scrollbar-width: thin !important;
  scrollbar-color: #c9944a transparent !important;
}
.admin-scroll::-webkit-scrollbar {
  width: 10px !important;
  height: 10px !important;
  -webkit-appearance: none !important;
  appearance: none !important;
}
.admin-scroll::-webkit-scrollbar-track {
  background: transparent !important;
}
.admin-scroll::-webkit-scrollbar-thumb {
  background: #c9944a !important;
  border-radius: 9999px !important;
  border: 2px solid transparent !important;
  background-clip: padding-box !important;
  min-height: 40px !important;
}
.admin-scroll::-webkit-scrollbar-thumb:hover {
  background: #d8a25e !important;
}
.admin-scroll::-webkit-scrollbar-corner {
  background: transparent !important;
}
.admin-scroll-hide {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
.admin-scroll-hide::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  display: none !important;
}
.admin-heatmap-legend-swatch {
  height: clamp(0.4rem, 0.75vw, 0.55rem);
  width: clamp(1rem, 2.5vw, 1.5rem);
  border-radius: 9999px;
}
.admin-heatmap-cell {
  cursor: default;
}
`,
        }}
      />
      <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[400px_1fr_440px]">
        <aside className="flex min-h-0 min-w-0 flex-col rounded-xl2 border border-black/40 bg-panel/80 p-3 shadow-soft">
          <div className="mb-3 shrink-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sand font-semibold">
              <List size={18} className="shrink-0 text-[#FFB84D]" aria-hidden />
              Client List
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedProjectRef(null)
                setActiveView('statistics')
              }}
              disabled={activeView === 'statistics'}
              title={activeView === 'statistics' ? 'Already on statistics' : 'Return to statistics overview'}
              className={[
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9F0F]/40',
                activeView === 'statistics'
                  ? 'cursor-default border-white/10 bg-black/20 text-sand/40'
                  : 'border-white/12 bg-black/30 text-sand/90 hover:border-white/20 hover:bg-black/45 hover:text-sand',
              ].join(' ')}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  activeView === 'statistics' ? 'bg-black/30 text-sand/35' : 'bg-white/6 text-[#FFB84D]'
                }`}
              >
                <BarChart3 size={15} strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-sand/50">
                  Overview
                </span>
                <span className="block text-sand/95">Statistics</span>
              </span>
              {activeView === 'organization' ? (
                <ChevronLeft size={16} className="shrink-0 text-sand/45" aria-hidden />
              ) : null}
            </button>
          </div>
          <div className="hide-scroll flex min-h-0 flex-1 flex-col space-y-2 overflow-y-auto pr-1">
            {adminTenantsStatus === 'loading' ? (
              <p className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-sand/55">Loading organizations…</p>
            ) : null}
            {adminTenantsStatus === 'error' && adminTenantsError ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-2 text-xs text-red-200/90">{adminTenantsError}</p>
            ) : null}
            {!hasLiveOrgList && adminTenantsStatus === 'ok' ? (
              <p className="rounded-lg border border-[#FF9F0F]/25 bg-black/20 px-2 py-2 text-[11px] leading-snug text-sand/60">
                No organizations in the database. Demo names are shown until data exists.
              </p>
            ) : null}
            {clientOrgs.map((org) => {
              const active = org.id === selectedOrgId
              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => {
                    setSelectedOrgId(org.id)
                    setSelectedProjectRef(null)
                    setActiveView('organization')
                  }}
                  className={`list-btn ${active ? 'list-btn--active' : ''}`}
                >
                  <div className="text-sm font-bold tracking-wide text-sand truncate">{org.name}</div>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 gap-4 overflow-hidden rounded-xl2 border border-black/40 bg-panel/80 p-3 shadow-soft">
          <div
            ref={statsScrollRef}
            className={`admin-scroll-hide flex min-h-0 flex-1 flex-col overflow-y-scroll pr-1 ${activeView === 'organization' && !selectedOrgProject ? 'min-h-0 gap-0' : 'gap-4'}`}
          >
            {activeView === 'statistics' ? (
              <>
                {hasLiveOrgList && statsStatus === 'error' && statsError ? (
                  <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200/95">{statsError}</div>
                ) : null}
                <div className="rounded-xl border border-white/10 bg-coffee-700/60 p-3 backdrop-blur-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={18} className="text-[#FFB84D]" />
                      <h2 className="text-xl font-semibold text-sand md:text-2xl">Statistics Control Center</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm text-sand/70">Last refresh: {statisticsKpi.refreshLabel}</div>
                      <div className="inline-flex items-center gap-2 rounded-xl border border-[#FF9F0F]/40 bg-[#FF9F0F]/10 px-2.5 py-1.5">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-[#FF9F0F]/45 bg-[#FF9F0F]/20 text-[#FFD29A] text-[11px] font-bold">€</span>
                        <div className="leading-tight">
                          <div className="text-[10px] uppercase tracking-wide text-sand/70">Avg. cost/run</div>
                          <div className="text-sm font-bold text-white">{(AVG_COST_PER_RUN_CENTS / 100).toFixed(2)}€</div>
                          <div className="text-[9px] text-sand/45">Model estimate</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="rounded-xl border border-[#FF9F0F]/25 bg-black/20 p-2.5">
                      <div className="mb-1 text-sm font-semibold text-sand">Date range</div>
                      <div className="hide-scroll mb-1 flex flex-nowrap gap-1 overflow-x-auto whitespace-nowrap">
                        {RANGE_OPTIONS.filter((range) => range !== 'custom').map((range) => (
                          <button
                            key={range}
                            type="button"
                            onClick={() => applyRangePreset(range)}
                            className={[
                              'rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
                              selectedRange === range ? 'bg-[#FF9F0F] text-white' : 'bg-transparent text-sand/80 hover:bg-white/8',
                            ].join(' ')}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <DatePickerPopover value={dateFrom} onChange={(v) => { setDateFrom(v); setSelectedRange('custom') }} placeholder="From" label="From" size="compact" />
                        <DatePickerPopover value={dateTo} onChange={(v) => { setDateTo(v); setSelectedRange('custom') }} placeholder="To" label="To" size="compact" />
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#FF9F0F]/25 bg-black/20 p-2.5">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-sand">Organization filter</div>
                        <div className="text-[11px] text-sand/65">{orgFilters.length} selected</div>
                      </div>
                      <div className="mb-1.5 inline-flex rounded-lg border border-white/10 bg-black/25 p-1">
                        <button
                          type="button"
                          onClick={() => setOrgFilters(clientOrgs.map((org) => org.id))}
                          className={[
                            'rounded-md px-2.5 py-1 text-xs font-medium transition',
                            orgFilters.length === clientOrgs.length ? 'bg-[#FF9F0F] text-white' : 'text-sand/80 hover:bg-white/8',
                          ].join(' ')}
                        >
                          All organizations
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrgFilters([selectedOrgId])}
                          className={[
                            'rounded-md px-2.5 py-1 text-xs font-medium transition',
                            orgFilters.length === 1 && orgFilters[0] === selectedOrgId ? 'bg-[#FF9F0F] text-white' : 'text-sand/80 hover:bg-white/8',
                          ].join(' ')}
                        >
                          Selected client
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {clientOrgs.map((org) => (
                          <button
                            key={`filter-${org.id}`}
                            type="button"
                            onClick={() => setOrgFilters((prev) => (prev.includes(org.id) ? prev.filter((id) => id !== org.id) : [...prev, org.id]))}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                              orgFilters.includes(org.id)
                                ? 'border-[#FF9F0F]/70 bg-[#FF9F0F]/18 text-[#FFD29A]'
                                : 'border-white/12 bg-black/20 text-sand/75 hover:border-[#FF9F0F]/35'
                            }`}
                          >
                            <Building2 size={10} />
                            {org.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    title="Total offers generated"
                    value={statisticsKpi.offers.value}
                    delta={statisticsKpi.offers.delta}
                    icon={<TrendingUp size={14} />}
                    series={statisticsKpi.sparkOffers}
                    sparkCaption={statisticsKpi.sparkCaption}
                    valueFormat="count"
                  />
                  <KpiCard
                    title="Avg. pipeline time"
                    value={statisticsKpi.proc.value}
                    delta={statisticsKpi.proc.delta}
                    icon={<Gauge size={14} />}
                    series={statisticsKpi.sparkProc}
                    sparkCaption={statisticsKpi.procCaption}
                    valueFormat="duration"
                  />
                  <KpiCard
                    title="Members added / churn"
                    value={statisticsKpi.clients.value}
                    delta={statisticsKpi.clients.delta}
                    icon={<Building2 size={14} />}
                    series={statisticsKpi.sparkClients}
                    sparkCaption={statisticsKpi.clientsCaption}
                    valueFormat="count"
                  />
                  <KpiCard
                    title="System incidents"
                    value={statisticsKpi.incidents.value}
                    delta={statisticsKpi.incidents.delta}
                    icon={<Activity size={14} />}
                    series={statisticsKpi.sparkIncidents}
                    sparkCaption={statisticsKpi.sparkCaption}
                    valueFormat="count"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 xl:min-h-[360px] xl:grid-cols-[1.6fr_1fr]">
                  <div className="rounded-xl border border-white/10 bg-coffee-700/70 p-3 backdrop-blur-sm xl:h-full">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-base font-semibold text-sand">Offer throughput trend</div>
                      <div className="text-sm text-sand/70">
                        {selectedRange} · {selectedOrgNames.length} orgs
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3 xl:h-[calc(100%-2rem)]">
                      <div className="mb-2 flex items-center justify-between text-xs text-sand/70">
                        <span>Total offers: {statisticsKpi.throughputSub.offers}</span>
                        <span>Mean pipeline time: {statisticsKpi.throughputSub.avg}</span>
                      </div>
                      <OffersThroughputChart points={throughputChartPoints} />
                    </div>
                  </div>

                  <div className="flex gap-2 overflow-hidden rounded-xl border border-white/10 bg-coffee-700/70 p-3 backdrop-blur-sm xl:h-full">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="text-base font-semibold text-sand">Pipeline stages</div>
                        <Layers3 size={14} className="text-sand/70" />
                      </div>
                      <div ref={pipelineScrollRef} className="admin-scroll-hide max-h-[300px] space-y-2 overflow-y-scroll pr-1 xl:max-h-[calc(100%-2rem)]">
                        {PIPELINE_STAGES.map((stage) => (
                          <PipelineRow
                            key={stage.label}
                            label={stage.label}
                            value={stage.value}
                            processed={stage.processed}
                            failed={stage.failed}
                            avg={stage.avg}
                            trend={stage.trend}
                          />
                        ))}
                      </div>
                    </div>
                    <div
                      className={`relative h-full w-[8px] shrink-0 select-none transition-opacity ${pipelineScrollVisible ? 'cursor-pointer opacity-100' : 'pointer-events-none opacity-0'}`}
                      onClick={handlePipelineTrackClick}
                      role="scrollbar"
                      aria-label="Pipeline scroll"
                    >
                      <div
                        className="absolute left-0 min-h-[18px] w-full cursor-grab rounded-full bg-[#c9944a] hover:bg-[#d8a25e] active:cursor-grabbing"
                        style={{ height: pipelineThumb.height, top: pipelineThumb.top }}
                        onMouseDown={handlePipelineThumbMouseDown}
                        role="slider"
                        aria-valuenow={pipelineScrollRef.current?.scrollTop ?? 0}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-coffee-700/60 p-3 backdrop-blur-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-lg font-semibold text-sand">Data moat</div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="rounded-md border border-[#FF9F0F]/45 bg-[#FF9F0F]/55 px-3 py-1 text-sm font-semibold text-white transition hover:bg-[#FF9F0F]/70">
                        Export CSV
                      </button>
                      <button type="button" className="rounded-md border border-white/15 bg-black/20 px-3 py-1 text-sm font-medium text-sand/85 transition hover:border-[#FF9F0F]/35">
                        Export PDF
                      </button>
                      <button type="button" className="rounded-md border border-white/15 bg-black/20 px-3 py-1 text-sm font-medium text-sand/85 transition hover:border-[#FF9F0F]/35">
                        Export JSON
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
                    {DATA_MOAT_ITEMS.map((item) => (
                      <MoatAction key={item.title} title={item.title} markedPlans={item.markedPlans} />
                    ))}
                  </div>
                </div>
              </>
            ) : selectedOrgProject ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black/40 bg-panel/80 shadow-soft">
                <div className="shrink-0 border-b border-black/40 bg-black/20 px-4 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="mt-0.5 h-12 w-1 shrink-0 rounded-full bg-linear-to-b from-[#FF9F0F] via-[#FFB84D] to-[#c9944a]" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sand/45">Project</p>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[9px] font-semibold tracking-wide ${selectedOrgProject.historyStatusBadgeClass}`}
                          >
                            {selectedOrgProject.historyStatusLabel}
                          </span>
                          <span className="rounded-md border border-[#FF9F0F]/35 bg-[#FF9F0F]/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-[#FFD29A] sm:text-sm">
                            {selectedOrgProject.offerKindLabel}
                          </span>
                        </div>
                        <h2 className="mt-1.5 truncate text-lg font-semibold text-sand sm:text-xl">
                          {selectedOrg.name}{' '}
                          <span className="font-mono text-[#FFD29A]/95">/ {selectedOrgProject.ref}</span>
                        </h2>
                        <p className="mt-1 line-clamp-2 text-xs text-sand/60">{selectedOrgProject.title}</p>
                        {selectedOrgProject.isLiveRow ? (
                          <p className="mt-2 text-[11px] leading-relaxed text-sand/55">
                            <span className="text-sand/45">Started:</span> {formatEnDateTime(selectedOrgProject.createdAtIso)}
                            <span className="mx-1.5 text-sand/30">·</span>
                            <span className="text-sand/45">Finished:</span>{' '}
                            {selectedOrgProject.pipelineFinishedAtIso
                              ? formatEnDateTime(selectedOrgProject.pipelineFinishedAtIso)
                              : '—'}
                            <span className="mx-1.5 text-sand/30">·</span>
                            <span className="text-sand/45">Duration:</span>{' '}
                            <span title={selectedOrgProject.durationTooltip}>{selectedOrgProject.duration}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex w-full min-w-0 shrink-0 flex-row flex-wrap items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setSelectedProjectRef(null)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-xs font-semibold text-sand/90 transition hover:border-white/20 hover:bg-black/45 hover:text-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9F0F]/40"
                      >
                        <ChevronLeft size={16} className="shrink-0 text-[#FFB84D]" aria-hidden />
                        Back to projects
                      </button>
                      <div
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#FF9F0F]/40 bg-[#FF9F0F]/10 px-2.5 py-1.5"
                        role="status"
                        aria-label={`Cost per run ${(AVG_COST_PER_RUN_CENTS / 100).toFixed(2)} euros`}
                      >
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-[#FF9F0F]/45 bg-[#FF9F0F]/20 text-[11px] font-bold text-[#FFD29A]">
                          €
                        </span>
                        <div className="leading-tight">
                          <div className="text-[10px] uppercase tracking-wide text-sand/70">Cost per run</div>
                          <div className="text-sm font-bold text-white">{(AVG_COST_PER_RUN_CENTS / 100).toFixed(2)}€</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hide-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
                  <section className="rounded-xl border border-[#FF9F0F]/25 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
                    <div className="mb-3 text-[11px] text-sand/50">
                      Run overview · {selectedOrgProject.isLiveRow ? 'live data' : 'demo data'}
                    </div>
                    <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,200px)_minmax(220px,1fr)_minmax(96px,20%)] lg:items-stretch">
                      {/* Left: uploaded files list */}
                      <div className="flex min-h-[200px] min-w-0 flex-col rounded-lg border border-white/10 bg-black/30 p-2.5">
                        <div className="mb-2 flex items-center gap-2 border-b border-white/10 pb-2 text-xs font-semibold uppercase tracking-wide text-sand/70">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[#FF9F0F]/35 bg-[#FF9F0F]/12 text-[#FFB84D]">
                            <Upload size={13} strokeWidth={2} aria-hidden />
                          </span>
                          Uploaded files
                        </div>
                        <ul className="hide-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
                          {projectUploadedFiles.map((f) => (
                            <li key={f.id}>
                              <button
                                type="button"
                                className="w-full rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-left text-[11px] transition hover:border-[#FF9F0F]/35 hover:bg-black/35"
                              >
                                <div className="truncate font-medium text-sand">{f.name}</div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0 text-[10px] text-sand/50">
                                  <span>{f.meta}</span>
                                  <span className="font-mono text-sand/45">{f.at}</span>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Center: pipeline functions */}
                      <div className="flex min-h-[200px] min-w-0 flex-col rounded-lg border border-white/10 bg-black/25 p-2.5">
                        <div className="mb-2 flex items-center gap-2 border-b border-white/10 pb-2 text-xs font-semibold uppercase tracking-wide text-sand/70">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[#FF9F0F]/35 bg-[#FF9F0F]/12 text-[#FFB84D]">
                            <Layers3 size={13} strokeWidth={2} aria-hidden />
                          </span>
                          Pipeline
                        </div>
                        <div className="hide-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
                          <ul className="space-y-1.5 sm:hidden">
                            {projectPipelineSteps.map((row) => (
                              <li key={row.step}>
                                <button
                                  type="button"
                                  className="w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-left text-[11px] transition hover:border-[#FF9F0F]/30 hover:bg-black/30"
                                >
                                  <div className="font-medium text-sand">{row.step}</div>
                                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-sand/55">
                                    <span className="font-mono">{row.at}</span>
                                    <span>{row.duration}</span>
                                    <span>{row.user}</span>
                                  </div>
                                </button>
                              </li>
                            ))}
                          </ul>
                          <div className="hidden min-w-0 sm:block">
                            <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-2 border-b border-white/10 pb-2 text-[10px] font-semibold uppercase tracking-wide text-sand/45">
                              <span>Function</span>
                              <span className="text-right tabular-nums">Date / time</span>
                              <span className="text-right">Duration</span>
                              <span className="text-right">User</span>
                            </div>
                            <ul className="space-y-1.5">
                              {projectPipelineSteps.map((row) => (
                                <li key={row.step}>
                                  <button
                                    type="button"
                                    className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-left text-[11px] transition hover:border-[#FF9F0F]/30 hover:bg-black/30"
                                  >
                                    <span className="min-w-0 truncate font-medium text-sand">{row.step}</span>
                                    <span className="shrink-0 font-mono text-sand/65">{row.at}</span>
                                    <span className="shrink-0 tabular-nums text-sand/60">{row.duration}</span>
                                    <span className="max-w-[5.5rem] shrink-0 truncate text-right text-sand/75">{row.user}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Right: Editor */}
                      <div className="flex min-h-0 flex-col rounded-lg border border-dashed border-[#FF9F0F]/30 bg-black/20 p-2.5">
                        <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide text-sand/70">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[#FF9F0F]/35 bg-[#FF9F0F]/12 text-[#FFB84D]">
                            <SquarePen size={13} strokeWidth={2} aria-hidden />
                          </span>
                          Editor
                        </div>
                        <div className="relative w-full overflow-hidden rounded-xl border border-[#FF9F0F]/30 bg-black/45 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
                          {/* eslint-disable-next-line @next/next/no-img-element -- static public asset */}
                          <img
                            src="/images/admin-floor-plan-preview.png"
                            alt="Erdgeschoss — floor plan preview"
                            className="h-auto max-h-[min(280px,55vh)] w-full object-contain object-center p-1 lg:max-h-40 lg:p-0.5"
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-dashed border-[#FF9F0F]/28 bg-black/15 p-3">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-sand">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#FF9F0F]/30 bg-[#FF9F0F]/10 text-[#FFB84D]">
                        <Images size={15} strokeWidth={2} aria-hidden />
                      </span>
                      Generated images
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {[
                        '/images/blueprint.png',
                        '/images/roof-blueprint.png',
                        '/images/second-bg.png',
                        '/images/blueprint.png',
                      ].map((src, i) => (
                        <div
                          key={`${src}-${i}`}
                          className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg border border-[#FF9F0F]/25 bg-black/30 shadow-sm transition hover:border-[#FF9F0F]/45"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- static public assets */}
                          <img src={src} alt="" className="h-full w-full object-cover opacity-90" />
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="flex min-h-[100px] items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/10 px-4 py-8 text-center text-xs text-sand/45">
                    Additional exports and logs · placeholder
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black/40 bg-panel/80 shadow-soft">
                <div className="shrink-0 border-b border-black/40 bg-black/20 px-4 py-3.5">
                  {/* Logo is absolutely positioned so its intrinsic size never increases row height; it only scales within the text column's height. */}
                  <div className="relative">
                    <div className="flex gap-3 pr-[clamp(5.5rem,28vw,13.5rem)] sm:pr-52">
                      <div
                        className="mt-0.5 h-12 w-1 shrink-0 self-start rounded-full bg-linear-to-b from-[#FF9F0F] via-[#FFB84D] to-[#c9944a]"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sand/45">Client workspace</p>
                          <span className="rounded-md border border-[#FF9F0F]/35 bg-[#FF9F0F]/15 px-2 py-0.5 text-[10px] font-semibold text-[#FFD29A]">
                            {selectedOrgMeta.plan}
                          </span>
                          <span className="rounded-md border border-white/12 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-sand/70">
                            {orgDailyRunsYear.reduce((acc, item) => acc + item.runs, 0)}{' '}
                            {usingLiveProjects && tenantOffersMatchSelection ? 'events / yr' : 'runs / yr'}
                          </span>
                        </div>
                        <h2 className="mt-1.5 truncate text-lg font-semibold text-sand sm:text-xl">{selectedOrg.name}</h2>
                        <p className="mt-1 text-xs text-sand/60">
                          {usingLiveProjects && tenantOffersMatchSelection
                            ? 'Live heatmap: offer created + pipeline finished per day (from loaded offers, up to 100).'
                            : usingLiveProjects
                              ? 'Activity heatmap loads with your projects…'
                              : 'Offer pipeline overview · demo activity (365 days).'}
                        </p>
                      </div>
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex w-[clamp(5.5rem,28vw,13.5rem)] items-center justify-end sm:w-52">
                      {/* eslint-disable-next-line @next/next/no-img-element -- public paths or signed tenant logo URL */}
                      <img
                        src={selectedOrgTenantLogoUrl ?? selectedOrgMeta.logoSrc ?? HOLZBOT_LOGO_PLACEHOLDER}
                        alt={selectedOrgMeta.companyName}
                        className="pointer-events-auto max-h-full max-w-full object-contain object-right"
                      />
                    </div>
                  </div>
                </div>

                <div className="shrink-0 border-b border-black/35 px-4 py-3">
                  <div className="rounded-xl border border-[#FF9F0F]/25 bg-coffee-800/50 p-3">
                    <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 rounded-md border border-[#FF9F0F]/30 bg-[#FF9F0F]/10 p-1.5 text-[#FFB84D]">
                          <Activity size={14} strokeWidth={2} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-sand">Activity</div>
                          <div className="text-[11px] text-sand/55">
                            {usingLiveProjects && tenantOffersMatchSelection
                              ? 'Daily event count · darker = busier (scaled to this org’s max in view)'
                              : 'Runs per day · last 365 days (7 rows × weeks · demo)'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-md border border-black/40 bg-black/25 px-2 py-1">
                        <span className="text-[10px] text-sand/50">Less</span>
                        <div className="flex gap-[clamp(0.2rem,0.5vw,0.35rem)]">
                          {ACTIVITY_HEATMAP_STEPS.map((hex, i) => (
                            <div
                              key={i}
                              className="admin-heatmap-legend-swatch shrink-0 border border-black/55"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-sand/50">More</span>
                      </div>
                    </div>
                    <div className="w-full overflow-visible rounded-lg border border-dashed border-[#FF9F0F]/20 bg-black/35 p-[clamp(0.35rem,1vw,0.65rem)]">
                      <div
                        className="grid h-[clamp(6.25rem,20vh,11rem)] w-full min-h-0 min-w-0 overflow-visible"
                        style={{
                          gridTemplateColumns: `repeat(${orgRunsWeeks.length}, minmax(0, 1fr))`,
                          gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
                          gap: 'clamp(3px, 0.55vw, 6px)',
                        }}
                      >
                        {orgRunsWeeks.flatMap((week, weekIdx) => {
                          const padded: Array<{ date: Date; runs: number } | null> = [...week]
                          while (padded.length < 7) padded.push(null)
                          return padded.slice(0, 7).map((item, dayIdx) => {
                            const gridColumn = weekIdx + 1
                            const gridRow = dayIdx + 1
                            if (!item) {
                              return (
                                <div
                                  key={`${selectedOrgId}-w${weekIdx}-d${dayIdx}-empty`}
                                  className="min-h-0 min-w-0 rounded-md border border-black/35"
                                  style={{ gridColumn, gridRow, backgroundColor: ACTIVITY_HEATMAP_EMPTY }}
                                  aria-hidden
                                />
                              )
                            }
                            const stepIdx = activityHeatmapStepIndex(item.runs, activityHeatmapMax)
                            const fill =
                              stepIdx >= 0 ? ACTIVITY_HEATMAP_STEPS[stepIdx] : ACTIVITY_HEATMAP_EMPTY
                            const dayLabel = item.date.toLocaleDateString('en-GB')
                            const liveTip = usingLiveProjects && tenantOffersMatchSelection
                            const hasActivity = item.runs > 0
                            return (
                              <div
                                key={`${selectedOrgId}-w${weekIdx}-d${dayIdx}`}
                                className="admin-heatmap-cell min-h-0 min-w-0 rounded-md border border-black/50 shadow-sm"
                                style={{
                                  gridColumn,
                                  gridRow,
                                  backgroundColor: fill,
                                }}
                                {...(hasActivity
                                  ? {
                                      onMouseEnter: (e: MouseEvent<HTMLDivElement>) => {
                                        if (heatmapTipHideRef.current) {
                                          clearTimeout(heatmapTipHideRef.current)
                                          heatmapTipHideRef.current = null
                                        }
                                        const r = e.currentTarget.getBoundingClientRect()
                                        setHeatmapTooltip({
                                          left: r.left + r.width / 2,
                                          top: r.top,
                                          dateStr: dayLabel,
                                          runs: item.runs,
                                          live: Boolean(liveTip),
                                          swatch: fill,
                                        })
                                      },
                                      onMouseLeave: () => {
                                        if (heatmapTipHideRef.current) clearTimeout(heatmapTipHideRef.current)
                                        heatmapTipHideRef.current = setTimeout(() => {
                                          setHeatmapTooltip(null)
                                          heatmapTipHideRef.current = null
                                        }, 100)
                                      },
                                    }
                                  : {})}
                              />
                            )
                          })
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
                  {/* Same toolbar pattern as HistoryList: title + Search / Filter icon buttons */}
                  <div className="mb-2.5 flex shrink-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-sand">Projects</h2>
                      <p className="mt-0.5 text-[11px] text-sand/55">Recent offer runs for this organization</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setProjSearchOpen((o) => !o)
                          if (!projSearchOpen) setProjFilterOpen(false)
                        }}
                        className={`rounded-lg p-1.5 transition-colors ${projSearchOpen ? 'bg-[#FF9F0F]/20 text-[#FF9F0F]' : 'text-sand/70 hover:bg-white/10 hover:text-sand'}`}
                        title="Search"
                        aria-label="Search"
                      >
                        <Search size={18} />
                      </button>
                      <div className="relative" ref={projFilterWrapRef}>
                        <button
                          ref={projFilterButtonRef}
                          type="button"
                          onClick={() => {
                            setProjFilterOpen((o) => {
                              const next = !o
                              if (next) {
                                setProjDraftOfferTypeId(projAppliedOfferTypeId)
                                setProjDraftDateFrom(projAppliedDateFrom)
                                setProjDraftDateTo(projAppliedDateTo)
                                setProjDraftUserIds(projAppliedUserIds)
                                setProjSearchOpen(false)
                              }
                              return next
                            })
                          }}
                          className={`relative rounded-lg p-1.5 transition-colors ${projFilterOpen ? 'bg-[#FF9F0F]/20 text-[#FF9F0F]' : 'text-sand/70 hover:bg-white/10 hover:text-sand'} ${hasActiveProjFilters ? 'text-[#FF9F0F]' : ''}`}
                          title="Filter"
                          aria-label="Filter"
                        >
                          <Filter size={18} />
                          {hasActiveProjFilters ? (
                            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#FF9F0F]" aria-hidden />
                          ) : null}
                        </button>
                      </div>
                    </div>
                  </div>
                  <AnimatePresence>
                    {projSearchOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="shrink-0 overflow-hidden"
                      >
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sand/50" />
                          <input
                            type="text"
                            value={projSearch}
                            onChange={(e) => setProjSearch(e.target.value)}
                            placeholder="Search…"
                            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-8 text-sm text-white placeholder-sand/50 focus:border-[#FF9F0F]/50 focus:outline-none focus:ring-1 focus:ring-[#FF9F0F]/30"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => setProjSearchOpen(false)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-sand/50 hover:text-sand"
                            aria-label="Close search"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="hide-scroll grid min-h-0 flex-1 auto-rows-min grid-cols-1 content-start gap-2.5 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                    {showTenantProjectsLoading ? (
                      <div className="col-span-full rounded-lg border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-sand/60">
                        Loading projects…
                      </div>
                    ) : showTenantProjectsError ? (
                      <div className="col-span-full rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-8 text-center text-sm text-red-200/90">
                        {tenantOffersError ?? 'Failed to load projects.'}
                      </div>
                    ) : filteredOrgProjects.length === 0 ? (
                      <div className="col-span-full rounded-lg border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-sand/60">
                        {tenantOffersMatchSelection &&
                        tenantOffers.length === 0 &&
                        !hasActiveProjFilters &&
                        !projSearch.trim()
                          ? 'No projects for this organization.'
                          : 'No projects match these filters.'}
                      </div>
                    ) : (
                      filteredOrgProjects.map((proj) => {
                        return (
                          <button
                            key={proj.id}
                            type="button"
                            onClick={() => setSelectedProjectRef(proj.id)}
                            className="relative flex min-h-[min(7.5rem,18vh)] flex-col overflow-hidden rounded-md border border-black/40 bg-coffee-750/95 pl-3 pr-3 pt-2.5 pb-2.5 text-left shadow-soft transition hover:border-caramel hover:bg-coffee-700/95"
                            style={{ borderLeftWidth: 4, borderLeftColor: '#FF9F0F' }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="truncate text-sm font-semibold leading-snug text-[#FFD29A] sm:text-[15px]">
                                {proj.offerKindLabel}
                              </span>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wide ${proj.historyStatusBadgeClass}`}
                              >
                                {proj.historyStatusLabel}
                              </span>
                            </div>
                            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-sand/55">
                              <span>{proj.dateLabel}</span>
                              {proj.owner ? (
                                <>
                                  <span className="text-sand/35">·</span>
                                  <span className="max-w-[9rem] truncate text-sand/75">{proj.owner}</span>
                                </>
                              ) : null}
                              <span className="text-sand/35">·</span>
                              <span className="truncate font-mono text-[10px] text-sand/45" title={proj.ref}>
                                {proj.ref}
                              </span>
                            </div>
                            <div className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-sand">{proj.title}</div>
                            <div className="mt-auto flex items-center gap-1.5 border-t border-white/5 pt-2 text-[11px] text-sand/65">
                              <Clock3 size={12} className="shrink-0 text-[#FFB84D]/70" />
                              <span title={proj.durationTooltip}>{proj.duration}</span>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div
            className={`w-[10px] shrink-0 h-full relative select-none transition-opacity ${statsScrollVisible ? 'cursor-pointer opacity-100' : 'pointer-events-none opacity-0'}`}
            onClick={handleStatsTrackClick}
            role="scrollbar"
            aria-label="Statistics scroll"
          >
            <div
              className="absolute left-0 w-full rounded-full bg-[#c9944a] hover:bg-[#d8a25e] min-h-[20px] cursor-grab active:cursor-grabbing"
              style={{ height: statsThumb.height, top: statsThumb.top }}
              onMouseDown={handleStatsThumbMouseDown}
              role="slider"
              aria-valuenow={statsScrollRef.current?.scrollTop ?? 0}
            />
          </div>
        </main>

        <aside className="flex min-h-0 min-w-0 flex-col rounded-xl2 border border-black/40 bg-panel/80 p-3 shadow-soft">
          {activeView === 'statistics' ? (
            <>
          <div className="mb-3 flex shrink-0 items-center gap-2 text-sand font-semibold">
            <Send size={18} className="shrink-0 text-[#FFB84D]" aria-hidden />
            Push update
          </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <button type="button" className="rounded-xl border border-white/15 bg-black/20 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-sand hover:border-[#FF9F0F]/40 transition">
                <Sparkles size={14} className="text-[#FFB84D]" />
                File upload
              </button>
              <label className="block shrink-0">
                <span className="wiz-label">Title</span>
                <input type="text" readOnly value={selectedOrg.name} className="sun-input" />
              </label>
              <label className="flex min-h-0 flex-1 flex-col">
                <span className="wiz-label">Message</span>
                <textarea key={selectedOrgId} rows={8} className="sun-textarea min-h-[120px] flex-1 resize-none" defaultValue={`Update target: ${selectedOrg.name}`} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAudienceMode('all')}
                  className={[
                    'flex-1 min-w-28 rounded-xl border py-2 text-xs sm:text-sm font-semibold transition inline-flex items-center justify-center gap-1.5',
                    audienceMode === 'all'
                      ? 'border-[#FF9F0F]/60 bg-[#FF9F0F]/18 text-[#FFD29A]'
                      : 'border-white/15 bg-black/20 text-sand hover:border-[#FF9F0F]/35',
                  ].join(' ')}
                >
                  <Users2 size={14} />
                  All users
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAudienceMode('custom')
                    setCustomUsersOpen(true)
                  }}
                  className={[
                    'flex-1 min-w-28 rounded-xl border py-2 text-xs sm:text-sm font-semibold transition inline-flex items-center justify-center gap-1.5',
                    audienceMode === 'custom'
                      ? 'border-[#FF9F0F]/60 bg-[#FF9F0F]/18 text-[#FFD29A]'
                      : 'border-white/15 bg-black/20 text-sand hover:border-[#FF9F0F]/35',
                  ].join(' ')}
                >
                  <Filter size={14} />
                  Custom
                </button>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-sand/75">
                Target: {audienceMode === 'all' ? 'All users' : `Custom rules · ${customMode}`}
              </div>
              <div className="mt-1 shrink-0 space-y-2 border-t border-white/10 pt-3">
                <button type="button" className="w-full rounded-xl border border-[#FF9F0F]/45 bg-linear-to-b from-[#e08414] to-[#f79116] py-2.5 text-white font-bold inline-flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(255,159,15,.25)] hover:brightness-110 transition">
                  <Send size={15} />
                  Instantly Push
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleOpen(true)}
                  className="w-full rounded-xl border border-white/20 bg-black/20 py-2.5 text-sand font-semibold inline-flex items-center justify-center gap-2 hover:border-[#FF9F0F]/45 hover:text-white transition"
                >
                  <Clock3 size={15} />
                  Schedule Push
                </button>
              </div>
            </div>
            </>
          ) : selectedOrgProject ? (
            <>
              <div className="mb-3 flex shrink-0 items-center gap-2 text-sand font-semibold">
                <FileText size={18} className="shrink-0 text-[#FFB84D]" aria-hidden />
                Output files
              </div>
              <div className="hide-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                <p className="text-[11px] leading-relaxed text-sand/55">
                  Downloads for <span className="font-mono text-[#FFD29A]/90">{selectedOrgProject.ref}</span>
                </p>
                {[
                  { label: `Angebot_${selectedOrgProject.ref}.pdf`, hint: 'Client offer PDF' },
                  { label: `Mengenermittlung_${selectedOrgProject.ref}.pdf`, hint: 'Quantities & takeoff' },
                ].map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    className="group w-full rounded-xl border border-[#FF9F0F]/25 bg-black/20 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-[#FF9F0F]/45 hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9F0F]/35"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-14 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-red-400/35 bg-red-500/10 text-[9px] font-black uppercase tracking-wider text-red-200/95">
                        PDF
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="truncate text-sm font-semibold text-sand group-hover:text-white">{f.label}</div>
                        <div className="mt-0.5 text-[11px] text-sand/55">{f.hint}</div>
                        <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#FFB84D]">
                          <Download size={13} aria-hidden />
                          Download
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                <div className="rounded-xl border border-dashed border-white/12 bg-black/10 px-3 py-4 text-center text-[11px] text-sand/45">
                  More formats (CSV, JSON) · coming soon
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex shrink-0 items-center gap-2 text-sand font-semibold">
                <Building2 size={18} className="shrink-0 text-[#FFB84D]" aria-hidden />
                Organization data
              </div>
              <div className="hide-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                {usingLiveProjects && tenantWorkspace.status === 'loading' && (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-sand/65">
                    Loading organization details…
                  </div>
                )}
                {usingLiveProjects && tenantWorkspace.status === 'error' && tenantWorkspace.error && (
                  <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200/95">
                    {tenantWorkspace.error}
                  </div>
                )}
                <div className="rounded-xl border border-[#FF9F0F]/25 bg-black/20 p-2.5">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sand/55">Company</div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#FF9F0F]/45 bg-[#FF9F0F]/15 text-sm font-bold text-[#FFD29A]">
                      {selectedOrgMeta.logoLabel}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-sand">{selectedOrgMeta.companyName}</div>
                      <div className="text-xs text-sand/65">
                        {liveWorkspace ? selectedOrgMeta.plan : `${selectedOrgMeta.plan} plan`}
                      </div>
                      {liveWorkspace && (
                        <>
                          <div className="mt-0.5 truncate font-mono text-[10px] text-sand/50">{liveWorkspace.tenant.slug}</div>
                          <div className="mt-0.5 text-[10px] text-sand/50">
                            {liveWorkspace.stats.offer_count} projects · {liveWorkspace.profiles.length} users
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-2.5 text-xs">
                    <div className="flex items-center gap-2 text-sand/85">
                      <Phone size={12} className="shrink-0 text-[#FFB84D]" />
                      {selectedOrgMeta.phone}
                    </div>
                    <div className="flex items-center gap-2 text-sand/85">
                      <Mail size={12} className="shrink-0 text-[#FFB84D]" />
                      {selectedOrgMeta.email}
                    </div>
                    <div className="flex items-center gap-2 text-sand/85">
                      <FolderKanban size={12} className="shrink-0 text-[#FFB84D]" />
                      {selectedOrgMeta.address}
                    </div>
                    {liveWorkspace && liveWorkspace.branding.website.trim() !== '' && (
                      <div className="flex items-center gap-2 text-sand/85">
                        <Globe size={12} className="shrink-0 text-[#FFB84D]" />
                        <span className="truncate">{liveWorkspace.branding.website}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#FF9F0F]/25 bg-black/20 p-2.5">
                  <div className="mb-2 text-sm font-semibold text-sand">Monthly project quota</div>
                  {liveWorkspace && (
                    <p className="mb-2 text-[11px] leading-snug text-sand/55">
                      {liveWorkspace.tokens.display}
                      <span className="text-sand/45"> · period {liveWorkspace.tokens.period_ym} (Europe/Berlin)</span>
                      {!liveWorkspace.tokens.unlimited && liveWorkspace.tokens.limit != null && (
                        <span className="block text-sand/45">
                          {liveWorkspace.tokens.used} used of {liveWorkspace.tokens.limit} this month
                        </span>
                      )}
                    </p>
                  )}
                  <div className="mb-3 flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#FFD29A]">
                      <Coins size={14} className="text-[#FFB84D]" />
                      {orgTokenBalanceDisplay}
                    </div>
                    <span className="text-xs text-sand/65">{liveWorkspace ? 'remaining' : 'tokens'}</span>
                  </div>
                  <button
                    type="button"
                    disabled={!!liveWorkspace}
                    title={
                      liveWorkspace
                        ? 'Quota is defined in tenant config (usage.token_tier); contact backend / Supabase to change.'
                        : undefined
                    }
                    onClick={() => setTokensModalOpen(true)}
                    className="w-full rounded-xl border border-[#FF9F0F]/45 bg-linear-to-b from-[#e08414] to-[#f79116] py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(255,159,15,.25)] transition hover:brightness-110 inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
                  >
                    <Coins size={15} />
                    Add more tokens
                  </button>
                </div>

                <div className="rounded-xl border border-[#FF9F0F]/25 bg-black/20 p-2.5">
                  <div className="mb-2 text-sm font-semibold text-sand">Users</div>
                  <p className="mb-2 text-[11px] text-sand/55">
                    {liveWorkspace
                      ? 'Live directory from the database. Editing here does not persist (use Supabase or a future admin API).'
                      : 'Click a member to edit name, email, password, and role.'}
                  </p>
                  <div className="space-y-2">
                    {orgUsersList.map((u, idx) => (
                      <button
                        key={u.sourceProfileId ?? `${selectedOrgId}-${u.name}-${idx}`}
                        type="button"
                        onClick={() => {
                          const list = orgUsersList
                          if (!liveWorkspace && !orgEditableUsers[selectedOrgId]) {
                            setOrgEditableUsers((p) => ({ ...p, [selectedOrgId]: list }))
                          }
                          setEditMemberDraft({ ...list[idx]! })
                          setEditMemberIndex(idx)
                          setEditMemberModalOpen(true)
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-left text-sm font-medium text-sand transition hover:border-[#FF9F0F]/40"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sand">{u.name}</div>
                          {u.email ? (
                            <div className="truncate font-mono text-[10px] text-sand/50">{u.email}</div>
                          ) : null}
                          {liveWorkspace && u.sourceProfileId &&
                          liveWorkspace.profiles.find((p) => p.id === u.sourceProfileId)?.tokens_unlimited ? (
                            <div className="mt-0.5 text-[9px] text-sand/40">User: unlimited projects</div>
                          ) : null}
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            u.role === 'Admin'
                              ? 'border-[#FF9F0F]/60 bg-[#FF9F0F]/15 text-[#FFD29A]'
                              : 'border-white/15 bg-black/25 text-sand/75'
                          }`}
                        >
                          <Shield size={10} />
                          {u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[#FF9F0F]/25 bg-black/20 p-2.5">
                  <div className="mb-2 text-sm font-semibold text-sand">Quick actions</div>
                  <div className="space-y-2">
                    <button
                      type="button"
                      className="w-full rounded-xl border border-[#FF9F0F]/45 bg-linear-to-b from-[#e08414] to-[#f79116] py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(255,159,15,.25)] transition hover:brightness-110 inline-flex items-center justify-center gap-2"
                    >
                      <Building2 size={15} className="text-white" />
                      Open organization profile
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-white/20 bg-black/20 py-2.5 text-sm font-semibold text-sand transition hover:border-[#FF9F0F]/45 hover:text-white inline-flex items-center justify-center gap-2"
                    >
                      <Shield size={15} />
                      Manage permissions
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
      </div>

      {typeof document !== 'undefined' &&
        heatmapTooltip &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[10060] w-max max-w-[min(200px,calc(100vw-20px))]"
            style={{
              left: heatmapTooltip.left,
              top: heatmapTooltip.top,
              transform: 'translate(-50%, calc(-100% - 8px))',
            }}
            role="tooltip"
          >
            <div className="relative overflow-visible rounded-lg border border-[#FF9F0F]/50 bg-[#1a1511]/98 px-2 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm ring-1 ring-black/45">
              <div
                className="pointer-events-none absolute inset-x-2 top-0 h-px bg-linear-to-r from-transparent via-[#FF9F0F]/30 to-transparent"
                aria-hidden
              />
              <div className="flex items-center gap-2">
                <div
                  className="h-6 w-1.5 shrink-0 rounded-full border border-black/40"
                  style={{ backgroundColor: heatmapTooltip.swatch }}
                />
                <div className="min-w-0 leading-tight">
                  <p className="font-mono text-[11px] font-semibold text-[#FFD29A]">{heatmapTooltip.dateStr}</p>
                  <p className="mt-0.5 text-xs font-bold tabular-nums text-sand">
                    {heatmapTooltip.runs}{' '}
                    <span className="font-semibold text-sand/75">
                      {heatmapTooltip.runs === 1 ? 'event' : 'events'}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[9px] leading-snug text-sand/50">
                    {heatmapTooltip.live ? 'Creates + finishes that day' : 'Demo'}
                  </p>
                </div>
              </div>
              <div
                className="pointer-events-none absolute left-1/2 top-full -mt-px h-1.5 w-1.5 -translate-x-1/2 rotate-45 border border-[#FF9F0F]/40 border-t-0 border-l-0 bg-[#1a1511]"
                aria-hidden
              />
            </div>
          </div>,
          document.body,
        )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {projFilterOpen && (
              <motion.div
                key="admin-proj-filter-panel"
                ref={projFilterPanelRef}
                role="dialog"
                aria-label="Filter"
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="fixed z-[9999] max-h-[min(520px,calc(100vh-16px))] w-[280px] overflow-y-auto overflow-x-hidden rounded-2xl border border-white/20 bg-coffee-850/95 shadow-2xl shadow-black/30 backdrop-blur-sm"
                style={{ top: projFilterPanelPos.top, left: projFilterPanelPos.left }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <OfferHistoryFilterForm
                  offerTypeOptions={[...ADMIN_OFFER_TYPE_OPTIONS]}
                  orgMembers={projFilterOrgMembers}
                  draftOfferTypeId={projDraftOfferTypeId}
                  setDraftOfferTypeId={setProjDraftOfferTypeId}
                  draftDateFrom={projDraftDateFrom}
                  setDraftDateFrom={setProjDraftDateFrom}
                  draftDateTo={projDraftDateTo}
                  setDraftDateTo={setProjDraftDateTo}
                  draftSelectedUserIds={projDraftUserIds}
                  toggleUserFilter={toggleProjUserFilter}
                  onClearUserSelection={() => setProjDraftUserIds([])}
                  onApply={applyProjFilters}
                  onReset={resetProjDraftFilters}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {customUsersOpen && (
        <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-coffee-850 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="text-base font-semibold text-sand">Custom user targeting</div>
              <button type="button" onClick={() => setCustomUsersOpen(false)} className="text-sand/70 hover:text-white text-sm">Close</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="inline-flex rounded-xl border border-white/15 bg-black/20 p-1">
                {[
                  { id: 'manual', label: 'Manual users' },
                  { id: 'plans', label: 'By plans owned' },
                  { id: 'offerTypes', label: 'By offer-type access' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCustomMode(item.id as 'manual' | 'plans' | 'offerTypes')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      customMode === item.id ? 'bg-[#FF9F0F] text-white' : 'text-sand/80 hover:bg-white/8'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {customMode === 'manual' && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm text-sand/85 mb-2">Select specific users</div>
                  <div className="flex flex-wrap gap-2">
                    {['Anna Keller', 'Lukas Meier', 'Paul Braun', 'Sofia Lang', 'Mihai Ionescu'].map((u) => {
                      const active = manualUsers.includes(u)
                      return (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setManualUsers((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]))}
                          className={`rounded-full border px-3 py-1 text-xs transition ${
                            active ? 'border-[#FF9F0F]/65 bg-[#FF9F0F]/20 text-[#FFD29A]' : 'border-white/15 bg-black/20 text-sand/80'
                          }`}
                        >
                          {u}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {customMode === 'plans' && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm text-sand/85 mb-2">Target users by number of plans</div>
                  <div className="flex flex-wrap gap-2">
                    {['all', '0-10', '11-30', '31+'].map((bucket) => (
                      <button
                        key={bucket}
                        type="button"
                        onClick={() => setPlanBucket(bucket as 'all' | '0-10' | '11-30' | '31+')}
                        className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                          planBucket === bucket ? 'border-[#FF9F0F]/70 bg-[#FF9F0F]/20 text-[#FFD29A]' : 'border-white/15 bg-black/20 text-sand/80'
                        }`}
                      >
                        {bucket}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {customMode === 'offerTypes' && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm text-sand/85 mb-2">Target users by offer type access</div>
                  <div className="flex flex-wrap gap-2">
                    {['Neubau', 'Dachstuhl', 'Mengenermittlung', 'Custom offers'].map((ot) => {
                      const active = offerTypeTargets.includes(ot)
                      return (
                        <button
                          key={ot}
                          type="button"
                          onClick={() => setOfferTypeTargets((prev) => (prev.includes(ot) ? prev.filter((x) => x !== ot) : [...prev, ot]))}
                          className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                            active ? 'border-[#FF9F0F]/70 bg-[#FF9F0F]/20 text-[#FFD29A]' : 'border-white/15 bg-black/20 text-sand/80'
                          }`}
                        >
                          {ot}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-white/10 flex justify-end gap-2">
              <button type="button" onClick={() => setCustomUsersOpen(false)} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-sand/85 hover:border-[#FF9F0F]/35">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  setAudienceMode('custom')
                  setCustomUsersOpen(false)
                }}
                className="rounded-lg border border-[#FF9F0F]/45 bg-[#FF9F0F]/25 px-3 py-1.5 text-xs font-semibold text-[#FFD29A]"
              >
                <span className="inline-flex items-center gap-1"><Check size={12} />Apply target</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {scheduleOpen && (
        <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-coffee-850 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="text-base font-semibold text-sand">Schedule push</div>
              <button type="button" onClick={() => setScheduleOpen(false)} className="text-sand/70 hover:text-white text-sm">Close</button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="wiz-label">Date</span>
                <DatePickerPopover value={dateTo} onChange={setDateTo} placeholder="Date" size="compact" />
              </label>
              <label className="block">
                <span className="wiz-label">Time</span>
                <input type="time" className="sun-input py-2" defaultValue="09:00" />
              </label>
              <label className="block sm:col-span-2">
                <span className="wiz-label">Timezone</span>
                <SelectSun
                  value={scheduleTimezone}
                  onChange={setScheduleTimezone}
                  options={['Europe/Berlin', 'Europe/Bucharest', 'UTC']}
                  placeholder="Select timezone"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="wiz-label">Repeat</span>
                <div className="flex gap-2 flex-wrap">
                  {['Once', 'Daily', 'Weekly', 'Monthly'].map((r) => (
                    <button key={r} type="button" className="rounded-md border border-white/15 bg-black/20 px-3 py-1 text-xs text-sand/85 hover:border-[#FF9F0F]/35">{r}</button>
                  ))}
                </div>
              </label>
            </div>
            <div className="px-4 py-3 border-t border-white/10 flex justify-end gap-2">
              <button type="button" onClick={() => setScheduleOpen(false)} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-sand/85 hover:border-[#FF9F0F]/35">Cancel</button>
              <button type="button" onClick={() => setScheduleOpen(false)} className="rounded-lg border border-[#FF9F0F]/45 bg-[#FF9F0F]/25 px-3 py-1.5 text-xs font-semibold text-[#FFD29A]">Create schedule</button>
            </div>
          </div>
        </div>
      )}

      {tokensModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-coffee-850 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-base font-semibold text-sand">Add tokens</div>
              <button type="button" onClick={() => setTokensModalOpen(false)} className="text-sm text-sand/70 hover:text-white">
                Close
              </button>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-xs text-sand/65">
                Organization: <span className="font-medium text-sand/90">{selectedOrgMeta.companyName}</span>
              </p>
              <p className="text-xs text-sand/65">
                Current balance:{' '}
                <span className="font-semibold text-[#FFD29A]">{orgTokenBalanceDisplay}</span> tokens
              </p>
              <label className="block">
                <span className="wiz-label">Amount to add</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={tokensAddAmount}
                  onChange={(e) => setTokensAddAmount(e.target.value.replace(/[^\d]/g, ''))}
                  className="sun-input"
                  placeholder="e.g. 2500"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
              <button
                type="button"
                onClick={() => setTokensModalOpen(false)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-sand/85 hover:border-[#FF9F0F]/35"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!liveWorkspace}
                onClick={() => {
                  if (liveWorkspace) return
                  const add = Math.max(0, parseInt(tokensAddAmount, 10) || 0)
                  const base =
                    tokenBalancesByOrg[selectedOrgId] ?? parseTokenBalanceString(selectedOrgMeta.tokenBalance)
                  setTokenBalancesByOrg((prev) => ({ ...prev, [selectedOrgId]: base + add }))
                  setTokensModalOpen(false)
                }}
                className="rounded-lg border border-[#FF9F0F]/45 bg-[#FF9F0F]/25 px-3 py-1.5 text-xs font-semibold text-[#FFD29A] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {editMemberModalOpen && editMemberDraft && editMemberIndex !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-coffee-850 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-base font-semibold text-sand">Edit member</div>
              <button
                type="button"
                onClick={() => {
                  setEditMemberModalOpen(false)
                  setEditMemberDraft(null)
                  setEditMemberIndex(null)
                }}
                className="text-sm text-sand/70 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="space-y-3 p-4">
              {editMemberDraft.sourceProfileId ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                  This account is stored in Supabase. Changes here are not saved yet.
                </p>
              ) : null}
              <label className="block">
                <span className="wiz-label">Name</span>
                <input
                  type="text"
                  readOnly={!!editMemberDraft.sourceProfileId}
                  value={editMemberDraft.name}
                  onChange={(e) => setEditMemberDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                  className={`sun-input${editMemberDraft.sourceProfileId ? ' cursor-default opacity-80' : ''}`}
                />
              </label>
              <label className="block">
                <span className="wiz-label">Email</span>
                <input
                  type="email"
                  readOnly={!!editMemberDraft.sourceProfileId}
                  value={editMemberDraft.email}
                  onChange={(e) => setEditMemberDraft((d) => (d ? { ...d, email: e.target.value } : d))}
                  className={`sun-input${editMemberDraft.sourceProfileId ? ' cursor-default opacity-80' : ''}`}
                />
              </label>
              <label className="block">
                <span className="wiz-label">Password</span>
                <input
                  type="password"
                  readOnly={!!editMemberDraft.sourceProfileId}
                  value={editMemberDraft.password}
                  onChange={(e) => setEditMemberDraft((d) => (d ? { ...d, password: e.target.value } : d))}
                  className={`sun-input${editMemberDraft.sourceProfileId ? ' cursor-default opacity-80' : ''}`}
                  placeholder="New password (UI only)"
                  autoComplete="new-password"
                />
              </label>
              <label className="block">
                <span className="wiz-label">Role</span>
                {editMemberDraft.sourceProfileId ? (
                  <div className="sun-input cursor-default opacity-80">{editMemberDraft.role}</div>
                ) : (
                  <SelectSun
                    value={editMemberDraft.role}
                    onChange={(v) =>
                      setEditMemberDraft((d) =>
                        d ? { ...d, role: v as 'Admin' | 'Member' } : d,
                      )
                    }
                    options={['Admin', 'Member']}
                    placeholder="Select role"
                  />
                )}
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setEditMemberModalOpen(false)
                  setEditMemberDraft(null)
                  setEditMemberIndex(null)
                }}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-sand/85 hover:border-[#FF9F0F]/35"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!editMemberDraft.sourceProfileId}
                onClick={() => {
                  if (editMemberIndex == null || !editMemberDraft || editMemberDraft.sourceProfileId) return
                  const list = [...(orgEditableUsers[selectedOrgId] ?? seedOrgUsersFromMeta(selectedOrgMeta))]
                  list[editMemberIndex] = { ...editMemberDraft }
                  setOrgEditableUsers((prev) => ({ ...prev, [selectedOrgId]: list }))
                  setEditMemberModalOpen(false)
                  setEditMemberDraft(null)
                  setEditMemberIndex(null)
                }}
                className="rounded-lg border border-[#FF9F0F]/45 bg-[#FF9F0F]/25 px-3 py-1.5 text-xs font-semibold text-[#FFD29A] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function formatSparkTooltipSeconds(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function KpiSparkline({
  values,
  valueFormat,
}: {
  values: readonly number[]
  valueFormat: 'count' | 'duration'
}) {
  const rawId = useId()
  const gradId = `kpi-spark-${rawId.replace(/\W/g, '')}`
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1e-9, max - min)
  const w = 100
  const h = 26
  const padY = 2.5
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = padY + (1 - (v - min) / range) * (h - 2 * padY)
    return { x, y, v }
  })
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ')
  const floorY = h - 0.5
  const area = `${polyline} ${w},${floorY} 0,${floorY}`

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-8 w-full max-w-[122px] shrink-0 text-[#FFB84D]"
      role="img"
      aria-label="Trend sparkline for the last eight weeks"
    >
      <title>
        {values.map((v, i) => `W${i + 1}: ${valueFormat === 'duration' ? formatSparkTooltipSeconds(v) : String(Math.round(v))}`).join('; ')}
      </title>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255, 184, 77, 0.28)" />
          <stop offset="100%" stopColor="rgba(255, 159, 15, 0.02)" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline
        points={polyline}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="1.3" fill="#FF9F0F" stroke="rgba(255, 210, 154, 0.85)" strokeWidth="0.6" />
      ))}
    </svg>
  )
}

function KpiCard({
  title,
  value,
  delta,
  icon,
  series,
  sparkCaption,
  valueFormat = 'count',
}: {
  title: string
  value: string
  delta: string
  icon: React.ReactNode
  series?: readonly number[]
  sparkCaption?: string
  valueFormat?: 'count' | 'duration'
}) {
  const showSpark = series && series.length >= 2
  return (
    <div className="rounded-xl border border-black/40 bg-coffee-700/90 p-2.5 shadow-soft backdrop-blur-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[12px] leading-tight text-sand/70">{title}</div>
        <div className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-[#FF9F0F]/35 bg-[#FF9F0F]/15 text-[#FFB84D]">
          {icon}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_118px] items-end gap-2">
        <div className="min-w-0">
          <div className="truncate text-xl font-bold leading-none text-[#FFB84D]">{value}</div>
          <div className="mt-1 inline-flex items-center gap-1.5">
            <span className="rounded-full border border-[#FF9F0F]/35 bg-[#FF9F0F]/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#FFD29A]">{delta}</span>
            <span className="text-[10px] leading-none text-sand/50">vs prev</span>
          </div>
        </div>
        {showSpark ? (
          <div className="min-w-0">
            <KpiSparkline values={series} valueFormat={valueFormat} />
            {sparkCaption ? (
              <span className="mt-0.5 block truncate text-right text-[8px] leading-tight text-sand/40">{sparkCaption}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PipelineRow({
  label,
  value,
  processed,
  failed,
  avg,
  trend,
}: {
  label: string
  value: number
  processed: string
  failed: string
  avg: string
  trend: string
}) {
  const trendUp = trend.startsWith('+')
  return (
    <div className="rounded-lg border border-white/10 bg-black/15 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm text-sand/90">{label}</span>
        <span className="text-sm font-semibold text-[#FFD29A]">{value}%</span>
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-black/25">
        <div className="h-full rounded-full bg-[#FF9F0F]" style={{ width: `${value}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-sand/75">
        <span>Processed: <span className="text-sand/90">{processed}</span></span>
        <span>Failed: <span className="text-sand/90">{failed}</span></span>
        <span>Avg time: <span className="text-sand/90">{avg}</span></span>
        <span>
          Trend:{' '}
          <span className={trendUp ? 'text-[#FFD29A]' : 'text-sand/65'}>
            {trend}
          </span>
        </span>
      </div>
    </div>
  )
}

function MoatAction({ title, markedPlans }: { title: string; markedPlans: number }) {
  return (
    <button
      type="button"
      className="group rounded-lg border border-white/12 bg-black/15 p-2 text-left transition hover:border-[#FF9F0F]/45 hover:bg-[#FF9F0F]/10"
    >
      <div className="text-sm text-sand/70">{title}</div>
      <div className="mt-1 text-xs text-sand/75">
        Marked plans:{' '}
        <span className="font-semibold text-[#FFD29A]">{new Intl.NumberFormat('en-US').format(markedPlans)}</span>
      </div>
      <div className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#FFD29A]">
        Open details
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </button>
  )
}

function OffersThroughputChart({
  points,
}: {
  points: ReadonlyArray<{ label: string; offers: number; avgTime: string }>
}) {
  const maxOffers = Math.max(...points.map((p) => p.offers))
  const minOffers = Math.min(...points.map((p) => p.offers))
  const range = Math.max(1, maxOffers - minOffers)
  const chartW = 100
  const chartH = 70
  const baseY = 62
  const xStep = points.length > 1 ? chartW / (points.length - 1) : chartW
  const coords = points.map((p, idx) => {
    const norm = (p.offers - minOffers) / range
    const y = baseY - norm * chartH
    return { ...p, x: idx * xStep, y }
  })
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ')
  const area = `${coords.map((c) => `${c.x},${c.y}`).join(' ')} ${chartW},${baseY} 0,${baseY}`

  return (
    <div className="relative h-[240px] overflow-hidden rounded-lg border border-white/10 bg-black/15">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(255,255,255,.08)_1px,transparent_1px)] bg-size-[100%_25%]" />
      <svg viewBox={`0 0 ${chartW} 70`} className="absolute inset-x-3 top-3 h-[170px] w-[calc(100%-1.5rem)]">
        <defs>
          <linearGradient id="offersArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,184,77,0.35)" />
            <stop offset="100%" stopColor="rgba(255,159,15,0.02)" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#offersArea)" />
        <polyline points={polyline} fill="none" stroke="#FFB84D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c) => (
          <circle key={c.label} cx={c.x} cy={c.y} r="1.8" fill="#FF9F0F" stroke="#FFD29A" strokeWidth="0.7" />
        ))}
      </svg>
      <div className="absolute inset-x-3 top-3 h-[170px]">
        {coords.map((c) => (
          <div
            key={c.label}
            className="group absolute -translate-x-1/2"
            style={{ left: `${c.x}%`, top: `${(c.y / 70) * 100}%` }}
          >
            <div className="h-4 w-4 rounded-full" />
            <div className="pointer-events-none absolute -top-14 left-1/2 z-20 min-w-[128px] -translate-x-1/2 rounded-md border border-[#FF9F0F]/35 bg-[#2b1f17]/95 px-2 py-1 text-xs text-sand opacity-0 shadow-soft transition-all duration-150 group-hover:-translate-y-1 group-hover:opacity-100">
              <div className="font-semibold text-[#FFD29A]">{c.label}</div>
              <div>Offers: {c.offers}</div>
              <div>Avg time: {c.avgTime}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-3 bottom-2 flex items-center justify-between text-[10px] text-sand/70">
        {points.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>
    </div>
  )
}
