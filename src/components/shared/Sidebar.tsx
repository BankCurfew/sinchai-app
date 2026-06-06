import type { Tab } from '../../types'

const navItems: { key: Tab; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'แดชบอร์ด', icon: '📊' },
  { key: 'cashflow', label: 'กระแสเงินสด', icon: '💰' },
  { key: 'loans', label: 'เงินกู้', icon: '🏦' },
  { key: 'receivables', label: 'ลูกหนี้', icon: '📋' },
  { key: 'inventory', label: 'สต๊อกสินค้า', icon: '📦' },
]

interface Props {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  onExport?: () => void
}

export default function Sidebar({ activeTab, onTabChange, onExport }: Props) {
  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex fixed top-0 left-0 bottom-0 w-60 bg-slate-950 border-r border-slate-700 flex-col z-50">
        <div className="px-5 py-6 border-b border-slate-700/50">
          <h1 className="text-xl font-bold text-white tracking-tight">สินชัย</h1>
          <p className="text-[0.7rem] text-slate-500 mt-1">ระบบบริหารกระแสเงินสด</p>
        </div>

        <div className="flex-1 p-2 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onTabChange(item.key)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.key
                  ? 'bg-sky-500/15 text-sky-400'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
              }`}
            >
              <span className="text-lg w-6 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}

          <div className="h-px bg-slate-700/50 mx-3.5 my-2" />

          <button className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-all">
            <span className="text-lg w-6 text-center">⚙️</span>
            <span>ตั้งค่า</span>
          </button>
        </div>

        {onExport && (
          <div className="p-4 border-t border-slate-700/50">
            <button
              onClick={onExport}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
            >
              <span>⬇️</span> ดาวน์โหลด Excel
            </button>
          </div>
        )}
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-700 z-50 flex">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onTabChange(item.key)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors ${
              activeTab === item.key ? 'text-sky-400' : 'text-slate-500'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-[0.6rem]">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
