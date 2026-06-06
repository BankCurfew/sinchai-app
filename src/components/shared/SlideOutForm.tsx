import { useEffect, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  onSubmit: (e: React.FormEvent) => void
  submitLabel?: string
  children: ReactNode
}

export default function SlideOutForm({ open, onClose, title, onSubmit, submitLabel = 'บันทึกรายการ', children }: Props) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-[420px] bg-slate-800 border-l border-slate-700 z-[101] flex flex-col shadow-[-8px_0_32px_rgba(0,0,0,0.4)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-slate-700 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {children}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-700">
            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-all hover:shadow-lg hover:shadow-sky-500/30"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
