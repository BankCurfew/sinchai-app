import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CashFlow } from '../types'
import { format } from 'date-fns'
import OpeningBalance from './OpeningBalance'

const emptyForm: CashFlow = {
  date: format(new Date(), 'yyyy-MM-dd'),
  type: 'in',
  amount: 0,
  description: '',
  category: '',
}

export default function CashFlowPage() {
  const [entries, setEntries] = useState<CashFlow[]>([])
  const [form, setForm] = useState<CashFlow>({ ...emptyForm })
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [openingBalance, setOpeningBalance] = useState(0)
  const [categories, setCategories] = useState<{ in: string[]; out: string[] }>({ in: [], out: [] })
  const [newCategory, setNewCategory] = useState('')
  const [showAddCategory, setShowAddCategory] = useState(false)

  const fetchCategories = async () => {
    const { data } = await supabase.from('sinchai_categories').select('*').order('name')
    const cats: { in: string[]; out: string[] } = { in: [], out: [] }
    for (const c of (data || [])) {
      cats[c.type as 'in' | 'out'].push(c.name)
    }
    setCategories(cats)
  }

  const fetchEntries = async () => {
    const { data } = await supabase
      .from('sinchai_cash_flow')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)
    setEntries(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchCategories()
    fetchEntries()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      date: form.date,
      type: form.type,
      amount: form.amount,
      description: form.description,
      category: form.category,
    }

    if (editId) {
      await supabase.from('sinchai_cash_flow').update(payload).eq('id', editId)
      setEditId(null)
    } else {
      await supabase.from('sinchai_cash_flow').insert(payload)
    }
    setForm({ ...emptyForm })
    fetchEntries()
  }

  const handleEdit = (entry: CashFlow) => {
    setForm(entry)
    setEditId(entry.id!)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('ลบรายการนี้?')) return
    await supabase.from('sinchai_cash_flow').delete().eq('id', id)
    fetchEntries()
  }

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return
    await supabase.from('sinchai_categories').insert({ type: form.type, name: newCategory.trim() })
    setForm({ ...form, category: newCategory.trim() })
    setNewCategory('')
    setShowAddCategory(false)
    fetchCategories()
  }

  const currentCategories = categories[form.type] || []
  const totalIn = entries.reduce((s, e) => s + (e.type === 'in' ? Number(e.amount) : 0), 0)
  const totalOut = entries.reduce((s, e) => s + (e.type === 'out' ? Number(e.amount) : 0), 0)
  const currentBalance = openingBalance + totalIn - totalOut

  return (
    <div className="space-y-6">
      {/* Opening Balance */}
      <OpeningBalance module="cash_flow" label="ยอดเงินสดยกมา" onBalanceChange={(amt) => setOpeningBalance(amt)} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-600 font-medium">ยอดยกมา</p>
          <p className="text-2xl font-bold text-amber-700">{openingBalance.toLocaleString('th-TH')} ฿</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-600 font-medium">รายรับรวม</p>
          <p className="text-2xl font-bold text-green-700">{totalIn.toLocaleString('th-TH')} ฿</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">รายจ่ายรวม</p>
          <p className="text-2xl font-bold text-red-700">{totalOut.toLocaleString('th-TH')} ฿</p>
        </div>
        <div className={`border rounded-xl p-4 ${currentBalance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className="text-sm font-medium text-gray-600">ยอดคงเหลือปัจจุบัน</p>
          <p className={`text-2xl font-bold ${currentBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            {currentBalance.toLocaleString('th-TH')} ฿
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">{editId ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
            <select value={form.type} onChange={e => { setForm({ ...form, type: e.target.value as 'in' | 'out', category: '' }); setShowAddCategory(false) }}
              className="w-full border rounded-lg px-3 py-2">
              <option value="in">เงินเข้า</option>
              <option value="out">เงินออก</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน (฿)</label>
            <input type="number" min="0.01" step="0.01" value={form.amount || ''} placeholder="0.00"
              onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded-lg px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
            {!showAddCategory ? (
              <div className="flex gap-2">
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="flex-1 border rounded-lg px-3 py-2">
                  <option value="">— เลือกหมวดหมู่ —</option>
                  {currentCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button type="button" onClick={() => setShowAddCategory(true)}
                  className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 text-sm whitespace-nowrap">+ เพิ่ม</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)}
                  placeholder="ชื่อหมวดใหม่..." className="flex-1 border rounded-lg px-3 py-2" autoFocus />
                <button type="button" onClick={handleAddCategory}
                  className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 text-sm">เพิ่ม</button>
                <button type="button" onClick={() => { setShowAddCategory(false); setNewCategory('') }}
                  className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm">ยกเลิก</button>
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
            <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="อธิบายรายการ..." className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
            {editId ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
          </button>
          {editId && (
            <button type="button" onClick={() => { setEditId(null); setForm({ ...emptyForm }) }}
              className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300">ยกเลิก</button>
          )}
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">วันที่</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">ประเภท</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">หมวดหมู่</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">รายละเอียด</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">จำนวน (฿)</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">กำลังโหลด...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">ยังไม่มีรายการ</td></tr>
              ) : entries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{entry.date}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      entry.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {entry.type === 'in' ? 'เงินเข้า' : 'เงินออก'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{entry.category}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.description}</td>
                  <td className={`px-4 py-3 text-right font-medium ${entry.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                    {entry.type === 'in' ? '+' : '-'}{Number(entry.amount).toLocaleString('th-TH')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleEdit(entry)} className="text-indigo-600 hover:text-indigo-800 mr-2">แก้ไข</button>
                    <button onClick={() => handleDelete(entry.id!)} className="text-red-500 hover:text-red-700">ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
