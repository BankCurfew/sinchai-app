import { useState } from 'react'
import { format, startOfMonth } from 'date-fns'

export interface TimeRange {
  label: string
  months: number
  startDate?: string
  endDate?: string
}

const presets: { label: string; months: number }[] = [
  { label: '6 เดือน', months: 6 },
  { label: '12 เดือน', months: 12 },
]

interface Props {
  onChange: (range: TimeRange) => void
}

export default function TimeRangeSelector({ onChange }: Props) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset')
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customEnd, setCustomEnd] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))

  const handlePreset = (idx: number) => {
    setSelectedPreset(idx)
    setMode('preset')
    onChange({ label: presets[idx].label, months: presets[idx].months })
  }

  const handleCustom = () => {
    setMode('custom')
    onChange({
      label: 'กำหนดเอง',
      months: 0,
      startDate: customStart,
      endDate: customEnd,
    })
  }

  const handleCustomChange = (start: string, end: string) => {
    setCustomStart(start)
    setCustomEnd(end)
    onChange({
      label: 'กำหนดเอง',
      months: 0,
      startDate: start,
      endDate: end,
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-gray-600">ช่วงเวลา:</span>
      {presets.map((p, idx) => (
        <button
          key={p.label}
          onClick={() => handlePreset(idx)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            mode === 'preset' && selectedPreset === idx
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={handleCustom}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          mode === 'custom'
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        กำหนดเอง
      </button>
      {mode === 'custom' && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="month"
            value={customStart.substring(0, 7)}
            onChange={e => handleCustomChange(e.target.value + '-01', customEnd)}
            className="border rounded-lg px-2 py-1.5 text-sm"
          />
          <span className="text-gray-400">ถึง</span>
          <input
            type="month"
            value={customEnd.substring(0, 7)}
            onChange={e => handleCustomChange(customStart, e.target.value + '-01')}
            className="border rounded-lg px-2 py-1.5 text-sm"
          />
        </div>
      )}
    </div>
  )
}
