export function mergeSelectOptions(params: {
  tag?: string
  schemaOptions?: string[]
  preisdatenbankOptions?: string[]
  customOptions?: Array<{ label?: string; value?: string }>
  hiddenKeys?: Set<string>
  optionValueToPriceKey?: Record<string, Record<string, string>>
}): string[] {
  const {
    tag,
    schemaOptions = [],
    preisdatenbankOptions = [],
    customOptions = [],
    hiddenKeys = new Set<string>(),
    optionValueToPriceKey = {},
  } = params

  const out: string[] = []
  const seen = new Set<string>()
  const normalize = (v: string) => v.trim().toLowerCase()
  const hasPreisdatenbankSource = Boolean(tag && preisdatenbankOptions.length > 0)

  const isLegacyBaustelleneinrichtungOption = (value: string): boolean => {
    if (tag !== 'baustelleneinrichtung') return false
    const n = normalize(value)
    return (
      n === 'leicht (lkw 40t)' ||
      n === 'mittel' ||
      n === 'schwierig' ||
      n === 'ușor (camion 40t)' ||
      n === 'usor (camion 40t)' ||
      n === 'mediu' ||
      n === 'dificil' ||
      n === 'sonderfall'
    )
  }

  const add = (raw: string | undefined | null) => {
    const value = String(raw ?? '').trim()
    if (!value || seen.has(value)) return
    if (isLegacyBaustelleneinrichtungOption(value)) return
    const priceKey = tag ? optionValueToPriceKey[tag]?.[value] : undefined
    if (priceKey && hiddenKeys.has(priceKey)) return
    seen.add(value)
    out.push(value)
  }

  // Dacă avem opțiuni venite din Preisdatenbank pentru acest tag, formularul se construiește strict pe ele.
  // Nu mai amestecăm schemaOptions (fallback static) ca să evităm valori vechi/duplicate.
  for (const option of preisdatenbankOptions) add(option)
  if (!hasPreisdatenbankSource) {
    for (const option of schemaOptions) add(option)
    for (const option of customOptions) add(option?.label || option?.value || '')
  }

  return out
}
