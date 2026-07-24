import { Check } from 'lucide-react'

const STAGES = [
  { label: 'Web layer', sub: 'Flag 1',    color: '#388BFD' },
  { label: 'Container', sub: 'Flag 2',    color: '#2EA043' },
  { label: 'Cloud',     sub: 'Flag 3',    color: '#D29922' },
]

export function StagesStepper({ stage = 0 }) {
  return (
    <div className="flex items-center gap-1">
      {STAGES.map((s, i) => {
        const done    = stage > i
        const current = stage === i
        const locked  = stage < i

        return (
          <div key={i} className="flex items-center">
            {/* Stage indicator */}
            <div className="flex items-center gap-1.5">
              {/* Circle */}
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center
                           flex-shrink-0 border transition-all duration-300"
                style={{
                  borderColor: locked ? '#484F58' : s.color,
                  background:  done    ? s.color
                             : current ? 'transparent'
                             : 'transparent',
                }}
              >
                {done
                  ? <Check size={11} className="text-white" strokeWidth={3} />
                  : <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: current ? s.color : '#484F58' }}
                    />
                }
              </div>

              {/* Label */}
              <div className="hidden sm:block">
                <p
                  className="text-xs font-medium leading-none"
                  style={{ color: locked ? '#484F58' : s.color }}
                >
                  {s.label}
                </p>
                <p className="text-[10px] text-text-3 leading-none mt-0.5">
                  {s.sub}
                </p>
              </div>
            </div>

            {/* Connector arrow */}
            {i < STAGES.length - 1 && (
              <div className="mx-2 text-text-3 text-xs">→</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
