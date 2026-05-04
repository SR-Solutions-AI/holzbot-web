'use client'

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
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
  Cpu,
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
  Trash2,
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
import PdfThumbnail from '../components/PdfThumbnail'
import { SUBSCRIPTION_TIER_ADMIN_LABELS_DE } from '@/lib/subscriptionPriceTiers'
import {
  fetchAdminTenants,
  fetchAdminTenantOffers,
  fetchAdminTenantWorkspace,
  adminPermanentlyDeleteOffer,
  fetchAdminStatisticsSummary,
  resolveAdminIncident,
  closeAdminRun,
  fetchAdminOfferPipelineDetails,
  updateAdminTenantWorkspace,
  type AdminStatisticsIncident,
  type AdminTenant,
  type AdminTenantOffer,
  type AdminTenantWorkspace,
  type AdminStatisticsSummary,
} from '../lib/adminApi'

/** Dashboard center logo; used as client header fallback when no `logoSrc`. */
const HOLZBOT_LOGO_PLACEHOLDER = '/logo.png'

type DummyOrg = { id: string; name: string; app_platform?: 'holzbot' | 'betonbot' | 'mixed' }
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
  { key: 'plan_segmentation',  title: 'Plan segmentation',  markedPlans: 14382 },
  { key: 'wall_detection',     title: 'Wall detection',     markedPlans: 9744  },
  { key: 'rooms_detection',    title: 'Rooms',              markedPlans: 7219  },
  { key: 'doors',              title: 'Doors',              markedPlans: 18108 },
  { key: 'windows',            title: 'Windows',            markedPlans: 22991 },
  { key: 'garage_door',        title: 'Garage doors',       markedPlans: 2100  },
  { key: 'door_stairs',        title: 'Stair openings',     markedPlans: 1500  },
  { key: 'demolitions',        title: 'Demolitions',        markedPlans: 800   },
  { key: 'stairs',             title: 'Stairs',             markedPlans: 650   },
  { key: 'pillars',            title: 'Pillars',            markedPlans: 400   },
  { key: 'bestand',            title: 'Bestand',            markedPlans: 300   },
  { key: 'wall_demolition',    title: 'Wall demolition',    markedPlans: 250   },
  { key: 'roof',               title: 'Roof',               markedPlans: 3000  },
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

const NEST_API_BASE = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:4000'

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
  'Einfamilienhaus Angebot',
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
  { id: 'adm-zubaufull', slug: 'zubau_aufstockung' },
  { id: 'adm-auf', slug: 'aufstockung' },
  { id: 'adm-zubau', slug: 'zubau' },
  { id: 'adm-neu', slug: 'einfamilienhaus' },
] as const

const ADMIN_PERMISSION_OFFER_TYPES = [
  { slug: 'einfamilienhaus', label: 'Angebot Einfamilienhaus' },
  { slug: 'mengenermittlung', label: 'Angebot Mengenermittlung' },
  { slug: 'dachstuhl', label: 'Angebot Dachstuhl' },
  { slug: 'aufstockung', label: 'Angebot Aufstockung' },
  { slug: 'zubau', label: 'Angebot Zubau' },
  { slug: 'zubau_aufstockung', label: 'Angebot Zubau / Aufstockung' },
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

// cost_cents is stored as USD¢ (hundredths of USD). Display as $.
function formatCostCents(cents: number | string | null | undefined): string {
  const n = Number(cents)
  if (cents == null || !Number.isFinite(n)) return '—'
  const usd = n / 100
  if (usd < 0.0001) return `$${usd.toFixed(7)}`
  if (usd < 0.01) return `$${usd.toFixed(6)}`
  if (usd < 0.10) return `$${usd.toFixed(5)}`
  return `$${usd.toFixed(4)}`
}

/**
 * Fetches an image from a URL that requires Authorization header and renders it.
 * Falls back gracefully if the URL is a normal Supabase public URL (no auth needed).
 */
/**
 * Fetches an image that may require Authorization header and renders it.
 * If `clickable` is true, clicking the image opens it in a new tab using the blob URL (bypassing auth on direct navigation).
 */
function AuthImage({ src, alt, className, style, clickable }: { src: string; alt: string; className?: string; style?: CSSProperties; clickable?: boolean }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const fetchImage = useCallback(async () => {
    if (!src) return
    // For Supabase storage URLs — no auth needed, use directly
    const needsAuth = src.includes('/room-crop-image') || src.includes('/wall-mask-image') || src.includes('/segmentation-image')
    if (!needsAuth) {
      setObjectUrl(src)
      return
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const fullUrl = src.startsWith('http') ? src : `${NEST_API_BASE}${src}`
      const res = await fetch(fullUrl, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (!res.ok) { setFailed(true); return }
      const blob = await res.blob()
      setObjectUrl(URL.createObjectURL(blob))
    } catch {
      setFailed(true)
    }
  }, [src])
  useEffect(() => {
    fetchImage()
    return () => { if (objectUrl?.startsWith('blob:')) URL.revokeObjectURL(objectUrl) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])
  if (failed) return <div className={`flex items-center justify-center text-[9px] text-white/30 ${className ?? ''}`} style={style}>err</div>
  if (!objectUrl) return <div className={`animate-pulse bg-white/5 ${className ?? ''}`} style={style} />
  const handleClick = clickable && objectUrl ? () => window.open(objectUrl, '_blank') : undefined
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={objectUrl} alt={alt} className={`${className ?? ''}${clickable ? ' cursor-pointer' : ''}`} style={style} onClick={handleClick} />
}

function bumpDayCount(map: Map<string, number>, iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return
  const key = toYMD(d)
  map.set(key, (map.get(key) ?? 0) + 1)
}

/** Live tenant offers use UUID `offers.id`; demo seed rows use synthetic refs. */
function isOfferUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || '').trim())
}

type AdminEditorSnapshotItem = {
  id: string
  url: string
  filename: string
  plan_id?: string
  editor: 'detections_review' | 'roof'
  created_at: string
  /** Set when snapshot comes from local roof rectangle PNG (admin API). */
  floor_idx?: number
}

type AdminEditorLayerKey =
  | 'base'
  | 'rooms'
  | 'door'
  | 'window'
  | 'garage_door'
  | 'door_stairs'
  | 'door_lift'
  | 'demolitions'
  | 'stairs'
  | 'roof'
  | 'pillars'
  | 'bestand'
  | 'wall_demolition'

type AdminEditorOverlayKey = Exclude<AdminEditorLayerKey, 'base'>

/** Full stack order (base always first when present). */
const ADMIN_BLUEPRINT_STACK_ORDER: AdminEditorLayerKey[] = [
  'base',
  'rooms',
  'door',
  'window',
  'garage_door',
  'door_stairs',
  'door_lift',
  'demolitions',
  'stairs',
  'pillars',
  'bestand',
  'wall_demolition',
  'roof',
]

/** Togglable overlays only — base is always shown when available. */
const ADMIN_OVERLAY_LAYER_ORDER: AdminEditorOverlayKey[] = [
  'rooms',
  'door',
  'window',
  'garage_door',
  'door_stairs',
  'door_lift',
  'demolitions',
  'stairs',
  'pillars',
  'bestand',
  'wall_demolition',
  'roof',
]

const ADMIN_BLUEPRINT_LAYER_LABEL: Record<AdminEditorLayerKey, string> = {
  base: 'Base',
  rooms: 'Rooms',
  door: 'Door',
  window: 'Window',
  garage_door: 'Garage Door',
  door_stairs: 'Stairs (opening)',
  door_lift: 'Lift',
  demolitions: 'Roof demolitions',
  stairs: 'Stair openings',
  pillars: 'Pillars',
  bestand: 'Bestand',
  wall_demolition: 'Wall demolition',
  roof: 'Roof polygons',
}

const ADMIN_LAYER_COLOR: Partial<Record<AdminEditorLayerKey, string>> = {
  rooms: '#3b82f6',
  door: '#22c55e',
  window: '#60a5fa',
  garage_door: '#a855f7',
  door_stairs: '#ec4899',
  door_lift: '#06b6d4',
  demolitions: '#ef4444',
  stairs: '#ec4899',
  pillars: '#0ea5e9',
  bestand: '#f59e0b',
  wall_demolition: '#f87171',
  roof: '#fb923c',
}

type AdminEditorLayerEntry = {
  id: string
  url: string
  filename: string
  created_at: string
}

/** Per-plan blueprint review: same stacking as customer editor (base + room + door overlays). */
type AdminBlueprintSnapshotGroup = {
  plan_id?: string
  created_at: string
  layers: Partial<Record<AdminEditorLayerKey, AdminEditorLayerEntry>>
}

type AdminProjectEditorSnapshotsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ok'
      items: AdminEditorSnapshotItem[]
      blueprint_groups: AdminBlueprintSnapshotGroup[]
      roof_items: AdminEditorSnapshotItem[]
    }

type AdminRoofVectorPolygon = {
  points: Array<[number, number]>
  roomName?: string
}

type AdminRoofVectorPlan = {
  imageWidth: number
  imageHeight: number
  rectangles: AdminRoofVectorPolygon[]
  floorLabel?: string
}

type AdminVectorPlan = {
  imageWidth: number
  imageHeight: number
  rooms?: Array<{ points: Array<[number, number]>; roomName?: string }>
  doors?: Array<{ bbox: [number, number, number, number]; type?: string }>
  roofDemolitions?: Array<{ points: Array<[number, number]> }>
  stairOpenings?: Array<{ bbox: [number, number, number, number] }>
  pillars?: Array<{ points: Array<[number, number]> }>
  zubauBestandPolygons?: Array<{ points: Array<[number, number]> }>
  zubauWallDemolitionLines?: Array<{ a: [number, number]; b: [number, number] }>
}

/** AdminVectorPlan augmented with plan identifier for Data Moat display. */
type MoatVectorPlan = AdminVectorPlan & { planIndex: number; planId?: string; offerId: string }

/**
 * Which overlay layers to render for each Data Moat section key.
 * 'wall_detection' is handled specially (show wall skeleton image).
 */
const MOAT_SECTION_OVERLAY_LAYERS: Record<string, AdminEditorOverlayKey[]> = {
  plan_segmentation: ['rooms', 'door', 'window', 'garage_door', 'door_stairs', 'door_lift'],
  wall_detection:    [],
  rooms_detection:   ['rooms'],
  doors:             ['door'],
  windows:           ['window'],
  garage_door:       ['garage_door'],
  door_stairs:       ['door_stairs'],
  demolitions:       ['demolitions'],
  stairs:            ['stairs'],
  pillars:           ['pillars'],
  bestand:           ['bestand'],
  wall_demolition:   ['wall_demolition'],
  roof:              ['roof'],
}

function extractMoatSectionJson(plan: MoatVectorPlan, sectionKey: string): object {
  const base = {
    offer_id: plan.offerId,
    plan_index: plan.planIndex,
    plan_id: plan.planId ?? null,
    image_width: plan.imageWidth,
    image_height: plan.imageHeight,
  }
  const filterDoors = (type: string | string[]) => {
    const types = Array.isArray(type) ? type : [type]
    return (plan.doors ?? []).filter((d) => types.includes(String(d.type ?? '').toLowerCase().replace(/-/g, '_')))
  }
  switch (sectionKey) {
    case 'plan_segmentation':
      return { ...base, rooms: plan.rooms ?? [], openings: plan.doors ?? [] }
    case 'wall_detection':
      return { ...base, openings: plan.doors ?? [], stair_openings: plan.stairOpenings ?? [] }
    case 'rooms_detection':
      return { ...base, rooms: plan.rooms ?? [] }
    case 'doors':
      return { ...base, doors: filterDoors('door') }
    case 'windows':
      return { ...base, windows: filterDoors('window') }
    case 'garage_door':
      return { ...base, garage_doors: filterDoors(['garage_door', 'garagentor']) }
    case 'door_stairs':
      return { ...base, stair_openings: filterDoors('stairs') }
    case 'demolitions':
      return { ...base, demolitions: plan.roofDemolitions ?? [] }
    case 'stairs':
      return { ...base, stair_openings: plan.stairOpenings ?? [] }
    case 'pillars':
      return { ...base, pillars: plan.pillars ?? [] }
    case 'bestand':
      return { ...base, bestand: plan.zubauBestandPolygons ?? [] }
    case 'wall_demolition':
      return { ...base, wall_demolition_lines: plan.zubauWallDemolitionLines ?? [] }
    case 'roof':
      return { ...base, roof_polygons: plan.rooms ?? [] }
    default:
      return { ...base, rooms: plan.rooms ?? [], openings: plan.doors ?? [] }
  }
}

function getMoatFeatureCount(plan: MoatVectorPlan, sectionKey: string): number {
  const filterDoors = (type: string | string[]) => {
    const types = Array.isArray(type) ? type : [type]
    return (plan.doors ?? []).filter((d) => types.includes(String(d.type ?? '').toLowerCase().replace(/-/g, '_'))).length
  }
  switch (sectionKey) {
    case 'plan_segmentation':  return (plan.rooms?.length ?? 0) + (plan.doors?.length ?? 0)
    case 'wall_detection':     return (plan.doors?.length ?? 0) + (plan.stairOpenings?.length ?? 0)
    case 'rooms_detection':    return plan.rooms?.length ?? 0
    case 'doors':              return filterDoors('door')
    case 'windows':            return filterDoors('window')
    case 'garage_door':        return filterDoors(['garage_door', 'garagentor'])
    case 'door_stairs':        return filterDoors('stairs')
    case 'demolitions':        return plan.roofDemolitions?.length ?? 0
    case 'stairs':             return plan.stairOpenings?.length ?? 0
    case 'pillars':            return plan.pillars?.length ?? 0
    case 'bestand':            return plan.zubauBestandPolygons?.length ?? 0
    case 'wall_demolition':    return plan.zubauWallDemolitionLines?.length ?? 0
    case 'roof':               return plan.rooms?.length ?? 0
    default:                   return 0
  }
}

/**
 * Draws room polygon outlines (thick strokes, no fill) to approximate wall positions.
 * Used as fallback for wall_detection when no wall skeleton image is available.
 */
