'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
}

function parseTokenBalanceString(s: string): number {
  const n = parseInt(s.replace(/,/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

function seedOrgUsersFromMeta(orgId: string): OrgUserEditable[] {
  const m = ORG_META[orgId] ?? ORG_META['org-1']
  const domain = m.email.includes('@') ? m.email.split('@')[1]! : 'org.local'
  return m.users.map((u, i) => {
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

/** Slight hue shift per heatmap column (still orange family). */
const ORG_HEATMAP_RGB: ReadonlyArray<[number, number, number]> = [
  [255, 159, 15],
  [255, 184, 77],
  [232, 160, 92],
  [214, 165, 116],
  [242, 140, 60],
  [230, 150, 75],
]

function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

  const selectedOrg = useMemo(
    () => DUMMY_ORGS.find((org) => org.id === selectedOrgId) ?? DUMMY_ORGS[0],
    [selectedOrgId],
  )
  const selectedOrgNames = useMemo(
    () => DUMMY_ORGS.filter((org) => orgFilters.includes(org.id)).map((org) => org.name),
    [orgFilters],
  )
  const selectedOrgMeta = useMemo(() => ORG_META[selectedOrgId] ?? ORG_META['org-1'], [selectedOrgId])

  const orgTokenBalanceDisplay = useMemo(() => {
    const stored = tokenBalancesByOrg[selectedOrgId]
    const n = stored ?? parseTokenBalanceString(selectedOrgMeta.tokenBalance)
    return n.toLocaleString('en-US')
  }, [tokenBalancesByOrg, selectedOrgId, selectedOrgMeta])

  const orgUsersList = useMemo(
    () => orgEditableUsers[selectedOrgId] ?? seedOrgUsersFromMeta(selectedOrgId),
    [orgEditableUsers, selectedOrgId],
  )

  useEffect(() => {
    if (activeView !== 'organization') return
    setOrgEditableUsers((prev) => {
      if (prev[selectedOrgId]) return prev
      return { ...prev, [selectedOrgId]: seedOrgUsersFromMeta(selectedOrgId) }
    })
  }, [activeView, selectedOrgId])

  useEffect(() => {
    setSelectedProjectRef(null)
  }, [selectedOrgId])
  const orgDailyRunsYear = useMemo(() => {
    const seed = selectedOrgId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    const today = new Date()
    return Array.from({ length: 365 }).map((_, idx) => {
      const date = new Date(today)
      date.setDate(today.getDate() - (364 - idx))
      const runs = (seed + idx * 13 + (idx % 7) * 5) % 11
      return { date, runs }
    })
  }, [selectedOrgId])
  const orgRunsWeeks = useMemo(() => {
    const weeks: Array<Array<{ date: Date; runs: number }>> = []
    for (let i = 0; i < orgDailyRunsYear.length; i += 7) {
      weeks.push(orgDailyRunsYear.slice(i, i + 7))
    }
    return weeks
  }, [orgDailyRunsYear])

  const orgDummyProjects = useMemo(() => {
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
      return {
        ref: `${pfx}-${yyyy}-${String(120 + idx).padStart(3, '0')}`,
        dateLabel: `${dd}.${mm}.${yyyy}`,
        title: ORG_PROJECT_TITLES[idx % ORG_PROJECT_TITLES.length],
        duration: ORG_PROJECT_DURATIONS[idx % ORG_PROJECT_DURATIONS.length],
        status: status as 'Running' | 'Queued' | 'Completed',
        owner: ownerUser?.name,
        ownerMemberId: `adm-${selectedOrgId}-u${ownerIdx}`,
        offerSlug: offerCycle[idx % 3],
        createdAt: d,
      }
    })
  }, [selectedOrgId, selectedOrgMeta])

  const projFilterOrgMembers = useMemo(
    () =>
      orgUsersList.map((u, idx) => ({
        id: `adm-${selectedOrgId}-u${idx}`,
        email: null as string | null,
        full_name: u.name,
      })),
    [orgUsersList, selectedOrgId],
  )

  const hasActiveProjFilters =
    Boolean(projAppliedOfferTypeId) ||
    Boolean(projAppliedDateFrom) ||
    Boolean(projAppliedDateTo) ||
    projAppliedUserIds.length > 0

  const filteredOrgProjects = useMemo(() => {
    let list = orgDummyProjects
    if (projAppliedOfferTypeId) {
      const opt = ADMIN_OFFER_TYPE_OPTIONS.find((o) => o.id === projAppliedOfferTypeId)
      const slug = opt?.slug
      if (slug === 'mengenermittlung') list = list.filter((p) => p.offerSlug === 'mengenermittlung')
      else if (slug === 'dachstuhl') list = list.filter((p) => p.offerSlug === 'dachstuhl')
      else if (slug === 'neubau') list = list.filter((p) => p.offerSlug === 'neubau')
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
    orgDummyProjects,
    projAppliedOfferTypeId,
    projAppliedDateFrom,
    projAppliedDateTo,
    projAppliedUserIds,
    projSearch,
  ])

  const selectedOrgProject = useMemo(() => {
    if (!selectedProjectRef) return null
    return orgDummyProjects.find((p) => p.ref === selectedProjectRef) ?? null
  }, [selectedProjectRef, orgDummyProjects])

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
            {DUMMY_ORGS.map((org) => {
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
                <div className="rounded-xl border border-white/10 bg-coffee-700/60 p-3 backdrop-blur-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={18} className="text-[#FFB84D]" />
                      <h2 className="text-xl font-semibold text-sand md:text-2xl">Statistics Control Center</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm text-sand/70">Last refresh: just now</div>
                      <div className="inline-flex items-center gap-2 rounded-xl border border-[#FF9F0F]/40 bg-[#FF9F0F]/10 px-2.5 py-1.5">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-[#FF9F0F]/45 bg-[#FF9F0F]/20 text-[#FFD29A] text-[11px] font-bold">€</span>
                        <div className="leading-tight">
                          <div className="text-[10px] uppercase tracking-wide text-sand/70">Avg. cost/run</div>
                          <div className="text-sm font-bold text-white">{(AVG_COST_PER_RUN_CENTS / 100).toFixed(2)}€</div>
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
                          onClick={() => setOrgFilters(DUMMY_ORGS.map((org) => org.id))}
                          className={[
                            'rounded-md px-2.5 py-1 text-xs font-medium transition',
                            orgFilters.length === DUMMY_ORGS.length ? 'bg-[#FF9F0F] text-white' : 'text-sand/80 hover:bg-white/8',
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
                        {DUMMY_ORGS.map((org) => (
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

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <KpiCard title="Total offers generated" value="2,184" delta="+12.8%" icon={<TrendingUp size={14} />} />
                  <KpiCard title="Avg processing / day" value="6m 42s" delta="-8.1%" icon={<Gauge size={14} />} />
                  <KpiCard title="Clients acquired / churn" value="38 / 4" delta="+6.2%" icon={<Building2 size={14} />} />
                  <KpiCard title="System incidents" value="27" delta="-11.4%" icon={<Activity size={14} />} />
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
                        <span>Total offers: 1,381</span>
                        <span>Avg processing: 6m 17s</span>
                      </div>
                      <OffersThroughputChart points={THROUGHPUT_SERIES} />
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
                            className={`rounded-md border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                              selectedOrgProject.status === 'Running'
                                ? 'border-[#FF9F0F]/50 bg-[#FF9F0F]/14 text-[#FFD29A]'
                                : selectedOrgProject.status === 'Queued'
                                  ? 'border-[#c9944a]/40 bg-[#c9944a]/10 text-sand/80'
                                  : 'border-white/22 bg-white/10 text-sand/88'
                            }`}
                          >
                            {selectedOrgProject.status}
                          </span>
                        </div>
                        <h2 className="mt-1.5 truncate text-lg font-semibold text-sand sm:text-xl">
                          {selectedOrg.name}{' '}
                          <span className="font-mono text-[#FFD29A]/95">/ {selectedOrgProject.ref}</span>
                        </h2>
                        <p className="mt-1 line-clamp-2 text-xs text-sand/60">{selectedOrgProject.title}</p>
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
                    <div className="mb-3 text-[11px] text-sand/50">Run overview · dummy data</div>
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
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-12 w-1 shrink-0 rounded-full bg-linear-to-b from-[#FF9F0F] via-[#FFB84D] to-[#c9944a]" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sand/45">Client workspace</p>
                        <span className="rounded-md border border-[#FF9F0F]/35 bg-[#FF9F0F]/15 px-2 py-0.5 text-[10px] font-semibold text-[#FFD29A]">
                          {selectedOrgMeta.plan}
                        </span>
                        <span className="rounded-md border border-white/12 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-sand/70">
                          {orgDailyRunsYear.reduce((acc, item) => acc + item.runs, 0)} runs / yr
                        </span>
                      </div>
                      <h2 className="mt-1.5 truncate text-lg font-semibold text-sand sm:text-xl">{selectedOrg.name}</h2>
                      <p className="mt-1 text-xs text-sand/60">Offer pipeline overview · last 365 days activity</p>
                    </div>
                    <div className="shrink-0 self-end">
                      {/* eslint-disable-next-line @next/next/no-img-element -- public /clients and /logo.png */}
                      <img
                        src={selectedOrgMeta.logoSrc ?? HOLZBOT_LOGO_PLACEHOLDER}
                        alt={selectedOrgMeta.companyName}
                        className="max-h-10 w-auto max-w-[min(100%,280px)] object-contain object-right object-bottom sm:max-h-12"
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
                          <div className="text-[11px] text-sand/55">Runs per day · last 365 days (7 rows × weeks)</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-md border border-black/40 bg-black/25 px-2 py-1">
                        <span className="text-[10px] text-sand/50">Less</span>
                        <div className="flex gap-[clamp(0.2rem,0.5vw,0.35rem)]">
                          {[0.12, 0.35, 0.58, 0.82, 0.94].map((a, i) => (
                            <div
                              key={i}
                              className="admin-heatmap-legend-swatch shrink-0 rounded-sm border border-black/50"
                              style={{ backgroundColor: `rgba(255,159,15,${a})` }}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-sand/50">More</span>
                      </div>
                    </div>
                    <div className="w-full rounded-lg border border-dashed border-[#FF9F0F]/20 bg-black/35 p-[clamp(0.35rem,1vw,0.65rem)]">
                      <div
                        className="grid h-[clamp(6.25rem,20vh,11rem)] w-full min-h-0 min-w-0"
                        style={{
                          gridTemplateColumns: `repeat(${orgRunsWeeks.length}, minmax(0, 1fr))`,
                          gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
                          gap: 'clamp(2px, 0.45vw, 5px)',
                        }}
                      >
                        {orgRunsWeeks.flatMap((week, weekIdx) => {
                          const [r, g, b] = ORG_HEATMAP_RGB[weekIdx % ORG_HEATMAP_RGB.length]
                          const padded: Array<{ date: Date; runs: number } | null> = [...week]
                          while (padded.length < 7) padded.push(null)
                          return padded.slice(0, 7).map((item, dayIdx) => {
                            const gridColumn = weekIdx + 1
                            const gridRow = dayIdx + 1
                            if (!item) {
                              return (
                                <div
                                  key={`${selectedOrgId}-w${weekIdx}-d${dayIdx}-empty`}
                                  className="min-h-0 min-w-0 rounded-[2px] border border-transparent bg-black/15"
                                  style={{ gridColumn, gridRow }}
                                  aria-hidden
                                />
                              )
                            }
                            const intensity = item.runs / 10
                            const a = 0.14 + intensity * 0.78
                            return (
                              <div
                                key={`${selectedOrgId}-w${weekIdx}-d${dayIdx}`}
                                title={`${item.date.toLocaleDateString('en-GB')}: ${item.runs} runs`}
                                className="min-h-0 min-w-0 rounded-[2px] border border-black/45 shadow-sm"
                                style={{
                                  gridColumn,
                                  gridRow,
                                  backgroundColor: `rgba(${r},${g},${b},${a})`,
                                }}
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
                        title="Suchen"
                        aria-label="Suchen"
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
                            placeholder="Suchen…"
                            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-8 text-sm text-white placeholder-sand/50 focus:border-[#FF9F0F]/50 focus:outline-none focus:ring-1 focus:ring-[#FF9F0F]/30"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => setProjSearchOpen(false)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-sand/50 hover:text-sand"
                            aria-label="Suche schließen"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="hide-scroll grid min-h-0 flex-1 auto-rows-min grid-cols-1 content-start gap-2.5 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                    {filteredOrgProjects.length === 0 ? (
                      <div className="col-span-full rounded-lg border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-sand/60">
                        No projects match these filters.
                      </div>
                    ) : (
                      filteredOrgProjects.map((proj) => {
                        const statusStyles =
                          proj.status === 'Running'
                            ? 'border-[#FF9F0F]/50 bg-[#FF9F0F]/14 text-[#FFD29A]'
                            : proj.status === 'Queued'
                              ? 'border-[#c9944a]/40 bg-[#c9944a]/10 text-sand/80'
                              : 'border-white/22 bg-white/10 text-sand/88'
                        return (
                          <button
                            key={proj.ref}
                            type="button"
                            onClick={() => setSelectedProjectRef(proj.ref)}
                            className="relative flex min-h-[min(7.5rem,18vh)] flex-col overflow-hidden rounded-md border border-black/40 bg-coffee-750/95 pl-3 pr-3 pt-2.5 pb-2.5 text-left shadow-soft transition hover:border-caramel hover:bg-coffee-700/95"
                            style={{ borderLeftWidth: 4, borderLeftColor: '#FF9F0F' }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="truncate font-mono text-[11px] text-[#FFD29A]/95">{proj.ref}</span>
                              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${statusStyles}`}>
                                {proj.status}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-sand/55">
                              <span>{proj.dateLabel}</span>
                              {proj.owner ? (
                                <>
                                  <span className="text-sand/35">·</span>
                                  <span className="truncate text-sand/75">{proj.owner}</span>
                                </>
                              ) : null}
                            </div>
                            <div className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-sand">{proj.title}</div>
                            <div className="mt-auto flex items-center gap-1.5 border-t border-white/5 pt-2 text-[11px] text-sand/65">
                              <Clock3 size={12} className="shrink-0 text-[#FFB84D]/70" />
                              <span>{proj.duration}</span>
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
                <div className="rounded-xl border border-[#FF9F0F]/25 bg-black/20 p-2.5">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sand/55">Company</div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#FF9F0F]/45 bg-[#FF9F0F]/15 text-sm font-bold text-[#FFD29A]">
                      {selectedOrgMeta.logoLabel}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-sand">{selectedOrgMeta.companyName}</div>
                      <div className="text-xs text-sand/65">{selectedOrgMeta.plan} plan</div>
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
                  </div>
                </div>

                <div className="rounded-xl border border-[#FF9F0F]/25 bg-black/20 p-2.5">
                  <div className="mb-2 text-sm font-semibold text-sand">Token balance</div>
                  <div className="mb-3 flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#FFD29A]">
                      <Coins size={14} className="text-[#FFB84D]" />
                      {orgTokenBalanceDisplay}
                    </div>
                    <span className="text-xs text-sand/65">tokens</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTokensModalOpen(true)}
                    className="w-full rounded-xl border border-[#FF9F0F]/45 bg-linear-to-b from-[#e08414] to-[#f79116] py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(255,159,15,.25)] transition hover:brightness-110 inline-flex items-center justify-center gap-2"
                  >
                    <Coins size={15} />
                    Add more tokens
                  </button>
                </div>

                <div className="rounded-xl border border-[#FF9F0F]/25 bg-black/20 p-2.5">
                  <div className="mb-2 text-sm font-semibold text-sand">Users</div>
                  <p className="mb-2 text-[11px] text-sand/55">Click a member to edit name, email, password, and role.</p>
                  <div className="space-y-2">
                    {orgUsersList.map((u, idx) => (
                      <button
                        key={`${selectedOrgId}-${u.name}-${idx}`}
                        type="button"
                        onClick={() => {
                          const list = orgEditableUsers[selectedOrgId] ?? seedOrgUsersFromMeta(selectedOrgId)
                          if (!orgEditableUsers[selectedOrgId]) {
                            setOrgEditableUsers((p) => ({ ...p, [selectedOrgId]: list }))
                          }
                          setEditMemberDraft({ ...list[idx] })
                          setEditMemberIndex(idx)
                          setEditMemberModalOpen(true)
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-left text-sm font-medium text-sand transition hover:border-[#FF9F0F]/40"
                      >
                        <div className="text-sand">{u.name}</div>
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
                onClick={() => {
                  const add = Math.max(0, parseInt(tokensAddAmount, 10) || 0)
                  const base =
                    tokenBalancesByOrg[selectedOrgId] ?? parseTokenBalanceString(selectedOrgMeta.tokenBalance)
                  setTokenBalancesByOrg((prev) => ({ ...prev, [selectedOrgId]: base + add }))
                  setTokensModalOpen(false)
                }}
                className="rounded-lg border border-[#FF9F0F]/45 bg-[#FF9F0F]/25 px-3 py-1.5 text-xs font-semibold text-[#FFD29A]"
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
                  value={editMemberDraft.email}
                  onChange={(e) => setEditMemberDraft((d) => (d ? { ...d, email: e.target.value } : d))}
                  className="sun-input"
                />
              </label>
              <label className="block">
                <span className="wiz-label">Password</span>
                <input
                  type="password"
                  value={editMemberDraft.password}
                  onChange={(e) => setEditMemberDraft((d) => (d ? { ...d, password: e.target.value } : d))}
                  className="sun-input"
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
                onClick={() => {
                  if (editMemberIndex == null || !editMemberDraft) return
                  const list = [...(orgEditableUsers[selectedOrgId] ?? seedOrgUsersFromMeta(selectedOrgId))]
                  list[editMemberIndex] = { ...editMemberDraft }
                  setOrgEditableUsers((prev) => ({ ...prev, [selectedOrgId]: list }))
                  setEditMemberModalOpen(false)
                  setEditMemberDraft(null)
                  setEditMemberIndex(null)
                }}
                className="rounded-lg border border-[#FF9F0F]/45 bg-[#FF9F0F]/25 px-3 py-1.5 text-xs font-semibold text-[#FFD29A]"
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

function KpiCard({
  title,
  value,
  delta,
  icon,
}: {
  title: string
  value: string
  delta: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-black/40 bg-coffee-700/90 p-3 shadow-soft backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm text-sand/70">{title}</div>
        <div className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#FF9F0F]/35 bg-[#FF9F0F]/15 text-[#FFB84D]">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-[#FFB84D]">{value}</div>
      <div className="mt-1 text-sm text-sand/75">{delta} vs previous period</div>
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
