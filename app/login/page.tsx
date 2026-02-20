'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'

const DE = {
  title: 'Anmeldung',
  email: 'E-Mail',
  password: 'Passwort',
  submit: 'Anmelden',
  genericError: 'Anmeldung fehlgeschlagen.',
}

function toGermanError(msg: string | null | undefined): string {
  if (!msg) return DE.genericError
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid email or password'))
    return 'Ungültige Zugangsdaten.'
  if (m.includes('user not found')) return 'Benutzer nicht gefunden.'
  if (m.includes('wrong password')) return 'Falsches Passwort.'
  if (m.includes('too many') || m.includes('rate limit'))
    return 'Zu viele Versuche. Bitte später erneut versuchen.'
  if (m.includes('network') || m.includes('failed to fetch') || m.includes('cors') || m.includes('522'))
    return 'Verbindung zu Supabase fehlgeschlagen (Netzwerk/Timeout). Prüfen: Internet, Supabase-Projekt aktiv, und unter Supabase → Authentication → URL Configuration „http://localhost:3000“ bei Redirect URLs eintragen.'
  return DE.genericError
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    
    console.log('🔐 [LOGIN] Încercare autentificare pentru:', email)
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) {
      console.error('❌ [LOGIN] Eroare autentificare:', error)
      setError(error.message)
    } else {
      console.log('✅ [LOGIN] Autentificare reușită!', { userId: data.user?.id })
      router.push('/')
    }
  }

  const errorDe = toGermanError(error || undefined)

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-transparent px-4">
      <div className="absolute inset-0 pointer-events-none opacity-35"
        style={{
          background:
            'radial-gradient(55% 70% at 20% 20%, rgba(216,162,94,.25), transparent 60%), radial-gradient(45% 65% at 80% 25%, rgba(234,161,58,.18), transparent 60%)',
        }}
      />

      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-sm bg-panel rounded-xl2 p-8 border border-white/10 shadow-soft text-sand flex flex-col gap-4 overflow-hidden"
      >
        <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[#FF9F0F]/10 blur-[60px] pointer-events-none" />

        <div className="flex flex-col items-center gap-3 mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Holzbot" className="h-10 w-auto object-contain opacity-95" />
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-sun)] text-center">
            {DE.title}
          </h1>
          <div className="text-xs text-sand/65 text-center">
            Bitte melden Sie sich an, um fortzufahren.
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-sand/90">{DE.email}</span>
          <input
            className="input w-full"
            placeholder={DE.email}
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-sand/90">{DE.password}</span>
          <input
            className="input w-full"
            placeholder={DE.password}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p className="text-sm rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300 text-center">
            {errorDe}
          </p>
        )}

        <button type="submit" className="btn-accent w-full">
          {DE.submit}
        </button>
      </form>
    </div>
  )
}
