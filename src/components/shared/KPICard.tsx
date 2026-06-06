interface Props {
  label: string
  value: string
  trend?: string
  trendDirection?: 'up' | 'down'
  variant: 'income' | 'expense' | 'debt' | 'stock' | 'balance'
  valueColor?: string
}

const variantStyles: Record<string, string> = {
  income: 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/[0.03] border-emerald-500/30',
  expense: 'bg-gradient-to-br from-rose-500/15 to-rose-500/[0.03] border-rose-500/30',
  debt: 'bg-gradient-to-br from-amber-500/15 to-amber-500/[0.03] border-amber-500/30',
  stock: 'bg-gradient-to-br from-violet-500/15 to-violet-500/[0.03] border-violet-500/30',
  balance: 'bg-gradient-to-br from-sky-500/15 to-sky-500/[0.03] border-sky-500/30',
}

const valueColors: Record<string, string> = {
  income: 'text-emerald-400',
  expense: 'text-rose-400',
  debt: 'text-amber-400',
  stock: 'text-violet-400',
  balance: 'text-sky-400',
}

export default function KPICard({ label, value, trend, trendDirection, variant, valueColor }: Props) {
  return (
    <div className={`rounded-xl p-5 border transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 ${variantStyles[variant]}`}>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className={`text-[1.75rem] font-bold font-mono tracking-tight my-1 ${valueColor || valueColors[variant]}`}>
        {value}
      </p>
      {trend && (
        <p className={`text-[0.7rem] font-medium ${trendDirection === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
          {trendDirection === 'up' ? '▲' : '▼'} {trend}
        </p>
      )}
    </div>
  )
}
