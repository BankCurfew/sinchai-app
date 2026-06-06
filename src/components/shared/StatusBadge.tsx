interface Props {
  variant: 'success' | 'danger' | 'warning' | 'info'
  children: React.ReactNode
}

const styles: Record<string, string> = {
  success: 'bg-emerald-500/15 text-emerald-400',
  danger: 'bg-rose-500/15 text-rose-400',
  warning: 'bg-amber-500/15 text-amber-400',
  info: 'bg-sky-500/15 text-sky-400',
}

export default function StatusBadge({ variant, children }: Props) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.65rem] font-semibold ${styles[variant]}`}>
      {children}
    </span>
  )
}
