import {
  computeFloorFormKeyFromPlanIndex,
  constructionPlanIndicesForPerFloorFormData,
  padFloorKindsDraftRawToN,
} from '../lib/floorFormPlanKeys'

describe('floorFormPlanKeys', () => {
  describe('computeFloorFormKeyFromPlanIndex', () => {
    it('Erdgeschoss + Zubau → ground (PDF row Erdgeschoss)', () => {
      expect(
        computeFloorFormKeyFromPlanIndex(0, ['Erdgeschoss', '1. Obergeschoss'], ['zubau', 'zubau']),
      ).toBe('ground')
    })

    it('„1. Obergeschoss” după display devine Obergeschoss fără număr → fallback floor_1 pentru planIdx 1', () => {
      expect(
        computeFloorFormKeyFromPlanIndex(1, ['Erdgeschoss', '1. Obergeschoss'], ['zubau', 'zubau']),
      ).toBe('floor_1')
    })

    it('„Obergeschoss 2” devine după displayFloorTabLabelDe „Obergeschoss” → fără cifră în regex → floor_{planIdx}', () => {
      expect(
        computeFloorFormKeyFromPlanIndex(1, ['Erdgeschoss', 'Obergeschoss 2'], ['existing', 'zubau']),
      ).toBe('floor_1')
    })

    it('dacă eticheta păstrează „Obergeschoss N” (ex. prefix), regex extrage N → floor_N', () => {
      expect(
        computeFloorFormKeyFromPlanIndex(
          1,
          ['Erdgeschoss', 'Etage Obergeschoss 2'],
          ['existing', 'zubau'],
        ),
      ).toBe('floor_2')
    })

    it('primul plan fără etichetă EG: Zubau pe plan 0 → plan_0', () => {
      expect(computeFloorFormKeyFromPlanIndex(0, ['Plan 1', 'Plan 2'], ['zubau', 'existing'])).toBe('plan_0')
    })

    it('Keller → null (nu cerem form per „etaj” Keller)', () => {
      expect(computeFloorFormKeyFromPlanIndex(0, ['Keller', 'Erdgeschoss'], ['zubau', 'zubau'])).toBeNull()
    })

    it('Parter → ground', () => {
      expect(computeFloorFormKeyFromPlanIndex(0, ['Parter'], ['zubau'])).toBe('ground')
    })
  })

  describe('constructionPlanIndicesForPerFloorFormData', () => {
    it('ambele etaje Zubau: ambele indici (regresie: nu doar la tranziție Bestand→Neu)', () => {
      const kinds = padFloorKindsDraftRawToN(['new', 'new'], 2, true)
      expect(constructionPlanIndicesForPerFloorFormData(kinds, ['Erdgeschoss', '1. Obergeschoss'])).toEqual([0, 1])
    })

    it('doar OG Zubau: [1]', () => {
      const kinds = padFloorKindsDraftRawToN(['existing', 'zubau'], 2, true)
      expect(constructionPlanIndicesForPerFloorFormData(kinds, ['Erdgeschoss', '1. Obergeschoss'])).toEqual([1])
    })

    it('Keller Zubau + EG Zubau: Keller exclus din listă', () => {
      const kinds = padFloorKindsDraftRawToN(['zubau', 'zubau'], 2, true)
      expect(constructionPlanIndicesForPerFloorFormData(kinds, ['Keller', 'Erdgeschoss'])).toEqual([1])
    })

    it('toate Bestand: []', () => {
      const kinds = padFloorKindsDraftRawToN(['existing', 'existing'], 2, true)
      expect(constructionPlanIndicesForPerFloorFormData(kinds, ['Erdgeschoss', '1. Obergeschoss'])).toEqual([])
    })
  })

  describe('padFloorKindsDraftRawToN', () => {
    it('new + preferZubau → zubau', () => {
      expect(padFloorKindsDraftRawToN(['new'], 1, true)).toEqual(['zubau'])
    })

    it('new + preferZubau false → aufstockung', () => {
      expect(padFloorKindsDraftRawToN(['new'], 1, false)).toEqual(['aufstockung'])
    })
  })
})
