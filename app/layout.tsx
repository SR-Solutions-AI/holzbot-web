// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Caveat } from 'next/font/google'

export const metadata: Metadata = {
  title: 'Holzbot',
  description: 'Offers UI',
}

const hand = Caveat({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body className="min-h-screen">
        {/* Header = 4.5rem (h-18) */}
        <header className="h-18 flex items-center justify-center px-5 bg-coffee-850 border-b border-black/50 shadow-soft relative">
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{ background: 'radial-gradient(40% 100% at 0% 0%, rgba(216,162,94,.35), transparent 60%)' }}
          />
          <div className="flex items-center gap-3 relative">
            <img src="/identity.png" alt="logo" className="h-10 w-auto rounded-md" />
            <div className={`text-4xl font-normal tracking-tight ${hand.className}`}>Holzbot</div>
          </div>
        </header>

        {/* Canvas: ocupă TOT viewport-ul rămas. p-4 = 1rem sus/jos, ținem cont în calc */}
        <div className="p-4">
          <div className="grid grid-cols-[400px_1fr_440px] gap-4 h-[calc(100vh-4.5rem-2rem)] min-h-0">
            {/* h = 100vh - header(4.5rem) - padding vertical total(2rem) */}
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}
