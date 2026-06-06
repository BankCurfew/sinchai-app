import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CashFlow, BankAccount } from '../types'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import KPICard from './shared/KPICard'
import BroughtForwardBar from './shared/BroughtForwardBar'
import StatusBadge from './shared/StatusBadge'
import SlideOutForm from './shared/SlideOutForm'
import FormField, { inputClass, selectClass } from './shared/FormField'
import TypeSelector, { cashFlowOptions } from './shared/TypeSelector'
import CompanyFormField from './shared/CompanyFormField'
import { useCompany } from '../lib/company'

const emptyForm: CashFlow = { date: format(new Date(), 'yyyy-MM-dd'), type: 'in', amount: 0, description: '', category: '', bank_account_id: null }

export default function CashFlowPage() {
  const { selectedId } = useCompany()
  const [entries, setEntries] = useState<CashFlow[]>([])
  const [form, setForm] = useState<CashFlow>({ ...emptyForm })
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [openingBalance, setOpeningBalance] = useState(0)
  const [obDate, setObDate] = useState('')
  const [categories, setCategories] = useState<{ in: string[]; out: string[] }>({ in: [], out: [] })
  const [newCategory, setNewCategory] = useState('')
  const [showAddCat, setShowAddCat] = useState(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [formCompanyId, setFormCompanyId] = useState<number | null>(selectedId)

  const fetchAll = async () => {
    let q = supabase.from('sinchai_cash_flow').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(100)
    if (selectedId) q = q.eq('company_id', selectedId)
    const [{ data: entries }, { data: cats }, { data: ob }, { data: accounts }] = await Promise.all([
      q,
      supabase.from('sinchai_categories').select('*').order('name'),
      supabase.from('sinchai_opening_balances').select('*').eq('module', 'cash_flow').single(),
      supabase.from('sinchai_bank_accounts').select('*').order('name'),
    ])
    setEntries(entries || [])
    const c: { in: string[]; out: string[] } = { in: [], out: [] }
    for (const cat of (cats || [])) c[cat.type as 'in' | 'out'].push(cat.name)
    setCategories(c)
    if (ob) { setOpeningBalance(Number(ob.amount)); setObDate(ob.as_of_date) }
    setBankAccounts(accounts || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [selectedId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { date: form.date, type: form.type, amount: form.amount, description: form.description, category: form.category, bank_account_id: form.bank_account_id || null, company_id: formCompanyId }
    if (editId) { await supabase.from('sinchai_cash_flow').update(payload).eq('id', editId); setEditId(null) }
    else { await supabase.from('sinchai_cash_flow').insert(payload) }
    setForm({ ...emptyForm }); setFormOpen(false); fetchAll()
  }

  const handleEdit = (entry: CashFlow) => { setForm(entry); setEditId(entry.id!); setFormOpen(true) }
  const handleDelete = async (id: number) => { if (!confirm('ลบรายการนี้?')) return; await supabase.from('sinchai_cash_flow').delete().eq('id', id); fetchAll() }
  const handleAddCat = async () => { if (!newCategory.trim()) return; await supabase.from('sinchai_categories').insert({ type: form.type, name: newCategory.trim() }); setForm({ ...form, category: newCategory.trim() }); setNewCategory(''); setShowAddCat(false); fetchAll() }

  const totalIn = entries.reduce((s, e) => s + (e.type === 'in' ? Number(e.amount) : 0), 0)
  const totalOut = entries.reduce((s, e) => s + (e.type === 'out' ? Number(e.amount) : 0), 0)
  const currentBalance = openingBalance + totalIn - totalOut
  const fmt = (n: number) => n.toLocaleString('th-TH')
  const currentCategories = (form.type === 'bf' ? [] : categories[form.type]) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">กระแสเงินสด</h1>
        <p className="text-xs text-slate-400 mt-1">บันทึกรายรับ-รายจ่ายประจำวัน</p>
      </div>

      {/* Brought Forward */}
      <BroughtForwardBar
        date={obDate ? format(new Date(obDate), 'd MMM yyyy', { locale: th }) : '-'}
        items={[
          { label: 'เงินสดยกมา', value: `${fmt(openingBalance)} ฿`, color: 'positive' },
          { label: 'รายรับสะสม', value: `+${fmt(totalIn)} ฿`, color: 'positive' },
          { label: 'รายจ่ายสะสม', value: `-${fmt(totalOut)} ฿`, color: 'negative' },
        ]}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard label="รายรับรวม" value={`${fmt(totalIn)} ฿`} variant="income" />
        <KPICard label="รายจ่ายรวม" value={`${fmt(totalOut)} ฿`} variant="expense" />
        <KPICard label="ยอดคงเหลือ" value={`${fmt(currentBalance)} ฿`} variant="balance" valueColor={currentBalance >= 0 ? 'text-sky-400' : 'text-rose-400'} />
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <button onClick={() => { setEditId(null); setForm({ ...emptyForm }); setFormCompanyId(selectedId); setFormOpen(true) }}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-all hover:shadow-lg hover:shadow-sky-500/30">
          + เพิ่มรายการ
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700/50">
                {['วันที่', 'ประเภท', 'หมวดหมู่', 'รายละเอียด', 'จำนวน (฿)', 'จัดการ'].map((h, i) => (
                  <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 whitespace-nowrap ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">กำลังโหลด...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">ยังไม่มีรายการ — เริ่มบันทึกรายรับรายจ่ายวันนี้</td></tr>
              ) : entries.map((entry, i) => (
                <tr key={entry.id} className={`border-b border-slate-700/30 hover:bg-sky-500/5 transition-colors ${i % 2 === 1 ? 'bg-slate-800/30' : ''}`}>
                  <td className="px-4 py-2.5 text-slate-300">{entry.date}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge variant={entry.type === 'bf' ? 'info' : entry.type === 'in' ? 'success' : 'danger'}>
                      {entry.type === 'bf' ? 'ยกมา' : entry.type === 'in' ? 'เงินเข้า' : 'เงินออก'}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{entry.category}</td>
                  <td className="px-4 py-2.5 text-slate-300">{entry.description}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-medium ${entry.type === 'bf' ? 'text-sky-400' : entry.type === 'in' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {entry.type === 'bf' ? '' : entry.type === 'in' ? '+' : '-'}{fmt(Number(entry.amount))}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(entry)} className="w-7 h-7 rounded-md border border-slate-700 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white text-xs transition-colors">✏️</button>
                      <button onClick={() => handleDelete(entry.id!)} className="w-7 h-7 rounded-md border border-slate-700 flex items-center justify-center text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-400 text-xs transition-colors">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Form */}
      <SlideOutForm open={formOpen} onClose={() => { setFormOpen(false); setEditId(null); setForm({ ...emptyForm }) }} title={editId ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'} onSubmit={handleSubmit} submitLabel={editId ? 'บันทึกการแก้ไข' : 'บันทึกรายการ'}>
        <CompanyFormField value={formCompanyId} onChange={setFormCompanyId} />
        <FormField label="วันที่">
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputClass} required />
        </FormField>
        <FormField label="ประเภท">
          <TypeSelector value={form.type} onChange={v => { setForm({ ...form, type: v as 'in' | 'out', category: '' }); setShowAddCat(false) }} options={cashFlowOptions} />
        </FormField>
        <FormField label="จำนวนเงิน (฿)">
          <input type="number" min="0.01" step="0.01" value={form.amount || ''} placeholder="0.00" onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className={`${inputClass} font-mono`} required />
        </FormField>
        <FormField label="หมวดหมู่">
          {!showAddCat ? (
            <div className="flex gap-2">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={`${selectClass} flex-1`}>
                <option value="">เลือกหมวดหมู่...</option>
                {currentCategories.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="button" onClick={() => setShowAddCat(true)} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 whitespace-nowrap">+ เพิ่ม</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="ชื่อหมวดใหม่..." className={`${inputClass} flex-1`} autoFocus />
              <button type="button" onClick={handleAddCat} className="px-3 py-2 rounded-lg bg-sky-500 text-white text-sm">เพิ่ม</button>
              <button type="button" onClick={() => { setShowAddCat(false); setNewCategory('') }} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">ยกเลิก</button>
            </div>
          )}
        </FormField>
        {bankAccounts.length > 0 && (
          <FormField label="บัญชีธนาคาร">
            <select value={form.bank_account_id ?? ''} onChange={e => setForm({ ...form, bank_account_id: e.target.value ? Number(e.target.value) : null })} className={selectClass}>
              <option value="">— ไม่ระบุบัญชี —</option>
              {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.bank})</option>)}
            </select>
          </FormField>
        )}
        <FormField label="รายละเอียด">
          <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="อธิบายรายการ..." className={inputClass} />
        </FormField>
        <div className="mt-4 p-4 bg-sky-500/[0.08] rounded-lg border border-sky-500/20">
          <p className="text-xs text-sky-400 font-semibold mb-2">💡 Tips</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            เลือกหมวดหมู่ให้ตรงกับประเภทรายจ่าย เพื่อการวิเคราะห์ที่แม่นยำ<br />
            รายละเอียดช่วยให้ค้นหาย้อนหลังได้ง่าย
          </p>
        </div>
      </SlideOutForm>
    </div>
  )
}
