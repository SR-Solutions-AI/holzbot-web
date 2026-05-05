'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, MousePointer2, Pencil, Plus, Trash2, Undo2, X } from 'lucide-react'
import {
  DetectionsPolygonCanvas,
  formatRoofSurfaceCanvasLabel,
  type Point,
  type RoomPolygon,
  type DoorRect,
} from './DetectionsPolygonCanvas'
import type { RoofOverhangEdgeKind, RoofOverhangLine } from '@/app/lib/roofOverhangGeometry'
import { transformRoofOverhangLinesWithPolygon } from '@/app/lib/roofOverhangGeometry'
import { nextRoofLabel } from '../lib/roofReviewHelpers'
import { apiFetch } from '../lib/supabaseClient'
import { displayFloorTabLabelDe } from '@/lib/displayFloorTabLabelDe'
import {
  DEFAULT_ROOF_ANGLE,
  DEFAULT_ROOF_OVERHANG_M,
  DEFAULT_ROOF_TYPE,
  ROOF_TYPE_OPTIONS,
  roofTypeLabelDe,
  type RoofTypeId,
} from '../lib/roofTypeOptions'

type ReviewImage = { url: string; caption?: string }

type PlanData = {
  imageWidth: number
  imageHeight: number
  rectangles: RoomPolygon[]
  /** Dachfenster (Rechtecke), strikt innerhalb der Dachflächen-Polylines. */
  doors: DoorRect[]
  /** Überhang je muchie (linie pe contur), nu pe întreg poligonul. */
  overhangLines?: RoofOverhangLine[]
}

type ImageDimsSeed = { imageWidth: number; imageHeight: number }

/**
 * Embedded Aufstockung: roof-review-data poate declara alte imageWidth/Height decât detections-review.
 * Canvas-ul de fază 1 folosește dimensiunile din detections — scalăm poligoanele și bbox-urile la același spațiu.
 */
function alignRoofPlanToSeedDims(plan: PlanData, seed: ImageDimsSeed): PlanData {
  const toW = Number(seed.imageWidth) || 0
  const toH = Number(seed.imageHeight) || 0
  const fromW = Number(plan.imageWidth) || 0
  const fromH = Number(plan.imageHeight) || 0
  if (toW <= 0 || toH <= 0) return plan
  if (fromW <= 0 || fromH <= 0) {
    return { ...plan, imageWidth: toW, imageHeight: toH }
  }
  if (fromW === toW && fromH === toH) return { ...plan, imageWidth: toW, imageHeight: toH }
  const sx = toW / fromW
  const sy = toH / fromH
  return {
    ...plan,
    imageWidth: toW,
    imageHeight: toH,
    rectangles: plan.rectangles.map((r) => ({
      ...r,
      points: r.points.map((pt) => [pt[0] * sx, pt[1] * sy] as Point),
    })),
    doors: plan.doors.map((d) => {
      const [x1, y1, x2, y2] = d.bbox
      return {
        ...d,
        bbox: [x1 * sx, y1 * sy, x2 * sx, y2 * sy] as [number, number, number, number],
      }
    }),
    overhangLines: (plan.overhangLines ?? []).map((ln) => ({
      ...ln,
      a: [ln.a[0] * sx, ln.a[1] * sy] as Point,
      b: [ln.b[0] * sx, ln.b[1] * sy] as Point,
    })),
  }
}

function alignRoofPlansToEmbeddedSeeds(plans: PlanData[], seeds: ImageDimsSeed[] | undefined): PlanData[] {
  if (!seeds?.length) return plans
  return plans.map((p, i) => {
    const seed = seeds[i]
    if (!seed || !(Number(seed.imageWidth) > 0) || !(Number(seed.imageHeight) > 0)) return p
    return alignRoofPlanToSeedDims(p, seed)
  })
}

/** Potrivește rândul roof-review la etajul detections după dimensiuni imagine (nu doar după index). */
function matchRoofRowToSeedIndex(
  plan: Pick<PlanData, 'imageWidth' | 'imageHeight'>,
  seeds: ImageDimsSeed[],
  rowIndex: number,
): number {
  if (!seeds?.length) return rowIndex
  const fromW = Number(plan.imageWidth) || 0
  const fromH = Number(plan.imageHeight) || 0
  if (fromW <= 0 || fromH <= 0) return rowIndex
  const exact = seeds.findIndex(
    (s) => Number(s.imageWidth) === fromW && Number(s.imageHeight) === fromH,
  )
  if (exact >= 0) return exact
  let best = rowIndex
  let bestD = Infinity
  for (let j = 0; j < seeds.length; j++) {
    const sw = Number(seeds[j].imageWidth) || 0
    const sh = Number(seeds[j].imageHeight) || 0
    if (sw <= 0 || sh <= 0) continue
    const d = Math.abs(sw - fromW) + Math.abs(sh - fromH)
    if (d < bestD) {
      bestD = d
      best = j
    }
  }
  return best
}

function reorderRoofPlansToEmbeddedSlots(plans: PlanData[], seeds: ImageDimsSeed[]): PlanData[] {
  if (!seeds.length) return plans
  const nSlots = Math.max(plans.length, seeds.length)
  const slots: PlanData[] = Array.from({ length: nSlots }, (_, k) => ({
    imageWidth: Number(seeds[k]?.imageWidth) || 0,
    imageHeight: Number(seeds[k]?.imageHeight) || 0,
    rectangles: [],
    doors: [],
    overhangLines: [],
  }))
  for (let i = 0; i < plans.length; i++) {
    const si = matchRoofRowToSeedIndex(plans[i], seeds, i)
    if (si >= 0 && si < slots.length) slots[si] = plans[i]
  }
  return slots
}

export type RoofSurfaceTab = 'surfaces' | 'windows'

type Tool = 'select' | 'add' | 'remove' | 'edit' | 'bulk_select'

function clampRoofOverhangM(v: number): number {
  return Math.max(0, Math.min(5, v))
}

function normalizeRect(r: {
  points: Point[]
  roomName?: string
  roomType?: string
  roofAngleDeg?: number
  roofType?: string
  roofOverhangM?: number
}): RoomPolygon {
  let ang = typeof r.roofAngleDeg === 'number' && Number.isFinite(r.roofAngleDeg) ? r.roofAngleDeg : DEFAULT_ROOF_ANGLE
  ang = Math.max(0, Math.min(60, ang))
  const allowed = new Set(['0_w', '1_w', '2_w', '4_w', '4.5_w'])
  const rt = typeof r.roofType === 'string' && allowed.has(r.roofType) ? (r.roofType as RoofTypeId) : DEFAULT_ROOF_TYPE
  let oh =
    typeof r.roofOverhangM === 'number' && Number.isFinite(r.roofOverhangM) ? r.roofOverhangM : DEFAULT_ROOF_OVERHANG_M
  oh = clampRoofOverhangM(oh)
  return {
    points: r.points || [],
    roomName: r.roomName,
    roomType: r.roomType,
    roofAngleDeg: ang,
    roofType: rt,
    roofOverhangM: oh,
  }
}

const OH_EDGE_SET = new Set(['traufe', 'ortgang', 'first', 'dachrand'])

function normalizeOverhangLine(input: Partial<RoofOverhangLine> & { a?: Point; b?: Point }): RoofOverhangLine | null {
  const a = input.a
  const b = input.b
  if (!a || !b || a.length < 2 || b.length < 2) return null
  let roofIndex = typeof input.roofIndex === 'number' && Number.isFinite(input.roofIndex) ? Math.round(input.roofIndex) : -1
  if (roofIndex < 0) return null
  const ek0 = typeof input.edgeKind === 'string' ? input.edgeKind : 'traufe'
  const edgeKind = (OH_EDGE_SET.has(ek0) ? ek0 : 'traufe') as RoofOverhangEdgeKind
  let overhangCm = typeof input.overhangCm === 'number' && Number.isFinite(input.overhangCm) ? input.overhangCm : 40
  overhangCm = Math.max(0, Math.min(500, Math.round(overhangCm)))
  return {
    a: [a[0], a[1]],
    b: [b[0], b[1]],
    roofIndex,
    edgeKind,
    overhangCm,
  }
}

function filterOverhangLinesForRoofCount(lines: RoofOverhangLine[] | undefined, nRect: number): RoofOverhangLine[] {
  if (!lines?.length) return []
  return lines.filter((l) => l.roofIndex >= 0 && l.roofIndex < nRect)
}

function edgeKindChoicesForRoofType(rt: RoofTypeId): { id: RoofOverhangEdgeKind; label: string }[] {
  if (rt === '0_w') return [{ id: 'dachrand', label: 'Dachrand' }]
  if (rt === '1_w') {
    return [
      { id: 'traufe', label: 'Traufe' },
      { id: 'ortgang', label: 'Ortgang' },
      { id: 'first', label: 'First' },
    ]
  }
  return [
    { id: 'traufe', label: 'Traufe' },
    { id: 'ortgang', label: 'Ortgang' },
  ]
}

function parseDecimalField(s: string, min: number, max: number): number | null {
  const t = s.replace(',', '.').trim()
  if (t === '' || t === '-' || t === '.' || t === '-.') return null
  const v = parseFloat(t)
  if (!Number.isFinite(v)) return null
  return Math.max(min, Math.min(max, v))
}

function fallbackFloorLabelDe(index: number): string {
  if (index <= 0) return 'Erdgeschoss'
  return 'Obergeschoss'
}

