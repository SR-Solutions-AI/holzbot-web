import { supabase } from '@/app/lib/supabaseClient'
import { NextResponse } from 'next/server'

export async function POST() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ title: 'Ofertă nouă' })
    })
    const json = await res.json()
    return NextResponse.json(json, { status: res.status })
}