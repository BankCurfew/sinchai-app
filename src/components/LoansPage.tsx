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
import { useCompany } from '../lib/company'
import CompanyFormField from './shared/CompanyFormField'

const emptyForm: Loan = { due_date: format(new Date(), 'yyyy-MM-dd'), principal: 0, interest: 0, interest_rate: 0, loan_type: '', status: 'pending', description: '' }
const statusMap: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' }> = {
  pending: { label: 'รอชำระ', variant: 'warning' }, paid: { label: 'ชำระแล้ว', variant: 'success' }, overdue: { label: 'เลยกำหนด', variant: 'danger' },
}

export default function LoansPage() {
  const { selectedId } = useCompany()
  const [entries, setEntries] = useState<Loan[]>([])
  const [form, setForm] = useState<Loan>({ ...emptyForm })
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [openingBalance, setOpeningBalance] = useState(0)
  const [obDate, setObDate] = useState('')
  const [loanTypes, setLoanTypes] = useState<string[]>([])
  const [newType, setNewType] = useState('')
  const [showAddType, setShowAddType] = useState(false)
  const [interestOverride, setInterestOverride] = useState(false)
  const [formCompanyId, setFormCompanyId] = useState<number | null>(selectedId)

  const fetchAll = async () => {
    let q = supabase.from('sinchai_loans').select('*').order('due_date').limit(100)
    if (selectedId) q = q.eq('company_id', selectedId)
    const [{ data }, { data: ob }, { data: types }] = await Promise.all([
      q,
      supabase.from('sinchai_opening_balances').select('*').eq('module', 'loans').single(),
      supabase.from('sinchai_loan_types').select('*').order('name'),
    ])
    setEntries(data || [])
    if (ob) { setOpeningBalance(Number(ob.amount)); setObDate(ob.as_of_date) }
    setLoanTypes((types || []).map((t: { name: string }) => t.name))
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [selectedId])

  const calcMonthlyInterest = (principal: number, ratePerYear: number) => {
    if (ratePerYear <= 0 || principal <= 0) return 0
    return Math.round((principal * (ratePerYear / 100) / 12) * 100) / 100
  }

  const handlePrincipalOrRateChange = (principal: number, rate: number) => {
    const calculated = calcMonthlyInterest(principal, rate)
    setForm(prev => ({ ...prev, principal, interest_rate: rate, ...(interestOverride ? {} : { interest: calculated }) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { due_date: form.due_date, principal: form.principal, interest: form.interest, interest_rate: form.interest_rate, loan_type: form.loan_type, status: form.status, description: form.description, company_id: formCompanyId }
    if (editId) { await supabase.from('sinchai_loans').update(payload).eq('id', editId); setEditId(null) }
    else { await supabase.from('sinchai_loans').insert(payload) }
    setForm({ ...emptyForm }); setFormOpen(false); setInterestOverride(false); fetchAll()
  }
  const handleEdit = (entry: Loan) => { setForm(entry); setEditId(entry.id!); setFormOpen(true); setInterestOverride(false) }
  const handleDelete = async (id: number) => { if (!confirm('ลบรายการนี้?')) return; await supabase.from('sinchai_loans').delete().eq('id', id); fetchAll() }
  const handleAddType = async () => { if (!newType.trim()) return; await supabase.from('sinchai_loan_types').insert({ name: newType.trim() }); setForm({ ...form, loan_type: newType.trim() }); setNewType(''); setShowAddType(false); fetchAll() }

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

      <button onClick={() => { setEditId(null); setForm({ ...emptyForm }); setFormCompanyId(selectedId); setFormOpen(true); setInterestOverride(false) }}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-all hover:shadow-lg hover:shadow-sky-500/30">
        + เพิ่มรายการผ่อนชำระ
      </button>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-700/50">
              {['วันครบกำหนด', 'ประเภท', 'เงินต้น', 'ดอกเบี้ย (%)', 'ดอกเบี้ย (฿)', 'ยอดรวม', 'สถานะ', 'รายละเอียด', 'จัดการ'].map((h, i) => (
                <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 whitespace-nowrap ${[2,3,4,5].includes(i) ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">กำลังโหลด...</td></tr>
              : entries.length === 0 ? <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">ยังไม่มีรายการ</td></tr>
              : entries.map((e, i) => (
                <tr key={e.id} className={`border-b border-slate-700/30 hover:bg-sky-500/5 ${i % 2 === 1 ? 'bg-slate-800/30' : ''}`}>
                  <td className="px-4 py-2.5 text-slate-300">{e.due_date}</td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{e.loan_type || '-'}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-300">{fmt(Number(e.principal))}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-violet-400">{Number(e.interest_rate) > 0 ? `${e.interest_rate}%` : '-'}</td>
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

      <SlideOutForm open={formOpen} onClose={() => { setFormOpen(false); setEditId(null); setInterestOverride(false) }} title={editId ? 'แก้ไขรายการ' : 'เพิ่มรายการผ่อนชำระ'} onSubmit={handleSubmit}>
        <CompanyFormField value={formCompanyId} onChange={setFormCompanyId} />
        <FormField label="ประเภทเงินกู้">
          {!showAddType ? (
            <div className="flex gap-2">
              <select value={form.loan_type} onChange={e => setForm({ ...form, loan_type: e.target.value })} className={`${selectClass} flex-1`}>
                <option value="">เลือกประเภท...</option>
                {loanTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button type="button" onClick={() => setShowAddType(true)} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 whitespace-nowrap">+ เพิ่ม</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input type="text" value={newType} onChange={e => setNewType(e.target.value)} placeholder="ชื่อประเภทใหม่..." className={`${inputClass} flex-1`} autoFocus />
              <button type="button" onClick={handleAddType} className="px-3 py-2 rounded-lg bg-sky-500 text-white text-sm">เพิ่ม</button>
              <button type="button" onClick={() => { setShowAddType(false); setNewType('') }} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">ยกเลิก</button>
            </div>
          )}
        </FormField>

        <FormField label="วันครบกำหนด">
          <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className={inputClass} required />
        </FormField>

        <FormField label="เงินต้น (฿)">
          <input type="number" min="0" step="0.01" value={form.principal || ''} placeholder="0.00"
            onChange={e => handlePrincipalOrRateChange(parseFloat(e.target.value) || 0, form.interest_rate)}
            className={`${inputClass} font-mono`} required />
        </FormField>

        <FormField label="อัตราดอกเบี้ย (% ต่อปี)">
          <input type="number" min="0" step="0.001" value={form.interest_rate || ''} placeholder="0.000"
            onChange={e => handlePrincipalOrRateChange(form.principal, parseFloat(e.target.value) || 0)}
            className={`${inputClass} font-mono`} />
        </FormField>

        <FormField label="ดอกเบี้ยรายเดือน (฿)">
          <div className="space-y-2">
            <input type="number" min="0" step="0.01" value={form.interest || ''} placeholder="0.00"
              onChange={e => { setInterestOverride(true); setForm({ ...form, interest: parseFloat(e.target.value) || 0 }) }}
              className={`${inputClass} font-mono`} required />
            {form.interest_rate > 0 && (
              <p className="text-xs text-slate-500">
                คำนวณ: {fmt(form.principal)} x {form.interest_rate}% / 12 = {fmt(calcMonthlyInterest(form.principal, form.interest_rate))} ฿/เดือน
                {interestOverride && <span className="text-amber-400 ml-1">(override)</span>}
                {interestOverride && (
                  <button type="button" onClick={() => { setInterestOverride(false); setForm({ ...form, interest: calcMonthlyInterest(form.principal, form.interest_rate) }) }}
                    className="ml-2 text-sky-400 underline">ใช้ค่าคำนวณ</button>
                )}
              </p>
            )}
          </div>
        </FormField>

        <FormField label="สถานะ">
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Loan['status'] })} className={selectClass}>
            <option value="pending">รอชำระ</option><option value="paid">ชำระแล้ว</option><option value="overdue">เลยกำหนด</option>
          </select>
        </FormField>

        <FormField label="รายละเอียด">
          <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="รายละเอียดการกู้/ผ่อน..." className={inputClass} />
        </FormField>
      </SlideOutForm>
    </div>
  )
}
