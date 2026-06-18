import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
  MarkerType,
} from '@xyflow/react'

export type NodeType = 'text' | 'image' | 'video' | 'audio' | 'script' | 'scene' | 'promptAssistant'
export type EdgeStyleType = 'curve' | 'straight'

/** video 工具节点左侧的 4 个 tab 入参点（按 TABS 顺序） */
export const VIDEO_TAB_HANDLES = [
  'tab-text2video',
  'tab-ref',
  'tab-firstlast',
  'tab-extend',
] as const
/** image 工具节点左侧的 3 个 tab 入参点（按 TABS 顺序） */
export const IMAGE_TAB_HANDLES = [
  'tab-text2img',
  'tab-img2img',
  'tab-imgref',
] as const
/** 提示词 text 节点专用的 handle id（独立于 tab handle，跨 tab 保留） */
export const PROMPT_HANDLE = 'tab-prompt' as const
export type VideoTabHandle = (typeof VIDEO_TAB_HANDLES)[number]
export type ImageTabHandle = (typeof IMAGE_TAB_HANDLES)[number]
export const DEFAULT_TARGET_HANDLE = 'input'
export const TARGET_HANDLES = new Set<string>([DEFAULT_TARGET_HANDLE, ...VIDEO_TAB_HANDLES, ...IMAGE_TAB_HANDLES, PROMPT_HANDLE])

/** 目标端口 → 允许连接的源节点类型列表 */
export const HANDLE_SOURCE_TYPES: Record<string, NodeType[]> = {
  'tab-text2video': ['text', 'promptAssistant', 'scene'],
  'tab-ref':        ['image', 'video', 'audio', 'text', 'promptAssistant', 'scene'],
  'tab-firstlast':  ['image', 'text', 'promptAssistant', 'scene'],
  'tab-extend':     ['video', 'text', 'promptAssistant'],
  'tab-text2img':   ['text', 'promptAssistant', 'scene'],
  'tab-img2img':    ['image', 'text', 'promptAssistant', 'scene'],
  'tab-imgref':     ['image', 'text', 'promptAssistant', 'scene'],
  'tab-prompt':     ['text', 'promptAssistant', 'scene'],
}

/**
 * 目标端口 → 最大连接数。
 * - undefined / 不存在 = 无限制
 * - N = 最多允许 N 条边连到该 handle
 * - 值为 1 的端口为"独占端口"：新连接会自动替换旧连接
 */
export const HANDLE_MAX_CONNECTIONS: Record<string, number> = {
  'tab-text2video': 1,
  'tab-firstlast':  3,   // 2 frames + 1 text/promptAssistant
  'tab-extend':     2,   // 1 video + 1 text/promptAssistant
  'tab-text2img':   1,
  'tab-img2img':    2,   // 1 image + 1 text/promptAssistant
  'tab-imgref':     2,   // 1 image + 1 text/promptAssistant
  'tab-prompt':     1,
  // tab-ref 无上限（由 UI 侧 MAX_REF = 15 控制）
}

export interface WorkflowSnapshot {
  nodes: Node<CustomNodeData>[]
  edges: Edge[]
  nodeCount?: Record<NodeType, number>
}

export interface CustomNodeData extends Record<string, unknown> {
  label: string
  type: NodeType
  /** 'tool' = 生成工具节点（有 prompt/参数）; 'result' = 结果展示节点; 'input' = 素材输入节点 */
  mode?: 'tool' | 'result' | 'input'
  content?: string
  imageUrl?: string
  videoUrl?: string
  audioUrl?: string
  status?: 'idle' | 'ready' | 'generating' | 'completed' | 'failed'
  meta?: string
  nodeWidth?: number
  nodeHeight?: number
}

interface UndoSnapshot {
  nodes: Node<CustomNodeData>[]
  edges: Edge[]
  nodeCount: Record<NodeType, number>
}

const MAX_UNDO = 50

