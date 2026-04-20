import { mergeSelectOptions } from '../lib/mergeSelectOptions'

describe('mergeSelectOptions stress matrix', () => {
  const mk = (entries: Array<[string, string]>) =>
    entries.reduce<Record<string, string>>((acc, [label, key]) => {
      acc[label] = key
      return acc
    }, {})

  it('uses Preisdatenbank source as single source of truth when available', () => {
    const out = mergeSelectOptions({
      tag: 'window_quality',
      schemaOptions: ['Legacy A', 'Legacy B'],
      preisdatenbankOptions: ['A', 'B', 'C'],
      customOptions: [{ label: 'Custom Z', value: 'Custom Z' }],
      hiddenKeys: new Set<string>(),
      optionValueToPriceKey: { window_quality: mk([['A', 'a'], ['B', 'b'], ['C', 'c']]) },
    })
    expect(out).toEqual(['A', 'B', 'C'])
  })

  it('falls back to schema + custom when Preisdatenbank options are missing', () => {
    const out = mergeSelectOptions({
      tag: 'window_quality',
      schemaOptions: ['A', 'B'],
      preisdatenbankOptions: [],
      customOptions: [{ label: 'C', value: 'C' }],
      hiddenKeys: new Set<string>(),
      optionValueToPriceKey: { window_quality: mk([['A', 'a'], ['B', 'b'], ['C', 'c']]) },
    })
    expect(out).toEqual(['A', 'B', 'C'])
  })

  it('removes hidden options from active source', () => {
    const out = mergeSelectOptions({
      tag: 'heating_type',
      schemaOptions: [],
      preisdatenbankOptions: ['Gas', 'Wärmepumpe', 'Elektrisch'],
      customOptions: [],
      hiddenKeys: new Set<string>(['hp']),
      optionValueToPriceKey: { heating_type: mk([['Gas', 'g'], ['Wärmepumpe', 'hp'], ['Elektrisch', 'e']]) },
    })
    expect(out).toEqual(['Gas', 'Elektrisch'])
  })

  it('keeps option when mapping is missing (cannot match hidden key)', () => {
    const out = mergeSelectOptions({
      tag: 'stairs_type',
      schemaOptions: [],
      preisdatenbankOptions: ['Holz', 'Beton'],
      customOptions: [],
      hiddenKeys: new Set<string>(['stairs_holz']),
      optionValueToPriceKey: { stairs_type: mk([['Beton', 'stairs_beton']]) },
    })
    expect(out).toEqual(['Holz', 'Beton'])
  })

  it('deduplicates same value across schema/custom fallback sources', () => {
    const out = mergeSelectOptions({
      tag: 'door_material_interior',
      schemaOptions: ['Standard', 'Holz'],
      preisdatenbankOptions: [],
      customOptions: [{ label: 'Holz', value: 'Holz' }, { label: 'Glas', value: 'Glas' }],
      hiddenKeys: new Set<string>(),
      optionValueToPriceKey: { door_material_interior: mk([['Standard', 's'], ['Holz', 'h'], ['Glas', 'g']]) },
    })
    expect(out).toEqual(['Standard', 'Holz', 'Glas'])
  })

  it('trims whitespace and skips empty options', () => {
    const out = mergeSelectOptions({
      tag: 'window_quality',
      schemaOptions: ['  2-fach  ', ''],
      preisdatenbankOptions: [],
      customOptions: [{ label: '   ', value: '' }, { label: '3-fach', value: '3-fach' }],
      hiddenKeys: new Set<string>(),
      optionValueToPriceKey: { window_quality: mk([['2-fach', 'w2'], ['3-fach', 'w3']]) },
    })
    expect(out).toEqual(['2-fach', '3-fach'])
  })

  describe('baustelleneinrichtung legacy guard', () => {
    const legacyCases = [
      'Leicht (LKW 40t)',
      'Mittel',
      'Schwierig',
      'Ușor (camion 40t)',
      'Usor (camion 40t)',
      'Mediu',
      'Dificil',
      'Sonderfall',
    ]

    for (const legacy of legacyCases) {
      it(`filters legacy literal "${legacy}"`, () => {
        const out = mergeSelectOptions({
          tag: 'baustelleneinrichtung',
          schemaOptions: [],
          preisdatenbankOptions: ['Standard', legacy, 'Sondertransport'],
          customOptions: [],
          hiddenKeys: new Set<string>(),
          optionValueToPriceKey: {
            baustelleneinrichtung: mk([
              ['Standard', 'b1'],
              [legacy, 'old'],
              ['Sondertransport', 'b3'],
            ]),
          },
        })
        expect(out).toEqual(['Standard', 'Sondertransport'])
      })
    }
  })

  it('does not apply legacy guard for other tags', () => {
    const out = mergeSelectOptions({
      tag: 'window_quality',
      schemaOptions: [],
      preisdatenbankOptions: ['Mittel', 'Passiv'],
      customOptions: [],
      hiddenKeys: new Set<string>(),
      optionValueToPriceKey: { window_quality: mk([['Mittel', 'x'], ['Passiv', 'y']]) },
    })
    expect(out).toEqual(['Mittel', 'Passiv'])
  })

  it('supports undefined tag in fallback mode', () => {
    const out = mergeSelectOptions({
      schemaOptions: ['A'],
      preisdatenbankOptions: [],
      customOptions: [{ label: 'B', value: 'B' }],
      hiddenKeys: new Set<string>(),
      optionValueToPriceKey: {},
    })
    expect(out).toEqual(['A', 'B'])
  })
})
