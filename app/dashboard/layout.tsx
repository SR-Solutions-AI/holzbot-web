import DashboardHeader from './DashboardHeader'
import DashboardFooter from './DashboardFooter'
import DashboardContentTransition from './DashboardContentTransition'
import DashboardScaleWrapper from './DashboardScaleWrapper'
import SiteBanner from './SiteBanner'

/* ================= DASHBOARD LAYOUT ================= */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardScaleWrapper>
      <div className="flex flex-col h-screen min-h-screen bg-transparent overflow-hidden">
        
        {/* === HEADER === */}
        <DashboardHeader />

        {/* === SITE BANNER (admin-controlled) === */}
        <SiteBanner />

        {/* === MAIN CONTENT (GRID) — page-enter on route change === */}
        <div className="flex-1 min-h-0 p-4 w-full overflow-hidden">
          <DashboardContentTransition>{children}</DashboardContentTransition>
        </div>

        {/* === FOOTER === */}
        <DashboardFooter />
        
      </div>
    </DashboardScaleWrapper>
  )
}