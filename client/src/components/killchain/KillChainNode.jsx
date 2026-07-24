import { Globe, Box, Cloud, Check, Lock } from 'lucide-react'
import { Handle, Position } from 'reactflow'

const STATE_STYLES = {
  locked: {
    ring:   'border-[#30363D] bg-[#1C2128]',
    icon:   'text-[#484F58]',
    label:  'text-[#484F58]',
    badge:  'bg-[#30363D] text-[#484F58]',
    text:   'LOCKED',
  },
  active: {
    ring:   'border-current bg-transparent animate-pulse-slow',
    icon:   'text-current',
    label:  'text-current',
    badge:  'bg-current/20 text-current',
    text:   'IN PROGRESS',
  },
  compromised: {
    ring:   'border-current bg-current/20',
    icon:   'text-current',
    label:  'text-current',
    badge:  'bg-success/20 text-success',
    text:   'COMPROMISED',
  },
}

const LAYER_ICONS = { web: Globe, container: Box, cloud: Cloud }
const LAYER_LABELS = { web: 'WEB APP', container: 'CONTAINER', cloud: 'CLOUD' }
const LAYER_SUBLABELS = { web: 'Login form', container: 'App container', cloud: 'AWS EC2' }

export function KillChainNode({ data }) {
  const { type, state, color, progress = 1 } = data    // type: web|container|cloud
  const Icon   = state === 'compromised' ? Check
                : state === 'locked'     ? Lock
                : (LAYER_ICONS[type]     || Globe)
  const styles = STATE_STYLES[String(state).toLowerCase()] || STATE_STYLES.locked

  // A layer can hold more than one flag (e.g. web = sqli-login + sqli-broken-access).
  // While it's active but not yet fully solved, trace a fractional ring instead
  // of claiming full progress the pulsing "active" ring alone would imply.
  const isPartial = state === 'active' && progress > 0 && progress < 1
  const badgeText = isPartial ? `${Math.round(progress * 100)}% CAPTURED` : styles.text

  const radius = 38
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  return (
    <div
      className="flex flex-col items-center gap-2 select-none"
      style={{ color: state === 'locked' ? undefined : color }}
    >
      {/* Handles — invisible, just for React Flow edge routing */}
      <Handle type="target" position={Position.Left}
              style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Right}
              style={{ opacity: 0, pointerEvents: 'none' }} />

      {/* Circle node */}
      <div className="relative w-20 h-20">
        {isPartial && (
          <svg className="absolute inset-0 w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40" cy="40" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-500"
            />
          </svg>
        )}
        <div className={`w-20 h-20 rounded-full border-2 flex items-center
                         justify-center transition-all duration-500 ${styles.ring}`}>
          <Icon size={28} className={styles.icon} />
        </div>
      </div>

      {/* Layer type label */}
      <div className="text-center">
        <p className="text-[10px] font-mono tracking-widest text-text-3 uppercase">
          {LAYER_LABELS[type]}
        </p>
        <p className={`text-xs font-medium ${styles.label}`}>
          {LAYER_SUBLABELS[type]}
        </p>
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded
                          uppercase tracking-wider ${styles.badge}`}>
          {badgeText}
        </span>
      </div>
    </div>
  )
}
