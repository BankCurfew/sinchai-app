import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Company } from '../types'

interface CompanyCtx {
  companies: Company[]
  selectedId: number | null // null = all companies
  setSelectedId: (id: number | null) => void
  selectedName: string
}

const CompanyContext = createContext<CompanyCtx>({
  companies: [],
  selectedId: null,
  setSelectedId: () => {},
  selectedName: 'ทุกบริษัท',
})

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('sinchai_companies').select('*').order('name').then(({ data }) => {
      setCompanies(data || [])
    })
  }, [])

  const selectedName = selectedId
    ? companies.find(c => c.id === selectedId)?.name || ''
    : 'ทุกบริษัท'

  return (
    <CompanyContext.Provider value={{ companies, selectedId, setSelectedId, selectedName }}>
      {children}
    </CompanyContext.Provider>
  )
}

export const useCompany = () => useContext(CompanyContext)
