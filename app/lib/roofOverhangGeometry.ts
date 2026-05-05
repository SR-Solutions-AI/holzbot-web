/** Image-space coordinates (matches DetectionsPolygonCanvas `Point`). */
export type Point = [number, number]

export type RoomPolygonLite = { points: Point[] }

export type RoofOverhangEdgeKind = 'traufe' | 'ortgang' | 'first' | 'dachrand'

export type RoofOverhangLine = {
  a: Point
  b: Point
  /** Index in `plan.rectangles` for this floor */
  roofIndex: number
  edgeKind: RoofOverhangEdgeKind
  /** Stored for pricing / display */
  overhangCm: number
}

function distSq(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  return dx * dx + dy * dy
}

/** Closest point on segment AB to P; t in [0,1] along AB */
export function closestPointOnSegment(p: Point, a: Point, b: Point): { q: Point; t: number; distSq: number } {
  const ax = a[0]
  const ay = a[1]
  const bx = b[0]
  const by = b[1]
  const px = p[0]
  const py = p[1]
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-18) {
    const ds = distSq(px, py, ax, ay)
    return { q: [ax, ay], t: 0, distSq: ds }
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const qx = ax + t * dx
  const qy = ay + t * dy
  const ds = distSq(px, py, qx, qy)
  return { q: [qx, qy], t, distSq: ds }
}

export function distancePointToSegment(px: number, py: number, a: Point, b: Point): number {
  const { distSq } = closestPointOnSegment([px, py], a, b)
  return Math.sqrt(distSq)
}

export type SnapToRoofEdgeResult = {
  point: Point
  roofIndex: number
  edgeIndex: number
  distSq: number
}

/**
 * Snap (x,y) to the nearest point on any edge of the given roof polygons.
 * If `restrictRoofIndex` is set (after first Überhang point), only edges of that polygon are considered.
 */
export function snapToRoofEdges(
  x: number,
  y: number,
  rectangles: RoomPolygonLite[],
  maxDist: number,
  restrictRoofIndex?: number | null,
): SnapToRoofEdgeResult | null {
  const maxSq = maxDist * maxDist
  let best: SnapToRoofEdgeResult | null = null
  const riStart = restrictRoofIndex != null ? restrictRoofIndex : 0
  const riEnd = restrictRoofIndex != null ? restrictRoofIndex + 1 : rectangles.length
  for (let ri = riStart; ri < riEnd; ri++) {
    const poly = rectangles[ri]
    const pts = poly?.points
    if (!pts || pts.length < 3) continue
    const n = pts.length
    for (let ei = 0; ei < n; ei++) {
      const a = pts[ei]
      const b = pts[(ei + 1) % n]
      const { q, distSq } = closestPointOnSegment([x, y], a, b)
      if (distSq <= maxSq && (!best || distSq < best.distSq)) {
        best = { point: q, roofIndex: ri, edgeIndex: ei, distSq }
      }
    }
  }
  return best
}

function pointInRoofPolygon(px: number, py: number, points: Point[]): boolean {
  if (points.length < 3) return false
  let inside = false
  const n = points.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = points[i]!
    const [xj, yj] = points[j]!
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/**
 * Heuristic: building span ~20 m across the roof bbox in image pixels → meters per pixel (for Überhang depth).
 */
export function estimateMetersPerPixelFromRoofs(
  rooms: RoomPolygonLite[],
  imageWidth: number,
  imageHeight: number,
): number {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const room of rooms) {
    const pts = room.points
    if (!pts?.length) continue
    for (const p of pts) {
      minX = Math.min(minX, p[0])
      minY = Math.min(minY, p[1])
      maxX = Math.max(maxX, p[0])
      maxY = Math.max(maxY, p[1])
    }
  }
  if (!Number.isFinite(minX)) {
    const span = Math.max(imageWidth, imageHeight, 1)
    return 20 / span
  }
  const span = Math.max(maxX - minX, maxY - minY, 1)
  const assumedBuildingM = 20
  return assumedBuildingM / span
}

