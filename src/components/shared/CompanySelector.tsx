import { useCompany } from '../../lib/company'

export default function CompanySelector() {
  const { companies, selectedId, setSelectedId } = useCompany()

  if (companies.length === 0) return null

  return (
    <select
      value={selectedId ?? ''}
      onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
      className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm cursor-pointer focus:outline-none focus:border-sky-500"
    >
      <option value="">ทุกบริษัท (รวม)</option>
      {companies.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
