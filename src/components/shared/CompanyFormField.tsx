import { useCompany } from '../../lib/company'
import FormField, { selectClass } from './FormField'

interface Props {
  value: number | null | undefined
  onChange: (id: number | null) => void
}

export default function CompanyFormField({ value, onChange }: Props) {
  const { companies } = useCompany()

  if (companies.length === 0) return null

  return (
    <FormField label="บริษัท">
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        className={selectClass}
        required
      >
        <option value="">— เลือกบริษัท —</option>
        {companies.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </FormField>
  )
}
