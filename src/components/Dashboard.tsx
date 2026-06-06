import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { CashFlow, Loan, Receivable, InventoryEntry } from '../types'
import { exportToExcel } from '../lib/export'
import { format, addMonths, startOfMonth, differenceInMonths, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'
import KPICard from './shared/KPICard'
import BroughtForwardBar from './shared/BroughtForwardBar'
import TimeRangeSelector from './TimeRangeSelector'
import type { TimeRange } from './TimeRangeSelector'
import StatusBadge from './shared/StatusBadge'
import { useCompany } from '../lib/company'

interface OpeningBalances { cash_flow: number; loans: number; receivables: number; inventory: number }

const COLORS = ['#fb7185', '#fbbf24', '#38bdf8', '#a78bfa', '#64748b']

export default function Dashboard({ exportTrigger }: { exportTrigger: number }) {
  const { selectedId, selectedName } = useCompany()
  const [cashFlow, setCashFlow] = useState<CashFlow[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const [ob, setOb] = useState<OpeningBalances>({ cash_flow: 0, loans: 0, receivables: 0, inventory: 0 })
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>({ label: '6 เดือน', months: 6 })

  useEffect(() => {
    let qCf = supabase.from('sinchai_cash_flow').select('*').order('date')
    let qLn = supabase.from('sinchai_loans').select('*').order('due_date')
    let qRc = supabase.from('sinchai_receivables').select('*').order('due_date')
    let qInv = supabase.from('sinchai_inventory').select('*').order('date')
    if (selectedId) { qCf = qCf.eq('company_id', selectedId); qLn = qLn.eq('company_id', selectedId); qRc = qRc.eq('company_id', selectedId); qInv = qInv.eq('company_id', selectedId) }
    Promise.all([qCf, qLn, qRc, qInv, supabase.from('sinchai_opening_balances').select('*')]).then(([cf, ln, rc, inv, obd]) => {
      setCashFlow(cf.data || [])
      setLoans(ln.data || [])
      setReceivables(rc.data || [])
      setInventory(inv.data || [])
      const b: OpeningBalances = { cash_flow: 0, loans: 0, receivables: 0, inventory: 0 }
      for (const r of (obd.data || [])) b[r.module as keyof OpeningBalances] = Number(r.amount)
      setOb(b)
      setLoading(false)
    })
  }, [selectedId])

  const monthList = useMemo(() => {
    const now = new Date()
    if (timeRange.months > 0) return Array.from({ length: timeRange.months }, (_, i) => startOfMonth(addMonths(now, i)))
    if (timeRange.startDate && timeRange.endDate) {
      const s = startOfMonth(parseISO(timeRange.startDate)), e = startOfMonth(parseISO(timeRange.endDate))
      const c = Math.max(1, Math.min(24, differenceInMonths(e, s) + 1))
      return Array.from({ length: c }, (_, i) => startOfMonth(addMonths(s, i)))
    }
    return Array.from({ length: 6 }, (_, i) => startOfMonth(addMonths(now, i)))
  }, [timeRange])

  const stockByItem = useMemo(() => {
    const s: Record<string, { qty: number; value: number }> = {}
    for (const e of [...inventory].sort((a, b) => a.date.localeCompare(b.date))) {
      if (!s[e.item]) s[e.item] = { qty: 0, value: 0 }
      const v = Number(e.quantity) * Number(e.unit_price)
      if (e.type === 'in') { s[e.item].qty += Number(e.quantity); s[e.item].value += v }
      else { s[e.item].qty -= Number(e.quantity); s[e.item].value -= v }
    }
    return s
  }, [inventory])

  const projections = useMemo(() => {
    let rc = ob.cash_flow, rl = ob.loans, rr = ob.receivables, rs = ob.inventory
    const tsv = Object.values(stockByItem).reduce((s, v) => s + Math.max(0, v.value), 0)
    const crp = receivables.filter(r => r.status !== 'received').reduce((s, r) => s + Number(r.amount), 0)

    return monthList.map((month, idx) => {
      const ms = format(month, 'yyyy-MM'), label = format(month, 'MMM yy', { locale: th })
      const cfIn = cashFlow.filter(e => e.type === 'in' && e.date.startsWith(ms)).reduce((s, e) => s + Number(e.amount), 0)
      const cfOut = cashFlow.filter(e => e.type === 'out' && e.date.startsWith(ms)).reduce((s, e) => s + Number(e.amount), 0)
      const lp = loans.filter(l => l.due_date.startsWith(ms)).reduce((s, l) => s + Number(l.principal), 0)
      const li = loans.filter(l => l.due_date.startsWith(ms)).reduce((s, l) => s + Number(l.interest), 0)
      const lt = lp + li
      const re = receivables.filter(r => r.status !== 'received' && (r.expected_date || r.due_date).startsWith(ms)).reduce((s, r) => s + Number(r.amount), 0)
      const invIn = inventory.filter(e => e.type === 'in' && e.date.startsWith(ms)).reduce((s, e) => s + Number(e.quantity) * Number(e.unit_price), 0)
      const invOut = inventory.filter(e => e.type === 'out' && e.date.startsWith(ms)).reduce((s, e) => s + Number(e.quantity) * Number(e.unit_price), 0)

      if (idx === 0) {
        rc += cashFlow.filter(e => e.type === 'in').reduce((s, e) => s + Number(e.amount), 0) - cashFlow.filter(e => e.type === 'out').reduce((s, e) => s + Number(e.amount), 0)
        rl += loans.filter(l => l.status !== 'paid').reduce((s, l) => s + Number(l.principal), 0)
        rr += crp; rs += tsv
      } else { rc += cfIn + re - cfOut - lt; rl -= lp; rr -= re; rs += invIn - invOut }

      return { month: ms, label, cfIn, cfOut, lp, li, lt, re, invIn, invOut, net: cfIn + re - cfOut - lt, cash: rc, debt: Math.max(0, rl), recv: Math.max(0, rr), stock: Math.max(0, rs) }
    })
  }, [monthList, cashFlow, loans, receivables, inventory, stockByItem, ob])

  // Export handler
  useEffect(() => {
    if (exportTrigger === 0) return
    exportToExcel([
      { name: 'กระแสเงินสด', data: cashFlow.map(e => ({ 'วันที่': e.date, 'ประเภท': e.type === 'in' ? 'เงินเข้า' : 'เงินออก', 'จำนวน': Number(e.amount), 'หมวดหมู่': e.category, 'รายละเอียด': e.description })) },
      { name: 'เงินกู้', data: loans.map(l => ({ 'วันครบกำหนด': l.due_date, 'เงินต้น': Number(l.principal), 'ดอกเบี้ย': Number(l.interest), 'ยอดรวม': Number(l.total), 'สถานะ': l.status, 'รายละเอียด': l.description })) },
      { name: 'ลูกหนี้', data: receivables.map(r => ({ 'ชื่อลูกหนี้': r.debtor_name, 'จำนวน': Number(r.amount), 'วันครบกำหนด': r.due_date, 'สถานะ': r.status, 'คาดว่าจะได้รับ': r.expected_date || '-', 'หมายเหตุ': r.notes })) },
      { name: 'สต๊อก', data: inventory.map(e => ({ 'วันที่': e.date, 'ประเภท': e.type === 'in' ? 'สั่งเข้า' : 'ขายออก', 'สินค้า': e.item, 'จำนวน': Number(e.quantity), 'ราคา/หน่วย': Number(e.unit_price), 'มูลค่า': Number(e.quantity) * Number(e.unit_price) })) },
      { name: 'ประมาณการรายเดือน', data: projections.map(m => ({ 'เดือน': m.label, 'รายรับ': m.cfIn, 'รายจ่าย': m.cfOut, 'ผ่อนชำระ': m.lt, 'ลูกหนี้คาดรับ': m.re, 'สุทธิ': m.net, 'เงินสดคงเหลือ': m.cash, 'หนี้คงค้าง': m.debt, 'ลูกหนี้คงค้าง': m.recv, 'มูลค่าสต๊อก': m.stock })) },
    ], `sinchai-financial-report-${format(new Date(), 'yyyy-MM-dd')}`)
  }, [exportTrigger])

  if (loading) return <div className="text-center py-20 text-slate-500">กำลังโหลดข้อมูล...</div>

  const totalIn = cashFlow.reduce((s, e) => s + (e.type === 'in' ? Number(e.amount) : 0), 0)
  const totalOut = cashFlow.reduce((s, e) => s + (e.type === 'out' ? Number(e.amount) : 0), 0)
  const currentCash = ob.cash_flow + totalIn - totalOut
  const pendingLoans = loans.filter(l => l.status !== 'paid')
  const totalDebt = ob.loans + pendingLoans.reduce((s, l) => s + Number(l.principal), 0)
  const pendingRecv = receivables.filter(r => r.status !== 'received')
  const totalRecv = ob.receivables + pendingRecv.reduce((s, r) => s + Number(r.amount), 0)
  const totalStock = ob.inventory + Object.values(stockByItem).reduce((s, v) => s + Math.max(0, v.value), 0)
  const fmt = (n: number) => n.toLocaleString('th-TH')

  // Expense breakdown for donut
  const expenseByCategory: Record<string, number> = {}
  cashFlow.filter(e => e.type === 'out').forEach(e => { expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + Number(e.amount) })
  const donutData = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }))

  // Receivables aging
  const now = new Date()
  const aging = [
    { label: '0-30 วัน', value: 0, color: '#34d399' },
    { label: '30-60 วัน', value: 0, color: '#38bdf8' },
    { label: '60-90 วัน', value: 0, color: '#fbbf24' },
    { label: '90+ วัน', value: 0, color: '#fb7185' },
  ]
  pendingRecv.forEach(r => {
    const days = Math.floor((now.getTime() - new Date(r.due_date).getTime()) / 86400000)
    const amt = Number(r.amount)
    if (days < 30) aging[0].value += amt
    else if (days < 60) aging[1].value += amt
    else if (days < 90) aging[2].value += amt
    else aging[3].value += amt
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">แดชบอร์ดวางแผนการเงิน — {selectedName}</h1>
          <p className="text-xs text-slate-400 mt-1">ภาพรวมและประมาณการทุกหมวด — อัปเดตล่าสุด {format(now, 'd MMM yyyy', { locale: th })}</p>
        </div>
        <TimeRangeSelector onChange={setTimeRange} />
      </div>

      {/* Brought Forward */}
      <BroughtForwardBar
        date={format(now, '1 MMM yyyy', { locale: th })}
        items={[
          { label: 'เงินสดคงเหลือ', value: `${fmt(ob.cash_flow)} ฿`, color: 'positive' },
          { label: 'หนี้คงค้าง', value: `-${fmt(ob.loans)} ฿`, color: 'negative' },
          { label: 'ลูกหนี้คงค้าง', value: `${fmt(ob.receivables)} ฿` },
          { label: 'มูลค่าสต๊อก', value: `${fmt(ob.inventory)} ฿` },
        ]}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="เงินสดคงเหลือ" value={fmt(currentCash)} variant="income" valueColor={currentCash >= 0 ? undefined : 'text-rose-400'}
          trend={ob.cash_flow > 0 ? `${currentCash >= ob.cash_flow ? '+' : ''}${(((currentCash - ob.cash_flow) / ob.cash_flow) * 100).toFixed(1)}% จากยอดยกมา` : undefined}
          trendDirection={currentCash >= ob.cash_flow ? 'up' : 'down'} />
        <KPICard label="หนี้คงค้าง" value={fmt(totalDebt)} variant="expense"
          trend={`${pendingLoans.length} รายการค้างชำระ`}
          trendDirection={pendingLoans.length > 0 ? 'down' : 'up'} />
        <KPICard label="ลูกหนี้คงค้าง" value={fmt(totalRecv)} variant="debt"
          trend={`${pendingRecv.filter(r => r.status === 'overdue').length} รายเลยกำหนด`}
          trendDirection={pendingRecv.filter(r => r.status === 'overdue').length > 0 ? 'down' : 'up'} />
        <KPICard label="มูลค่าสต๊อก" value={fmt(totalStock)} variant="stock"
          trend={ob.inventory > 0 ? `${totalStock >= ob.inventory ? '+' : ''}${(((totalStock - ob.inventory) / ob.inventory) * 100).toFixed(1)}% จากยอดยกมา` : `${Object.keys(stockByItem).length} รายการ`}
          trendDirection={totalStock >= ob.inventory ? 'up' : 'down'} />
      </div>

      {/* Cash Flow Projection Chart */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-semibold text-white">ประมาณการกระแสเงินสด — {timeRange.label}</h2>
          <div className="flex flex-wrap gap-3">
            {[{ label: 'รายรับ', color: '#34d399' }, { label: 'รายจ่าย', color: '#fb7185' }, { label: 'ผ่อนชำระ', color: '#a78bfa' }, { label: 'สุทธิ', color: '#ffffff' }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs text-slate-400">
                <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={projections}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} formatter={(v) => `${fmt(Number(v))} ฿`} />
            <Area type="monotone" dataKey="cfIn" name="รายรับ" stroke="#34d399" fill="rgba(16,185,129,0.15)" strokeWidth={2} />
            <Area type="monotone" dataKey="cfOut" name="รายจ่าย" stroke="#fb7185" fill="rgba(244,63,94,0.1)" strokeWidth={2} />
            <Area type="monotone" dataKey="lt" name="ผ่อนชำระ" stroke="#a78bfa" fill="none" strokeWidth={1.5} strokeDasharray="4 4" />
            <Area type="monotone" dataKey="net" name="สุทธิ" stroke="#ffffff" fill="none" strokeWidth={2} strokeDasharray="6 3" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Two Column: Donut + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Expense Donut */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h2 className="text-base font-semibold text-white mb-4">หมวดรายจ่ายสูงสุด</h2>
          {donutData.length === 0 ? (
            <p className="text-slate-500 text-sm py-8 text-center">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="flex items-center gap-6">
              <div className="w-40 h-40 flex-shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                      {donutData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {donutData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i] }} />
                    <span className="text-slate-300 flex-1">{d.name}</span>
                    <span className="text-white font-mono text-xs font-medium">{fmt(d.value)} ฿</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Upcoming Payments */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">การชำระที่ใกล้ถึง</h2>
            {pendingLoans.length > 0 && <StatusBadge variant="warning">{pendingLoans.length} รายการ</StatusBadge>}
          </div>
          <div className="space-y-2">
            {pendingLoans.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">ไม่มีรายการค้างชำระ</p>
            ) : pendingLoans.sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5).map(l => {
              const days = Math.floor((new Date(l.due_date).getTime() - now.getTime()) / 86400000)
              const statusColor = days < 0 ? 'bg-rose-400' : days < 14 ? 'bg-amber-400' : 'bg-emerald-400'
              return (
                <div key={l.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/50 rounded-lg border border-slate-700/30">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 font-medium truncate">{l.description || 'เงินกู้'}</p>
                    <p className="text-xs text-slate-500">{days < 0 ? `เลยกำหนด ${-days} วัน` : `ครบกำหนด ${l.due_date} (${days} วัน)`}</p>
                  </div>
                  <span className={`font-mono text-sm font-semibold ${days < 0 ? 'text-rose-400' : 'text-white'}`}>
                    -{fmt(Number(l.principal) + Number(l.interest))} ฿
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Projection Tables */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4">
          <h2 className="text-base font-semibold text-white">ประมาณการกระแสเงินสด — รายเดือน</h2>
          <div className="flex gap-2">
            <StatusBadge variant="success">เงินเข้า</StatusBadge>
            <StatusBadge variant="danger">เงินออก</StatusBadge>
            <StatusBadge variant="info">คงเหลือ</StatusBadge>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700/50">
                {['เดือน', 'รายรับ', 'รายจ่าย', 'ผ่อนชำระ', 'ลูกหนี้คาดรับ', 'สุทธิ', 'เงินสดคงเหลือ'].map((h, i) => (
                  <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 whitespace-nowrap ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projections.map((m, i) => (
                <tr key={m.month} className={`border-b border-slate-700/30 hover:bg-sky-500/5 ${i % 2 === 1 ? 'bg-slate-800/30' : ''}`}>
                  <td className="px-4 py-2.5 text-slate-300">{m.label}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-emerald-400">{m.cfIn > 0 ? `+${fmt(m.cfIn)}` : '-'}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-rose-400">{m.cfOut > 0 ? `-${fmt(m.cfOut)}` : '-'}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-rose-400">{m.lt > 0 ? `-${fmt(m.lt)}` : '-'}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-sky-400">{m.re > 0 ? `+${fmt(m.re)}` : '-'}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-bold ${m.net >= 0 ? 'text-white' : 'text-rose-400'}`}>{fmt(m.net)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-bold text-[0.85rem] ${m.cash >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(m.cash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Widgets: Aging + Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Receivables Aging */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">อายุลูกหนี้คงค้าง</h2>
            {receivables.filter(r => r.status === 'overdue').length > 0 && (
              <StatusBadge variant="warning">{receivables.filter(r => r.status === 'overdue').length} รายเลยกำหนด</StatusBadge>
            )}
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={aging} layout="horizontal">
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} formatter={(v) => `${fmt(Number(v))} ฿`} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {aging.map((a, i) => <Cell key={i} fill={a.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Debt/Recv/Stock Projection Table */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h2 className="text-base font-semibold text-white mb-4">แนวโน้มหนี้สิน ลูกหนี้ สต๊อก</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400">
                  <th className="text-left py-1.5 font-semibold">เดือน</th>
                  <th className="text-right py-1.5 font-semibold">หนี้คงค้าง</th>
                  <th className="text-right py-1.5 font-semibold">ลูกหนี้</th>
                  <th className="text-right py-1.5 font-semibold">สต๊อก</th>
                </tr>
              </thead>
              <tbody>
                {projections.map((m, i) => (
                  <tr key={m.month} className={`border-t border-slate-700/20 ${i % 2 === 1 ? 'bg-slate-800/30' : ''}`}>
                    <td className="py-1.5 text-slate-300">{m.label}</td>
                    <td className="py-1.5 text-right font-mono text-amber-400">{fmt(m.debt)}</td>
                    <td className="py-1.5 text-right font-mono text-sky-400">{fmt(m.recv)}</td>
                    <td className="py-1.5 text-right font-mono text-violet-400">{fmt(m.stock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
