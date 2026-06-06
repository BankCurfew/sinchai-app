export interface CashFlow {
  id?: number
  date: string
  type: 'in' | 'out' | 'bf'
  amount: number
  description: string
  category: string
  bank_account_id?: number | null
  created_at?: string
}

export interface BankAccount {
  id?: number
  name: string
  account_number: string
  bank: string
  account_type: 'savings' | 'current' | 'fixed'
  balance: number
  created_at?: string
}

export interface Loan {
  id?: number
  due_date: string
  principal: number
  interest: number
  interest_rate: number
  loan_type: string
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
  type: 'in' | 'out' | 'bf'
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