/** Unit normal perpendicular to segment AB, pointing outside the roof polygon. */
export function outwardUnitNormalForSegmentOnRoof(roofPoints: Point[], a: Point, b: Point): [number, number] | null {
  const pts = roofPoints
  if (!pts || pts.length < 3) return null
  let cx = 0
  let cy = 0
  for (const p of pts) {
    cx += p[0]
    cy += p[1]
  }
  cx /= pts.length
  cy /= pts.length
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  const ex = b[0] - a[0]
  const ey = b[1] - a[1]
  const el = Math.hypot(ex, ey)
  if (el < 1e-9) return null
  let nx = -ey / el
  let ny = ex / el
  const vx = mx - cx
  const vy = my - cy
  if (nx * vx + ny * vy < 0) {
    nx = -nx
    ny = -ny
  }
  const eps = Math.max(2, el * 0.03)
  if (pointInRoofPolygon(mx + nx * eps, my + ny * eps, pts)) {
    nx = -nx
    ny = -ny
  }
  return [nx, ny]
}

/** Mărește adâncimea vizuală a benzii față de estimarea m/px (UX „mai lat”). */
export const OVERHANG_VISUAL_DEPTH_SCALE = 2

export type OverhangStripGeometry = {
  a: Point
  b: Point
  aOut: Point
  bOut: Point
  depthPx: number
}

function unitVec2(dx: number, dy: number): [number, number] {
  const l = Math.hypot(dx, dy)
  if (l < 1e-12) return [1, 0]
  return [dx / l, dy / l]
}

/** Drepte infinite: p1 + t*v1 și p2 + s*v2 (v1, v2 vectori direcție, nu neapărat unitari). */
export function intersectInfiniteLines(
  p1: Point,
  v1: [number, number],
  p2: Point,
  v2: [number, number],
): Point | null {
  const cross = v1[0] * v2[1] - v1[1] * v2[0]
  if (Math.abs(cross) < 1e-14) return null
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  const t = (dx * v2[1] - dy * v2[0]) / cross
  return [p1[0] + t * v1[0], p1[1] + t * v1[1]]
}

/**
 * La colțul poligonului unde se întâlnesc două linii Überhang pe muchii consecutive,
 * punctul exterior „miter” = intersecția celor două drepte paralele cu muchiile, offset spre exterior.
 */
