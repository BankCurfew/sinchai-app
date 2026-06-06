import { useState, useCallback, useEffect } from 'react'
import type { Tab } from './types'
import { supabase } from './lib/supabase'
import Sidebar from './components/shared/Sidebar'
import Dashboard from './components/Dashboard'
import CashFlowPage from './components/CashFlowPage'
import LoansPage from './components/LoansPage'
import ReceivablesPage from './components/ReceivablesPage'
import InventoryPage from './components/InventoryPage'
import LoginPage from './components/LoginPage'
import MobileCompanyBar from './components/shared/MobileCompanyBar'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [exportTrigger, setExportTrigger] = useState(0)
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleExport = useCallback(() => {
    setExportTrigger(prev => prev + 1)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setAuthed(false)
  }

  // Loading auth check
  if (authed === null) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-500">กำลังตรวจสอบ...</div>
  }

  // Not authenticated
  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onExport={handleExport} onLogout={handleLogout} />

      <main className="md:ml-60 min-h-screen pb-20 md:pb-0">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6">
          <MobileCompanyBar />
          {activeTab === 'dashboard' && <Dashboard exportTrigger={exportTrigger} />}
          {activeTab === 'cashflow' && <CashFlowPage />}
          {activeTab === 'loans' && <LoansPage />}
          {activeTab === 'receivables' && <ReceivablesPage />}
          {activeTab === 'inventory' && <InventoryPage />}
        </div>
      </main>
    </div>
  )
}
