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

  it('filters hidden options but still preserves visible custom additions', () => {
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

    expect(result).toEqual(['3-fach verglast', 'Passiv', 'Ultra'])
  })
})
