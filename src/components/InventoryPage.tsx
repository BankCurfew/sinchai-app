import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { InventoryEntry } from '../types'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import KPICard from './shared/KPICard'
import BroughtForwardBar from './shared/BroughtForwardBar'
import StatusBadge from './shared/StatusBadge'
import SlideOutForm from './shared/SlideOutForm'
import FormField, { inputClass, selectClass } from './shared/FormField'

const emptyForm: InventoryEntry = { date: format(new Date(), 'yyyy-MM-dd'), type: 'in', item: '', quantity: 0, unit_price: 0 }

export default function InventoryPage() {
  const [entries, setEntries] = useState<InventoryEntry[]>([])
  const [form, setForm] = useState<InventoryEntry>({ ...emptyForm })
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [openingBalance, setOpeningBalance] = useState(0)
  const [obDate, setObDate] = useState('')

  const fetchAll = async () => {
    const [{ data }, { data: ob }] = await Promise.all([
      supabase.from('sinchai_inventory').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(200),
      supabase.from('sinchai_opening_balances').select('*').eq('module', 'inventory').single(),
    ])
    setEntries(data || [])
    if (ob) { setOpeningBalance(Number(ob.amount)); setObDate(ob.as_of_date) }
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { date: form.date, type: form.type, item: form.item, quantity: form.quantity, unit_price: form.unit_price }
    if (editId) { await supabase.from('sinchai_inventory').update(payload).eq('id', editId); setEditId(null) }
    else { await supabase.from('sinchai_inventory').insert(payload) }
    setForm({ ...emptyForm }); setFormOpen(false); fetchAll()
  }
  const handleEdit = (entry: InventoryEntry) => { setForm(entry); setEditId(entry.id!); setFormOpen(true) }
  const handleDelete = async (id: number) => { if (!confirm('ลบรายการนี้?')) return; await supabase.from('sinchai_inventory').delete().eq('id', id); fetchAll() }

  const stockSummary = useMemo(() => {
    const s: Record<string, { qty: number; value: number }> = {}
    for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
      if (!s[e.item]) s[e.item] = { qty: 0, value: 0 }
      const v = Number(e.quantity) * Number(e.unit_price)
      if (e.type === 'in') { s[e.item].qty += Number(e.quantity); s[e.item].value += v }
      else { s[e.item].qty -= Number(e.quantity); s[e.item].value -= v }
    }
    return s
  }, [entries])

  const totalStockValue = Object.values(stockSummary).reduce((s, v) => s + Math.max(0, v.value), 0)
  const currentStock = openingBalance + totalStockValue
  const fmt = (n: number) => n.toLocaleString('th-TH')

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">สต๊อกสินค้า</h1><p className="text-xs text-slate-400 mt-1">จัดการสินค้าคงคลังและติดตามการเคลื่อนไหว</p></div>

      <BroughtForwardBar date={obDate ? format(new Date(obDate), 'd MMM yyyy', { locale: th }) : '-'} items={[
        { label: 'มูลค่าสต๊อกยกมา', value: `${fmt(openingBalance)} ฿` },
        { label: 'จำนวนรายการ', value: `${Object.keys(stockSummary).length} รายการ` },
      ]} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard label="มูลค่าสต๊อกปัจจุบัน" value={`${fmt(currentStock)} ฿`} variant="stock" />
        <KPICard label="จำนวนรายการสินค้า" value={`${Object.keys(stockSummary).length} รายการ`} variant="balance" />
      </div>

      {/* Stock Summary Cards */}
      {Object.keys(stockSummary).length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h2 className="text-base font-semibold text-white mb-4">ยอดคงเหลือสต๊อก</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(stockSummary).map(([item, data]) => (
              <div key={item} className={`border rounded-lg p-3 ${data.qty <= 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-700/30 border-slate-700'}`}>
                <p className="font-medium text-white text-sm">{item}</p>
                <div className="flex justify-between mt-1 text-xs">
                  <span className={data.qty <= 0 ? 'text-rose-400 font-medium' : 'text-slate-400'}>คงเหลือ: {fmt(data.qty)}</span>
                  <span className="text-slate-500">มูลค่า: {fmt(Math.max(0, data.value))} ฿</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => { setEditId(null); setForm({ ...emptyForm }); setFormOpen(true) }}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-all hover:shadow-lg hover:shadow-sky-500/30">
        + เพิ่มรายการ
      </button>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-700/50">
              {['วันที่', 'ประเภท', 'สินค้า', 'จำนวน', 'ราคา/หน่วย', 'มูลค่า', 'จัดการ'].map((h, i) => (
                <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 whitespace-nowrap ${[3,4,5].includes(i) ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">กำลังโหลด...</td></tr>
              : entries.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">ยังไม่มีรายการ</td></tr>
              : entries.map((e, i) => (
                <tr key={e.id} className={`border-b border-slate-700/30 hover:bg-sky-500/5 ${i % 2 === 1 ? 'bg-slate-800/30' : ''}`}>
                  <td className="px-4 py-2.5 text-slate-300">{e.date}</td>
                  <td className="px-4 py-2.5"><StatusBadge variant={e.type === 'in' ? 'success' : 'danger'}>{e.type === 'in' ? 'สั่งเข้า' : 'ขายออก'}</StatusBadge></td>
                  <td className="px-4 py-2.5 text-white font-medium">{e.item}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">{fmt(Number(e.quantity))}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">{fmt(Number(e.unit_price))}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-white">{fmt(Number(e.quantity) * Number(e.unit_price))}</td>
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

      <SlideOutForm open={formOpen} onClose={() => { setFormOpen(false); setEditId(null) }} title={editId ? 'แก้ไขรายการ' : 'เพิ่มรายการสต๊อก'} onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="วันที่"><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputClass} required /></FormField>
          <FormField label="ประเภท">
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'in' | 'out' })} className={selectClass}>
              <option value="in">สั่งเข้า</option><option value="out">ขายออก</option>
            </select>
          </FormField>
        </div>
        <FormField label="ชื่อสินค้า"><input type="text" value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} placeholder="ชื่อสินค้า" className={inputClass} required /></FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="จำนวน"><input type="number" min="0.01" step="0.01" value={form.quantity || ''} placeholder="0" onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} className={`${inputClass} font-mono`} required /></FormField>
          <FormField label="ราคาต่อหน่วย (฿)"><input type="number" min="0" step="0.01" value={form.unit_price || ''} placeholder="0.00" onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })} className={`${inputClass} font-mono`} required /></FormField>
        </div>
      </SlideOutForm>
    </div>
  )
}
