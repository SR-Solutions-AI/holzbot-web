/**
 * Einheitliche Lizenz-Stufen (Holzbot & Betonbot): gleiche Kontingente und Preise.
 * Backend: tenant.config.usage.token_tier 1–4 entspricht Index 0–3 hier.
 *
 * Duplikat: betonbot-web/lib/subscriptionPriceTiers.ts — bei Änderungen beide Dateien anpassen.
 */

export type SubscriptionPriceTier = {
  label: string
  /** Anzeige auf Landing (Preisstruktur-Karte) */
  price: string
  highlight?: boolean
}

/** Landing / Marketing: Preisstruktur-Tabelle */
export const SUBSCRIPTION_PRICE_TIERS: readonly SubscriptionPriceTier[] = [
  { label: '5 Projekte / Monat', price: '299 €' },
  { label: '10 Projekte / Monat', price: '499 €' },
  { label: '25 Projekte / Monat', price: '999 €' },
  { label: 'Unlimitiert', price: '1.499 €', highlight: true },
]

/** Admin „Account plan“ (gleiche Reihenfolge wie token_tier 1–4) */
export const SUBSCRIPTION_TIER_ADMIN_LABELS_DE: readonly string[] = [
  '5 Projekte / Monat — 299 € zzgl. MwSt.',
  '10 Projekte / Monat — 499 € zzgl. MwSt.',
  '25 Projekte / Monat — 999 € zzgl. MwSt.',
  'Unlimitiert — 1.499 € zzgl. MwSt.',
]
