import ReactFlow, { Background } from 'reactflow'
import 'reactflow/dist/style.css'
import { KillChainNode } from './KillChainNode'
import { useMemo }       from 'react'

// MUST be defined at module level (outside components) for stable reference
const NODE_TYPES = { killchain: KillChainNode }

const LAYER_COLORS = {
  web:       '#388BFD',
  container: '#2EA043',
  cloud:     '#D29922',
}

const NODE_STATES = {
  0: { web: 'locked',      container: 'locked',      cloud: 'locked'      },
  1: { web: 'compromised', container: 'active',       cloud: 'locked'      },
  2: { web: 'compromised', container: 'compromised',  cloud: 'active'      },
  3: { web: 'compromised', container: 'compromised',  cloud: 'compromised' },
}

export function KillChainGraph({ stage = 0, webProgress = 0, containerProgress = 0 }) {
  const states = NODE_STATES[stage] || NODE_STATES[0]
  // A layer can hold more than one flag, so it can have partial progress
  // while `stage` hasn't advanced past 'locked' yet — show it as active
  // instead of looking untouched.
  const webState = states.web === 'locked' && webProgress > 0 ? 'active' : states.web
  const containerState = states.container === 'locked' && containerProgress > 0 ? 'active' : states.container

  const nodes = useMemo(() => [
    {
      id:   'web',
      type: 'killchain',
      position: { x: 60, y: 40 },
      data: { type: 'web', state: webState, color: LAYER_COLORS.web, progress: webProgress },
    },
    {
      id:   'container',
      type: 'killchain',
      position: { x: 280, y: 40 },
      data: { type: 'container', state: containerState, color: LAYER_COLORS.container, progress: containerProgress },
    },
    {
      id:   'cloud',
      type: 'killchain',
      position: { x: 500, y: 40 },
      data: { type: 'cloud', state: states.cloud, color: LAYER_COLORS.cloud },
    },
  ], [states, webState, webProgress, containerState, containerProgress])

  const edges = useMemo(() => [
    {
      id:       'web-container',
      source:   'web',
      target:   'container',
      animated: stage >= 1,
      style: {
        stroke:          stage >= 1 ? '#388BFD' : '#30363D',
        strokeWidth:     2,
        strokeDasharray: stage >= 2 ? '0' : '6 3',
      },
    },
    {
      id:       'container-cloud',
      source:   'container',
      target:   'cloud',
      animated: stage >= 2,
      style: {
        stroke:          stage >= 2 ? '#2EA043' : '#30363D',
        strokeWidth:     2,
        strokeDasharray: stage >= 3 ? '0' : '6 3',
      },
    },
  ], [stage])

  return (
    // Height is relative (not fixed px) so this condenses cleanly when the
    // right-panel divider is dragged. `fitView` re-runs on remount —
    // ChallengePage bumps a `key` on drag-end to trigger that.
    <div style={{ height: '100%', width: '100%', minHeight: 0 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#30363D" gap={20} size={0.5} />
      </ReactFlow>
    </div>
  )
}
