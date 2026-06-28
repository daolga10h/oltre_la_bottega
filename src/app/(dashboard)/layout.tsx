import { Sidebar } from "@/components/nav/Sidebar"
import { BottomNav } from "@/components/nav/BottomNav"
import { SearchBar } from "@/components/SearchBar"
import { RefreshButton } from "@/components/RefreshButton"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b px-4 md:px-8 py-3 flex items-center gap-2">
          <SearchBar />
          <RefreshButton />
        </header>
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  )
}
