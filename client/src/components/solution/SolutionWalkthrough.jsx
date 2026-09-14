import { Flag, ChevronDown, Globe, Box, Cloud } from 'lucide-react'
import { CodeBlock } from './CodeBlock'

// Same layer colour convention as KillChainNode / LayerBadge / FlagStatusRow
// (tailwind.config.js: layer-web/layer-container/layer-cloud). Every class
// fragment below is written out in full (not built via string
// concatenation) so Tailwind's content scanner can actually find and
// generate it — `${border}/30` at runtime would never match anything since
// the literal string "border-layer-web/30" wouldn't appear anywhere in the
// source for the scanner to pick up.
const LAYER_META = {
  web: {
    label: 'Web layer', icon: Globe,
    text: 'text-layer-web', borderFaint: 'border-layer-web/30',
    iconRing: 'border-layer-web/40', bg: 'bg-layer-web/10',
  },
  container: {
    label: 'Container layer', icon: Box,
    text: 'text-layer-container', borderFaint: 'border-layer-container/30',
    iconRing: 'border-layer-container/40', bg: 'bg-layer-container/10',
  },
  cloud: {
    label: 'Cloud layer', icon: Cloud,
    text: 'text-layer-cloud', borderFaint: 'border-layer-cloud/30',
    iconRing: 'border-layer-cloud/40', bg: 'bg-layer-cloud/10',
  },
}
const LAYER_ORDER = ['web', 'container', 'cloud']

function SolutionStep({ step, index }) {
  const meta = LAYER_META[step.layer] || LAYER_META.web
  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-text-3 text-[11px] font-mono tracking-wide mb-1">
            STEP {index + 1}
          </p>
          <h3 className="text-text-1 text-base font-semibold leading-snug">
            {step.title}
          </h3>
        </div>
        {step.category && (
          <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px]
                            font-mono border ${meta.text} ${meta.borderFaint} ${meta.bg}`}>
            {step.category}
          </span>
        )}
      </div>

      <p className="text-text-2 text-sm leading-relaxed">
        {step.explanation}
      </p>

      {step.commands?.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {step.commands.map((cmd, i) => (
            <CodeBlock key={i} code={cmd.code} label={cmd.label} />
          ))}
        </div>
      )}

      {step.expectedResult && (
        <div className="bg-surface-2 border border-border rounded-lg p-3.5">
          <p className="text-text-3 text-[11px] font-mono uppercase tracking-wide mb-2">
            Expected result
          </p>
          <pre className="text-text-2 text-[13px] font-mono leading-relaxed
                          whitespace-pre-wrap break-words">
            {step.expectedResult}
          </pre>
        </div>
      )}

      {step.remediation && (
        <div className="bg-success/5 border border-success/20 rounded-lg p-3.5">
          <p className="text-success text-[11px] font-mono uppercase tracking-wide mb-2">
            Remediation
          </p>
          <p className="text-text-2 text-sm leading-relaxed">
            {step.remediation}
          </p>
        </div>
      )}

      {step.flag && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border
                        ${meta.text} ${meta.borderFaint} ${meta.bg}`}>
          <Flag size={14} />
          <span className="font-mono text-sm">{step.flag}</span>
        </div>
      )}
    </div>
  )
}

function LayerSection({ layerKey, layer }) {
  const meta = LAYER_META[layerKey]
  const Icon = meta.icon
  const steps = layer?.steps || []

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className={`w-7 h-7 rounded-full border flex items-center justify-center
                          ${meta.text} ${meta.iconRing} ${meta.bg}`}>
          <Icon size={14} />
        </span>
        <h2 className="text-text-1 text-lg font-semibold">{meta.label}</h2>
      </div>

      {layer?.comingSoon ? (
        <div className="bg-surface-2 border border-dashed border-border rounded-xl p-6 text-center">
          <p className="text-text-2 text-sm font-medium mb-1">Coming soon</p>
          <p className="text-text-3 text-xs max-w-md mx-auto leading-relaxed">
            {layer.note || 'This layer is not built yet.'}
          </p>
        </div>
      ) : steps.length === 0 ? (
        <div className="bg-surface-2 border border-dashed border-border rounded-xl p-6 text-center">
          <p className="text-text-3 text-sm">Solution not yet written for this layer.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {steps.map((step, i) => (
            <SolutionStep key={i} step={step} index={i} />
          ))}
        </div>
      )}
    </section>
  )
}

// Used by both the full-page SolutionPage and MissionBrief's in-panel
// Solution tab; takes only the solution data + a compact flag — gating,
// page chrome, and navigation all live in the caller.
export function SolutionWalkthrough({ solution, compact = false }) {
  if (!solution) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-center">
        <p className="text-text-1 font-medium mb-1 text-sm">No solution written yet</p>
        <p className="text-text-2 text-xs">
          This challenge doesn't have a walkthrough yet.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        {!compact && (
          <p className="text-warning text-xs font-mono tracking-widest uppercase mb-1">
            Full solution walkthrough
          </p>
        )}
        <h1 className={compact
          ? 'text-text-1 text-base font-semibold mb-1.5'
          : 'text-text-1 text-2xl font-semibold mb-2'}>
          {solution.title}
        </h1>
        {solution.subtitle && (
          <p className="text-text-2 text-sm leading-relaxed max-w-2xl">
            {solution.subtitle}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {LAYER_ORDER.map((layerKey, i) => {
          const layer = solution.layers?.[layerKey]
          if (!layer) return null
          return (
            <div key={layerKey} className="flex flex-col gap-6">
              {i > 0 && (
                <div className="flex justify-center">
                  <ChevronDown size={18} className="text-text-3" />
                </div>
              )}
              <LayerSection layerKey={layerKey} layer={layer} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
