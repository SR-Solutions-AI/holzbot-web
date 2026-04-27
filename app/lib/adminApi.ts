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
    bonus?: number
    unlimited: boolean
    period_ym: string
    tier: number
    tier_label: string
    display: string
  }
  profiles: AdminTenantWorkspaceProfile[]
  stats: { offer_count: number }
  permissions?: {
    usage_tier: number
    allowed_offer_types: string[]
  }
}

export async function fetchAdminTenantWorkspace(tenantId: string): Promise<AdminTenantWorkspace> {
  return apiFetch(`/admin/tenants/${encodeURIComponent(tenantId)}/workspace`)
}

export type AdminStatisticsThroughputPoint = {
  label: string
  offers: number
  avg_wall_seconds: number | null
  avg_time_label: string
  incidents: number
  avg_cost_cents: number | null
}

export type AdminStatisticsIncident = {
  run_id: string | null
  offer_id: string | null
  tenant_id: string | null
  stage: string
  severity: 'low' | 'medium' | 'high'
  message: string
  started_at: string | null
  finished_at: string | null
  type: 'failed_run' | 'stuck_run' | 'error_event'
  fingerprint?: string
}

export type AdminPipelineStageSummary = {
  key: string
  label: string
  processed: number
  failed: number
  avg_time_seconds: number | null
  success_rate_pct: number
  trend_pct: number | null
}

export type AdminDataMoatSummaryRow = {
  key: 'plan_segmentation' | 'wall_detection' | 'rooms_detection' | 'doors' | 'windows' | 'roof'
  label: string
  marked_plans: number
  artifacts: number
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
    organizations_current: number
    organizations_all_time: number
    organizations_churn_current: number
    organizations_churn_previous: number
  }
  throughput: AdminStatisticsThroughputPoint[]
  kpi_series: {
    offers: number[]
    avg_wall_seconds: number[]
    clients_net: number[]
    incidents: number[]
  }
  incidents: {
    total: number
    high: number
    medium: number
    low: number
    items: AdminStatisticsIncident[]
  }
  pipeline_stages: AdminPipelineStageSummary[]
  data_moat: AdminDataMoatSummaryRow[]
  cost: {
    runs_count: number
    total_cost_cents: number
    avg_cost_per_run_cents: number | null
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

export async function resolveAdminIncident(fingerprint: string): Promise<{ ok: boolean }> {
  return apiFetch('/admin/incidents/resolve', {
    method: 'POST',
    body: JSON.stringify({ fingerprint }),
  })
}

export async function closeAdminRun(runId: string): Promise<{ ok: boolean; alreadyClosed?: boolean }> {
  return apiFetch(`/admin/runs/${encodeURIComponent(runId)}/close`, {
    method: 'POST',
  })
}

export async function updateAdminTenantWorkspace(
  tenantId: string,
  payload: {
    branding?: { phone?: string; email?: string; address?: string; website?: string }
    usageTier?: number
    addTokens?: number
    allowedOfferTypes?: Array<'mengenermittlung' | 'dachstuhl' | 'zubau_aufstockung' | 'aufstockung' | 'zubau' | 'einfamilienhaus' | 'neubau'>
    members?: Array<{ id: string; full_name?: string; role?: 'admin' | 'org_leader' | 'user' }>
  },
): Promise<{ ok: boolean }> {
  return apiFetch(`/admin/tenants/${encodeURIComponent(tenantId)}/workspace`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
