import DashboardHeader from './DashboardHeader'
import DashboardFooter from './DashboardFooter'

/* ================= DASHBOARD LAYOUT ================= */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen min-h-screen bg-transparent overflow-hidden">
      
      {/* === HEADER === */}
      <DashboardHeader />

      {/* === MAIN CONTENT (GRID) === */}
      <div className="flex-1 min-h-0 p-4 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr_440px] gap-4 h-full min-h-0">
            {children}
        </div>
      </div>

      {/* === FOOTER === */}
      <DashboardFooter />
      
    </div>
  )
}