function pointInRoofPoly(px: number, py: number, points: Point[]): boolean {
  if (points.length < 3) return false
  let inside = false
  const n = points.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Alle vier Ecken des BBOX liegen in demselben Dach-Rechteck-Polygon. */
function bboxFullyInsideSomeRoofRect(bbox: [number, number, number, number], rects: RoomPolygon[]): boolean {
  const [x1, y1, x2, y2] = bbox
  const corners: Point[] = [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ]
  for (const r of rects) {
    const pts = r.points
    if (pts.length < 3) continue
    if (corners.every((c) => pointInRoofPoly(c[0], c[1], pts))) return true
  }
  return false
}

/** Skaliert Rechteck vom Mittelpunkt, bis es in eine Dachfläche passt (oder null). */
function clipBboxToRoofRects(bbox: [number, number, number, number], rects: RoomPolygon[]): [number, number, number, number] | null {
  if (bboxFullyInsideSomeRoofRect(bbox, rects)) return bbox
  const [x1, y1, x2, y2] = bbox
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  let w = Math.abs(x2 - x1)
  let h = Math.abs(y2 - y1)
  if (w < 1 || h < 1) return null
  for (let s = 0.99; s >= 0.05; s -= 0.02) {
    const hw = (w * s) / 2
    const hh = (h * s) / 2
    const bb: [number, number, number, number] = [cx - hw, cy - hh, cx + hw, cy + hh]
    if (bboxFullyInsideSomeRoofRect(bb, rects)) return bb
  }
  return null
}

function filterDoorsToRoofRects(doors: DoorRect[], rects: RoomPolygon[]): DoorRect[] {
  return doors.filter((d) => bboxFullyInsideSomeRoofRect(d.bbox, rects))
}

function normalizeRoofDoor(d: { bbox?: number[]; width_m?: number; height_m?: number }): DoorRect | null {
  const raw = Array.isArray(d?.bbox) ? d.bbox : null
  if (!raw || raw.length < 4) return null
  const bbox = [raw[0], raw[1], raw[2], raw[3]] as [number, number, number, number]
  const out: DoorRect = { bbox, type: 'window' }
  if (typeof d.width_m === 'number' && Number.isFinite(d.width_m) && d.width_m > 0) out.width_m = d.width_m
  if (typeof d.height_m === 'number' && Number.isFinite(d.height_m) && d.height_m > 0) out.height_m = d.height_m
  return out
}

function roofPlanLabelDe(labels: string[], index: number): string {
  const raw = labels[index]
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    // Ignore generic placeholders and show a localized fallback instead.
    if (trimmed && !/^plan\s+\d+$/i.test(trimmed)) return displayFloorTabLabelDe(trimmed)
  }
  return fallbackFloorLabelDe(index)
}

export type RoofReviewEditorHandle = {
  flushSave: () => Promise<boolean>
  roofUndo: () => void
  /** Sincronizare gesturi (puncte, dialog add) după ce părintele a schimbat Werkzeug-ul. */
  roofApplyToolFromParent: (t: Tool) => void
}

function scrollRoofTypeTileIntoView(
  scrollRoot: HTMLElement | null,
  roofTypeId: string,
  behavior: ScrollBehavior = 'smooth',
) {
  if (!scrollRoot) return
  const esc =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(roofTypeId)
      : roofTypeId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const el = scrollRoot.querySelector<HTMLElement>(`button[data-roof-type="${esc}"]`)
  el?.scrollIntoView({ behavior, block: 'nearest', inline: 'center' })
}

type RoofStripScrollBarUiProps = {
  bar: { visible: boolean; thumbW: number; thumbLeft: number }
  onTrackMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
  onThumbMouseDown: (e: React.MouseEvent) => void
  roofUiVariant: 'holzbot' | 'betonbot'
}

function RoofTypeStripScrollBar({
  bar,
  onTrackMouseDown,
  onThumbMouseDown,
  roofUiVariant,
}: RoofStripScrollBarUiProps) {
  if (!bar.visible) return null
  const thumbClass =
    roofUiVariant === 'betonbot'
      ? 'bg-[#E5B800] hover:bg-[#FFCF33]'
      : 'bg-[#c9944a] hover:bg-[#d8a25e]'
  return (
    <div
      className="relative mt-1 h-2 w-full shrink-0 cursor-pointer rounded-full bg-black/35"
      onMouseDown={onTrackMouseDown}
      role="scrollbar"
      aria-label="Dachtypen horizontal scrollen"
    >
      <div
        data-roof-hscroll-thumb
        className={`absolute top-0.5 bottom-0.5 cursor-grab rounded-full active:cursor-grabbing ${thumbClass}`}
        style={{ width: bar.thumbW, left: bar.thumbLeft, minWidth: 24 }}
        onMouseDown={onThumbMouseDown}
        aria-hidden
      />
    </div>
  )
}

function useRoofTypeStripHorizontalBar(
  scrollRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  resyncKey: string,
) {
  const [bar, setBar] = useState({ visible: false, thumbW: 24, thumbLeft: 0 })
  const barRef = useRef(bar)
  barRef.current = bar

  const sync = useCallback(() => {
    const el = scrollRef.current
    if (!el) {
      setBar((s) => ({ ...s, visible: false }))
      return
    }
    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScroll = scrollWidth - clientWidth
    if (maxScroll <= 1) {
      setBar({ visible: false, thumbW: 24, thumbLeft: 0 })
      return
    }
    const ratio = clientWidth / scrollWidth
    const thumbW = Math.max(24, Math.round(clientWidth * ratio))
    const maxThumbLeft = Math.max(0, clientWidth - thumbW)
    const thumbLeft = maxScroll > 0 ? (scrollLeft / maxScroll) * maxThumbLeft : 0
    setBar({ visible: true, thumbW, thumbLeft })
  }, [scrollRef])

  const onScroll = useCallback(() => sync(), [sync])

  useLayoutEffect(() => {
    if (!enabled) {
      setBar({ visible: false, thumbW: 24, thumbLeft: 0 })
      return
    }
    const el = scrollRef.current
    if (!el) return undefined
    const run = () => sync()
    run()
    el.addEventListener('scroll', run, { passive: true })
    const ro = new ResizeObserver(run)
    ro.observe(el)
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(run)
    })
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', run)
      ro.disconnect()
    }
  }, [enabled, sync, resyncKey])

  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({ x: 0, scroll: 0, thumbW: 24 })

  const onThumbMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const el = scrollRef.current
      if (!el) return
      dragRef.current = {
        x: e.clientX,
        scroll: el.scrollLeft,
        thumbW: barRef.current.thumbW,
      }
      setDragging(true)
    },
    [scrollRef],
  )

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const el = scrollRef.current
      if (!el) return
      const { scrollWidth, clientWidth } = el
      const maxScroll = scrollWidth - clientWidth
      if (maxScroll <= 0) return
      const thumbTravel = clientWidth - dragRef.current.thumbW
      const delta = e.clientX - dragRef.current.x
      const scrollDelta = thumbTravel > 0 ? (delta / thumbTravel) * maxScroll : 0
      el.scrollLeft = Math.max(0, Math.min(maxScroll, dragRef.current.scroll + scrollDelta))
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, scrollRef])

  const onTrackMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-roof-hscroll-thumb]')) return
      const el = scrollRef.current
      if (!el) return
      const { scrollWidth, clientWidth } = el
      const maxScroll = scrollWidth - clientWidth
      if (maxScroll <= 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = Math.max(0, Math.min(1, x / rect.width))
      el.scrollLeft = ratio * maxScroll
    },
    [scrollRef],
  )

  return { onScroll, bar, onThumbMouseDown, onTrackMouseDown }
}

type RoofReviewEditorProps = {
  offerId?: string
  images: ReviewImage[]
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  /** betonbot: shift roof preview thumbnails from orange toward yellow */
  roofUiVariant?: 'holzbot' | 'betonbot'
  /**
   * În editorul unificat: fără titlu/footer proprii; etajul urmește tab-urile părinte.
   */
  embedded?: boolean
  /** Când e setat (și embedded), folosim acest index în loc de tab-urile interne de etaj. */
  embedPlanIndex?: number
  /**
   * Editor unificat: dimensiuni imagine din tab Räume (înainte de roof-review-data), ca blueprint-ul să apară la fel.
   */
  embeddedPlanSeeds?: Array<{ imageWidth: number; imageHeight: number }>
  /** False când tab-ul Dach e ascuns (display:none) — recalculează canvas la activare. */
  layoutActive?: boolean
  /**
   * Editor unificat: Werkzeuge + Ansicht + Hinweis sunt în DetectionsReviewEditor (aceeași ordine ca Räume).
   * Cere `tool` / `setTool` / `roofSurfaceTab` / `setRoofSurfaceTab` din părinte.
   */
  chromeInParent?: boolean
  /**
   * Aufstockung Bestand: strat vectorial peste același blueprint ca DetectionsReviewEditor — canvas fără basemap (nu dublăm planul).
   */
  vectorOverlayOnly?: boolean
  /** Aufstockung Dach-Stack: zoom/pan partajat cu canvas-ul de fundal din DetectionsReviewEditor. */
  stackedView?: { zoom: number; pan: { x: number; y: number } } | null
  onStackedViewChange?: (next: { zoom: number; pan: { x: number; y: number } }) => void
  /** Când e setat (editor unificat), Maße Dachfenster se randă aici (sub Hinweis), nu sub rândul Räume. */
  dimsToolbarPortalTarget?: HTMLElement | null
  tool?: Tool
  setTool?: Dispatch<SetStateAction<Tool>>
  roofSurfaceTab?: RoofSurfaceTab
  setRoofSurfaceTab?: Dispatch<SetStateAction<RoofSurfaceTab>>
  /**
   * Aufstockung embedded: trimite dreptunghiurile Dach actuale către părinte ca overlay pe canvas-ul de fază 1
   * (în loc de singurul poll roof-review-data, care poate întârzia față de editări).
   */
  onRoofRectanglesOverlaySync?: (
    planIndex: number,
    rectangles: RoomPolygon[],
    /** Dimensiuni spațiului în care sunt `rectangles` (din `plansData` roof); părintele scalează la planul detections dacă diferă. */
    sourceImageDims?: { imageWidth: number; imageHeight: number },
  ) => void
  /** Editor unificat: Dachfläche vs. Überhang (părintele ține starea când `chromeInParent`). */
  roofAddSubtool?: 'surface' | 'overhang'
  setRoofAddSubtool?: Dispatch<SetStateAction<'surface' | 'overhang'>>
}