interface FlowState {
  nodes: Node<CustomNodeData>[]
  edges: Edge[]
  edgeStyleType: EdgeStyleType
  onNodesChange: OnNodesChange<Node<CustomNodeData>>
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  isValidConnection: (connection: Connection | Edge) => boolean
  setEdgeStyleType: (style: EdgeStyleType) => void
  addNode: (
    type: NodeType,
    position: { x: number; y: number },
    data?: Partial<CustomNodeData>
  ) => void
  addResultNode: (
    sourceNodeId: string,
    type: NodeType,
    data: Partial<CustomNodeData>
  ) => string
  addInputNode: (
    targetNodeId: string,
    type: NodeType,
    data: Partial<CustomNodeData>,
    targetHandle?: string
  ) => string
  updateNodeData: (nodeId: string, data: Partial<CustomNodeData>) => void
  deleteNode: (nodeId: string) => void
  deleteEdge: (edgeId: string) => void
  removeEdgesWhere: (predicate: (edge: Edge) => boolean) => void
  duplicateNode: (nodeId: string) => void
  loadCanvas: (snapshot: WorkflowSnapshot) => void
  resetCanvas: () => void
  nodeCount: Record<NodeType, number>
  // undo/redo
  _undoStack: UndoSnapshot[]
  _redoStack: UndoSnapshot[]
  _pushUndo: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  createScenesFromScript: (
    scriptNodeId: string,
    scenes: Array<{ description: string; dialogue: string; duration: string; camera: string; negativePrompt?: string; aspectRatio?: string; outputMode?: string }>
  ) => void
  // material picker
  materialPickerTarget: string | null
  openMaterialPicker: (nodeId: string) => void
  closeMaterialPicker: () => void
}

const initialNodes: Node<CustomNodeData>[] = [
  {
    id: '1',
    type: 'imageNode',
    position: { x: 100, y: 50 },
    data: { 
      label: 'AI 生图 6', 
      type: 'image',
      status: 'idle',
    },
  },
  {
    id: '2',
    type: 'imageNode',
    position: { x: 550, y: 50 },
    data: { 
      label: '首帧', 
      type: 'image',
      imageUrl: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=400&h=300&fit=crop',
      status: 'ready',
      mode: 'input',
      meta: '可作为首帧输入',
    },
  },
  {
    id: '3',
    type: 'videoNode',
    position: { x: 1000, y: 100 },
    data: { 
      label: 'AI 视频 2', 
      type: 'video',
      status: 'idle',
    },
  },
]

const initialEdges: Edge[] = [
  {
    id: 'e1-3',
    source: '1',
    target: '3',
    sourceHandle: 'output',
    targetHandle: 'tab-text2video',
    type: 'default',
    selectable: true,
    interactionWidth: 24,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: 'var(--edge-color)',
    },
    style: { stroke: 'var(--edge-color)', strokeWidth: 3 }
  },
  {
    id: 'e2-3',
    source: '2',
    target: '3',
    sourceHandle: 'output',
    targetHandle: 'tab-firstlast',
    type: 'default',
    selectable: true,
    interactionWidth: 24,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: 'var(--edge-color)',
    },
    style: { stroke: 'var(--edge-color)', strokeWidth: 3 }
  },
]

const edgeStyle = { stroke: 'var(--edge-color)', strokeWidth: 3 }

const getEdgeType = (_style: EdgeStyleType) => 'default' as const

const emptyNodeCount: Record<NodeType, number> = {
  text: 0,
  image: 0,
  video: 0,
  audio: 0,
  script: 0,
  scene: 0,
  promptAssistant: 0,
}

const countNodesByType = (nodes: Node<CustomNodeData>[]) =>
  nodes.reduce<Record<NodeType, number>>(
    (counts, node) => {
      counts[node.data.type] += 1
      return counts
    },
    { ...emptyNodeCount }
  )

const buildEdge = (
  source: string,
  target: string,
  style: EdgeStyleType,
  overrides: Partial<Edge> = {}
): Edge => {
  const sourceHandle = overrides.sourceHandle ?? 'output'
  const targetHandle = overrides.targetHandle ?? DEFAULT_TARGET_HANDLE
  return {
    id: `e-${source}->${target}::${overrides.sourceHandle ?? 'output'}->${overrides.targetHandle ?? DEFAULT_TARGET_HANDLE}`,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: getEdgeType(style),
    data: { edgeType: style },
    selectable: true,
    interactionWidth: 24,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: 'var(--edge-color)',
    },
    style: edgeStyle,
    ...overrides,
  }
}

