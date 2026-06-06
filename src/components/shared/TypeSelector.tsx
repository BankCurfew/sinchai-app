interface Option {
  value: string
  label: string
  activeClass: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options?: Option[]
}

const defaultOptions: Option[] = [
  { value: 'bf', label: 'ยกมา', activeClass: 'bg-sky-500/20 text-sky-400 border-2 border-sky-500/50' },
  { value: 'in', label: 'เงินเข้า', activeClass: 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50' },
  { value: 'out', label: 'เงินออก', activeClass: 'bg-rose-500/20 text-rose-400 border-2 border-rose-500/50' },
]

export default function TypeSelector({ value, onChange, options = defaultOptions }: Props) {
  return (
    <div className="flex gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            value === opt.value
              ? opt.activeClass
              : 'bg-slate-700 text-slate-400 border-2 border-transparent hover:border-slate-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export const cashFlowOptions: Option[] = [
  { value: 'bf', label: 'ยกมา', activeClass: 'bg-sky-500/20 text-sky-400 border-2 border-sky-500/50' },
  { value: 'in', label: 'เงินเข้า', activeClass: 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50' },
  { value: 'out', label: 'เงินออก', activeClass: 'bg-rose-500/20 text-rose-400 border-2 border-rose-500/50' },
]

export const inventoryOptions: Option[] = [
  { value: 'bf', label: 'ยกมา', activeClass: 'bg-sky-500/20 text-sky-400 border-2 border-sky-500/50' },
  { value: 'in', label: 'สั่งเข้า', activeClass: 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50' },
  { value: 'out', label: 'ขายออก', activeClass: 'bg-rose-500/20 text-rose-400 border-2 border-rose-500/50' },
]