export const RoofReviewEditor = forwardRef<RoofReviewEditorHandle, RoofReviewEditorProps>(function RoofReviewEditor(
  {
    offerId,
    images,
    onConfirm,
    onCancel,
    roofUiVariant = 'holzbot',
    embedded = false,
    embedPlanIndex,
    embeddedPlanSeeds,
    layoutActive = true,
    chromeInParent = false,
    vectorOverlayOnly = false,
    stackedView = null,
    onStackedViewChange,
    dimsToolbarPortalTarget,
    tool: toolProp,
    setTool: setToolProp,
    roofSurfaceTab: roofSurfaceTabProp,
    setRoofSurfaceTab: setRoofSurfaceTabProp,
    onRoofRectanglesOverlaySync,
    roofAddSubtool: roofAddSubtoolProp,
    setRoofAddSubtool: setRoofAddSubtoolProp,
  },
  ref,
) {
  const [toolInternal, setToolInternal] = useState<Tool>('select')
  const chromeParent = Boolean(
    chromeInParent &&
      embedded &&
      setToolProp &&
      setRoofSurfaceTabProp &&
      toolProp !== undefined &&
      roofSurfaceTabProp !== undefined,
  )
  const tool = chromeParent ? (toolProp === 'bulk_select' ? 'select' : toolProp!) : toolInternal
  const setTool = chromeParent ? setToolProp! : setToolInternal
  const [roofAddSubtoolInternal, setRoofAddSubtoolInternal] = useState<'surface' | 'overhang'>('surface')
  const roofAddSubtool =
    chromeParent && roofAddSubtoolProp != null ? roofAddSubtoolProp : roofAddSubtoolInternal
  const setRoofAddSubtool = chromeParent && setRoofAddSubtoolProp ? setRoofAddSubtoolProp : setRoofAddSubtoolInternal
  /** Einheitlicher Editor mit Parent-Chrome: weniger Abstand, kompaktere Fläche unter dem Plan. */
  const compactUi = chromeParent

  const [planIndexInternal, setPlanIndexInternal] = useState(0)
  const planIndex =
    embedded && typeof embedPlanIndex === 'number' && embedPlanIndex >= 0 ? embedPlanIndex : planIndexInternal
  const [plansData, setPlansData] = useState<PlanData[]>([])
  const [floorLabels, setFloorLabels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPolygonIndex, setSelectedPolygonIndex] = useState<number | null>(null)
  const [newPolygonPoints, setNewPolygonPoints] = useState<Point[] | null>(null)
  const [history, setHistory] = useState<PlanData[][]>([])
  const historyLimit = 50
  const skipNextPushRef = useRef(false)
  const plansDataRef = useRef<PlanData[]>(plansData)

  const [roofSurfaceTabInternal, setRoofSurfaceTabInternal] = useState<RoofSurfaceTab>('surfaces')
  const roofSurfaceTab = chromeParent ? roofSurfaceTabProp! : roofSurfaceTabInternal
  const setRoofSurfaceTab = chromeParent ? setRoofSurfaceTabProp! : setRoofSurfaceTabInternal
  const [newRoofDialogOpen, setNewRoofDialogOpen] = useState(false)
  const [pendingNewPoints, setPendingNewPoints] = useState<Point[] | null>(null)
  const [dialogAngle, setDialogAngle] = useState(DEFAULT_ROOF_ANGLE)
  const [dialogAngleStr, setDialogAngleStr] = useState(String(DEFAULT_ROOF_ANGLE))
  const [dialogType, setDialogType] = useState<RoofTypeId>(DEFAULT_ROOF_TYPE)
  const [sidebarAngleStr, setSidebarAngleStr] = useState('')
  const [overhangLineDialog, setOverhangLineDialog] = useState<
    null | { a: Point; b: Point; roofIndex: number; editLineIndex?: number }
  >(null)
  const overhangDialogSnapRef = useRef<typeof overhangLineDialog>(null)
  overhangDialogSnapRef.current = overhangLineDialog
  const [overhangLineKind, setOverhangLineKind] = useState<RoofOverhangEdgeKind>('traufe')
  const [overhangLineCmStr, setOverhangLineCmStr] = useState('40')
  const [pendingNewRoofWindowBbox, setPendingNewRoofWindowBbox] = useState<[number, number, number, number] | null>(null)
  const [newRoofWindowDims, setNewRoofWindowDims] = useState({ width: '', height: '' })
  const roofWindowWidthInputRef = useRef<HTMLInputElement>(null)
  const roofWindowHeightInputRef = useRef<HTMLInputElement>(null)
  const sidebarRoofTypesScrollRef = useRef<HTMLDivElement>(null)
  const dialogRoofTypesScrollRef = useRef<HTMLDivElement>(null)

  const thumbFilter =
    roofUiVariant === 'betonbot' ? 'hue-rotate(-18deg) saturate(0.85) brightness(1.08)' : undefined
  // Ensure the longest roof type label fits with a bit of extra room.
  const longestRoofTypeLabelLen = Math.max(...ROOF_TYPE_OPTIONS.map((o) => o.labelDe.length))
  // mic buffer pentru padding lateral pe etichetă (px-1 …)
  const roofTypeTileWidthRem = `${Math.max(6.8, longestRoofTypeLabelLen * 0.48 + 2.0 + 0.55).toFixed(2)}rem`

  const sidebarBar = useRoofTypeStripHorizontalBar(
    sidebarRoofTypesScrollRef,
    roofSurfaceTab === 'surfaces',
    `${roofSurfaceTab}-${selectedPolygonIndex}-${compactUi}-${planIndex}-${plansData.length}`,
  )
  const dialogBar = useRoofTypeStripHorizontalBar(
    dialogRoofTypesScrollRef,
    newRoofDialogOpen,
    `${newRoofDialogOpen}-${dialogType}`,
  )

  useEffect(() => {
    plansDataRef.current = plansData
  }, [plansData])

  useEffect(() => {
    setSelectedPolygonIndex(null)
    setNewPolygonPoints(null)
    setPendingNewRoofWindowBbox(null)
  }, [roofSurfaceTab])

  useEffect(() => {
    if (roofSurfaceTab !== 'windows') return
    if (newPolygonPoints?.length !== 2) return
    const len = plansDataRef.current.length
    if (len === 0) return
    const planIdx = Math.max(0, Math.min(planIndex, len - 1))
    const plan = plansDataRef.current[planIdx]
    if (!plan || plan.rectangles.length === 0) {
      setNewPolygonPoints(null)
      return
    }
    const [a, b] = newPolygonPoints
    const bbox: [number, number, number, number] = [
      Math.min(a[0], b[0]),
      Math.min(a[1], b[1]),
      Math.max(a[0], b[0]),
      Math.max(a[1], b[1]),
    ]
    const clipped = clipBboxToRoofRects(bbox, plan.rectangles)
    if (!clipped) {
      setNewPolygonPoints(null)
      return
    }
    setPendingNewRoofWindowBbox(clipped)
    setNewRoofWindowDims({ width: '90', height: '90' })
    setNewPolygonPoints(null)
  }, [newPolygonPoints, roofSurfaceTab, planIndex])

  const saveRoofEditsToServer = useCallback(async (): Promise<boolean> => {
    if (!offerId) return false
    const snapshot = plansDataRef.current
    if (snapshot.length === 0) return false
    try {
      const res = (await apiFetch(`/offers/${offerId}/compute/roof-review-data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plans: snapshot.map((p) => ({
            rectangles: p.rectangles,
            doors: p.doors,
            overhangLines: p.overhangLines ?? [],
          })),
        }),
      })) as { ok?: boolean }
      return res?.ok === true
    } catch (e) {
      console.error('[RoofReviewEditor] PATCH roof-review-data failed', e)
      return false
    }
  }, [offerId])

  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!offerId || loading || plansData.length === 0) return
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => {
      void saveRoofEditsToServer()
    }, 700)
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    }
  }, [plansData, offerId, loading, saveRoofEditsToServer])

  const pushHistory = useCallback(() => {
    if (skipNextPushRef.current) {
      skipNextPushRef.current = false
      return
    }
    const snap = JSON.parse(JSON.stringify(plansDataRef.current)) as PlanData[]
    if (snap.length === 0) return
    setHistory((h) => [...h.slice(-(historyLimit - 1)), snap])
  }, [])

  const handleUndo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      skipNextPushRef.current = true
      setPlansData(JSON.parse(JSON.stringify(prev)))
      return h.slice(0, -1)
    })
  }, [])

  const roofApplyToolFromParent = useCallback(
    (t: Tool) => {
      if (t === 'select') {
        setNewPolygonPoints(null)
        return
      }
      if (t === 'add') {
        setSelectedPolygonIndex(null)
        setNewPolygonPoints([])
        if (roofSurfaceTab === 'surfaces') {
          setDialogAngle(DEFAULT_ROOF_ANGLE)
          setDialogAngleStr(String(DEFAULT_ROOF_ANGLE))
          setDialogType(DEFAULT_ROOF_TYPE)
        }
      }
    },
    [roofSurfaceTab],
  )

  useImperativeHandle(
    ref,
    () => ({
      flushSave: () => saveRoofEditsToServer(),
      roofUndo: () => {
        handleUndo()
      },
      roofApplyToolFromParent,
    }),
    [saveRoofEditsToServer, handleUndo, roofApplyToolFromParent],
  )

  useEffect(() => {
    if (!embedded || typeof embedPlanIndex !== 'number' || embedPlanIndex < 0) return
    const fn = onRoofRectanglesOverlaySync
    if (!fn) return
    const plan = plansData[embedPlanIndex]
    const rects = plan?.rectangles
    const iw = plan ? Number(plan.imageWidth) || 0 : 0
    const ih = plan ? Number(plan.imageHeight) || 0 : 0
    const sourceImageDims = iw > 0 && ih > 0 ? { imageWidth: iw, imageHeight: ih } : undefined
    fn(
      embedPlanIndex,
      Array.isArray(rects)
        ? rects.map((r) => ({
            ...r,
            points: r.points.map((p) => [...p] as Point),
          }))
        : [],
      sourceImageDims,
    )
  }, [embedded, embedPlanIndex, plansData, onRoofRectanglesOverlaySync])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey
      if (!isUndo) return
      e.preventDefault()
      handleUndo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleUndo])

  /** Refetch doar la offerId / număr etaje — nu la schimbarea URL-urilor (ex. roofImages vs blueprint), ca să nu ștergem poligoanele la schimbarea tab-ului. */
  useEffect(() => {
    if (!offerId || images.length === 0) {
      setLoading(false)
      setPlansData([])
      return
    }
    let cancelled = false
    const canSeedEmbedded =
      embedded &&
      Array.isArray(embeddedPlanSeeds) &&
      embeddedPlanSeeds.length > 0 &&
      embeddedPlanSeeds.every((s) => Number(s.imageWidth) > 0 && Number(s.imageHeight) > 0)
    if (canSeedEmbedded) {
      setPlansData((prev) => {
        if (prev.length > 0) return prev
        return embeddedPlanSeeds!.map((s) => ({
          imageWidth: s.imageWidth,
          imageHeight: s.imageHeight,
          rectangles: [],
          doors: [],
          overhangLines: [],
        }))
      })
      setLoading(false)
    } else {
      setLoading(true)
    }
    const fetchWithRetry = async () => {
      let lastPlans: PlanData[] = []
      for (let attempt = 0; attempt < 14 && !cancelled; attempt++) {
        try {
          const res = (await apiFetch(`/offers/${offerId}/compute/roof-review-data?ts=${Date.now()}`)) as {
            plans?: Array<{
              imageWidth: number
              imageHeight: number
              doors?: Array<{ bbox?: number[]; width_m?: number; height_m?: number }>
              rectangles: Array<{
                points: Point[]
                roomName?: string
                roomType?: string
                roofAngleDeg?: number
                roofType?: string
                roofOverhangM?: number
              }>
            }>
            floorLabels?: string[]
          }
          const plans = Array.isArray(res?.plans) ? res.plans : []
          const normalized: PlanData[] = plans.map((p) => {
            const rectangles = (p.rectangles || []).map((r) => normalizeRect(r))
            const rawDoors = Array.isArray(p.doors) ? p.doors : []
            const doors = rawDoors.map((d) => normalizeRoofDoor(d)).filter((x): x is DoorRect => x != null)
            const doorsFiltered = filterDoorsToRoofRects(doors, rectangles)
            const rec = p as Record<string, unknown>
            const rawOh = Array.isArray(rec.overhangLines) ? rec.overhangLines : []
            const overhangLines = filterOverhangLinesForRoofCount(
              rawOh
                .map((row) => normalizeOverhangLine(row as Partial<RoofOverhangLine>))
                .filter((x): x is RoofOverhangLine => x != null),
              rectangles.length,
            )
            return {
              imageWidth: p.imageWidth,
              imageHeight: p.imageHeight,
              rectangles,
              doors: doorsFiltered,
              overhangLines,
            }
          })
          lastPlans = normalized
          if (cancelled) return
          setFloorLabels(Array.isArray(res?.floorLabels) ? res.floorLabels : [])
          if (normalized.length > 0 || attempt === 13) {
            let toSet = normalized
            if (toSet.length === 0 && canSeedEmbedded) {
              toSet = embeddedPlanSeeds!.map((s) => ({
                imageWidth: s.imageWidth,
                imageHeight: s.imageHeight,
                rectangles: [],
                doors: [],
                overhangLines: [],
              }))
            } else if (canSeedEmbedded && toSet.length > 0) {
              toSet = alignRoofPlansToEmbeddedSeeds(
                reorderRoofPlansToEmbeddedSlots(toSet, embeddedPlanSeeds!),
                embeddedPlanSeeds!,
              )
            }
            setPlansData(toSet)
            setLoading(false)
            return
          }
        } catch (_) {
          if (attempt === 13 && !cancelled) {
            if (lastPlans.length === 0 && canSeedEmbedded) {
              setPlansData(
                embeddedPlanSeeds!.map((s) => ({
                  imageWidth: s.imageWidth,
                  imageHeight: s.imageHeight,
                  rectangles: [],
                  doors: [],
                  overhangLines: [],
                })),
              )
            } else {
              setPlansData(
                canSeedEmbedded && lastPlans.length > 0
                  ? alignRoofPlansToEmbeddedSeeds(
                      reorderRoofPlansToEmbeddedSlots(lastPlans, embeddedPlanSeeds!),
                      embeddedPlanSeeds!,
                    )
                  : lastPlans,
              )
            }
            setLoading(false)
            return
          }
        }
        await new Promise((r) => setTimeout(r, 400))
      }
      if (!cancelled) setLoading(false)
    }
    void fetchWithRetry()
    return () => {
      cancelled = true
    }
  }, [offerId, images.length, embedded, embeddedPlanSeeds])

  /**
   * Editorul unificat (embedded): tab-urile de etaj urmează `images.length`, dar API-ul roof poate întoarce
   * mai puține rânduri în `plans` sau dimensiuni 0 — fără `currentPlan` și fără imageWidth/imageHeight > 0
   * canvas-ul rămâne negru (DetectionsPolygonCanvas nu desenează).
   */
  useEffect(() => {
    if (loading || images.length === 0) return
    setPlansData((prev) => {
      const refPlan = prev.find((p) => Number(p.imageWidth) > 0 && Number(p.imageHeight) > 0)
      let out = [...prev]
      let changed = false
      if (refPlan) {
        out = out.map((p) => {
          const iw = Number(p.imageWidth) || 0
          const ih = Number(p.imageHeight) || 0
          if (iw > 0 && ih > 0) return p
          changed = true
          return { ...p, imageWidth: refPlan.imageWidth, imageHeight: refPlan.imageHeight }
        })
      }
      const targetFloors = Math.max(images.length, out.length)
      if (refPlan && out.length < targetFloors) {
        while (out.length < targetFloors) {
          out.push({
            imageWidth: refPlan.imageWidth,
            imageHeight: refPlan.imageHeight,
            rectangles: [],
            doors: [],
            overhangLines: [],
          })
          changed = true
        }
      }
      return changed ? out : prev
    })
  }, [loading, images.length])

  /** Dacă niciun plan nu are dimensiuni valide, le luăm din dimensiunea naturală a blueprint-ului. */
  useEffect(() => {
    if (loading) return
    const url = images.map((i) => i.url).find((u) => typeof u === 'string' && u.length > 0)
    if (!url) return
    if (plansDataRef.current.some((p) => Number(p.imageWidth) > 0 && Number(p.imageHeight) > 0)) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (w <= 0 || h <= 0) return
      if (plansDataRef.current.some((p) => Number(p.imageWidth) > 0 && Number(p.imageHeight) > 0)) return
      setPlansData((prev) => {
        if (prev.length === 0) {
          return [{ imageWidth: w, imageHeight: h, rectangles: [], doors: [], overhangLines: [] }]
        }
        return prev.map((p) => ({
          ...p,
          imageWidth: Number(p.imageWidth) > 0 ? p.imageWidth : w,
          imageHeight: Number(p.imageHeight) > 0 ? p.imageHeight : h,
        }))
      })
    }
    img.src = url
  }, [loading, images.length])

  /** Aliniat cu DetectionsReviewEditor: batch-ul poate include base+rooms+doors per plan. */
  const blueprintBaseImages = useMemo(() => {
    const isBase = (f: ReviewImage) => {
      const c = String(f.caption ?? '').toLowerCase()
      const u = String(f.url ?? '').toLowerCase()
      return (
        c.endsWith('detections_review_base.png') ||
        u.includes('/detections_review_base.png') ||
        u.endsWith('detections_review_base.png')
      )
    }
    const bases = images.filter(isBase)
    if (bases.length > 0) return bases
    return images
  }, [images])

  const n = plansData.length > 0 ? plansData.length : Math.max(1, blueprintBaseImages.length)
  const planIndexClamped = n > 0 ? Math.max(0, Math.min(planIndex, n - 1)) : 0
  const currentPlan = plansData[planIndexClamped]
  const getBaseImageUrl = (planIdx: number) =>
    blueprintBaseImages[planIdx]?.url ?? blueprintBaseImages[0]?.url ?? images[0]?.url

  const setRectangles = useCallback((planIdx: number, rectangles: RoomPolygon[]) => {
    setPlansData((prev) => {
      const next = [...prev]
      if (planIdx >= next.length) return next
      const prevPlan = next[planIdx]
      const doors = filterDoorsToRoofRects(prevPlan.doors, rectangles)
      const overhangLines = filterOverhangLinesForRoofCount(prevPlan.overhangLines, rectangles.length)
      next[planIdx] = { ...prevPlan, rectangles, doors, overhangLines }
      return next
    })
  }, [])

  const setPlanDoors = useCallback((planIdx: number, incoming: DoorRect[]) => {
    setPlansData((prev) => {
      const next = [...prev]
      if (planIdx >= next.length) return next
      const rects = next[planIdx].rectangles
      const prevDoors = next[planIdx].doors
      const merged = incoming
        .map((d, i) => {
          const c = clipBboxToRoofRects(d.bbox, rects)
          if (c) return { ...d, bbox: c }
          const fallback = prevDoors[i]
          if (fallback && bboxFullyInsideSomeRoofRect(fallback.bbox, rects)) return fallback
          return d
        })
        .filter((d) => bboxFullyInsideSomeRoofRect(d.bbox, rects))
      next[planIdx] = { ...next[planIdx], doors: merged }
      return next
    })
  }, [])

  const roofAngleUndoPushedRef = useRef(false)
  useEffect(() => {
    roofAngleUndoPushedRef.current = false
  }, [selectedPolygonIndex])

  /** Actualizare funcțională – evită stale state când schimbi tipul de acoperiș de mai multe ori la rând. */
  const updateSelectedRoofMeta = useCallback(
    (patch: Partial<{ roofAngleDeg: number; roofType: RoofTypeId }>) => {
      if (selectedPolygonIndex == null) return
      const polyIdx = selectedPolygonIndex
      const pIdx = planIndexClamped
      setPlansData((prev) => {
        if (pIdx >= prev.length) return prev
        const plan = prev[pIdx]
        const rectangles = plan.rectangles.map((r, ri) =>
          ri !== polyIdx ? r : normalizeRect({ ...r, ...patch, points: r.points }),
        )
        const next = [...prev]
        next[pIdx] = { ...plan, rectangles }
        return next
      })
    },
    [selectedPolygonIndex, planIndexClamped],
  )

  const handleConfirm = useCallback(async () => {
    const withTimeout = <T,>(p: Promise<T>, ms: number) =>
      Promise.race<T | null>([
        p,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
      ])

    // Nu blocăm închiderea editorului pe API lent.
    const okMaybe = await withTimeout(saveRoofEditsToServer(), 2500)
    if (offerId && okMaybe !== true) {
      // Retry best-effort în background.
      setTimeout(() => { void saveRoofEditsToServer() }, 150)
    }
    await onConfirm()
  }, [offerId, onConfirm, saveRoofEditsToServer])

  const confirmNewRoofDialog = useCallback(() => {
    if (!pendingNewPoints || pendingNewPoints.length < 3 || !currentPlan) return
    pushHistory()
    const label = nextRoofLabel(currentPlan.rectangles)
    const angleDeg = parseDecimalField(dialogAngleStr, 0, 60) ?? dialogAngle
    setRectangles(planIndexClamped, [
      ...currentPlan.rectangles,
      normalizeRect({
        points: [...pendingNewPoints],
        roomName: label,
        roofAngleDeg: angleDeg,
        roofType: dialogType,
        roofOverhangM: 0,
      }),
    ])
    setPendingNewPoints(null)
    setNewRoofDialogOpen(false)
    setDialogAngle(DEFAULT_ROOF_ANGLE)
    setDialogAngleStr(String(DEFAULT_ROOF_ANGLE))
    setDialogType(DEFAULT_ROOF_TYPE)
    setTool('add')
  }, [pendingNewPoints, currentPlan, pushHistory, setRectangles, planIndexClamped, dialogAngle, dialogAngleStr, dialogType, setTool])

  const cancelNewRoofDialog = useCallback(() => {
    setPendingNewPoints(null)
    setNewRoofDialogOpen(false)
    setDialogAngle(DEFAULT_ROOF_ANGLE)
    setDialogAngleStr(String(DEFAULT_ROOF_ANGLE))
    setDialogType(DEFAULT_ROOF_TYPE)
    setTool('select')
  }, [])

  const handleRoofOverhangLineComplete = useCallback(
    (a: Point, b: Point, roofIndex: number) => {
      const plan = plansDataRef.current[planIndexClamped]
      const rt = (plan?.rectangles[roofIndex]?.roofType ?? DEFAULT_ROOF_TYPE) as RoofTypeId
      const opts = edgeKindChoicesForRoofType(rt)
      setOverhangLineKind(opts[0]!.id)
      setOverhangLineCmStr('40')
      setOverhangLineDialog({ a, b, roofIndex })
    },
    [planIndexClamped],
  )

  const handleRoofOverhangLineEditRequest = useCallback(
    (lineIndex: number) => {
      const plan = plansDataRef.current[planIndexClamped]
      const line = plan?.overhangLines?.[lineIndex]
      if (!line) return
      setOverhangLineKind(line.edgeKind)
      setOverhangLineCmStr(String(line.overhangCm))
      setOverhangLineDialog({
        a: line.a,
        b: line.b,
        roofIndex: line.roofIndex,
        editLineIndex: lineIndex,
      })
    },
    [planIndexClamped],
  )

  const confirmOverhangLineDialog = useCallback(() => {
    if (!overhangLineDialog) return
    const cm = parseDecimalField(overhangLineCmStr, 0, 500)
    if (cm == null) return
    pushHistory()
    const pIdx = planIndexClamped
    const editLineIndex = overhangLineDialog.editLineIndex
    setPlansData((prev) => {
      if (pIdx >= prev.length) return prev
      const plan = prev[pIdx]
      const line: RoofOverhangLine = {
        a: overhangLineDialog.a,
        b: overhangLineDialog.b,
        roofIndex: overhangLineDialog.roofIndex,
        edgeKind: overhangLineKind,
        overhangCm: cm,
      }
      const cur = plan.overhangLines ?? []
      const nextLines =
        editLineIndex !== undefined && editLineIndex >= 0 && editLineIndex < cur.length
          ? cur.map((ln, i) => (i === editLineIndex ? line : ln))
          : [...cur, line]
      const next = [...prev]
      next[pIdx] = { ...plan, overhangLines: nextLines }
      return next
    })
    setOverhangLineDialog(null)
    setTool(editLineIndex !== undefined ? 'select' : 'add')
  }, [overhangLineDialog, overhangLineCmStr, overhangLineKind, pushHistory, planIndexClamped, setTool])

  const cancelOverhangLineDialog = useCallback(() => {
    const prevDlg = overhangDialogSnapRef.current
    setOverhangLineDialog(null)
    setTool(prevDlg != null && prevDlg.editLineIndex !== undefined ? 'select' : 'add')
  }, [setTool])

  const handleRemoveRoofOverhangLine = useCallback(
    (lineIndex: number) => {
      pushHistory()
      const pIdx = planIndexClamped
      setPlansData((prev) => {
        if (pIdx >= prev.length) return prev
        const plan = prev[pIdx]
        const cur = plan.overhangLines ?? []
        if (lineIndex < 0 || lineIndex >= cur.length) return prev
        const nextLines = cur.filter((_, i) => i !== lineIndex)
        const next = [...prev]
        next[pIdx] = { ...plan, overhangLines: nextLines }
        return next
      })
    },
    [planIndexClamped, pushHistory],
  )

  const handleRoofOverhangLinesChange = useCallback(
    (lines: RoofOverhangLine[]) => {
      const pIdx = planIndexClamped
      setPlansData((prev) => {
        if (pIdx >= prev.length) return prev
        const plan = prev[pIdx]
        const nRect = plan.rectangles.length
        const safe = filterOverhangLinesForRoofCount(lines, nRect)
        const next = [...prev]
        next[pIdx] = { ...plan, overhangLines: safe }
        return next
      })
    },
    [planIndexClamped],
  )

  const handleCreateRoofWindow = useCallback(() => {
    if (!pendingNewRoofWindowBbox || !currentPlan) return
    const wCm = Number(String(newRoofWindowDims.width).replace(',', '.'))
    const hCm = Number(String(newRoofWindowDims.height).replace(',', '.'))
    const width = Math.round((wCm / 100) * 1000) / 1000
    const height = Math.round((hCm / 100) * 1000) / 1000
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
    if (!bboxFullyInsideSomeRoofRect(pendingNewRoofWindowBbox, currentPlan.rectangles)) return
    pushHistory()
    setPlanDoors(planIndexClamped, [
      ...currentPlan.doors,
      {
        bbox: pendingNewRoofWindowBbox,
        type: 'window',
        width_m: width,
        height_m: height,
        dimensionsEdited: true,
      },
    ])
    setPendingNewRoofWindowBbox(null)
    setNewRoofWindowDims({ width: '', height: '' })
  }, [
    pendingNewRoofWindowBbox,
    currentPlan,
    newRoofWindowDims,
    planIndexClamped,
    pushHistory,
    setPlanDoors,
  ])

  useEffect(() => {
    if (!pendingNewRoofWindowBbox) return
    const id = window.requestAnimationFrame(() => {
      const el = roofWindowWidthInputRef.current
      el?.focus()
      el?.select()
    })
    return () => window.cancelAnimationFrame(id)
  }, [pendingNewRoofWindowBbox])

  const selectedRect =
    roofSurfaceTab === 'surfaces' && selectedPolygonIndex != null && currentPlan
      ? currentPlan.rectangles[selectedPolygonIndex]
      : null

  useEffect(() => {
    if (!selectedRect) {
      setSidebarAngleStr('')
      return
    }
    setSidebarAngleStr(String(selectedRect.roofAngleDeg ?? DEFAULT_ROOF_ANGLE))
  }, [roofSurfaceTab, selectedPolygonIndex, selectedRect?.roofAngleDeg])

  useEffect(() => {
    if (roofSurfaceTab !== 'surfaces' || !selectedRect) return
    const id = (selectedRect.roofType ?? DEFAULT_ROOF_TYPE) as string
    const root = sidebarRoofTypesScrollRef.current
    requestAnimationFrame(() => scrollRoofTypeTileIntoView(root, id))
  }, [roofSurfaceTab, selectedPolygonIndex, selectedRect?.roofType])

  useEffect(() => {
    if (!newRoofDialogOpen) return
    const id = dialogType as string
    const root = dialogRoofTypesScrollRef.current
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollRoofTypeTileIntoView(root, id))
    })
  }, [newRoofDialogOpen, dialogType])

  const selectedRoofWindow =
    roofSurfaceTab === 'windows' && selectedPolygonIndex != null && currentPlan
      ? currentPlan.doors[selectedPolygonIndex]
      : null

  const updateSelectedRoofWindowCm = useCallback(
    (axis: 'width_m' | 'height_m', raw: string) => {
      if (selectedPolygonIndex === null || !currentPlan || selectedPolygonIndex >= currentPlan.doors.length) return
      const v = Number(String(raw).replace(',', '.'))
      if (!Number.isFinite(v) || v <= 0) return
      const m = Math.round((v / 100) * 1000) / 1000
      pushHistory()
      setPlanDoors(
        planIndexClamped,
        currentPlan.doors.map((d, i) =>
          i !== selectedPolygonIndex ? d : { ...d, [axis]: m, dimensionsEdited: true },
        ),
      )
    },
    [selectedPolygonIndex, currentPlan, planIndexClamped, pushHistory, setPlanDoors],
  )

  const roofToolHint =
    roofSurfaceTab === 'windows'
      ? tool === 'select'
        ? 'Element wählen und ziehen zum Verschieben'
        : tool === 'add'
          ? 'Zwei Ecken für Dachfenster setzen (Rechteck)'
          : tool === 'remove'
            ? 'Klicken Sie auf ein Element, um es zu entfernen'
            : tool === 'edit'
              ? 'Eckpunkte ziehen; auf Kante klicken = neuer Punkt; Kante ziehen = Segment verschieben'
              : ''
      : tool === 'select'
        ? 'Auf Element klicken und ziehen zum Verschieben'
        : tool === 'add'
          ? roofAddSubtool === 'overhang'
            ? 'Zwei Punkte auf dem Rand einer bestehenden Dachfläche – nur auf Kanten'
            : 'Klicken Sie um Punkte zu setzen – ersten Punkt erneut klicken zum Schließen'
          : tool === 'remove'
            ? 'Klicken Sie auf eine Fläche bzw. Überhang-Linie zum Entfernen'
            : tool === 'edit'
              ? 'Dachfläche: Ecken/Kanten wie zuvor. Überhang: Griffe der gewählten Linie zuerst. Entf/⌫: gewählte Überhang-Linie löschen. Reiter Überhang/Dachfläche: jeweils der andere Typ ausgegraut.'
              : ''

  /** Wie Fenster/Türen: Maße oben in der Leiste, sobald Dachfenster gewählt + Werkzeug „Verschieben“. */
  const roofWindowDimsToolbar =
    roofSurfaceTab === 'windows' && tool === 'select' && selectedRoofWindow ? (
      <div className="shrink-0 flex items-center justify-center gap-2 px-2 py-1.5 flex-wrap">
        <span className="text-sand/70 text-xs">Maße (cm):</span>
        <span className="text-sand/70 text-xs">B:</span>
        <input
          type="number"
          min={1}
          step={1}
          value={
            typeof selectedRoofWindow.width_m === 'number' && Number.isFinite(selectedRoofWindow.width_m)
              ? Math.round(selectedRoofWindow.width_m * 100)
              : ''
          }
          onChange={(e) => updateSelectedRoofWindowCm('width_m', e.target.value)}
          className="w-[84px] rounded bg-black/40 border border-white/20 px-2 py-1 text-xs text-white"
        />
        <span className="text-sand/70 text-xs">L:</span>
        <input
          type="number"
          min={1}
          step={1}
          value={
            typeof selectedRoofWindow.height_m === 'number' && Number.isFinite(selectedRoofWindow.height_m)
              ? Math.round(selectedRoofWindow.height_m * 100)
              : ''
          }
          onChange={(e) => updateSelectedRoofWindowCm('height_m', e.target.value)}
          className="w-[84px] rounded bg-black/40 border border-white/20 px-2 py-1 text-xs text-white"
        />
      </div>
    ) : null

  /** Aufstockung vector overlay: același dreptunghi ca DetectionsPolygonCanvas de dedesubt ca `fit`/`wheel` să coincidă. */
  const stackedVectorOverlay = Boolean(vectorOverlayOnly)
  const roofMetaPanelPaddingClass =
    compactUi ? 'p-1.5 max-h-[min(28vh,240px)] overflow-y-auto overflow-x-hidden' : 'p-2'
  const roofBlueprintShellClass = vectorOverlayOnly
    ? stackedVectorOverlay
      ? 'relative flex h-full w-full min-h-0 flex-1 overflow-hidden rounded-lg border-0 bg-transparent ring-0'
      : 'relative flex min-h-0 w-full flex-1 overflow-hidden rounded-lg border-0 bg-transparent ring-0'
    : 'relative flex min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-[#FF9F0F]/50 bg-black/30 ring-1 ring-[#FF9F0F]/30'
  const roofMetaOuterClass = stackedVectorOverlay
    ? `pointer-events-auto relative z-20 mb-0 w-full rounded-xl border border-coffee-650 bg-coffee-800 space-y-2 shadow-soft ${roofMetaPanelPaddingClass}`
    : `relative z-10 mb-1.5 shrink-0 -translate-y-0.5 rounded-xl border border-coffee-650 bg-coffee-800 space-y-2 shadow-soft ${roofMetaPanelPaddingClass}`
  const blueprintRootClass = stackedVectorOverlay
    ? 'relative flex min-h-0 min-w-0 flex-1 overflow-hidden'
    : 'flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden px-2'
  const blueprintAreaWrapClass = stackedVectorOverlay
    ? 'absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden'
    : 'flex min-h-0 flex-1 flex-col gap-1 overflow-hidden'
  const metaWrapClass = stackedVectorOverlay
    ? 'pointer-events-none absolute inset-x-2 bottom-2 z-20 flex justify-center'
    : 'shrink-0'

  return (
    <div
      className={`relative w-full flex flex-col flex-1 min-h-0 h-full max-h-full overflow-hidden ${
        compactUi ? 'gap-1.5' : 'gap-3'
      }`}
    >
      {!embedded && (
        <div className="shrink-0 px-2 pt-1 pb-0">
          <h2 className="text-white font-semibold text-base text-center">Dach konfigurieren</h2>
        </div>
      )}

      {!chromeParent && (
        <>
      {/* Aceeași ordine ca în DetectionsReviewEditor: Werkzeuge → rând secundar (ca „Element:“) → Hinweis → Etage */}
      <div className="shrink-0 flex flex-wrap items-center justify-center gap-3 px-2 py-1">
        <span className="text-sand/60 text-xs">Werkzeuge:</span>
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              setTool('select')
              setNewPolygonPoints(null)
            }}
            title="Auswählen & Verschieben"
            className={`p-2 rounded-lg transition-colors cursor-pointer ${tool === 'select' ? 'bg-[#FF9F0F]/20 text-[#FF9F0F]' : 'text-sand/70 hover:bg-white/5'}`}
          >
            <MousePointer2 size={18} />
          </button>
          <span className="text-[10px] text-sand/60">Verschieben</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            disabled={roofSurfaceTab === 'windows' && (!currentPlan || currentPlan.rectangles.length === 0)}
            title={
              roofSurfaceTab === 'windows' && (!currentPlan || currentPlan.rectangles.length === 0)
                ? 'Zuerst Dachflächen anlegen'
                : roofSurfaceTab === 'surfaces'
                  ? 'Polygon (Dachfläche) hinzufügen'
                  : 'Dachfenster hinzufügen'
            }
            onClick={() => {
              setTool('add')
              setSelectedPolygonIndex(null)
              setNewPolygonPoints([])
              if (roofSurfaceTab === 'surfaces') {
                setDialogAngle(DEFAULT_ROOF_ANGLE)
                setDialogAngleStr(String(DEFAULT_ROOF_ANGLE))
                setDialogType(DEFAULT_ROOF_TYPE)
              }
            }}
            className={`p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${tool === 'add' ? 'bg-[#FF9F0F]/20 text-[#FF9F0F]' : 'text-sand/70 hover:bg-white/5'}`}
          >
            <Plus size={18} />
          </button>
          <span className="text-[10px] text-sand/60">Hinzufügen</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={() => setTool('remove')}
            title="Klicken Sie auf ein Element zum Entfernen"
            className={`p-2 rounded-lg transition-colors cursor-pointer ${tool === 'remove' ? 'bg-[#FF9F0F]/20 text-[#FF9F0F]' : 'text-sand/70 hover:bg-white/5'}`}
          >
            <Trash2 size={18} />
          </button>
          <span className="text-[10px] text-sand/60">Löschen</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={() => setTool('edit')}
            title="Bearbeiten: auf Element klicken, Ecken/Kanten ziehen"
            className={`p-2 rounded-lg transition-colors cursor-pointer ${tool === 'edit' ? 'bg-[#FF9F0F]/20 text-[#FF9F0F]' : 'text-sand/70 hover:bg-white/5'}`}
          >
            <Pencil size={18} />
          </button>
          <span className="text-[10px] text-sand/60">Bearbeiten</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Rückgängig"
            className="p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-sand/70 hover:bg-white/5"
          >
            <Undo2 size={18} />
          </button>
          <span className="text-[10px] text-sand/60">Rückgängig</span>
        </div>
      </div>

      {!chromeParent && roofSurfaceTab === 'surfaces' && tool === 'add' && (
        <div className="shrink-0 flex items-center justify-center gap-2 px-2 py-1.5 flex-wrap">
          <span className="text-sand/70 text-xs w-full text-center sm:w-auto">Element:</span>
          <button
            type="button"
            onClick={() => setRoofAddSubtool('surface')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${roofAddSubtool === 'surface' ? 'bg-[#FF9F0F]/25 text-[#FF9F0F] border border-[#FF9F0F]/50' : 'text-sand/70 border border-white/10 hover:bg-white/5'}`}
          >
            Dachfläche
          </button>
          <button
            type="button"
            disabled={!currentPlan || currentPlan.rectangles.length === 0}
            title={
              !currentPlan || currentPlan.rectangles.length === 0
                ? 'Zuerst mindestens eine Dachfläche anlegen'
                : 'Überhang-Linie auf einer Kante'
            }
            onClick={() => setRoofAddSubtool('overhang')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${roofAddSubtool === 'overhang' ? 'bg-[#FF9F0F]/25 text-[#FF9F0F] border border-[#FF9F0F]/50' : 'text-sand/70 border border-white/10 hover:bg-white/5'}`}
          >
            Überhang
          </button>
        </div>
      )}

      <div className="shrink-0 flex items-center justify-center gap-2 px-2 py-1.5 flex-wrap">
        <span className="text-sand/70 text-xs w-full text-center sm:w-auto">Ansicht:</span>
        <button
          type="button"
          onClick={() => {
            setRoofSurfaceTab('surfaces')
            setSelectedPolygonIndex(null)
            setNewPolygonPoints(null)
            if (tool === 'add') setTool('select')
          }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${roofSurfaceTab === 'surfaces' ? 'bg-[#FF9F0F]/25 text-[#FF9F0F] border border-[#FF9F0F]/50' : 'text-sand/70 border border-white/10 hover:bg-white/5'}`}
        >
          Dachflächen
        </button>
        <button
          type="button"
          onClick={() => {
            setRoofSurfaceTab('windows')
            setSelectedPolygonIndex(null)
            setNewPolygonPoints(null)
            if (tool === 'add') setTool('select')
          }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${roofSurfaceTab === 'windows' ? 'bg-[#FF9F0F]/25 text-[#FF9F0F] border border-[#FF9F0F]/50' : 'text-sand/70 border border-white/10 hover:bg-white/5'}`}
        >
          Dachfenster
        </button>
      </div>

      {roofWindowDimsToolbar}

      {roofToolHint && (
        <p className="shrink-0 text-xs text-sand/60 text-center px-4">{roofToolHint}</p>
      )}
        </>
      )}

      {chromeParent &&
        roofWindowDimsToolbar &&
        (dimsToolbarPortalTarget
          ? createPortal(roofWindowDimsToolbar, dimsToolbarPortalTarget)
          : roofWindowDimsToolbar)}

      {!loading && n > 1 && !embedded && (
        <div className="shrink-0 flex flex-wrap items-center justify-center gap-1 px-2 py-2 border-b border-white/10">
          {Array.from({ length: n }).map((_, i) => (
            <button
              key={`roof-floor-tab-${i}`}
              type="button"
              onClick={() => {
                setPlanIndexInternal(i)
                setSelectedPolygonIndex(null)
                setNewPolygonPoints(null)
                setRoofSurfaceTab('surfaces')
                if (tool === 'add') setTool('select')
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${planIndexClamped === i ? 'bg-[#FF9F0F]/25 text-[#FF9F0F] border border-[#FF9F0F]/50' : 'text-sand/80 border border-white/10 hover:bg-white/5'}`}
            >
              {roofPlanLabelDe(floorLabels, i)}
            </button>
          ))}
        </div>
      )}

      {/* Blueprint: flex-1 + min-h-0 pe tot lanțul ca panoul de jos să nu „taie” peste canvas (min-height:auto). */}
      <div className={blueprintRootClass}>
        <div className={blueprintAreaWrapClass}>
          {currentPlan && getBaseImageUrl(planIndexClamped) && (
              <div className={roofBlueprintShellClass}>
                {pendingNewRoofWindowBbox && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 rounded-lg">
                    <div className="w-[300px] rounded-xl border border-[#FF9F0F]/60 bg-[#1a1a1a] p-3 space-y-2">
                      <div className="text-white text-sm font-medium text-center">Dachfenster – Maße (cm)</div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sand/70 text-xs">
                          Breite (cm)
                          <input
                            ref={roofWindowWidthInputRef}
                            type="number"
                            min={1}
                            step={1}
                            placeholder="z. B. 90"
                            value={newRoofWindowDims.width}
                            onChange={(e) => setNewRoofWindowDims((p) => ({ ...p, width: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return
                              e.preventDefault()
                              roofWindowHeightInputRef.current?.focus()
                              roofWindowHeightInputRef.current?.select()
                            }}
                            className="mt-0.5 w-full rounded-md bg-black/40 border border-white/20 text-white px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="text-sand/70 text-xs">
                          Länge (cm)
                          <input
                            ref={roofWindowHeightInputRef}
                            type="number"
                            min={1}
                            step={1}
                            placeholder="z. B. 120"
                            value={newRoofWindowDims.height}
                            onChange={(e) => setNewRoofWindowDims((p) => ({ ...p, height: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return
                              e.preventDefault()
                              handleCreateRoofWindow()
                            }}
                            className="mt-0.5 w-full rounded-md bg-black/40 border border-white/20 text-white px-2 py-1 text-sm"
                          />
                        </label>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPendingNewRoofWindowBbox(null)
                            setNewRoofWindowDims({ width: '', height: '' })
                          }}
                          className="text-sand/60 text-xs hover:underline"
                        >
                          Abbrechen
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateRoofWindow}
                          className="rounded bg-[#FF9F0F]/25 border border-[#FF9F0F]/60 px-3 py-1 text-xs text-[#FF9F0F]"
                        >
                          Speichern
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {roofSurfaceTab === 'surfaces' ? (
                  <DetectionsPolygonCanvas
                    key={`roof-plan-${planIndexClamped}-surf`}
                    className="block h-full w-full min-h-0"
                    hideBasemap={vectorOverlayOnly}
                    layoutActive={layoutActive}
                    imageUrl={getBaseImageUrl(planIndexClamped)!}
                    imageWidth={currentPlan.imageWidth}
                    imageHeight={currentPlan.imageHeight}
                    rooms={currentPlan.rectangles}
                    doors={[]}
                    tab="rooms"
                    tool={tool}
                    dimUnselectedRoomPolygons
                    selectedIndex={selectedPolygonIndex}
                    newPoints={tool === 'add' && roofAddSubtool === 'surface' ? newPolygonPoints : null}
                    roomsAddMode={roofAddSubtool === 'overhang' ? 'roof_overhang_line' : 'polygon'}
                    onRoofOverhangLineComplete={handleRoofOverhangLineComplete}
                    onRoofOverhangLineEditRequest={handleRoofOverhangLineEditRequest}
                    roofOverhangLines={currentPlan.overhangLines ?? []}
                    onRemoveRoofOverhangLine={handleRemoveRoofOverhangLine}
                    onRoofOverhangLinesChange={handleRoofOverhangLinesChange}
                    onSelect={setSelectedPolygonIndex}
                    onAddPoint={(x, y) => setNewPolygonPoints((prev) => (prev ? [...prev, [x, y]] : [[x, y]]))}
                    onCloseNewPolygon={() => {
                      if (!newPolygonPoints || newPolygonPoints.length < 3) return
                      setPendingNewPoints([...newPolygonPoints])
                      setNewPolygonPoints(null)
                      setDialogAngle(DEFAULT_ROOF_ANGLE)
                      setDialogAngleStr(String(DEFAULT_ROOF_ANGLE))
                      setDialogType(DEFAULT_ROOF_TYPE)
                      setNewRoofDialogOpen(true)
                    }}
                    onMoveVertex={(polyIndex, vertexIndex, x, y) => {
                      const pIdx = planIndexClamped
                      setPlansData((prev) => {
                        if (pIdx >= prev.length) return prev
                        const plan = prev[pIdx]
                        const beforePts = plan.rectangles[polyIndex]?.points?.map((p) => [p[0], p[1]] as Point)
                        const rectangles = plan.rectangles.map((r, ri) =>
                          ri !== polyIndex
                            ? r
                            : {
                                ...r,
                                points: r.points.map((p, vi) => (vi === vertexIndex ? ([x, y] as Point) : p)),
                              },
                        )
                        const afterPts = rectangles[polyIndex]?.points
                        const doors = filterDoorsToRoofRects(plan.doors, rectangles)
                        let overhangLines = filterOverhangLinesForRoofCount(plan.overhangLines, rectangles.length)
                        if (beforePts && afterPts) {
                          overhangLines = transformRoofOverhangLinesWithPolygon(
                            overhangLines,
                            polyIndex,
                            beforePts,
                            afterPts,
                          )
                        }
                        const next = [...prev]
                        next[pIdx] = { ...plan, rectangles, doors, overhangLines }
                        return next
                      })
                    }}
                    onRemoveSelected={(index?: number) => {
                      const idx = index ?? selectedPolygonIndex
                      if (idx == null || idx < 0) return
                      pushHistory()
                      setRectangles(planIndexClamped, currentPlan.rectangles.filter((_, i) => i !== idx))
                      setSelectedPolygonIndex(null)
                    }}
                    onRoomsChange={(rooms) => setRectangles(planIndexClamped, rooms.map((r) => normalizeRect(r)))}
                    onDoorsChange={() => {}}
                    onEditStart={pushHistory}
                    stackedView={stackedView}
                    onStackedViewChange={onStackedViewChange}
                  />
                ) : (
                  <DetectionsPolygonCanvas
                    key={`roof-plan-${planIndexClamped}-win`}
                    className="block h-full w-full min-h-0"
                    hideBasemap={vectorOverlayOnly}
                    layoutActive={layoutActive}
                    imageUrl={getBaseImageUrl(planIndexClamped)!}
                    imageWidth={currentPlan.imageWidth}
                    imageHeight={currentPlan.imageHeight}
                    rooms={currentPlan.rectangles}
                    doors={currentPlan.doors}
                    tab="doors"
                    tool={tool}
                    newDoorType="window"
                    showRoomPolygonsUnderDoors
                    highlightRoofSurfaceUnderlay
                    selectedIndex={selectedPolygonIndex}
                    newPoints={tool === 'add' ? newPolygonPoints : null}
                    onSelect={setSelectedPolygonIndex}
                    onAddPoint={(x, y) => setNewPolygonPoints((prev) => (prev ? [...prev, [x, y]] : [[x, y]]))}
                    onCloseNewPolygon={() => {}}
                    onMoveVertex={(polyIndex, vertexIndex, x, y) => {
                      const d = currentPlan.doors[polyIndex]
                      if (!d) return
                      const [x1, y1, x2, y2] = d.bbox
                      const corners: Point[] = [
                        [x1, y1],
                        [x2, y1],
                        [x2, y2],
                        [x1, y2],
                      ]
                      corners[vertexIndex] = [x, y]
                      let nx1 = Math.min(...corners.map((c) => c[0]))
                      let nx2 = Math.max(...corners.map((c) => c[0]))
                      let ny1 = Math.min(...corners.map((c) => c[1]))
                      let ny2 = Math.max(...corners.map((c) => c[1]))
                      const minPx = 1
                      if (nx2 - nx1 < minPx) nx2 = nx1 + minPx
                      if (ny2 - ny1 < minPx) ny2 = ny1 + minPx
                      const nextBbox: [number, number, number, number] = [nx1, ny1, nx2, ny2]
                      const clipped = clipBboxToRoofRects(nextBbox, currentPlan.rectangles)
                      if (!clipped) return
                      setPlanDoors(
                        planIndexClamped,
                        currentPlan.doors.map((dr, ri) => (ri !== polyIndex ? dr : { ...dr, bbox: clipped })),
                      )
                    }}
                    onRemoveSelected={(index?: number) => {
                      const idx = index ?? selectedPolygonIndex
                      if (idx == null || idx < 0) return
                      pushHistory()
                      setPlanDoors(
                        planIndexClamped,
                        currentPlan.doors.filter((_, i) => i !== idx),
                      )
                      setSelectedPolygonIndex(null)
                    }}
                    onRoomsChange={() => {}}
                    onDoorsChange={(doors) => setPlanDoors(planIndexClamped, doors)}
                    onEditStart={pushHistory}
                    stackedView={stackedView}
                    onStackedViewChange={onStackedViewChange}
                  />
                )}
              </div>
          )}
        </div>

        <div className={metaWrapClass}>
        {/* Unter dem Plan: Dachflächen (Neigung/Typ) — fundal coffee (temă), ușor mai jos față de varianta anterioară. */}
        <div className={roofMetaOuterClass}>
          {roofSurfaceTab === 'windows' ? (
            <div className="text-sm text-white space-y-1">
              <p className="text-sand/80 text-xs font-normal leading-snug">
                Öffnungen im Plan markieren; nach dem Aufziehen Breite und Länge in cm eingeben. Gewählt: Maße oben
                (cm) bearbeiten.
              </p>
            </div>
          ) : (
            <>
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="text-sm text-white font-medium min-w-0 flex-1 pr-1">
              {selectedRect ? (
                <div className="space-y-0.5">
                  <div>
                    Dachfläche{' '}
                    {formatRoofSurfaceCanvasLabel(
                      selectedRect,
                      typeof selectedPolygonIndex === 'number' ? selectedPolygonIndex : 0,
                    )}
                  </div>
                  <div className="text-sand/80 text-xs font-normal">
                    {roofTypeLabelDe((selectedRect.roofType ?? DEFAULT_ROOF_TYPE) as RoofTypeId)}
                  </div>
                </div>
              ) : (
                <span className="text-sand/70 font-normal text-xs sm:text-sm leading-snug">
                  Dachfläche im Plan anklicken – dann Neigung und Typ bearbeiten
                </span>
              )}
            </div>
            <div className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:gap-x-3">
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-sand/70 text-[11px] sm:text-xs whitespace-nowrap">Neigung (°)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  disabled={!selectedRect}
                  className="w-[4.25rem] sm:w-[4.75rem] px-1.5 py-1 rounded bg-black/40 border border-white/20 text-white text-xs sm:text-sm tabular-nums disabled:opacity-45 disabled:cursor-not-allowed"
                  value={selectedRect ? sidebarAngleStr : ''}
                  placeholder="—"
                  onFocus={() => {
                    if (!selectedRect) return
                    if (!roofAngleUndoPushedRef.current) {
                      pushHistory()
                      roofAngleUndoPushedRef.current = true
                    }
                  }}
                  onBlur={() => {
                    roofAngleUndoPushedRef.current = false
                    if (!selectedRect) return
                    const v = parseDecimalField(sidebarAngleStr, 0, 60)
                    if (v != null) updateSelectedRoofMeta({ roofAngleDeg: v })
                    else setSidebarAngleStr(String(selectedRect.roofAngleDeg ?? DEFAULT_ROOF_ANGLE))
                  }}
                  onChange={(e) => {
                    if (!selectedRect) return
                    const raw = e.target.value.replace(',', '.')
                    setSidebarAngleStr(raw)
                    const v = parseDecimalField(raw, 0, 60)
                    if (v != null) updateSelectedRoofMeta({ roofAngleDeg: v })
                  }}
                />
              </div>
            </div>
          </div>
          <div className={`flex w-full min-w-0 items-start ${compactUi ? 'gap-2' : 'gap-2.5'}`}>
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <span className="text-sand/50 text-xs">Typ</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div
                ref={sidebarRoofTypesScrollRef}
                onScroll={sidebarBar.onScroll}
                className="roof-type-strip-scroll w-full max-w-full scroll-smooth [-webkit-overflow-scrolling:touch]"
              >
                <div
                  className={`mx-auto flex w-max flex-nowrap items-stretch ${compactUi ? 'gap-2' : 'gap-2.5'}`}
                >
                  {ROOF_TYPE_OPTIONS.map((opt) => {
                    const hasSelection = selectedRect != null
                    const active = hasSelection && (selectedRect!.roofType ?? DEFAULT_ROOF_TYPE) === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-roof-type={opt.id}
                        style={{
                          width: roofTypeTileWidthRem,
                          minWidth: roofTypeTileWidthRem,
                          maxWidth: roofTypeTileWidthRem,
                          boxSizing: 'border-box',
                        }}
                        disabled={!hasSelection}
                        onClick={() => {
                          if (!selectedRect) return
                          pushHistory()
                          if (opt.id === '0_w') {
                            updateSelectedRoofMeta({ roofType: opt.id, roofAngleDeg: 0 })
                          } else {
                            updateSelectedRoofMeta({ roofType: opt.id, roofAngleDeg: DEFAULT_ROOF_ANGLE })
                          }
                        }}
                        className={`box-border flex shrink-0 flex-col items-center gap-1 rounded-lg border px-1 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          hasSelection ? 'cursor-pointer' : ''
                        } ${
                          active
                            ? 'border-[#FF9F0F] ring-1 ring-[#FF9F0F]/50 bg-[#FF9F0F]/10'
                            : 'border-white/15 hover:bg-white/5'
                        }`}
                      >
                        <img
                          src={opt.image}
                          alt={opt.labelDe}
                          className={
                            compactUi
                              ? 'w-full h-9 sm:h-10 object-contain rounded-md bg-white ring-1 ring-black/10 pointer-events-none'
                              : 'w-full h-14 sm:h-16 object-contain rounded-md bg-white ring-1 ring-black/10 pointer-events-none'
                          }
                          style={thumbFilter ? { filter: thumbFilter } : undefined}
                        />
                        <span className="block w-full min-w-0 box-border hyphens-auto px-1 py-0.5 text-center text-[11px] leading-snug text-sand/90 [overflow-wrap:anywhere] sm:px-1.5 sm:text-xs">
                          {opt.labelDe}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <RoofTypeStripScrollBar
                bar={sidebarBar.bar}
                onTrackMouseDown={sidebarBar.onTrackMouseDown}
                onThumbMouseDown={sidebarBar.onThumbMouseDown}
                roofUiVariant={roofUiVariant}
              />
            </div>
          </div>
            </>
          )}
        </div>
        </div>
      </div>

      {newRoofDialogOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 sm:p-4">
          <div
            lang="de"
            className="w-fit max-w-[calc(100vw-1.5rem)] rounded-2xl border border-[#FF9F0F]/40 bg-coffee-800/95 p-3 sm:p-4 shadow-xl space-y-3"
          >
            <h3 className="text-white font-semibold text-center text-sm sm:text-base leading-snug">
              Neues Dach – Neigung &amp; Typ
            </h3>
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 sm:gap-x-6 sm:gap-y-2">
              <label className="flex items-center gap-2 text-sand/80 text-sm">
                <span className="shrink-0">Neigung (°)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="min-w-[5rem] w-32 px-3 py-1.5 rounded-lg bg-black/40 border border-white/20 text-white text-sm tabular-nums"
                  value={dialogAngleStr}
                  onChange={(e) => {
                    const raw = e.target.value.replace(',', '.')
                    setDialogAngleStr(raw)
                    const v = parseDecimalField(raw, 0, 60)
                    if (v != null) setDialogAngle(v)
                  }}
                />
              </label>
            </div>
            {/* Aceleași carduri ca la „Typ” sub blueprint */}
            <div className="flex w-full min-w-0 flex-col justify-center">
              <div
                ref={dialogRoofTypesScrollRef}
                onScroll={dialogBar.onScroll}
                className="roof-type-strip-scroll w-full max-w-full scroll-smooth [-webkit-overflow-scrolling:touch]"
              >
                <div className="mx-auto flex w-max flex-nowrap items-stretch gap-2.5">
                {ROOF_TYPE_OPTIONS.map((opt) => {
                  const active = dialogType === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-roof-type={opt.id}
                      style={{
                        width: roofTypeTileWidthRem,
                        minWidth: roofTypeTileWidthRem,
                        maxWidth: roofTypeTileWidthRem,
                        boxSizing: 'border-box',
                      }}
                      onClick={() => {
                        setDialogType(opt.id)
                        if (opt.id === '0_w') {
                          setDialogAngle(0)
                          setDialogAngleStr('0')
                        } else {
                          setDialogAngle(DEFAULT_ROOF_ANGLE)
                          setDialogAngleStr(String(DEFAULT_ROOF_ANGLE))
                        }
                      }}
                      className={`box-border flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 py-1.5 transition ${
                        active
                          ? 'border-[#FF9F0F] ring-1 ring-[#FF9F0F]/50 bg-[#FF9F0F]/10'
                          : 'border-white/15 hover:bg-white/5'
                      }`}
                    >
                      <img
                        src={opt.image}
                        alt={opt.labelDe}
                        className="w-full h-14 sm:h-16 object-contain rounded-md bg-white ring-1 ring-black/10 pointer-events-none"
                        style={thumbFilter ? { filter: thumbFilter } : undefined}
                      />
                      <span className="block w-full min-w-0 box-border hyphens-auto px-1 py-0.5 text-center text-[11px] leading-snug text-sand/90 [overflow-wrap:anywhere] sm:px-1.5 sm:text-xs">
                        {opt.labelDe}
                      </span>
                    </button>
                  )
                })}
                </div>
              </div>
              <RoofTypeStripScrollBar
                bar={dialogBar.bar}
                onTrackMouseDown={dialogBar.onTrackMouseDown}
                onThumbMouseDown={dialogBar.onThumbMouseDown}
                roofUiVariant={roofUiVariant}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={cancelNewRoofDialog}
                className="px-4 py-2 rounded-lg border border-white/30 text-sand hover:bg-white/10"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmNewRoofDialog}
                className="px-4 py-2 rounded-lg font-semibold text-white bg-[#FF9F0F] hover:bg-[#ffb03d]"
              >
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      )}

      {overhangLineDialog && currentPlan && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-3 sm:p-4">
          <div
            lang="de"
            className="w-[min(100%,26rem)] rounded-2xl border border-[#FF9F0F]/40 bg-coffee-800/95 p-4 shadow-xl space-y-3"
          >
            <h3 className="text-white font-semibold text-center text-sm sm:text-base">
              {overhangLineDialog.editLineIndex !== undefined ? 'Überhang bearbeiten' : 'Überhang'}
            </h3>
            {(() => {
              const rt = (currentPlan.rectangles[overhangLineDialog.roofIndex]?.roofType ??
                DEFAULT_ROOF_TYPE) as RoofTypeId
              const choices = edgeKindChoicesForRoofType(rt)
              return choices.length > 1 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {choices.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setOverhangLineKind(c.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        overhangLineKind === c.id
                          ? 'bg-[#FF9F0F]/25 text-[#FF9F0F] border border-[#FF9F0F]/50'
                          : 'text-sand/70 border border-white/10 hover:bg-white/5'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sand/70 text-xs text-center">{choices[0]?.label}</p>
              )
            })()}
            <label className="block text-sand/80 text-sm">
              Überhang (cm)
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="mt-1 w-full rounded-lg bg-black/40 border border-white/20 text-white text-sm px-3 py-2 tabular-nums"
                value={overhangLineCmStr}
                onChange={(e) => setOverhangLineCmStr(e.target.value.replace(',', '.'))}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  confirmOverhangLineDialog()
                }}
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={cancelOverhangLineDialog}
                className="px-4 py-2 rounded-lg border border-white/30 text-sand hover:bg-white/10 text-sm"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmOverhangLineDialog}
                className="px-4 py-2 rounded-lg font-semibold text-white bg-[#FF9F0F] hover:bg-[#ffb03d] text-sm"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {!embedded && (
        <div className="shrink-0 flex flex-wrap items-center justify-center gap-2 px-2 pt-1 pb-2">
          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold text-[#ffffff] shadow-md bg-gradient-to-b from-[#e08414] to-[#f79116] hover:brightness-110 transition-all"
          >
            <Check size={16} strokeWidth={2.25} />
            Dach bestätigen – weiter
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-sand/90 border border-white/30 hover:bg-white/10 transition-all"
          >
            <X size={16} strokeWidth={2.25} />
            Abbrechen
          </button>
        </div>
      )}
    </div>
  )
})
