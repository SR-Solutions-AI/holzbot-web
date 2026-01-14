'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { apiFetch } from '../lib/supabaseClient'
import { ADMIN_FIELD_LABELS_DE, ADMIN_STEP_LABELS_DE, toDeOption } from '../lib/adminDe'
import PdfThumbnail from './PdfThumbnail'

// Dynamic import pentru SimplePdfViewer - doar pe client pentru a evita problemele cu Turbopack
// Folosim .client.tsx wrapper pentru a forța încărcarea doar pe client
const SimplePdfViewer = dynamic(() => import('./SimplePdfViewer.client'), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-neutral-200">PDF wird generiert…</div>
})

type AdminUser = {
  id: string
  email: string
  role: string | null
  full_name: string | null
  tenant_id: string
  created_at: string | null
  tenants?: { id: string; slug: string; name: string; config?: any } | null
}

type AdminOffer = {
  id: string
  title?: string | null
  status?: string | null
  meta?: { referinta?: string | null } | null
  created_at: string
  tenant_id: string
  created_by: string | null
  settings_summary?: string[] | null
  settings_raw?: Record<string, any> | null
  total_price?: number | null
}

function fmtDate(ts?: string | null) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('de-DE')
  } catch {
    return ts
  }
}

function formatPriceEUR(v?: number | null) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}

