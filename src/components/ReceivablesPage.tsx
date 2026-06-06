import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Receivable } from '../types'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import KPICard from './shared/KPICard'
import BroughtForwardBar from './shared/BroughtForwardBar'
import StatusBadge from './shared/StatusBadge'
import SlideOutForm from './shared/SlideOutForm'
import FormField, { inputClass, selectClass } from './shared/FormField'
import { useCompany } from '../lib/company'
import CompanyFormField from './shared/CompanyFormField'

const emptyForm: Receivable = { debtor_name: '', amount: 0, due_date: format(new Date(), 'yyyy-MM-dd'), status: 'pending', expected_date: null, notes: '' }
const statusMap: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'info' }> = {
  pending: { label: 'รอรับ', variant: 'warning' }, received: { label: 'รับแล้ว', variant: 'success' }, overdue: { label: 'เลยกำหนด', variant: 'danger' }, partial: { label: 'รับบางส่วน', variant: 'info' },
}

export default function ReceivablesPage() {
  const { selectedId } = useCompany()
  const [entries, setEntries] = useState<Receivable[]>([])
  const [form, setForm] = useState<Receivable>({ ...emptyForm })
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [openingBalance, setOpeningBalance] = useState(0)
  const [obDate, setObDate] = useState('')
  const [formCompanyId, setFormCompanyId] = useState<number | null>(selectedId)

  const fetchAll = async () => {
    let q = supabase.from('sinchai_receivables').select('*').order('due_date').limit(100)
    if (selectedId) q = q.eq('company_id', selectedId)
    const [{ data }, { data: ob }] = await Promise.all([
      q,
      supabase.from('sinchai_opening_balances').select('*').eq('module', 'receivables').single(),
    ])
    setEntries(data || [])
    if (ob) { setOpeningBalance(Number(ob.amount)); setObDate(ob.as_of_date) }
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [selectedId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { debtor_name: form.debtor_name, amount: form.amount, due_date: form.due_date, status: form.status, expected_date: form.expected_date || null, notes: form.notes, company_id: formCompanyId }
    if (editId) { await supabase.from('sinchai_receivables').update(payload).eq('id', editId); setEditId(null) }
    else { await supabase.from('sinchai_receivables').insert(payload) }
    setForm({ ...emptyForm }); setFormOpen(false); fetchAll()
  }
  const handleEdit = (entry: Receivable) => { setForm(entry); setEditId(entry.id!); setFormOpen(true) }
  const handleDelete = async (id: number) => { if (!confirm('ลบรายการนี้?')) return; await supabase.from('sinchai_receivables').delete().eq('id', id); fetchAll() }

  const totalPending = entries.filter(e => e.status !== 'received').reduce((s, e) => s + Number(e.amount), 0)
  const totalReceived = entries.filter(e => e.status === 'received').reduce((s, e) => s + Number(e.amount), 0)
  const totalOverdue = entries.filter(e => e.status === 'overdue').reduce((s, e) => s + Number(e.amount), 0)
  const fmt = (n: number) => n.toLocaleString('th-TH')

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">ลูกหนี้</h1><p className="text-xs text-slate-400 mt-1">ติดตามยอดค้างรับและกำหนดชำระ</p></div>

      <BroughtForwardBar date={obDate ? format(new Date(obDate), 'd MMM yyyy', { locale: th }) : '-'} items={[
        { label: 'ลูกหนี้ยกมา', value: `${fmt(openingBalance)} ฿` },
        { label: 'ค้างรับ', value: `${fmt(totalPending)} ฿`, color: 'default' },
        { label: 'เลยกำหนด', value: `${fmt(totalOverdue)} ฿`, color: 'negative' },
      ]} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard label="ยอดค้างรับ" value={`${fmt(openingBalance + totalPending)} ฿`} variant="debt" />
        <KPICard label="รับแล้ว" value={`${fmt(totalReceived)} ฿`} variant="income" />
        <KPICard label="เลยกำหนด" value={`${fmt(totalOverdue)} ฿`} variant="expense" />
      </div>

      <button onClick={() => { setEditId(null); setForm({ ...emptyForm }); setFormCompanyId(selectedId); setFormOpen(true) }}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-all hover:shadow-lg hover:shadow-sky-500/30">
        + เพิ่มลูกหนี้
      </button>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-700/50">
              {['ชื่อลูกหนี้', 'จำนวน (฿)', 'วันครบกำหนด', 'สถานะ', 'คาดว่าจะได้รับ', 'หมายเหตุ', 'จัดการ'].map((h, i) => (
                <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 whitespace-nowrap ${i === 1 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">กำลังโหลด...</td></tr>
              : entries.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">ยังไม่มีรายการ</td></tr>
              : entries.map((e, i) => (
                <tr key={e.id} className={`border-b border-slate-700/30 hover:bg-sky-500/5 ${i % 2 === 1 ? 'bg-slate-800/30' : ''}`}>
                  <td className="px-4 py-2.5 text-white font-medium">{e.debtor_name}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-300">{fmt(Number(e.amount))}</td>
                  <td className="px-4 py-2.5 text-slate-300">{e.due_date}</td>
                  <td className="px-4 py-2.5"><StatusBadge variant={statusMap[e.status].variant}>{statusMap[e.status].label}</StatusBadge></td>
                  <td className="px-4 py-2.5 text-slate-400">{e.expected_date || '-'}</td>
                  <td className="px-4 py-2.5 text-slate-400">{e.notes || '-'}</td>
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

      <SlideOutForm open={formOpen} onClose={() => { setFormOpen(false); setEditId(null) }} title={editId ? 'แก้ไขรายการ' : 'เพิ่มลูกหนี้'} onSubmit={handleSubmit}>
        <CompanyFormField value={formCompanyId} onChange={setFormCompanyId} />
        <FormField label="ชื่อลูกหนี้"><input type="text" value={form.debtor_name} onChange={e => setForm({ ...form, debtor_name: e.target.value })} placeholder="ชื่อบริษัท/บุคคล" className={inputClass} required /></FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="จำนวนเงิน (฿)"><input type="number" min="0.01" step="0.01" value={form.amount || ''} placeholder="0.00" onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className={`${inputClass} font-mono`} required /></FormField>
          <FormField label="วันครบกำหนด"><input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className={inputClass} required /></FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="สถานะ">
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Receivable['status'] })} className={selectClass}>
              <option value="pending">รอรับ</option><option value="received">รับแล้ว</option><option value="overdue">เลยกำหนด</option><option value="partial">รับบางส่วน</option>
            </select>
          </FormField>
          <FormField label="คาดว่าจะได้รับ"><input type="date" value={form.expected_date || ''} onChange={e => setForm({ ...form, expected_date: e.target.value || null })} className={inputClass} /></FormField>
        </div>
        <FormField label="หมายเหตุ"><input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="หมายเหตุ..." className={inputClass} /></FormField>
      </SlideOutForm>
    </div>
  )
}
