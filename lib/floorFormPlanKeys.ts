import { displayFloorTabLabelDe } from '@/lib/displayFloorTabLabelDe'

export function normalizeFloorKindRaw(k: unknown): string {
  return String(k ?? '').toLowerCase().trim()
}

export function normalizeFloorKindForAufstockung(k: unknown): 'new' | 'existing' {
  const v = String(k ?? '').toLowerCase()
  if (v === 'new' || v === 'zubau' || v === 'aufstockung') return 'new'
  return 'existing'
}

export function normalizeFloorKindDraftRaw(
  k: unknown,
  preferZubau: boolean,
): 'existing' | 'zubau' | 'aufstockung' {
  const v = normalizeFloorKindRaw(k)
  if (v === 'existing') return 'existing'
  if (v === 'zubau') return 'zubau'
  if (v === 'aufstockung') return 'aufstockung'
  if (v === 'new') return preferZubau ? 'zubau' : 'aufstockung'
  return 'existing'
}

export function padFloorKindsDraftRawToN(
  kinds: Array<string | undefined>,
  n: number,
  preferZubau: boolean,
): Array<'existing' | 'zubau' | 'aufstockung'> {
  return Array.from({ length: n }, (_, i) => normalizeFloorKindDraftRaw(kinds[i], preferZubau))
}

/**
 * Suffix pentru chei per-etaj (wandaufbau, bodenDeckeBelag, materialeFinisaj), aliniat cu PDF (Erdgeschoss → *_ground).
 */
export function computeFloorFormKeyFromPlanIndex(
  planIdx: number,
  floorLabels: string[],
  kinds: Array<string | 'existing' | 'zubau' | 'aufstockung' | undefined>,
): string | null {
  const lbl = String(displayFloorTabLabelDe(floorLabels[planIdx] ?? `Plan ${planIdx + 1}`) ?? '').toLowerCase()
  const rawKind = normalizeFloorKindRaw(kinds[planIdx] ?? '')
  const isZubauOrNewFirstPlan = planIdx === 0 && (rawKind === 'zubau' || rawKind === 'new')
  if (
    lbl.includes('keller') ||
    lbl.includes('kellergeschoss') ||
    lbl.includes('untergeschoss') ||
    lbl.includes('basement') ||
    lbl.includes('grundriss kg')
  ) {
    return null
  }
  if (lbl.includes('erdgeschoss') || lbl.includes('parter') || lbl.includes('ground')) return 'ground'
  const m = lbl.match(/obergeschoss\s*(\d+)/i)
  if (m && Number.isFinite(Number(m[1]))) return `floor_${Math.max(1, Number(m[1]))}`
  if (isZubauOrNewFirstPlan) return `plan_${planIdx}`
  return planIdx === 0 ? 'ground' : `floor_${planIdx}`
}

/** Plan indices (manifest order) that need per-floor form steps: Zubau/Aufstockung and not basement-only row. */
export function constructionPlanIndicesForPerFloorFormData(
  nextKinds: Array<'existing' | 'zubau' | 'aufstockung'>,
  floorLabels: string[],
): number[] {
  return Array.from({ length: nextKinds.length }, (_, i) => i).filter((idx) => {
    const next = String(nextKinds[idx] ?? 'existing')
    if (next !== 'zubau' && next !== 'aufstockung') return false
    const fk = computeFloorFormKeyFromPlanIndex(idx, floorLabels, nextKinds)
    return fk != null
  })
}
