import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { InventoryEntry } from '../types'
import { format } from 'date-fns'
import OpeningBalance from './OpeningBalance'

const emptyForm: InventoryEntry = {
  date: format(new Date(), 'yyyy-MM-dd'),
  type: 'in',
  item: '',
  quantity: 0,
  unit_price: 0,
}

export default function InventoryPage() {
  const [entries, setEntries] = useState<InventoryEntry[]>([])
  const [form, setForm] = useState<InventoryEntry>({ ...emptyForm })
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [openingBalance, setOpeningBalance] = useState(0)

  const fetchEntries = async () => {
    const { data } = await supabase
      .from('sinchai_inventory')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)
    setEntries(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchEntries() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      date: form.date,
      type: form.type,
      item: form.item,
      quantity: form.quantity,
      unit_price: form.unit_price,
    }

    if (editId) {
      await supabase.from('sinchai_inventory').update(payload).eq('id', editId)
      setEditId(null)
    } else {
      await supabase.from('sinchai_inventory').insert(payload)
    }
    setForm({ ...emptyForm })
    fetchEntries()
  }

  const handleEdit = (entry: InventoryEntry) => {
    setForm(entry)
    setEditId(entry.id!)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('ลบรายการนี้?')) return
    await supabase.from('sinchai_inventory').delete().eq('id', id)
    fetchEntries()
  }

  // Calculate stock balance per item
  const stockSummary = useMemo(() => {
    const summary: Record<string, { qty: number; value: number; lastPrice: number }> = {}
    // Process in chronological order for balance
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
    for (const e of sorted) {
      if (!summary[e.item]) summary[e.item] = { qty: 0, value: 0, lastPrice: 0 }
      const s = summary[e.item]
      if (e.type === 'in') {
        s.qty += Number(e.quantity)
        s.value += Number(e.quantity) * Number(e.unit_price)
      } else {
        s.qty -= Number(e.quantity)
        s.value -= Number(e.quantity) * Number(e.unit_price)
      }
      s.lastPrice = Number(e.unit_price)
    }
    return summary
  }, [entries])

  const totalStockValue = Object.values(stockSummary).reduce((s, v) => s + Math.max(0, v.value), 0)

  const currentStockValue = openingBalance + totalStockValue

  return (
    <div className="space-y-6">
      <OpeningBalance module="inventory" label="มูลค่าสต๊อกยกมา" onBalanceChange={(amt) => setOpeningBalance(amt)} />

      {/* Stock Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-600 font-medium">ยอดยกมา</p>
          <p className="text-2xl font-bold text-amber-700">{openingBalance.toLocaleString('th-TH')} ฿</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="text-sm text-indigo-600 font-medium">มูลค่าสต๊อกปัจจุบัน</p>
          <p className="text-2xl font-bold text-indigo-700">{currentStockValue.toLocaleString('th-TH')} ฿</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-600 font-medium">จำนวนรายการสินค้า</p>
          <p className="text-2xl font-bold text-gray-700">{Object.keys(stockSummary).length} รายการ</p>
        </div>
      </div>

      {/* Current Stock Balance */}
      {Object.keys(stockSummary).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">ยอดคงเหลือสต๊อก</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(stockSummary).map(([item, data]) => (
              <div key={item} className={`border rounded-lg p-3 ${data.qty <= 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                <p className="font-medium text-gray-800">{item}</p>
                <div className="flex justify-between mt-1 text-sm">
                  <span className={data.qty <= 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                    คงเหลือ: {data.qty.toLocaleString('th-TH')}
                  </span>
                  <span className="text-gray-500">
                    มูลค่า: {Math.max(0, data.value).toLocaleString('th-TH')} ฿
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">{editId ? 'แก้ไขรายการ' : 'เพิ่มรายการสต๊อก'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'in' | 'out' })}
              className="w-full border rounded-lg px-3 py-2">
              <option value="in">สั่งเข้า</option>
              <option value="out">ขายออก</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสินค้า</label>
            <input type="text" value={form.item} onChange={e => setForm({ ...form, item: e.target.value })}
              placeholder="ชื่อสินค้า" className="w-full border rounded-lg px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวน</label>
            <input type="number" min="0.01" step="0.01" value={form.quantity || ''} placeholder="0"
              onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded-lg px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ราคาต่อหน่วย (฿)</label>
            <input type="number" min="0" step="0.01" value={form.unit_price || ''} placeholder="0.00"
              onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded-lg px-3 py-2" required />
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

      {/* Transaction Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">วันที่</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">ประเภท</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">สินค้า</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">จำนวน</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">ราคา/หน่วย</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">มูลค่า</th>
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
                  <td className="px-4 py-3">{entry.date}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      entry.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {entry.type === 'in' ? 'สั่งเข้า' : 'ขายออก'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{entry.item}</td>
                  <td className="px-4 py-3 text-right">{Number(entry.quantity).toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3 text-right">{Number(entry.unit_price).toLocaleString('th-TH')}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {(Number(entry.quantity) * Number(entry.unit_price)).toLocaleString('th-TH')}
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