const createsCycle = (edges: Edge[], source: string, target: string) => {
  const adjacency = new Map<string, string[]>()
  edges.forEach((edge) => {
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target])
  })

  const visited = new Set<string>()
  const stack = [target]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current)) continue
    if (current === source) return true
    visited.add(current)
    stack.push(...(adjacency.get(current) ?? []))
  }

  return false
}

const validateConnection = (
  connection: Connection | Edge,
  nodes: Node<CustomNodeData>[],
  edges: Edge[]
) => {
  const { source, target } = connection
  if (!source || !target || source === target) return false
  // 只允许从 output handle 出线
  if (connection.sourceHandle && connection.sourceHandle !== 'output') return false
  // 目标端口必须在白名单中
  if (connection.targetHandle && !TARGET_HANDLES.has(connection.targetHandle)) return false

  const sourceNode = nodes.find((node) => node.id === source)
  const targetNode = nodes.find((node) => node.id === target)
  if (!sourceNode || !targetNode) return false

  // input / result 模式的节点不接受入边
  if (targetNode.data.mode === 'input' || targetNode.data.mode === 'result') return false

  // 源节点类型必须与目标端口兼容
  if (connection.targetHandle) {
    const allowedTypes = HANDLE_SOURCE_TYPES[connection.targetHandle]
    if (allowedTypes && !allowedTypes.includes(sourceNode.data.type)) return false

    // 检查目标端口是否已达最大连接数（仅对 max > 1 的端口做硬拦截；max = 1 的独占端口由 onConnect 自动替换）
    const maxConns = HANDLE_MAX_CONNECTIONS[connection.targetHandle]
    if (maxConns !== undefined && maxConns > 1) {
      const existingCount = edges.filter(
        (e) => e.target === target && e.targetHandle === connection.targetHandle
      ).length
      if (existingCount >= maxConns) return false
    }
  }

  // 禁止重复边（相同 source → target）
  if (edges.some((edge) => edge.source === source && edge.target === target)) return false

  return !createsCycle(edges, source, target)
}

const NODE_TYPE_MAP: Record<NodeType, string> = {
  text: 'textNode',
  image: 'imageNode',
  video: 'videoNode',
  audio: 'audioNode',
  script: 'scriptNode',
  scene: 'sceneNode',
  promptAssistant: 'promptAssistantNode',
}

const LABEL_MAP: Record<NodeType, string> = {
  text: 'AI 文本',
  image: 'AI 生图',
  video: 'AI 视频',
  audio: '音频节点',
  script: '分镜脚本',
  scene: '分镜',
  promptAssistant: '提示词助手',
}

