import { apiFetch } from './supabaseClient'

export type AdminTenant = {
  id: string
  slug: string
  name: string
  /** Signed or public URL for tenant-uploaded logo (Angebotsanpassung). */
  logo_url: string | null
}

/** Read-only: all organisations for admin client list / filters. */
export async function fetchAdminTenants(): Promise<{ items: AdminTenant[] }> {
  return apiFetch('/admin/tenants')
}

export type AdminTenantOfferStatusUi = 'Running' | 'Queued' | 'Completed' | 'Failed' | 'Cancelled'

export type AdminTenantOfferMetaKind = {
  roof_only_offer?: true
  measurements_only_offer?: true
  wizard_package?: string | null
}

/** One offer row for admin “Client workspace → Projects”, scoped by tenant. */
export type AdminTenantOffer = {
  id: string
  ref: string
  /** Raw DB title (often „Ofertă nouă” until the wizard saves). */
  title: string
  /** Label aligned with dashboard history: offer_no when finished, else referință, else title. */
  display_title: string
  status: string
  status_ui: AdminTenantOfferStatusUi
  created_at: string
  updated_at: string
  offer_type_slug: string | null
  owner_name: string | null
  owner_id: string | null
  pipeline_finished_at: string | null
  /** Wall time from offer creation to latest finished calc run (done/failed/cancelled). */
  duration_wall_seconds: number | null
  /** Duration of the most recent calc run (created_at → finished_at). */
  last_run_duration_seconds: number | null
  /** Subset of offer meta for admin card offer-kind label. */
  meta_for_kind?: AdminTenantOfferMetaKind
}

export async function fetchAdminTenantOffers(
  tenantId: string,
  opts?: { limit?: number },
): Promise<{ items: AdminTenantOffer[] }> {
  const q = opts?.limit != null ? `?limit=${encodeURIComponent(String(opts.limit))}` : ''
  return apiFetch(`/admin/tenants/${encodeURIComponent(tenantId)}/offers${q}`)
}

export type AdminTenantWorkspaceProfile = {
  id: string
  email: string | null
  role: string | null
  full_name: string | null
  created_at: string | null
  tokens_unlimited: boolean
}

export type AdminTenantWorkspace = {
  tenant: { id: string; slug: string; name: string }
  branding: { phone: string; email: string; address: string; website: string }
  tokens: {
    used: number
    limit: number | null
    remaining: number | null
    unlimited: boolean
    period_ym: string
    tier: number
    tier_label: string
    display: string
  }
  profiles: AdminTenantWorkspaceProfile[]
  stats: { offer_count: number }
}

export async function fetchAdminTenantWorkspace(tenantId: string): Promise<AdminTenantWorkspace> {
  return apiFetch(`/admin/tenants/${encodeURIComponent(tenantId)}/workspace`)
}

export type AdminStatisticsThroughputPoint = {
  label: string
  offers: number
  avg_wall_seconds: number | null
  avg_time_label: string
}

export type AdminStatisticsSummary = {
  refreshed_at: string
  period: { from: string; to: string }
  previous_period: { from: string; to: string }
  tenant_ids: string[]
  totals: {
    offers_current: number
    offers_previous: number
    mean_wall_seconds_current: number | null
    mean_wall_seconds_previous: number | null
    profiles_acquired_current: number
    profiles_acquired_previous: number
    profiles_churn_current: number
    profiles_churn_previous: number
    incidents_current: number
    incidents_previous: number
  }
  throughput: AdminStatisticsThroughputPoint[]
  kpi_series: {
    offers: number[]
    avg_wall_seconds: number[]
    clients_net: number[]
    incidents: number[]
  }
}

export async function fetchAdminStatisticsSummary(params: {
  from: string
  to: string
  tenantIds?: string[]
}): Promise<AdminStatisticsSummary> {
  const q = new URLSearchParams()
  q.set('from', params.from)
  q.set('to', params.to)
  if (params.tenantIds?.length) q.set('tenant_ids', params.tenantIds.join(','))
  return apiFetch(`/admin/statistics/summary?${q.toString()}`)
}
