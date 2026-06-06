import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Loan } from '../types'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import KPICard from './shared/KPICard'
import BroughtForwardBar from './shared/BroughtForwardBar'
import StatusBadge from './shared/StatusBadge'
import SlideOutForm from './shared/SlideOutForm'
import FormField, { inputClass, selectClass } from './shared/FormField'

const emptyForm: Loan = { due_date: format(new Date(), 'yyyy-MM-dd'), principal: 0, interest: 0, status: 'pending', description: '' }
const statusMap: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' }> = {
  pending: { label: 'รอชำระ', variant: 'warning' }, paid: { label: 'ชำระแล้ว', variant: 'success' }, overdue: { label: 'เลยกำหนด', variant: 'danger' },
}

export default function LoansPage() {
  const [entries, setEntries] = useState<Loan[]>([])
  const [form, setForm] = useState<Loan>({ ...emptyForm })
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [openingBalance, setOpeningBalance] = useState(0)
  const [obDate, setObDate] = useState('')

  const fetchAll = async () => {
    const [{ data }, { data: ob }] = await Promise.all([
      supabase.from('sinchai_loans').select('*').order('due_date').limit(100),
      supabase.from('sinchai_opening_balances').select('*').eq('module', 'loans').single(),
    ])
    setEntries(data || [])
    if (ob) { setOpeningBalance(Number(ob.amount)); setObDate(ob.as_of_date) }
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { due_date: form.due_date, principal: form.principal, interest: form.interest, status: form.status, description: form.description }
    if (editId) { await supabase.from('sinchai_loans').update(payload).eq('id', editId); setEditId(null) }
    else { await supabase.from('sinchai_loans').insert(payload) }
    setForm({ ...emptyForm }); setFormOpen(false); fetchAll()
  }
  const handleEdit = (entry: Loan) => { setForm(entry); setEditId(entry.id!); setFormOpen(true) }
  const handleDelete = async (id: number) => { if (!confirm('ลบรายการนี้?')) return; await supabase.from('sinchai_loans').delete().eq('id', id); fetchAll() }

  const totalPrincipal = entries.reduce((s, e) => s + Number(e.principal), 0)
  const totalInterest = entries.reduce((s, e) => s + Number(e.interest), 0)
  const remainingDebt = openingBalance + totalPrincipal - entries.filter(e => e.status === 'paid').reduce((s, e) => s + Number(e.principal), 0)
  const fmt = (n: number) => n.toLocaleString('th-TH')

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">เงินกู้</h1><p className="text-xs text-slate-400 mt-1">ตารางผ่อนชำระและติดตามหนี้สิน</p></div>

      <BroughtForwardBar date={obDate ? format(new Date(obDate), 'd MMM yyyy', { locale: th }) : '-'} items={[
        { label: 'หนี้คงค้างยกมา', value: `${fmt(openingBalance)} ฿`, color: 'negative' },
        { label: 'เงินต้นรวม', value: `${fmt(totalPrincipal)} ฿` },
        { label: 'ดอกเบี้ยรวม', value: `${fmt(totalInterest)} ฿` },
      ]} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard label="เงินต้นรวม" value={`${fmt(totalPrincipal)} ฿`} variant="balance" />
        <KPICard label="ดอกเบี้ยรวม" value={`${fmt(totalInterest)} ฿`} variant="stock" />
        <KPICard label="ยอดคงค้างทั้งหมด" value={`${fmt(remainingDebt)} ฿`} variant="expense" />
      </div>

      <button onClick={() => { setEditId(null); setForm({ ...emptyForm }); setFormOpen(true) }}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-all hover:shadow-lg hover:shadow-sky-500/30">
        + เพิ่มรายการผ่อนชำระ
      </button>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-700/50">
              {['วันครบกำหนด', 'เงินต้น', 'ดอกเบี้ย', 'ยอดรวม', 'สถานะ', 'รายละเอียด', 'จัดการ'].map((h, i) => (
                <th key={h} className={`px-4 py-2.5 text-[0.7rem] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 whitespace-nowrap ${[1,2,3].includes(i) ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">กำลังโหลด...</td></tr>
              : entries.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">ยังไม่มีรายการ</td></tr>
              : entries.map((e, i) => (
                <tr key={e.id} className={`border-b border-slate-700/30 hover:bg-sky-500/5 ${i % 2 === 1 ? 'bg-slate-800/30' : ''}`}>
                  <td className="px-4 py-2.5 text-slate-300">{e.due_date}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-300">{fmt(Number(e.principal))}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-violet-400">{fmt(Number(e.interest))}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-white">{fmt(Number(e.total))}</td>
                  <td className="px-4 py-2.5"><StatusBadge variant={statusMap[e.status].variant}>{statusMap[e.status].label}</StatusBadge></td>
                  <td className="px-4 py-2.5 text-slate-400">{e.description}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(e)} className="w-7 h-7 rounded-md border border-slate-700 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white text-xs">✏️</button>
                      <button onClick={() => handleDelete(e.id!)} className="w-7 h-7 rounded-md border border-slate-700 flex items-center justify-center text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 text-xs">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SlideOutForm open={formOpen} onClose={() => { setFormOpen(false); setEditId(null) }} title={editId ? 'แก้ไขรายการ' : 'เพิ่มรายการผ่อนชำระ'} onSubmit={handleSubmit}>
        <FormField label="วันครบกำหนด"><input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className={inputClass} required /></FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="เงินต้น (฿)"><input type="number" min="0" step="0.01" value={form.principal || ''} placeholder="0.00" onChange={e => setForm({ ...form, principal: parseFloat(e.target.value) || 0 })} className={`${inputClass} font-mono`} required /></FormField>
          <FormField label="ดอกเบี้ย (฿)"><input type="number" min="0" step="0.01" value={form.interest || ''} placeholder="0.00" onChange={e => setForm({ ...form, interest: parseFloat(e.target.value) || 0 })} className={`${inputClass} font-mono`} required /></FormField>
        </div>
        <FormField label="สถานะ">
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Loan['status'] })} className={selectClass}>
            <option value="pending">รอชำระ</option><option value="paid">ชำระแล้ว</option><option value="overdue">เลยกำหนด</option>
          </select>
        </FormField>
        <FormField label="รายละเอียด"><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="รายละเอียดการกู้/ผ่อน..." className={inputClass} /></FormField>
      </SlideOutForm>
    </div>
  )
}
