import { mergeSelectOptions } from '../lib/mergeSelectOptions'

describe('mergeSelectOptions', () => {
  it('keeps new options added in Preisdatenbank for fields that already have schema options', () => {
    const result = mergeSelectOptions({
      tag: 'window_quality',
      schemaOptions: ['2-fach verglast', '3-fach verglast'],
      preisdatenbankOptions: ['2-fach verglast', '3-fach verglast', 'Passiv'],
      customOptions: [],
      hiddenKeys: new Set<string>(),
      optionValueToPriceKey: {
        window_quality: {
          '2-fach verglast': 'window_2_fach_price',
          '3-fach verglast': 'window_3_fach_price',
          Passiv: 'window_passiv_price',
        },
      },
    })

    expect(result).toEqual(['2-fach verglast', '3-fach verglast', 'Passiv'])
  })

  it('filters hidden options from Preisdatenbank source', () => {
    const result = mergeSelectOptions({
      tag: 'window_quality',
      schemaOptions: ['2-fach verglast', '3-fach verglast'],
      preisdatenbankOptions: ['2-fach verglast', '3-fach verglast', 'Passiv'],
      customOptions: [{ label: 'Ultra', value: 'Ultra' }],
      hiddenKeys: new Set<string>(['window_2_fach_price']),
      optionValueToPriceKey: {
        window_quality: {
          '2-fach verglast': 'window_2_fach_price',
          '3-fach verglast': 'window_3_fach_price',
          Passiv: 'window_passiv_price',
          Ultra: 'window_ultra_price',
        },
      },
    })

    expect(result).toEqual(['3-fach verglast', 'Passiv'])
  })

  it('uses schema and custom options as fallback when no Preisdatenbank options exist', () => {
    const result = mergeSelectOptions({
      tag: 'window_quality',
      schemaOptions: ['2-fach verglast', '3-fach verglast'],
      preisdatenbankOptions: [],
      customOptions: [{ label: 'Ultra', value: 'Ultra' }],
      hiddenKeys: new Set<string>(),
      optionValueToPriceKey: {
        window_quality: {
          '2-fach verglast': 'window_2_fach_price',
          '3-fach verglast': 'window_3_fach_price',
          Ultra: 'window_ultra_price',
        },
      },
    })

    expect(result).toEqual(['2-fach verglast', '3-fach verglast', 'Ultra'])
  })

  it('hides deleted custom option via hiddenKeys mapping', () => {
    const result = mergeSelectOptions({
      tag: 'garage_door_type',
      schemaOptions: [],
      preisdatenbankOptions: ['Sektionaltor Standard', 'Sektionaltor Premium', 'Rolltor'],
      customOptions: [],
      hiddenKeys: new Set<string>(['garage_door_rolltor_stueck']),
      optionValueToPriceKey: {
        garage_door_type: {
          'Sektionaltor Standard': 'garage_door_sektional_standard_stueck',
          'Sektionaltor Premium': 'garage_door_sektional_premium_stueck',
          Rolltor: 'garage_door_rolltor_stueck',
        },
      },
    })

    expect(result).toEqual(['Sektionaltor Standard', 'Sektionaltor Premium'])
  })

  it('deduplicates repeated labels from mixed sources', () => {
    const result = mergeSelectOptions({
      tag: 'stairs_type',
      schemaOptions: ['Holz', 'Beton'],
      preisdatenbankOptions: [],
      customOptions: [
        { label: 'Holz', value: 'Holz' },
        { label: 'Stahl', value: 'Stahl' },
      ],
      hiddenKeys: new Set<string>(),
      optionValueToPriceKey: {
        stairs_type: {
          Holz: 'stairs_holz_price',
          Beton: 'stairs_beton_price',
          Stahl: 'opt_stairs_type_stahl',
        },
      },
    })

    expect(result).toEqual(['Holz', 'Beton', 'Stahl'])
  })

  it('filters legacy Baustelleneinrichtung literals even if they are present in source', () => {
    const result = mergeSelectOptions({
      tag: 'baustelleneinrichtung',
      schemaOptions: [],
      preisdatenbankOptions: ['Standard', 'Mittel', 'Sondertransport'],
      customOptions: [{ label: 'Leicht (LKW 40t)', value: 'Leicht (LKW 40t)' }],
      hiddenKeys: new Set<string>(),
      optionValueToPriceKey: {
        baustelleneinrichtung: {
          Standard: 'baustelleneinrichtung_standard_percent',
          Sondertransport: 'baustelleneinrichtung_sondertransport_percent',
          Mittel: 'legacy_old_key',
          'Leicht (LKW 40t)': 'legacy_old_key_2',
        },
      },
    })

    expect(result).toEqual(['Standard', 'Sondertransport'])
  })
})