function buildWallProxyOverlay(plan: MoatVectorPlan): string | null {
  if (plan.imageWidth <= 0 || plan.imageHeight <= 0) return null
  const nodes: string[] = []
  const rooms = Array.isArray(plan.rooms) ? plan.rooms : []
  rooms.forEach((r) => {
    if (!Array.isArray(r.points) || r.points.length < 2) return
    const pts = r.points.map((pt) => `${pt[0]},${pt[1]}`).join(' ')
    nodes.push(`<polygon points="${pts}" fill="none" stroke="#FF9F0F" stroke-width="5" stroke-linejoin="round" opacity="0.85"/>`)
  })
  const doors = Array.isArray(plan.doors) ? plan.doors : []
  doors.forEach((d) => {
    const b = d.bbox
    if (!Array.isArray(b) || b.length < 4) return
    const [x1, y1, x2, y2] = b
    const color = d.type === 'window' ? '#60a5fa' : '#22c55e'
    nodes.push(`<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="2.5"/>`)
  })
  if (!nodes.length) return null
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${plan.imageWidth} ${plan.imageHeight}" width="${plan.imageWidth}" height="${plan.imageHeight}">${nodes.join('')}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function downloadJsonFile(data: object, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const adminRoomColors = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

function labelRectAndText(x: number, y: number, text: string): string {
  const safe = String(text || '').replace(/[<>&"]/g, '')
  const estTextW = Math.max(28, safe.length * 7.6)
  const boxW = estTextW + 10
  const boxH = 18
  const lx = x - boxW / 2
  const ly = y - boxH / 2
  return `<g><rect x="${lx}" y="${ly}" width="${boxW}" height="${boxH}" fill="rgba(0,0,0,0.82)" stroke="rgba(255,255,255,0.45)" stroke-width="1"/><text x="${x}" y="${y}" fill="#ffffff" font-size="12" font-weight="700" text-anchor="middle" dominant-baseline="middle">${safe}</text></g>`
}

function buildOverlayDataUrl(plan: AdminVectorPlan, layer: AdminEditorOverlayKey): string | null {
  if (plan.imageWidth <= 0 || plan.imageHeight <= 0) return null
  const nodes: string[] = []
  if (layer === 'rooms') {
    const rooms = Array.isArray(plan.rooms) ? plan.rooms : []
    rooms.forEach((r, i) => {
      if (!Array.isArray(r.points) || r.points.length < 3) return
      const color = adminRoomColors[i % adminRoomColors.length]
      const pts = r.points.map((pt) => `${pt[0]},${pt[1]}`).join(' ')
      nodes.push(`<polygon points="${pts}" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-width="2"/>`)
      const cx = r.points.reduce((a, b) => a + b[0], 0) / r.points.length
      const cy = r.points.reduce((a, b) => a + b[1], 0) / r.points.length
      nodes.push(labelRectAndText(cx, cy, r.roomName || `R${i}`))
    })
  } else if (layer === 'door' || layer === 'window' || layer === 'garage_door' || layer === 'door_stairs' || layer === 'door_lift') {
    // Map layer key → canonical type strings that match this layer.
    const TYPE_MATCH: Record<string, string[]> = {
      door: ['door'],
      window: ['window', 'sliding_door', 'schiebetur', 'schiebetür'],
      garage_door: ['garage_door', 'garagentor'],
      door_stairs: ['stairs'],
      door_lift: ['lift'],
    }
    const LAYER_COLORS: Record<string, string> = {
      door: '#22c55e',
      window: '#60a5fa',
      garage_door: '#a855f7',
      door_stairs: '#ec4899',
      door_lift: '#06b6d4',
    }
    const LAYER_LABELS: Record<string, string> = {
      door: 'Door',
      window: 'Window',
      garage_door: 'Garage',
      door_stairs: 'Stairs',
      door_lift: 'Lift',
    }
    const matchTypes = TYPE_MATCH[layer] ?? []
    const color = LAYER_COLORS[layer] ?? '#888'
    const labelBase = LAYER_LABELS[layer] ?? layer
    const items = Array.isArray(plan.doors) ? plan.doors : []
    let idx = 0
    items.forEach((d) => {
      const b = d.bbox
      if (!Array.isArray(b) || b.length < 4) return
      const rawType = String(d.type || '').toLowerCase().replace(/-/g, '_')
      // Strict equality only — avoid 'sliding_door'.includes('door') false positives.
      if (!matchTypes.includes(rawType)) return
      idx++
      const [x1, y1, x2, y2] = b
      const minX = Math.min(x1, x2)
      const minY = Math.min(y1, y2)
      const w = Math.abs(x2 - x1)
      const h = Math.abs(y2 - y1)
      nodes.push(`<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-width="2.5" rx="3"/>`)
      nodes.push(labelRectAndText(minX + w / 2, minY + h / 2, `${labelBase} ${idx}`))
    })
  } else if (layer === 'demolitions') {
    const demos = Array.isArray(plan.roofDemolitions) ? plan.roofDemolitions : []
    demos.forEach((d, i) => {
      if (!Array.isArray(d.points) || d.points.length < 3) return
      const pts = d.points.map((pt) => `${pt[0]},${pt[1]}`).join(' ')
      nodes.push(`<polygon points="${pts}" fill="#ef4444" fill-opacity="0.2" stroke="#ef4444" stroke-width="2"/>`)
      const cx = d.points.reduce((a, b) => a + b[0], 0) / d.points.length
      const cy = d.points.reduce((a, b) => a + b[1], 0) / d.points.length
      nodes.push(labelRectAndText(cx, cy, `DEM${i + 1}`))
    })
  } else if (layer === 'stairs') {
    const stairs = Array.isArray(plan.stairOpenings) ? plan.stairOpenings : []
    stairs.forEach((s, i) => {
      const b = s.bbox
      if (!Array.isArray(b) || b.length < 4) return
      const [x1, y1, x2, y2] = b
      const minX = Math.min(x1, x2)
      const minY = Math.min(y1, y2)
      const w = Math.abs(x2 - x1)
      const h = Math.abs(y2 - y1)
      nodes.push(`<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#a855f7" fill-opacity="0.2" stroke="#a855f7" stroke-width="2"/>`)
      nodes.push(labelRectAndText(minX + w / 2, minY + h / 2, `ST${i + 1}`))
    })
  } else if (layer === 'pillars') {
    const pillars = Array.isArray(plan.pillars) ? plan.pillars : []
    pillars.forEach((p, i) => {
      if (!Array.isArray(p.points) || p.points.length < 3) return
      const pts = p.points.map((pt) => `${pt[0]},${pt[1]}`).join(' ')
      nodes.push(`<polygon points="${pts}" fill="#0ea5e9" fill-opacity="0.16" stroke="#0ea5e9" stroke-width="2"/>`)
      const cx = p.points.reduce((a, b) => a + b[0], 0) / p.points.length
      const cy = p.points.reduce((a, b) => a + b[1], 0) / p.points.length
      nodes.push(labelRectAndText(cx, cy, `P${i + 1}`))
    })
  } else if (layer === 'bestand') {
    const bestand = Array.isArray(plan.zubauBestandPolygons) ? plan.zubauBestandPolygons : []
    bestand.forEach((p, i) => {
      if (!Array.isArray(p.points) || p.points.length < 3) return
      const pts = p.points.map((pt) => `${pt[0]},${pt[1]}`).join(' ')
      nodes.push(`<polygon points="${pts}" fill="#f59e0b" fill-opacity="0.16" stroke="#f59e0b" stroke-width="2"/>`)
      const cx = p.points.reduce((a, b) => a + b[0], 0) / p.points.length
      const cy = p.points.reduce((a, b) => a + b[1], 0) / p.points.length
      nodes.push(labelRectAndText(cx, cy, `B${i + 1}`))
    })
  } else if (layer === 'wall_demolition') {
    const lines = Array.isArray(plan.zubauWallDemolitionLines) ? plan.zubauWallDemolitionLines : []
    lines.forEach((ln, i) => {
      if (!Array.isArray(ln.a) || !Array.isArray(ln.b) || ln.a.length < 2 || ln.b.length < 2) return
      nodes.push(
        `<line x1="${ln.a[0]}" y1="${ln.a[1]}" x2="${ln.b[0]}" y2="${ln.b[1]}" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/>`,
      )
      nodes.push(labelRectAndText((ln.a[0] + ln.b[0]) / 2, (ln.a[1] + ln.b[1]) / 2, `WD${i + 1}`))
    })
  } else if (layer === 'roof') {
    const rooms = Array.isArray(plan.rooms) ? plan.rooms : []
    rooms.forEach((r, i) => {
      if (!Array.isArray(r.points) || r.points.length < 3) return
      const color = adminRoomColors[i % adminRoomColors.length]
      const pts = r.points.map((pt) => `${pt[0]},${pt[1]}`).join(' ')
      nodes.push(`<polygon points="${pts}" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="3"/>`)
      const cx = r.points.reduce((a, b) => a + b[0], 0) / r.points.length
      const cy = r.points.reduce((a, b) => a + b[1], 0) / r.points.length
      nodes.push(labelRectAndText(cx, cy, r.roomName || `S${i}`))
    })
  }
  if (nodes.length === 0) return null
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${plan.imageWidth} ${plan.imageHeight}" preserveAspectRatio="xMidYMid meet">${nodes.join('')}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

type AdminUploadedFileRow = {
  id: string
  url: string
  filename: string
  kind: string
  mime?: string
  size?: number
  created_at: string
}

type AdminProjectUploadedFilesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; items: AdminUploadedFileRow[] }

type AdminProjectExportAssets = {
  loading: boolean
  error: string | null
  planUrl: string | null
  planMime: string | null
  pdfUrl: string | null
  adminPdfUrl: string | null
  calculationMethodPdfUrl: string | null
  roofMeasurementsPdfUrl: string | null
  /** When true, customer dashboard only exposes the measurements PDF (same rule here). */
  measurementsOnlyOffer: boolean
}

function formatBytesShort(n: number | undefined): string {
  if (n == null || !Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${Math.round(n)} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

/**
 * All selected layers stacked in one grid cell (same row/col) so every PNG shares the same box —
 * absolute + h-full on overlays often failed to align with the base image in admin.
 */
function AdminBlueprintLayerStack({
  layers,
  layerKeys,
  maxHeightClass = 'max-h-[min(88vh,920px)]',
}: {
  layers: AdminBlueprintSnapshotGroup['layers']
  layerKeys: AdminEditorLayerKey[]
  maxHeightClass?: string
}) {
  const ordered: Array<{ key: AdminEditorLayerKey; entry: AdminEditorLayerEntry }> = []
  for (const key of layerKeys) {
    const entry = layers[key]
    if (entry) ordered.push({ key, entry })
  }

  if (!ordered.length) return null

  return (
    <div className="relative inline-grid max-w-full justify-items-center bg-black/25">
      {ordered.map((o, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={o.key}
          src={o.entry.url}
          alt={i === 0 ? o.entry.filename : ''}
          className={`col-start-1 row-start-1 max-w-full object-contain pointer-events-none ${maxHeightClass}`}
          style={{
            zIndex: i + 1,
            opacity: o.key === 'base' ? 1 : 0.9,
            mixBlendMode: 'normal',
          }}
        />
      ))}
      <div className="pointer-events-none absolute left-2 top-2 z-30 flex flex-wrap gap-1">
        {ordered
          .filter((o) => o.key !== 'base')
          .map((o) => {
            const dotColor = ADMIN_LAYER_COLOR[o.key]
            return (
              <span key={`lbl-${o.key}`} className="flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[9px] font-semibold text-sand/90 backdrop-blur-sm">
                {dotColor && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />}
                {ADMIN_BLUEPRINT_LAYER_LABEL[o.key]}
              </span>
            )
          })}
      </div>
    </div>
  )
}

const adminBlueprintLayerKeysSignature = (layers: AdminBlueprintSnapshotGroup['layers']) =>
  ADMIN_BLUEPRINT_STACK_ORDER.filter((k) => Boolean(layers[k])).join('|')

/** Overlay toggles only; base is always included in the stack when present. */
function AdminBlueprintSnapshotPanel({
  group,
  panelResetKey,
  maxHeightClass = 'max-h-[min(88vh,920px)]',
}: {
  group: AdminBlueprintSnapshotGroup
  /** Stable id for this card (e.g. plan + index) — when it changes, layer selection resets. */
  panelResetKey: string
  maxHeightClass?: string
}) {
  const keysSig = useMemo(() => adminBlueprintLayerKeysSignature(group.layers), [group.layers])

  const availableOverlayKeys = useMemo(
    () => ADMIN_OVERLAY_LAYER_ORDER.filter((k) => Boolean(group.layers[k])),
    [keysSig, group.layers],
  )

  const [activeOverlays, setActiveOverlays] = useState<Set<AdminEditorOverlayKey>>(
    () => new Set(ADMIN_OVERLAY_LAYER_ORDER.filter((k) => Boolean(group.layers[k]))),
  )

  useEffect(() => {
    setActiveOverlays(new Set(ADMIN_OVERLAY_LAYER_ORDER.filter((k) => Boolean(group.layers[k]))))
    // Intentionally not depending on `group.layers` by reference — only when plan card or layer set changes.
  }, [panelResetKey, keysSig])

  const displayKeyOrder = useMemo((): AdminEditorLayerKey[] => {
    const overlays = ADMIN_OVERLAY_LAYER_ORDER.filter(
      (k) => availableOverlayKeys.includes(k) && activeOverlays.has(k),
    )
    if (group.layers.base) return ['base', ...overlays]
    return overlays
  }, [group.layers.base, availableOverlayKeys, activeOverlays])

  const displayLayers = useMemo(() => {
    const o: AdminBlueprintSnapshotGroup['layers'] = {}
    for (const k of displayKeyOrder) {
      const e = group.layers[k]
      if (e) o[k] = e
    }
    return o
  }, [displayKeyOrder, group.layers])

  const toggleOverlay = (k: AdminEditorOverlayKey) => {
    setActiveOverlays((prev) => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }

  const activateAllOverlays = () => {
    setActiveOverlays(new Set(ADMIN_OVERLAY_LAYER_ORDER.filter((key) => Boolean(group.layers[key]))))
  }

  const deactivateOverlaysOnly = () => {
    setActiveOverlays(new Set())
  }

  const hasAnyLayer = Boolean(group.layers.base) || availableOverlayKeys.length > 0
  if (!hasAnyLayer) {
    return <div className="py-6 text-center text-[11px] text-sand/55">No blueprint snapshot layers for this plan.</div>
  }

  const showOverlayToggles = availableOverlayKeys.length > 0

  return (
    <div className="flex w-full max-w-full flex-col items-stretch gap-3">
      {showOverlayToggles ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
          {/* Action row */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[9px] font-bold uppercase tracking-widest text-sand/35">Layers</span>
            <button
              type="button"
              onClick={activateAllOverlays}
              className="rounded-md border border-[#FF9F0F]/40 bg-[#FF9F0F]/12 px-2 py-0.5 text-[10px] font-semibold text-[#FFD29A] transition hover:bg-[#FF9F0F]/22"
            >
              All ON
            </button>
            <button
              type="button"
              onClick={deactivateOverlaysOnly}
              className="rounded-md border border-white/15 bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-sand/65 transition hover:border-white/30 hover:text-sand/90"
            >
              Base only
            </button>
          </div>
          {/* Layer toggle chips */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Blueprint overlay layers">
            {availableOverlayKeys.map((k) => {
              const on = activeOverlays.has(k)
              const dotColor = ADMIN_LAYER_COLOR[k] ?? '#888'
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleOverlay(k)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition-all ${
                    on
                      ? 'border-white/20 bg-white/10 text-sand shadow-sm'
                      : 'border-white/8 bg-black/20 text-sand/45 hover:border-white/18 hover:text-sand/70'
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full transition-opacity"
                    style={{ backgroundColor: dotColor, opacity: on ? 1 : 0.3 }}
                  />
                  {ADMIN_BLUEPRINT_LAYER_LABEL[k]}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
      <div className="flex w-full justify-center overflow-x-auto">
        <AdminBlueprintLayerStack layers={displayLayers} layerKeys={displayKeyOrder} maxHeightClass={maxHeightClass} />
      </div>
    </div>
  )
}

function AdminRoofSnapshotsPanel({ items, maxHeightClass }: { items: AdminEditorSnapshotItem[]; maxHeightClass?: string }) {
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const fa = typeof a.floor_idx === 'number' ? a.floor_idx : 9999
      const fb = typeof b.floor_idx === 'number' ? b.floor_idx : 9999
      if (fa !== fb) return fa - fb
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
    })
  }, [items])
  const [idx, setIdx] = useState(0)
  const safeIdx = sorted.length ? Math.min(idx, sorted.length - 1) : 0
  const cur = sorted[safeIdx]
  useEffect(() => {
    if (idx >= sorted.length && sorted.length > 0) setIdx(sorted.length - 1)
  }, [idx, sorted.length])

  if (!sorted.length) return null
  const mh = maxHeightClass ?? 'max-h-[min(86vh,960px)]'

  return (
    <div className="flex w-full max-w-full flex-col items-stretch gap-2">
      {sorted.length > 1 ? (
        <div className="flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Roof snapshot floors">
          {sorted.map((it, i) => (
            <button
              key={it.id}
              type="button"
              role="tab"
              aria-selected={safeIdx === i}
              onClick={() => setIdx(i)}
              className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition ${
                safeIdx === i
                  ? 'border-[#FF9F0F]/70 bg-[#FF9F0F]/20 text-[#FFD29A]'
                  : 'border-white/15 bg-black/35 text-sand/75 hover:border-white/25'
              }`}
            >
              {typeof it.floor_idx === 'number' ? `Roof floor ${it.floor_idx}` : it.filename}
            </button>
          ))}
        </div>
      ) : null}
      {cur ? (
        <div className="mb-1 flex flex-col gap-0.5 border-b border-white/10 pb-2 text-[11px] text-sand/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 truncate font-mono text-sand/75">{cur.filename}</span>
            <span className="shrink-0">{formatEnDateTime(cur.created_at)}</span>
          </div>
        </div>
      ) : null}
      {cur ? (
        <div className="flex w-full justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cur.url} alt={cur.filename} className={`w-auto max-w-full object-contain bg-black/25 ${mh}`} />
        </div>
      ) : null}
      {cur ? (
        <div className="text-center">
          <a
            href={cur.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-[#FFB84D] hover:underline"
          >
            Open full size in new tab
          </a>
        </div>
      ) : null}
    </div>
  )
}

function editorSnapshotsPreviewSelection(
  snap: Extract<AdminProjectEditorSnapshotsState, { status: 'ok' }>,
): { kind: 'blueprint'; group: AdminBlueprintSnapshotGroup } | { kind: 'roof'; item: AdminEditorSnapshotItem } | null {
  const groups = snap.blueprint_groups
  if (groups.length) return { kind: 'blueprint', group: groups[groups.length - 1] }
  const roofs = snap.roof_items.length ? snap.roof_items : snap.items.filter((x) => x.editor === 'roof')
  if (roofs.length) return { kind: 'roof', item: roofs[roofs.length - 1] }
  return null
}

function editorLabelEn(editor: AdminEditorSnapshotItem['editor']): string {
  if (editor === 'detections_review') return 'Blueprint editor'
  return 'Roof editor'
}

type AdminOrgProjectStatus = 'Running' | 'Queued' | 'Completed' | 'Failed' | 'Cancelled' | 'Deleted'

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
  latestRunCostCents?: number | null
  latestRunCostMeta?: Record<string, unknown> | null
  /** True when row comes from `fetchAdminTenantOffers` (not demo seed data). */
  isLiveRow?: boolean
  deletedAt?: string | null
  /** Soft-deleted by tenant user; admin-only retention. */
  isDeleted?: boolean
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
  const deletedAt = o.deleted_at ?? null
  const isDeleted = Boolean(deletedAt)
  const hist = isDeleted
    ? { label: 'Deleted', className: 'border-zinc-500/45 bg-zinc-600/25 text-zinc-200' }
    : historyStatusPresentation(o.status)
  return {
    id: o.id,
    ref: o.ref,
    offerKindLabel: adminOfferKindLabelEn(o.meta_for_kind ?? {}, o.offer_type_slug),
    dateLabel: formatEnDateTime(o.created_at),
    title: headline,
    duration: pickProjectDurationLabel(o),
    durationTooltip: projectDurationTooltip(o) || undefined,
    status: isDeleted ? 'Deleted' : o.status_ui,
    rawOfferStatus: o.status,
    historyStatusLabel: hist.label,
    historyStatusBadgeClass: hist.className,
    owner: o.owner_name,
    ownerMemberId: o.owner_id ?? '—',
    offerSlug: o.offer_type_slug ?? '',
    createdAt: Number.isNaN(created.getTime()) ? new Date() : created,
    createdAtIso: o.created_at,
    pipelineFinishedAtIso: o.pipeline_finished_at,
    durationWallSeconds: o.duration_wall_seconds,
    lastRunDurationSeconds: o.last_run_duration_seconds,
    latestRunCostCents: o.latest_run_cost_cents != null ? Number(o.latest_run_cost_cents) : null,
    latestRunCostMeta: (o.latest_run_cost_meta && typeof o.latest_run_cost_meta === 'object' ? o.latest_run_cost_meta as Record<string, unknown> : null) ?? null,
    isLiveRow: true,
    deletedAt,
    isDeleted,
  }
}

function inferOfferSlugFromText(text: string): string {
  const t = text.toLowerCase()
  if (t.includes('meng') || t.includes('mengen')) return 'mengenermittlung'
  if (t.includes('dach')) return 'dachstuhl'
  if (t.includes('zubau') && t.includes('aufstock')) return 'zubau_aufstockung'
  if (t.includes('zubau')) return 'zubau'
  if (t.includes('aufstock')) return 'aufstockung'
  if (t.includes('neu') || t.includes('full house')) return 'einfamilienhaus'
  return ''
}

function projectMatchesOfferTypeFilter(project: AdminOrgProjectRow, filterSlug: string | undefined): boolean {
  if (!filterSlug) return true
  const normalizedSlug = inferOfferSlugFromText(project.offerSlug) || project.offerSlug.toLowerCase()
  if (offerSlugMatchesAdminFilter(normalizedSlug, filterSlug)) return true
  const fromLabel = inferOfferSlugFromText(project.offerKindLabel)
  if (fromLabel && offerSlugMatchesAdminFilter(fromLabel, filterSlug)) return true
  const fromTitle = inferOfferSlugFromText(project.title)
  if (fromTitle && offerSlugMatchesAdminFilter(fromTitle, filterSlug)) return true
  return false
}

/**
 * Maps processing image folder/kind + filename to a Data Moat section key.
 * Visualization images are split by filename so each detection type lands in its own section.
 */
function mapProcessingFolderToMoatKey(folder: string, filename = ''): string {
  const f = folder.toLowerCase()
  const fn = filename.toLowerCase()

  // Visualization images are detection overlays (rooms, doors, etc.) — split by filename
  if (f === 'visualization' || f.startsWith('visualization')) {
    if (fn.includes('_rooms') || fn.includes('_room')) return 'rooms_detection'
    if (fn.includes('_door') && !fn.includes('garage') && !fn.includes('sliding')) return 'doors'
    if (fn.includes('garage')) return 'garage_door'
    if (fn.includes('sliding')) return 'windows'
    if (fn.includes('_window')) return 'windows'
    if (fn.includes('_demolit')) return 'demolitions'
    if (fn.includes('_stair')) return 'stairs'
    if (fn.includes('_roof')) return 'roof'
    if (fn.includes('_pillar')) return 'pillars'
    return 'other'
  }
  // Gemini segmentation crops → plan_segmentation
  if (f === 'gemini_crop' || f === 'cluster_preview' || f.includes('plan_segmentation') || f.includes('segmentation')) return 'plan_segmentation'
  // Gemini room crops → rooms_detection
  if (f === 'gemini_room_crop') return 'rooms_detection'
  if (f.includes('wall')) return 'wall_detection'
  if (f.includes('garage')) return 'garage_door'
  if (f.includes('stair')) return 'stairs'
  if (f.includes('door')) return 'doors'
  if (f.includes('window')) return 'windows'
  if (f.includes('demolit')) return 'demolitions'
  if (f.includes('pillar')) return 'pillars'
  if (f.includes('roof')) return 'roof'
  if (f.includes('room')) return 'rooms_detection'
  return 'other'
}

/** Align DB offer_type slugs with admin filter options (see OfferHistoryFilterForm). */
function offerSlugMatchesAdminFilter(offerSlug: string, filterSlug: string | undefined): boolean {
  if (!filterSlug) return true
  if (filterSlug === 'einfamilienhaus') return offerSlug === 'einfamilienhaus' || offerSlug === 'neubau' || offerSlug === 'full_house'
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
  const [tokensAddAmount, setTokensAddAmount] = useState('1')
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
  const [projDraftStatuses, setProjDraftStatuses] = useState<string[]>([])
  const [projAppliedOfferTypeId, setProjAppliedOfferTypeId] = useState('')
  const [projAppliedDateFrom, setProjAppliedDateFrom] = useState('')
  const [projAppliedDateTo, setProjAppliedDateTo] = useState('')
  const [projAppliedUserIds, setProjAppliedUserIds] = useState<string[]>([])
  const [projAppliedStatuses, setProjAppliedStatuses] = useState<string[]>([])
  const [showIncidentsPanel, setShowIncidentsPanel] = useState(false)
  const [incidentBusyFingerprint, setIncidentBusyFingerprint] = useState<string | null>(null)
  const [orgEditMode, setOrgEditMode] = useState(false)
  const [orgDraftBranding, setOrgDraftBranding] = useState({ phone: '', email: '', address: '', website: '' })
  const [orgSaving, setOrgSaving] = useState(false)
  const [orgError, setOrgError] = useState<string | null>(null)
  const [moatPopup, setMoatPopup] = useState<{ key: string; title: string; markedPlans: number; artifacts: number } | null>(null)
  const [moatFiles, setMoatFiles] = useState<{
    status: 'idle' | 'loading' | 'ok' | 'error'
    bySection: Record<string, Array<{ id: string; url: string; filename: string; folder: string }>>
    sourceOfferId: string | null
    message?: string
  }>({ status: 'idle', bySection: {}, sourceOfferId: null })

  type MoatRunSection = Array<{ id: string; url: string; filename: string; plan_id?: string }>
  type MoatRun = { run_id: string; offer_id: string; created_at: string; sections: Record<string, MoatRunSection> }
  const [moatRuns, setMoatRuns] = useState<{
    status: 'idle' | 'loading' | 'ok' | 'error'
    runs: MoatRun[]
    tenantId: string | null
    message?: string
  }>({ status: 'idle', runs: [], tenantId: null })
  const [moatSelectedRunId, setMoatSelectedRunId] = useState<string | null>(null)
  const moatRunsLoadingRef = useRef<string | null>(null)
  const [moatRunsRefreshToken, setMoatRunsRefreshToken] = useState(0)
  const [moatDetectionsData, setMoatDetectionsData] = useState<{
    status: 'idle' | 'loading' | 'ok' | 'error'
    plans: MoatVectorPlan[]
    blueprintImages: Record<string, string>
    /** planId → wall mask image URL (/admin/offers/:id/wall-mask-image?planId=...) */
    wallMaskUrls: Record<string, string>
    sourceOfferId: string | null
  }>({ status: 'idle', plans: [], blueprintImages: {}, wallMaskUrls: {}, sourceOfferId: null })
  // Refs to track which cacheKey we're currently fetching — avoids effect cancellation loops
  const moatDetectionsLoadingRef = useRef<string | null>(null)
  const moatFilesLoadingRef = useRef<string | null>(null)
  type MoatSegCrop = { file: string; raw_label: string; box_2d?: number[]; box_px?: number[]; image_size?: number[]; position_from_bottom?: number; image_url?: string }
  type MoatSegDoc = { doc_id: string; source_url: string; crops: MoatSegCrop[] }
  const [moatSegData, setMoatSegData] = useState<{
    status: 'idle' | 'loading' | 'ok' | 'error'
    offerId: string | null
    docs: MoatSegDoc[]
  }>({ status: 'idle', offerId: null, docs: [] })
  const [orgProfilePopupOpen, setOrgProfilePopupOpen] = useState(false)
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false)
  const [permissionDraftTier, setPermissionDraftTier] = useState(1)
  const [permissionDraftOfferTypes, setPermissionDraftOfferTypes] = useState<string[]>([])
  const [customMode, setCustomMode] = useState<'manual' | 'plans' | 'offerTypes'>('manual')
  const [manualUsers, setManualUsers] = useState<string[]>(['Anna Keller', 'Lukas Meier'])
  const [planBucket, setPlanBucket] = useState<'all' | '0-10' | '11-30' | '31+'>('11-30')
  const [offerTypeTargets, setOfferTypeTargets] = useState<string[]>(['Einfamilienhaus'])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  // Site banner state
  const [bannerMessage, setBannerMessage] = useState('')
  const [bannerVisible, setBannerVisible] = useState(false)
  const [bannerColor, setBannerColor] = useState('#FF9F0F')
  const [bannerSaving, setBannerSaving] = useState(false)
  const [bannerSaved, setBannerSaved] = useState(false)

  // Push update form state
  const [pushTitle, setPushTitle] = useState('')
  const [pushMessage, setPushMessage] = useState('')
  const [pushSaving, setPushSaving] = useState(false)
  const [pushSaved, setPushSaved] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [scheduleRepeat, setScheduleRepeat] = useState<'once' | 'daily' | 'weekly' | 'monthly'>('once')
  const [pushTargetTenantIds, setPushTargetTenantIds] = useState<string[]>([])
  const [pushImageUrl, setPushImageUrl] = useState<string | null>(null)
  const [pushImageUploading, setPushImageUploading] = useState(false)
  const pushImageInputRef = useRef<HTMLInputElement>(null)
  const [adminAnnouncements, setAdminAnnouncements] = useState<Array<{
    id: string; title: string; message: string; audience_mode: string;
    scheduled_at: string | null; created_at: string;
  }>>([])
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
  const [permanentDeletingId, setPermanentDeletingId] = useState<string | null>(null)
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

  /** Live offer: editor review snapshots + export URLs (same documents as user dashboard). */
  const [projectEditorSnapshots, setProjectEditorSnapshots] = useState<AdminProjectEditorSnapshotsState>({ status: 'idle' })
  const [projectExportAssets, setProjectExportAssets] = useState<AdminProjectExportAssets>({
    loading: false,
    error: null,
    planUrl: null,
    planMime: null,
    pdfUrl: null,
    adminPdfUrl: null,
    calculationMethodPdfUrl: null,
    roofMeasurementsPdfUrl: null,
    measurementsOnlyOffer: false,
  })
  const [projectUploadedFiles, setProjectUploadedFiles] = useState<AdminProjectUploadedFilesState>({ status: 'idle' })
  const [projectProcessingImages, setProjectProcessingImages] = useState<{
    status: 'idle' | 'loading' | 'ok' | 'error'
    items: Record<string, Array<{ id: string; url: string; filename: string; plan_id?: string; storage_path?: string }>>
    message?: string
  }>({ status: 'idle', items: {} })
  const [pipelineDetailsModal, setPipelineDetailsModal] = useState<null | 'measurements' | 'pricing'>(null)
  const [projectPipelineDetails, setProjectPipelineDetails] = useState<{
    loading: boolean
    measurements: Array<{ key: string; value: string }>
    pricing: Array<{ key: string; value: string; source: string }>
    measurements_raw: Record<string, unknown> | null
    pricing_raw_per_plan: Array<{ plan_id: string; data: Record<string, unknown> }>
    room_scales_per_plan: Array<{ plan_id: string; data: Record<string, unknown>; local_crop_filenames?: string[] }>
    plan_metadata: Array<{ plan_id: string; data: Record<string, unknown> }>
  }>({ loading: false, measurements: [], pricing: [], measurements_raw: null, pricing_raw_per_plan: [], room_scales_per_plan: [], plan_metadata: [] })
  const [costPopupOpen, setCostPopupOpen] = useState(false)
  const [jsonPreviewModal, setJsonPreviewModal] = useState<{
    open: boolean
    filename: string
    content: string
    loading: boolean
    error: string | null
  }>({ open: false, filename: '', content: '', loading: false, error: null })
  const [projectEditorModalOpen, setProjectEditorModalOpen] = useState(false)

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

  const handleImageUpload = async (file: File) => {
    if (!file) return
    setPushImageUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const filename = `announcement_${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('announcements').upload(filename, file, { upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('announcements').getPublicUrl(data.path)
      setPushImageUrl(urlData.publicUrl)
    } catch (e: any) {
      setPushError(e?.message ?? 'Image upload failed')
    } finally {
      setPushImageUploading(false)
    }
  }

  const fetchAdminAnnouncements = async () => {
    try {
      const res = await apiFetch('/admin/announcements')
      setAdminAnnouncements(res?.announcements ?? [])
    } catch { /* silent */ }
  }

  const fetchBanner = async () => {
    try {
      const res = await apiFetch('/admin/banner')
      if (res?.banner) {
        setBannerMessage(res.banner.message ?? '')
        setBannerVisible(res.banner.is_visible ?? false)
        setBannerColor(res.banner.bg_color ?? '#FF9F0F')
      }
    } catch { /* silent */ }
  }

  const handleSaveBanner = async (overrides?: { is_visible?: boolean }) => {
    setBannerSaving(true)
    setBannerSaved(false)
    try {
      await apiFetch('/admin/banner', {
        method: 'POST',
        body: JSON.stringify({
          message: bannerMessage,
          is_visible: overrides?.is_visible !== undefined ? overrides.is_visible : bannerVisible,
          bg_color: bannerColor,
        }),
      })
      setBannerSaved(true)
      setTimeout(() => setBannerSaved(false), 2000)
    } catch { /* silent */ } finally {
      setBannerSaving(false)
    }
  }

  useEffect(() => {
    if (ready) {
      void fetchAdminAnnouncements()
      void fetchBanner()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const handleInstantlyPush = async () => {
    if (!pushTitle.trim() || !pushMessage.trim()) {
      setPushError('Title and message are required')
      return
    }
    setPushSaving(true)
    setPushError(null)
    try {
      const tenantIds = audienceMode === 'custom' && pushTargetTenantIds.length > 0 ? pushTargetTenantIds : null
      await apiFetch('/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: pushTitle.trim(),
          message: pushMessage.trim(),
          audience_mode: audienceMode === 'custom' && pushTargetTenantIds.length > 0 ? 'specific' : 'all',
          tenant_ids: tenantIds,
          scheduled_at: null,
          repeat_mode: 'once',
          image_url: pushImageUrl || null,
        }),
      })
      setPushSaved(true)
      setPushTitle('')
      setPushMessage('')
      setPushImageUrl(null)
      void fetchAdminAnnouncements()
      setTimeout(() => setPushSaved(false), 3000)
    } catch (e: any) {
      setPushError(e?.message ?? 'Failed to push')
    } finally {
      setPushSaving(false)
    }
  }

  const handleSchedulePush = async () => {
    if (!pushTitle.trim() || !pushMessage.trim()) {
      setPushError('Title and message are required')
      return
    }
    if (!dateTo) {
      setPushError('Please select a date')
      return
    }
    setPushSaving(true)
    setPushError(null)
    try {
      // Build scheduled_at from date + time + timezone (approximate via offset)
      const scheduledAt = new Date(`${dateTo}T${scheduleTime}:00`).toISOString()
      const tenantIds = audienceMode === 'custom' && pushTargetTenantIds.length > 0 ? pushTargetTenantIds : null
      await apiFetch('/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: pushTitle.trim(),
          message: pushMessage.trim(),
          audience_mode: audienceMode === 'custom' && pushTargetTenantIds.length > 0 ? 'specific' : 'all',
          tenant_ids: tenantIds,
          scheduled_at: scheduledAt,
          repeat_mode: scheduleRepeat,
          image_url: pushImageUrl || null,
        }),
      })
      setPushSaved(true)
      setPushTitle('')
      setPushMessage('')
      setPushImageUrl(null)
      setScheduleOpen(false)
      void fetchAdminAnnouncements()
      setTimeout(() => setPushSaved(false), 3000)
    } catch (e: any) {
      setPushError(e?.message ?? 'Failed to schedule')
    } finally {
      setPushSaving(false)
    }
  }

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await apiFetch(`/admin/announcements/${id}/delete`, { method: 'POST' })
      setAdminAnnouncements((prev) => prev.filter((a) => a.id !== id))
    } catch { /* silent */ }
  }

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
      return adminTenants.map((t) => ({ id: t.id, name: t.name, app_platform: t.app_platform }))
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
        incidents: 0,
        avgCost: null as number | null,
      }))
    }
    if (statsStatus === 'ok' && statsSummary) {
      return statsSummary.throughput.map((p) => ({
        label: p.label,
        offers: p.offers,
        avgTime: p.avg_time_label,
        incidents: p.incidents,
        avgCost: p.avg_cost_cents,
      }))
    }
    return Array.from({ length: 8 }, (_, i) => ({
      label: `·${i + 1}`,
      offers: 0,
      avgTime: '—',
      incidents: 0,
      avgCost: null as number | null,
    }))
  }, [hasLiveOrgList, statsStatus, statsSummary])

  const pipelineStageRows = useMemo(() => {
    if (statsStatus === 'ok' && statsSummary?.pipeline_stages?.length) {
      return statsSummary.pipeline_stages.map((stage) => ({
        label: stage.label,
        value: Math.max(0, Math.min(100, Math.round(stage.success_rate_pct))),
        processed: stage.processed.toLocaleString('en-US'),
        failed: stage.failed.toLocaleString('en-US'),
        avg: formatMeanWallSeconds(stage.avg_time_seconds),
        trend:
          stage.trend_pct == null
            ? '—'
            : `${stage.trend_pct > 0 ? '+' : ''}${stage.trend_pct.toFixed(1)}%`,
      }))
    }
    return PIPELINE_STAGES.map((s) => ({ ...s }))
  }, [statsStatus, statsSummary])

  const dataMoatRows = useMemo(() => {
    if (statsStatus === 'ok' && statsSummary?.data_moat?.length) {
      return statsSummary.data_moat.map((row) => ({
        key: row.key,
        title: row.label,
        markedPlans: row.marked_plans,
        artifacts: row.artifacts,
      }))
    }
    return DATA_MOAT_ITEMS.map((row) => ({ ...row, artifacts: row.markedPlans }))
  }, [statsStatus, statsSummary])

  const avgCostPerRunCents = useMemo(() => {
    if (statsStatus === 'ok' && statsSummary?.cost) {
      return statsSummary.cost.avg_cost_per_run_cents
    }
    return AVG_COST_PER_RUN_CENTS
  }, [statsStatus, statsSummary])

  const moatSectionFiles = useMemo(() => {
    if (!moatPopup) return []
    return moatFiles.bySection[moatPopup.key] ?? []
  }, [moatPopup, moatFiles.bySection])

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
          value: `${t.organizations_current}/${t.organizations_churn_current}`,
          delta: formatDeltaPct(t.organizations_churn_current, t.organizations_churn_previous),
        },
        incidents: {
          value: String(statsSummary.incidents.total),
          delta: formatDeltaPct(t.incidents_current, t.incidents_previous),
        },
        sparkOffers: [...statsSummary.kpi_series.offers],
        sparkProc: [...statsSummary.kpi_series.avg_wall_seconds],
        sparkClients: [...statsSummary.kpi_series.clients_net],
        sparkIncidents: [...statsSummary.kpi_series.incidents],
        sparkCaption: segCaption,
        procCaption: 'Mean wall time per segment',
        clientsCaption: `Current orgs / deleted (${t.organizations_all_time} all-time)`,
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

  useEffect(() => {
    setOrgDraftBranding({
      phone: selectedOrgMeta.phone,
      email: selectedOrgMeta.email,
      address: selectedOrgMeta.address,
      website: liveWorkspace?.branding.website ?? '',
    })
    setOrgError(null)
  }, [selectedOrgMeta.phone, selectedOrgMeta.email, selectedOrgMeta.address, liveWorkspace?.branding.website])

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
    const offerCycle = ['mengenermittlung', 'dachstuhl', 'einfamilienhaus'] as const
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
    projAppliedUserIds.length > 0 ||
    projAppliedStatuses.length > 0

  const filteredOrgProjects = useMemo(() => {
    let list = orgProjectsBase
    if (projAppliedOfferTypeId) {
      const opt = ADMIN_OFFER_TYPE_OPTIONS.find((o) => o.id === projAppliedOfferTypeId)
      const slug = opt?.slug as string | undefined
      list = list.filter((p) => projectMatchesOfferTypeFilter(p, slug))
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
    if (projAppliedStatuses.length > 0) {
      list = list.filter((p) => projAppliedStatuses.includes(p.status))
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
    projAppliedStatuses,
    projSearch,
  ])

  const showTenantProjectsLoading =
    usingLiveProjects &&
    tenantOffersStatus !== 'error' &&
    (tenantOffersStatus === 'loading' ||
      tenantOffersStatus === 'idle' ||
      (tenantOffersStatus === 'ok' && tenantOffersLoadedForId !== selectedOrgId))
  const showTenantProjectsError = usingLiveProjects && tenantOffersStatus === 'error'

  const moatSourceOfferId = useMemo(() => {
    if (!tenantOffersMatchSelection || tenantOffers.length === 0) return null
    return tenantOffers[0]?.id ?? null
  }, [tenantOffersMatchSelection, tenantOffers])

  /** All valid offer UUIDs for this tenant (most recent first, max 20). Used for Data Moat aggregation. */
  const moatAllOfferIds = useMemo(() => {
    if (!tenantOffersMatchSelection) return []
    return tenantOffers
      .map((o) => o.id as string)
      .filter((id) => isOfferUuid(id))
      .slice(0, 20)
  }, [tenantOffersMatchSelection, tenantOffers])

  const selectedOrgProject = useMemo(() => {
    if (!selectedProjectRef) return null
    return orgProjectsBase.find((p) => p.id === selectedProjectRef) ?? null
  }, [selectedProjectRef, orgProjectsBase])

  useEffect(() => {
    const p = selectedOrgProject
    if (!p?.isLiveRow || !isOfferUuid(p.id)) {
      setProjectEditorSnapshots({ status: 'idle' })
      setProjectUploadedFiles({ status: 'idle' })
      setProjectProcessingImages({ status: 'idle', items: {} })
      setProjectExportAssets({
        loading: false,
        error: null,
        planUrl: null,
        planMime: null,
        pdfUrl: null,
        adminPdfUrl: null,
        calculationMethodPdfUrl: null,
        roofMeasurementsPdfUrl: null,
        measurementsOnlyOffer: false,
      })
      setProjectPipelineDetails({ loading: false, measurements: [], pricing: [], measurements_raw: null, pricing_raw_per_plan: [], room_scales_per_plan: [], plan_metadata: [] })
      setProjectEditorModalOpen(false)
      return
    }
    const offerId = p.id
    let cancelled = false
    setProjectEditorSnapshots({ status: 'loading' })
    setProjectUploadedFiles({ status: 'loading' })
    setProjectProcessingImages({ status: 'loading', items: {} })
    setProjectExportAssets({
      loading: true,
      error: null,
      planUrl: null,
      planMime: null,
      pdfUrl: null,
      adminPdfUrl: null,
      calculationMethodPdfUrl: null,
      roofMeasurementsPdfUrl: null,
      measurementsOnlyOffer: false,
    })
    setProjectPipelineDetails({ loading: true, measurements: [], pricing: [], measurements_raw: null, pricing_raw_per_plan: [], room_scales_per_plan: [], plan_metadata: [] })
    ;(async () => {
      try {
        const [snapRes, expRes, uploadedRes, procImgsRes, roofRes, detRes, pipelineRes] = await Promise.all([
          apiFetch(`/admin/offers/${encodeURIComponent(offerId)}/editor-snapshots`),
          apiFetch(`/offers/${encodeURIComponent(offerId)}/export`),
          apiFetch(`/admin/offers/${encodeURIComponent(offerId)}/uploaded-files`),
          apiFetch(`/admin/offers/${encodeURIComponent(offerId)}/processing-images`),
          apiFetch(`/offers/${encodeURIComponent(offerId)}/compute/roof-review-data?ts=${Date.now()}`).catch(() => null),
          apiFetch(`/offers/${encodeURIComponent(offerId)}/compute/detections-review-data?ts=${Date.now()}`).catch(() => null),
          fetchAdminOfferPipelineDetails(offerId).catch(() => null),
        ])
        if (cancelled) return
        const items = (snapRes?.items ?? []) as AdminEditorSnapshotItem[]
        const blueprint_groups = ((snapRes?.blueprint_groups ?? []) as AdminBlueprintSnapshotGroup[]).map((g) => ({
          ...g,
          layers: { ...g.layers },
        }))
        const roof_items = (snapRes?.roof_items ?? []) as AdminEditorSnapshotItem[]
        const detPlansRaw = Array.isArray((detRes as { plans?: unknown[] } | null)?.plans)
          ? ((detRes as { plans?: unknown[] }).plans as unknown[])
          : []
        const detVectors: AdminVectorPlan[] = detPlansRaw.map((dp) => {
          const x = (dp ?? {}) as Record<string, unknown>
          const parsePoints = (arr: unknown): Array<[number, number]> =>
            (Array.isArray(arr) ? arr : [])
              .map((p) => {
                if (!Array.isArray(p) || p.length < 2) return null
                const px = Number(p[0])
                const py = Number(p[1])
                if (!Number.isFinite(px) || !Number.isFinite(py)) return null
                return [px, py] as [number, number]
              })
              .filter((p): p is [number, number] => Boolean(p))
          const rooms = (Array.isArray(x.rooms) ? x.rooms : [])
            .map((r) => {
              const rr = (r ?? {}) as Record<string, unknown>
              const pts = parsePoints(rr.points)
              if (pts.length < 3) return null
              return {
                points: pts,
                roomName: typeof rr.roomName === 'string' ? rr.roomName : undefined,
              }
            })
            .filter(Boolean) as Array<{ points: Array<[number, number]>; roomName?: string }>
          const doors = (Array.isArray(x.doors) ? x.doors : [])
            .map((d) => {
              const dd = (d ?? {}) as Record<string, unknown>
              const b = Array.isArray(dd.bbox) ? dd.bbox : []
              if (b.length < 4) return null
              const bbox = [Number(b[0]), Number(b[1]), Number(b[2]), Number(b[3])] as [number, number, number, number]
              if (!bbox.every((v) => Number.isFinite(v))) return null
              return { bbox, type: typeof dd.type === 'string' ? dd.type : undefined }
            })
            .filter(Boolean) as Array<{ bbox: [number, number, number, number]; type?: string }>
          const roofDemolitions = (Array.isArray(x.roofDemolitions) ? x.roofDemolitions : [])
            .map((d) => {
              const dd = (d ?? {}) as Record<string, unknown>
              const pts = parsePoints(dd.points)
              return pts.length >= 3 ? { points: pts } : null
            })
            .filter(Boolean) as Array<{ points: Array<[number, number]> }>
          const stairOpenings = (Array.isArray(x.stairOpenings) ? x.stairOpenings : [])
            .map((s) => {
              const ss = (s ?? {}) as Record<string, unknown>
              const b = Array.isArray(ss.bbox) ? ss.bbox : []
              if (b.length < 4) return null
              const bbox = [Number(b[0]), Number(b[1]), Number(b[2]), Number(b[3])] as [number, number, number, number]
              if (!bbox.every((v) => Number.isFinite(v))) return null
              return { bbox }
            })
            .filter(Boolean) as Array<{ bbox: [number, number, number, number] }>
          const rawPillars = Array.isArray((x as { pillars?: unknown[] }).pillars)
            ? (((x as { pillars?: unknown[] }).pillars ?? []) as unknown[])
            : []
          const pillars = rawPillars
            .map((p) => {
              const pp = (p ?? {}) as Record<string, unknown>
              const pts = parsePoints(pp.points)
              return pts.length >= 3 ? { points: pts } : null
            })
            .filter(Boolean) as Array<{ points: Array<[number, number]> }>
          const rawBestand = Array.isArray((x as { zubauBestandPolygons?: unknown[] }).zubauBestandPolygons)
            ? (((x as { zubauBestandPolygons?: unknown[] }).zubauBestandPolygons ?? []) as unknown[])
            : []
          const zubauBestandPolygons = rawBestand
            .map((p) => {
              const pp = (p ?? {}) as Record<string, unknown>
              const pts = parsePoints(pp.points)
              return pts.length >= 3 ? { points: pts } : null
            })
            .filter(Boolean) as Array<{ points: Array<[number, number]> }>
          const rawWallLines = Array.isArray((x as { zubauWallDemolitionLines?: unknown[] }).zubauWallDemolitionLines)
            ? (((x as { zubauWallDemolitionLines?: unknown[] }).zubauWallDemolitionLines ?? []) as unknown[])
            : []
          const zubauWallDemolitionLines = rawWallLines
            .map((ln) => {
              const l = (ln ?? {}) as Record<string, unknown>
              const a = Array.isArray(l.a) ? l.a : []
              const b = Array.isArray(l.b) ? l.b : []
              if (a.length < 2 || b.length < 2) return null
              const ax = Number(a[0])
              const ay = Number(a[1])
              const bx = Number(b[0])
              const by = Number(b[1])
              if (![ax, ay, bx, by].every((v) => Number.isFinite(v))) return null
              return { a: [ax, ay] as [number, number], b: [bx, by] as [number, number] }
            })
            .filter(Boolean) as Array<{ a: [number, number]; b: [number, number] }>
          return {
            imageWidth: Number(x.imageWidth) || 0,
            imageHeight: Number(x.imageHeight) || 0,
            rooms,
            doors,
            roofDemolitions,
            stairOpenings,
            pillars,
            zubauBestandPolygons,
            zubauWallDemolitionLines,
          }
        })
        const roofPlansRaw = Array.isArray((roofRes as { plans?: unknown[] } | null)?.plans)
          ? ((roofRes as { plans?: unknown[] }).plans as unknown[])
          : []
        const roofVectors: AdminRoofVectorPlan[] = roofPlansRaw.map((rp, idx) => {
          const x = (rp ?? {}) as Record<string, unknown>
          const rectanglesRaw = Array.isArray(x.rectangles) ? (x.rectangles as unknown[]) : []
          const rectangles = rectanglesRaw
            .map((r) => {
              const rr = (r ?? {}) as Record<string, unknown>
              const pointsRaw = Array.isArray(rr.points) ? (rr.points as unknown[]) : []
              const points = pointsRaw
                .map((p) => {
                  if (!Array.isArray(p) || p.length < 2) return null
                  const px = Number(p[0])
                  const py = Number(p[1])
                  if (!Number.isFinite(px) || !Number.isFinite(py)) return null
                  return [px, py] as [number, number]
                })
                .filter((p): p is [number, number] => Boolean(p))
              if (points.length < 3) return null
              return {
                points,
                roomName: typeof rr.roomName === 'string' ? rr.roomName : typeof rr.room_name === 'string' ? rr.room_name : undefined,
              }
            })
            .filter(Boolean) as AdminRoofVectorPolygon[]
          return {
            imageWidth: Number(x.imageWidth) || 0,
            imageHeight: Number(x.imageHeight) || 0,
            rectangles,
            floorLabel: `Roof floor ${idx + 1}`,
          }
        })
        const roofVectorsFiltered = roofVectors.filter((p) => p.imageWidth > 0 && p.imageHeight > 0 && p.rectangles.length > 0)
        const measurementRows: Array<{ key: string; value: string }> = []
        detVectors.forEach((det, idx) => {
          measurementRows.push({ key: `Plan ${idx + 1} rooms`, value: String(det.rooms?.length ?? 0) })
          measurementRows.push({ key: `Plan ${idx + 1} doors/windows`, value: String(det.doors?.length ?? 0) })
          measurementRows.push({ key: `Plan ${idx + 1} demolitions`, value: String(det.roofDemolitions?.length ?? 0) })
          measurementRows.push({ key: `Plan ${idx + 1} stair openings`, value: String(det.stairOpenings?.length ?? 0) })
          measurementRows.push({ key: `Plan ${idx + 1} pillars`, value: String(det.pillars?.length ?? 0) })
          measurementRows.push({ key: `Plan ${idx + 1} bestand polygons`, value: String(det.zubauBestandPolygons?.length ?? 0) })
          measurementRows.push({
            key: `Plan ${idx + 1} demolished wall lines`,
            value: String(det.zubauWallDemolitionLines?.length ?? 0),
          })
        })
        roofVectorsFiltered.forEach((roof, idx) => {
          measurementRows.push({ key: `Roof floor ${idx + 1} polygons`, value: String(roof.rectangles.length) })
        })
        // Inject vector overlays + labels (editor style) for every selection type.
        blueprint_groups.forEach((g, idx) => {
          if (!g.layers.base) return
          const det = detVectors[idx]
          const roof = roofVectorsFiltered[idx]
          if (det) {
            ;([
              'rooms',
              'door',
              'window',
              'garage_door',
              'door_stairs',
              'door_lift',
              'demolitions',
              'stairs',
              'pillars',
              'bestand',
              'wall_demolition',
            ] as AdminEditorOverlayKey[]).forEach((k) => {
              const url = buildOverlayDataUrl(det, k)
              if (!url) return
              g.layers[k] = {
                id: `vec-${k}-${idx}`,
                url,
                filename: `vector_${k}_${idx + 1}.svg`,
                created_at: g.created_at,
              }
            })
          }
          if (roof) {
            const detW = Number(det?.imageWidth) || 0
            const detH = Number(det?.imageHeight) || 0
            const roofW = Number(roof.imageWidth) || 0
            const roofH = Number(roof.imageHeight) || 0
            const detRatio = detW > 0 && detH > 0 ? detW / detH : 0
            const roofRatio = roofW > 0 && roofH > 0 ? roofW / roofH : 0
            const compatibleRatio = detRatio > 0 && roofRatio > 0 ? Math.abs(detRatio - roofRatio) < 0.04 : false
            const targetW = compatibleRatio ? detW : roofW
            const targetH = compatibleRatio ? detH : roofH
            const srcW = Number(roof.imageWidth) || 0
            const srcH = Number(roof.imageHeight) || 0
            const sx = srcW > 0 && targetW > 0 ? targetW / srcW : 1
            const sy = srcH > 0 && targetH > 0 ? targetH / srcH : 1
            const scaledRoofRooms = roof.rectangles.map((r) => ({
              points: r.points.map((p) => [p[0] * sx, p[1] * sy] as [number, number]),
              roomName: r.roomName,
            }))
            const url = buildOverlayDataUrl(
              {
                imageWidth: targetW > 0 ? targetW : roof.imageWidth,
                imageHeight: targetH > 0 ? targetH : roof.imageHeight,
                rooms: scaledRoofRooms,
              },
              'roof',
            )
            if (url) {
              g.layers.roof = {
                id: `vec-roof-${idx}`,
                url,
                filename: `vector_roof_${idx + 1}.svg`,
                created_at: g.created_at,
              }
            }
          }
        })
        setProjectEditorSnapshots({ status: 'ok', items, blueprint_groups, roof_items })
        const uploadedItems = (uploadedRes?.items ?? []) as AdminUploadedFileRow[]
        setProjectUploadedFiles({ status: 'ok', items: uploadedItems })
        setProjectProcessingImages({
          status: 'ok',
          items: ((procImgsRes ?? {}) as Record<
            string,
            Array<{ id: string; url: string; filename: string; plan_id?: string; storage_path?: string }>
          >),
        })
        const plan = expRes?.files?.plan
        const offerMeta = (expRes?.offer?.meta ?? {}) as Record<string, unknown>
        const measurementsOnlyOffer = offerMeta.measurements_only_offer === true
        setProjectExportAssets({
          loading: false,
          error: null,
          planUrl: plan?.download_url ?? null,
          planMime: plan?.meta?.mime ?? null,
          pdfUrl: expRes?.files?.pdf?.download_url ?? expRes?.pdf ?? expRes?.download_url ?? null,
          adminPdfUrl: expRes?.files?.adminPdf?.download_url ?? null,
          calculationMethodPdfUrl: expRes?.files?.calculationMethodPdf?.download_url ?? null,
          roofMeasurementsPdfUrl: expRes?.files?.roofMeasurementsPdf?.download_url ?? null,
          measurementsOnlyOffer,
        })
        const measurementValueRows = Array.isArray((pipelineRes as { measurement_values?: unknown[] } | null)?.measurement_values)
          ? ((pipelineRes as { measurement_values: Array<{ key?: unknown; value?: unknown; source?: unknown }> }).measurement_values
              .map((row) => ({
                key: String(row?.key ?? ''),
                value:
                  row?.value == null
                    ? '—'
                    : typeof row.value === 'string'
                      ? row.value
                      : typeof row.value === 'number' || typeof row.value === 'boolean'
                        ? String(row.value)
                        : JSON.stringify(row.value),
              }))
              .filter((row) => row.key))
          : []
        const pricingRows = Array.isArray((pipelineRes as { pricing_variables?: unknown[] } | null)?.pricing_variables)
          ? ((pipelineRes as { pricing_variables: Array<{ key?: unknown; value?: unknown; source?: unknown }> }).pricing_variables
              .map((row) => ({
                key: String(row?.key ?? ''),
                value:
                  row?.value == null
                    ? '—'
                    : typeof row.value === 'string'
                      ? row.value
                      : typeof row.value === 'number' || typeof row.value === 'boolean'
                        ? String(row.value)
                        : JSON.stringify(row.value),
                source: String(row?.source ?? 'unknown'),
              }))
              .filter((row) => row.key))
          : []
        const appliedPricingRows = Array.isArray((pipelineRes as { applied_pricing_values?: unknown[] } | null)?.applied_pricing_values)
          ? ((pipelineRes as { applied_pricing_values: Array<{ key?: unknown; value?: unknown; source?: unknown }> }).applied_pricing_values
              .map((row) => ({
                key: String(row?.key ?? ''),
                value:
                  row?.value == null
                    ? '—'
                    : typeof row.value === 'string'
                      ? row.value
                      : typeof row.value === 'number' || typeof row.value === 'boolean'
                        ? String(row.value)
                        : JSON.stringify(row.value),
                source: String(row?.source ?? 'pricing_raw'),
              }))
              .filter((row) => row.key))
          : []
        setProjectPipelineDetails({
          loading: false,
          measurements: [...measurementRows, ...measurementValueRows],
          pricing: [...pricingRows, ...appliedPricingRows],
          measurements_raw: (pipelineRes as { measurements_raw?: Record<string, unknown> | null } | null)?.measurements_raw ?? null,
          pricing_raw_per_plan: Array.isArray((pipelineRes as { pricing_raw_per_plan?: unknown[] } | null)?.pricing_raw_per_plan)
            ? ((pipelineRes as { pricing_raw_per_plan: Array<{ plan_id: string; data: Record<string, unknown> }> }).pricing_raw_per_plan)
            : [],
          room_scales_per_plan: Array.isArray((pipelineRes as { room_scales_per_plan?: unknown[] } | null)?.room_scales_per_plan)
            ? ((pipelineRes as { room_scales_per_plan: Array<{ plan_id: string; data: Record<string, unknown>; local_crop_filenames?: string[] }> }).room_scales_per_plan)
            : [],
          plan_metadata: Array.isArray((pipelineRes as { plan_metadata?: unknown[] } | null)?.plan_metadata)
            ? ((pipelineRes as { plan_metadata: Array<{ plan_id: string; data: Record<string, unknown> }> }).plan_metadata)
            : [],
        })
      } catch (e: unknown) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Failed to load offer assets'
        setProjectEditorSnapshots({ status: 'error', message: msg })
        setProjectUploadedFiles({ status: 'error', message: msg })
        setProjectProcessingImages({ status: 'error', items: {}, message: msg })
        setProjectExportAssets({
          loading: false,
          error: msg,
          planUrl: null,
          planMime: null,
          pdfUrl: null,
          adminPdfUrl: null,
          calculationMethodPdfUrl: null,
          roofMeasurementsPdfUrl: null,
          measurementsOnlyOffer: false,
        })
        setProjectPipelineDetails({ loading: false, measurements: [], pricing: [], measurements_raw: null, pricing_raw_per_plan: [], room_scales_per_plan: [], plan_metadata: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedOrgProject])

  // Fetch data-moat runs (images grouped by run_id) from the new tenant endpoint.
  // Runs whenever the moat popup opens for a different tenant, or when moatRunsRefreshToken is bumped (manual refresh).
  useEffect(() => {
    if (!moatPopup || !selectedOrgId) return
    const cacheKey = selectedOrgId
    if (moatRunsLoadingRef.current === cacheKey) return   // already in-flight or loaded for this tenant
    moatRunsLoadingRef.current = cacheKey
    let cancelled = false
    setMoatRuns({ status: 'loading', runs: [], tenantId: cacheKey })
    ;(async () => {
      try {
        const res = (await apiFetch(`/admin/tenants/${encodeURIComponent(cacheKey)}/data-moat-runs`)) as {
          runs: MoatRun[]
        }
        if (cancelled) return
        setMoatRuns({ status: 'ok', runs: res.runs ?? [], tenantId: cacheKey })
        // Auto-select most recent run
        if ((res.runs ?? []).length > 0) {
          setMoatSelectedRunId(res.runs[0].run_id)
        }
      } catch (e) {
        if (cancelled) return
        moatRunsLoadingRef.current = null
        setMoatRuns({ status: 'error', runs: [], tenantId: cacheKey, message: e instanceof Error ? e.message : 'Failed to load runs' })
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moatPopup?.key, selectedOrgId, moatRunsRefreshToken])

  useEffect(() => {
    if (!moatPopup) return
    if (!moatSourceOfferId || !isOfferUuid(moatSourceOfferId)) {
      setMoatFiles({
        status: 'error',
        bySection: {},
        sourceOfferId: null,
        message: 'No live offer available for this organization yet.',
      })
      return
    }
    // Fetch processing images from ALL offers so every processed blueprint appears in moat.
    const cacheKey = moatAllOfferIds.join(',') || moatSourceOfferId || 'none'
    if (moatFilesLoadingRef.current === cacheKey) return
    moatFilesLoadingRef.current = cacheKey

    let cancelled = false
    setMoatFiles({ status: 'loading', bySection: {}, sourceOfferId: cacheKey })
    ;(async () => {
      try {
        const offerIds = moatAllOfferIds.length > 0 ? moatAllOfferIds : (moatSourceOfferId ? [moatSourceOfferId] : [])
        if (offerIds.length === 0) throw new Error('No offers available')

        const allResults = await Promise.allSettled(
          offerIds.map((id) =>
            apiFetch(`/admin/offers/${encodeURIComponent(id)}/processing-images`) as Promise<
              Record<string, Array<{ id: string; url: string; filename: string }>>
            >
          )
        )
        if (cancelled) return

        const bySection: Record<string, Array<{ id: string; url: string; filename: string; folder: string }>> = {}
        for (const result of allResults) {
          if (result.status !== 'fulfilled') continue
          for (const [folder, imgs] of Object.entries(result.value ?? {})) {
            for (const img of imgs ?? []) {
              const key = mapProcessingFolderToMoatKey(folder, img.filename)
              if (!bySection[key]) bySection[key] = []
              bySection[key].push({ ...img, folder })
            }
          }
        }
        setMoatFiles({ status: 'ok', bySection, sourceOfferId: cacheKey })
      } catch (e) {
        if (cancelled) return
        moatFilesLoadingRef.current = null
        setMoatFiles({
          status: 'error', bySection: {}, sourceOfferId: cacheKey,
          message: e instanceof Error ? e.message : 'Could not load data moat files.',
        })
      }
    })()
    return () => { cancelled = true }
  }, [moatPopup, moatAllOfferIds.join(','), moatSourceOfferId])

  // Fetch segmentation data (local disk images + crop coords) when plan_segmentation is open.
  useEffect(() => {
    if (!moatPopup || moatPopup.key !== 'plan_segmentation') return
    const selectedRun = moatRuns.runs.find((r) => r.run_id === moatSelectedRunId)
    const offerId = selectedRun?.offer_id ?? moatSourceOfferId
    if (!offerId || !isOfferUuid(offerId)) return
    if (moatSegData.offerId === offerId && moatSegData.status === 'ok') return
    let cancelled = false
    setMoatSegData({ status: 'loading', offerId, docs: [] })
    ;(async () => {
      try {
        const res = (await apiFetch(`/admin/offers/${encodeURIComponent(offerId)}/segmentation-data`)) as { docs: MoatSegDoc[] }
        if (cancelled) return
        setMoatSegData({ status: 'ok', offerId, docs: res.docs ?? [] })
      } catch {
        if (cancelled) return
        setMoatSegData({ status: 'error', offerId, docs: [] })
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moatPopup?.key, moatSelectedRunId, moatSourceOfferId])

  // Fetch detection vectors + blueprint base images for Data Moat overlays.
  // Aggregates plans from ALL tenant offers so the moat shows every processed blueprint.
  // Uses a ref (cacheKey) to avoid React state-triggered re-fetch loops.
  useEffect(() => {
    if (!moatPopup || moatAllOfferIds.length === 0) return
    const cacheKey = moatAllOfferIds.join(',')
    if (moatDetectionsData.sourceOfferId === cacheKey && moatDetectionsData.status === 'ok') return
    if (moatDetectionsLoadingRef.current === cacheKey) return
    moatDetectionsLoadingRef.current = cacheKey
    setMoatDetectionsData({ status: 'loading', plans: [], blueprintImages: {}, wallMaskUrls: {}, sourceOfferId: cacheKey })

    const parsePoints = (arr: unknown): Array<[number, number]> =>
      (Array.isArray(arr) ? arr : [])
        .map((p) => {
          if (!Array.isArray(p) || p.length < 2) return null
          const px = Number(p[0]); const py = Number(p[1])
          if (!Number.isFinite(px) || !Number.isFinite(py)) return null
          return [px, py] as [number, number]
        })
        .filter((p): p is [number, number] => Boolean(p))

    const parsePlansForOffer = (detResValue: unknown, offerId: string, globalOffset: number): MoatVectorPlan[] => {
      const detPlansRaw = Array.isArray((detResValue as { plans?: unknown[] } | null)?.plans)
        ? ((detResValue as { plans?: unknown[] }).plans as unknown[])
        : []
      return detPlansRaw.map((dp, idx) => {
        const x = (dp ?? {}) as Record<string, unknown>
        const rooms = (Array.isArray(x.rooms) ? x.rooms : [])
          .map((r) => { const rr = (r ?? {}) as Record<string, unknown>; const pts = parsePoints(rr.points); return pts.length >= 3 ? { points: pts, roomName: typeof rr.roomName === 'string' ? rr.roomName : undefined } : null })
          .filter(Boolean) as Array<{ points: Array<[number, number]>; roomName?: string }>
        const doors = (Array.isArray(x.doors) ? x.doors : [])
          .map((d) => { const dd = (d ?? {}) as Record<string, unknown>; const b = Array.isArray(dd.bbox) ? dd.bbox : []; if (b.length < 4) return null; const bbox = [Number(b[0]), Number(b[1]), Number(b[2]), Number(b[3])] as [number, number, number, number]; if (!bbox.every((v) => Number.isFinite(v))) return null; return { bbox, type: typeof dd.type === 'string' ? dd.type : undefined } })
          .filter(Boolean) as Array<{ bbox: [number, number, number, number]; type?: string }>
        const roofDemolitions = (Array.isArray(x.roofDemolitions) ? x.roofDemolitions : [])
          .map((d) => { const dd = (d ?? {}) as Record<string, unknown>; const pts = parsePoints(dd.points); return pts.length >= 3 ? { points: pts } : null })
          .filter(Boolean) as Array<{ points: Array<[number, number]> }>
        const stairOpenings = (Array.isArray(x.stairOpenings) ? x.stairOpenings : [])
          .map((s) => { const ss = (s ?? {}) as Record<string, unknown>; const b = Array.isArray(ss.bbox) ? ss.bbox : []; if (b.length < 4) return null; const bbox = [Number(b[0]), Number(b[1]), Number(b[2]), Number(b[3])] as [number, number, number, number]; if (!bbox.every((v) => Number.isFinite(v))) return null; return { bbox } })
          .filter(Boolean) as Array<{ bbox: [number, number, number, number] }>
        const pillars = ((Array.isArray((x as { pillars?: unknown[] }).pillars) ? (x as { pillars?: unknown[] }).pillars : []) as unknown[])
          .map((p) => { const pp = (p ?? {}) as Record<string, unknown>; const pts = parsePoints(pp.points); return pts.length >= 3 ? { points: pts } : null })
          .filter(Boolean) as Array<{ points: Array<[number, number]> }>
        const zubauBestandPolygons = ((Array.isArray((x as { zubauBestandPolygons?: unknown[] }).zubauBestandPolygons) ? (x as { zubauBestandPolygons?: unknown[] }).zubauBestandPolygons : []) as unknown[])
          .map((p) => { const pp = (p ?? {}) as Record<string, unknown>; const pts = parsePoints(pp.points); return pts.length >= 3 ? { points: pts } : null })
          .filter(Boolean) as Array<{ points: Array<[number, number]> }>
        const zubauWallDemolitionLines = ((Array.isArray((x as { zubauWallDemolitionLines?: unknown[] }).zubauWallDemolitionLines) ? (x as { zubauWallDemolitionLines?: unknown[] }).zubauWallDemolitionLines : []) as unknown[])
          .map((ln) => { const l = (ln ?? {}) as Record<string, unknown>; const a = Array.isArray(l.a) ? l.a : []; const b = Array.isArray(l.b) ? l.b : []; if (a.length < 2 || b.length < 2) return null; const ax = Number(a[0]); const ay = Number(a[1]); const bx = Number(b[0]); const by = Number(b[1]); if (![ax, ay, bx, by].every((v) => Number.isFinite(v))) return null; return { a: [ax, ay] as [number, number], b: [bx, by] as [number, number] } })
          .filter(Boolean) as Array<{ a: [number, number]; b: [number, number] }>
        return {
          offerId,
          planIndex: globalOffset + idx,
          planId: typeof x.planId === 'string' ? x.planId : undefined,
          imageWidth: Number(x.imageWidth) || 0,
          imageHeight: Number(x.imageHeight) || 0,
          rooms, doors, roofDemolitions, stairOpenings, pillars, zubauBestandPolygons, zubauWallDemolitionLines,
        }
      })
    }

    ;(async () => {
      try {
        // Fetch all offers in parallel (detection data + snapshots + wall masks)
        const perOfferResults = await Promise.allSettled(
          moatAllOfferIds.map((offerId) =>
            Promise.allSettled([
              apiFetch(`/offers/${encodeURIComponent(offerId)}/compute/detections-review-data`),
              apiFetch(`/admin/offers/${encodeURIComponent(offerId)}/editor-snapshots`),
              apiFetch(`/admin/offers/${encodeURIComponent(offerId)}/wall-mask-plans`),
            ]).then((r) => ({ offerId, results: r }))
          )
        )

        const allPlans: MoatVectorPlan[] = []
        const allBlueprintImages: Record<string, string> = {}
        const allWallMaskUrls: Record<string, string> = {}

        for (const offerResult of perOfferResults) {
          if (offerResult.status !== 'fulfilled') continue
          const { offerId, results } = offerResult.value
          const [detRes, snapRes, wallRes] = results

          // Parse detection plans for this offer
          const detResValue = detRes.status === 'fulfilled' ? detRes.value : null
          const offerPlans = parsePlansForOffer(detResValue, offerId, allPlans.length)
          allPlans.push(...offerPlans)

          // Parse blueprint base images
          const snapResValue = snapRes.status === 'fulfilled' ? snapRes.value : null
          const blueprintGroups = Array.isArray((snapResValue as { blueprint_groups?: unknown[] } | null)?.blueprint_groups)
            ? ((snapResValue as { blueprint_groups?: unknown[] }).blueprint_groups as unknown[])
            : []
          // Track how many plans this offer contributed (before adding offerPlans above we stored length)
          const offerPlanOffset = allPlans.length - offerPlans.length
          blueprintGroups.forEach((g, idx) => {
            const gg = (g ?? {}) as Record<string, unknown>
            const layers = (gg.layers ?? {}) as Record<string, unknown>
            const base = (layers.base ?? {}) as Record<string, unknown>
            const url = typeof base.url === 'string' ? base.url : ''
            if (!url) return
            const planId = typeof gg.plan_id === 'string' ? gg.plan_id : `${offerId}_${idx}`
            allBlueprintImages[`${offerId}_${planId}`] = url
            allBlueprintImages[`_idx_${offerPlanOffset + idx}`] = url
          })

          // Parse wall mask URLs for this offer
          const wallResValue = wallRes.status === 'fulfilled' ? wallRes.value : null
          const wallPlansList: Array<{ planId: string }> =
            Array.isArray((wallResValue as { plans?: unknown[] } | null)?.plans)
              ? ((wallResValue as { plans?: unknown[] }).plans as Array<{ planId: string }>)
              : []
          const offerPlanOffset2 = allPlans.length - offerPlans.length
          wallPlansList.forEach((wp, idx) => {
            const url = `/admin/offers/${encodeURIComponent(offerId)}/wall-mask-image?planId=${encodeURIComponent(wp.planId)}`
            allWallMaskUrls[`${offerId}_${wp.planId}`] = url
            allWallMaskUrls[`_idx_${offerPlanOffset2 + idx}`] = url
          })
        }

        setMoatDetectionsData({ status: 'ok', plans: allPlans, blueprintImages: allBlueprintImages, wallMaskUrls: allWallMaskUrls, sourceOfferId: cacheKey })
      } catch {
        moatDetectionsLoadingRef.current = null
        setMoatDetectionsData({ status: 'idle', plans: [], blueprintImages: {}, wallMaskUrls: {}, sourceOfferId: null })
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moatPopup?.key, moatAllOfferIds.join(',')])

  useEffect(() => {
    if (!projectEditorModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProjectEditorModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [projectEditorModalOpen])

  useEffect(() => {
    if (!permissionsModalOpen) return
    setPermissionDraftTier(liveWorkspace?.permissions?.usage_tier ?? liveWorkspace?.tokens?.tier ?? 1)
    const current = liveWorkspace?.permissions?.allowed_offer_types ?? []
    setPermissionDraftOfferTypes(current.length > 0 ? [...current] : ADMIN_PERMISSION_OFFER_TYPES.map((x) => x.slug))
  }, [permissionsModalOpen, liveWorkspace])

  const projectPipelineSteps = useMemo(() => {
    return [
      { step: 'Measurements', hint: 'All extracted measurement entities', modal: 'measurements' as const },
      { step: 'Pricing', hint: 'All pricing variables added to offer', modal: 'pricing' as const },
    ]
  }, [])

  const generatedImageSections = useMemo(() => {
    type ImgEntry = { id: string; url: string; filename: string; plan_id?: string; storage_path?: string }
    const sections: Record<string, ImgEntry[]> = {
      segmentation: [],
      wall_construction: [],
      gemini_crops: [],
      roof: [],
      other: [],
    }
    for (const [key, imgs] of Object.entries(projectProcessingImages.items ?? {})) {
      const k = key.toLowerCase()
      let target: ImgEntry[]
      // segmentation: solidified walls + classified blueprint crops
      if (k === 'cluster_preview' || k === 'cluster' || k === 'gemini_crop') target = sections.segmentation
      // wall construction: numbered wall processing steps
      else if (k === 'cubicasa_step') target = sections.wall_construction
      // gemini crops: room scale crops (room_X_*.png) + responses
      else if (k === 'gemini_room_crop') target = sections.gemini_crops
      else if (k === 'roof') target = sections.roof
      else target = sections.other
      for (const img of imgs ?? []) target.push(img)
    }

    // Backward-compat: old runs uploaded room_X_* as 'cubicasa_step'; move them to gemini_crops
    const newWallConstruction: typeof sections.wall_construction = []
    for (const img of sections.wall_construction) {
      if (/^room_\d+_/.test(img.filename ?? '')) {
        sections.gemini_crops.push(img)
      } else {
        newWallConstruction.push(img)
      }
    }
    sections.wall_construction = newWallConstruction

    // Sort wall construction numerically by leading number prefix (00_, 01_, …)
    sections.wall_construction.sort((a, b) => {
      const na = parseInt(a.filename?.match(/^(\d+)/)?.[1] ?? '999', 10)
      const nb = parseInt(b.filename?.match(/^(\d+)/)?.[1] ?? '999', 10)
      if (na !== nb) return na - nb
      return (a.plan_id ?? '').localeCompare(b.plan_id ?? '')
    })

    // Filter out lone '01_walls_from_coords.png' per plan — happens when walls processing
    // was skipped (zero rooms); the file is just the raw blueprint, not a processing output.
    const wallCountByPlan = new Map<string, number>()
    for (const img of sections.wall_construction) {
      const pid = img.plan_id ?? '__none__'
      wallCountByPlan.set(pid, (wallCountByPlan.get(pid) ?? 0) + 1)
    }
    sections.wall_construction = sections.wall_construction.filter((img) => {
      const pid = img.plan_id ?? '__none__'
      const count = wallCountByPlan.get(pid) ?? 0
      const isRawBlueprint = img.filename === '01_walls_from_coords.png'
      return !(isRawBlueprint && count === 1)
    })

    return sections
  }, [projectProcessingImages.items])

  const adminProjectEditorPreview = useMemo(() => {
    if (projectEditorSnapshots.status !== 'ok') return null
    return editorSnapshotsPreviewSelection(projectEditorSnapshots)
  }, [projectEditorSnapshots])

  const adminEditorSnapshotPanelCount = useMemo(() => {
    if (projectEditorSnapshots.status !== 'ok') return 0
    const g = projectEditorSnapshots.blueprint_groups.length
    const r = projectEditorSnapshots.roof_items.length
    if (g + r > 0) return g + r
    return projectEditorSnapshots.items.length
  }, [projectEditorSnapshots])

  const adminProjectDownloadFiles = useMemo(() => {
    const ref = selectedOrgProject?.ref ?? 'offer'
    const ex = projectExportAssets
    type Row = {
      key: string
      label: string
      hint: string
      url: string | null
      thumbKind: 'pdf' | 'image' | 'none'
      imageMime?: string | null
    }
    const rows: Row[] = []
    /** Same subset as the customer dashboard: measurements-only → measurements PDF only; else offer PDF + measurements PDF. */
    if (ex.measurementsOnlyOffer) {
      if (ex.roofMeasurementsPdfUrl) {
        rows.push({
          key: 'roof_m',
          label: `Measurements_${ref}.pdf`,
          hint: 'Takeoff / measurements (same download as for the customer on this offer type)',
          url: ex.roofMeasurementsPdfUrl,
          thumbKind: 'pdf',
        })
      }
      return rows
    }
    if (ex.pdfUrl) {
      rows.push({
        key: 'pdf',
        label: `Angebot_${ref}.pdf`,
        hint: 'Client offer PDF (same as in the customer dashboard)',
        url: ex.pdfUrl,
        thumbKind: 'pdf',
      })
    }
    if (ex.roofMeasurementsPdfUrl) {
      rows.push({
        key: 'roof_m',
        label: `Roof_measurements_${ref}.pdf`,
        hint: 'Measurements / takeoff PDF (same as for the customer when available)',
        url: ex.roofMeasurementsPdfUrl,
        thumbKind: 'pdf',
      })
    }
    return rows
  }, [projectExportAssets, selectedOrgProject?.ref])

  const toggleProjUserFilter = (id: string) => {
    setProjDraftUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const applyProjFilters = () => {
    setProjAppliedOfferTypeId(projDraftOfferTypeId)
    setProjAppliedDateFrom(projDraftDateFrom)
    setProjAppliedDateTo(projDraftDateTo)
    setProjAppliedUserIds(projDraftUserIds)
    setProjAppliedStatuses(projDraftStatuses)
    setProjFilterOpen(false)
  }

  const resetProjDraftFilters = () => {
    setProjDraftOfferTypeId('')
    setProjDraftDateFrom('')
    setProjDraftDateTo('')
    setProjDraftUserIds([])
    setProjDraftStatuses([])
    setProjFilterOpen(false)
  }

  const resolveIncident = async (inc: AdminStatisticsIncident) => {
    const fp = String(inc.fingerprint ?? '').trim()
    if (!fp) return
    try {
      setIncidentBusyFingerprint(fp)
      await resolveAdminIncident(fp)
      if (dateFrom && dateTo) {
        const filtered = orgFilters.filter((id) => adminTenants.some((t) => t.id === id))
        const tenantIds = filtered.length > 0 ? filtered : adminTenants.map((t) => t.id)
        const data = await fetchAdminStatisticsSummary({ from: dateFrom, to: dateTo, tenantIds })
        setStatsSummary(data)
      }
    } finally {
      setIncidentBusyFingerprint(null)
    }
  }

  const closeIncidentRun = async (inc: AdminStatisticsIncident) => {
    const runId = String(inc.run_id ?? '').trim()
    if (!runId) return
    try {
      setIncidentBusyFingerprint(String(inc.fingerprint ?? runId))
      await closeAdminRun(runId)
      if (dateFrom && dateTo) {
        const filtered = orgFilters.filter((id) => adminTenants.some((t) => t.id === id))
        const tenantIds = filtered.length > 0 ? filtered : adminTenants.map((t) => t.id)
        const data = await fetchAdminStatisticsSummary({ from: dateFrom, to: dateTo, tenantIds })
        setStatsSummary(data)
      }
    } finally {
      setIncidentBusyFingerprint(null)
    }
  }

  const saveOrganizationData = async () => {
    if (!usingLiveProjects || !selectedOrgId) return
    try {
      setOrgSaving(true)
      setOrgError(null)
      await updateAdminTenantWorkspace(selectedOrgId, {
        branding: {
          phone: orgDraftBranding.phone,
          email: orgDraftBranding.email,
          address: orgDraftBranding.address,
          website: orgDraftBranding.website,
        },
      })
      setOrgEditMode(false)
      const ws = await fetchAdminTenantWorkspace(selectedOrgId)
      setTenantWorkspace({ status: 'ok', data: ws, error: null, loadedForTenantId: selectedOrgId })
    } catch (e) {
      setOrgError(e instanceof Error ? e.message : 'Could not save organization data.')
    } finally {
      setOrgSaving(false)
    }
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
    const handleClickOutside = (e: globalThis.MouseEvent) => {
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
    const onMove = (e: globalThis.MouseEvent) => {
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
    const onMove = (e: globalThis.MouseEvent) => {
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

  const handleStatsTrackClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = statsScrollRef.current
    if (!el) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const maxTop = Math.max(0, el.clientHeight - statsThumb.height)
    const targetTop = Math.max(0, Math.min(maxTop, clickY - statsThumb.height / 2))
    const ratio = maxTop > 0 ? targetTop / maxTop : 0
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
  }

  const handleStatsThumbMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragStateRef.current.dragging = true
    dragStateRef.current.startY = e.clientY
    dragStateRef.current.startTop = statsThumb.top
  }

  const handlePipelineTrackClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = pipelineScrollRef.current
    if (!el) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const maxTop = Math.max(0, el.clientHeight - pipelineThumb.height)
    const targetTop = Math.max(0, Math.min(maxTop, clickY - pipelineThumb.height / 2))
    const ratio = maxTop > 0 ? targetTop / maxTop : 0
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
  }

  const handlePipelineThumbMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
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
              const active = activeView !== 'statistics' && org.id === selectedOrgId
              const platform = org.app_platform ?? 'holzbot'
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
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-0 flex-1 text-sm font-bold tracking-wide text-sand truncate">{org.name}</div>
                    <div className="flex shrink-0 items-center gap-1">
                      {(platform === 'holzbot' || platform === 'mixed') && (
                        <span className="inline-flex h-5 w-16 items-center justify-center rounded border border-amber-500/30 bg-amber-500/10 px-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/logo.png" alt="Holzbot" className="max-h-full max-w-full object-contain" />
                        </span>
                      )}
                      {(platform === 'betonbot' || platform === 'mixed') && (
                        <span className="inline-flex h-5 w-16 items-center justify-center rounded border border-slate-400/30 bg-slate-400/10 px-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/betonbot-logo.png" alt="Betonbot" className="max-h-full max-w-full object-contain" />
                        </span>
                      )}
                    </div>
                  </div>
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
                          <div className="text-sm font-bold text-white">{formatCostCents(avgCostPerRunCents)}</div>
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
                    onClick={() => setShowIncidentsPanel((v) => !v)}
                    active={showIncidentsPanel}
                  />
                </div>
                {showIncidentsPanel && statsStatus === 'ok' && statsSummary?.incidents?.items?.length ? (
                  <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-red-100">Latest system incidents</div>
                      <div className="text-xs text-red-200/80">
                        {statsSummary.incidents.total} total · high {statsSummary.incidents.high}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {statsSummary.incidents.items.slice(0, 4).map((inc, idx) => (
                        <div
                          key={`${inc.run_id ?? 'run'}-${inc.finished_at ?? inc.started_at ?? idx}`}
                          className="rounded-lg border border-red-300/20 bg-black/20 px-2.5 py-1.5 text-xs text-red-50/90"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="font-semibold">
                              {inc.type.replace(/_/g, ' ')} · {inc.stage}
                            </span>
                            <span className="text-[10px] text-red-200/70">{inc.finished_at ?? inc.started_at ?? '—'}</span>
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-red-100/85">{inc.message}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => resolveIncident(inc)}
                              disabled={incidentBusyFingerprint === inc.fingerprint}
                              className="rounded-md border border-[#FF9F0F]/45 bg-[#FF9F0F]/20 px-2 py-0.5 text-[10px] font-semibold text-[#FFD29A] disabled:opacity-50"
                            >
                              Mark resolved
                            </button>
                            {inc.run_id ? (
                              <button
                                type="button"
                                onClick={() => closeIncidentRun(inc)}
                                disabled={incidentBusyFingerprint === inc.fingerprint}
                                className="rounded-md border border-red-300/45 bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-100 disabled:opacity-50"
                              >
                                Close run
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 xl:min-h-[360px] xl:grid-cols-[1.6fr_1fr]">
                  <div className="flex h-full flex-col rounded-xl border border-white/10 bg-coffee-700/70 p-3 backdrop-blur-sm">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-base font-semibold text-sand">Offer throughput trend</div>
                      <div className="text-sm text-sand/70">
                        {selectedRange} · {selectedOrgNames.length} orgs
                      </div>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs text-sand/70">
                        <span>Total offers: {statisticsKpi.throughputSub.offers}</span>
                        <span>Mean pipeline time: {statisticsKpi.throughputSub.avg}</span>
                      </div>
                      <div className="min-h-0 flex-1">
                        <OffersThroughputChart points={throughputChartPoints} />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 overflow-hidden rounded-xl border border-white/10 bg-coffee-700/70 p-3 backdrop-blur-sm xl:h-full">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="text-base font-semibold text-sand">Pipeline stages</div>
                        <Layers3 size={14} className="text-sand/70" />
                      </div>
                      <div ref={pipelineScrollRef} className="admin-scroll-hide max-h-[300px] space-y-2 overflow-y-scroll pr-1 xl:max-h-[calc(100%-2rem)]">
                        {pipelineStageRows.map((stage) => (
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
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const rows = dataMoatRows
                          const csv = ['Section,Marked Plans,Artifacts,Avg Artifacts/Plan', ...rows.map((r) => `"${r.title}",${r.markedPlans},${r.artifacts},${r.markedPlans > 0 ? (r.artifacts / r.markedPlans).toFixed(2) : '0.00'}`)].join('\n')
                          const blob = new Blob([csv], { type: 'text/csv' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url; a.download = 'data_moat_summary.csv'; a.click(); URL.revokeObjectURL(url)
                        }}
                        className="rounded-md border border-[#FF9F0F]/45 bg-[#FF9F0F]/55 px-3 py-1 text-sm font-semibold text-white transition hover:bg-[#FF9F0F]/70"
                      >
                        Export CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          downloadJsonFile(
                            { sections: dataMoatRows, exported_at: new Date().toISOString(), source_offer_id: moatSourceOfferId },
                            'data_moat_summary.json',
                          )
                        }}
                        className="rounded-md border border-white/15 bg-black/20 px-3 py-1 text-sm font-medium text-sand/85 transition hover:border-[#FF9F0F]/35"
                      >
                        Export JSON
                      </button>
                    </div>
                  </div>
                  <div className="hide-scroll flex gap-2 overflow-x-auto pb-1">
                    {dataMoatRows.map((item) => (
                      <MoatAction
                        key={item.title}
                        title={item.title}
                        markedPlans={item.markedPlans}
                        artifacts={item.artifacts}
                        onOpen={() => setMoatPopup({ key: item.key, title: item.title, markedPlans: item.markedPlans, artifacts: item.artifacts })}
                      />
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
                      <button
                        type="button"
                        onClick={() => setCostPopupOpen(true)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#FF9F0F]/40 bg-[#FF9F0F]/10 px-2.5 py-1.5 transition hover:border-[#FF9F0F]/70 hover:bg-[#FF9F0F]/15"
                        aria-label={`Cost per run ${formatCostCents(selectedOrgProject.latestRunCostCents ?? avgCostPerRunCents)} — click for breakdown`}
                      >
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-[#FF9F0F]/45 bg-[#FF9F0F]/20 text-[11px] font-bold text-[#FFD29A]">
                          €
                        </span>
                        <div className="leading-tight text-left">
                          <div className="text-[10px] uppercase tracking-wide text-sand/70">Cost per run</div>
                          <div className="text-sm font-bold text-white">{formatCostCents(selectedOrgProject.latestRunCostCents ?? avgCostPerRunCents)}</div>
                        </div>
                      </button>
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
                          {!selectedOrgProject.isLiveRow || !isOfferUuid(selectedOrgProject.id) ? (
                            <li className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-[11px] text-sand/55">
                              Uploaded files are available for live offers only.
                            </li>
                          ) : projectUploadedFiles.status === 'loading' ? (
                            <li className="px-2 py-3 text-center text-[11px] text-sand/55">Loading…</li>
                          ) : projectUploadedFiles.status === 'error' ? (
                            <li className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200/95">
                              {projectUploadedFiles.message}
                            </li>
                          ) : projectUploadedFiles.status === 'ok' && projectUploadedFiles.items.length === 0 ? (
                            <li className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-[11px] text-sand/55">
                              No wizard uploads registered for this offer.
                            </li>
                          ) : projectUploadedFiles.status === 'ok' ? (
                            projectUploadedFiles.items.map((f) => (
                              <li key={f.id}>
                                <button
                                  type="button"
                                  onClick={() => window.open(f.url, '_blank', 'noopener,noreferrer')}
                                  className="w-full rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-left text-[11px] transition hover:border-[#FF9F0F]/35 hover:bg-black/35"
                                >
                                  <div className="truncate font-medium text-sand">{f.filename}</div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0 text-[10px] text-sand/50">
                                    <span>{formatBytesShort(f.size)}</span>
                                    <span className="truncate text-sand/45">{f.kind}</span>
                                    <span className="font-mono text-sand/45">{formatEnDateTime(f.created_at)}</span>
                                  </div>
                                </button>
                              </li>
                            ))
                          ) : null}
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
                                  onClick={() => setPipelineDetailsModal(row.modal)}
                                  className="w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-left text-[11px] transition hover:border-[#FF9F0F]/30 hover:bg-black/30"
                                >
                                  <div className="font-medium text-sand">{row.step}</div>
                                  <div className="mt-1 text-[10px] text-sand/55">{row.hint}</div>
                                </button>
                              </li>
                            ))}
                          </ul>
                          <div className="hidden min-w-0 sm:block">
                            <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 border-b border-white/10 pb-2 text-[10px] font-semibold uppercase tracking-wide text-sand/45">
                              <span>Function</span>
                              <span className="text-right">Details</span>
                            </div>
                            <ul className="space-y-1.5">
                              {projectPipelineSteps.map((row) => (
                                <li key={row.step}>
                                  <button
                                    type="button"
                                    onClick={() => setPipelineDetailsModal(row.modal)}
                                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-left text-[11px] transition hover:border-[#FF9F0F]/30 hover:bg-black/30"
                                  >
                                    <span className="min-w-0 truncate font-medium text-sand">{row.step}</span>
                                    <span className="shrink-0 text-sand/65">{row.hint}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Right: user-completed editor snapshots (preview → modal with all) */}
                      <div className="flex min-h-0 flex-col rounded-lg border border-dashed border-[#FF9F0F]/30 bg-black/20 p-2.5">
                        <div className="mb-2 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide text-sand/70">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[#FF9F0F]/35 bg-[#FF9F0F]/12 text-[#FFB84D]">
                            <SquarePen size={13} strokeWidth={2} aria-hidden />
                          </span>
                          Editors
                        </div>
                        <div className="mb-1.5 text-center text-[10px] leading-snug text-sand/50">
                          {selectedOrgProject.isLiveRow && isOfferUuid(selectedOrgProject.id)
                            ? 'Preview from user review. Tap to open all snapshots.'
                            : 'Demo project — connect a live offer to load editor snapshots.'}
                        </div>
                        <button
                          type="button"
                          disabled={
                            !selectedOrgProject.isLiveRow ||
                            !isOfferUuid(selectedOrgProject.id) ||
                            projectEditorSnapshots.status === 'loading' ||
                            (projectEditorSnapshots.status === 'ok' && adminEditorSnapshotPanelCount === 0)
                          }
                          onClick={() => setProjectEditorModalOpen(true)}
                          className="relative flex min-h-[120px] w-full flex-1 flex-col overflow-hidden rounded-xl border border-[#FF9F0F]/30 bg-black/45 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-[#FF9F0F]/50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {projectEditorSnapshots.status === 'loading' ? (
                            <div className="flex flex-1 items-center justify-center px-2 py-6 text-[11px] text-sand/60">
                              Loading editor snapshots…
                            </div>
                          ) : projectEditorSnapshots.status === 'error' ? (
                            <div className="flex flex-1 items-center justify-center px-2 py-4 text-center text-[11px] text-red-300/95">
                              {projectEditorSnapshots.message}
                            </div>
                          ) : adminProjectEditorPreview ? (
                            <>
                              <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-1">
                                {adminProjectEditorPreview.kind === 'blueprint' ? (
                                  <AdminBlueprintLayerStack
                                    layers={adminProjectEditorPreview.group.layers}
                                    layerKeys={ADMIN_BLUEPRINT_STACK_ORDER.filter(
                                      (k) => Boolean(adminProjectEditorPreview.group.layers[k]),
                                    )}
                                    maxHeightClass="max-h-[min(280px,55vh)] lg:max-h-44"
                                  />
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={adminProjectEditorPreview.item.url}
                                    alt={adminProjectEditorPreview.item.filename}
                                    className="h-auto max-h-[min(280px,55vh)] w-full flex-1 object-contain object-center p-1 lg:max-h-44 lg:p-0.5"
                                  />
                                )}
                              </div>
                              <div className="border-t border-white/10 bg-black/55 px-2 py-1 text-center text-[9px] text-sand/75">
                                {adminProjectEditorPreview.kind === 'blueprint'
                                  ? editorLabelEn('detections_review')
                                  : editorLabelEn('roof')}
                                {projectEditorSnapshots.status === 'ok' && adminEditorSnapshotPanelCount > 1
                                  ? ` · +${adminEditorSnapshotPanelCount - 1} more`
                                  : null}
                              </div>
                            </>
                          ) : selectedOrgProject.isLiveRow && isOfferUuid(selectedOrgProject.id) ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-6 text-center text-[11px] text-sand/55">
                              <span>No editor snapshots stored for this offer yet.</span>
                              <span className="text-[10px] text-sand/40">(Runs without blueprint/roof review leave this empty.)</span>
                            </div>
                          ) : (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element -- static public asset */}
                              <img
                                src="/images/admin-floor-plan-preview.png"
                                alt="Demo floor plan preview"
                                className="h-auto max-h-[min(280px,55vh)] w-full object-contain object-center p-1 opacity-60 lg:max-h-40 lg:p-0.5"
                              />
                              <div className="border-t border-white/10 px-2 py-1 text-center text-[9px] text-sand/50">Demo placeholder</div>
                            </>
                          )}
                        </button>
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
                    {projectProcessingImages.status === 'loading' ? (
                      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-sand/60">Loading generated images…</div>
                    ) : projectProcessingImages.status === 'error' ? (
                      <div className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200/95">{projectProcessingImages.message ?? 'Could not load generated images.'}</div>
                    ) : (
                      <div className="space-y-2">
                        {Object.values(generatedImageSections).every((items) => items.length === 0) && projectPipelineDetails.room_scales_per_plan.length === 0 ? (
                          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-sand/60">No generated images for this run yet.</div>
                        ) : (
                          <>
                          {([
                            ['Segmentation', generatedImageSections.segmentation],
                            ['Wall Construction', generatedImageSections.wall_construction],
                            ['Roof', generatedImageSections.roof],
                            ['Other', generatedImageSections.other],
                          ] as const)
                            .filter(([, imgs]) => imgs.length > 0)
                            .map(([section, imgs]) => (
                            <div key={section} className="rounded-lg border border-white/10 bg-black/20 p-2">
                              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#FFD29A]">{section}</div>
                              <div className="hide-scroll flex gap-2 overflow-x-auto pb-1">
                                {imgs.map((img) => (
                                  String(img.filename || '').toLowerCase().endsWith('.json') ? (
                                    <button
                                      key={img.id}
                                      type="button"
                                      onClick={() => {
                                        setJsonPreviewModal({ open: true, filename: img.filename, content: '', loading: true, error: null })
                                        void (async () => {
                                          try {
                                            const res = await fetch(img.url)
                                            const text = await res.text()
                                            let pretty = text
                                            try {
                                              pretty = JSON.stringify(JSON.parse(text), null, 2)
                                            } catch {
                                              // keep raw text
                                            }
                                            setJsonPreviewModal({ open: true, filename: img.filename, content: pretty, loading: false, error: null })
                                          } catch (e) {
                                            setJsonPreviewModal({
                                              open: true,
                                              filename: img.filename,
                                              content: '',
                                              loading: false,
                                              error: e instanceof Error ? e.message : 'Could not load JSON file.',
                                            })
                                          }
                                        })()
                                      }}
                                      className="relative h-24 w-44 shrink-0 overflow-hidden rounded-lg border border-[#FF9F0F]/25 bg-gradient-to-br from-black/40 to-[#2a2017] px-3 py-2 text-left shadow-sm transition hover:border-[#FF9F0F]/45"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#FF9F0F]/35 bg-[#FF9F0F]/10 text-[#FFB84D]">
                                          <FileText size={14} />
                                        </span>
                                        <span className="truncate text-[11px] font-semibold text-[#FFD29A]">JSON details</span>
                                      </div>
                                      <div className="mt-2 line-clamp-2 text-[10px] text-sand/70">{img.filename}</div>
                                    </button>
                                  ) : (
                                    <a
                                      key={img.id}
                                      href={img.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg border border-[#FF9F0F]/25 bg-black/30 shadow-sm transition hover:border-[#FF9F0F]/45"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={img.url} alt={img.filename} className="h-full w-full object-cover opacity-90" />
                                    </a>
                                  )
                                ))}
                              </div>
                            </div>
                          ))}

                  {/* Gemini Crops — all room images (crop/location/mask/batch) + Gemini scale response */}
                  {(generatedImageSections.gemini_crops.length > 0 || projectPipelineDetails.room_scales_per_plan.length > 0) && selectedOrgProject && (
                    <div className="rounded-lg border border-[#FF9F0F]/25 bg-black/20 p-2">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#FFD29A]">Gemini Crops</div>
                      <div className="space-y-3">
                        {(() => {
                          const API_BASE = `${NEST_API_BASE}/admin`
                          const offerId = selectedOrgProject.id
                          // Collect all plans that have either room_scales data or crop images
                          const allPlanIds = Array.from(new Set([
                            ...projectPipelineDetails.room_scales_per_plan.map((p) => p.plan_id),
                            ...generatedImageSections.gemini_crops.map((img) => img.plan_id ?? '__none__'),
                          ]))
                                  return allPlanIds.map((plan_id) => {
                                    const scaleEntry = projectPipelineDetails.room_scales_per_plan.find((p) => p.plan_id === plan_id)
                                    const rooms = scaleEntry ? ((scaleEntry.data.room_scales ?? scaleEntry.data.rooms) as Record<string, Record<string, unknown>> | null) : null
                                    const planCrops = generatedImageSections.gemini_crops.filter((img) => (img.plan_id ?? '__none__') === plan_id)

                                    // Build a map of supabase images by filename for quick lookup
                                    const supabaseByFilename = new Map(planCrops.map((img) => [img.filename, img.url]))

                                    // Merge local-only filenames from pipeline-details (for runs where images weren't uploaded)
                                    type ImgRef = { filename: string; url: string }
                                    const allImgs: ImgRef[] = [...planCrops.map((img) => ({ filename: img.filename ?? '', url: img.url }))]
                                    for (const fn of (scaleEntry?.local_crop_filenames ?? [])) {
                                      if (!supabaseByFilename.has(fn)) {
                                        allImgs.push({ filename: fn, url: `${API_BASE}/offers/${offerId}/room-crop-image?planId=${plan_id}&filename=${encodeURIComponent(fn)}` })
                                      }
                                    }

                                    if (!rooms && allImgs.length === 0) return null

                                    // Group images by room index (room_0_*, room_1_*, …)
                                    const roomImgMap = new Map<string, ImgRef[]>()
                                    for (const img of allImgs) {
                                      const m = img.filename?.match(/^room_(\d+)_/)
                                      const key = m ? m[1] : '__other__'
                                      if (!roomImgMap.has(key)) roomImgMap.set(key, [])
                                      roomImgMap.get(key)!.push(img)
                                    }
                                    // Merge room keys from both sources
                                    const roomKeys = Array.from(new Set([
                                      ...(rooms ? Object.keys(rooms) : []),
                                      ...Array.from(roomImgMap.keys()).filter((k) => k !== '__other__'),
                                    ])).sort((a, b) => Number(a) - Number(b))

                                    // Image label from filename suffix
                                    const imgLabel = (fn: string) => fn.replace(/^room_\d+_/, '').replace(/\.\w+$/, '')

                                    return (
                                      <div key={plan_id}>
                                        {allPlanIds.length > 1 && (
                                          <div className="mb-1.5 text-[10px] font-semibold text-[#FFD29A]/60">{plan_id.replace(/_/g, ' ')}</div>
                                        )}
                                        <div className="space-y-2">
                                          {roomKeys.map((rk) => {
                                            const room = rooms?.[rk] ?? null
                                            const imgs = roomImgMap.get(rk) ?? []
                                            const mPx = room && typeof room.m_px === 'number' ? room.m_px : null
                                            const areaM2 = room && typeof room.area_m2 === 'number' ? room.area_m2 : null
                                            const areaPx = room && typeof room.area_px === 'number' ? room.area_px : null
                                            const roomName = String(room?.room_name ?? room?.room_type ?? `Room ${rk}`)
                                            return (
                                              <div key={rk} className="rounded-md border border-[#FF9F0F]/15 bg-[#FF9F0F]/5 p-2">
                                                {/* Room header */}
                                                <div className="mb-2 flex items-center gap-2">
                                                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-[#FF9F0F]/20 px-1.5 text-[9px] font-bold text-[#FFD29A]">#{rk}</span>
                                                  <span className="text-xs font-semibold text-sand">{roomName}</span>
                                                  {room?.room_type != null && String(room.room_type) !== roomName && (
                                                    <span className="text-[10px] text-sand/50">{String(room.room_type)}</span>
                                                  )}
                                                </div>
                                                {/* All crop images for this room */}
                                                {imgs.length > 0 && (
                                                  <div className="hide-scroll mb-2 flex gap-2 overflow-x-auto pb-1">
                                                    {imgs.map((img) => (
                                                      <div key={img.filename}
                                                        className="relative shrink-0 overflow-hidden rounded border border-[#FF9F0F]/20 bg-black/40 shadow-sm transition hover:border-[#FF9F0F]/50"
                                                        style={{ height: 96, width: 'auto', minWidth: 80 }}
                                                      >
                                                        <AuthImage src={img.url} alt={img.filename} className="h-full w-auto object-contain" style={{ maxWidth: 160 }} clickable />
                                                        <span className="absolute bottom-0.5 left-0.5 rounded bg-black/75 px-1 py-0.5 text-[8px] font-semibold text-[#FFD29A]/80">
                                                          {imgLabel(img.filename ?? '')}
                                                        </span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                                {/* Gemini response */}
                                                <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px]">
                                                  {areaM2 != null && (
                                                    <><span className="text-sand/50">Area</span><span className="col-span-2 font-mono text-sand/80">{areaM2.toFixed(2)} m²</span></>
                                                  )}
                                                  {areaPx != null && (
                                                    <><span className="text-sand/50">Area px</span><span className="col-span-2 font-mono text-sand/80">{areaPx.toLocaleString()} px²</span></>
                                                  )}
                                                  {mPx != null && (
                                                    <><span className="text-sand/50">Scale</span><span className="col-span-2 font-mono text-sand/80">{mPx.toFixed(6)} m/px &nbsp;<span className="text-sand/45">({(1/mPx).toFixed(2)} px/m)</span></span></>
                                                  )}
                                                </div>
                                              </div>
                                            )
                                          })}
                                          {/* Unmatched images (no room key) */}
                                          {(roomImgMap.get('__other__') ?? []).length > 0 && (
                                            <div className="hide-scroll flex gap-2 overflow-x-auto">
                                              {roomImgMap.get('__other__')!.map((img) => (
                                                <a key={`${img.filename}|${img.url}`} href={img.url} target="_blank" rel="noreferrer"
                                                  className="relative h-20 w-28 shrink-0 overflow-hidden rounded border border-[#FF9F0F]/20 bg-black/40 shadow-sm transition hover:border-[#FF9F0F]/40">
                                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                                  <img src={img.url} alt={img.filename} className="h-full w-full object-cover" />
                                                </a>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })
                                })()}
                              </div>
                            </div>
                          )}
                          </>
                        )}
                      </div>
                    )}
                  </section>
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
                                      onMouseEnter: (e: ReactMouseEvent<HTMLDivElement>) => {
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
                                setProjDraftStatuses(projAppliedStatuses)
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
                          <div
                            key={proj.id}
                            className={`relative flex min-h-[min(7.5rem,18vh)] flex-col overflow-hidden rounded-md border border-black/40 bg-coffee-750/95 pl-3 pr-3 pt-2.5 pb-2.5 shadow-soft transition ${proj.isDeleted ? 'opacity-[0.88]' : ''} hover:border-caramel hover:bg-coffee-700/95`}
                            style={{
                              borderLeftWidth: 4,
                              borderLeftColor: proj.isDeleted ? '#52525b' : '#FF9F0F',
                            }}
                          >
                            {usingLiveProjects && proj.isLiveRow && proj.isDeleted && selectedOrgId ? (
                              <button
                                type="button"
                                className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-red-500/35 bg-red-500/10 text-red-200/90 transition hover:border-red-400/50 hover:bg-red-500/20"
                                title="Permanently remove from database and storage (cannot be undone)"
                                disabled={permanentDeletingId === proj.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (
                                    !window.confirm(
                                      'Permanently delete this offer? This removes the database row and all uploaded files. This cannot be undone.',
                                    )
                                  ) {
                                    return
                                  }
                                  setPermanentDeletingId(proj.id)
                                  void (async () => {
                                    try {
                                      await adminPermanentlyDeleteOffer(selectedOrgId, proj.id)
                                      setTenantOffers((prev) => prev.filter((x) => x.id !== proj.id))
                                      if (selectedProjectRef === proj.id) setSelectedProjectRef(null)
                                    } catch (err) {
                                      window.alert(
                                        err instanceof Error ? err.message : 'Permanent delete failed.',
                                      )
                                    } finally {
                                      setPermanentDeletingId(null)
                                    }
                                  })()
                                }}
                                aria-label="Permanently delete offer"
                              >
                                <Trash2 size={14} className="shrink-0" />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setSelectedProjectRef(proj.id)}
                              className="flex w-full min-h-0 flex-1 flex-col text-left"
                            >
                              <div className="flex items-start justify-between gap-2 pr-6">
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
                          </div>
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
            <div className="hide-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
              <label className="block shrink-0">
                <span className="wiz-label">Title</span>
                <input
                  type="text"
                  value={pushTitle}
                  onChange={(e) => { setPushTitle(e.target.value); setPushSaved(false); setPushError(null) }}
                  placeholder="Update title…"
                  className="sun-input"
                />
              </label>
              <label className="flex min-h-0 shrink-0 flex-col">
                <span className="wiz-label">Message</span>
                <textarea
                  rows={6}
                  value={pushMessage}
                  onChange={(e) => { setPushMessage(e.target.value); setPushSaved(false); setPushError(null) }}
                  placeholder="Describe the update…"
                  className="sun-textarea min-h-[100px] resize-none"
                />
              </label>
              {/* Image upload */}
              <div className="shrink-0">
                <span className="wiz-label mb-1.5 block">Image <span className="font-normal text-sand/45">(optional)</span></span>
                <input
                  ref={pushImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageUpload(f) }}
                />
                {pushImageUrl ? (
                  <div className="relative overflow-hidden rounded-lg border border-white/15">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pushImageUrl} alt="Preview" className="h-28 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPushImageUrl(null)}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 hover:text-white transition"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => pushImageInputRef.current?.click()}
                    disabled={pushImageUploading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black/20 py-3 text-xs text-sand/60 hover:border-[#FF9F0F]/40 hover:text-sand/90 transition disabled:opacity-50"
                  >
                    <Sparkles size={13} className="text-[#FFB84D]" />
                    {pushImageUploading ? 'Uploading…' : 'Upload image'}
                  </button>
                )}
              </div>
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
                Target: {audienceMode === 'all' || pushTargetTenantIds.length === 0
                  ? 'All users'
                  : pushTargetTenantIds.length === 1
                    ? (clientOrgs.find((o) => o.id === pushTargetTenantIds[0])?.name ?? pushTargetTenantIds[0])
                    : `${pushTargetTenantIds.length} organizations`}
              </div>
              {pushError && (
                <div className="rounded-lg border border-red-500/35 bg-red-500/10 px-2.5 py-2 text-xs text-red-300">{pushError}</div>
              )}
              {pushSaved && (
                <div className="rounded-lg border border-green-500/35 bg-green-500/10 px-2.5 py-2 text-xs text-green-300">Update pushed successfully!</div>
              )}
              <div className="shrink-0 space-y-2 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={handleInstantlyPush}
                  disabled={pushSaving}
                  className="w-full rounded-xl border border-[#FF9F0F]/45 bg-linear-to-b from-[#e08414] to-[#f79116] py-2.5 text-white font-bold inline-flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(255,159,15,.25)] hover:brightness-110 transition disabled:opacity-60"
                >
                  <Send size={15} />
                  {pushSaving ? 'Pushing…' : 'Instantly Push'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPushError(null); setScheduleOpen(true) }}
                  className="w-full rounded-xl border border-white/20 bg-black/20 py-2.5 text-sand font-semibold inline-flex items-center justify-center gap-2 hover:border-[#FF9F0F]/45 hover:text-white transition"
                >
                  <Clock3 size={15} />
                  Schedule Push
                </button>
              </div>
              {adminAnnouncements.length > 0 && (
                <div className="shrink-0 space-y-1.5 border-t border-white/10 pt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-sand/50">Recent</div>
                  {adminAnnouncements.slice(0, 5).map((ann) => (
                    <div key={ann.id} className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-sand/90">{ann.title}</div>
                        <div className="mt-0.5 text-[10px] text-sand/50">
                          {ann.scheduled_at
                            ? `Scheduled · ${new Date(ann.scheduled_at).toLocaleDateString('de-DE')}`
                            : new Date(ann.created_at).toLocaleDateString('de-DE')}
                          {' · '}{ann.audience_mode === 'all' ? 'All' : 'Specific'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="shrink-0 text-sand/40 hover:text-red-400 transition"
                        title="Delete"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Site Banner ── */}
              <div className="shrink-0 border-t border-white/10 pt-4">
                <div className="mb-3 flex items-center gap-2 text-sand font-semibold">
                  <span className="text-[#FFB84D]">▬</span>
                  Site Banner
                </div>
                <div className="space-y-3">
                  <div
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 cursor-pointer"
                    onClick={async () => {
                      const next = !bannerVisible
                      setBannerVisible(next)
                      await handleSaveBanner({ is_visible: next })
                    }}
                  >
                    <span className="text-xs font-medium text-sand/80">Visible for users</span>
                    <div className={[
                      'relative h-6 w-11 rounded-full transition-colors duration-200 shrink-0',
                      bannerVisible ? 'bg-[#FF9F0F]' : 'bg-white/25',
                    ].join(' ')}>
                      <span className={[
                        'absolute top-1 h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200',
                        bannerVisible ? 'translate-x-6' : 'translate-x-1',
                      ].join(' ')} />
                    </div>
                  </div>
                  <label className="block">
                    <span className="wiz-label">Message</span>
                    <textarea
                      rows={3}
                      value={bannerMessage}
                      onChange={(e) => { setBannerMessage(e.target.value); setBannerSaved(false) }}
                      placeholder="Message visible to all users…"
                      className="sun-textarea min-h-[64px] resize-none"
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-sand/70">
                      <span>Color</span>
                      <input
                        type="color"
                        value={bannerColor}
                        onChange={(e) => { setBannerColor(e.target.value); setBannerSaved(false) }}
                        className="h-7 w-10 cursor-pointer rounded border border-white/20 bg-transparent p-0.5"
                      />
                    </label>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => handleSaveBanner()}
                      disabled={bannerSaving}
                      className="rounded-lg bg-[#FF9F0F]/25 border border-[#FF9F0F]/45 px-3 py-1.5 text-xs font-semibold text-[#FFD29A] transition hover:bg-[#FF9F0F]/35 disabled:opacity-50"
                    >
                      {bannerSaving ? 'Saving…' : bannerSaved ? '✓ Saved' : 'Save banner'}
                    </button>
                  </div>
                  {bannerVisible && bannerMessage.trim() && (
                    <div
                      className="rounded-lg px-3 py-2 text-center text-xs font-medium text-white"
                      style={{ backgroundColor: bannerColor }}
                    >
                      {bannerMessage}
                    </div>
                  )}
                </div>
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
                  {selectedOrgProject.isLiveRow && isOfferUuid(selectedOrgProject.id) ? (
                    <span className="mt-1 block text-[10px] text-sand/45">
                      Same signed URLs as in the customer dashboard (export API).
                    </span>
                  ) : null}
                </p>
                {selectedOrgProject.isLiveRow && isOfferUuid(selectedOrgProject.id) ? (
                  <>
                    {projectExportAssets.loading ? (
                      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-center text-xs text-sand/60">
                        Loading export files…
                      </div>
                    ) : null}
                    {projectExportAssets.error && !projectExportAssets.loading ? (
                      <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200/95">
                        {projectExportAssets.error}
                      </div>
                    ) : null}
                    {!projectExportAssets.loading &&
                    !projectExportAssets.error &&
                    adminProjectDownloadFiles.length === 0 ? (
                      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-center text-[11px] text-sand/55">
                        No generated files in storage for this offer yet.
                      </div>
                    ) : null}
                    {adminProjectDownloadFiles.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        disabled={!f.url}
                        onClick={() => {
                          if (f.url) window.open(f.url, '_blank', 'noopener,noreferrer')
                        }}
                        className="group w-full rounded-xl border border-[#FF9F0F]/25 bg-black/20 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition hover:border-[#FF9F0F]/45 hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9F0F]/35 disabled:pointer-events-none disabled:opacity-40"
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-black/30">
                            {f.thumbKind === 'image' && f.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={f.url} alt="" className="h-full w-full object-cover" />
                            ) : f.thumbKind === 'pdf' && f.url ? (
                              <PdfThumbnail src={f.url} width={44} height={56} className="h-full w-full" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[8px] font-bold uppercase text-sand/50">
                                File
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="truncate text-sm font-semibold text-sand group-hover:text-white">{f.label}</div>
                            <div className="mt-0.5 text-[11px] text-sand/55">{f.hint}</div>
                            <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#FFB84D]">
                              <Download size={13} aria-hidden />
                              Open / download
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {[
                      { label: `Angebot_${selectedOrgProject.ref}.pdf`, hint: 'Client offer PDF (demo label)' },
                      { label: `Mengenermittlung_${selectedOrgProject.ref}.pdf`, hint: 'Quantities & takeoff (demo label)' },
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
                              Demo only
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
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
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOrgEditMode((v) => !v)}
                    className="rounded-md border border-white/20 bg-black/20 px-2.5 py-1 text-xs font-semibold text-sand/85 hover:border-[#FF9F0F]/45"
                  >
                    {orgEditMode ? 'Cancel edit' : 'Edit organization'}
                  </button>
                  {orgEditMode ? (
                    <button
                      type="button"
                      onClick={saveOrganizationData}
                      disabled={orgSaving}
                      className="rounded-md border border-[#FF9F0F]/45 bg-[#FF9F0F]/25 px-2.5 py-1 text-xs font-semibold text-[#FFD29A] disabled:opacity-50"
                    >
                      {orgSaving ? 'Saving…' : 'Save'}
                    </button>
                  ) : null}
                </div>
                {orgError ? (
                  <div className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200/95">{orgError}</div>
                ) : null}
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
                      {orgEditMode ? (
                        <input
                          value={orgDraftBranding.phone}
                          onChange={(e) => setOrgDraftBranding((p) => ({ ...p, phone: e.target.value }))}
                          className="sun-input h-7 text-xs"
                        />
                      ) : (
                        selectedOrgMeta.phone
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sand/85">
                      <Mail size={12} className="shrink-0 text-[#FFB84D]" />
                      {orgEditMode ? (
                        <input
                          value={orgDraftBranding.email}
                          onChange={(e) => setOrgDraftBranding((p) => ({ ...p, email: e.target.value }))}
                          className="sun-input h-7 text-xs"
                        />
                      ) : (
                        selectedOrgMeta.email
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sand/85">
                      <FolderKanban size={12} className="shrink-0 text-[#FFB84D]" />
                      {orgEditMode ? (
                        <input
                          value={orgDraftBranding.address}
                          onChange={(e) => setOrgDraftBranding((p) => ({ ...p, address: e.target.value }))}
                          className="sun-input h-7 text-xs"
                        />
                      ) : (
                        selectedOrgMeta.address
                      )}
                    </div>
                    {(orgEditMode || (liveWorkspace && liveWorkspace.branding.website.trim() !== '')) && (
                      <div className="flex items-center gap-2 text-sand/85">
                        <Globe size={12} className="shrink-0 text-[#FFB84D]" />
                        {orgEditMode ? (
                          <input
                            value={orgDraftBranding.website}
                            onChange={(e) => setOrgDraftBranding((p) => ({ ...p, website: e.target.value }))}
                            className="sun-input h-7 text-xs"
                          />
                        ) : (
                          <span className="truncate">{liveWorkspace?.branding.website}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#FF9F0F]/25 bg-black/20 p-2.5">
                  <div className="mb-2 text-sm font-semibold text-sand">Run quota</div>
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
                    disabled={!liveWorkspace}
                    onClick={() => setTokensModalOpen(true)}
                    className="w-full rounded-xl border border-[#FF9F0F]/45 bg-linear-to-b from-[#e08414] to-[#f79116] py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(255,159,15,.25)] transition hover:brightness-110 inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Coins size={15} />
                    Grant extra runs
                  </button>
                </div>

                <div className="rounded-xl border border-[#FF9F0F]/25 bg-black/20 p-2.5">
                  <div className="mb-2 text-sm font-semibold text-sand">Users</div>
                  <p className="mb-2 text-[11px] text-sand/55">
                    {liveWorkspace
                      ? 'Live directory from the database. Click a member to update name and role.'
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
                      onClick={() => setOrgProfilePopupOpen(true)}
                      className="w-full rounded-xl border border-[#FF9F0F]/45 bg-linear-to-b from-[#e08414] to-[#f79116] py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(255,159,15,.25)] transition hover:brightness-110 inline-flex items-center justify-center gap-2"
                    >
                      <Building2 size={15} className="text-white" />
                      Open organization profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!liveWorkspace) {
                          setOrgError('Permissions are available only for live organizations.')
                          return
                        }
                        setPermissionsModalOpen(true)
                      }}
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
                className="admin-scroll fixed z-[9999] max-h-[min(520px,calc(100vh-16px))] w-[292px] overflow-y-auto overflow-x-hidden rounded-2xl border border-white/20 bg-coffee-850/95 pr-1 shadow-2xl shadow-black/30 backdrop-blur-sm"
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
                <div className="border-t border-white/10 px-3 pb-3 pt-2">
                  <div className="mb-1 text-[11px] font-semibold text-sand/70">Project status</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['Running', 'Queued', 'Completed', 'Failed', 'Cancelled'] as const).map((st) => {
                      const active = projDraftStatuses.includes(st)
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() =>
                            setProjDraftStatuses((prev) =>
                              prev.includes(st) ? prev.filter((x) => x !== st) : [...prev, st],
                            )
                          }
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${
                            active
                              ? 'border-[#FF9F0F]/70 bg-[#FF9F0F]/20 text-[#FFD29A]'
                              : 'border-white/15 bg-black/20 text-sand/75'
                          }`}
                        >
                          {st}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {typeof document !== 'undefined' &&
        projectEditorModalOpen &&
        selectedOrgProject &&
        createPortal(
          <div
            className="fixed inset-0 z-[10070] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setProjectEditorModalOpen(false)}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Editor snapshots"
              className="flex max-h-[min(96vh,1200px)] w-full max-w-[min(1600px,98vw)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#352A22]/96 shadow-2xl backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="min-w-0 text-sm font-semibold text-white/90">
                  <span className="truncate">Editor snapshots</span>
                  <span className="mt-0.5 block font-mono text-xs font-normal text-[#FFD29A]/90">
                    {selectedOrgProject.ref}
                  </span>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg px-3 py-1 text-lg leading-none text-white/75 transition hover:bg-white/10"
                  onClick={() => setProjectEditorModalOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 space-y-12">
                {projectEditorSnapshots.status === 'ok' ? (
                  <>
                    {projectEditorSnapshots.blueprint_groups.length ? (
                      <div className="space-y-4">
                        <div className="text-sm font-semibold text-[#FFD29A]">{editorLabelEn('detections_review')}</div>
                        <div className="space-y-10">
                          {projectEditorSnapshots.blueprint_groups.map((group, gi) => (
                            <div
                              key={`${group.plan_id ?? 'plan'}-${group.created_at}-${gi}`}
                              className="rounded-xl border border-white/12 bg-black/30 px-3 py-4 sm:px-5 sm:py-5"
                            >
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-sand/60">
                                <span className="font-mono text-[#FFD29A]/85">{group.plan_id ?? 'Plan'}</span>
                                <span>{formatEnDateTime(group.created_at)}</span>
                              </div>
                              <AdminBlueprintSnapshotPanel
                                group={group}
                                panelResetKey={`${group.plan_id ?? 'plan'}-${group.created_at}-${gi}`}
                                maxHeightClass="max-h-[min(86vh,960px)]"
                              />
                              <p className="mt-3 text-center text-[10px] text-sand/45">
                                Bifează mai multe straturi simultan (ex. Camere + Uși); ordinea de desen: bază → camere →
                                uși → demolări acoperiș → scări.
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {projectEditorSnapshots.blueprint_groups.length === 0 &&
                    projectEditorSnapshots.roof_items.length > 0 ? (
                      <div className="space-y-4">
                        <div className="text-sm font-semibold text-[#FFD29A]">{editorLabelEn('roof')}</div>
                        {projectEditorSnapshots.roof_items.length ? (
                          <div className="rounded-xl border border-white/12 bg-black/30 px-3 py-4 sm:px-5 sm:py-5">
                            <AdminRoofSnapshotsPanel
                              items={projectEditorSnapshots.roof_items}
                              maxHeightClass="max-h-[min(86vh,960px)]"
                            />
                          </div>
                        ) : (
                          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-center text-[11px] text-sand/55">
                            Nu există încă imagini din editorul de acoperiș în Storage pentru această ofertă (apar
                            după ce utilizatorul salvează în pasul roof review).
                          </div>
                        )}
                      </div>
                    ) : null}
                    {projectEditorSnapshots.blueprint_groups.length === 0 &&
                    projectEditorSnapshots.roof_items.length === 0 &&
                    projectEditorSnapshots.items.length > 0 ? (
                      <div className="space-y-4">
                        <div className="text-sm font-semibold text-[#FFD29A]">Editor files (legacy)</div>
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                          {projectEditorSnapshots.items.map((img) => (
                            <a
                              key={img.id}
                              href={img.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group overflow-hidden rounded-xl border border-white/15 bg-black/25 transition hover:border-[#FF9F0F]/40"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img.url}
                                alt={img.filename}
                                className="max-h-[min(80vh,880px)] w-full object-contain bg-black/20"
                              />
                              <div className="truncate border-t border-black/40 bg-black/50 px-2 py-1.5 text-[10px] text-sand/80">
                                {editorLabelEn(img.editor)} · {img.filename}
                                {img.plan_id ? ` · ${img.plan_id}` : ''}
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {projectEditorSnapshots.blueprint_groups.length === 0 &&
                    projectEditorSnapshots.roof_items.length === 0 &&
                    projectEditorSnapshots.items.length === 0 ? (
                      <div className="py-10 text-center text-sm text-white/60">No snapshot data.</div>
                    ) : null}
                  </>
                ) : (
                  <div className="py-10 text-center text-sm text-white/60">No snapshot data.</div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {moatPopup ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="flex w-full max-w-5xl flex-col rounded-2xl border border-white/15 bg-coffee-850 shadow-2xl" style={{ maxHeight: '90vh' }}>
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-base font-semibold text-sand">{moatPopup.title}</div>
                <div className="mt-0.5 text-xs text-sand/50">
                  {moatPopup.markedPlans.toLocaleString('en-US')} marked plans · {moatPopup.artifacts.toLocaleString('en-US')} artifacts
                </div>
              </div>
              <div className="flex items-center gap-2">
                {moatDetectionsData.status === 'ok' && moatDetectionsData.plans.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const all = moatDetectionsData.plans.map((p) => extractMoatSectionJson(p, moatPopup.key))
                      downloadJsonFile({ section: moatPopup.key, total_plans: all.length, plans: all }, `${moatPopup.key}_all_offers.json`)
                    }}
                    className="rounded-md border border-[#FF9F0F]/45 bg-[#FF9F0F]/15 px-3 py-1.5 text-xs font-semibold text-[#FFD29A] transition hover:bg-[#FF9F0F]/25"
                  >
                    ↓ Export all JSON
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-md px-2 py-1.5 text-sm text-sand/70 hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setMoatPopup(null)
                    setMoatDetectionsData({ status: 'idle', plans: [], blueprintImages: {}, wallMaskUrls: {}, sourceOfferId: null })
                    setMoatFiles({ status: 'idle', bySection: {}, sourceOfferId: null })
                    setMoatRuns({ status: 'idle', runs: [], tenantId: null })
                    setMoatSelectedRunId(null)
                    setMoatSegData({ status: 'idle', offerId: null, docs: [] })
                    moatDetectionsLoadingRef.current = null
                    moatFilesLoadingRef.current = null
                    moatRunsLoadingRef.current = null
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Section tabs */}
            <div className="hide-scroll flex shrink-0 gap-1.5 overflow-x-auto border-b border-white/10 px-4 py-2.5">
              {dataMoatRows.map((row) => {
                const active = row.key === moatPopup.key
                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setMoatPopup({ key: row.key, title: row.title, markedPlans: row.markedPlans, artifacts: row.artifacts })}
                    className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                      active
                        ? 'border-[#FF9F0F]/55 bg-[#FF9F0F]/18 text-[#FFD29A]'
                        : 'border-white/10 bg-black/20 text-sand/70 hover:border-[#FF9F0F]/30 hover:text-sand'
                    }`}
                  >
                    {row.title}
                  </button>
                )
              })}
            </div>

            {/* Run selector */}
            <div className="hide-scroll flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-white/10 px-4 py-2">
              {moatRuns.status === 'loading' ? (
                <span className="flex items-center gap-1.5 text-xs text-sand/40">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sand/20 border-t-sand/60" />
                  Loading runs…
                </span>
              ) : moatRuns.status === 'ok' && moatRuns.runs.length > 0 ? (
                moatRuns.runs.map((run) => {
                  const isActive = run.run_id === moatSelectedRunId
                  const date = new Date(run.created_at)
                  const dateStr = `${date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })} ${date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`
                  return (
                    <button
                      key={run.run_id}
                      type="button"
                      onClick={() => setMoatSelectedRunId(run.run_id)}
                      className={`shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-medium transition ${
                        isActive
                          ? 'border-emerald-500/55 bg-emerald-500/15 text-emerald-300'
                          : 'border-white/10 bg-black/20 text-sand/60 hover:border-white/25 hover:text-sand'
                      }`}
                    >
                      <span className="font-mono">{dateStr}</span>
                      <span className="ml-1.5 text-sand/35">#{run.offer_id.slice(0, 6)}</span>
                    </button>
                  )
                })
              ) : moatRuns.status === 'ok' ? (
                <span className="text-xs text-sand/35">No runs found</span>
              ) : null}
              {/* Refresh button */}
              <button
                type="button"
                title="Refresh runs"
                onClick={() => {
                  moatRunsLoadingRef.current = null
                  setMoatRuns({ status: 'idle', runs: [], tenantId: null })
                  setMoatSelectedRunId(null)
                  setMoatSegData({ status: 'idle', offerId: null, docs: [] })
                  setMoatRunsRefreshToken((t) => t + 1)
                }}
                className="ml-auto shrink-0 rounded border border-white/10 px-2 py-0.5 text-[10px] text-sand/40 transition hover:border-white/25 hover:text-sand/70"
              >
                ↻ Refresh
              </button>
            </div>

            {/* Content area */}
            {(() => {
              const selectedRun = moatRuns.runs.find((r) => r.run_id === moatSelectedRunId)
              // Section → which kinds from moatRuns to show
              const RUN_SECTION_KINDS: Record<string, string[]> = {
                plan_segmentation: ['segmentation_annotated', 'gemini_crop'],
                wall_detection:    ['cubicasa_step'],
                rooms_detection:   ['gemini_room_crop'],
              }
              const runKinds = RUN_SECTION_KINDS[moatPopup.key] ?? []
              const runImages: Array<{ id: string; url: string; filename: string; plan_id?: string; kind: string }> =
                selectedRun
                  ? runKinds.flatMap((k) => (selectedRun.sections[k] ?? []).map((img) => ({ ...img, kind: k })))
                  : []

              // Separate overview (cluster_preview) from crops (gemini_crop)
              const overviewImgs = runImages.filter((i) => i.kind === 'segmentation_annotated')
              const cropImgs = runImages.filter((i) => i.kind === 'gemini_crop')

              const ImageCard = ({ img, label }: { img: typeof runImages[number]; label?: string }) => (
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <a href={img.url} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.filename} className="w-full rounded object-contain" style={{ maxHeight: '220px' }} />
                  </a>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      {label && <div className="text-[9px] font-semibold uppercase tracking-wide text-[#FF9F0F]/70">{label}</div>}
                      <div className="truncate text-[10px] text-sand/55">{img.filename}</div>
                      {img.plan_id && <div className="text-[9px] text-sand/35">{img.plan_id}</div>}
                    </div>
                    <a href={img.url} download={img.filename} target="_blank" rel="noreferrer"
                      className="shrink-0 rounded border border-[#FF9F0F]/30 px-1.5 py-0.5 text-[10px] font-medium text-[#FFD29A]/80 transition hover:border-[#FF9F0F]/55 hover:bg-[#FF9F0F]/10">
                      ↓ img
                    </a>
                  </div>
                </div>
              )

              return (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {moatRuns.status === 'loading' && runImages.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-sm text-sand/50">Loading runs…</div>
              ) : moatRuns.status === 'error' ? (
                <div className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200/90">{moatRuns.message}</div>
              ) : runImages.length > 0 ? (
                <div className="space-y-4">
                  {overviewImgs.length > 0 && (
                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-sand/40">Imaginea trimisă Gemini + poligoane coordonate</div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {overviewImgs.map((img) => <ImageCard key={img.id} img={img} />)}
                      </div>
                    </div>
                  )}
                  {cropImgs.length > 0 && (
                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-sand/40">
                        {moatPopup.key === 'plan_segmentation' ? 'Crop-uri din coordonatele Gemini (etajele casei)' : 'Imagini'}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {cropImgs.map((img) => <ImageCard key={img.id} img={img} />)}
                      </div>
                    </div>
                  )}
                  {/* For plan_segmentation: remaining non-annotated, non-crop images */}
                  {moatPopup.key === 'plan_segmentation' && runImages.filter(i => i.kind !== 'segmentation_annotated' && i.kind !== 'gemini_crop').length > 0 && (
                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-sand/40">Alte imagini</div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {runImages.filter(i => i.kind !== 'segmentation_annotated' && i.kind !== 'gemini_crop').map((img) => <ImageCard key={img.id} img={img} />)}
                      </div>
                    </div>
                  )}
                </div>
              ) : moatPopup.key === 'plan_segmentation' ? (
                /* plan_segmentation fallback: local disk via moatSegData */
                moatSegData.status === 'loading' ? (
                  <div className="flex items-center justify-center py-12 text-sm text-sand/50">
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-sand/20 border-t-sand/60" />
                    Loading segmentation data…
                  </div>
                ) : moatSegData.docs.length > 0 ? (
                  <div className="space-y-6">
                    {moatSegData.docs.map((doc) => (
                      <div key={doc.doc_id} className="space-y-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-sand/40">{doc.doc_id}</div>
                          <button
                            type="button"
                            onClick={() => downloadJsonFile({ doc_id: doc.doc_id, crops: doc.crops }, `segmentation_${doc.doc_id.slice(0, 20)}.json`)}
                            className="rounded border border-[#FF9F0F]/40 px-2 py-0.5 text-[10px] font-semibold text-[#FFD29A]/80 transition hover:border-[#FF9F0F]/65 hover:bg-[#FF9F0F]/10"
                          >↓ crop_labels.json</button>
                        </div>
                        {doc.source_url && (
                          <div>
                            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-sand/35">Imaginea trimisă Gemini</div>
                            <AuthImage src={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}${doc.source_url}`} alt="solidified source" className="max-h-48 w-full rounded border border-white/10 object-contain" />
                          </div>
                        )}
                        <div>
                          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-sand/35">Crop-uri (etajele casei)</div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {doc.crops.map((crop) => (
                              <div key={crop.file} className="rounded-lg border border-white/10 bg-black/20 p-2">
                                <AuthImage src={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}${crop.image_url ?? ''}`} alt={crop.file} className="w-full rounded object-contain" style={{ maxHeight: '200px' }} />
                                <div className="mt-1.5 space-y-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="truncate text-[10px] font-medium text-sand/70">{crop.raw_label || crop.file}</div>
                                    <span className="shrink-0 text-[9px] text-sand/35">{crop.file}</span>
                                  </div>
                                  {crop.box_2d && (
                                    <div className="rounded bg-black/30 px-1.5 py-1 font-mono text-[9px] text-sand/50">
                                      <span className="mr-1 text-[#FF9F0F]/60">box_2d</span>[{(crop.box_2d as number[]).map((v) => v.toFixed(1)).join(', ')}]
                                      {crop.image_size && <span className="ml-1.5 text-sand/30">{(crop.image_size as number[])[0]}×{(crop.image_size as number[])[1]}</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-sm text-sand/40">
                    <div>Nu există date de segmentare pentru această rulare.</div>
                    <div className="mt-1 text-xs text-sand/25">Rulează engine-ul pentru a genera date noi. Datele noi sunt salvate în Supabase.</div>
                  </div>
                )
              ) : moatRuns.status === 'ok' && moatRuns.runs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-sm text-sand/40">
                  <div>Nu există rulări înregistrate pentru acest tenant.</div>
                  <div className="mt-1 text-xs text-sand/25">Rulările apar după ce engine-ul procesează un proiect.</div>
                </div>
              ) : !selectedRun ? (
                <div className="flex items-center justify-center py-12 text-sm text-sand/40">Selectează o rulare.</div>
              ) : moatFiles.status === 'error' ? (
                <div className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200/90">
                  {moatFiles.message ?? 'Could not load data.'}
                </div>
              ) : moatDetectionsData.status === 'ok' && moatDetectionsData.plans.length > 0 ? (
                /* Vector overlay cards — one per plan */
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {moatDetectionsData.plans.map((plan) => {
                    const overlayLayers = MOAT_SECTION_OVERLAY_LAYERS[moatPopup.key] ?? []
                    const isWallDetection = moatPopup.key === 'wall_detection'
                    const featCount = getMoatFeatureCount(plan, moatPopup.key)

                    // Blueprint base image from editor snapshots
                    const bpUrl =
                      (plan.planId ? moatDetectionsData.blueprintImages[`${plan.offerId}_${plan.planId}`] : undefined) ??
                      (plan.planId ? moatDetectionsData.blueprintImages[plan.planId] : undefined) ??
                      moatDetectionsData.blueprintImages[`_idx_${plan.planIndex}`] ??
                      ''

                    // Wall mask image URL (served via auth-gated endpoint from engine disk)
                    const wallMaskUrl =
                      (plan.planId ? moatDetectionsData.wallMaskUrls[`${plan.offerId}_${plan.planId}`] : undefined) ??
                      moatDetectionsData.wallMaskUrls[`_idx_${plan.planIndex}`] ??
                      ''

                    // Gemini crop images for plan_segmentation
                    const segImgs = moatFiles.bySection['plan_segmentation'] ?? []

                    return (
                      <div key={plan.planIndex} className="rounded-lg border border-white/10 bg-black/20 p-2">
                        {/* Blueprint + overlay stack */}
                        <div
                          className="relative w-full overflow-hidden rounded bg-black/30"
                          style={{
                            aspectRatio:
                              plan.imageWidth > 0 && plan.imageHeight > 0
                                ? `${plan.imageWidth} / ${plan.imageHeight}`
                                : '4 / 3',
                          }}
                        >
                          {isWallDetection ? (
                            // Wall detection: blueprint underneath + wall mask as colorized overlay.
                            // Wall mask is white-on-black → mix-blend-mode:screen makes black transparent;
                            // CSS filter colorizes white walls to cyan/orange.
                            <>
                              {bpUrl ? (
                                <AuthImage src={bpUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
                              ) : null}
                              {wallMaskUrl ? (
                                <AuthImage
                                  src={wallMaskUrl}
                                  alt=""
                                  className="absolute inset-0 h-full w-full object-contain"
                                  style={{ mixBlendMode: 'screen', filter: 'sepia(1) saturate(10) hue-rotate(160deg) brightness(1.3)', opacity: 0.9 }}
                                />
                              ) : (
                                // Fallback: room outlines as wall proxy
                                (() => {
                                  const proxyUrl = buildWallProxyOverlay(plan)
                                  return proxyUrl ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={proxyUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
                                  ) : !bpUrl ? (
                                    <div className="absolute inset-0 flex items-center justify-center text-xs text-sand/30">No wall data</div>
                                  ) : null
                                })()
                              )}
                            </>
                          ) : moatPopup.key === 'plan_segmentation' ? (
                            // Plan segmentation: show the Gemini-segmented image for this plan
                            // (gemini_crop images = the images Gemini analyzed with percentage bboxes).
                            // The blueprint is the base; segmentation crops show what Gemini found.
                            <>
                              {bpUrl ? (
                                <AuthImage src={bpUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
                              ) : segImgs[plan.planIndex]?.url ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={segImgs[plan.planIndex].url} alt="" className="absolute inset-0 h-full w-full object-contain" />
                              ) : null}
                              {/* Room + opening detection overlay (Gemini-identified regions) */}
                              {overlayLayers.map((layer) => {
                                const url = buildOverlayDataUrl(plan, layer)
                                return url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img key={layer} src={url} alt="" className="absolute inset-0 h-full w-full object-contain" />
                                ) : null
                              })}
                              {!bpUrl && !segImgs[plan.planIndex]?.url && (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-sand/30">No segmentation image</div>
                              )}
                            </>
                          ) : (
                            // All other sections: blueprint + SVG overlay layers
                            <>
                              {bpUrl && (
                                <AuthImage src={bpUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
                              )}
                              {overlayLayers.map((layer) => {
                                const url = buildOverlayDataUrl(plan, layer)
                                return url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img key={layer} src={url} alt="" className="absolute inset-0 h-full w-full object-contain" />
                                ) : null
                              })}
                              {!bpUrl && overlayLayers.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-sand/30">No preview</div>
                              )}
                            </>
                          )}
                        </div>

                        {/* For plan_segmentation: show the individual Gemini crop images below the blueprint */}
                        {moatPopup.key === 'plan_segmentation' && segImgs.length > 0 && (
                          <div className="mt-2 border-t border-white/5 pt-2">
                            <div className="mb-1 text-[10px] font-medium text-sand/45">Gemini crops ({segImgs.length})</div>
                            <div className="hide-scroll flex gap-1.5 overflow-x-auto pb-0.5">
                              {segImgs.map((img) => (
                                <a key={img.id} href={img.url} target="_blank" rel="noreferrer" className="shrink-0">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={img.url} alt={img.filename} className="h-14 w-14 rounded object-cover border border-white/10 hover:border-[#FF9F0F]/40 transition" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Card footer */}
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] text-sand/60">
                              {featCount > 0 ? `${featCount} feature${featCount !== 1 ? 's' : ''}` : 'No features'}
                            </div>
                            <div className="truncate text-[9px] text-sand/35" title={plan.offerId}>
                              {plan.offerId.slice(0, 8)}…
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const data = extractMoatSectionJson(plan, moatPopup.key)
                              downloadJsonFile(data, `${moatPopup.key}_${plan.offerId.slice(0, 8)}.json`)
                            }}
                            className="shrink-0 rounded border border-[#FF9F0F]/30 px-1.5 py-0.5 text-[10px] font-medium text-[#FFD29A]/80 transition hover:border-[#FF9F0F]/55 hover:bg-[#FF9F0F]/10"
                          >
                            ↓ JSON
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : moatSectionFiles.length > 0 ? (
                /* Pre-rendered detection images from Supabase storage (reliable for all offers) */
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {moatSectionFiles.map((img) => (
                    <div key={img.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                      <a href={img.url} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.filename} className="w-full rounded object-contain" style={{ maxHeight: '240px' }} />
                      </a>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="truncate text-[10px] text-sand/55">{img.filename}</div>
                        <a
                          href={img.url}
                          download={img.filename}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded border border-[#FF9F0F]/30 px-1.5 py-0.5 text-[10px] font-medium text-[#FFD29A]/80 transition hover:border-[#FF9F0F]/55 hover:bg-[#FF9F0F]/10"
                        >
                          ↓ img
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : moatSectionFiles.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {moatSectionFiles.map((img) => (
                    <div key={img.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                      <a href={img.url} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.filename} className="w-full rounded object-contain" style={{ maxHeight: '220px' }} />
                      </a>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="truncate text-[10px] text-sand/55">{img.filename}</div>
                        <a href={img.url} download={img.filename} target="_blank" rel="noreferrer"
                          className="shrink-0 rounded border border-[#FF9F0F]/30 px-1.5 py-0.5 text-[10px] font-medium text-[#FFD29A]/80 transition hover:border-[#FF9F0F]/55 hover:bg-[#FF9F0F]/10">
                          ↓ img
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-sand/40">
                  <div>Nu s-au găsit imagini pentru această secțiune în rularea selectată.</div>
                </div>
              )}
            </div>
              )
            })()}
          </div>
        </div>
      ) : null}

      {orgProfilePopupOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-6xl overflow-hidden rounded-2xl border border-white/15 bg-coffee-850 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="px-4 pt-3 text-base font-semibold text-sand">Organization profile · PDF preview page</div>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sand/70 hover:bg-white/10 hover:text-white"
                onClick={() => setOrgProfilePopupOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="h-[78vh] border-t border-white/10 bg-black/25">
              <iframe
                src="/dashboard/settings/angebotsanpassung"
                title="Organization profile preview"
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      ) : null}

      {permissionsModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-coffee-850 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-base font-semibold text-sand">Manage permissions</div>
              <button
                type="button"
                onClick={() => setPermissionsModalOpen(false)}
                className="text-sm text-sand/70 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-sand/55">Account plan</div>
                <SelectSun
                  value={String(permissionDraftTier)}
                  onChange={(v) => setPermissionDraftTier(Math.max(1, Math.min(4, Number(v) || 1)))}
                  options={SUBSCRIPTION_TIER_ADMIN_LABELS_DE.map((label, idx) => ({
                    value: String(idx + 1),
                    label,
                  }))}
                  placeholder="Select plan"
                />
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-sand/55">
                  Allowed offer types (create access)
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {ADMIN_PERMISSION_OFFER_TYPES.map((ot) => {
                    const active = permissionDraftOfferTypes.includes(ot.slug)
                    return (
                      <button
                        key={ot.slug}
                        type="button"
                        onClick={() =>
                          setPermissionDraftOfferTypes((prev) =>
                            prev.includes(ot.slug) ? prev.filter((x) => x !== ot.slug) : [...prev, ot.slug],
                          )
                        }
                        className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                          active
                            ? 'border-[#FF9F0F]/70 bg-[#FF9F0F]/20 text-[#FFD29A]'
                            : 'border-white/15 bg-black/20 text-sand/80 hover:border-[#FF9F0F]/35'
                        }`}
                      >
                        {ot.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
              <button
                type="button"
                onClick={() => setPermissionsModalOpen(false)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-sand/85 hover:border-[#FF9F0F]/35"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={orgSaving || !liveWorkspace}
                onClick={() => {
                  if (!liveWorkspace) return
                  const cleaned = permissionDraftOfferTypes
                    .map((x) => x.trim())
                    .filter(Boolean) as Array<'mengenermittlung' | 'dachstuhl' | 'zubau_aufstockung' | 'aufstockung' | 'zubau' | 'einfamilienhaus'>
                  void (async () => {
                    try {
                      setOrgSaving(true)
                      setOrgError(null)
                      await updateAdminTenantWorkspace(selectedOrgId, {
                        usageTier: permissionDraftTier,
                        allowedOfferTypes: cleaned,
                      })
                      const ws = await fetchAdminTenantWorkspace(selectedOrgId)
                      setTenantWorkspace({ status: 'ok', data: ws, error: null, loadedForTenantId: selectedOrgId })
                      setPermissionsModalOpen(false)
                    } catch (e) {
                      setOrgError(e instanceof Error ? e.message : 'Could not update permissions.')
                    } finally {
                      setOrgSaving(false)
                    }
                  })()
                }}
                className="rounded-lg border border-[#FF9F0F]/45 bg-[#FF9F0F]/25 px-3 py-1.5 text-xs font-semibold text-[#FFD29A] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save permissions
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {customUsersOpen && (
        <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-coffee-850 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="text-base font-semibold text-sand">Select target organizations</div>
              <button type="button" onClick={() => setCustomUsersOpen(false)} className="text-sand/70 hover:text-white text-sm">Close</button>
            </div>
            <div className="p-4 space-y-2">
              <div className="text-xs text-sand/55 mb-3">Select one or more organizations to target. Leave empty to target all users.</div>
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                {clientOrgs.map((org) => {
                  const selected = pushTargetTenantIds.includes(org.id)
                  return (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => setPushTargetTenantIds((prev) =>
                        prev.includes(org.id) ? prev.filter((x) => x !== org.id) : [...prev, org.id]
                      )}
                      className={[
                        'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition',
                        selected
                          ? 'border-[#FF9F0F]/60 bg-[#FF9F0F]/12 text-[#FFD29A]'
                          : 'border-white/10 bg-black/20 text-sand/85 hover:border-[#FF9F0F]/30',
                      ].join(' ')}
                    >
                      <span className={[
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition',
                        selected ? 'border-[#FF9F0F]/70 bg-[#FF9F0F]/30 text-[#FFD29A]' : 'border-white/20 bg-black/30 text-transparent',
                      ].join(' ')}>✓</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{org.name}</span>
                      {org.app_platform && (
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-white/8 text-sand/50">{org.app_platform}</span>
                      )}
                    </button>
                  )
                })}
              </div>
              {pushTargetTenantIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPushTargetTenantIds([])}
                  className="mt-1 text-xs text-sand/45 hover:text-sand/80 transition"
                >
                  Clear selection
                </button>
              )}
            </div>
            <div className="px-4 py-3 border-t border-white/10 flex justify-between items-center gap-2">
              <span className="text-xs text-sand/50">
                {pushTargetTenantIds.length === 0 ? 'No selection (all users)' : `${pushTargetTenantIds.length} selected`}
              </span>
              <div className="flex gap-2">
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
                <input type="time" className="sun-input py-2" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
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
                  {(['once', 'daily', 'weekly', 'monthly'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setScheduleRepeat(r)}
                      className={[
                        'rounded-md border px-3 py-1 text-xs transition',
                        scheduleRepeat === r
                          ? 'border-[#FF9F0F]/60 bg-[#FF9F0F]/18 text-[#FFD29A] font-semibold'
                          : 'border-white/15 bg-black/20 text-sand/85 hover:border-[#FF9F0F]/35',
                      ].join(' ')}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </label>
            </div>
            <div className="px-4 py-3 border-t border-white/10 flex justify-end gap-2">
              <button type="button" onClick={() => setScheduleOpen(false)} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-sand/85 hover:border-[#FF9F0F]/35">Cancel</button>
              <button type="button" onClick={handleSchedulePush} disabled={pushSaving} className="rounded-lg border border-[#FF9F0F]/45 bg-[#FF9F0F]/25 px-3 py-1.5 text-xs font-semibold text-[#FFD29A] disabled:opacity-60">
                {pushSaving ? 'Scheduling…' : 'Create schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {costPopupOpen && selectedOrgProject && (() => {
        const costCents = selectedOrgProject.latestRunCostCents ?? avgCostPerRunCents
        const eur = costCents != null ? costCents / 100 : null
        const meta = selectedOrgProject.latestRunCostMeta ?? null
        const source: string = typeof meta?.source === 'string' ? meta.source : 'unknown'
        const geminiUsage = (meta?.gemini_usage && typeof meta.gemini_usage === 'object' ? meta.gemini_usage : null) as Record<string, unknown> | null
        const calls = Array.isArray(geminiUsage?.calls) ? (geminiUsage!.calls as Array<Record<string, unknown>>) : []
        const wallSeconds = typeof meta?.wall_seconds === 'number' ? meta.wall_seconds : null
        const fallbackCents = typeof meta?.fallback_duration_cost_cents === 'number' ? meta.fallback_duration_cost_cents : null

        // Price per 1M tokens in USD — used as fallback when backend estimatedCostCents is absent.
        // Keys are lowercase model names without "models/" prefix. Costs stored/shown as USD¢.
        const MODEL_PRICE_PER_M: Record<string, { input: number; output: number }> = {
          'gemini-3-flash-preview': { input: 0.10,  output: 0.40  },
          'gemini-2.0-flash':       { input: 0.10,  output: 0.40  },
          'gemini-2.0-flash-lite':  { input: 0.075, output: 0.30  },
          'gemini-1.5-flash':       { input: 0.075, output: 0.30  },
          'gemini-1.5-flash-8b':    { input: 0.075, output: 0.30  },
          'gemini-1.5-pro':         { input: 1.25,  output: 5.00  },
          'gemini-2.5-pro':         { input: 1.25,  output: 10.00 },
        }

        // Helper: get per-call cost in USD¢.
        // Always recalculate from tokens when the model is in our local table (keeps costs
        // accurate even for old DB rows that were stored with outdated rates).
        // Fall back to stored estimatedCostCents only for unknown models.
        const getCallCostCents = (call: Record<string, unknown>): number | null => {
          if (call.ok !== true) return 0
          // Strip "models/" prefix that Gemini SDK sometimes prepends
          const model = String(call.model ?? '').toLowerCase().replace(/^models\//, '')
          const prices = MODEL_PRICE_PER_M[model]
          if (prices) {
            const usd = (Number(call.promptTokens ?? 0) / 1_000_000) * prices.input +
                        (Number(call.outputTokens ?? 0) / 1_000_000) * prices.output
            return usd * 100
          }
          // Unknown model — use stored value if available
          if (typeof call.estimatedCostCents === 'number') return call.estimatedCostCents
          return null
        }
        const successCount = calls.filter((c) => c.ok).length
        const totalCostCentsFromCalls = calls.reduce((s, c) => s + (getCallCostCents(c) ?? 0), 0)

        return (
          <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setCostPopupOpen(false)}>
            <div className="flex w-full max-w-lg flex-col rounded-2xl border border-white/15 bg-coffee-850 shadow-2xl" style={{ maxHeight: '82vh' }} onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-sand">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#FF9F0F]/45 bg-[#FF9F0F]/20 text-[12px] font-bold text-[#FFD29A]">$</span>
                  Cost breakdown — last run
                </div>
                <button type="button" onClick={() => setCostPopupOpen(false)} className="rounded p-1 text-sand/70 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              {/* Summary (non-scrollable) */}
              <div className="shrink-0 space-y-2 p-3">
                {/* Total */}
                <div className="flex items-center justify-between rounded-lg border border-[#FF9F0F]/25 bg-[#FF9F0F]/10 px-3 py-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-sand/60">Total cost</div>
                    <div className="text-[10px] text-sand/45">source: {source}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg font-bold text-[#FFD29A]">{formatCostCents(costCents)}</div>
                  </div>
                </div>
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                  <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-wide text-sand/45">Run time</div>
                    <div className="font-mono font-semibold text-sand/80">{wallSeconds != null ? `${wallSeconds.toFixed(1)} s` : '—'}</div>
                  </div>
                  <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-wide text-sand/45">API calls</div>
                    <div className="font-mono font-semibold text-sand/80">{calls.length > 0 ? `${successCount}/${calls.length} ok` : '—'}</div>
                  </div>
                  <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-wide text-sand/45">Total tokens</div>
                    <div className="font-mono font-semibold text-sand/80">
                      {typeof geminiUsage?.total_tokens === 'number' ? (geminiUsage.total_tokens as number).toLocaleString() : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-call table — scrollable */}
              {calls.length > 0 && (
                <div className="mx-3 mb-3 flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/20">
                  <div className="shrink-0 border-b border-white/10 px-3 py-1.5">
                    <div className="grid grid-cols-[1.5rem_1fr_auto_auto] gap-x-2 text-[9px] font-bold uppercase tracking-wide text-sand/45">
                      <span>#</span><span>Model</span><span>Tokens</span><span>Cost</span>
                    </div>
                  </div>
                  <div className="hide-scroll overflow-y-auto">
                    <div className="divide-y divide-white/[0.04]">
                      {calls.map((call, i) => {
                        const ok = call.ok === true
                        const model = String(call.model ?? '—').replace(/^models\//, '').replace('gemini-', '').replace('-preview', '★')
                        const totalT = Number(call.totalTokens ?? 0) || (Number(call.promptTokens ?? 0) + Number(call.outputTokens ?? 0))
                        const callCostCents = getCallCostCents(call)
                        return (
                          <div key={i} className={`grid grid-cols-[1.5rem_1fr_auto_auto] items-center gap-x-2 px-3 py-1 text-[10px] ${ok ? '' : 'opacity-40'}`}>
                            <span className="font-mono text-sand/35">{i + 1}</span>
                            <span className="flex items-center gap-1 truncate font-mono text-sand/75">
                              <span className={`text-[8px] ${ok ? 'text-green-400' : 'text-red-400'}`}>{ok ? '●' : '✗'}</span>
                              {model}
                            </span>
                            <span className="font-mono text-sand/55">{totalT > 0 ? totalT.toLocaleString() : '—'}</span>
                            <span className="font-mono font-semibold text-[#FFD29A]">
                              {callCostCents != null ? formatCostCents(callCostCents * 1) : '—'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {/* Footer totals */}
                  <div className="shrink-0 border-t border-white/10 px-3 py-1.5">
                    <div className="grid grid-cols-[1.5rem_1fr_auto_auto] items-center gap-x-2 text-[10px]">
                      <span />
                      <span className="font-semibold text-sand/70">{successCount} successful</span>
                      <span className="font-mono text-sand/55">
                        {typeof geminiUsage?.total_tokens === 'number' ? (geminiUsage.total_tokens as number).toLocaleString() : ''}
                      </span>
                      <span className="font-mono font-bold text-[#FFD29A]">{formatCostCents(totalCostCentsFromCalls)}</span>
                    </div>
                    <p className="mt-0.5 text-[8px] text-sand/30">
                      Rates (USD/1M): flash $0.075–0.10 input / $0.30–0.40 output · pro $1.25 input / $5–10 output · recalculated from tokens
                    </p>
                  </div>
                </div>
              )}

              {calls.length === 0 && (
                <div className="mx-3 mb-3 rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-xs text-sand/50">
                  No Gemini call data available for this run.
                  {source === 'compute-service' && ' Cost was estimated from run duration (fallback mode).'}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {tokensModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-coffee-850 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-base font-semibold text-sand">Grant extra runs</div>
              <button type="button" onClick={() => setTokensModalOpen(false)} className="text-sm text-sand/70 hover:text-white">
                Close
              </button>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-xs text-sand/65">
                Organization: <span className="font-medium text-sand/90">{selectedOrgMeta.companyName}</span>
              </p>
              <p className="text-xs text-sand/65">
                Remaining this month:{' '}
                <span className="font-semibold text-[#FFD29A]">{orgTokenBalanceDisplay}</span>
                </p>
              <p className="text-[11px] text-sand/45">
                Each run uses 1 token. Granting bonus runs decreases the used token count for this month.
              </p>
              <label className="block">
                <span className="wiz-label">Runs to grant</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={tokensAddAmount}
                  onChange={(e) => {
                    setTokensAddAmount(e.target.value.replace(/[^\d]/g, ''))
                  }}
                  className="sun-input"
                  placeholder="e.g. 1"
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
                disabled={orgSaving}
                onClick={() => {
                  const add = Math.max(0, parseInt(tokensAddAmount, 10) || 0)
                  if (add <= 0) {
                    setOrgError('Enter a number greater than 0.')
                    return
                  }
                  void (async () => {
                    try {
                      setOrgSaving(true)
                      setOrgError(null)
                      await updateAdminTenantWorkspace(selectedOrgId, { addTokens: add })
                      const ws = await fetchAdminTenantWorkspace(selectedOrgId)
                      setTenantWorkspace({ status: 'ok', data: ws, error: null, loadedForTenantId: selectedOrgId })
                      setTokensModalOpen(false)
                      setTokensAddAmount('1')
                    } catch (e) {
                      setOrgError(e instanceof Error ? e.message : 'Could not grant runs.')
                    } finally {
                      setOrgSaving(false)
                    }
                  })()
                }}
                className="rounded-lg border border-[#FF9F0F]/45 bg-[#FF9F0F]/25 px-3 py-1.5 text-xs font-semibold text-[#FFD29A] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {pipelineDetailsModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#FF9F0F]/30 bg-[#17120e] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FF9F0F]/15">
                  {pipelineDetailsModal === 'measurements' ? (
                    <Layers3 size={15} className="text-[#FFB84D]" />
                  ) : (
                    <Coins size={15} className="text-[#FFB84D]" />
                  )}
                </div>
                <div>
                  <div className="text-base font-semibold text-sand">
                    {pipelineDetailsModal === 'measurements' ? 'Extracted Measurements' : 'Pricing Breakdown'}
                  </div>
                  <div className="text-[11px] text-sand/45">
                    {pipelineDetailsModal === 'measurements'
                      ? `${(projectPipelineDetails.measurements_raw?.plans as unknown[] | undefined)?.length ?? 0} floor plans`
                      : (() => {
                          const totalEur = projectPipelineDetails.pricing_raw_per_plan.reduce((sum, p) => {
                            const v = (p.data as { total_cost_eur?: number }).total_cost_eur
                            return sum + (typeof v === 'number' ? v : 0)
                          }, 0)
                          return `${projectPipelineDetails.pricing_raw_per_plan.length} plan${projectPipelineDetails.pricing_raw_per_plan.length !== 1 ? 's' : ''} · Total ${totalEur > 0 ? `€${totalEur.toLocaleString('de-DE', { maximumFractionDigits: 0 })}` : '—'}`
                        })()}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPipelineDetailsModal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-sand/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="hide-scroll max-h-[74vh] overflow-y-auto p-5">
              {projectPipelineDetails.loading ? (
                <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-sand/60">Loading details…</div>
              ) : pipelineDetailsModal === 'measurements' ? (
                /* ── MEASUREMENTS ── */
                projectPipelineDetails.measurements_raw ? (
                  <div className="space-y-5">
                    {((projectPipelineDetails.measurements_raw.plans as Array<Record<string, unknown>>) ?? []).map((plan, pi) => {
                      const areas = (plan.areas ?? {}) as Record<string, unknown>
                      const walls = (areas.walls ?? {}) as Record<string, Record<string, unknown>>
                      const surfaces = (areas.surfaces ?? {}) as Record<string, unknown>
                      const openings = (plan.openings as Array<{ type: string; width_m: number; status: string }>) ?? []
                      const floorLabel = plan.floor_type === 'ground_floor' ? 'Ground Floor' : plan.floor_type === 'top_floor' ? 'Top Floor' : String(plan.floor_type ?? '')
                      const planLabel = String(plan.plan_id ?? `Plan ${pi + 1}`)
                        .replace('plan_0', 'Plan ')
                        .replace('_cluster_', ' · Cluster ')
                      const fmt = (v: unknown) => (v == null ? '—' : typeof v === 'number' ? v.toFixed(2) : String(v))
                      return (
                        <div key={String(plan.plan_id ?? pi)} className="rounded-xl border border-white/10 bg-black/25 overflow-hidden">
                          {/* Plan header */}
                          <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3">
                            <Building2 size={14} className="shrink-0 text-[#FFB84D]" />
                            <span className="text-sm font-semibold text-sand">{planLabel}</span>
                            <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${plan.is_ground_floor ? 'bg-emerald-500/20 text-emerald-300' : 'bg-sky-500/20 text-sky-300'}`}>
                              {floorLabel}
                            </span>
                          </div>
                          {(plan.error as string | undefined) ? (
                            <div className="px-4 py-3 text-sm text-red-400/90">{String(plan.error)}</div>
                          ) : (
                            <div className="divide-y divide-white/[0.06] p-4 space-y-4">
                              {/* Areas */}
                              <div>
                                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-sand/40">Floor Areas</div>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {[
                                    { label: 'Net Floor', val: `${fmt(areas.input_net_area_m2)} m²` },
                                    { label: 'Gross Floor', val: `${fmt(areas.input_gross_area_m2)} m²` },
                                    { label: 'Foundation', val: `${fmt(surfaces.foundation_m2)} m²` },
                                    { label: 'Floor Structure', val: `${fmt(surfaces.floor_structure_m2)} m²` },
                                    { label: 'Ceiling', val: `${fmt(surfaces.ceiling_m2)} m²` },
                                    { label: 'Wall Height', val: `${fmt(areas.wall_height_m)} m` },
                                  ].map(({ label, val }) => (
                                    <div key={label} className="rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2">
                                      <div className="text-[10px] text-sand/45 uppercase tracking-wide">{label}</div>
                                      <div className="mt-0.5 text-sm font-semibold text-[#FFD29A]">{val}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {/* Walls */}
                              {(walls.interior || walls.exterior) && (
                                <div className="pt-3">
                                  <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-sand/40">Walls</div>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {(['interior', 'exterior'] as const).map((side) => {
                                      const w = walls[side]
                                      if (!w) return null
                                      return (
                                        <div key={side} className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
                                          <div className="mb-2 text-[11px] font-semibold capitalize text-sand/70">{side} Walls</div>
                                          <div className="space-y-1">
                                            {[
                                              { label: 'Length', val: `${fmt(w.length_m)} m` },
                                              { label: 'Gross Area', val: `${fmt(w.gross_area_m2)} m²` },
                                              { label: 'Openings', val: `${fmt(w.openings_area_m2)} m²` },
                                              { label: 'Net Area', val: `${fmt(w.net_area_m2)} m²` },
                                            ].filter(({ val }) => !val.startsWith('—')).map(({ label, val }) => (
                                              <div key={label} className="flex items-center justify-between text-xs">
                                                <span className="text-sand/50">{label}</span>
                                                <span className="font-mono text-sand/85">{val}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                              {/* Openings */}
                              {openings.length > 0 && (
                                <div className="pt-3">
                                  <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-sand/40">Openings ({openings.length})</div>
                                  <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-black/20">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-white/[0.07] bg-white/[0.025]">
                                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-sand/40">Type</th>
                                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-sand/40">Status</th>
                                          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-sand/40">Width</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/[0.05]">
                                        {openings.map((op, oi) => (
                                          <tr key={oi}>
                                            <td className="px-3 py-2 capitalize text-sand/80">{op.type}</td>
                                            <td className="px-3 py-2">
                                              <span className={`rounded px-1.5 py-0.5 text-[10px] ${op.status === 'exterior' ? 'bg-sky-500/15 text-sky-300' : 'bg-white/10 text-sand/60'}`}>{op.status}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-sand/85">{op.width_m.toFixed(2)} m</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  /* fallback flat list */
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(projectPipelineDetails.measurements.length ? projectPipelineDetails.measurements : [{ key: 'No measurements found', value: '—' }]).map((row) => (
                      <div key={`${row.key}-${row.value}`} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                        <div className="text-[11px] uppercase tracking-wide text-sand/55">{row.key}</div>
                        <div className="mt-1 text-sm font-semibold text-[#FFD29A]">{row.value}</div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* ── PRICING ── */
                projectPipelineDetails.pricing_raw_per_plan.length > 0 ? (
                  <div className="space-y-5">
                    {projectPipelineDetails.pricing_raw_per_plan.map(({ plan_id, data }) => {
                      const totalEur = (data.total_cost_eur as number) ?? 0
                      const totalArea = (data.total_area_m2 as number) ?? 0
                      const breakdown = (data.breakdown ?? {}) as Record<string, { total_cost?: number; detailed_items?: unknown[]; items?: unknown[] }>
                      const planLabel = plan_id.replace('plan_0', 'Plan ').replace('_cluster_', ' · Cluster ')
                      const eur = (v: unknown) => typeof v === 'number' ? `€${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
                      const CATEGORY_META: Record<string, { label: string; color: string }> = {
                        foundation:           { label: 'Foundation',       color: 'text-stone-400'   },
                        structure_walls:      { label: 'Structure Walls',  color: 'text-amber-400'   },
                        floors_ceilings:      { label: 'Floors & Ceilings',color: 'text-yellow-400'  },
                        roof:                 { label: 'Roof',             color: 'text-orange-400'  },
                        openings:             { label: 'Openings',         color: 'text-sky-400'     },
                        finishes:             { label: 'Finishes',         color: 'text-teal-400'    },
                        utilities:            { label: 'Utilities',        color: 'text-violet-400'  },
                        stairs:               { label: 'Stairs',           color: 'text-pink-400'    },
                        basement:             { label: 'Basement',         color: 'text-slate-400'   },
                        wintergaerten_balkone:{ label: 'Wintergarten/Balkon',color:'text-green-400'  },
                        pillars:              { label: 'Pillars',          color: 'text-red-400'     },
                        fireplace:            { label: 'Fireplace',        color: 'text-orange-500'  },
                        lift:                 { label: 'Lift',             color: 'text-indigo-400'  },
                        aufstockung_phase1:   { label: 'Extension Phase 1',color: 'text-cyan-400'    },
                      }
                      const activeCategories = Object.entries(breakdown).filter(([, v]) => (v?.total_cost ?? 0) > 0)
                      return (
                        <div key={plan_id} className="overflow-hidden rounded-xl border border-white/10 bg-black/25">
                          {/* Plan header */}
                          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Building2 size={14} className="shrink-0 text-[#FFB84D]" />
                              <span className="text-sm font-semibold text-sand">{planLabel}</span>
                              {totalArea > 0 && <span className="text-xs text-sand/45">{totalArea.toFixed(1)} m²</span>}
                            </div>
                            <div className="text-sm font-bold text-[#FFD29A]">{eur(totalEur)}</div>
                          </div>
                          <div className="p-4 space-y-2">
                            {activeCategories.length === 0 ? (
                              <div className="text-sm text-sand/50">No pricing data available.</div>
                            ) : (
                              activeCategories.map(([cat, section]) => {
                                const meta = CATEGORY_META[cat] ?? { label: cat, color: 'text-sand/70' }
                                const items = (section.detailed_items ?? section.items ?? []) as Array<Record<string, unknown>>
                                return (
                                  <div key={cat} className="rounded-lg border border-white/[0.07] bg-black/20 overflow-hidden">
                                    {/* Category header */}
                                    <div className="flex items-center justify-between px-3 py-2 bg-white/[0.025]">
                                      <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                                      <span className="text-xs font-bold text-sand/85">{eur(section.total_cost)}</span>
                                    </div>
                                    {/* Items */}
                                    {items.length > 0 && (
                                      <div className="divide-y divide-white/[0.04] px-3">
                                        {items.map((item, ii) => {
                                          const name = String(item.name ?? item.category ?? '')
                                          const cost = item.cost ?? item.total_cost
                                          const area = item.area_m2
                                          const unitP = item.unit_price
                                          const priceUnit = item.price_unit
                                          return (
                                            <div key={ii} className="flex items-start justify-between gap-3 py-2">
                                              <div className="min-w-0">
                                                <div className="truncate text-[11px] text-sand/75">{name}</div>
                                                {area != null && unitP != null && (
                                                  <div className="text-[10px] text-sand/40 mt-0.5">
                                                    {typeof area === 'number' ? `${area.toFixed(2)} m²` : String(area)} × {typeof unitP === 'number' ? `€${unitP}` : String(unitP)}{priceUnit ? `/${String(priceUnit).replace('€/', '')}` : ''}
                                                  </div>
                                                )}
                                              </div>
                                              <div className="shrink-0 text-xs font-mono text-[#FFD29A]">{eur(cost)}</div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  /* fallback flat list */
                  <div className="space-y-2">
                    {(projectPipelineDetails.pricing.length ? projectPipelineDetails.pricing : [{ key: 'No pricing variables found', value: '—', source: 'n/a' }]).map((row) => (
                      <div key={`${row.source}-${row.key}`} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 truncate text-xs font-semibold text-sand">{row.key}</div>
                          <div className="shrink-0 rounded border border-[#FF9F0F]/35 bg-[#FF9F0F]/10 px-2 py-0.5 text-[10px] text-[#FFD29A]">{row.source}</div>
                        </div>
                        <div className="mt-1 break-all font-mono text-xs text-sand/70">{row.value}</div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {jsonPreviewModal.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-[#FF9F0F]/30 bg-[#16120f] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2 text-base font-semibold text-sand">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#FF9F0F]/35 bg-[#FF9F0F]/10 text-[#FFB84D]">
                  <FileText size={14} />
                </span>
                <span className="truncate">{jsonPreviewModal.filename || 'JSON file'}</span>
              </div>
              <button
                type="button"
                onClick={() => setJsonPreviewModal({ open: false, filename: '', content: '', loading: false, error: null })}
                className="text-sm text-sand/70 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="hide-scroll max-h-[76vh] overflow-auto bg-black/35 p-4">
              {jsonPreviewModal.loading ? (
                <div className="text-sm text-sand/70">Loading JSON…</div>
              ) : jsonPreviewModal.error ? (
                <div className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200/95">
                  {jsonPreviewModal.error}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/35 p-3 font-mono text-xs text-sand/80">
                  {jsonPreviewModal.content || 'Empty JSON.'}
                </pre>
              )}
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
                  This account is stored in Supabase. Name and role are saved through admin API.
                </p>
              ) : null}
              <label className="block">
                <span className="wiz-label">Name</span>
                <input
                  type="text"
                  value={editMemberDraft.name}
                  onChange={(e) => setEditMemberDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                  className="sun-input"
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
                disabled={orgSaving}
                onClick={() => {
                  if (editMemberIndex == null || !editMemberDraft) return
                  if (editMemberDraft.sourceProfileId) {
                    void (async () => {
                      try {
                        setOrgSaving(true)
                        setOrgError(null)
                        await updateAdminTenantWorkspace(selectedOrgId, {
                          members: [
                            {
                              id: editMemberDraft.sourceProfileId!,
                              full_name: editMemberDraft.name,
                              role: editMemberDraft.role === 'Admin' ? 'admin' : 'user',
                            },
                          ],
                        })
                        const ws = await fetchAdminTenantWorkspace(selectedOrgId)
                        setTenantWorkspace({ status: 'ok', data: ws, error: null, loadedForTenantId: selectedOrgId })
                        setEditMemberModalOpen(false)
                        setEditMemberDraft(null)
                        setEditMemberIndex(null)
                      } catch (e) {
                        setOrgError(e instanceof Error ? e.message : 'Could not update member.')
                      } finally {
                        setOrgSaving(false)
                      }
                    })()
                    return
                  }
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
  onClick,
  active = false,
}: {
  title: string
  value: string
  delta: string
  icon: React.ReactNode
  series?: readonly number[]
  sparkCaption?: string
  valueFormat?: 'count' | 'duration'
  onClick?: () => void
  active?: boolean
}) {
  const showSpark = series && series.length >= 2
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-2.5 text-left shadow-soft backdrop-blur-sm ${
        active
          ? 'border-[#FF9F0F]/60 bg-coffee-650/95'
          : 'border-black/40 bg-coffee-700/90'
      } ${onClick ? 'cursor-pointer transition hover:border-[#FF9F0F]/35' : 'cursor-default'}`}
    >
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
    </button>
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

function MoatAction({
  title,
  markedPlans,
  artifacts,
  onOpen,
}: {
  title: string
  markedPlans: number
  artifacts?: number
  onOpen?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-[112px] min-w-[170px] shrink-0 flex-col rounded-lg border border-white/12 bg-black/15 p-2 text-left transition hover:border-[#FF9F0F]/45 hover:bg-[#FF9F0F]/10"
    >
      <div className="text-sm font-medium leading-tight text-sand/70">{title}</div>
      <div className="mt-1 text-xs text-sand/75">
        Marked plans:{' '}
        <span className="font-semibold text-[#FFD29A]">{new Intl.NumberFormat('en-US').format(markedPlans)}</span>
      </div>
      {artifacts != null ? (
        <div className="mt-0.5 text-[11px] text-sand/60">
          Artifacts: <span className="font-semibold text-sand/85">{new Intl.NumberFormat('en-US').format(artifacts)}</span>
        </div>
      ) : null}
      <div className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold text-[#FFD29A]">
        Open details
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </button>
  )
}

function OffersThroughputChart({
  points,
}: {
  points: ReadonlyArray<{ label: string; offers: number; avgTime: string; incidents: number; avgCost: number | null }>
}) {
  const maxOffers = Math.max(...points.map((p) => p.offers))
  const minOffers = Math.min(...points.map((p) => p.offers))
  const range = Math.max(1, maxOffers - minOffers)
  const chartW = 100
  const chartH = 100
  const baseY = 92
  const topPad = 8
  const xStep = points.length > 1 ? chartW / (points.length - 1) : chartW
  const coords = points.map((p, idx) => {
    const norm = (p.offers - minOffers) / range
    const y = baseY - norm * (baseY - topPad)
    return { ...p, x: idx * xStep, y }
  })
  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ')
  const area = `${coords.map((c) => `${c.x},${c.y}`).join(' ')} ${chartW},${baseY} 0,${baseY}`

  return (
    <div className="relative h-full min-h-[260px] overflow-hidden rounded-lg border border-white/10 bg-black/15">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(255,255,255,.08)_1px,transparent_1px)] bg-size-[100%_20%]" />
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="absolute inset-2 h-[calc(100%-2.5rem)] w-[calc(100%-1rem)]">
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
      <div className="absolute inset-x-2 top-2 h-[calc(100%-2.5rem)]">
        {coords.map((c) => (
          <div
            key={c.label}
            className="group absolute -translate-x-1/2"
            style={{ left: `${c.x}%`, top: `${(c.y / chartH) * 100}%` }}
          >
            <div className="h-4 w-4 rounded-full" />
            <div className="pointer-events-none absolute -top-14 left-1/2 z-20 min-w-[128px] -translate-x-1/2 rounded-md border border-[#FF9F0F]/35 bg-[#2b1f17]/95 px-2 py-1 text-xs text-sand opacity-0 shadow-soft transition-all duration-150 group-hover:-translate-y-1 group-hover:opacity-100">
              <div className="font-semibold text-[#FFD29A]">{c.label}</div>
              <div>Offers: {c.offers}</div>
              <div>Avg time: {c.avgTime}</div>
              <div>Incidents: {c.incidents}</div>
              <div>Avg cost: {formatCostCents(c.avgCost)}</div>
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
