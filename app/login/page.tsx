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
  if (m.includes('network')) return 'Netzwerkfehler. Bitte erneut versuchen.'
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else router.push('/')
  }

  const errorDe = toGermanError(error || undefined)

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-transparent">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-panel rounded-xl2 p-8 border border-white/10 shadow-soft text-sand flex flex-col gap-4"
      >
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-sun)] text-center">
          {DE.title}
        </h1>

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

        <button type="submit" className="btn-primary w-full">
          {DE.submit}
        </button>
      </form>
    </div>
  )
}
