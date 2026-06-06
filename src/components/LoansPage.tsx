import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Loan } from '../types'
import { format } from 'date-fns'
import OpeningBalance from './OpeningBalance'

const emptyForm: Loan = {
  due_date: format(new Date(), 'yyyy-MM-dd'),
  principal: 0,
  interest: 0,
  status: 'pending',
  description: '',
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'รอชำระ', color: 'bg-yellow-100 text-yellow-700' },
  paid: { label: 'ชำระแล้ว', color: 'bg-green-100 text-green-700' },
  overdue: { label: 'เลยกำหนด', color: 'bg-red-100 text-red-700' },
}

export default function LoansPage() {
  const [entries, setEntries] = useState<Loan[]>([])
  const [form, setForm] = useState<Loan>({ ...emptyForm })
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [openingBalance, setOpeningBalance] = useState(0)

  const fetchEntries = async () => {
    const { data } = await supabase
      .from('sinchai_loans')
      .select('*')
      .order('due_date', { ascending: true })
      .limit(100)
    setEntries(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchEntries() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      due_date: form.due_date,
      principal: form.principal,
      interest: form.interest,
      status: form.status,
      description: form.description,
    }

    if (editId) {
      await supabase.from('sinchai_loans').update(payload).eq('id', editId)
      setEditId(null)
    } else {
      await supabase.from('sinchai_loans').insert(payload)
    }
    setForm({ ...emptyForm })
    fetchEntries()
  }

  const handleEdit = (entry: Loan) => {
    setForm(entry)
    setEditId(entry.id!)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('ลบรายการนี้?')) return
    await supabase.from('sinchai_loans').delete().eq('id', id)
    fetchEntries()
  }

  const totalPrincipal = entries.reduce((s, e) => s + Number(e.principal), 0)
  const totalInterest = entries.reduce((s, e) => s + Number(e.interest), 0)
  const remainingDebt = openingBalance + totalPrincipal - entries.filter(e => e.status === 'paid').reduce((s, e) => s + Number(e.principal), 0)

  return (
    <div className="space-y-6">
      <OpeningBalance module="loans" label="ยอดเงินต้นคงค้างยกมา" onBalanceChange={(amt) => setOpeningBalance(amt)} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-600 font-medium">ยอดยกมา</p>
          <p className="text-2xl font-bold text-amber-700">{openingBalance.toLocaleString('th-TH')} ฿</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-600 font-medium">เงินต้นรวม</p>
          <p className="text-2xl font-bold text-blue-700">{totalPrincipal.toLocaleString('th-TH')} ฿</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-sm text-purple-600 font-medium">ดอกเบี้ยรวม</p>
          <p className="text-2xl font-bold text-purple-700">{totalInterest.toLocaleString('th-TH')} ฿</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm text-orange-600 font-medium">ยอดคงค้างทั้งหมด</p>
          <p className="text-2xl font-bold text-orange-700">{remainingDebt.toLocaleString('th-TH')} ฿</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">{editId ? 'แก้ไขรายการ' : 'เพิ่มรายการผ่อนชำระ'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วันครบกำหนด</label>
            <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เงินต้น (฿)</label>
            <input type="number" min="0" step="0.01" value={form.principal || ''} placeholder="0.00"
              onChange={e => setForm({ ...form, principal: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded-lg px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ดอกเบี้ย (฿)</label>
            <input type="number" min="0" step="0.01" value={form.interest || ''} placeholder="0.00"
              onChange={e => setForm({ ...form, interest: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded-lg px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Loan['status'] })}
              className="w-full border rounded-lg px-3 py-2">
              <option value="pending">รอชำระ</option>
              <option value="paid">ชำระแล้ว</option>
              <option value="overdue">เลยกำหนด</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
            <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="รายละเอียดการกู้/ผ่อน..." className="w-full border rounded-lg px-3 py-2" />
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

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">วันครบกำหนด</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">เงินต้น</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">ดอกเบี้ย</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">ยอดรวม</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">สถานะ</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">รายละเอียด</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">กำลังโหลด...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">ยังไม่มีรายการ</td></tr>
              ) : entries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{entry.due_date}</td>
                  <td className="px-4 py-3 text-right">{Number(entry.principal).toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3 text-right">{Number(entry.interest).toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3 text-right font-medium">{Number(entry.total).toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[entry.status].color}`}>
                      {statusLabels[entry.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{entry.description}</td>
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
