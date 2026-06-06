import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Receivable } from '../types'
import { format } from 'date-fns'

const emptyForm: Receivable = {
  debtor_name: '',
  amount: 0,
  due_date: format(new Date(), 'yyyy-MM-dd'),
  status: 'pending',
  expected_date: null,
  notes: '',
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'รอรับ', color: 'bg-yellow-100 text-yellow-700' },
  received: { label: 'รับแล้ว', color: 'bg-green-100 text-green-700' },
  overdue: { label: 'เลยกำหนด', color: 'bg-red-100 text-red-700' },
  partial: { label: 'รับบางส่วน', color: 'bg-blue-100 text-blue-700' },
}

export default function ReceivablesPage() {
  const [entries, setEntries] = useState<Receivable[]>([])
  const [form, setForm] = useState<Receivable>({ ...emptyForm })
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)

  const fetchEntries = async () => {
    const { data } = await supabase
      .from('sinchai_receivables')
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
      debtor_name: form.debtor_name,
      amount: form.amount,
      due_date: form.due_date,
      status: form.status,
      expected_date: form.expected_date || null,
      notes: form.notes,
    }

    if (editId) {
      await supabase.from('sinchai_receivables').update(payload).eq('id', editId)
      setEditId(null)
    } else {
      await supabase.from('sinchai_receivables').insert(payload)
    }
    setForm({ ...emptyForm })
    fetchEntries()
  }

  const handleEdit = (entry: Receivable) => {
    setForm(entry)
    setEditId(entry.id!)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('ลบรายการนี้?')) return
    await supabase.from('sinchai_receivables').delete().eq('id', id)
    fetchEntries()
  }

  const totalPending = entries.filter(e => e.status !== 'received').reduce((s, e) => s + Number(e.amount), 0)
  const totalReceived = entries.filter(e => e.status === 'received').reduce((s, e) => s + Number(e.amount), 0)
  const totalOverdue = entries.filter(e => e.status === 'overdue').reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-600 font-medium">ยอดค้างรับ</p>
          <p className="text-2xl font-bold text-yellow-700">{totalPending.toLocaleString('th-TH')} ฿</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-600 font-medium">รับแล้ว</p>
          <p className="text-2xl font-bold text-green-700">{totalReceived.toLocaleString('th-TH')} ฿</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">เลยกำหนด</p>
          <p className="text-2xl font-bold text-red-700">{totalOverdue.toLocaleString('th-TH')} ฿</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">{editId ? 'แก้ไขรายการ' : 'เพิ่มลูกหนี้'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อลูกหนี้</label>
            <input type="text" value={form.debtor_name} onChange={e => setForm({ ...form, debtor_name: e.target.value })}
              placeholder="ชื่อบริษัท/บุคคล" className="w-full border rounded-lg px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน (฿)</label>
            <input type="number" min="0.01" step="0.01" value={form.amount || ''} placeholder="0.00"
              onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded-lg px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วันครบกำหนด</label>
            <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Receivable['status'] })}
              className="w-full border rounded-lg px-3 py-2">
              <option value="pending">รอรับ</option>
              <option value="received">รับแล้ว</option>
              <option value="overdue">เลยกำหนด</option>
              <option value="partial">รับบางส่วน</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่คาดว่าจะได้รับ</label>
            <input type="date" value={form.expected_date || ''} onChange={e => setForm({ ...form, expected_date: e.target.value || null })}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
            <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="หมายเหตุ..." className="w-full border rounded-lg px-3 py-2" />
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
                <th className="px-4 py-3 text-left font-medium text-gray-600">ชื่อลูกหนี้</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">จำนวน (฿)</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">วันครบกำหนด</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">สถานะ</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">คาดว่าจะได้รับ</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">หมายเหตุ</th>
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
                  <td className="px-4 py-3 font-medium">{entry.debtor_name}</td>
                  <td className="px-4 py-3 text-right">{Number(entry.amount).toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3">{entry.due_date}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[entry.status].color}`}>
                      {statusLabels[entry.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{entry.expected_date || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.notes || '-'}</td>
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