export const useFlowStore = create<FlowState>()(
  persist(
    (set, get) => ({
      nodes: initialNodes,
      edges: initialEdges,
      edgeStyleType: 'straight',
      nodeCount: countNodesByType(initialNodes),

      // ── undo / redo ──
      _undoStack: [],
      _redoStack: [],
      _pushUndo: () => {
        const { nodes, edges, nodeCount, _undoStack } = get()
        const snapshot: UndoSnapshot = { nodes, edges, nodeCount }
        set({ _undoStack: [..._undoStack.slice(-MAX_UNDO + 1), snapshot], _redoStack: [] })
      },
      undo: () => {
        const { _undoStack, nodes, edges, nodeCount } = get()
        if (_undoStack.length === 0) return
        const prev = _undoStack[_undoStack.length - 1]
        const current: UndoSnapshot = { nodes, edges, nodeCount }
        set({
          nodes: prev.nodes,
          edges: prev.edges,
          nodeCount: prev.nodeCount,
          _undoStack: _undoStack.slice(0, -1),
          _redoStack: [...get()._redoStack, current],
        })
      },
      redo: () => {
        const { _redoStack, nodes, edges, nodeCount } = get()
        if (_redoStack.length === 0) return
        const next = _redoStack[_redoStack.length - 1]
        const current: UndoSnapshot = { nodes, edges, nodeCount }
        set({
          nodes: next.nodes,
          edges: next.edges,
          nodeCount: next.nodeCount,
          _redoStack: _redoStack.slice(0, -1),
          _undoStack: [...get()._undoStack, current],
        })
      },
      canUndo: () => get()._undoStack.length > 0,
      canRedo: () => get()._redoStack.length > 0,

      // ── material picker ──
      materialPickerTarget: null,
      openMaterialPicker: (nodeId) => set({ materialPickerTarget: nodeId }),
      closeMaterialPicker: () => set({ materialPickerTarget: null }),

      // ── react flow callbacks ──
      onNodesChange: (changes) => {
        set({ nodes: applyNodeChanges(changes, get().nodes) })
      },
      onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) })
      },
      onConnect: (connection: Connection) => {
        if (!validateConnection(connection, get().nodes, get().edges)) return
        get()._pushUndo()

        let edges = get().edges
        const targetHandle = connection.targetHandle ?? DEFAULT_TARGET_HANDLE

        // 独占端口（max = 1）：自动移除旧连接，再添加新连接
        const maxConns = HANDLE_MAX_CONNECTIONS[targetHandle]
        if (maxConns === 1) {
          edges = edges.filter(
            (e) => !(e.target === connection.target && e.targetHandle === targetHandle)
          )
        }

        set({
          edges: addEdge(
            buildEdge(connection.source!, connection.target!, get().edgeStyleType, connection),
            edges
          ),
        })
      },
      isValidConnection: (connection: Connection | Edge) => {
        return validateConnection(connection, get().nodes, get().edges)
      },
      setEdgeStyleType: (style: EdgeStyleType) => {
        set({
          edgeStyleType: style,
          edges: get().edges.map((edge) => ({
            ...edge,
            type: getEdgeType(style),
            data: { ...(edge.data as Record<string, unknown>), edgeType: style },
            style: edgeStyle,
          })),
        })
      },

      // ── node CRUD ──
      addNode: (type, position, data = {}) => {
        get()._pushUndo()
        const nodeCount = get().nodeCount
        const newCount = (nodeCount[type] ?? 0) + 1
        const newNode: Node<CustomNodeData> = {
          id: `${type}-${Date.now()}`,
          type: NODE_TYPE_MAP[type],
          position,
          data: {
            label: `${LABEL_MAP[type]} ${newCount}`,
            type,
            status: 'idle',
            ...data,
          },
        }
        set({
          nodes: [...get().nodes, newNode],
          nodeCount: { ...nodeCount, [type]: newCount },
        })
      },

      addResultNode: (sourceNodeId, type, data = {}) => {
        get()._pushUndo()
        const sourceNode = get().nodes.find((n) => n.id === sourceNodeId)
        const nodeCount = get().nodeCount
        const newCount = nodeCount[type] + 1
        const newId = `${type}-result-${Date.now()}`
        const position = sourceNode
          ? { x: sourceNode.position.x + 420, y: sourceNode.position.y }
          : { x: 600, y: 300 }
        const newNode: Node<CustomNodeData> = {
          id: newId,
          type: NODE_TYPE_MAP[type],
          position,
          data: { label: `${LABEL_MAP[type]} ${newCount}`, type, status: 'completed', ...data },
        }
        const newEdge = buildEdge(sourceNodeId, newId, get().edgeStyleType)
        set({
          nodes: [...get().nodes, newNode],
          edges: [...get().edges, newEdge],
          nodeCount: { ...nodeCount, [type]: newCount },
        })
        return newId
      },

      addInputNode: (targetNodeId, type, data = {}, targetHandle) => {
        get()._pushUndo()
        const targetNode = get().nodes.find((n) => n.id === targetNodeId)
        const nodeCount = get().nodeCount
        const newCount = nodeCount[type] + 1
        const newId = `${type}-input-${Date.now()}-${newCount}`
        const position = targetNode
          ? { x: targetNode.position.x - 420, y: targetNode.position.y + newCount * 20 }
          : { x: 200, y: 300 }
        const newNode: Node<CustomNodeData> = {
          id: newId,
          type: NODE_TYPE_MAP[type],
          position,
          data: { label: data.label ?? `素材 ${newCount}`, type, mode: 'input', status: 'ready', ...data },
        }
        const newEdge = buildEdge(newId, targetNodeId, get().edgeStyleType, {
          ...(targetHandle ? { targetHandle } : {}),
        })
        set({
          nodes: [...get().nodes, newNode],
          edges: [...get().edges, newEdge],
          nodeCount: { ...nodeCount, [type]: newCount },
        })
        return newId
      },

      updateNodeData: (nodeId, data) => {
        const oldNode = get().nodes.find((n) => n.id === nodeId)
        if (oldNode) {
          if (data.imageUrl && oldNode.data.imageUrl?.startsWith('blob:') && oldNode.data.imageUrl !== data.imageUrl)
            URL.revokeObjectURL(oldNode.data.imageUrl)
          if (data.videoUrl && oldNode.data.videoUrl?.startsWith('blob:') && oldNode.data.videoUrl !== data.videoUrl)
            URL.revokeObjectURL(oldNode.data.videoUrl)
          if (data.audioUrl && oldNode.data.audioUrl?.startsWith('blob:') && oldNode.data.audioUrl !== data.audioUrl)
            URL.revokeObjectURL(oldNode.data.audioUrl)
        }
        set({
          nodes: get().nodes.map((node) =>
            node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
          ),
        })
      },

      deleteNode: (nodeId) => {
        get()._pushUndo()
        const node = get().nodes.find((n) => n.id === nodeId)
        if (node) {
          if (node.data.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(node.data.imageUrl)
          if (node.data.videoUrl?.startsWith('blob:')) URL.revokeObjectURL(node.data.videoUrl)
          if (node.data.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(node.data.audioUrl)
        }
        set({
          nodes: get().nodes.filter((n) => n.id !== nodeId),
          edges: get().edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
        })
      },

      deleteEdge: (edgeId) => {
        get()._pushUndo()
        set({ edges: get().edges.filter((e) => e.id !== edgeId) })
      },

      removeEdgesWhere: (predicate) => {
        set({ edges: get().edges.filter((e) => !predicate(e)) })
      },

      duplicateNode: (nodeId) => {
        get()._pushUndo()
        const node = get().nodes.find((item) => item.id === nodeId)
        if (!node) return
        set({
          nodes: [...get().nodes, {
            ...node,
            id: `${node.data.type}-${Date.now()}`,
            selected: false,
            position: { x: node.position.x + 48, y: node.position.y + 48 },
            data: { ...node.data, label: `${node.data.label} 副本` },
          }],
        })
      },

      createScenesFromScript: (scriptNodeId, scenes) => {
        get()._pushUndo()
        const scriptNode = get().nodes.find((n) => n.id === scriptNodeId)
        if (!scriptNode) return
        const baseX = scriptNode.position.x + 480
        const baseY = scriptNode.position.y - ((scenes.length - 1) * 95)
        const nodeCount = { ...get().nodeCount }
        const newNodes: Node<CustomNodeData>[] = []
        const newEdges: Edge[] = []
        const ts = Date.now()
        scenes.forEach((scene, i) => {
          const count = (nodeCount.scene ?? 0) + i + 1
          const nodeId = `scene-${ts}-${i}`
          newNodes.push({
            id: nodeId,
            type: NODE_TYPE_MAP.scene,
            position: { x: baseX, y: baseY + i * 190 },
            data: {
              label: `分镜 ${count}`,
              type: 'scene',
              status: 'ready',
              content: JSON.stringify({ ...scene, sceneIndex: i + 1 }),
              meta: scene.duration,
            },
          })
          newEdges.push(buildEdge(scriptNodeId, nodeId, get().edgeStyleType))
        })
        nodeCount.scene = (nodeCount.scene ?? 0) + scenes.length
        set({
          nodes: [...get().nodes, ...newNodes],
          edges: [...get().edges, ...newEdges],
          nodeCount,
        })
      },

      loadCanvas: ({ nodes, edges, nodeCount }) => {
        get()._pushUndo()
        const edgeStyleType = get().edgeStyleType
        set({
          nodes: nodes.map((node) => ({ ...node, selected: false })),
          edges: edges.map((edge) => ({
            ...edge, selected: false, type: getEdgeType(edgeStyleType), style: edgeStyle,
          })),
          nodeCount: nodeCount ?? countNodesByType(nodes),
        })
      },

      resetCanvas: () => {
        get()._pushUndo()
        const edgeStyleType = get().edgeStyleType
        set({
          nodes: initialNodes,
          edges: initialEdges.map((edge) => buildEdge(edge.source, edge.target, edgeStyleType)),
          nodeCount: countNodesByType(initialNodes),
        })
      },
    }),
    {
      name: 'ai-canvas-store',
      version: 3,
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        edgeStyleType: state.edgeStyleType,
        nodeCount: state.nodeCount,
      }),
    }
  )
)
