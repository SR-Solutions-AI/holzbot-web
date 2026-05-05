'use client'

import { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react'
import {
  snapToRoofEdges,
  distancePointToSegment,
  computeOverhangStrip,
  computeOverhangMiterByVertex,
  applyMitersToStripCorners,
  estimateMetersPerPixelFromRoofs,
  cloneRoofOverhangLines,
  transformRoofOverhangLinesWithPolygon,
  translateRoofOverhangLinesFromSnapshot,
  translateRoofOverhangLinesForRoofs,
  affineRoofOverhangLinesForRoofs,
  type RoofOverhangLine,
  type RoofOverhangEdgeKind,
} from '@/app/lib/roofOverhangGeometry'

export type { RoofOverhangLine, RoofOverhangEdgeKind }

export type Point = [number, number]

export type RoomPolygon = {
  points: Point[]
  roomType?: string
  roomName?: string
  /** Abweichung von der zuletzt gespeicherten KI-Erkennung (Server: detections_review vs. detections_edited). */
  editedInRun?: boolean
  /** true doar pentru „Raum gedämmt“ (zonă izolată sub acoperiș); lipsă/false = tratată ca neizolată la gedämmt */
  roomInsulated?: boolean
  /** Roof editor: pitch in degrees (0–60). */
  roofAngleDeg?: number
  /** Roof editor: e.g. 0_w, 1_w, 2_w, 4_w, 4.5_w */
  roofType?: string
  /** Roof editor: overhang in metres (shown as Dachüberstand in cm in UI). */
  roofOverhangM?: number
}
export type DoorRect = {
  bbox: [number, number, number, number]
  type?: string
  width_m?: number
  height_m?: number
  dimensionsEdited?: boolean
  /** Abweichung von der KI-Erkennung (gespeicherte Bearbeitung). */
  editedInRun?: boolean
}

/** Aufstockung Phase 1: Dachrückbau-Fläche (Polygon in Bildkoordinaten). */
export type RoofDemolitionPoly = {
  points: Point[]
  price_key?: string
  area_m2?: number
}

/** Zubau: Wandabbruch als Linie (zwei Punkte im Bild). */
export type ZubauWallLine = {
  a: Point
  b: Point
  price_key?: string
}

type PolygonCanvasProps = {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  rooms: RoomPolygon[]
  doors: DoorRect[]
  tab: 'rooms' | 'doors' | 'demolition' | 'stair_opening' | 'zubau_bestand' | 'zubau_walls'
  /** Nur tab=demolition */
  demolitionPolys?: RoofDemolitionPoly[]
  onDemolitionPolysChange?: (polys: RoofDemolitionPoly[]) => void
  zubauBestandPolys?: RoofDemolitionPoly[]
  onZubauBestandPolysChange?: (polys: RoofDemolitionPoly[]) => void
  zubauWallLines?: ZubauWallLine[]
  onZubauWallLinesChange?: (lines: ZubauWallLine[]) => void
  /** Nur tab=stair_opening (Rechteck wie Tür/Fenster) */
  stairOpeningRects?: DoorRect[]
  onStairOpeningRectsChange?: (rects: DoorRect[]) => void
  tool: 'select' | 'add' | 'remove' | 'edit' | 'bulk_select'
  selectedIndex: number | null
  newPoints: Point[] | null
  newDoorType?: 'door' | 'window' | 'garage_door' | 'stairs' | 'lift'
  onSelect: (index: number | null) => void
  onAddPoint: (x: number, y: number) => void
  onCloseNewPolygon: () => void
  onMoveVertex: (polyIndex: number, vertexIndex: number, x: number, y: number) => void
  onInsertVertex?: (polyIndex: number, afterVertexIndex: number, x: number, y: number) => void
  onRemoveSelected: (index?: number) => void
  onRoomsChange: (rooms: RoomPolygon[]) => void
  onDoorsChange: (doors: DoorRect[]) => void
  onDoorHover?: (payload: { index: number; x: number; y: number } | null) => void
  /** Apelat la tap scurt (fără drag) pe o ușă/fereastră în modul Select — ex. ciclare tip. */
  onDoorActivate?: (index: number) => void
  onRoomTypeLabelClick?: (roomIndex: number) => void
  onEditStart?: () => void
  /** Când e true și există selecție, poligoanele nealese sunt estompate (ex. roof editor). */
  dimUnselectedRoomPolygons?: boolean
  /** tab=doors: desenează mai întâi poligoanele din `rooms` ca fundal (ex. Dachflächen + Dachfenster). */
  showRoomPolygonsUnderDoors?: boolean
  /**
   * Cu `showRoomPolygonsUnderDoors`: pe tab Dachfenster evidențiază mai clar suprafețele de acoperiș (contur + etichetă).
   */
  highlightRoofSurfaceUnderlay?: boolean
  /**
   * tab=doors: Räume sind klickbar (Mehrfachauswahl / Gruppenverschieben) — z. B. Gewerbe-Wohnbau-Editor.
   */
  interactiveRoomPolygonsInDoorsTab?: boolean
  /** Schlüssel `r:0`, `d:1` für Mehrfachauswahl */
  bulkSelectedKeys?: string[]
  /** Klick auf leeren Hintergrund: `pick === null` (ohne Shift: Auswahl leeren). */
  onBulkPick?: (pick: { layer: 'room' | 'door'; index: number } | null, shiftKey: boolean) => void
  /** Rechteckauswahl in Bildkoordinaten für Mehrfachauswahl. */
  onBulkMarqueeSelect?: (rect: { x1: number; y1: number; x2: number; y2: number }, shiftKey: boolean) => void
  className?: string
  /**
   * Când devine true după ce containerul era ascuns (ex. tab Dach cu display:none), forțează recalcul fit.
   * Altfel getBoundingClientRect() rămâne 0×0 și planul pare negru până la resize/refresh.
   */
  layoutActive?: boolean
  /** Crește la schimbare tab/stack (Aufstockung Bestand) ca să forțeze `recomputeFit` după layout. */
  layoutRevealKey?: number
  /** Aufstockung Phase 1: pe tab demolare/scări, desenează și celelalte straturi (Dach + Treppenöffnung / Aufstandsfläche) estompate. */
  blendAufstockungPhase1Overlays?: boolean
  /** Zubau (etaj nou): pe Räume / Bestand / Wände — celelalte straturi Zubau rămân vizibile estompate, ca Phase 1 la Aufstockung. */
  blendZubauSiblingOverlays?: boolean
  /** Etichete poligoane Aufstandsfläche: „Aufstockungs-Basis” în loc de „Rückbau”. */
  useAufstockungsBasisDemolitionLabels?: boolean
  /** Nu desena imaginea de plan (fundal transparent) — strat vectorial peste același blueprint ca în părinte. */
  hideBasemap?: boolean
  /** Preview Dach (din roof-review-data) sub stratul interactiv, împreună cu blend Phase 1. */
  roofOverlayRooms?: RoomPolygon[]
  /** tab=rooms: add = poligon Dach (implicit) sau linie Überhang pe muchie. */
  roomsAddMode?: 'polygon' | 'roof_overhang_line'
  onRoofOverhangLineComplete?: (a: Point, b: Point, roofIndex: number) => void
  /** Select: tap pe linia Überhang → deschide dialog lungime/tip (ex. RoofReviewEditor). */
  onRoofOverhangLineEditRequest?: (lineIndex: number) => void
  /** Linii Überhang deja salvate (desenate peste contururile de acoperiș). */
  roofOverhangLines?: RoofOverhangLine[]
  onRemoveRoofOverhangLine?: (lineIndex: number) => void
  /** Bearbeiten: Endpunkte ziehen (auf Kanten einrastend); ersetzt die Liste. */
  onRoofOverhangLinesChange?: (lines: RoofOverhangLine[]) => void
  /**
   * Aufstockung Dach-Stack: același zoom/pan pe două canvas-uri (fundal + vector).
   * Când e setat, `zoom`/`pan` vin din părinte; `onStackedViewChange` pe stratul interactiv actualizează părintele.
   */
  stackedView?: { zoom: number; pan: { x: number; y: number } } | null
  onStackedViewChange?: (next: { zoom: number; pan: { x: number; y: number } }) => void
}

/** Preview semi-transparent pentru poligoane Dach (Aufstockung: același ecran cu Aufstandsfläche + Treppenöffnung). */
function drawAufstockungRoofOverlayPreview(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  s: number,
  roofOverlayRooms: RoomPolygon[],
) {
  if (roofOverlayRooms.length === 0) return
  const roofOvColors = ['#0ea5e9', '#06b6d4', '#38bdf8']
  roofOverlayRooms.forEach((room, ri) => {
    const pts = room.points
    if (pts.length < 2) return
    ctx.fillStyle = roofOvColors[ri % roofOvColors.length]
    ctx.globalAlpha = 0.18
    ctx.beginPath()
    ctx.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s)
    for (let k = 1; k < pts.length; k++) {
      ctx.lineTo(ox + pts[k][0] * s, oy + pts[k][1] * s)
    }
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = 'rgba(14,165,233,0.85)'
    ctx.lineWidth = 1.75
    ctx.stroke()
  })
}

/** Etichetă canvas pentru suprafețe de acoperiș (legacy `S0` → `Dach-Basis #1`). */
export function formatRoofSurfaceCanvasLabel(room: RoomPolygon, indexZeroBased: number): string {
  const raw = (room.roomName ?? (room as { room_name?: string }).room_name ?? room.roomType ?? '').trim()
  if (/^S\d+$/i.test(raw)) {
    const m = /^S(\d+)$/i.exec(raw)
    const n = m ? parseInt(m[1], 10) : indexZeroBased
    return `Dach-Basis #${n + 1}`
  }
  if (/^Dach-Basis\s*#\s*\d+$/i.test(raw)) return raw
  if (!raw) return `Dach-Basis #${indexZeroBased + 1}`
  return raw
}

const HANDLE_R = 6
/** Raza pentru vârfuri (Edit) – ușor de selectat (buline). */
const HIT_R = 28
/** Raza pentru muchiile poligoanelor (linii) – ușor de selectat pentru mutare perete/segment. */
const EDGE_HIT_R = 36
/** > EDGE_HIT_R: bulinele liniei Überhang *selectate* câștigă față de segmentul altei linii. */
const ROOF_OH_SELECTED_VERTEX_HIT_R = 46

/** Paletă saturată, distinctă față de poligoanele Dach (albastru/verde); o linie = o culoare. */
const OVERHANG_LINE_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [244, 63, 94],
  [249, 115, 22],
  [168, 85, 247],
  [234, 179, 8],
  [236, 72, 153],
  [6, 182, 212],
  [16, 185, 129],
  [245, 158, 11],
  [99, 102, 241],
  [217, 70, 239],
]

function overhangLineRgb(ohi: number): readonly [number, number, number] {
  return OVERHANG_LINE_PALETTE[ohi % OVERHANG_LINE_PALETTE.length]!
}

