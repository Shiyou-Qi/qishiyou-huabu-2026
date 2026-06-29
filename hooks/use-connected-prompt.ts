import { useFlowStore, PROMPT_HANDLE } from '@/lib/store'

const PROMPT_SOURCE_TYPES = new Set(['text', 'promptAssistant', 'scene', 'storyboard'])

function extractPromptText(type: string, content: string | undefined, sourceHandle?: string): string {
  if (!content) return ''
  if (type === 'storyboard' && sourceHandle?.startsWith('row-')) {
    try {
      const rows = JSON.parse(content)
      const idx = parseInt(sourceHandle.slice(4), 10)
      const row = rows[idx]
      if (!row) return ''
      const parts: string[] = []
      if (row.description) parts.push(row.description)
      if (row.dialogue) parts.push(row.dialogue)
      return parts.join('\n')
    } catch { return content }
  }
  if (type === 'scene') {
    try {
      const scene = JSON.parse(content)
      const parts = []
      if (scene.style) parts.push(`风格: ${scene.style}`)
      if (scene.description) parts.push(scene.description)
      if (scene.dialogue) parts.push(scene.dialogue)
      return parts.join('\n')
    } catch { return content }
  }
  return content
}

export interface ConnectedPrompt {
  sourceId: string
  edgeId: string
  label: string
  text: string
  disconnect: () => void
}

export function useConnectedPrompt(nodeId: string): ConnectedPrompt | null {
  const edges = useFlowStore((s) => s.edges)
  const nodes = useFlowStore((s) => s.nodes)
  const deleteEdge = useFlowStore((s) => s.deleteEdge)

  // Priority 1: dedicated PROMPT_HANDLE
  const promptEdge = edges.find(
    (e) => e.target === nodeId && e.targetHandle === PROMPT_HANDLE
  )

  // Priority 2: text/promptAssistant/scene source on any tab handle
  const tabTextEdge = !promptEdge
    ? edges.find((e) => {
        if (e.target !== nodeId) return false
        const src = nodes.find((n) => n.id === e.source)
        return src && PROMPT_SOURCE_TYPES.has(src.data.type)
      })
    : undefined

  const activeEdge = promptEdge ?? tabTextEdge
  if (!activeEdge) return null

  const sourceNode = nodes.find((n) => n.id === activeEdge.source)
  if (!sourceNode) return null

  const edgeId = activeEdge.id
  return {
    sourceId: sourceNode.id,
    edgeId,
    label: sourceNode.data.label,
    text: extractPromptText(sourceNode.data.type, sourceNode.data.content as string, activeEdge.sourceHandle ?? undefined),
    disconnect: () => deleteEdge(edgeId),
  }
}
