import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../lib/company'
import type { CashFlow, Loan, Receivable } from '../types'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, getDay, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'

interface DayData {
  date: string
  cashIn: number
  cashOut: number
  loanDue: number
  receivableDue: number
  net: number
  items: { type: 'in' | 'out' | 'loan' | 'receivable'; amount: number; desc: string }[]
}

export default function CalendarView() {
  const { selectedId } = useCompany()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [cashFlow, setCashFlow] = useState<CashFlow[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: th })

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const from = format(monthStart, 'yyyy-MM-dd')
      const to = format(monthEnd, 'yyyy-MM-dd')

      let qCf = supabase.from('sinchai_cash_flow').select('*').gte('date', from).lte('date', to)
      let qLn = supabase.from('sinchai_loans').select('*').gte('due_date', from).lte('due_date', to)
      let qRc = supabase.from('sinchai_receivables').select('*').gte('due_date', from).lte('due_date', to)
      if (selectedId) { qCf = qCf.eq('company_id', selectedId); qLn = qLn.eq('company_id', selectedId); qRc = qRc.eq('company_id', selectedId) }

      const [cf, ln, rc] = await Promise.all([qCf, qLn, qRc])
      setCashFlow(cf.data || [])
      setLoans(ln.data || [])
      setReceivables(rc.data || [])
      setLoading(false)
    }
    fetchData()
  }, [currentMonth, selectedId])

  const dayDataMap = useMemo(() => {
    const map: Record<string, DayData> = {}
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    for (const day of days) {
      const ds = format(day, 'yyyy-MM-dd')
      map[ds] = { date: ds, cashIn: 0, cashOut: 0, loanDue: 0, receivableDue: 0, net: 0, items: [] }
    }

    for (const cf of cashFlow) {
      const d = map[cf.date]
      if (!d) continue
      const amt = Number(cf.amount)
      if (cf.type === 'in' || cf.type === 'bf') {
        d.cashIn += amt
        d.items.push({ type: 'in', amount: amt, desc: cf.description || cf.category })
      } else {
        d.cashOut += amt
        d.items.push({ type: 'out', amount: amt, desc: cf.description || cf.category })
      }
    }

    for (const ln of loans) {
      const d = map[ln.due_date]
      if (!d || ln.status === 'paid') continue
      const amt = Number(ln.principal) + Number(ln.interest)
      d.loanDue += amt
      d.cashOut += amt
      d.items.push({ type: 'loan', amount: amt, desc: ln.description || ln.loan_type || 'ผ่อนชำระ' })
    }

    for (const rc of receivables) {
      const d = map[rc.due_date]
      if (!d || rc.status === 'received') continue
      const amt = Number(rc.amount)
      d.receivableDue += amt
      d.cashIn += amt
      d.items.push({ type: 'receivable', amount: amt, desc: rc.debtor_name })
    }

    for (const d of Object.values(map)) {
      d.net = d.cashIn - d.cashOut
    }

    return map
  }, [cashFlow, loans, receivables, monthStart, monthEnd])

  // Running balance
  const runningBalance = useMemo(() => {
    let bal = 0
    const map: Record<string, number> = {}
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    for (const day of days) {
      const ds = format(day, 'yyyy-MM-dd')
      const dd = dayDataMap[ds]
      if (dd) bal += dd.net
      map[ds] = bal
    }
    return map
  }, [dayDataMap, monthStart, monthEnd])

  const fmt = (n: number) => n.toLocaleString('th-TH')
  const today = format(new Date(), 'yyyy-MM-dd')

  // Calendar grid
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDow = getDay(monthStart) // 0=Sun
  const emptyBefore = Array.from({ length: startDow }, (_, i) => i)

  const selectedDayData = selectedDate ? dayDataMap[selectedDate] : null

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm">
          ◀ เดือนก่อน
        </button>
        <h3 className="text-lg font-semibold text-white">{monthLabel}</h3>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
          className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm">
          เดือนถัดไป ▶
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">กำลังโหลด...</div>
      ) : (
        <>
          {/* Calendar Grid */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-slate-700">
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                <div key={d} className="px-1 py-2 text-center text-xs font-semibold text-slate-400">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {emptyBefore.map(i => <div key={`e${i}`} className="min-h-[80px] md:min-h-[100px] border-b border-r border-slate-700/30" />)}
              {days.map(day => {
                const ds = format(day, 'yyyy-MM-dd')
                const dd = dayDataMap[ds]
                const bal = runningBalance[ds] || 0
                const isToday = ds === today
                const isSelected = ds === selectedDate
                const hasData = dd && (dd.cashIn > 0 || dd.cashOut > 0)

                return (
                  <button
                    key={ds}
                    onClick={() => setSelectedDate(isSelected ? null : ds)}
                    className={`min-h-[80px] md:min-h-[100px] border-b border-r border-slate-700/30 p-1 md:p-2 text-left transition-colors ${
                      isSelected ? 'bg-sky-500/15 ring-1 ring-sky-500' :
                      isToday ? 'bg-slate-700/30' :
                      'hover:bg-slate-700/20'
                    }`}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday ? 'text-sky-400 font-bold' : 'text-slate-400'}`}>
                      {format(day, 'd')}
                    </div>
                    {hasData && (
                      <div className="space-y-0.5">
                        {dd.cashIn > 0 && (
                          <div className="text-[0.6rem] md:text-xs text-emerald-400 font-mono truncate">+{fmt(dd.cashIn)}</div>
                        )}
                        {dd.cashOut > 0 && (
                          <div className="text-[0.6rem] md:text-xs text-rose-400 font-mono truncate">-{fmt(dd.cashOut)}</div>
                        )}
                      </div>
                    )}
                    {hasData && (
                      <div className={`text-[0.55rem] md:text-[0.65rem] font-mono mt-0.5 ${bal >= 0 ? 'text-sky-400/70' : 'text-rose-400/70'}`}>
                        {fmt(bal)}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Day Breakdown */}
          {selectedDayData && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-white mb-3">
                รายการวันที่ {format(parseISO(selectedDayData.date), 'd MMMM yyyy', { locale: th })}
              </h4>

              {selectedDayData.items.length === 0 ? (
                <p className="text-sm text-slate-500">ไม่มีรายการในวันนี้</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayData.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          item.type === 'in' ? 'bg-emerald-400' :
                          item.type === 'receivable' ? 'bg-sky-400' :
                          item.type === 'loan' ? 'bg-amber-400' :
                          'bg-rose-400'
                        }`} />
                        <span className="text-sm text-slate-300">{item.desc}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          item.type === 'in' ? 'bg-emerald-500/15 text-emerald-400' :
                          item.type === 'receivable' ? 'bg-sky-500/15 text-sky-400' :
                          item.type === 'loan' ? 'bg-amber-500/15 text-amber-400' :
                          'bg-rose-500/15 text-rose-400'
                        }`}>
                          {item.type === 'in' ? 'เงินเข้า' : item.type === 'receivable' ? 'ลูกหนี้' : item.type === 'loan' ? 'ผ่อนชำระ' : 'เงินออก'}
                        </span>
                      </div>
                      <span className={`font-mono text-sm font-medium ${
                        item.type === 'in' || item.type === 'receivable' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {item.type === 'in' || item.type === 'receivable' ? '+' : '-'}{fmt(item.amount)} ฿
                      </span>
                    </div>
                  ))}

                  {/* Day summary */}
                  <div className="flex justify-between pt-2 mt-2 border-t border-slate-600">
                    <span className="text-sm font-medium text-slate-300">ยอดสุทธิวันนี้</span>
                    <span className={`font-mono text-sm font-bold ${selectedDayData.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {selectedDayData.net >= 0 ? '+' : ''}{fmt(selectedDayData.net)} ฿
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">ยอดคงเหลือสะสม</span>
                    <span className={`font-mono text-sm font-medium ${(runningBalance[selectedDayData.date] || 0) >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
                      {fmt(runningBalance[selectedDayData.date] || 0)} ฿
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
