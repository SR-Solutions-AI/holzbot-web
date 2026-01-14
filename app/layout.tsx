// app/layout.tsx (Versiune Minimală FĂRĂ Header)
import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Holzbot',
  description: 'Offers UI',
}

// ATENȚIE: Nu mai importăm Header.tsx, Link sau Supabase aici.

export default function RootLayout({ children }: { children: React.ReactNode }) {
    
    return (
        <html lang="ro"> 
            {/* body: Full width, Full height */}
            <body className="min-h-screen">
                
                {/* NOU: Nu există Header aici. */}
                
                {/* Canvas: wrapper Full Width / Full Height */}
                {/* p-4 era padding-ul header-ului, îl mutăm pe page.tsx */}
                <div className="w-full h-full min-h-screen">
                    {children}
                </div>
            </body>
        </html>
    )
}