type SettingRow = { stepKey: string; fieldKey: string; label: string; value: string }
function parseSettingRow(s: string): { label: string; value: string } | null {
  // Current API format: "Label: Value"
  const idx = s.indexOf(':')
  if (idx <= 0) return null
  return { label: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() }
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [offers, setOffers] = useState<AdminOffer[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingOffers, setLoadingOffers] = useState(false)
  const [assetsByOffer, setAssetsByOffer] = useState<Record<string, { planUrl?: string | null; planMime?: string | null; pdfUrl?: string | null; adminPdfUrl?: string | null; calculationMethodPdfUrl?: string | null; loading?: boolean }>>({})
  const [lightbox, setLightbox] = useState<{ kind: 'plan' | 'pdf'; url: string; mime?: string | null } | null>(null)
  const [processingImages, setProcessingImages] = useState<Record<string, Record<string, Array<{ id: string; url: string; filename: string; plan_id?: string }>>>>({})
  const [processingModal, setProcessingModal] = useState<string | null>(null)

  const selectedUser = useMemo(
    () => users.find(u => u.id === selectedUserId) ?? null,
    [users, selectedUserId],
  )

  async function loadUsers() {
    setLoadingUsers(true)
    try {
      const res = await apiFetch('/admin/users')
      setUsers((res?.items ?? []) as AdminUser[])
      // Auto-select first user if none selected
      const first = (res?.items ?? [])[0]?.id
      if (!selectedUserId && first) setSelectedUserId(first)
    } finally {
      setLoadingUsers(false)
    }
  }

  async function loadOffersForUser(userId: string) {
    setLoadingOffers(true)
    try {
      const res = await apiFetch(`/admin/users/${encodeURIComponent(userId)}/offers?limit=200`)
      setOffers((res?.items ?? []) as AdminOffer[])
      setSelectedOfferId(null)
      setAssetsByOffer({})
    } finally {
      setLoadingOffers(false)
    }
  }

  useEffect(() => {
    loadUsers().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedUserId) return
    loadOffersForUser(selectedUserId).catch(() => {})
  }, [selectedUserId])

  // Lazy-load plan + PDF previews for the first N offers.
  useEffect(() => {
    const list = offers.slice(0, 20)
    if (!list.length) return
    let cancelled = false
    
    ;(async () => {
      const updates: Record<string, any> = {}
      
      // First, mark all as loading
      const loadingUpdates: Record<string, any> = {}
      list.forEach(o => {
        if (!assetsByOffer[o.id] || assetsByOffer[o.id].loading === undefined) {
          loadingUpdates[o.id] = { ...assetsByOffer[o.id], loading: true }
        }
      })
      if (Object.keys(loadingUpdates).length > 0) {
        setAssetsByOffer(prev => ({ ...prev, ...loadingUpdates }))
      }
      
      // Then load assets
      await Promise.all(
        list.map(async (o) => {
          const existing = assetsByOffer[o.id]
          // Only skip if we have both URLs and they're not null
          if (existing && existing.planUrl !== undefined && existing.pdfUrl !== undefined && existing.loading === false) {
            // But reload if URLs are null (might have failed before)
            if (existing.planUrl !== null || existing.pdfUrl !== null) {
              return // Already loaded successfully
            }
          }
          try {
            const exp = await apiFetch(`/offers/${o.id}/export`)
            if (cancelled) return
            const plan = exp?.files?.plan
            const pdf = exp?.files?.pdf
            const adminPdf = exp?.files?.adminPdf
            const calculationMethodPdf = exp?.files?.calculationMethodPdf
            updates[o.id] = {
              planUrl: plan?.download_url ?? null,
              planMime: plan?.meta?.mime ?? null,
              pdfUrl: pdf?.download_url ?? exp?.pdf ?? exp?.download_url ?? null,
              adminPdfUrl: adminPdf?.download_url ?? null,
              calculationMethodPdfUrl: calculationMethodPdf?.download_url ?? null,
              loading: false,
            }
          } catch (err) {
            if (cancelled) return
            console.warn(`Failed to load assets for offer ${o.id}:`, err)
            updates[o.id] = { planUrl: null, planMime: null, pdfUrl: null, loading: false }
          }
        }),
      )
      if (cancelled) return
      setAssetsByOffer(prev => {
        const merged = { ...prev }
        Object.keys(updates).forEach(id => {
          merged[id] = { ...merged[id], ...updates[id] }
        })
        return merged
      })
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers])

  return (
    <>
      {/* Left: users */}
      <aside className="bg-panel/80 border border-black/40 rounded-xl2 p-3 shadow-soft flex flex-col min-w-0 h-full min-h-0">
        <div className="text-sand font-semibold mb-3 shrink-0 flex items-center justify-between gap-2">
          <span>Accounts</span>
          <button
            className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#FF9F0F]/10 hover:bg-[#FF9F0F]/20 text-xs text-[#FF9F0F] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            onClick={() => loadUsers()}
            disabled={loadingUsers}
            title="Refresh"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loadingUsers ? 'Lädt...' : 'Aktualisieren'}
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto hide-scroll space-y-2 pr-1">
          {loadingUsers && users.length === 0 ? (
            <div className="text-sm text-sand/70">Loading…</div>
          ) : null}
          {users.map(u => {
            const active = u.id === selectedUserId
            const companyName = (u.tenants as any)?.name || (u.tenants as any)?.slug || 'Company'
            const rep =
              (u.tenants as any)?.config?.pdf?.handler_name ||
              (u.tenants as any)?.config?.pdf?.handlerName ||
              null
            return (
              <button
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                className={`list-btn ${active ? 'list-btn--active' : ''}`}
                title={u.id}
              >
                <div className="text-sm font-bold tracking-wide text-sand truncate">
                  {companyName}
                </div>
                <div className="text-xs text-neutral-200/70 truncate">
                  {u.email}{rep ? ` — ${rep}` : ''}
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* Middle: offers for selected user */}
      <main className="bg-panel/80 border border-black/40 rounded-xl2 p-3 shadow-soft min-w-0 h-full min-h-0 overflow-hidden flex flex-col">
        <div className="text-sand font-semibold mb-3 shrink-0 flex items-center justify-between gap-2">
          <div className="min-w-0 truncate">
            Offers {selectedUser ? <span className="text-sand/60 font-normal">— {selectedUser.email}</span> : null}
          </div>
          <button
            className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#FF9F0F]/10 hover:bg-[#FF9F0F]/20 text-xs text-[#FF9F0F] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            onClick={() => (selectedUserId ? loadOffersForUser(selectedUserId) : null)}
            disabled={loadingOffers || !selectedUserId}
            title="Refresh"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loadingOffers ? 'Lädt...' : 'Aktualisieren'}
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto hide-scroll pr-1">
          {loadingOffers && offers.length === 0 ? (
            <div className="text-sm text-sand/70">Loading…</div>
          ) : null}
          {!loadingOffers && offers.length === 0 ? (
            <div className="text-sm text-sand/70">
              No offers found for this account.
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {offers.map(o => {
            const display = (o?.meta as any)?.referinta || o?.title || 'Offer'
            const active = o.id === selectedOfferId
            const summary = (o.settings_summary ?? []).filter(Boolean)
            // Convert to grouped-by-step rows (Bausystem / Materialien / Energie / Logistik)
            const rows: SettingRow[] = summary
              .map(parseSettingRow)
              .filter(Boolean)
              .map(({ label, value }: any) => {
                // map our known labels to step+field buckets
                const map: Record<string, { stepKey: string; fieldKey: string }> = {
                  'System': { stepKey: 'sistemConstructiv', fieldKey: 'tipSistem' },
                  'Vorfertigungsgrad': { stepKey: 'sistemConstructiv', fieldKey: 'gradPrefabricare' },
                  'Fundament': { stepKey: 'sistemConstructiv', fieldKey: 'tipFundatie' },
                  'Dachtyp': { stepKey: 'sistemConstructiv', fieldKey: 'tipAcoperis' },
                  'Angebotsumfang': { stepKey: 'materialeFinisaj', fieldKey: 'nivelOferta' },
                  'Fassade': { stepKey: 'materialeFinisaj', fieldKey: 'fatada' },
                  'Fenster': { stepKey: 'materialeFinisaj', fieldKey: 'tamplarie' },
                  'Innenausbau': { stepKey: 'materialeFinisaj', fieldKey: 'finisajInterior' },
                  'Dachmaterial': { stepKey: 'materialeFinisaj', fieldKey: 'materialAcoperis' },
                  'Heizung': { stepKey: 'performanta', fieldKey: 'incalzire' },
                  'Energie': { stepKey: 'performanta', fieldKey: 'nivelEnergetic' },
                  'Gelände': { stepKey: 'logistica', fieldKey: 'teren' },
                  'Zufahrt': { stepKey: 'logistica', fieldKey: 'accesSantier' },
                }
                const m = map[label] ?? { stepKey: 'other', fieldKey: label }
                const fieldLabel = ADMIN_FIELD_LABELS_DE[m.fieldKey] ?? label
                return { stepKey: m.stepKey, fieldKey: m.fieldKey, label: fieldLabel, value: toDeOption(value) }
              })

            // Build ALL steps from raw steps (preferred), falling back to derived rows.
            const settingsRaw = (o.settings_raw ?? null) as Record<string, any> | null
            const allStepKeys = settingsRaw ? Object.keys(settingsRaw) : []
            const FORM_ORDER = ['dateGenerale','client','sistemConstructiv','materialeFinisaj','performanta','performantaEnergetica','logistica','conditiiSantier','upload']
            const stepKeys = (allStepKeys.length ? allStepKeys : FORM_ORDER)
              .slice()
              .sort((a, b) => {
                const ia = FORM_ORDER.indexOf(a); const ib = FORM_ORDER.indexOf(b)
                if (ia === -1 && ib === -1) return a.localeCompare(b)
                if (ia === -1) return 1
                if (ib === -1) return -1
                return ia - ib
              })

            const price = formatPriceEUR(o.total_price)
            const assets = assetsByOffer[o.id]
            return (
              <div
                key={o.id}
                onClick={() => {
                  setSelectedOfferId(o.id)
                  window.dispatchEvent(new CustomEvent('offer:selected', { detail: { offerId: o.id } }))
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedOfferId(o.id)
                    window.dispatchEvent(new CustomEvent('offer:selected', { detail: { offerId: o.id } }))
                  }
                }}
                className={[
                  'w-full text-left rounded-xl border border-black/40',
                  'bg-coffee-700 backdrop-blur-sm',
                  'p-4 shadow-soft transition h-full flex flex-col',
                  'hover:bg-coffee-600 hover:border-[#FF9F0F]/25 cursor-pointer',
                  active ? 'ring-2 ring-[#FF9F0F]/40 bg-coffee-600' : '',
                ].join(' ')}
                title={o.id}
              >
                {/* Header: title + price */}
                <div className="flex items-start justify-between gap-2 mb-3 pb-2 border-b border-white/15">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[14px] text-white/85 truncate leading-tight">{display}</div>
                    <div className="mt-0.5 text-[11px] text-white/65 leading-tight">{fmtDate(o.created_at)}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {price ? (
                      <div className="text-[13px] font-bold text-[#FFB84D]">
                        {price}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (!processingImages[o.id]) {
                          try {
                            const res = await apiFetch(`/admin/offers/${o.id}/processing-images`)
                            setProcessingImages(prev => ({ ...prev, [o.id]: res }))
                          } catch (err) {
                            console.error('Failed to load processing images:', err)
                          }
                        }
                        setProcessingModal(o.id)
                      }}
                      className="px-2 py-1 text-[10px] rounded border border-[#FF9F0F]/25 bg-[#FF9F0F]/12 hover:bg-[#FF9F0F]/18 text-[#FFB84D] font-medium transition-colors"
                      title="Verarbeitungsdetails anzeigen"
                    >
                      Details
                    </button>
                  </div>
                </div>

                {/* Content: steps/chips on left, previews on right */}
                <div className="flex-1 flex gap-2 min-h-0">
                  {/* Left: Steps with chips */}
                  <div className="flex-1 min-w-0">
                    {stepKeys.length ? (
                      <div className="space-y-1">
                        {stepKeys.map((stepKey) => {
                          const stepData = settingsRaw ? (settingsRaw[stepKey] ?? {}) : {}
                          const entries = stepData && typeof stepData === 'object' ? Object.entries(stepData) : []
                          const chips = entries
                            .filter(([_, v]) => v !== null && v !== undefined && String(v).trim?.() !== '')
                            .slice(0, 4)
                            .map(([k, v]) => ({
                              label: ADMIN_FIELD_LABELS_DE[k] ?? k,
                              value: toDeOption(v),
                            }))
                          if (!chips.length && !entries.length) return null
                          return (
                            <div key={stepKey} className="p-1">
                              <div className="text-[9px] font-semibold text-white/75 truncate leading-tight mb-1">
                                {ADMIN_STEP_LABELS_DE[stepKey] ?? stepKey}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {chips.map((c, i) => (
                                  <span
                                    key={i}
                                    className="max-w-full truncate px-1.5 py-0.5 rounded text-[8px] border border-[#FF9F0F]/25 bg-[#FF9F0F]/12 text-[#FFB84D] leading-tight"
                                    title={`${c.label}: ${c.value}`}
                                  >
                                    {c.value}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>

                  {/* Right: Portrait previews stacked */}
                  <div className="shrink-0 flex flex-col gap-2.5">
                    {assets?.loading ? (
                      <div className="w-[120px] h-[160px] rounded-lg border border-white/15 bg-[#2A1F18] flex items-center justify-center">
                        <span className="text-[9px] text-white/50">Lädt...</span>
                      </div>
                    ) : assets?.planUrl ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setLightbox({ kind: 'plan', url: assets.planUrl!, mime: assets.planMime ?? null })
                        }}
                        className="w-[120px] h-[160px] rounded-lg overflow-hidden border border-white/15 bg-[#2A1F18] shadow-sm hover:border-[#FF9F0F]/25 transition relative group"
                        title="Plan"
                      >
                        {String(assets.planMime || '').includes('pdf') ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-white/70">
                            <svg className="w-10 h-10 text-caramel/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <div className="text-[9px] font-medium">Plan PDF</div>
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img 
                            src={assets.planUrl} 
                            alt="Plan" 
                            className="w-full h-full object-contain bg-white/5" 
                            loading="lazy"
                            onError={(e) => {
                              const target = e.currentTarget
                              target.style.display = 'none'
                              const parent = target.parentElement
                              if (parent && !parent.querySelector('.error-placeholder')) {
                                const placeholder = document.createElement('div')
                                placeholder.className = 'error-placeholder w-full h-full flex items-center justify-center text-[9px] text-white/30'
                                placeholder.textContent = 'Fehler'
                                parent.appendChild(placeholder)
                              }
                            }} 
                          />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                      </button>
                      ) : (
                      <div className="w-[120px] h-[160px] rounded-lg border border-white/15 bg-[#2A1F18] flex items-center justify-center">
                        <span className="text-[9px] text-white/50">Kein Plan</span>
                      </div>
                    )}

                    {assets?.pdfUrl ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setLightbox({ kind: 'pdf', url: assets.pdfUrl! })
                        }}
                        className="w-[120px] h-[160px] rounded-lg overflow-hidden border border-white/15 bg-white shadow-sm hover:border-[#FF9F0F]/25 transition relative group"
                        title="PDF (User)"
                      >
                        <PdfThumbnail src={assets.pdfUrl} width={120} height={160} className="w-full h-full" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] px-1 py-0.5 text-white/90">User PDF</div>
                      </button>
                    ) : assets?.loading ? (
                      <div className="w-[120px] h-[160px] rounded-lg border border-white/15 bg-[#2A1F18] flex items-center justify-center">
                        <span className="text-[9px] text-white/50">Lädt...</span>
                      </div>
                    ) : (
                      <div className="w-[120px] h-[160px] rounded-lg border border-white/15 bg-[#2A1F18] flex items-center justify-center">
                        <span className="text-[9px] text-white/50">Kein PDF</span>
                      </div>
                    )}
                    {assets?.adminPdfUrl ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setLightbox({ kind: 'pdf', url: assets.adminPdfUrl! })
                        }}
                        className="w-[120px] h-[160px] rounded-lg overflow-hidden border border-caramel/50 hover:border-caramel/80 transition relative group bg-white shadow-sm"
                        title="Admin PDF (Raw Data)"
                      >
                        <PdfThumbnail src={assets.adminPdfUrl} width={120} height={160} className="w-full h-full" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                        <div className="absolute bottom-0 left-0 right-0 bg-caramel/90 text-[8px] px-1 py-0.5 text-white font-semibold">Admin PDF</div>
                      </button>
                    ) : null}
                    {assets?.calculationMethodPdfUrl ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setLightbox({ kind: 'pdf', url: assets.calculationMethodPdfUrl! })
                        }}
                        className="w-[120px] h-[160px] rounded-lg overflow-hidden border border-coffee-500/50 hover:border-coffee-500/80 transition relative group bg-white shadow-sm"
                        title="Calculation Method PDF (English)"
                      >
                        <PdfThumbnail src={assets.calculationMethodPdfUrl} width={120} height={160} className="w-full h-full" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                        <div className="absolute bottom-0 left-0 right-0 bg-coffee-600/90 text-[8px] px-1 py-0.5 text-white font-semibold">Calc Method</div>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
          </div>
        </div>
      </main>

      {/* Right: live feed stays the same in dashboard/page.tsx */}

      {/* Processing Images Modal */}
      {processingModal ? (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setProcessingModal(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[90vh] bg-[#352A22]/95 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/15 shadow-soft flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 px-4 flex items-center justify-between bg-[#2A1F18]/60 border-b border-white/15 shrink-0">
              <div className="text-sm font-semibold text-white/85">Verarbeitungsdetails</div>
              <button
                className="text-white/80 text-lg px-3 py-1 rounded hover:bg-white/10"
                onClick={() => setProcessingModal(null)}
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6 processing-modal-scroll">
              {processingImages[processingModal] ? (
                Object.entries(processingImages[processingModal]).map(([kind, images]) => {
                  if (!images || images.length === 0) return null
                  const kindLabels: Record<string, string> = {
                    cubicasa_step: 'CubiCasa Schritte',
                    cluster: 'Cluster',
                    cluster_preview: 'Cluster Vorschau',
                    visualization: 'Visualisierungen',
                  }
                  return (
                    <div key={kind} className="space-y-2">
                      <div className="text-xs font-semibold text-white/80 uppercase tracking-wide">
                        {kindLabels[kind] || kind}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {images.map((img) => (
                          <div
                            key={img.id}
                            className="relative rounded-lg overflow-hidden border border-white/15 bg-[#2A1F18] hover:border-[#FF9F0F]/25 transition"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt={img.filename}
                              className="w-full h-auto object-contain bg-white/5"
                              loading="lazy"
                            />
                            {img.plan_id ? (
                              <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] bg-black/60 text-white/80">
                                {img.plan_id}
                              </div>
                            ) : null}
                            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-[9px] text-white/70 truncate">
                              {img.filename}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-sm text-white/60 text-center py-8">Lädt...</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Lightbox */}
      {lightbox ? (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="w-full max-w-6xl h-[85vh] bg-black/20 rounded-2xl overflow-hidden border border-white/10 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-10 px-3 flex items-center justify-between bg-black/30 border-b border-white/10">
              <div className="text-xs text-white/80 uppercase tracking-wide">{lightbox.kind}</div>
              <button
                className="text-white/80 text-sm px-2 py-1 rounded hover:bg-white/10"
                onClick={() => setLightbox(null)}
              >
                Close
              </button>
            </div>
            <div className="w-full h-[calc(85vh-2.5rem)] bg-black/10">
              {lightbox.kind === 'plan' && !String(lightbox.mime || '').includes('pdf') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lightbox.url} alt="Plan" className="w-full h-full object-contain bg-black/10" />
              ) : (
                <div className="w-full h-full bg-black/5">
                  <SimplePdfViewer src={lightbox.url} maxHeight="calc(85vh - 2.5rem)" className="w-full h-full" />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .processing-modal-scroll {
          scrollbar-width: thin;
          scrollbar-color: #FF9F0F #2A1B15;
        }
        .processing-modal-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .processing-modal-scroll::-webkit-scrollbar-track {
          background: #2A1B15;
          border-radius: 8px;
        }
        .processing-modal-scroll::-webkit-scrollbar-thumb {
          background: #FF9F0F;
          border-radius: 8px;
          border: 2px solid #2A1B15;
        }
        .processing-modal-scroll::-webkit-scrollbar-thumb:hover {
          background: #FFB84D;
        }
      `}</style>
    </>
  )
}


