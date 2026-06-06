import { useState } from 'react'
import { format, startOfMonth } from 'date-fns'

export interface TimeRange {
  label: string
  months: number
  startDate?: string
  endDate?: string
}

interface Props {
  onChange: (range: TimeRange) => void
}

export default function TimeRangeSelector({ onChange }: Props) {
  const [mode, setMode] = useState<'6m' | '12m' | 'custom'>('6m')
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM'))
  const [customEnd, setCustomEnd] = useState(format(startOfMonth(new Date()), 'yyyy-MM'))

  const handlePreset = (m: '6m' | '12m') => {
    setMode(m)
    const months = m === '6m' ? 6 : 12
    onChange({ label: m === '6m' ? '6 เดือน' : 'ทั้งปี', months })
  }

  const handleCustom = () => {
    setMode('custom')
    onChange({ label: 'กำหนดเอง', months: 0, startDate: customStart + '-01', endDate: customEnd + '-01' })
  }

  const handleCustomChange = (start: string, end: string) => {
    setCustomStart(start)
    setCustomEnd(end)
    onChange({ label: 'กำหนดเอง', months: 0, startDate: start + '-01', endDate: end + '-01' })
  }

  const btnClass = (active: boolean) =>
    `px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
      active
        ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
        : 'text-slate-400 hover:text-slate-200'
    }`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-0.5">
        <button onClick={() => handlePreset('6m')} className={btnClass(mode === '6m')}>6 เดือน</button>
        <button onClick={() => handlePreset('12m')} className={btnClass(mode === '12m')}>ทั้งปี</button>
        <button onClick={handleCustom} className={btnClass(mode === 'custom')}>กำหนดเอง</button>
      </div>
      {mode === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={customStart}
            onChange={e => handleCustomChange(e.target.value, customEnd)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
          />
          <span className="text-slate-500 text-xs">ถึง</span>
          <input
            type="month"
            value={customEnd}
            onChange={e => handleCustomChange(customStart, e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
          />
        </div>
      )}
    </div>
  )
}
