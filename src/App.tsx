import { useState, useCallback } from 'react'
import type { Tab } from './types'
import Sidebar from './components/shared/Sidebar'
import Dashboard from './components/Dashboard'
import CashFlowPage from './components/CashFlowPage'
import LoansPage from './components/LoansPage'
import ReceivablesPage from './components/ReceivablesPage'
import InventoryPage from './components/InventoryPage'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [exportTrigger, setExportTrigger] = useState(0)

  const handleExport = useCallback(() => {
    setExportTrigger(prev => prev + 1)
  }, [])

  return (
    <div className="min-h-screen bg-slate-900">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onExport={handleExport} />

      {/* Main content area */}
      <main className="md:ml-60 min-h-screen pb-20 md:pb-0">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6">
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
