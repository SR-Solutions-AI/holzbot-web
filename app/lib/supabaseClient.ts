'use client'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Debug: verificăm dacă variabilele de mediu sunt setate
if (typeof window !== 'undefined') {
  if (!url || !anon) {
    console.error('❌ [SUPABASE] Variabilele de mediu lipsesc!', {
      hasUrl: !!url,
      hasAnon: !!anon,
    })
  } else {
    console.log('✅ [SUPABASE] Configurație OK', {
      url: url.substring(0, 30) + '...',
      hasAnon: !!anon,
    })
  }
}

export const supabase = createClient(url, anon)

export async function apiFetch(path: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    
    // MODIFICARE CRITICĂ: Adăugăm fallback la http://localhost:4000
    // Dacă variabila din .env nu merge, va folosi valoarea din dreapta
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers as Record<string, string> || {})
    }

    // Mică curățenie ca să nu avem dublu slash (//)
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    
    // Adăugăm prefixul /api dacă base URL-ul este https://api.holzbot.com (pentru VPS)
    // și path-ul nu începe deja cu /api
    const needsApiPrefix = cleanBase.includes('api.holzbot.com') && !cleanPath.startsWith('/api')
    const finalPath = needsApiPrefix ? `/api${cleanPath}` : cleanPath

    // Add timeout for requests (30 seconds max)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout
    
    try {
      const res = await fetch(`${cleanBase}${finalPath}`, { 
        ...options, 
        headers,
        signal: controller.signal 
      })
      clearTimeout(timeoutId)
      
      if (!res.ok) {
        // 404 on export-url is a normal state: PDF not generated yet.
        // Avoid noisy console errors and let callers treat it as "no pdf".
        if (res.status === 404 && /\/offers\/[^/]+\/export-url$/.test(cleanPath)) {
            return { url: null }
        }

        // Încercăm să vedem și mesajul de eroare din spate
        const errorText = await res.text().catch(() => res.statusText)
        console.error(`API Fetch Error [${res.status}] la ${cleanBase}${cleanPath}:`, errorText)
        throw new Error(`${res.status} ${res.statusText}`)
      }
      
      return res.json()
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        console.error(`API Fetch Timeout (>30s) la ${cleanBase}${finalPath}`)
        throw new Error('Request timeout - server took too long to respond')
      }
      throw error
    }
}