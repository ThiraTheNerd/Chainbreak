import { Globe, Box, Cloud, Check, Lock } from 'lucide-react'

const LAYER_CONFIG = {
  web: {
    label: 'Web',
    icon:  Globe,
    color: 'text-layer-web border-layer-web',
    bg:    'bg-layer-web/10',
    solid: 'bg-layer-web text-white border-layer-web',
  },
  container: {
    label: 'Container',
    icon:  Box,
    color: 'text-layer-container border-layer-container',
    bg:    'bg-layer-container/10',
    solid: 'bg-layer-container text-white border-layer-container',
  },
  cloud: {
    label: 'Cloud',
    icon:  Cloud,
    color: 'text-layer-cloud border-layer-cloud',
    bg:    'bg-layer-cloud/10',
    solid: 'bg-layer-cloud text-white border-layer-cloud',
  },
}

export function LayerBadge({ type, solved = false, locked = false }) {
  const cfg  = LAYER_CONFIG[type]
  if (!cfg) return null

  const Icon = solved ? Check : locked ? Lock : cfg.icon

  const classes = solved
    ? `${cfg.solid} border`
    : locked
    ? 'text-text-3 border-border bg-surface-2 border'
    : `${cfg.color} ${cfg.bg} border`

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1
                      rounded-full text-xs font-medium ${classes}`}>
      <Icon size={11} />
      {cfg.label}
      {solved && <span className="sr-only">completed</span>}
    </span>
  )
}
