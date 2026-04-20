import schema from '../data/form-schema/holzbau-form-steps.json'
import { buildPriceSectionsFromFormStepsJson } from '../lib/buildFormFromJson'
import { mergeSelectOptions } from '../lib/mergeSelectOptions'

function stripLabelForOption(label: string): string {
  if (!label || typeof label !== 'string') return ''
  return (
    label
      .replace(/\s*\(\s*€\/m²\s*\)\s*$/i, '')
      .replace(/\s*\(\s*€\s*\)\s*$/i, '')
      .replace(/\s*\(\s*€\/Stück\s*\)\s*$/i, '')
      .replace(/\s*\(\s*CHF\/m²\s*\)\s*$/i, '')
      .replace(/\s*\(\s*CHF\s*\)\s*$/i, '')
      .replace(/\s*\(\s*CHF\/Stück\s*\)\s*$/i, '')
      .replace(/\s*\(\s*CHF\/m\s*\)\s*$/i, '')
      .replace(/\s*\(\s*Faktor\s*\)\s*$/i, '')
      .replace(/\s*\(\s*€\/m\s*\)\s*$/i, '')
      .trim() || label
  )
}

type TagFixture = {
  tag: string
  options: string[]
  optionValueToPriceKey: Record<string, string>
}

function collectTagFixtures(): TagFixture[] {
  const sections = buildPriceSectionsFromFormStepsJson(schema as unknown)
  const map = new Map<string, TagFixture>()

  for (const sec of sections) {
    for (const sub of sec.subsections) {
      if (!sub.fieldTag) continue
      const tag = sub.fieldTag
      const fixture = map.get(tag) ?? {
        tag,
        options: [],
        optionValueToPriceKey: {},
      }
      for (const v of sub.variables) {
        const opt = stripLabelForOption(v.label)
        if (!opt) continue
        if (!fixture.options.includes(opt)) fixture.options.push(opt)
        fixture.optionValueToPriceKey[opt] = v.id
      }
      map.set(tag, fixture)
    }
  }

  return Array.from(map.values()).sort((a, b) => a.tag.localeCompare(b.tag))
}

describe('Preisdatenbank -> Formular sync (exhaustive per fieldTag)', () => {
  const fixtures = collectTagFixtures()

  it('has a broad coverage set of selectable tags', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20)
  })

  for (const fixture of fixtures) {
    const { tag, options, optionValueToPriceKey } = fixture
    if (options.length === 0) continue

    it(`[${tag}] baseline options come from Preisdatenbank source`, () => {
      const out = mergeSelectOptions({
        tag,
        schemaOptions: ['__legacy_schema__'],
        preisdatenbankOptions: options,
        customOptions: [{ label: '__legacy_custom__', value: '__legacy_custom__' }],
        hiddenKeys: new Set<string>(),
        optionValueToPriceKey: { [tag]: optionValueToPriceKey },
      })
      expect(out).toEqual(options)
    })

    it(`[${tag}] add/update from Preisdatenbank source is reflected`, () => {
      const newOpt = `TEST_ADD_${tag}`
      const source = [...options, newOpt]
      const out = mergeSelectOptions({
        tag,
        schemaOptions: [],
        preisdatenbankOptions: source,
        customOptions: [],
        hiddenKeys: new Set<string>(),
        optionValueToPriceKey: {
          [tag]: {
            ...optionValueToPriceKey,
            [newOpt]: `opt_${tag}_test_add`,
          },
        },
      })
      expect(out.includes(newOpt)).toBe(true)
      expect(out[out.length - 1]).toBe(newOpt)
    })

    it(`[${tag}] delete/hidden in Preisdatenbank source is reflected`, () => {
      const firstOpt = options[0]
      const firstKey = optionValueToPriceKey[firstOpt] ?? `k_${tag}_0`
      const out = mergeSelectOptions({
        tag,
        schemaOptions: [],
        preisdatenbankOptions: options,
        customOptions: [],
        hiddenKeys: new Set<string>([firstKey]),
        optionValueToPriceKey: { [tag]: optionValueToPriceKey },
      })
      expect(out.includes(firstOpt)).toBe(false)
    })
  }

  it('profit_margin remains value-only in schema contract', () => {
    const sections = buildPriceSectionsFromFormStepsJson(schema as unknown)
    const profitSubs = sections
      .flatMap((s) => s.subsections)
      .filter((sub) => sub.fieldTag === 'profit_margin')

    expect(profitSubs.length).toBe(1)
    expect(profitSubs[0].variables.length).toBe(1)
    expect(profitSubs[0].variables[0].id).toBe('profit_margin_percent')
  })

  it('baustelleneinrichtung never leaks legacy literals', () => {
    const out = mergeSelectOptions({
      tag: 'baustelleneinrichtung',
      schemaOptions: [],
      preisdatenbankOptions: ['Standard', 'Mittel', 'Sondertransport'],
      customOptions: [{ label: 'Leicht (LKW 40t)', value: 'Leicht (LKW 40t)' }],
      hiddenKeys: new Set<string>(),
      optionValueToPriceKey: {
        baustelleneinrichtung: {
          Standard: 'baustelleneinrichtung_standard_percent',
          Mittel: 'legacy_key',
          Sondertransport: 'baustelleneinrichtung_sondertransport_percent',
          'Leicht (LKW 40t)': 'legacy_key_2',
        },
      },
    })

    expect(out).toEqual(['Standard', 'Sondertransport'])
  })
})
