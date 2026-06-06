import { useCompany } from '../../lib/company'

export default function MobileCompanyBar() {
  const { companies, selectedId, setSelectedId } = useCompany()

  if (companies.length === 0) return null

  return (
    <div className="md:hidden mb-4">
      <select
        value={selectedId ?? ''}
        onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
        className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-base font-medium cursor-pointer focus:outline-none focus:border-sky-500"
      >
        <option value="">ทุกบริษัท (รวม)</option>
        {companies.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  )
}