function overhangRgba(rgb: readonly [number, number, number], a: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`
}

function blendRgbTowardWhite(rgb: readonly [number, number, number], t: number): [number, number, number] {
  return [
    Math.min(255, Math.round(rgb[0] + (255 - rgb[0]) * t)),
    Math.min(255, Math.round(rgb[1] + (255 - rgb[1]) * t)),
    Math.min(255, Math.round(rgb[2] + (255 - rgb[2]) * t)),
  ]
}
/** Raza mai mare pentru colțurile ușilor/geamurilor ca să poți redimensiona ușor (nu doar muta). */
const DOOR_VERTEX_HIT_R = 24
/** Padding în px (în coordonate imagine) pentru hit-test pe uși/ferestre – ușor de apucat și mutat cu Select. */
const DOOR_HIT_PADDING = 16
/** Raza (în px canvas) la care click închide poligonul la prima apăsare */
const CLOSE_POLYGON_HIT_PX = 22
/** Mișcare maximă în px ecran pentru a considera tap (vs. drag) pe uși în Select. */
const DOOR_TAP_MAX_MOVE_PX = 8
/** Hit radius for bulk resize corner handles (image-space adjusted by zoom). */
const BULK_RESIZE_HIT_R = 20
/**
 * Zoom la wheel: trackpad-ul trimite multe evenimente cu deltaY mic — evităm factori fixi 0.9/1.1 per eveniment.
 * deltaMode LINE/PAGE e scalat la „pixeli efectivi”; exp(-dy·k) + clamp limitează salturile la rotița mouse.
 */
const WHEEL_ZOOM_SENSITIVITY = 0.00145
const WHEEL_ZOOM_FACTOR_MIN = 0.93
const WHEEL_ZOOM_FACTOR_MAX = 1.07

function wheelEventToZoomFactor(e: WheelEvent): number {
  let dy = e.deltaY
  if (e.deltaMode === 1) dy *= 16
  else if (e.deltaMode === 2) dy *= 120
  let factor = Math.exp(-dy * WHEEL_ZOOM_SENSITIVITY)
  if (factor < WHEEL_ZOOM_FACTOR_MIN) factor = WHEEL_ZOOM_FACTOR_MIN
  if (factor > WHEEL_ZOOM_FACTOR_MAX) factor = WHEEL_ZOOM_FACTOR_MAX
  return factor
}

function pointInPolygon(px: number, py: number, points: Point[]): boolean {
  if (points.length < 3) return false
  let inside = false
  const n = points.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside
  }
  return inside
}

function pointInRect(px: number, py: number, bbox: [number, number, number, number]): boolean {
  const [x1, y1, x2, y2] = bbox
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2)
  const maxY = Math.max(y1, y2)
  return px >= minX && px <= maxX && py >= minY && py <= maxY
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/** Distance from point (px,py) to segment a-b (in image coords). */
function distToSegment(px: number, py: number, a: Point, b: Point): number {
  const [ax, ay] = a
  const [bx, by] = b
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy)
  if (len === 0) return dist(a, [px, py])
  let t = ((px - ax) * dx + (py - ay) * dy) / (len * len)
  t = Math.max(0, Math.min(1, t))
  const qx = ax + t * dx
  const qy = ay + t * dy
  return Math.hypot(px - qx, py - qy)
}

export function DetectionsPolygonCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  rooms,
  doors,
  tab,
  demolitionPolys = [],
  onDemolitionPolysChange = () => {},
  zubauBestandPolys = [],
  onZubauBestandPolysChange = () => {},
  zubauWallLines = [],
  onZubauWallLinesChange = () => {},
  stairOpeningRects = [],
  onStairOpeningRectsChange = () => {},
  tool,
  selectedIndex,
  newPoints,
  onSelect,
  onAddPoint,
  onCloseNewPolygon,
  onMoveVertex,
  onInsertVertex,
  onRemoveSelected,
  onRoomsChange,
  onDoorsChange,
  onDoorHover,
  onDoorActivate,
  onRoomTypeLabelClick,
  onEditStart,
  dimUnselectedRoomPolygons = false,
  showRoomPolygonsUnderDoors = false,
  highlightRoofSurfaceUnderlay = false,
  interactiveRoomPolygonsInDoorsTab = false,
  bulkSelectedKeys = [],
  onBulkPick,
  onBulkMarqueeSelect,
  newDoorType = 'door',
  className = '',
  layoutActive = true,
  layoutRevealKey = 0,
  blendAufstockungPhase1Overlays = false,
  blendZubauSiblingOverlays = false,
  useAufstockungsBasisDemolitionLabels = false,
  hideBasemap = false,
  roofOverlayRooms = [],
  stackedView = null,
  onStackedViewChange,
  roomsAddMode = 'polygon',
  onRoofOverhangLineComplete,
  onRoofOverhangLineEditRequest,
  roofOverhangLines = [],
  onRemoveRoofOverhangLine,
  onRoofOverhangLinesChange,
}: PolygonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fit, setFit] = useState<{ scale: number; offX: number; offY: number; cw: number; ch: number } | null>(null)
  const [userZoom, setUserZoom] = useState(1)
  const [userPan, setUserPan] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null)
  type DragState =
    | { kind: 'vertex'; polyIndex: number; vertexIndex: number }
    | { kind: 'edge'; polyIndex: number; edgeIndex: number; initV0: Point; initV1: Point; startImage: Point }
    | {
        kind: 'poly'
        polyIndex: number
        startImage: Point
        initPoints?: Point[]
        initBbox?: [number, number, number, number]
        initRoofOhSnapshot?: RoofOverhangLine[]
      }
    | {
        kind: 'bulk'
        startImage: Point
        roomInits: Record<number, Point[]>
        doorInits: Record<number, [number, number, number, number]>
        initRoofOhSnapshot?: RoofOverhangLine[]
      }
    | {
        kind: 'bulk_marquee'
        startCanvas: { x: number; y: number }
        currentCanvas: { x: number; y: number }
        startImage: Point
        currentImage: Point
      }
    | {
        kind: 'bulk_scale'
        roomInits: Record<number, Point[]>
        doorInits: Record<number, [number, number, number, number]>
        anchor: Point
        handleStart: Point
        initRoofOhSnapshot?: RoofOverhangLine[]
      }
    | { kind: 'roof_oh_vertex'; lineIndex: number; vertexIndex: 0 | 1 }
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const lastEdgeClickRef = useRef<{ time: number; polyIndex: number; edgeIndex: number } | null>(null)
  const edgeDragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingEdgeDragRef = useRef<{ polyIndex: number; edgeIndex: number; initV0: Point; initV1: Point; startImage: Point } | null>(null)
  const doorTapPendingRef = useRef<{ index: number; clientX: number; clientY: number; pt: Point } | null>(null)
  const [previewEndPoint, setPreviewEndPoint] = useState<Point | null>(null)
  const doorsRef = useRef(doors)
  const roomsRef = useRef(rooms)
  const demolitionRef = useRef(demolitionPolys)
  const zubauBestandRef = useRef(zubauBestandPolys)
  const zubauWallsRef = useRef(zubauWallLines)
  const stairRectsRef = useRef(stairOpeningRects)
  const [wallLineDraft, setWallLineDraft] = useState<Point[] | null>(null)
  const [roofOhDraft, setRoofOhDraft] = useState<Point[] | null>(null)
  const [roofOhRoofIdx, setRoofOhRoofIdx] = useState<number | null>(null)
  const [roofOhPreviewEnd, setRoofOhPreviewEnd] = useState<Point | null>(null)
  /** Kanten-Hover beim Überhang-Ziehmodus (welche Kante unter dem Cursor einrastet). */
  const [roofOhHoveredEdge, setRoofOhHoveredEdge] = useState<{ roofIndex: number; edgeIndex: number } | null>(null)
  const [roofOhSelectedLineIndex, setRoofOhSelectedLineIndex] = useState<number | null>(null)
  const roofOhLinesRef = useRef(roofOverhangLines)
  const [bulkResizeHoverCorner, setBulkResizeHoverCorner] = useState<number | null>(null)
  doorsRef.current = doors
  roomsRef.current = rooms
  demolitionRef.current = demolitionPolys
  zubauBestandRef.current = zubauBestandPolys
  zubauWallsRef.current = zubauWallLines
  stairRectsRef.current = stairOpeningRects
  roofOhLinesRef.current = roofOverhangLines

  useEffect(() => {
    if (tab !== 'zubau_walls') setWallLineDraft(null)
  }, [tab])

  useEffect(() => {
    if (tab !== 'rooms' || tool !== 'add' || roomsAddMode !== 'roof_overhang_line') {
      setRoofOhDraft(null)
      setRoofOhRoofIdx(null)
      setRoofOhPreviewEnd(null)
      setRoofOhHoveredEdge(null)
    }
  }, [tab, tool, roomsAddMode])

  useEffect(() => {
    if (tool !== 'edit') setRoofOhSelectedLineIndex(null)
  }, [tool])

  useEffect(() => {
    if (tab !== 'rooms') setRoofOhSelectedLineIndex(null)
  }, [tab])

  useEffect(() => {
    if (tab !== 'rooms' || tool !== 'edit' || roofOhSelectedLineIndex == null || !onRemoveRoofOverhangLine) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t as HTMLElement).isContentEditable) return
      e.preventDefault()
      const idx = roofOhSelectedLineIndex
      if (idx < 0) return
      onRemoveRoofOverhangLine(idx)
      setRoofOhSelectedLineIndex(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab, tool, roofOhSelectedLineIndex, onRemoveRoofOverhangLine])

  const getBulkSelectionBounds = useCallback((): { minX: number; minY: number; maxX: number; maxY: number } | null => {
    if (bulkSelectedKeys.length === 0) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let hasAny = false
    for (const key of bulkSelectedKeys) {
      if (key.startsWith('r:')) {
        const idx = Number(key.slice(2))
        const pts = roomsRef.current[idx]?.points
        if (!pts || pts.length === 0) continue
        pts.forEach(([x, y]) => {
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        })
        hasAny = true
      } else if (key.startsWith('d:')) {
        const idx = Number(key.slice(2))
        const bb = doorsRef.current[idx]?.bbox
        if (!bb) continue
        minX = Math.min(minX, bb[0], bb[2])
        minY = Math.min(minY, bb[1], bb[3])
        maxX = Math.max(maxX, bb[0], bb[2])
        maxY = Math.max(maxY, bb[1], bb[3])
        hasAny = true
      }
    }
    if (!hasAny || !Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null
    return { minX, minY, maxX, maxY }
  }, [bulkSelectedKeys])

  const zoomModel = stackedView != null ? stackedView.zoom : userZoom
  const panModel = stackedView != null ? stackedView.pan : userPan
  const effective = fit ? {
    scale: fit.scale * zoomModel,
    offX: fit.offX + panModel.x,
    offY: fit.offY + panModel.y,
  } : null

  const toImage = useCallback((cx: number, cy: number): Point | null => {
    if (!effective) return null
    const x = (cx - effective.offX) / effective.scale
    const y = (cy - effective.offY) / effective.scale
    if (x < 0 || x > imageWidth || y < 0 || y > imageHeight) return null
    return [x, y]
  }, [effective, imageWidth, imageHeight])

  /**
   * Coordonate pentru plasare (Add ușă/fereastră, poligon camere): acceptă doar click pe aria imaginii
   * (nu pe marginile letterbox) și clamp la [0,w]×[0,h] ca marginea vizuală să nu dea null din cauza float-ului.
   */
  const toImageForPlacement = useCallback((cx: number, cy: number): Point | null => {
    if (!effective) return null
    const { offX, offY, scale } = effective
    const drawW = imageWidth * scale
    const drawH = imageHeight * scale
    if (cx < offX || cx > offX + drawW || cy < offY || cy > offY + drawH) return null
    const x = Math.min(Math.max((cx - offX) / scale, 0), imageWidth)
    const y = Math.min(Math.max((cy - offY) / scale, 0), imageHeight)
    return [x, y]
  }, [effective, imageWidth, imageHeight])

  useEffect(() => {
    setImageLoaded(false)
    let cancelled = false

    const attachLoaded = (img: HTMLImageElement) => {
      img.onload = () => {
        if (cancelled) return
        imgRef.current = img
        setImageLoaded(true)
      }
    }

    // First attempt: CORS-friendly load (useful for signed/public storage URLs).
    const primary = new Image()
    primary.crossOrigin = 'anonymous'
    attachLoaded(primary)
    primary.onerror = () => {
      if (cancelled) return
      // Fallback: retry without crossOrigin; some storage/CDN responses reject anonymous CORS
      // but still allow normal image rendering.
      const fallback = new Image()
      attachLoaded(fallback)
      fallback.onerror = () => {
        if (cancelled) return
        imgRef.current = null
        setImageLoaded(false)
      }
      fallback.src = imageUrl
    }
    primary.src = imageUrl

    return () => {
      cancelled = true
      imgRef.current = null
    }
  }, [imageUrl])

  const recomputeFit = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageWidth || !imageHeight) return
    const rect = canvas.getBoundingClientRect()
    const cw = rect.width
    const ch = rect.height
    if (cw <= 0 || ch <= 0) return
    const scale = Math.min(cw / imageWidth, ch / imageHeight)
    const offX = (cw - imageWidth * scale) / 2
    const offY = (ch - imageHeight * scale) / 2
    setFit({ scale, offX, offY, cw, ch })
  }, [imageWidth, imageHeight])

  /** Zoom/pan nur bei neuem Plan/Bild zurücksetzen — nicht bei Canvas-Resize (Werkzeug-Zeilen ändern die Höhe). */
  useEffect(() => {
    if (stackedView != null) return
    setUserZoom(1)
    setUserPan({ x: 0, y: 0 })
  }, [imageUrl, imageWidth, imageHeight, stackedView])

  /** După Aufstockung Dach-Stack (zoom/pan partajat), refit evită `fit` vechi când containerul/layout-ul se schimbă. */
  const prevStackedViewRef = useRef(stackedView)
  useEffect(() => {
    const prev = prevStackedViewRef.current
    prevStackedViewRef.current = stackedView
    if (prev != null && stackedView == null) {
      requestAnimationFrame(() => {
        recomputeFit()
      })
    }
  }, [stackedView, recomputeFit])

  useLayoutEffect(() => {
    if (!layoutRevealKey) return
    requestAnimationFrame(() => {
      recomputeFit()
    })
  }, [layoutRevealKey, recomputeFit])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageWidth || !imageHeight || !layoutActive) return
    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      const cw = rect.width
      const ch = rect.height
      if (cw <= 0 || ch <= 0) return
      canvas.width = cw * dpr
      canvas.height = ch * dpr
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      recomputeFit()
    }
    requestAnimationFrame(handleResize)
    window.addEventListener('resize', handleResize)
    /** Flex-Layout (z. B. Footer unter dem Canvas bei Fenster/Türen) ändert die Canvas-Höhe ohne window-resize. */
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => requestAnimationFrame(handleResize)) : null
    if (ro) ro.observe(canvas)
    return () => {
      window.removeEventListener('resize', handleResize)
      ro?.disconnect()
    }
  }, [imageWidth, imageHeight, recomputeFit, layoutActive])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const img = imgRef.current
    if (!ctx || !effective || !canvas) return
    if (!hideBasemap && (!img || !imageLoaded)) return

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!hideBasemap) {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
      ctx.drawImage(img!, effective.offX, effective.offY, imageWidth * effective.scale, imageHeight * effective.scale)
    } else {
      ctx.restore()
    }

    const roomColors = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
    // Clasificare identică cu LiveFeed (detections_review_doors.png): doors_types.json (Gemini) + euristică aspect în backend.
    // Culori: ușă = verde, geam = albastru, garaj = mov, scări = portocaliu. Legacy Schiebetür = aceeași culoare ca Fenster.
    const doorColors: Record<string, string> = { door: '#22c55e', window: '#3b82f6', garage_door: '#9333ea', stairs: '#ea580c', lift: '#c026d3' }
    const doorStrokeColors: Record<string, string> = { door: '#16a34a', window: '#2563eb', garage_door: '#7e22ce', stairs: '#c2410c', lift: '#a21caf' }
    const getDoorStyle = (type: string | undefined) => {
      const t = (type || 'door').toLowerCase().trim()
      if (t === 'window' || t === 'fenster' || t === 'geam' || t === 'sliding_door' || t === 'schiebetur' || t === 'schiebetür')
        return { fill: doorColors.window, stroke: doorStrokeColors.window }
      if (t === 'garage_door' || t === 'garagentor') return { fill: doorColors.garage_door, stroke: doorStrokeColors.garage_door }
      if (t === 'stairs' || t === 'treppe') return { fill: doorColors.stairs, stroke: doorStrokeColors.stairs }
      if (t === 'lift' || t === 'aufzug' || t === 'elevator') return { fill: doorColors.lift, stroke: doorStrokeColors.lift }
      return { fill: doorColors.door, stroke: doorStrokeColors.door }
    }

    const s = effective.scale
    const ox = effective.offX
    const oy = effective.offY
    const useDimOthers = dimUnselectedRoomPolygons && selectedIndex !== null && rooms.length > 0
    /** Sub-tool „Überhang-Linie“ vs „Dachfläche“ (roof editor): evidențiază stratul activ. */
    const focusOverhangSubtool = tab === 'rooms' && roomsAddMode === 'roof_overhang_line'
    const focusSurfaceSubtool = tab === 'rooms' && roomsAddMode === 'polygon'
    const stairPreviewStyle = { fill: '#a855f7', stroke: '#7c3aed' }
    const rectsForDoorTab = tab === 'stair_opening' ? stairOpeningRects : doors

    const drawRoomsDimZubauContext = () => {
      rooms.forEach((room, ri) => {
        const pts = room.points
        if (pts.length < 2) return
        ctx.fillStyle = roomColors[ri % roomColors.length]
        ctx.globalAlpha = 0.1
        ctx.beginPath()
        ctx.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s)
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(ox + pts[k][0] * s, oy + pts[k][1] * s)
        }
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'
        ctx.lineWidth = 1
        ctx.stroke()
      })
    }
    const drawZubauBestandDim = () => {
      zubauBestandPolys.forEach((d) => {
        const pts = d.points
        if (pts.length < 2) return
        ctx.fillStyle = '#f59e0b'
        ctx.globalAlpha = 0.12
        ctx.beginPath()
        ctx.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s)
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(ox + pts[k][0] * s, oy + pts[k][1] * s)
        }
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.strokeStyle = 'rgba(245,158,11,0.55)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      })
    }
    const drawZubauWallLinesDim = () => {
      zubauWallLines.forEach((ln) => {
        const [ax, ay] = ln.a
        const [bx, by] = ln.b
        ctx.strokeStyle = 'rgba(220,38,38,0.92)'
        ctx.lineWidth = 4.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(ox + ax * s, oy + ay * s)
        ctx.lineTo(ox + bx * s, oy + by * s)
        ctx.stroke()
      })
    }
    const drawDemolitionDim = () => {
      demolitionPolys.forEach((d) => {
        const pts = d.points
        if (pts.length < 2) return
        ctx.fillStyle = '#dc2626'
        ctx.globalAlpha = 0.14
        ctx.beginPath()
        ctx.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s)
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(ox + pts[k][0] * s, oy + pts[k][1] * s)
        }
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.strokeStyle = 'rgba(248,113,113,0.55)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      })
    }
    const drawStairDim = () => {
      stairOpeningRects.forEach((st) => {
        const [x1, y1, x2, y2] = st.bbox
        ctx.fillStyle = stairPreviewStyle.fill
        ctx.globalAlpha = 0.2
        ctx.fillRect(ox + Math.min(x1, x2) * s, oy + Math.min(y1, y2) * s, Math.abs(x2 - x1) * s, Math.abs(y2 - y1) * s)
        ctx.globalAlpha = 1
        ctx.strokeStyle = stairPreviewStyle.stroke
        ctx.lineWidth = 1.5
        ctx.strokeRect(ox + Math.min(x1, x2) * s, oy + Math.min(y1, y2) * s, Math.abs(x2 - x1) * s, Math.abs(y2 - y1) * s)
      })
    }

    // Keep Zubau overlays visible across tabs as persistent context.
    const drawPersistentZubauOverlays = () => {
      if (zubauBestandPolys.length > 0) drawZubauBestandDim()
      if (zubauWallLines.length > 0) drawZubauWallLinesDim()
    }

    if (tab !== 'doors') {
      drawPersistentZubauOverlays()
    }

    if (tab === 'rooms') {
      /** Bestand + Dach-Tab: Aufstandsfläche + Treppenöffnung als Kontext unter dem Dach-Plan (gleiche Optik wie Phase-1-Blend). */
      if (
        blendAufstockungPhase1Overlays &&
        (demolitionPolys.length > 0 || stairOpeningRects.length > 0 || roofOverlayRooms.length > 0)
      ) {
        drawDemolitionDim()
        drawStairDim()
        drawAufstockungRoofOverlayPreview(ctx, ox, oy, s, roofOverlayRooms)
      }
      rooms.forEach((room, i) => {
        const pts = room.points
        if (pts.length < 2) return
        const selected = selectedIndex === i
        ctx.fillStyle = roomColors[i % roomColors.length]
        let fillA = selected ? 0.5 : 0.35
        if (useDimOthers) {
          fillA = selected ? 0.52 : 0.12
        }
        if (focusOverhangSubtool) {
          fillA *= 0.32
        } else if (roofOverhangLines.length > 0) {
          fillA *= 0.88
        }
        ctx.globalAlpha = fillA
        ctx.beginPath()
        ctx.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s)
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(ox + pts[k][0] * s, oy + pts[k][1] * s)
        }
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.strokeStyle = selected ? '#FF9F0F' : useDimOthers ? 'rgba(255,255,255,0.35)' : ctx.fillStyle
        ctx.lineWidth = selected ? 3 : useDimOthers ? 1.5 : 2
        ctx.stroke()
        const rawLabel = (room.roomName ?? (room as { room_name?: string }).room_name ?? room.roomType ?? '').trim()
        const label =
          /^S\d+$/i.test(rawLabel) || /^Dach-Basis\s*#\s*\d+$/i.test(rawLabel)
            ? formatRoofSurfaceCanvasLabel(room, i)
            : rawLabel || `R${i}`
        if (pts.length > 0 && label) {
          let cx = 0, cy = 0
          pts.forEach((p) => { cx += p[0]; cy += p[1] })
          cx /= pts.length
          cy /= pts.length
          ctx.font = 'bold 14px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const textW = ctx.measureText(label).width
          const pad = 6
          const boxW = textW + pad * 2
          const boxH = 20
          const lx = ox + cx * s - boxW / 2
          const ly = oy + cy * s - boxH / 2
          ctx.fillStyle = 'rgba(0,0,0,0.82)'
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.rect(lx, ly, boxW, boxH)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#fff'
          ctx.fillText(label, ox + cx * s, oy + cy * s)
        }
        if (tool === 'edit' && selected && pts.length > 0) {
          pts.forEach((p) => {
            ctx.fillStyle = '#FF9F0F'
            ctx.beginPath()
            ctx.arc(ox + p[0] * s, oy + p[1] * s, HANDLE_R, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 1
            ctx.stroke()
          })
        }
      })
      /** Erlaubte Kanten für Überhang-Linien (hell markiert). */
      if (roomsAddMode === 'roof_overhang_line' && tool === 'add' && rooms.length > 0) {
        ctx.lineCap = 'round'
        rooms.forEach((room) => {
          const pts = room.points
          const n = pts.length
          if (n < 3) return
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)'
          ctx.lineWidth = 5
          ctx.shadowColor = 'rgba(34, 211, 238, 0.45)'
          ctx.shadowBlur = 6
          ctx.setLineDash([10, 7])
          ctx.beginPath()
          for (let ei = 0; ei < n; ei++) {
            const a = pts[ei]
            const b = pts[(ei + 1) % n]
            ctx.moveTo(ox + a[0] * s, oy + a[1] * s)
            ctx.lineTo(ox + b[0] * s, oy + b[1] * s)
          }
          ctx.stroke()
          ctx.setLineDash([])
          ctx.shadowBlur = 0
        })
        const hl = roofOhHoveredEdge
        if (hl != null) {
          const pts = rooms[hl.roofIndex]?.points
          if (pts && pts.length >= 3) {
            const ei = hl.edgeIndex % pts.length
            const a = pts[ei]
            const b = pts[(ei + 1) % pts.length]
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.98)'
            ctx.lineWidth = 7
            ctx.shadowColor = 'rgba(250, 204, 21, 0.55)'
            ctx.shadowBlur = 10
            ctx.beginPath()
            ctx.moveTo(ox + a[0] * s, oy + a[1] * s)
            ctx.lineTo(ox + b[0] * s, oy + b[1] * s)
            ctx.stroke()
            ctx.shadowBlur = 0
          }
        }
      }
      if (roofOverhangLines.length > 0) {
        const ohStrokeMul = focusSurfaceSubtool ? 0.62 : 1
        const roofOhMpp = estimateMetersPerPixelFromRoofs(rooms, imageWidth, imageHeight)
        const ohDash = [10, 7]
        const miterCutDash = [6, 5]
        const roofIndicesWithOh = [...new Set(roofOverhangLines.map((l) => l.roofIndex))]
        const miterByRoofAndVertex = new Map<number, Map<number, Point>>()
        for (const ri of roofIndicesWithOh) {
          const polyPts = rooms[ri]?.points
          if (!polyPts || polyPts.length < 3) continue
          const linesHere = roofOverhangLines.filter((l) => l.roofIndex === ri)
          miterByRoofAndVertex.set(ri, computeOverhangMiterByVertex(polyPts, linesHere, roofOhMpp))
        }
        const strokeStripEdge = (
          x1: number,
          y1: number,
          x2: number,
          y2: number,
          stroke: string,
          lw: number,
          glow: boolean,
          dash: number[] = ohDash,
          rgbForGlow?: readonly [number, number, number],
        ) => {
          ctx.lineCap = 'round'
          ctx.setLineDash(dash)
          ctx.strokeStyle = stroke
          ctx.lineWidth = lw
          if (glow && rgbForGlow) {
            ctx.shadowColor = overhangRgba(rgbForGlow, 0.5)
            ctx.shadowBlur = 12
          } else {
            ctx.shadowBlur = 0
          }
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.shadowBlur = 0
        }
        roofOverhangLines.forEach((ln, ohi) => {
          const selectedOh =
            tool === 'edit' && roofOhSelectedLineIndex !== null && roofOhSelectedLineIndex === ohi
          const baseRgb = overhangLineRgb(ohi)
          const mainRgb: [number, number, number] = selectedOh
            ? blendRgbTowardWhite(baseRgb, 0.25)
            : [baseRgb[0], baseRgb[1], baseRgb[2]]
          const dimRgb: [number, number, number] = [
            Math.max(0, Math.round(mainRgb[0] * 0.55)),
            Math.max(0, Math.round(mainRgb[1] * 0.55)),
            Math.max(0, Math.round(mainRgb[2] * 0.55)),
          ]
          const poly = rooms[ln.roofIndex]?.points
          const strip =
            poly && poly.length >= 3 ? computeOverhangStrip(poly, ln.a, ln.b, ln.overhangCm, roofOhMpp) : null
          const miterMap = miterByRoofAndVertex.get(ln.roofIndex) ?? new Map<number, Point>()
          const corners =
            strip && poly && poly.length >= 3 ? applyMitersToStripCorners(poly, strip, miterMap) : null

          const strokeMain = overhangRgba(mainRgb, 0.98 * ohStrokeMul)
          const strokeDim = overhangRgba(dimRgb, 0.94 * ohStrokeMul)
          const fillStrip = overhangRgba(baseRgb, 0.24 * ohStrokeMul)

          if (strip && corners) {
            const { a, b } = strip
            const { aOut, bOut } = corners
            const ax = ox + a[0] * s
            const ay = oy + a[1] * s
            const bx = ox + b[0] * s
            const by = oy + b[1] * s
            const axo = ox + aOut[0] * s
            const ayo = oy + aOut[1] * s
            const bxo = ox + bOut[0] * s
            const byo = oy + bOut[1] * s

            ctx.fillStyle = fillStrip
            ctx.beginPath()
            ctx.moveTo(ax, ay)
            ctx.lineTo(bx, by)
            ctx.lineTo(bxo, byo)
            ctx.lineTo(axo, ayo)
            ctx.closePath()
            ctx.fill()

            const lw = selectedOh ? 4.8 : 3.6
            strokeStripEdge(ax, ay, bx, by, strokeDim, lw * 0.92, selectedOh, ohDash, mainRgb)
            strokeStripEdge(ax, ay, axo, ayo, strokeMain, lw, selectedOh, ohDash, mainRgb)
            strokeStripEdge(bx, by, bxo, byo, strokeMain, lw, selectedOh, ohDash, mainRgb)
            strokeStripEdge(axo, ayo, bxo, byo, strokeMain, lw * 1.08, selectedOh, ohDash, mainRgb)
          } else {
            const [ax, ay] = ln.a
            const [bx, by] = ln.b
            strokeStripEdge(
              ox + ax * s,
              oy + ay * s,
              ox + bx * s,
              oy + by * s,
              strokeMain,
              selectedOh ? 5 : 4,
              selectedOh,
              ohDash,
              mainRgb,
            )
          }

          if (tool === 'edit' && selectedOh) {
            for (const p of [ln.a, ln.b]) {
              ctx.fillStyle = '#FF9F0F'
              ctx.strokeStyle = '#fff'
              ctx.lineWidth = 1
              ctx.beginPath()
              ctx.arc(ox + p[0] * s, oy + p[1] * s, HANDLE_R, 0, Math.PI * 2)
              ctx.fill()
              ctx.stroke()
            }
          }
        })
        for (const ri of roofIndicesWithOh) {
          const mm = miterByRoofAndVertex.get(ri)
          const polyPts = rooms[ri]?.points
          if (!mm || mm.size === 0 || !polyPts) continue
          mm.forEach((M, vi) => {
            const C = polyPts[vi]
            if (!C) return
            const cx = ox + C[0] * s
            const cy = oy + C[1] * s
            const mx = ox + M[0] * s
            const my = oy + M[1] * s
            ctx.lineCap = 'round'
            ctx.setLineDash(miterCutDash)
            ctx.strokeStyle = `rgba(255, 252, 248, ${0.88 * ohStrokeMul})`
            ctx.lineWidth = 2.6
            ctx.shadowBlur = 0
            ctx.beginPath()
            ctx.moveTo(cx, cy)
            ctx.lineTo(mx, my)
            ctx.stroke()
            ctx.setLineDash([])
          })
        }
      }
      if (roomsAddMode === 'roof_overhang_line' && roofOhDraft?.length === 1 && roofOhPreviewEnd) {
        const p0 = roofOhDraft[0]
        const previewDraft = roofOhPreviewEnd
        const previewMpp = estimateMetersPerPixelFromRoofs(rooms, imageWidth, imageHeight)
        const previewPoly = roofOhRoofIdx != null ? rooms[roofOhRoofIdx]?.points : null
        const previewStrip =
          previewPoly && previewPoly.length >= 3
            ? computeOverhangStrip(previewPoly, p0, previewDraft, 40, previewMpp)
            : null

        const previewDash = [8, 6]
        const strokePrev = (x1: number, y1: number, x2: number, y2: number, w: number, glow: boolean) => {
          ctx.strokeStyle = 'rgba(74, 222, 128, 1)'
          ctx.lineWidth = w
          ctx.lineCap = 'round'
          ctx.setLineDash(previewDash)
          if (glow) {
            ctx.shadowColor = 'rgba(34, 197, 94, 0.75)'
            ctx.shadowBlur = 14
          } else {
            ctx.shadowBlur = 0
          }
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.shadowBlur = 0
        }

        if (previewStrip) {
          const { a, b, aOut, bOut } = previewStrip
          const ax = ox + a[0] * s
          const ay = oy + a[1] * s
          const bx = ox + b[0] * s
          const by = oy + b[1] * s
          const axo = ox + aOut[0] * s
          const ayo = oy + aOut[1] * s
          const bxo = ox + bOut[0] * s
          const byo = oy + bOut[1] * s
          ctx.fillStyle = 'rgba(74, 222, 128, 0.12)'
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(bx, by)
          ctx.lineTo(bxo, byo)
          ctx.lineTo(axo, ayo)
          ctx.closePath()
          ctx.fill()
          strokePrev(ax, ay, bx, by, 4.5, false)
          strokePrev(ax, ay, axo, ayo, 5.5, true)
          strokePrev(bx, by, bxo, byo, 5.5, true)
          strokePrev(axo, ayo, bxo, byo, 5.5, true)
        } else {
          const [px, py] = previewDraft
          ctx.strokeStyle = 'rgba(74, 222, 128, 1)'
          ctx.lineWidth = 6
          ctx.lineCap = 'round'
          ctx.shadowColor = 'rgba(34, 197, 94, 0.85)'
          ctx.shadowBlur = 12
          ctx.setLineDash([6, 5])
          ctx.beginPath()
          ctx.moveTo(ox + p0[0] * s, oy + p0[1] * s)
          ctx.lineTo(ox + px * s, oy + py * s)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.shadowBlur = 0
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
          ctx.lineWidth = 2
          ctx.setLineDash([6, 5])
          ctx.beginPath()
          ctx.moveTo(ox + p0[0] * s, oy + p0[1] * s)
          ctx.lineTo(ox + px * s, oy + py * s)
          ctx.stroke()
          ctx.setLineDash([])
        }
      }
      if (roomsAddMode === 'roof_overhang_line' && roofOhDraft?.length === 1) {
        const p0 = roofOhDraft[0]
        ctx.fillStyle = '#4ade80'
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(ox + p0[0] * s, oy + p0[1] * s, HANDLE_R + 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      if (newPoints && newPoints.length > 0) {
        ctx.strokeStyle = '#FF9F0F'
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(ox + newPoints[0][0] * s, oy + newPoints[0][1] * s)
        for (let k = 1; k < newPoints.length; k++) {
          ctx.lineTo(ox + newPoints[k][0] * s, oy + newPoints[k][1] * s)
        }
        if (newPoints.length >= 3) ctx.closePath()
        ctx.stroke()
        ctx.setLineDash([])
        newPoints.forEach((p, vi) => {
          ctx.fillStyle = vi === 0 ? '#22c55e' : '#FF9F0F'
          ctx.beginPath()
          ctx.arc(ox + p[0] * s, oy + p[1] * s, HANDLE_R, 0, Math.PI * 2)
          ctx.fill()
        })
      }
    } else if (tab === 'zubau_bestand') {
      if (blendAufstockungPhase1Overlays) {
        drawDemolitionDim()
        drawStairDim()
        drawAufstockungRoofOverlayPreview(ctx, ox, oy, s, roofOverlayRooms)
      }
      if (blendZubauSiblingOverlays) drawRoomsDimZubauContext()
      zubauBestandPolys.forEach((d, i) => {
        const pts = d.points
        if (pts.length < 2) return
        const selected = selectedIndex === i
        ctx.fillStyle = '#f59e0b'
        ctx.globalAlpha = selected ? 0.42 : 0.28
        ctx.beginPath()
        ctx.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s)
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(ox + pts[k][0] * s, oy + pts[k][1] * s)
        }
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.strokeStyle = selected ? '#FF9F0F' : 'rgba(245,158,11,0.95)'
        ctx.lineWidth = selected ? 3 : 2
        ctx.stroke()
        if (pts.length > 0) {
          let cx = 0
          let cy = 0
          pts.forEach((p) => {
            cx += p[0]
            cy += p[1]
          })
          cx /= pts.length
          cy /= pts.length
          const label = `Bestand #${i + 1}`
          ctx.font = 'bold 13px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const textW = ctx.measureText(label).width
          const pad = 6
          const boxW = textW + pad * 2
          const boxH = 20
          const lx = ox + cx * s - boxW / 2
          const ly = oy + cy * s - boxH / 2
          ctx.fillStyle = 'rgba(0,0,0,0.82)'
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.rect(lx, ly, boxW, boxH)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#fde68a'
          ctx.fillText(label, ox + cx * s, oy + cy * s)
        }
        if (tool === 'edit' && selected && pts.length > 0) {
          pts.forEach((p) => {
            ctx.fillStyle = '#FF9F0F'
            ctx.beginPath()
            ctx.arc(ox + p[0] * s, oy + p[1] * s, HANDLE_R, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 1
            ctx.stroke()
          })
        }
      })
      if (newPoints && newPoints.length > 0) {
        ctx.strokeStyle = '#FF9F0F'
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(ox + newPoints[0][0] * s, oy + newPoints[0][1] * s)
        for (let k = 1; k < newPoints.length; k++) {
          ctx.lineTo(ox + newPoints[k][0] * s, oy + newPoints[k][1] * s)
        }
        if (newPoints.length >= 3) ctx.closePath()
        ctx.stroke()
        ctx.setLineDash([])
        newPoints.forEach((p, vi) => {
          ctx.fillStyle = vi === 0 ? '#22c55e' : '#FF9F0F'
          ctx.beginPath()
          ctx.arc(ox + p[0] * s, oy + p[1] * s, HANDLE_R, 0, Math.PI * 2)
          ctx.fill()
        })
      }
    } else if (tab === 'demolition') {
      const demolBaseLabel = useAufstockungsBasisDemolitionLabels ? 'Aufstockungs-Basis' : 'Rückbau'
      if (blendAufstockungPhase1Overlays) {
        rooms.forEach((room, ri) => {
          const pts = room.points
          if (pts.length < 2) return
          ctx.fillStyle = roomColors[ri % roomColors.length]
          ctx.globalAlpha = 0.12
          ctx.beginPath()
          ctx.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s)
          for (let k = 1; k < pts.length; k++) {
            ctx.lineTo(ox + pts[k][0] * s, oy + pts[k][1] * s)
          }
          ctx.closePath()
          ctx.fill()
          ctx.globalAlpha = 1
          ctx.strokeStyle = 'rgba(255,255,255,0.22)'
          ctx.lineWidth = 1.25
          ctx.stroke()
        })
        stairOpeningRects.forEach((st) => {
          const [x1, y1, x2, y2] = st.bbox
          ctx.fillStyle = stairPreviewStyle.fill
          ctx.globalAlpha = 0.2
          ctx.fillRect(ox + Math.min(x1, x2) * s, oy + Math.min(y1, y2) * s, Math.abs(x2 - x1) * s, Math.abs(y2 - y1) * s)
          ctx.globalAlpha = 1
          ctx.strokeStyle = stairPreviewStyle.stroke
          ctx.lineWidth = 1.5
          ctx.strokeRect(ox + Math.min(x1, x2) * s, oy + Math.min(y1, y2) * s, Math.abs(x2 - x1) * s, Math.abs(y2 - y1) * s)
        })
        drawAufstockungRoofOverlayPreview(ctx, ox, oy, s, roofOverlayRooms)
      }
      demolitionPolys.forEach((d, i) => {
        const pts = d.points
        if (pts.length < 2) return
        const selected = selectedIndex === i
        ctx.fillStyle = '#dc2626'
        ctx.globalAlpha = selected ? 0.48 : 0.32
        ctx.beginPath()
        ctx.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s)
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(ox + pts[k][0] * s, oy + pts[k][1] * s)
        }
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.strokeStyle = selected ? '#FF9F0F' : 'rgba(248,113,113,0.95)'
        ctx.lineWidth = selected ? 3 : 2
        ctx.stroke()
        if (pts.length > 0) {
          let cx = 0
          let cy = 0
          pts.forEach((p) => {
            cx += p[0]
            cy += p[1]
          })
          cx /= pts.length
          cy /= pts.length
          const m2 = typeof d.area_m2 === 'number' && d.area_m2 > 0 ? `${d.area_m2.toFixed(2)} m²` : ''
          const label = m2 ? `${demolBaseLabel} #${i + 1} · ${m2}` : `${demolBaseLabel} #${i + 1}`
          ctx.font = 'bold 13px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const textW = ctx.measureText(label).width
          const pad = 6
          const boxW = textW + pad * 2
          const boxH = 20
          const lx = ox + cx * s - boxW / 2
          const ly = oy + cy * s - boxH / 2
          ctx.fillStyle = 'rgba(0,0,0,0.82)'
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.rect(lx, ly, boxW, boxH)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#fecaca'
          ctx.fillText(label, ox + cx * s, oy + cy * s)
        }
        if (tool === 'edit' && selected && pts.length > 0) {
          pts.forEach((p) => {
            ctx.fillStyle = '#FF9F0F'
            ctx.beginPath()
            ctx.arc(ox + p[0] * s, oy + p[1] * s, HANDLE_R, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 1
            ctx.stroke()
          })
        }
      })
      if (newPoints && newPoints.length > 0) {
        ctx.strokeStyle = '#FF9F0F'
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(ox + newPoints[0][0] * s, oy + newPoints[0][1] * s)
        for (let k = 1; k < newPoints.length; k++) {
          ctx.lineTo(ox + newPoints[k][0] * s, oy + newPoints[k][1] * s)
        }
        if (newPoints.length >= 3) ctx.closePath()
        ctx.stroke()
        ctx.setLineDash([])
        newPoints.forEach((p, vi) => {
          ctx.fillStyle = vi === 0 ? '#22c55e' : '#FF9F0F'
          ctx.beginPath()
          ctx.arc(ox + p[0] * s, oy + p[1] * s, HANDLE_R, 0, Math.PI * 2)
          ctx.fill()
        })
      }
    } else if (tab === 'zubau_walls') {
      drawRoomsDimZubauContext()
      if (blendAufstockungPhase1Overlays) {
        drawDemolitionDim()
        drawStairDim()
        drawAufstockungRoofOverlayPreview(ctx, ox, oy, s, roofOverlayRooms)
      }
      if (blendZubauSiblingOverlays) {
        drawZubauBestandDim()
      }
      zubauWallLines.forEach((ln, i) => {
        const selected = selectedIndex === i
        const [ax, ay] = ln.a
        const [bx, by] = ln.b
        ctx.strokeStyle = selected ? '#ef4444' : '#dc2626'
        ctx.lineWidth = selected ? 5.5 : 4.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(ox + ax * s, oy + ay * s)
        ctx.lineTo(ox + bx * s, oy + by * s)
        ctx.stroke()
        if (tool === 'edit' && selected) {
          for (const p of [ln.a, ln.b]) {
            ctx.fillStyle = '#FF9F0F'
            ctx.beginPath()
            ctx.arc(ox + p[0] * s, oy + p[1] * s, HANDLE_R, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      })
      if (wallLineDraft && wallLineDraft.length === 1 && previewEndPoint) {
        ctx.strokeStyle = 'rgba(220,38,38,0.85)'
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        ctx.setLineDash([5, 4])
        ctx.beginPath()
        ctx.moveTo(ox + wallLineDraft[0][0] * s, oy + wallLineDraft[0][1] * s)
        ctx.lineTo(ox + previewEndPoint[0] * s, oy + previewEndPoint[1] * s)
        ctx.stroke()
        ctx.setLineDash([])
      }
      if (wallLineDraft && wallLineDraft.length === 1) {
        const p0 = wallLineDraft[0]
        ctx.fillStyle = '#22c55e'
        ctx.beginPath()
        ctx.arc(ox + p0[0] * s, oy + p0[1] * s, HANDLE_R, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      if (blendAufstockungPhase1Overlays && tab === 'doors') {
        drawDemolitionDim()
        drawStairDim()
        drawAufstockungRoofOverlayPreview(ctx, ox, oy, s, roofOverlayRooms)
      }
      if (blendZubauSiblingOverlays && tab === 'doors') {
        drawZubauBestandDim()
        drawZubauWallLinesDim()
      }
      if (blendAufstockungPhase1Overlays && tab === 'stair_opening') {
        rooms.forEach((room, ri) => {
          const pts = room.points
          if (pts.length < 2) return
          ctx.fillStyle = roomColors[ri % roomColors.length]
          ctx.globalAlpha = 0.12
          ctx.beginPath()
          ctx.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s)
          for (let k = 1; k < pts.length; k++) {
            ctx.lineTo(ox + pts[k][0] * s, oy + pts[k][1] * s)
          }
          ctx.closePath()
          ctx.fill()
          ctx.globalAlpha = 1
          ctx.strokeStyle = 'rgba(255,255,255,0.22)'
          ctx.lineWidth = 1.25
          ctx.stroke()
        })
        demolitionPolys.forEach((d) => {
          const pts = d.points
          if (pts.length < 2) return
          ctx.fillStyle = '#dc2626'
          ctx.globalAlpha = 0.14
          ctx.beginPath()
          ctx.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s)
          for (let k = 1; k < pts.length; k++) {
            ctx.lineTo(ox + pts[k][0] * s, oy + pts[k][1] * s)
          }
          ctx.closePath()
          ctx.fill()
          ctx.globalAlpha = 1
          ctx.strokeStyle = 'rgba(248,113,113,0.55)'
          ctx.lineWidth = 1.5
          ctx.stroke()
        })
        if (blendZubauSiblingOverlays) {
          drawZubauBestandDim()
          drawZubauWallLinesDim()
        }
        drawAufstockungRoofOverlayPreview(ctx, ox, oy, s, roofOverlayRooms)
      }
      if ((showRoomPolygonsUnderDoors || interactiveRoomPolygonsInDoorsTab) && tab === 'doors') {
        const underlayColors = ['#3b82f6', '#22c55e', '#eab308', '#8b5cf6', '#06b6d4']
        rooms.forEach((room, i) => {
          const pts = room.points
          if (pts.length < 2) return
          const bulkPick = tool === 'bulk_select' && bulkSelectedKeys.includes(`r:${i}`)
          ctx.fillStyle = interactiveRoomPolygonsInDoorsTab ? roomColors[i % roomColors.length] : underlayColors[i % underlayColors.length]
          ctx.globalAlpha = highlightRoofSurfaceUnderlay ? 0.28 : interactiveRoomPolygonsInDoorsTab ? 0.2 : 0.14
          ctx.beginPath()
          ctx.moveTo(ox + pts[0][0] * s, oy + pts[0][1] * s)
          for (let k = 1; k < pts.length; k++) {
            ctx.lineTo(ox + pts[k][0] * s, oy + pts[k][1] * s)
          }
          ctx.closePath()
          ctx.fill()
          ctx.globalAlpha = 1
          ctx.strokeStyle = bulkPick
            ? 'rgba(255,159,15,0.95)'
            : highlightRoofSurfaceUnderlay
              ? 'rgba(255,159,15,0.85)'
              : 'rgba(255,255,255,0.28)'
          ctx.lineWidth = bulkPick ? 2.75 : highlightRoofSurfaceUnderlay ? 2.25 : 1.25
          ctx.stroke()
          if (highlightRoofSurfaceUnderlay && pts.length >= 3) {
            let cx = 0
            let cy = 0
            pts.forEach((p) => {
              cx += p[0]
              cy += p[1]
            })
            cx /= pts.length
            cy /= pts.length
            const label = formatRoofSurfaceCanvasLabel(room, i)
            ctx.font = 'bold 12px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const textW = ctx.measureText(label).width
            const pad = 5
            const boxW = textW + pad * 2
            const boxH = 18
            const lx = ox + cx * s - boxW / 2
            const ly = oy + cy * s - boxH / 2
            ctx.fillStyle = 'rgba(0,0,0,0.82)'
            ctx.strokeStyle = 'rgba(255,159,15,0.65)'
            ctx.lineWidth = 1.25
            ctx.beginPath()
            ctx.rect(lx, ly, boxW, boxH)
            ctx.fill()
            ctx.stroke()
            ctx.fillStyle = '#FF9F0F'
            ctx.fillText(label, ox + cx * s, oy + cy * s)
          }
        })
      }
      rectsForDoorTab.forEach((door, i) => {
        const [x1, y1, x2, y2] = door.bbox
        const selected = selectedIndex === i || (tool === 'bulk_select' && tab === 'doors' && bulkSelectedKeys.includes(`d:${i}`))
        const style = tab === 'stair_opening' ? stairPreviewStyle : getDoorStyle(door.type)
        ctx.fillStyle = style.fill
        ctx.globalAlpha = selected ? 0.5 : 0.35
        ctx.fillRect(ox + Math.min(x1, x2) * s, oy + Math.min(y1, y2) * s, Math.abs(x2 - x1) * s, Math.abs(y2 - y1) * s)
        ctx.globalAlpha = 1
        ctx.strokeStyle = selected ? '#FF9F0F' : style.stroke
        ctx.lineWidth = selected ? 3 : 2
        ctx.strokeRect(ox + Math.min(x1, x2) * s, oy + Math.min(y1, y2) * s, Math.abs(x2 - x1) * s, Math.abs(y2 - y1) * s)
        if (tool === 'edit' && selected) {
          const corners: Point[] = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
          corners.forEach((p) => {
            ctx.fillStyle = '#FF9F0F'
            ctx.beginPath()
            ctx.arc(ox + p[0] * s, oy + p[1] * s, HANDLE_R, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 1
            ctx.stroke()
          })
        }
      })
      if (tool === 'bulk_select' && tab === 'doors' && bulkSelectedKeys.length > 0) {
        const bounds = getBulkSelectionBounds()
        if (bounds) {
          const { minX, minY, maxX, maxY } = bounds
          const pad = 6 / s
          const bx = ox + (minX - pad) * s
          const by = oy + (minY - pad) * s
          const bw = (maxX - minX + pad * 2) * s
          const bh = (maxY - minY + pad * 2) * s
          ctx.save()
          ctx.setLineDash([5, 4])
          ctx.lineWidth = 1.8
          ctx.strokeStyle = 'rgba(255,159,15,0.98)'
          ctx.fillStyle = 'rgba(255,159,15,0.08)'
          ctx.fillRect(bx, by, bw, bh)
          ctx.strokeRect(bx, by, bw, bh)
          ctx.setLineDash([])
          if (tool === 'bulk_select') {
            const corners: Point[] = [
              [minX - pad, minY - pad],
              [maxX + pad, minY - pad],
              [maxX + pad, maxY + pad],
              [minX - pad, maxY + pad],
            ]
            corners.forEach((c, idx) => {
              const hx = ox + c[0] * s
              const hy = oy + c[1] * s
              const active = bulkResizeHoverCorner === idx || dragging?.kind === 'bulk_scale'
              ctx.fillStyle = active ? '#FFD28A' : '#FF9F0F'
              ctx.beginPath()
              ctx.rect(hx - 5, hy - 5, 10, 10)
              ctx.fill()
              ctx.strokeStyle = 'rgba(0,0,0,0.85)'
              ctx.lineWidth = 1
              ctx.strokeRect(hx - 5, hy - 5, 10, 10)
            })
          }
          ctx.restore()
        }
      }
      if (dragging?.kind === 'bulk_marquee') {
        const x = Math.min(dragging.startCanvas.x, dragging.currentCanvas.x)
        const y = Math.min(dragging.startCanvas.y, dragging.currentCanvas.y)
        const w = Math.abs(dragging.currentCanvas.x - dragging.startCanvas.x)
        const h = Math.abs(dragging.currentCanvas.y - dragging.startCanvas.y)
        if (w >= 1 && h >= 1) {
          ctx.save()
          ctx.setLineDash([7, 5])
          ctx.lineWidth = 1.5
          ctx.strokeStyle = 'rgba(255,159,15,0.95)'
          ctx.fillStyle = 'rgba(255,159,15,0.16)'
          ctx.fillRect(x, y, w, h)
          ctx.strokeRect(x, y, w, h)
          ctx.restore()
        }
      }
      if (newPoints && newPoints.length >= 1) {
        const newStyle = tab === 'stair_opening' ? stairPreviewStyle : getDoorStyle(newDoorType)
        const endPt = newPoints.length === 2 ? newPoints[1] : previewEndPoint
        const x1 = endPt != null ? Math.min(newPoints[0][0], endPt[0]) : newPoints[0][0]
        const y1 = endPt != null ? Math.min(newPoints[0][1], endPt[1]) : newPoints[0][1]
        const x2 = endPt != null ? Math.max(newPoints[0][0], endPt[0]) : newPoints[0][0]
        const y2 = endPt != null ? Math.max(newPoints[0][1], endPt[1]) : newPoints[0][1]
        if (endPt != null && (x2 - x1) > 0 && (y2 - y1) > 0) {
          ctx.fillStyle = newStyle.fill
          ctx.globalAlpha = 0.35
          ctx.fillRect(ox + x1 * s, oy + y1 * s, (x2 - x1) * s, (y2 - y1) * s)
          ctx.globalAlpha = 1
          ctx.strokeStyle = newStyle.stroke
          ctx.setLineDash([4, 4])
          ctx.strokeRect(ox + x1 * s, oy + y1 * s, (x2 - x1) * s, (y2 - y1) * s)
          ctx.setLineDash([])
        }
        newPoints.forEach((p) => {
          ctx.fillStyle = '#FF9F0F'
          ctx.beginPath()
          ctx.arc(ox + p[0] * s, oy + p[1] * s, HANDLE_R, 0, Math.PI * 2)
          ctx.fill()
        })
      }
    }
  }, [
    tab,
    rooms,
    doors,
    demolitionPolys,
    zubauBestandPolys,
    zubauWallLines,
    wallLineDraft,
    stairOpeningRects,
    selectedIndex,
    tool,
    newPoints,
    newDoorType,
    previewEndPoint,
    effective,
    imageWidth,
    imageHeight,
    imageLoaded,
    dimUnselectedRoomPolygons,
    showRoomPolygonsUnderDoors,
    highlightRoofSurfaceUnderlay,
    interactiveRoomPolygonsInDoorsTab,
    bulkSelectedKeys,
    bulkResizeHoverCorner,
    blendAufstockungPhase1Overlays,
    blendZubauSiblingOverlays,
    useAufstockungsBasisDemolitionLabels,
    hideBasemap,
    roofOverlayRooms,
    stackedView,
    dragging,
    getBulkSelectionBounds,
    roofOverhangLines,
    roomsAddMode,
    roofOhDraft,
    roofOhPreviewEnd,
    roofOhHoveredEdge,
    roofOhSelectedLineIndex,
  ])

  useEffect(() => { draw() }, [draw])

  type HitResult =
    | {
        kind: 'poly' | 'vertex' | 'edge'
        index: number
        vertexIndex?: number
        edgeIndex?: number
        layer?: 'room' | 'door'
      }
    | { kind: 'roof_overhang_line'; index: number }
    | { kind: 'roof_oh_vertex'; lineIndex: number; vertexIndex: 0 | 1 }
    | { kind: 'roof_oh_segment'; lineIndex: number }

  const hitTest = useCallback((cx: number, cy: number): HitResult | null => {
    if (!effective) return null
    const pt = toImage(cx, cy)
    if (!pt) return null
    const [px, py] = pt
    const hitR = HIT_R / effective.scale
    const edgeR = EDGE_HIT_R / effective.scale
    const doorVertexR = DOOR_VERTEX_HIT_R / effective.scale

    if (tab === 'rooms' && tool === 'remove' && roofOverhangLines.length > 0) {
      for (let i = roofOverhangLines.length - 1; i >= 0; i--) {
        const ln = roofOverhangLines[i]
        if (!ln) continue
        if (distancePointToSegment(px, py, ln.a, ln.b) <= edgeR) {
          return { kind: 'roof_overhang_line', index: i }
        }
      }
    }

    /** Cu Dachfläche selectată în Bearbeiten: colțuri și muchii ale poligonului înaintea Überhang (evită „furatul” hit-ului). */
    if (tab === 'rooms' && tool === 'edit' && selectedIndex != null) {
      const si = selectedIndex
      if (si >= 0 && si < rooms.length) {
        const pts = rooms[si]?.points
        if (pts?.length) {
          for (let vi = 0; vi < pts.length; vi++) {
            if (dist(pts[vi]!, [px, py]) <= hitR) return { kind: 'vertex', index: si, vertexIndex: vi }
          }
          for (let ei = 0; ei < pts.length; ei++) {
            const a = pts[ei]!
            const b = pts[(ei + 1) % pts.length]!
            if (distToSegment(px, py, a, b) <= edgeR) return { kind: 'edge', index: si, edgeIndex: ei }
          }
        }
      }
    }

    if (tab === 'rooms' && tool === 'edit' && roofOverhangLines.length > 0) {
      const selOh = roofOhSelectedLineIndex
      const ohVertexR = (i: number) =>
        selOh != null && i === selOh ? ROOF_OH_SELECTED_VERTEX_HIT_R / effective.scale : hitR

      const tryOhVertices = (indices: number[]): HitResult | null => {
        for (const i of indices) {
          const ln = roofOverhangLines[i]
          if (!ln) continue
          const vr = ohVertexR(i)
          if (dist(ln.a, [px, py]) <= vr) return { kind: 'roof_oh_vertex', lineIndex: i, vertexIndex: 0 }
          if (dist(ln.b, [px, py]) <= vr) return { kind: 'roof_oh_vertex', lineIndex: i, vertexIndex: 1 }
        }
        return null
      }

      if (selOh != null && selOh >= 0 && selOh < roofOverhangLines.length) {
        const vSel = tryOhVertices([selOh])
        if (vSel) return vSel
      }
      const restIdx: number[] = []
      for (let i = roofOverhangLines.length - 1; i >= 0; i--) {
        if (selOh != null && i === selOh) continue
        restIdx.push(i)
      }
      const vRest = tryOhVertices(restIdx)
      if (vRest) return vRest

      if (selOh != null && selOh >= 0 && selOh < roofOverhangLines.length) {
        const ln0 = roofOverhangLines[selOh]
        if (ln0 && distToSegment(px, py, ln0.a, ln0.b) <= edgeR) return { kind: 'roof_oh_segment', lineIndex: selOh }
      }
      for (let i = roofOverhangLines.length - 1; i >= 0; i--) {
        if (selOh != null && i === selOh) continue
        const ln = roofOverhangLines[i]
        if (!ln) continue
        if (distToSegment(px, py, ln.a, ln.b) <= edgeR) return { kind: 'roof_oh_segment', lineIndex: i }
      }
    }

    /** Select: linia Überhang înaintea poligonului Dach (click pe muchie nu „cade” în interiorul suprafeței). */
    if (tab === 'rooms' && tool === 'select' && roofOverhangLines.length > 0) {
      for (let i = roofOverhangLines.length - 1; i >= 0; i--) {
        const ln = roofOverhangLines[i]
        if (!ln) continue
        if (distancePointToSegment(px, py, ln.a, ln.b) <= edgeR) {
          return { kind: 'roof_overhang_line', index: i }
        }
      }
    }

    const hitPolyVerticesAndEdges = (polys: { points: Point[] }[], n: number) => {
      const hitAt = (i: number) => {
        const pts = polys[i]?.points
        if (!pts?.length) return null
        for (let vi = 0; vi < pts.length; vi++) {
          if (dist(pts[vi], [px, py]) <= hitR) return { kind: 'vertex' as const, index: i, vertexIndex: vi }
        }
        for (let ei = 0; ei < pts.length; ei++) {
          const a = pts[ei]
          const b = pts[(ei + 1) % pts.length]
          if (distToSegment(px, py, a, b) <= edgeR) return { kind: 'edge' as const, index: i, edgeIndex: ei }
        }
        return null
      }
      if (tool === 'edit') {
        if (selectedIndex != null && selectedIndex >= 0 && selectedIndex < n) {
          const sel = hitAt(selectedIndex)
          if (sel) return sel
        }
        for (let i = n - 1; i >= 0; i--) {
          if (selectedIndex != null && i === selectedIndex) continue
          const h = hitAt(i)
          if (h) return h
        }
      }
      for (let i = n - 1; i >= 0; i--) {
        if (!pointInPolygon(px, py, polys[i].points)) continue
        return { kind: 'poly' as const, index: i }
      }
      return null
    }

    if (tab === 'rooms') {
      const h = hitPolyVerticesAndEdges(rooms, rooms.length)
      if (h) return h
    } else if (tab === 'zubau_bestand') {
      const h = hitPolyVerticesAndEdges(zubauBestandPolys, zubauBestandPolys.length)
      if (h) return h
    } else if (tab === 'demolition') {
      const h = hitPolyVerticesAndEdges(demolitionPolys, demolitionPolys.length)
      if (h) return h
    } else if (tab === 'zubau_walls') {
      if (tool === 'edit' && selectedIndex != null && selectedIndex >= 0 && selectedIndex < zubauWallLines.length) {
        const ln = zubauWallLines[selectedIndex]
        if (ln) {
          if (dist(ln.a, [px, py]) <= hitR) return { kind: 'vertex', index: selectedIndex, vertexIndex: 0 }
          if (dist(ln.b, [px, py]) <= hitR) return { kind: 'vertex', index: selectedIndex, vertexIndex: 1 }
        }
      }
      for (let i = zubauWallLines.length - 1; i >= 0; i--) {
        const ln = zubauWallLines[i]
        if (!ln) continue
        if (tool === 'edit') {
          if (dist(ln.a, [px, py]) <= hitR) return { kind: 'vertex', index: i, vertexIndex: 0 }
          if (dist(ln.b, [px, py]) <= hitR) return { kind: 'vertex', index: i, vertexIndex: 1 }
        }
        if (distToSegment(px, py, ln.a, ln.b) <= edgeR) return { kind: 'poly', index: i }
      }
    } else {
      const rects = tab === 'stair_opening' ? stairOpeningRects : doors
      for (let i = rects.length - 1; i >= 0; i--) {
        const [x1, y1, x2, y2] = rects[i].bbox
        const minX = Math.min(x1, x2) - DOOR_HIT_PADDING
        const maxX = Math.max(x1, x2) + DOOR_HIT_PADDING
        const minY = Math.min(y1, y2) - DOOR_HIT_PADDING
        const maxY = Math.max(y1, y2) + DOOR_HIT_PADDING
        const expandedBbox: [number, number, number, number] = [minX, minY, maxX, maxY]
        if (!pointInRect(px, py, expandedBbox)) continue
        if (tool === 'edit') {
          const corners: Point[] = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
          for (let vi = 0; vi < corners.length; vi++) {
            if (dist(corners[vi], [px, py]) <= doorVertexR) return { kind: 'vertex', index: i, vertexIndex: vi }
          }
        }
        if (tab === 'doors') return { kind: 'poly' as const, index: i, layer: 'door' as const }
        return { kind: 'poly' as const, index: i }
      }
      if (tab === 'doors' && interactiveRoomPolygonsInDoorsTab) {
        for (let i = rooms.length - 1; i >= 0; i--) {
          const pts = rooms[i]?.points
          if (!pts || pts.length < 3) continue
          if (pointInPolygon(px, py, pts)) return { kind: 'poly' as const, index: i, layer: 'room' as const }
        }
      }
    }
    return null
  }, [
    effective,
    tab,
    rooms,
    doors,
    demolitionPolys,
    zubauBestandPolys,
    zubauWallLines,
    stairOpeningRects,
    tool,
    toImage,
    selectedIndex,
    interactiveRoomPolygonsInDoorsTab,
    roofOverhangLines,
    roofOhSelectedLineIndex,
  ])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas || !effective) return
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const hit = hitTest(cx, cy)
    const pt = toImage(cx, cy)

    if (e.button !== 0) return

    const placePt = tool === 'add' ? toImageForPlacement(cx, cy) : pt

    if (tool === 'remove' && hit?.kind === 'roof_overhang_line' && onRemoveRoofOverhangLine) {
      onEditStart?.()
      onRemoveRoofOverhangLine(hit.index)
      return
    }

    if (tool === 'select' && tab === 'rooms' && hit?.kind === 'roof_overhang_line' && onRoofOverhangLineEditRequest) {
      onEditStart?.()
      onSelect(null)
      onRoofOverhangLineEditRequest(hit.index)
      return
    }

    if (tool === 'edit' && hit?.kind === 'roof_oh_vertex' && onRoofOverhangLinesChange) {
      onEditStart?.()
      onSelect(null)
      setRoofOhSelectedLineIndex(hit.lineIndex)
      ;(e.target as Element).setPointerCapture(e.pointerId)
      setDragging({
        kind: 'roof_oh_vertex',
        lineIndex: hit.lineIndex,
        vertexIndex: hit.vertexIndex,
      })
      return
    }

    if (tool === 'edit' && hit?.kind === 'roof_oh_segment') {
      setRoofOhSelectedLineIndex(hit.lineIndex)
      onSelect(null)
      return
    }

    if (tool === 'add' && tab === 'rooms' && roomsAddMode === 'roof_overhang_line') {
      if (!placePt || !effective || !onRoofOverhangLineComplete) return
      const maxDist = EDGE_HIT_R / effective.scale
      const snapped = snapToRoofEdges(
        placePt[0],
        placePt[1],
        rooms,
        maxDist,
        roofOhRoofIdx,
      )
      if (!snapped) return
      if (!roofOhDraft || roofOhDraft.length === 0) {
        setRoofOhDraft([snapped.point])
        setRoofOhRoofIdx(snapped.roofIndex)
        return
      }
      if (roofOhRoofIdx == null || snapped.roofIndex !== roofOhRoofIdx) return
      onRoofOverhangLineComplete(roofOhDraft[0], snapped.point, roofOhRoofIdx)
      setRoofOhDraft(null)
      setRoofOhRoofIdx(null)
      setRoofOhPreviewEnd(null)
      return
    }

    if (tool === 'add' && (tab === 'rooms' || tab === 'demolition' || tab === 'zubau_bestand')) {
      if (!placePt) return
      if (newPoints && newPoints.length >= 3 && dist(newPoints[0], placePt) * effective.scale <= CLOSE_POLYGON_HIT_PX) {
        onCloseNewPolygon()
      } else {
        onAddPoint(placePt[0], placePt[1])
      }
      return
    }

    if (tool === 'add' && tab === 'zubau_walls') {
      if (!placePt) return
      if (!wallLineDraft || wallLineDraft.length === 0) {
        setWallLineDraft([placePt])
        return
      }
      if (wallLineDraft.length === 1) {
        onEditStart?.()
        const pk = 'aufstockung_demolition_roof_basic_m2'
        onZubauWallLinesChange([...zubauWallLines, { a: wallLineDraft[0], b: placePt, price_key: pk }])
        setWallLineDraft(null)
        setPreviewEndPoint(null)
      }
      return
    }

    if (tool === 'add' && (tab === 'doors' || tab === 'stair_opening')) {
      if (placePt) onAddPoint(placePt[0], placePt[1])
      return
    }

    if (tool === 'bulk_select' && tab === 'doors' && onBulkPick) {
      if (hit?.kind === 'poly') {
        const inferredLayer: 'room' | 'door' | null =
          hit.layer === 'room' || hit.layer === 'door'
            ? hit.layer
            : 'door'
        if (inferredLayer) {
          if (e.shiftKey) {
            onBulkPick({ layer: inferredLayer, index: hit.index }, true)
            return
          }
          const key = inferredLayer === 'room' ? `r:${hit.index}` : `d:${hit.index}`
          if (!bulkSelectedKeys.includes(key)) {
            onBulkPick({ layer: inferredLayer, index: hit.index }, false)
            return
          }
        }
        if (e.shiftKey) return
      } else if (pt) {
        if (bulkSelectedKeys.length > 0 && !e.shiftKey) {
          // Existing multi-selection: allow move/resize logic below to run first.
        } else {
        ;(e.target as Element).setPointerCapture(e.pointerId)
        setDragging({
          kind: 'bulk_marquee',
          startCanvas: { x: cx, y: cy },
          currentCanvas: { x: cx, y: cy },
          startImage: [pt[0], pt[1]],
          currentImage: [pt[0], pt[1]],
        })
        return
        }
      }
    }

    if (hit?.kind === 'vertex' && hit.vertexIndex !== undefined) {
      onSelect(hit.index)
      onEditStart?.()
      ;(e.target as Element).setPointerCapture(e.pointerId)
      setDragging({ kind: 'vertex', polyIndex: hit.index, vertexIndex: hit.vertexIndex })
      return
    }

    if (hit?.kind === 'edge' && hit.edgeIndex !== undefined && pt) {
      onSelect(hit.index)
      if (onInsertVertex) {
        const last = lastEdgeClickRef.current
        const now = Date.now()
        if (last && now - last.time < 300 && last.polyIndex === hit.index && last.edgeIndex === hit.edgeIndex) {
          lastEdgeClickRef.current = null
          if (edgeDragTimeoutRef.current) {
            clearTimeout(edgeDragTimeoutRef.current)
            edgeDragTimeoutRef.current = null
          }
          onInsertVertex(hit.index, hit.edgeIndex, pt[0], pt[1])
        } else {
          lastEdgeClickRef.current = { time: now, polyIndex: hit.index, edgeIndex: hit.edgeIndex }
          if (edgeDragTimeoutRef.current) clearTimeout(edgeDragTimeoutRef.current)
          onEditStart?.()
          ;(e.target as Element).setPointerCapture(e.pointerId)
          const polySource = tab === 'demolition' ? demolitionPolys : tab === 'zubau_bestand' ? zubauBestandPolys : rooms
          const pts = polySource[hit.index].points
          const i = hit.edgeIndex
          const j = (i + 1) % pts.length
          setDragging({
            kind: 'edge',
            polyIndex: hit.index,
            edgeIndex: hit.edgeIndex,
            initV0: [...pts[i]],
            initV1: [...pts[j]],
            startImage: [pt[0], pt[1]],
          })
        }
      } else {
        onEditStart?.()
        ;(e.target as Element).setPointerCapture(e.pointerId)
        const polySource = tab === 'demolition' ? demolitionPolys : tab === 'zubau_bestand' ? zubauBestandPolys : rooms
        const pts = polySource[hit.index].points
        const i = hit.edgeIndex
        const j = (i + 1) % pts.length
        setDragging({
          kind: 'edge',
          polyIndex: hit.index,
          edgeIndex: hit.edgeIndex,
          initV0: [...pts[i]],
          initV1: [...pts[j]],
          startImage: [pt[0], pt[1]],
        })
      }
      return
    }

    if (
      tool === 'bulk_select' &&
      tab === 'doors' &&
      pt &&
      bulkSelectedKeys.length > 0 &&
      !hit
    ) {
      const bounds = getBulkSelectionBounds()
      if (bounds) {
        const { minX, minY, maxX, maxY } = bounds
        const pad = 6 / effective.scale
        const corners: Point[] = [
          [minX - pad, minY - pad],
          [maxX + pad, minY - pad],
          [maxX + pad, maxY + pad],
          [minX - pad, maxY + pad],
        ]
        const hitCorner = corners.findIndex((c) => dist(c, pt) <= BULK_RESIZE_HIT_R / effective.scale)
        if (hitCorner >= 0) {
          onEditStart?.()
          ;(e.target as Element).setPointerCapture(e.pointerId)
          const roomInits: Record<number, Point[]> = {}
          const doorInits: Record<number, [number, number, number, number]> = {}
          for (const k of bulkSelectedKeys) {
            if (k.startsWith('r:')) {
              const idx = Number(k.slice(2))
              const rtp = roomsRef.current[idx]?.points
              if (rtp) roomInits[idx] = rtp.map((p) => [...p] as Point)
            } else if (k.startsWith('d:')) {
              const idx = Number(k.slice(2))
              const bb = doorsRef.current[idx]?.bbox
              if (bb) doorInits[idx] = [...bb] as [number, number, number, number]
            }
          }
          const anchor = corners[(hitCorner + 2) % 4]
          const handleStart = corners[hitCorner]
          setDragging({
            kind: 'bulk_scale',
            roomInits,
            doorInits,
            anchor: [anchor[0], anchor[1]],
            handleStart: [handleStart[0], handleStart[1]],
            initRoofOhSnapshot: cloneRoofOverhangLines(roofOverhangLines),
          })
          return
        }
        const inBounds =
          pt[0] >= minX - pad &&
          pt[0] <= maxX + pad &&
          pt[1] >= minY - pad &&
          pt[1] <= maxY + pad
        if (inBounds) {
          onEditStart?.()
          ;(e.target as Element).setPointerCapture(e.pointerId)
          const roomInits: Record<number, Point[]> = {}
          const doorInits: Record<number, [number, number, number, number]> = {}
          for (const k of bulkSelectedKeys) {
            if (k.startsWith('r:')) {
              const idx = Number(k.slice(2))
              const rtp = roomsRef.current[idx]?.points
              if (rtp) roomInits[idx] = rtp.map((p) => [...p] as Point)
            } else if (k.startsWith('d:')) {
              const idx = Number(k.slice(2))
              const bb = doorsRef.current[idx]?.bbox
              if (bb) doorInits[idx] = [...bb] as [number, number, number, number]
            }
          }
          setDragging({
            kind: 'bulk',
            startImage: [pt[0], pt[1]],
            roomInits,
            doorInits,
            initRoofOhSnapshot: cloneRoofOverhangLines(roofOverhangLines),
          })
          return
        }
        if (!e.shiftKey) {
          onBulkPick?.(null, false)
          onSelect(null)
          return
        }
      }
    }

    if (hit?.kind === 'poly') {
      if (tab === 'doors' && hit.layer === 'room' && tool === 'remove') {
        onEditStart?.()
        onRoomsChange(rooms.filter((_, ri) => ri !== hit.index))
        return
      }
      if (
        tool === 'bulk_select' &&
        bulkSelectedKeys.length > 0 &&
        pt &&
        tab === 'doors' &&
        (hit.layer === 'room' || hit.layer === 'door')
      ) {
        const key = hit.layer === 'room' ? `r:${hit.index}` : `d:${hit.index}`
        if (bulkSelectedKeys.includes(key)) {
          onEditStart?.()
          ;(e.target as Element).setPointerCapture(e.pointerId)
          const roomInits: Record<number, Point[]> = {}
          const doorInits: Record<number, [number, number, number, number]> = {}
          for (const k of bulkSelectedKeys) {
            if (k.startsWith('r:')) {
              const idx = Number(k.slice(2))
              const rtp = roomsRef.current[idx]?.points
              if (rtp) roomInits[idx] = rtp.map((p) => [...p] as Point)
            } else if (k.startsWith('d:')) {
              const idx = Number(k.slice(2))
              const bb = doorsRef.current[idx]?.bbox
              if (bb) doorInits[idx] = [...bb] as [number, number, number, number]
            }
          }
          setDragging({
            kind: 'bulk',
            startImage: [pt[0], pt[1]],
            roomInits,
            doorInits,
            initRoofOhSnapshot: cloneRoofOverhangLines(roofOverhangLines),
          })
          return
        }
        if (!e.shiftKey) return
      }
      if ((tab === 'doors' || tab === 'stair_opening') && tool === 'remove') {
        onRemoveSelected(hit.index)
        return
      }
      // Select: tap = schimbare tip (callback); drag după prag = mutare dreptunghi
      if ((tab === 'doors' || tab === 'stair_opening') && tool === 'select' && pt && hit.layer !== 'room') {
        onSelect(hit.index)
        doorTapPendingRef.current = { index: hit.index, clientX: e.clientX, clientY: e.clientY, pt: [pt[0], pt[1]] }
        ;(e.target as Element).setPointerCapture(e.pointerId)
        return
      }
      if (tab === 'rooms' && pt && onRoomTypeLabelClick) {
        const r = rooms[hit.index]
        if (r?.points?.length) {
          let cx = 0, cy = 0
          r.points.forEach((p: Point) => { cx += p[0]; cy += p[1] })
          cx /= r.points.length
          cy /= r.points.length
          if (dist(pt, [cx, cy]) <= 25) {
            onRoomTypeLabelClick(hit.index)
            return
          }
        }
      }
      if (tool === 'remove') {
        onRemoveSelected(hit.index)
        return
      }
      if ((tool === 'select' || tool === 'edit') && pt) {
        if (tab === 'rooms') setRoofOhSelectedLineIndex(null)
        onSelect(hit.index)
        onEditStart?.()
        ;(e.target as Element).setPointerCapture(e.pointerId)
        if (tab === 'rooms' && hit.index < rooms.length)
          setDragging({
            kind: 'poly',
            polyIndex: hit.index,
            startImage: [pt[0], pt[1]],
            initPoints: rooms[hit.index].points.map((p) => [...p]),
            initRoofOhSnapshot: cloneRoofOverhangLines(roofOverhangLines),
          })
        else if (tab === 'demolition' && hit.index < demolitionPolys.length)
          setDragging({
            kind: 'poly',
            polyIndex: hit.index,
            startImage: [pt[0], pt[1]],
            initPoints: demolitionPolys[hit.index].points.map((p) => [...p]),
          })
        else if (tab === 'zubau_bestand' && hit.index < zubauBestandPolys.length)
          setDragging({
            kind: 'poly',
            polyIndex: hit.index,
            startImage: [pt[0], pt[1]],
            initPoints: zubauBestandPolys[hit.index].points.map((p) => [...p]),
          })
        else if (tab === 'doors' && hit.index < doors.length)
          setDragging({ kind: 'poly', polyIndex: hit.index, startImage: [pt[0], pt[1]], initBbox: [...doors[hit.index].bbox] })
        else if (tab === 'stair_opening' && hit.index < stairOpeningRects.length)
          setDragging({ kind: 'poly', polyIndex: hit.index, startImage: [pt[0], pt[1]], initBbox: [...stairOpeningRects[hit.index].bbox] })
        return
      }
      onSelect(hit.index)
      return
    }

    if (tool === 'select' && pt) {
      ;(e.target as Element).setPointerCapture(e.pointerId)
      setPanning(true)
      const panNow = stackedView?.pan ?? userPan
      setPanStart({ x: e.clientX - panNow.x, y: e.clientY - panNow.y })
    } else {
      onSelect(null)
    }
  }, [
    effective,
    tool,
    tab,
    newPoints,
    userPan,
    stackedView,
    hitTest,
    toImage,
    toImageForPlacement,
    onSelect,
    onAddPoint,
    onCloseNewPolygon,
    onRemoveSelected,
    onInsertVertex,
    onRoomTypeLabelClick,
    onEditStart,
    onZubauWallLinesChange,
    onBulkPick,
    onRoomsChange,
    rooms,
    doors,
    demolitionPolys,
    zubauBestandPolys,
    zubauWallLines,
    stairOpeningRects,
    wallLineDraft,
    bulkSelectedKeys,
    roomsAddMode,
    onRoofOverhangLineComplete,
    onRoofOverhangLineEditRequest,
    roofOhDraft,
    roofOhRoofIdx,
    onRemoveRoofOverhangLine,
    onRoofOverhangLinesChange,
    roofOverhangLines,
  ])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas || !effective) return
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const pt = toImage(cx, cy)
    const pendingTap = doorTapPendingRef.current
    if (pendingTap && !dragging) {
      const d = Math.hypot(e.clientX - pendingTap.clientX, e.clientY - pendingTap.clientY)
      if (d > DOOR_TAP_MAX_MOVE_PX) {
        const idx = pendingTap.index
        const dr =
          tab === 'stair_opening' ? stairRectsRef.current[idx] : doorsRef.current[idx]
        if (dr) {
          onEditStart?.()
          doorTapPendingRef.current = null
          setDragging({
            kind: 'poly',
            polyIndex: idx,
            startImage: pendingTap.pt,
            initBbox: [...dr.bbox] as [number, number, number, number],
          })
        }
      }
    }
    const hoverHit = hitTest(cx, cy)
    if ((tab === 'doors' || tab === 'stair_opening') && hoverHit?.kind === 'poly') {
      onDoorHover?.({ index: hoverHit.index, x: cx, y: cy })
    } else {
      onDoorHover?.(null)
    }
    if (tool === 'bulk_select' && tab === 'doors' && bulkSelectedKeys.length > 0 && pt && !dragging) {
      const bounds = getBulkSelectionBounds()
      if (bounds) {
        const pad = 6 / effective.scale
        const corners: Point[] = [
          [bounds.minX - pad, bounds.minY - pad],
          [bounds.maxX + pad, bounds.minY - pad],
          [bounds.maxX + pad, bounds.maxY + pad],
          [bounds.minX - pad, bounds.maxY + pad],
        ]
        const idx = corners.findIndex((c) => dist(c, pt) <= BULK_RESIZE_HIT_R / effective.scale)
        setBulkResizeHoverCorner(idx >= 0 ? idx : null)
      } else {
        setBulkResizeHoverCorner(null)
      }
    } else if (bulkResizeHoverCorner !== null) {
      setBulkResizeHoverCorner(null)
    }

    if (panning && panStart) {
      const nextPan = { x: e.clientX - panStart.x, y: e.clientY - panStart.y }
      if (onStackedViewChange && stackedView != null) {
        onStackedViewChange({ zoom: stackedView.zoom, pan: nextPan })
      } else {
        setUserPan(nextPan)
      }
      return
    }

    if (tool === 'add' && tab === 'rooms' && roomsAddMode === 'roof_overhang_line') {
      const preview = toImageForPlacement(cx, cy)
      if (preview && effective) {
        const maxDist = EDGE_HIT_R / effective.scale
        const snapped = snapToRoofEdges(preview[0], preview[1], roomsRef.current, maxDist, roofOhRoofIdx)
        setRoofOhPreviewEnd(roofOhDraft?.length === 1 ? snapped?.point ?? null : null)
        if (snapped) setRoofOhHoveredEdge({ roofIndex: snapped.roofIndex, edgeIndex: snapped.edgeIndex })
        else setRoofOhHoveredEdge(null)
      } else {
        setRoofOhPreviewEnd(null)
        setRoofOhHoveredEdge(null)
      }
    } else {
      setRoofOhPreviewEnd(null)
      setRoofOhHoveredEdge(null)
    }

    if (tool === 'add' && tab === 'zubau_walls' && wallLineDraft?.length === 1) {
      const preview = toImageForPlacement(cx, cy)
      setPreviewEndPoint(preview)
    } else if (tool === 'add' && (tab === 'doors' || tab === 'stair_opening') && newPoints?.length === 1) {
      const preview = toImageForPlacement(cx, cy)
      setPreviewEndPoint(preview)
    } else {
      setPreviewEndPoint(null)
    }

    const pending = pendingEdgeDragRef.current
    if (pending && pt && !dragging) {
      if (edgeDragTimeoutRef.current) {
        clearTimeout(edgeDragTimeoutRef.current)
        edgeDragTimeoutRef.current = null
      }
      pendingEdgeDragRef.current = null
      setDragging({ kind: 'edge', ...pending })
    }

    if (dragging && pt) {
      if (dragging.kind === 'roof_oh_vertex' && tab === 'rooms' && onRoofOverhangLinesChange) {
        const { lineIndex, vertexIndex } = dragging
        const lines = roofOhLinesRef.current
        const ln = lines[lineIndex]
        if (ln && effective) {
          const maxDist = EDGE_HIT_R / effective.scale
          const snapped = snapToRoofEdges(pt[0], pt[1], roomsRef.current, maxDist, ln.roofIndex)
          if (snapped) {
            const newPt = snapped.point
            const next = lines.map((l, i) => {
              if (i !== lineIndex) return l
              return vertexIndex === 0 ? { ...l, a: newPt } : { ...l, b: newPt }
            })
            onRoofOverhangLinesChange(next)
          }
        }
        return
      }
      if (dragging.kind === 'vertex') {
        const { polyIndex, vertexIndex } = dragging
        if (tab === 'rooms' && polyIndex < roomsRef.current.length) {
          const beforePts = roomsRef.current[polyIndex]?.points?.map((p) => [p[0], p[1]] as Point)
          const next = roomsRef.current.map((r, i) => {
            if (i !== polyIndex) return r
            const pts = r.points.map((p, vi) =>
              vi === vertexIndex
                ? [Math.max(0, Math.min(imageWidth, pt[0])), Math.max(0, Math.min(imageHeight, pt[1]))] as Point
                : p
            )
            return { ...r, points: pts }
          })
          onRoomsChange(next)
          const afterPts = next[polyIndex]?.points
          if (
            onRoofOverhangLinesChange &&
            beforePts &&
            afterPts &&
            roofOhLinesRef.current.some((l) => l.roofIndex === polyIndex)
          ) {
            onRoofOverhangLinesChange(
              transformRoofOverhangLinesWithPolygon(
                roofOhLinesRef.current,
                polyIndex,
                beforePts,
                afterPts,
              ),
            )
          }
        } else if (tab === 'demolition' && polyIndex < demolitionRef.current.length) {
          const next = demolitionRef.current.map((d, i) => {
            if (i !== polyIndex) return d
            const pts = d.points.map((p, vi) =>
              vi === vertexIndex
                ? [Math.max(0, Math.min(imageWidth, pt[0])), Math.max(0, Math.min(imageHeight, pt[1]))] as Point
                : p
            )
            return { ...d, points: pts }
          })
          onDemolitionPolysChange(next)
        } else if (tab === 'zubau_bestand' && polyIndex < zubauBestandRef.current.length) {
          const next = zubauBestandRef.current.map((d, i) => {
            if (i !== polyIndex) return d
            const pts = d.points.map((p, vi) =>
              vi === vertexIndex
                ? [Math.max(0, Math.min(imageWidth, pt[0])), Math.max(0, Math.min(imageHeight, pt[1]))] as Point
                : p
            )
            return { ...d, points: pts }
          })
          onZubauBestandPolysChange(next)
        } else if (tab === 'zubau_walls' && polyIndex < zubauWallsRef.current.length && (vertexIndex === 0 || vertexIndex === 1)) {
          const clamped: Point = [Math.max(0, Math.min(imageWidth, pt[0])), Math.max(0, Math.min(imageHeight, pt[1]))]
          const next = zubauWallsRef.current.map((l, i) => {
            if (i !== polyIndex) return l
            if (vertexIndex === 0) return { ...l, a: clamped }
            return { ...l, b: clamped }
          })
          onZubauWallLinesChange(next)
        } else if ((tab === 'doors' || tab === 'stair_opening') && polyIndex < (tab === 'stair_opening' ? stairRectsRef.current.length : doorsRef.current.length)) {
          const list = tab === 'stair_opening' ? stairRectsRef.current : doorsRef.current
          const d = list[polyIndex]
          const [x1, y1, x2, y2] = d.bbox
          const left = Math.min(x1, x2)
          const right = Math.max(x1, x2)
          const top = Math.min(y1, y2)
          const bottom = Math.max(y1, y2)
          const corners: Point[] = [[left, top], [right, top], [right, bottom], [left, bottom]]
          const opposite = (vertexIndex + 2) % 4
          const fixed = corners[opposite]
          const cx = Math.max(0, Math.min(imageWidth, pt[0]))
          const cy = Math.max(0, Math.min(imageHeight, pt[1]))
          let nx1 = Math.min(cx, fixed[0])
          let nx2 = Math.max(cx, fixed[0])
          let ny1 = Math.min(cy, fixed[1])
          let ny2 = Math.max(cy, fixed[1])
          const minPx = 1
          if (nx2 - nx1 < minPx) nx2 = nx1 + minPx
          if (ny2 - ny1 < minPx) ny2 = ny1 + minPx
          const next = list.map((dr, i) =>
            i !== polyIndex ? dr : { ...dr, bbox: [nx1, ny1, nx2, ny2] as [number, number, number, number] }
          )
          if (tab === 'stair_opening') onStairOpeningRectsChange(next)
          else onDoorsChange(next)
        }
      } else if (dragging.kind === 'edge') {
        if (tab !== 'rooms' && tab !== 'demolition' && tab !== 'zubau_bestand') return
        const { polyIndex, edgeIndex, initV0, initV1, startImage } = dragging
        const dx = pt[0] - startImage[0]
        const dy = pt[1] - startImage[1]
        const newV0: Point = [Math.max(0, Math.min(imageWidth, initV0[0] + dx)), Math.max(0, Math.min(imageHeight, initV0[1] + dy))]
        const newV1: Point = [Math.max(0, Math.min(imageWidth, initV1[0] + dx)), Math.max(0, Math.min(imageHeight, initV1[1] + dy))]
        const src = tab === 'demolition' ? demolitionRef.current : tab === 'zubau_bestand' ? zubauBestandRef.current : roomsRef.current
        const roomOrDemo = src[polyIndex]
        if (!roomOrDemo?.points) return
        const pts = roomOrDemo.points
        const beforePts = pts.map((p) => [p[0], p[1]] as Point)
        const j = (edgeIndex + 1) % pts.length
        const nextPts = pts.map((p, vi) => {
          if (vi === edgeIndex) return newV0
          if (vi === j) return newV1
          return p
        })
        if (tab === 'demolition') {
          onDemolitionPolysChange(demolitionRef.current.map((d, i) => (i !== polyIndex ? d : { ...d, points: nextPts })))
        } else if (tab === 'zubau_bestand') {
          onZubauBestandPolysChange(zubauBestandRef.current.map((d, i) => (i !== polyIndex ? d : { ...d, points: nextPts })))
        } else {
          onRoomsChange(roomsRef.current.map((r, i) => (i !== polyIndex ? r : { ...r, points: nextPts })))
          if (
            onRoofOverhangLinesChange &&
            roofOhLinesRef.current.some((l) => l.roofIndex === polyIndex)
          ) {
            onRoofOverhangLinesChange(
              transformRoofOverhangLinesWithPolygon(
                roofOhLinesRef.current,
                polyIndex,
                beforePts,
                nextPts,
              ),
            )
          }
        }
      } else if (dragging.kind === 'poly') {
        const { polyIndex, startImage, initPoints, initBbox, initRoofOhSnapshot } = dragging
        const dx = pt[0] - startImage[0]
        const dy = pt[1] - startImage[1]
        if (tab === 'rooms' && initPoints && polyIndex < roomsRef.current.length) {
          const nextPts = initPoints.map((p) => [Math.max(0, Math.min(imageWidth, p[0] + dx)), Math.max(0, Math.min(imageHeight, p[1] + dy))] as Point)
          const next = roomsRef.current.map((r, i) => i !== polyIndex ? r : { ...r, points: nextPts })
          onRoomsChange(next)
          if (onRoofOverhangLinesChange && initRoofOhSnapshot) {
            onRoofOverhangLinesChange(translateRoofOverhangLinesFromSnapshot(initRoofOhSnapshot, polyIndex, dx, dy))
          }
        } else if (tab === 'demolition' && initPoints && polyIndex < demolitionRef.current.length) {
          const nextPts = initPoints.map((p) => [Math.max(0, Math.min(imageWidth, p[0] + dx)), Math.max(0, Math.min(imageHeight, p[1] + dy))] as Point)
          onDemolitionPolysChange(demolitionRef.current.map((d, i) => (i !== polyIndex ? d : { ...d, points: nextPts })))
        } else if (tab === 'zubau_bestand' && initPoints && polyIndex < zubauBestandRef.current.length) {
          const nextPts = initPoints.map((p) => [Math.max(0, Math.min(imageWidth, p[0] + dx)), Math.max(0, Math.min(imageHeight, p[1] + dy))] as Point)
          onZubauBestandPolysChange(zubauBestandRef.current.map((d, i) => (i !== polyIndex ? d : { ...d, points: nextPts })))
        } else if (tab === 'doors' && initBbox && polyIndex < doorsRef.current.length) {
          const [a, b, c, d] = initBbox
          const nx1 = Math.max(0, Math.min(imageWidth, a + dx))
          const ny1 = Math.max(0, Math.min(imageHeight, b + dy))
          const nx2 = Math.max(0, Math.min(imageWidth, c + dx))
          const ny2 = Math.max(0, Math.min(imageHeight, d + dy))
          let ax1 = Math.min(nx1, nx2)
          let ax2 = Math.max(nx1, nx2)
          let ay1 = Math.min(ny1, ny2)
          let ay2 = Math.max(ny1, ny2)
          const minPx = 1
          if (ax2 - ax1 < minPx) ax2 = ax1 + minPx
          if (ay2 - ay1 < minPx) ay2 = ay1 + minPx
          const next = doorsRef.current.map((dr, i) =>
            i !== polyIndex ? dr : { ...dr, bbox: [ax1, ay1, ax2, ay2] as [number, number, number, number] }
          )
          onDoorsChange(next)
        } else if (tab === 'stair_opening' && initBbox && polyIndex < stairRectsRef.current.length) {
          const [a, b, c, d] = initBbox
          const nx1 = Math.max(0, Math.min(imageWidth, a + dx))
          const ny1 = Math.max(0, Math.min(imageHeight, b + dy))
          const nx2 = Math.max(0, Math.min(imageWidth, c + dx))
          const ny2 = Math.max(0, Math.min(imageHeight, d + dy))
          let ax1 = Math.min(nx1, nx2)
          let ax2 = Math.max(nx1, nx2)
          let ay1 = Math.min(ny1, ny2)
          let ay2 = Math.max(ny1, ny2)
          const minPx = 1
          if (ax2 - ax1 < minPx) ax2 = ax1 + minPx
          if (ay2 - ay1 < minPx) ay2 = ay1 + minPx
          const next = stairRectsRef.current.map((dr, i) =>
            i !== polyIndex ? dr : { ...dr, bbox: [ax1, ay1, ax2, ay2] as [number, number, number, number] }
          )
          onStairOpeningRectsChange(next)
        }
      } else if (dragging.kind === 'bulk' && pt) {
        const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
        const dx = pt[0] - dragging.startImage[0]
        const dy = pt[1] - dragging.startImage[1]
        const { roomInits, doorInits } = dragging
        const nextRooms = roomsRef.current.map((r, i) => {
          const init = roomInits[i]
          if (!init) return r
          return {
            ...r,
            points: init.map((p) => [clamp(p[0] + dx, 0, imageWidth), clamp(p[1] + dy, 0, imageHeight)] as Point),
          }
        })
        const nextDoors = doorsRef.current.map((d, i) => {
          const init = doorInits[i]
          if (!init) return d
          const [a, b, c, d0] = init
          const ax1 = clamp(a + dx, 0, imageWidth)
          const ay1 = clamp(b + dy, 0, imageHeight)
          const ax2 = clamp(c + dx, 0, imageWidth)
          const ay2 = clamp(d0 + dy, 0, imageHeight)
          let x1 = Math.min(ax1, ax2)
          let x2 = Math.max(ax1, ax2)
          let y1 = Math.min(ay1, ay2)
          let y2 = Math.max(ay1, ay2)
          const minPx = 1
          if (x2 - x1 < minPx) x2 = x1 + minPx
          if (y2 - y1 < minPx) y2 = y1 + minPx
          return { ...d, bbox: [x1, y1, x2, y2] as [number, number, number, number] }
        })
        onRoomsChange(nextRooms)
        onDoorsChange(nextDoors)
        if (onRoofOverhangLinesChange && dragging.initRoofOhSnapshot) {
          const roomSet = new Set(
            Object.keys(dragging.roomInits)
              .map((k) => Number(k))
              .filter((k) => Number.isFinite(k)),
          )
          if (roomSet.size > 0) {
            onRoofOverhangLinesChange(
              translateRoofOverhangLinesForRoofs(dragging.initRoofOhSnapshot, roomSet, dx, dy),
            )
          }
        }
      } else if (dragging.kind === 'bulk_scale' && pt) {
        const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
        const minScale = 0.05
        const dx0 = dragging.handleStart[0] - dragging.anchor[0]
        const dy0 = dragging.handleStart[1] - dragging.anchor[1]
        const dx1 = pt[0] - dragging.anchor[0]
        const dy1 = pt[1] - dragging.anchor[1]
        const sxRaw = Math.abs(dx0) < 1e-6 ? 1 : dx1 / dx0
        const syRaw = Math.abs(dy0) < 1e-6 ? 1 : dy1 / dy0
        const sx = Math.sign(sxRaw || 1) * Math.max(minScale, Math.abs(sxRaw))
        const sy = Math.sign(syRaw || 1) * Math.max(minScale, Math.abs(syRaw))
        const [ax, ay] = dragging.anchor
        const nextRooms = roomsRef.current.map((r, i) => {
          const init = dragging.roomInits[i]
          if (!init) return r
          return {
            ...r,
            points: init.map((p) => [clamp(ax + (p[0] - ax) * sx, 0, imageWidth), clamp(ay + (p[1] - ay) * sy, 0, imageHeight)] as Point),
          }
        })
        const nextDoors = doorsRef.current.map((d, i) => {
          const init = dragging.doorInits[i]
          if (!init) return d
          const [a, b, c, d0] = init
          const sx1 = clamp(ax + (a - ax) * sx, 0, imageWidth)
          const sy1 = clamp(ay + (b - ay) * sy, 0, imageHeight)
          const sx2 = clamp(ax + (c - ax) * sx, 0, imageWidth)
          const sy2 = clamp(ay + (d0 - ay) * sy, 0, imageHeight)
          let x1 = Math.min(sx1, sx2)
          let x2 = Math.max(sx1, sx2)
          let y1 = Math.min(sy1, sy2)
          let y2 = Math.max(sy1, sy2)
          const minPx = 1
          if (x2 - x1 < minPx) x2 = Math.min(imageWidth, x1 + minPx)
          if (y2 - y1 < minPx) y2 = Math.min(imageHeight, y1 + minPx)
          return { ...d, bbox: [x1, y1, x2, y2] as [number, number, number, number] }
        })
        onRoomsChange(nextRooms)
        onDoorsChange(nextDoors)
        if (onRoofOverhangLinesChange && dragging.initRoofOhSnapshot) {
          const roomSet = new Set(
            Object.keys(dragging.roomInits)
              .map((k) => Number(k))
              .filter((k) => Number.isFinite(k)),
          )
          if (roomSet.size > 0) {
            onRoofOverhangLinesChange(
              affineRoofOverhangLinesForRoofs(
                dragging.initRoofOhSnapshot,
                roomSet,
                [ax, ay],
                sx,
                sy,
                imageWidth,
                imageHeight,
              ),
            )
          }
        }
      } else if (dragging.kind === 'bulk_marquee' && pt) {
        setDragging({
          ...dragging,
          currentCanvas: { x: cx, y: cy },
          currentImage: [pt[0], pt[1]],
        })
      }
    }
  }, [
    panning,
    panStart,
    dragging,
    effective,
    tool,
    tab,
    newPoints,
    wallLineDraft,
    imageWidth,
    imageHeight,
    toImage,
    toImageForPlacement,
    hitTest,
    onDoorHover,
    onRoomsChange,
    onDoorsChange,
    onDemolitionPolysChange,
    onZubauBestandPolysChange,
    onZubauWallLinesChange,
    onStairOpeningRectsChange,
    onEditStart,
    stackedView,
    onStackedViewChange,
    bulkSelectedKeys.length,
    getBulkSelectionBounds,
    bulkResizeHoverCorner,
    roomsAddMode,
    roofOhDraft,
    roofOhRoofIdx,
    onRoofOverhangLinesChange,
  ])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const pendingTap = doorTapPendingRef.current
    if (pendingTap) {
      const d = Math.hypot(e.clientX - pendingTap.clientX, e.clientY - pendingTap.clientY)
      doorTapPendingRef.current = null
      if (d <= DOOR_TAP_MAX_MOVE_PX) {
        onDoorActivate?.(pendingTap.index)
      }
    }
    if (dragging?.kind === 'bulk_marquee') {
      const dxPx = dragging.currentCanvas.x - dragging.startCanvas.x
      const dyPx = dragging.currentCanvas.y - dragging.startCanvas.y
      const moved = Math.hypot(dxPx, dyPx)
      if (moved > 6 && onBulkMarqueeSelect) {
        const x1 = Math.min(dragging.startImage[0], dragging.currentImage[0])
        const y1 = Math.min(dragging.startImage[1], dragging.currentImage[1])
        const x2 = Math.max(dragging.startImage[0], dragging.currentImage[0])
        const y2 = Math.max(dragging.startImage[1], dragging.currentImage[1])
        onBulkMarqueeSelect({ x1, y1, x2, y2 }, e.shiftKey)
      } else if (onBulkPick && !e.shiftKey) {
        onBulkPick?.(null, false)
      }
    }
    try { (e.target as Element).releasePointerCapture(e.pointerId) } catch (_) {}
    setDragging(null)
    setPanning(false)
    setPanStart(null)
    setBulkResizeHoverCorner(null)
    if (edgeDragTimeoutRef.current) {
      clearTimeout(edgeDragTimeoutRef.current)
      edgeDragTimeoutRef.current = null
    }
    pendingEdgeDragRef.current = null
  }, [dragging, onDoorActivate, onBulkMarqueeSelect, onBulkPick])
  const handlePointerLeave = useCallback((e: React.PointerEvent) => {
    try { (e.target as Element).releasePointerCapture(e.pointerId) } catch (_) {}
    setDragging(null)
    setPanning(false)
    setPanStart(null)
    setBulkResizeHoverCorner(null)
    setPreviewEndPoint(null)
    if (edgeDragTimeoutRef.current) {
      clearTimeout(edgeDragTimeoutRef.current)
      edgeDragTimeoutRef.current = null
    }
    pendingEdgeDragRef.current = null
    doorTapPendingRef.current = null
    onDoorHover?.(null)
  }, [onDoorHover])

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!effective || !fit) return
    e.preventDefault()
    e.stopPropagation()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const imgX = (cx - effective.offX) / effective.scale
    const imgY = (cy - effective.offY) / effective.scale
    const factor = wheelEventToZoomFactor(e)
    const curZoom = stackedView?.zoom ?? userZoom
    const newZoom = Math.max(0.3, Math.min(5, curZoom * factor))
    const newOffX = cx - imgX * fit.scale * newZoom
    const newOffY = cy - imgY * fit.scale * newZoom
    const newPan = { x: newOffX - fit.offX, y: newOffY - fit.offY }
    if (stackedView != null) {
      if (onStackedViewChange) onStackedViewChange({ zoom: newZoom, pan: newPan })
      return
    }
    setUserZoom(newZoom)
    setUserPan(newPan)
  }, [effective, fit, userZoom, stackedView, onStackedViewChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const canvasCursor = (() => {
    if (panning) return 'grabbing'
    if (dragging?.kind === 'bulk_scale') return 'nwse-resize'
    if (dragging?.kind === 'vertex' || dragging?.kind === 'edge' || dragging?.kind === 'poly' || dragging?.kind === 'bulk')
      return 'move'
    if (bulkResizeHoverCorner != null && tool === 'bulk_select' && tab === 'doors') return 'nwse-resize'
    if (tool === 'bulk_select') return 'crosshair'
    if (tool === 'add') return 'crosshair'
    if (tool === 'remove') return 'default'
    if (tool === 'edit') return 'default'
    if (tool === 'select') return 'grab'
    return 'default'
  })()

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', cursor: canvasCursor }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    />
  )
}

