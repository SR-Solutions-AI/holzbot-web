'use client'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, anon)

export async function apiFetch(path: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const base = process.env.NEXT_PUBLIC_API_URL!

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers as Record<string, string> || {})
    }

    const res = await fetch(`${base}${path}`, { ...options, headers })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
}
