import { useState } from 'react'
import type { Tab } from './types'
import Dashboard from './components/Dashboard'
import CashFlowPage from './components/CashFlowPage'
import LoansPage from './components/LoansPage'
import ReceivablesPage from './components/ReceivablesPage'
import InventoryPage from './components/InventoryPage'

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'cashflow', label: 'Cash Flow', icon: '💰' },
  { key: 'loans', label: 'เงินกู้', icon: '🏦' },
  { key: 'receivables', label: 'ลูกหนี้', icon: '📋' },
  { key: 'inventory', label: 'สต๊อก', icon: '📦' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">สินชัย — Cash Flow & Financial Planning</h1>
          <p className="text-indigo-200 text-sm mt-1">ระบบบริหารการเงินและวางแผนกระแสเงินสด</p>
        </div>
      </header>

      <nav className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'cashflow' && <CashFlowPage />}
        {activeTab === 'loans' && <LoansPage />}
        {activeTab === 'receivables' && <ReceivablesPage />}
        {activeTab === 'inventory' && <InventoryPage />}
      </main>
    </div>
  )
}
