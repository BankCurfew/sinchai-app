import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { CashFlow, Loan, Receivable, InventoryEntry } from '../types'
import { exportToExcel } from '../lib/export'
import { format, addMonths, startOfMonth, differenceInMonths, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import TimeRangeSelector from './TimeRangeSelector'
import type { TimeRange } from './TimeRangeSelector'

interface OpeningBalances {
  cash_flow: number
  loans: number
  receivables: number
  inventory: number
}

export default function Dashboard() {
  const [cashFlow, setCashFlow] = useState<CashFlow[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const [openingBalances, setOpeningBalances] = useState<OpeningBalances>({
    cash_flow: 0, loans: 0, receivables: 0, inventory: 0,
  })
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>({ label: '6 เดือน', months: 6 })

  useEffect(() => {
    Promise.all([
      supabase.from('sinchai_cash_flow').select('*').order('date'),
      supabase.from('sinchai_loans').select('*').order('due_date'),
      supabase.from('sinchai_receivables').select('*').order('due_date'),
      supabase.from('sinchai_inventory').select('*').order('date'),
      supabase.from('sinchai_opening_balances').select('*'),
    ]).then(([cf, ln, rc, inv, ob]) => {
      setCashFlow(cf.data || [])
      setLoans(ln.data || [])
      setReceivables(rc.data || [])
      setInventory(inv.data || [])
      const balances: OpeningBalances = { cash_flow: 0, loans: 0, receivables: 0, inventory: 0 }
      for (const row of (ob.data || [])) {
        balances[row.module as keyof OpeningBalances] = Number(row.amount)
      }
      setOpeningBalances(balances)
      setLoading(false)
    })
  }, [])

  // Generate month list based on time range
  const monthList = useMemo(() => {
    const now = new Date()
    if (timeRange.months > 0) {
      return Array.from({ length: timeRange.months }, (_, i) => startOfMonth(addMonths(now, i)))
    }
    if (timeRange.startDate && timeRange.endDate) {
      const start = startOfMonth(parseISO(timeRange.startDate))
      const end = startOfMonth(parseISO(timeRange.endDate))
      const count = Math.max(1, differenceInMonths(end, start) + 1)
      return Array.from({ length: Math.min(count, 24) }, (_, i) => startOfMonth(addMonths(start, i)))
    }
    return Array.from({ length: 6 }, (_, i) => startOfMonth(addMonths(now, i)))
  }, [timeRange])

  // Stock value calculation
  const stockByItem = useMemo(() => {
    const summary: Record<string, { qty: number; value: number }> = {}
    const sorted = [...inventory].sort((a, b) => a.date.localeCompare(b.date))
    for (const e of sorted) {
      if (!summary[e.item]) summary[e.item] = { qty: 0, value: 0 }
      if (e.type === 'in') {
        summary[e.item].qty += Number(e.quantity)
        summary[e.item].value += Number(e.quantity) * Number(e.unit_price)
      } else {
        summary[e.item].qty -= Number(e.quantity)
        summary[e.item].value -= Number(e.quantity) * Number(e.unit_price)
      }
    }
    return summary
  }, [inventory])

  // Monthly projections with running balances
  const projections = useMemo(() => {
    let runningCash = openingBalances.cash_flow
    let runningLoanDebt = openingBalances.loans
    let runningReceivable = openingBalances.receivables
    let runningStock = openingBalances.inventory

    // Add current totals from transactions
    const totalStockValue = Object.values(stockByItem).reduce((s, v) => s + Math.max(0, v.value), 0)
    const currentReceivablePending = receivables.filter(r => r.status !== 'received').reduce((s, r) => s + Number(r.amount), 0)

    return monthList.map((month, idx) => {
      const monthStr = format(month, 'yyyy-MM')
      const label = format(month, 'MMM yyyy', { locale: th })

      // Cash flow for this month
      const cfIn = cashFlow.filter(e => e.type === 'in' && e.date.startsWith(monthStr)).reduce((s, e) => s + Number(e.amount), 0)
      const cfOut = cashFlow.filter(e => e.type === 'out' && e.date.startsWith(monthStr)).reduce((s, e) => s + Number(e.amount), 0)

      // Loans due this month
      const loanPayments = loans.filter(l => l.due_date.startsWith(monthStr))
      const loanPrincipal = loanPayments.reduce((s, l) => s + Number(l.principal), 0)
      const loanInterest = loanPayments.reduce((s, l) => s + Number(l.interest), 0)
      const loanTotal = loanPrincipal + loanInterest

      // Receivables expected this month
      const recExpected = receivables.filter(r => r.status !== 'received' && (r.expected_date || r.due_date).startsWith(monthStr))
        .reduce((s, r) => s + Number(r.amount), 0)

      // Inventory movements this month
      const invIn = inventory.filter(e => e.type === 'in' && e.date.startsWith(monthStr))
        .reduce((s, e) => s + Number(e.quantity) * Number(e.unit_price), 0)
      const invOut = inventory.filter(e => e.type === 'out' && e.date.startsWith(monthStr))
        .reduce((s, e) => s + Number(e.quantity) * Number(e.unit_price), 0)

      // Running balances
      if (idx === 0) {
        // First month: add existing transaction totals
        const existingCfIn = cashFlow.filter(e => e.type === 'in').reduce((s, e) => s + Number(e.amount), 0)
        const existingCfOut = cashFlow.filter(e => e.type === 'out').reduce((s, e) => s + Number(e.amount), 0)
        runningCash += existingCfIn - existingCfOut
        runningLoanDebt += loans.filter(l => l.status !== 'paid').reduce((s, l) => s + Number(l.principal), 0)
        runningReceivable += currentReceivablePending
        runningStock += totalStockValue
      } else {
        runningCash += cfIn + recExpected - cfOut - loanTotal
        runningLoanDebt -= loanPrincipal
        runningReceivable -= recExpected
        runningStock += invIn - invOut
      }

      return {
        month: monthStr,
        label,
        cfIn,
        cfOut,
        loanPrincipal,
        loanInterest,
        loanTotal,
        recExpected,
        invIn,
        invOut,
        netCash: cfIn + recExpected - cfOut - loanTotal,
        endingCash: runningCash,
        endingLoanDebt: Math.max(0, runningLoanDebt),
        endingReceivable: Math.max(0, runningReceivable),
        endingStock: Math.max(0, runningStock),
      }
    })
  }, [monthList, cashFlow, loans, receivables, inventory, stockByItem, openingBalances])

  if (loading) {
    return <div className="text-center py-12 text-gray-400">กำลังโหลดข้อมูล...</div>
  }

  // Current totals
  const totalIn = cashFlow.reduce((s, e) => s + (e.type === 'in' ? Number(e.amount) : 0), 0)
  const totalOut = cashFlow.reduce((s, e) => s + (e.type === 'out' ? Number(e.amount) : 0), 0)
  const currentCash = openingBalances.cash_flow + totalIn - totalOut
  const pendingLoans = loans.filter(l => l.status !== 'paid')
  const totalLoanDebt = openingBalances.loans + pendingLoans.reduce((s, l) => s + Number(l.principal), 0)
  const pendingReceivables = receivables.filter(r => r.status !== 'received')
  const totalReceivable = openingBalances.receivables + pendingReceivables.reduce((s, r) => s + Number(r.amount), 0)
  const totalStockValue = openingBalances.inventory + Object.values(stockByItem).reduce((s, v) => s + Math.max(0, v.value), 0)

  const handleExport = () => {
    exportToExcel([
      {
        name: 'กระแสเงินสด',
        data: cashFlow.map(e => ({
          'วันที่': e.date,
          'ประเภท': e.type === 'in' ? 'เงินเข้า' : 'เงินออก',
          'จำนวน': Number(e.amount),
          'หมวดหมู่': e.category,
          'รายละเอียด': e.description,
        })),
      },
      {
        name: 'เงินกู้',
        data: loans.map(l => ({
          'วันครบกำหนด': l.due_date,
          'เงินต้น': Number(l.principal),
          'ดอกเบี้ย': Number(l.interest),
          'ยอดรวม': Number(l.total),
          'สถานะ': l.status,
          'รายละเอียด': l.description,
        })),
      },
      {
        name: 'ลูกหนี้',
        data: receivables.map(r => ({
          'ชื่อลูกหนี้': r.debtor_name,
          'จำนวน': Number(r.amount),
          'วันครบกำหนด': r.due_date,
          'สถานะ': r.status,
          'คาดว่าจะได้รับ': r.expected_date || '-',
          'หมายเหตุ': r.notes,
        })),
      },
      {
        name: 'สต๊อก',
        data: inventory.map(e => ({
          'วันที่': e.date,
          'ประเภท': e.type === 'in' ? 'สั่งเข้า' : 'ขายออก',
          'สินค้า': e.item,
          'จำนวน': Number(e.quantity),
          'ราคา/หน่วย': Number(e.unit_price),
          'มูลค่า': Number(e.quantity) * Number(e.unit_price),
        })),
      },
      {
        name: 'ประมาณการรายเดือน',
        data: projections.map(m => ({
          'เดือน': m.label,
          'รายรับ': m.cfIn,
          'รายจ่าย': m.cfOut,
          'ผ่อนเงินต้น': m.loanPrincipal,
          'ดอกเบี้ย': m.loanInterest,
          'ลูกหนี้คาดรับ': m.recExpected,
          'สุทธิ': m.netCash,
          'เงินสดคงเหลือ': m.endingCash,
          'หนี้คงค้าง': m.endingLoanDebt,
          'ลูกหนี้คงค้าง': m.endingReceivable,
          'มูลค่าสต๊อก': m.endingStock,
        })),
      },
    ], `sinchai-financial-report-${format(new Date(), 'yyyy-MM-dd')}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-xl font-bold text-gray-800">แดชบอร์ดวางแผนการเงิน</h2>
        <button onClick={handleExport}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
          ดาวน์โหลด Excel
        </button>
      </div>

      {/* Time Range */}
      <TimeRangeSelector onChange={setTimeRange} />

      {/* Current Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`rounded-xl p-4 border ${currentCash >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-sm font-medium text-gray-600">เงินสดคงเหลือ</p>
          <p className={`text-2xl font-bold ${currentCash >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {currentCash.toLocaleString('th-TH')} ฿
          </p>
          <p className="text-xs text-gray-500 mt-1">ยกมา {openingBalances.cash_flow.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-600">หนี้คงค้าง</p>
          <p className="text-2xl font-bold text-orange-700">{totalLoanDebt.toLocaleString('th-TH')} ฿</p>
          <p className="text-xs text-gray-500 mt-1">{pendingLoans.length} รายการ</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-600">ลูกหนี้คงค้าง</p>
          <p className="text-2xl font-bold text-yellow-700">{totalReceivable.toLocaleString('th-TH')} ฿</p>
          <p className="text-xs text-gray-500 mt-1">{pendingReceivables.length} ราย</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-600">มูลค่าสต๊อก</p>
          <p className="text-2xl font-bold text-indigo-700">{totalStockValue.toLocaleString('th-TH')} ฿</p>
          <p className="text-xs text-gray-500 mt-1">{Object.keys(stockByItem).length} รายการ</p>
        </div>
      </div>

      {/* Projection Table — Cash Flow */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-800">ประมาณการกระแสเงินสด — {timeRange.label}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-gray-600">เดือน</th>
                <th className="px-3 py-3 text-right font-medium text-green-600">รายรับ</th>
                <th className="px-3 py-3 text-right font-medium text-red-600">รายจ่าย</th>
                <th className="px-3 py-3 text-right font-medium text-orange-600">ผ่อนชำระ</th>
                <th className="px-3 py-3 text-right font-medium text-yellow-600">ลูกหนี้คาดรับ</th>
                <th className="px-3 py-3 text-right font-medium text-gray-700">สุทธิ</th>
                <th className="px-3 py-3 text-right font-medium text-blue-700">เงินสดคงเหลือ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {projections.map(m => (
                <tr key={m.month} className="hover:bg-gray-50">
                  <td className="px-3 py-3 font-medium">{m.label}</td>
                  <td className="px-3 py-3 text-right text-green-600">{m.cfIn > 0 ? `+${m.cfIn.toLocaleString('th-TH')}` : '-'}</td>
                  <td className="px-3 py-3 text-right text-red-600">{m.cfOut > 0 ? `-${m.cfOut.toLocaleString('th-TH')}` : '-'}</td>
                  <td className="px-3 py-3 text-right text-orange-600">{m.loanTotal > 0 ? `-${m.loanTotal.toLocaleString('th-TH')}` : '-'}</td>
                  <td className="px-3 py-3 text-right text-yellow-600">{m.recExpected > 0 ? `+${m.recExpected.toLocaleString('th-TH')}` : '-'}</td>
                  <td className={`px-3 py-3 text-right font-bold ${m.netCash >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {m.netCash.toLocaleString('th-TH')}
                  </td>
                  <td className={`px-3 py-3 text-right font-bold ${m.endingCash >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {m.endingCash.toLocaleString('th-TH')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Projection Table — Loan & Receivables & Stock */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-800">ประมาณการหนี้สิน ลูกหนี้ และสต๊อก — {timeRange.label}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-gray-600">เดือน</th>
                <th className="px-3 py-3 text-right font-medium text-orange-600">ผ่อนเงินต้น</th>
                <th className="px-3 py-3 text-right font-medium text-purple-600">ดอกเบี้ย</th>
                <th className="px-3 py-3 text-right font-medium text-orange-700">หนี้คงค้าง</th>
                <th className="px-3 py-3 text-right font-medium text-yellow-600">ลูกหนี้คาดรับ</th>
                <th className="px-3 py-3 text-right font-medium text-yellow-700">ลูกหนี้คงค้าง</th>
                <th className="px-3 py-3 text-right font-medium text-green-600">สต๊อกเข้า</th>
                <th className="px-3 py-3 text-right font-medium text-red-600">สต๊อกออก</th>
                <th className="px-3 py-3 text-right font-medium text-indigo-700">มูลค่าสต๊อก</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {projections.map(m => (
                <tr key={m.month} className="hover:bg-gray-50">
                  <td className="px-3 py-3 font-medium">{m.label}</td>
                  <td className="px-3 py-3 text-right text-orange-600">{m.loanPrincipal > 0 ? m.loanPrincipal.toLocaleString('th-TH') : '-'}</td>
                  <td className="px-3 py-3 text-right text-purple-600">{m.loanInterest > 0 ? m.loanInterest.toLocaleString('th-TH') : '-'}</td>
                  <td className="px-3 py-3 text-right font-medium text-orange-700">{m.endingLoanDebt.toLocaleString('th-TH')}</td>
                  <td className="px-3 py-3 text-right text-yellow-600">{m.recExpected > 0 ? m.recExpected.toLocaleString('th-TH') : '-'}</td>
                  <td className="px-3 py-3 text-right font-medium text-yellow-700">{m.endingReceivable.toLocaleString('th-TH')}</td>
                  <td className="px-3 py-3 text-right text-green-600">{m.invIn > 0 ? `+${m.invIn.toLocaleString('th-TH')}` : '-'}</td>
                  <td className="px-3 py-3 text-right text-red-600">{m.invOut > 0 ? `-${m.invOut.toLocaleString('th-TH')}` : '-'}</td>
                  <td className="px-3 py-3 text-right font-bold text-indigo-700">{m.endingStock.toLocaleString('th-TH')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overdue Alerts */}
      {(loans.filter(l => l.status === 'overdue').length > 0 || receivables.filter(r => r.status === 'overdue').length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h3 className="font-semibold text-red-800 mb-3">รายการเลยกำหนด</h3>
          <div className="space-y-2">
            {loans.filter(l => l.status === 'overdue').map(l => (
              <div key={l.id} className="flex justify-between text-sm">
                <span className="text-red-700">เงินกู้: {l.description || 'ไม่มีรายละเอียด'} — ครบกำหนด {l.due_date}</span>
                <span className="font-medium text-red-800">{(Number(l.principal) + Number(l.interest)).toLocaleString('th-TH')} ฿</span>
              </div>
            ))}
            {receivables.filter(r => r.status === 'overdue').map(r => (
              <div key={r.id} className="flex justify-between text-sm">
                <span className="text-red-700">ลูกหนี้: {r.debtor_name} — ครบกำหนด {r.due_date}</span>
                <span className="font-medium text-red-800">{Number(r.amount).toLocaleString('th-TH')} ฿</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-semibold text-gray-800 mb-3">หมวดรายจ่ายสูงสุด</h3>
          {(() => {
            const byCategory: Record<string, number> = {}
            cashFlow.filter(e => e.type === 'out').forEach(e => {
              byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount)
            })
            const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5)
            if (sorted.length === 0) return <p className="text-gray-400 text-sm">ยังไม่มีข้อมูล</p>
            const max = sorted[0][1]
            return sorted.map(([cat, amount]) => (
              <div key={cat} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{cat}</span>
                  <span className="font-medium">{amount.toLocaleString('th-TH')} ฿</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-red-400 rounded-full h-2" style={{ width: `${(amount / max) * 100}%` }} />
                </div>
              </div>
            ))
          })()}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-semibold text-gray-800 mb-3">การชำระที่ใกล้ถึง</h3>
          {(() => {
            const upcoming = pendingLoans
              .sort((a, b) => a.due_date.localeCompare(b.due_date))
              .slice(0, 5)
            if (upcoming.length === 0) return <p className="text-gray-400 text-sm">ไม่มีรายการค้างชำระ</p>
            return upcoming.map(l => (
              <div key={l.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{l.description || 'เงินกู้'}</p>
                  <p className="text-xs text-gray-500">ครบกำหนด: {l.due_date}</p>
                </div>
                <span className="font-medium text-orange-700">
                  {(Number(l.principal) + Number(l.interest)).toLocaleString('th-TH')} ฿
                </span>
              </div>
            ))
          })()}
        </div>
      </div>
    </div>
  )
}
