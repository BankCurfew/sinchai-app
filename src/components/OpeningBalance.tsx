import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  module: 'cash_flow' | 'loans' | 'receivables' | 'inventory'
  label: string
  onBalanceChange?: (amount: number, asOfDate: string) => void
}

export default function OpeningBalance({ module, label, onBalanceChange }: Props) {
  const [amount, setAmount] = useState(0)
  const [asOfDate, setAsOfDate] = useState('')
  const [editing, setEditing] = useState(false)
  const [tempAmount, setTempAmount] = useState(0)
  const [tempDate, setTempDate] = useState('')

  useEffect(() => {
    supabase
      .from('sinchai_opening_balances')
      .select('*')
      .eq('module', module)
      .single()
      .then(({ data }) => {
        if (data) {
          setAmount(Number(data.amount))
          setAsOfDate(data.as_of_date)
          onBalanceChange?.(Number(data.amount), data.as_of_date)
        }
      })
  }, [module])

  const handleSave = async () => {
    await supabase
      .from('sinchai_opening_balances')
      .update({ amount: tempAmount, as_of_date: tempDate, updated_at: new Date().toISOString() })
      .eq('module', module)
    setAmount(tempAmount)
    setAsOfDate(tempDate)
    setEditing(false)
    onBalanceChange?.(tempAmount, tempDate)
  }

  const startEdit = () => {
    setTempAmount(amount)
    setTempDate(asOfDate)
    setEditing(true)
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[200px]">
        <p className="text-sm text-amber-700 font-medium">{label}</p>
        {!editing ? (
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-amber-800">{amount.toLocaleString('th-TH')} ฿</p>
            {asOfDate && <span className="text-xs text-amber-600">ณ วันที่ {asOfDate}</span>}
          </div>
        ) : (
          <div className="flex gap-2 mt-1">
            <input
              type="number"
              step="0.01"
              value={tempAmount || ''}
              onChange={e => setTempAmount(parseFloat(e.target.value) || 0)}
              className="border rounded-lg px-3 py-1.5 w-40 text-sm"
              placeholder="จำนวนเงิน"
            />
            <input
              type="date"
              value={tempDate}
              onChange={e => setTempDate(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
        )}
      </div>
      <div>
        {!editing ? (
          <button onClick={startEdit} className="text-sm text-amber-700 hover:text-amber-900 underline">แก้ไขยอดยกมา</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleSave} className="bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-amber-700">บันทึก</button>
            <button onClick={() => setEditing(false)} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-300">ยกเลิก</button>
          </div>
        )}
      </div>
    </div>
  )
}
