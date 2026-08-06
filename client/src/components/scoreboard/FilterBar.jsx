const FILTERS = [
  { id: 'all',           label: 'All'            },
  { id: 'participant',   label: 'MSc students'   },
  { id: 'practitioner',  label: 'Practitioners'  },
]

export function FilterBar({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-lg
                    border border-border">
      {FILTERS.map(f => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          className={`px-3 py-1.5 rounded-md text-sm transition-colors
                      ${value === f.id
                        ? 'bg-accent text-white font-medium'
                        : 'text-text-2 hover:text-text-1 hover:bg-surface'
                      }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