export function computeOverhangMiterByVertex(
  roofPoly: Point[],
  linesOnRoof: RoofOverhangLine[],
  metersPerPixel: number,
): Map<number, Point> {
  const miters = new Map<number, Point>()
  const n = roofPoly.length
  if (n < 3 || linesOnRoof.length < 2) return miters

  let minEdge = Infinity
  for (let i = 0; i < n; i++) {
    const a = roofPoly[i]!
    const b = roofPoly[(i + 1) % n]!
    minEdge = Math.min(minEdge, Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const eps = Math.max(5, minEdge * 0.025)

  for (let vi = 0; vi < n; vi++) {
    const C = roofPoly[vi]!
    const touching: RoofOverhangLine[] = []
    for (const ln of linesOnRoof) {
      const da = Math.hypot(ln.a[0] - C[0], ln.a[1] - C[1])
      const db = Math.hypot(ln.b[0] - C[0], ln.b[1] - C[1])
      if (da <= eps || db <= eps) touching.push(ln)
    }
    if (touching.length < 2) continue

    outer: for (let i = 0; i < touching.length; i++) {
      for (let j = i + 1; j < touching.length; j++) {
        const L1 = touching[i]!
        const L2 = touching[j]!
        const u1 = unitVec2(L1.b[0] - L1.a[0], L1.b[1] - L1.a[1])
        const u2 = unitVec2(L2.b[0] - L2.a[0], L2.b[1] - L2.a[1])
        const dot = Math.abs(u1[0] * u2[0] + u1[1] * u2[1])
        if (dot > 0.995) continue

        const n1 = outwardUnitNormalForSegmentOnRoof(roofPoly, L1.a, L1.b)
        const n2 = outwardUnitNormalForSegmentOnRoof(roofPoly, L2.a, L2.b)
        if (!n1 || !n2) continue
        const s1 = computeOverhangStrip(roofPoly, L1.a, L1.b, L1.overhangCm, metersPerPixel)
        const s2 = computeOverhangStrip(roofPoly, L2.a, L2.b, L2.overhangCm, metersPerPixel)
        if (!s1 || !s2) continue

        const d1 = s1.depthPx
        const d2 = s2.depthPx
        const p1: Point = [C[0] + n1[0] * d1, C[1] + n1[1] * d1]
        const p2: Point = [C[0] + n2[0] * d2, C[1] + n2[1] * d2]
        const M = intersectInfiniteLines(p1, u1, p2, u2)
        if (!M) continue
        const miterLen = Math.hypot(M[0] - C[0], M[1] - C[1])
        if (miterLen > Math.max(d1, d2) * 25) continue

        miters.set(vi, M)
        break outer
      }
    }
  }

  return miters
}

/** Înlocuiește colțurile exterioare „crude” cu punctele miter acolo unde două linii se leagă la același vertex. */
export function applyMitersToStripCorners(
  roofPoly: Point[],
  strip: OverhangStripGeometry,
  miterByVertex: Map<number, Point>,
): { aOut: Point; bOut: Point } {
  let minEdge = Infinity
  const nv = roofPoly.length
  for (let i = 0; i < nv; i++) {
    const a = roofPoly[i]!
    const b = roofPoly[(i + 1) % nv]!
    minEdge = Math.min(minEdge, Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const eps = Math.max(5, minEdge * 0.025)

  function viFor(p: Point): number | null {
    for (let i = 0; i < nv; i++) {
      const q = roofPoly[i]!
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) <= eps) return i
    }
    return null
  }

  let aOut: Point = [strip.aOut[0], strip.aOut[1]]
  let bOut: Point = [strip.bOut[0], strip.bOut[1]]
  const via = viFor(strip.a)
  const vib = viFor(strip.b)
  if (via != null && miterByVertex.has(via)) {
    const m = miterByVertex.get(via)!
    aOut = [m[0], m[1]]
  }
  if (vib != null && miterByVertex.has(vib)) {
    const m = miterByVertex.get(vib)!
    bOut = [m[0], m[1]]
  }
  return { aOut, bOut }
}

/** Strip într-o parte a acoperișului: muchia pe contur + prelungire perpendiculară cu `overhangCm`. */
export function computeOverhangStrip(
  roofPoints: Point[],
  a: Point,
  b: Point,
  overhangCm: number,
  metersPerPixel: number,
): OverhangStripGeometry | null {
  const n = outwardUnitNormalForSegmentOnRoof(roofPoints, a, b)
  if (!n || !Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return null
  const depthM = Math.max(0, overhangCm) / 100
  const rawDepth = (depthM / metersPerPixel) * OVERHANG_VISUAL_DEPTH_SCALE
  if (!Number.isFinite(rawDepth)) return null
  /** Min. ~3 px ca banda să fie vizibilă la zoom îndepărtat (scalată). */
  const depthPx = Math.max(3, rawDepth)
  const [nx, ny] = n
  const aOut: Point = [a[0] + nx * depthPx, a[1] + ny * depthPx]
  const bOut: Point = [b[0] + nx * depthPx, b[1] + ny * depthPx]
  return { a, b, aOut, bOut, depthPx }
}

export function cloneRoofOverhangLines(lines: RoofOverhangLine[]): RoofOverhangLine[] {
  return lines.map((l) => ({ ...l, a: [l.a[0], l.a[1]] as Point, b: [l.b[0], l.b[1]] as Point }))
}

export function closestBoundaryEdgeAndT(poly: Point[], p: Point): { ei: number; t: number } | null {
  const n = poly.length
  if (n < 2) return null
  let bestD = Infinity
  let bestEi = 0
  let bestT = 0
  for (let ei = 0; ei < n; ei++) {
    const a = poly[ei]!
    const b = poly[(ei + 1) % n]!
    const { t, distSq } = closestPointOnSegment(p, a, b)
    const d = Math.sqrt(distSq)
    if (d < bestD) {
      bestD = d
      bestEi = ei
      bestT = t
    }
  }
  return { ei: bestEi, t: bestT }
}

export function boundaryPointAt(poly: Point[], ei: number, t: number): Point {
  const n = poly.length
  const a = poly[ei % n]!
  const b = poly[(ei + 1) % n]!
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
}

/** Reține poziția relativă pe contur când poligonul se deformează (vertex / muchie). */
export function remapRoofOverhangPoint(polyBefore: Point[], polyAfter: Point[], p: Point): Point {
  const hit = closestBoundaryEdgeAndT(polyBefore, p)
  if (!hit) return p
  return boundaryPointAt(polyAfter, hit.ei, hit.t)
}

export function transformRoofOverhangLinesWithPolygon(
  lines: RoofOverhangLine[],
  roofIndex: number,
  polyBefore: Point[],
  polyAfter: Point[],
): RoofOverhangLine[] {
  if (!lines.some((l) => l.roofIndex === roofIndex)) return lines
  return lines.map((ln) => {
    if (ln.roofIndex !== roofIndex) return ln
    return {
      ...ln,
      a: remapRoofOverhangPoint(polyBefore, polyAfter, ln.a),
      b: remapRoofOverhangPoint(polyBefore, polyAfter, ln.b),
    }
  })
}

export function translateRoofOverhangLinesFromSnapshot(
  snapshot: RoofOverhangLine[],
  polyIndex: number,
  dx: number,
  dy: number,
): RoofOverhangLine[] {
  return snapshot.map((ln) =>
    ln.roofIndex !== polyIndex
      ? ln
      : {
          ...ln,
          a: [ln.a[0] + dx, ln.a[1] + dy] as Point,
          b: [ln.b[0] + dx, ln.b[1] + dy] as Point,
        },
  )
}

export function translateRoofOverhangLinesForRoofs(
  snapshot: RoofOverhangLine[],
  roofIndices: Set<number>,
  dx: number,
  dy: number,
): RoofOverhangLine[] {
  if (roofIndices.size === 0 || !snapshot.some((l) => roofIndices.has(l.roofIndex))) return snapshot
  return snapshot.map((ln) =>
    !roofIndices.has(ln.roofIndex)
      ? ln
      : {
          ...ln,
          a: [ln.a[0] + dx, ln.a[1] + dy] as Point,
          b: [ln.b[0] + dx, ln.b[1] + dy] as Point,
        },
  )
}

export function affineRoofOverhangLinesForRoofs(
  snapshot: RoofOverhangLine[],
  roofIndices: Set<number>,
  anchor: Point,
  sx: number,
  sy: number,
  imageWidth: number,
  imageHeight: number,
): RoofOverhangLine[] {
  if (roofIndices.size === 0 || !snapshot.some((l) => roofIndices.has(l.roofIndex))) return snapshot
  const [ax, ay] = anchor
  const clampPt = (x: number, y: number): Point => [
    Math.max(0, Math.min(imageWidth, x)),
    Math.max(0, Math.min(imageHeight, y)),
  ]
  return snapshot.map((ln) => {
    if (!roofIndices.has(ln.roofIndex)) return ln
    const map = (p: Point) => clampPt(ax + (p[0] - ax) * sx, ay + (p[1] - ay) * sy)
    return { ...ln, a: map(ln.a), b: map(ln.b) }
  })
}
