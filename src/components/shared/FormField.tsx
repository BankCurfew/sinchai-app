import type { ReactNode } from 'react'

interface Props {
  label: string
  children: ReactNode
  half?: boolean
}

export default function FormField({ label, children }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export const inputClass = 'w-full px-3.5 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm font-[inherit] transition-colors focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 placeholder:text-slate-500'

export const selectClass = 'w-full px-3.5 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm font-[inherit] cursor-pointer focus:outline-none focus:border-sky-500'
