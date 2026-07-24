import { Flag, Lock } from 'lucide-react'

const LAYER_COLORS = {
  web:       'text-layer-web',
  container: 'text-layer-container',
  cloud:     'text-layer-cloud',
}

// One row per CHALLENGE in the module (not per layer) — a layer can hold
// more than one flag, so `flags` may have more than 3 entries.
export function FlagStatusRow({ flags = [] }) {
  return (
    <div className="flex flex-col gap-1.5 px-4 pb-3">
      {flags.map(({ id, label, layer, value }) => (
        <div
          key={id}
          className="flex items-center justify-between px-3 py-2
                     bg-surface-2 rounded-lg border border-border
                     text-sm"
        >
          <div className="flex items-center gap-2">
            {value
              ? <Flag size={14} className={LAYER_COLORS[layer]} />
              : <Lock size={14} className="text-text-3" />
            }
            <span className={value ? LAYER_COLORS[layer] : 'text-text-3'}>
              {label}
            </span>
          </div>
          <span className={`font-mono text-xs ${value ? LAYER_COLORS[layer] : 'text-text-3'}`}>
            {value || (layer === 'web' ? '[in progress]' : '[locked]')}
          </span>
        </div>
      ))}
    </div>
  )
}
