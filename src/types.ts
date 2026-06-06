export interface CashFlow {
  id?: number
  date: string
  type: 'in' | 'out'
  amount: number
  description: string
  category: string
  created_at?: string
}

export interface Loan {
  id?: number
  due_date: string
  principal: number
  interest: number
  total?: number
  status: 'pending' | 'paid' | 'overdue'
  description: string
  created_at?: string
}

export interface Receivable {
  id?: number
  debtor_name: string
  amount: number
  due_date: string
  status: 'pending' | 'received' | 'overdue' | 'partial'
  expected_date: string | null
  notes: string
  created_at?: string
}

export interface InventoryEntry {
  id?: number
  date: string
  type: 'in' | 'out'
  item: string
  quantity: number
  unit_price: number
  created_at?: string
}

export interface MonthlySummary {
  id?: number
  month: string
  total_in: number
  total_out: number
  ending_balance: number
  stock_value: number
}

export type Tab = 'dashboard' | 'cashflow' | 'loans' | 'receivables' | 'inventory'
