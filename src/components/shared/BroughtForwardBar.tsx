interface BFItem {
  label: string
  value: string
  color?: 'positive' | 'negative' | 'default'
}

interface Props {
  date: string
  items: BFItem[]
  onEdit?: () => void
}

const colorMap = {
  positive: 'text-emerald-400',
  negative: 'text-rose-400',
  default: 'text-white',
}

export default function BroughtForwardBar({ date, items, onEdit }: Props) {
  return (
    <div className="bg-slate-800 border border-slate-700 border-l-4 border-l-sky-400 rounded-xl px-4 md:px-5 py-3 md:py-4 mb-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-8">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 whitespace-nowrap">
        📌 ยอดยกมา (ณ {date})
        {onEdit && (
          <button onClick={onEdit} className="ml-2 text-xs text-slate-500 hover:text-sky-400 underline">แก้ไข</button>
        )}
      </div>
      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 md:gap-8 flex-1">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col">
            <span className="text-xs text-slate-400">{item.label}</span>
            <span className={`text-[0.95rem] font-semibold font-mono ${colorMap[item.color || 'default']}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
