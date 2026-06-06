import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CashFlow, Loan, Receivable, InventoryEntry } from '../types'
import { exportToExcel } from '../lib/export'
import { format, addMonths, startOfMonth } from 'date-fns'
import { th } from 'date-fns/locale'

export default function Dashboard() {
  const [cashFlow, setCashFlow] = useState<CashFlow[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('sinchai_cash_flow').select('*').order('date'),
      supabase.from('sinchai_loans').select('*').order('due_date'),
      supabase.from('sinchai_receivables').select('*').order('due_date'),
      supabase.from('sinchai_inventory').select('*').order('date'),
    ]).then(([cf, ln, rc, inv]) => {
      setCashFlow(cf.data || [])
      setLoans(ln.data || [])
      setReceivables(rc.data || [])
      setInventory(inv.data || [])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div className="text-center py-12 text-gray-400">กำลังโหลดข้อมูล...</div>
  }

  // Calculations
  const totalIn = cashFlow.reduce((s, e) => s + (e.type === 'in' ? Number(e.amount) : 0), 0)
  const totalOut = cashFlow.reduce((s, e) => s + (e.type === 'out' ? Number(e.amount) : 0), 0)
  const balance = totalIn - totalOut

  const pendingLoans = loans.filter(l => l.status !== 'paid')
  const totalLoanDebt = pendingLoans.reduce((s, l) => s + Number(l.principal) + Number(l.interest), 0)

  const pendingReceivables = receivables.filter(r => r.status !== 'received')
  const totalReceivable = pendingReceivables.reduce((s, r) => s + Number(r.amount), 0)

  // Stock value
  const stockByItem: Record<string, { qty: number; value: number }> = {}
  const sortedInv = [...inventory].sort((a, b) => a.date.localeCompare(b.date))
  for (const e of sortedInv) {
    if (!stockByItem[e.item]) stockByItem[e.item] = { qty: 0, value: 0 }
    if (e.type === 'in') {
      stockByItem[e.item].qty += Number(e.quantity)
      stockByItem[e.item].value += Number(e.quantity) * Number(e.unit_price)
    } else {
      stockByItem[e.item].qty -= Number(e.quantity)
      stockByItem[e.item].value -= Number(e.quantity) * Number(e.unit_price)
    }
  }
  const totalStockValue = Object.values(stockByItem).reduce((s, v) => s + Math.max(0, v.value), 0)

  // 6-month forecast
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const month = startOfMonth(addMonths(now, i))
    const monthStr = format(month, 'yyyy-MM')
    const label = format(month, 'MMM yyyy', { locale: th })

    // Cash flow for this month
    const cfIn = cashFlow.filter(e => e.type === 'in' && e.date.startsWith(monthStr)).reduce((s, e) => s + Number(e.amount), 0)
    const cfOut = cashFlow.filter(e => e.type === 'out' && e.date.startsWith(monthStr)).reduce((s, e) => s + Number(e.amount), 0)

    // Loans due this month
    const loansDue = loans.filter(l => l.status !== 'paid' && l.due_date.startsWith(monthStr))
      .reduce((s, l) => s + Number(l.principal) + Number(l.interest), 0)

    // Receivables expected this month
    const recExpected = receivables.filter(r => r.status !== 'received' && (r.expected_date || r.due_date).startsWith(monthStr))
      .reduce((s, r) => s + Number(r.amount), 0)

    return { month: monthStr, label, cfIn, cfOut, loansDue, recExpected, net: cfIn + recExpected - cfOut - loansDue }
  })

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
        name: 'แผน 6 เดือน',
        data: months.map(m => ({
          'เดือน': m.label,
          'รายรับ': m.cfIn,
          'รายจ่าย': m.cfOut,
          'ผ่อนชำระ': m.loansDue,
          'ลูกหนี้คาดรับ': m.recExpected,
          'สุทธิ': m.net,
        })),
      },
    ], `sinchai-financial-report-${format(now, 'yyyy-MM-dd')}`)
  }

  return (
    <div className="space-y-6">
      {/* Top Summary */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">แดชบอร์ดแผน 6 เดือน</h2>
        <button onClick={handleExport}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
          ดาวน์โหลด Excel
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`rounded-xl p-4 border ${balance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-sm font-medium text-gray-600">ยอดเงินคงเหลือ</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {balance.toLocaleString('th-TH')} ฿
          </p>
          <p className="text-xs text-gray-500 mt-1">รับ {totalIn.toLocaleString('th-TH')} - จ่าย {totalOut.toLocaleString('th-TH')}</p>
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

      {/* 6-Month Forecast Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-800">แผนกระแสเงินสด 6 เดือน</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">เดือน</th>
                <th className="px-4 py-3 text-right font-medium text-green-600">รายรับ</th>
                <th className="px-4 py-3 text-right font-medium text-red-600">รายจ่าย</th>
                <th className="px-4 py-3 text-right font-medium text-orange-600">ผ่อนชำระ</th>
                <th className="px-4 py-3 text-right font-medium text-yellow-600">ลูกหนี้คาดรับ</th>
                <th className="px-4 py-3 text-right font-medium text-gray-800">สุทธิ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {months.map(m => (
                <tr key={m.month} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{m.label}</td>
                  <td className="px-4 py-3 text-right text-green-600">{m.cfIn > 0 ? `+${m.cfIn.toLocaleString('th-TH')}` : '-'}</td>
                  <td className="px-4 py-3 text-right text-red-600">{m.cfOut > 0 ? `-${m.cfOut.toLocaleString('th-TH')}` : '-'}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{m.loansDue > 0 ? `-${m.loansDue.toLocaleString('th-TH')}` : '-'}</td>
                  <td className="px-4 py-3 text-right text-yellow-600">{m.recExpected > 0 ? `+${m.recExpected.toLocaleString('th-TH')}` : '-'}</td>
                  <td className={`px-4 py-3 text-right font-bold ${m.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {m.net.toLocaleString('th-TH')}
                  </td>
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
        {/* Top Expense Categories */}
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

        {/* Upcoming Payments */}
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
