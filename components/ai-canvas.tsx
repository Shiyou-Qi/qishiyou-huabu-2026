'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  ConnectionMode,
  ConnectionLineType,
  Node,
  Edge,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  CheckCircle2,
  Copy,
  Moon,
  Redo2,
  RotateCcw,
  Route,
  Scissors,
  Sun,
  Trash2,
  Undo2,
  Workflow,
} from 'lucide-react'
import { useTheme } from 'next-themes'

import { CustomNodeData, EdgeStyleType, useFlowStore, NodeType } from '@/lib/store'
import ImageNode from './nodes/image-node'
import VideoNode from './nodes/video-node'
import TextNode from './nodes/text-node'
import AudioNode from './nodes/audio-node'
import ScriptNode from './nodes/script-node'
import SceneNode from './nodes/scene-node'
import PromptAssistantNode from './nodes/prompt-assistant-node'
import { SidebarToolbar } from './sidebar-toolbar'
import { ZoomControls } from './zoom-controls'
import { CanvasMenuPanel, CanvasMenuPanelType } from './canvas-menu-panel'
import { CommandPalette } from './command-palette'
import { CuttableEdge } from './edges/cuttable-edge'

const nodeTypes = {
  imageNode: ImageNode,
  videoNode: VideoNode,
  textNode: TextNode,
  audioNode: AudioNode,
  scriptNode: ScriptNode,
  sceneNode: SceneNode,
  promptAssistantNode: PromptAssistantNode,
}

const edgeTypes = {
  default: CuttableEdge,
  smoothstep: CuttableEdge,
}

const edgeLineStyle = { stroke: 'var(--edge-color)', strokeWidth: 3 }

function Flow() {
  const [selectedNodes, setSelectedNodes] = useState<Node<CustomNodeData>[]>([])
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([])
  const [isThemeMounted, setIsThemeMounted] = useState(false)
  const [activePanel, setActivePanel] = useState<CanvasMenuPanelType | null>(null)
  const { theme, setTheme } = useTheme()
  const {
    nodes,
    edges,
    edgeStyleType,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    setEdgeStyleType,
    addNode,
    deleteNode,
    duplicateNode,
    resetCanvas,
    undo,
    redo,
    updateNodeData,
    materialPickerTarget,
    closeMaterialPicker,
  } = useFlowStore()
  const { screenToFlowPosition, fitView } = useReactFlow()

  useEffect(() => { setIsThemeMounted(true) }, [])

  // Open materials panel when a node requests the material picker
  useEffect(() => {
    if (materialPickerTarget) {
      setActivePanel('materials')
    }
  }, [materialPickerTarget])

  const nextEdgeStyle: EdgeStyleType = edgeStyleType === 'curve' ? 'straight' : 'curve'

  const selectedNodeIds = useMemo(() => new Set(selectedNodes.map(n => n.id)), [selectedNodes])

  const displayEdges = useMemo(() => {
    return edges.map(edge => {
      const { animated: _, ...rest } = edge
      const style = { ...edge.style, stroke: 'var(--edge-color)', strokeWidth: 3 }
      const markerEnd = edge.markerEnd && typeof edge.markerEnd === 'object'
        ? { ...edge.markerEnd, color: 'var(--edge-color)' }
        : edge.markerEnd
      const isActive = selectedNodeIds.size > 0 && (selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target))
      if (!isActive) return { ...rest, style, markerEnd }
      return { ...rest, style, markerEnd, data: { ...edge.data, isActive: true } }
    })
  }, [edges, selectedNodeIds])

  const stats = useMemo(() => {
    const readyNodes = nodes.filter(
      (n) => n.data.status === 'ready' || n.data.status === 'completed'
    ).length
    const isolated = nodes.filter((n) => {
      const hasIn = edges.some((e) => e.target === n.id)
      const hasOut = edges.some((e) => e.source === n.id)
      return !hasIn && !hasOut
    }).length
    return { readyNodes, isolated }
  }, [edges, nodes])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    // Allow both node-type drags and file drags
    event.dataTransfer.dropEffect = event.dataTransfer.types.includes('Files') ? 'copy' : 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      // ── File drop from OS ──────────────────────────────────
      if (event.dataTransfer.files.length > 0) {
        const dropPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
        Array.from(event.dataTransfer.files).forEach((file, i) => {
          const nodeType: NodeType | null =
            file.type.startsWith('image/') ? 'image'
            : file.type.startsWith('video/') ? 'video'
            : file.type.startsWith('audio/') ? 'audio'
            : null
          if (!nodeType) return

          const url = URL.createObjectURL(file)
          const mediaData =
            nodeType === 'image' ? { imageUrl: url }
            : nodeType === 'video' ? { videoUrl: url }
            : { audioUrl: url }

          addNode(nodeType, { x: dropPos.x + i * 40, y: dropPos.y + i * 40 }, {
            label: file.name.replace(/\.[^.]+$/, ''),
            status: 'ready',
            mode: 'input',
            meta: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
            ...mediaData,
          })
        })
        return
      }

      // ── Node-type drag from sidebar ────────────────────────
      const type = event.dataTransfer.getData('application/reactflow') as NodeType
      if (!type) return
      addNode(type, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    },
    [addNode, screenToFlowPosition]
  )

  const handleAddMaterial = useCallback(
    (material: { type: NodeType; title: string; url?: string; meta?: string }) => {
      const mediaData =
        material.type === 'image' ? { imageUrl: material.url }
        : material.type === 'video' ? { videoUrl: material.url }
        : material.type === 'audio' ? { audioUrl: material.url }
        : {}

      if (materialPickerTarget) {
        updateNodeData(materialPickerTarget, {
          status: material.url ? 'ready' : 'idle',
          meta: material.meta,
          ...mediaData,
        })
        closeMaterialPicker()
      } else {
        const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
        addNode(material.type, position, {
          label: material.title,
          status: material.url ? 'ready' : 'idle',
          mode: 'input',
          meta: material.meta,
          ...mediaData,
        })
      }
    },
    [addNode, screenToFlowPosition, materialPickerTarget, updateNodeData, closeMaterialPicker]
  )

  const deleteEdge = useFlowStore((s) => s.deleteEdge)

  useEffect(() => {
    const handler = (e: Event) => {
      const edgeId = (e as CustomEvent).detail?.edgeId
      if (edgeId) deleteEdge(edgeId)
    }
    window.addEventListener('cut-edge', handler)
    return () => window.removeEventListener('cut-edge', handler)
  }, [deleteEdge])

  const handleCutSelectedEdges = useCallback(() => {
    selectedEdges.forEach((e) => deleteEdge(e.id))
    setSelectedEdges([])
  }, [deleteEdge, selectedEdges])

  const handleDeleteSelected = useCallback(() => {
    selectedNodes.forEach((n) => deleteNode(n.id))
    setSelectedNodes([])
  }, [deleteNode, selectedNodes])

  const handleDuplicateSelected = useCallback(() => {
    selectedNodes.forEach((n) => duplicateNode(n.id))
  }, [duplicateNode, selectedNodes])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      if (isTyping) return

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodes.length > 0) {
        e.preventDefault()
        handleDeleteSelected()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdges.length > 0 && selectedNodes.length === 0) {
        e.preventDefault()
        handleCutSelectedEdges()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedNodes.length > 0) {
        e.preventDefault()
        handleDuplicateSelected()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault()
        fitView({ duration: 300, padding: 0.18 })
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fitView, handleDeleteSelected, handleDuplicateSelected, handleCutSelectedEdges, selectedNodes.length, selectedEdges.length, undo, redo])

  const hasSelection = selectedNodes.length > 0

  return (
    <div className="canvas-tech-grid size-full h-screen bg-background">
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onSelectionChange={({ nodes: sel, edges: selEdges }) => {
          setSelectedNodes(sel as Node<CustomNodeData>[])
          setSelectedEdges(selEdges)
        }}        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'default',
          style: edgeLineStyle,
        }}
        connectionMode={ConnectionMode.Strict}
        connectionLineType={edgeStyleType === 'curve' ? ConnectionLineType.Bezier : ConnectionLineType.SmoothStep}
        connectionLineStyle={edgeLineStyle}
        connectionRadius={48}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={Infinity}
      >
        <Background
          className="canvas-dashed-grid"
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1.5}
          color="var(--canvas-grid-dot)"
        />
      </ReactFlow>

      {/* ── Top Bar ── */}
      <div className="fixed left-20 right-4 top-4 z-50 flex items-center justify-between gap-3 pointer-events-none">
        {/* Brand */}
        <div className="glass flex items-center gap-3 rounded-2xl px-4 py-2.5 shadow-lg pointer-events-auto">
          <img src={isThemeMounted && theme === 'light' ? '/icon.svg' : '/baise.svg'} alt="logo" className="size-8 shrink-0 rounded-lg" />
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-semibold tracking-tight">AI 画布工作台</span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">节点编排 · 素材参考 · 视频生成</span>
          </div>
        </div>

        {/* Controls */}
        <div className="glass flex items-center gap-1 rounded-2xl px-2 py-1.5 shadow-lg pointer-events-auto">
          {/* Stats */}
          <div className="hidden items-center gap-3 px-2 text-[11px] text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
              <Workflow className="size-3.5" />
              <span className="tabular">{nodes.length}</span>
              <span className="text-muted-foreground/50">节点</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span className="tabular">{stats.readyNodes}</span>
              <span className="text-muted-foreground/50">就绪</span>
            </span>
            {stats.isolated > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-500">
                <span className="tabular">{stats.isolated}</span>
                <span>孤立</span>
              </span>
            )}
          </div>

          <div className="hidden h-5 w-px bg-border/50 sm:block" />

          <TopBarBtn
            onClick={() => setEdgeStyleType(nextEdgeStyle)}
            title="切换连线样式 (曲线 / 折弯)"
          >
            <Route className="size-4" />
            <span className="hidden text-[11px] sm:inline">
              {edgeStyleType === 'curve' ? '曲线' : '折弯'}
            </span>
          </TopBarBtn>

          <TopBarBtn
            onClick={() => isThemeMounted && setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="切换主题"
          >
            {isThemeMounted && theme === 'light'
              ? <Sun className="size-4" />
              : <Moon className="size-4" />}
          </TopBarBtn>

          <div className="h-5 w-px bg-border/50" />

          <TopBarBtn onClick={undo} disabled={!useFlowStore.getState().canUndo()} title="撤销 (Ctrl+Z)">
            <Undo2 className="size-4" />
          </TopBarBtn>
          <TopBarBtn onClick={redo} disabled={!useFlowStore.getState().canRedo()} title="重做 (Ctrl+Shift+Z)">
            <Redo2 className="size-4" />
          </TopBarBtn>

          <div className="h-5 w-px bg-border/50" />

          <TopBarBtn
            onClick={handleDuplicateSelected}
            disabled={!hasSelection}
            title="复制选中节点 (Ctrl/⌘+D)"
          >
            <Copy className="size-4" />
          </TopBarBtn>

          <TopBarBtn
            onClick={handleDeleteSelected}
            disabled={!hasSelection}
            title="删除选中节点 (Delete)"
            danger
          >
            <Trash2 className="size-4" />
          </TopBarBtn>

          <div className="h-5 w-px bg-border/50" />

          <TopBarBtn
            onClick={() => {
              resetCanvas()
              requestAnimationFrame(() => fitView({ duration: 300, padding: 0.18 }))
            }}
            title="重置示例工作流"
          >
            <RotateCcw className="size-4" />
          </TopBarBtn>
        </div>
      </div>

      <SidebarToolbar
        activePanel={activePanel}
        onOpenPanel={(panel) => setActivePanel((current) => current === panel ? null : panel)}
        onOpenMaterials={() => setActivePanel('materials')}
      />
      <CanvasMenuPanel activePanel={activePanel} onClose={() => { setActivePanel(null); if (materialPickerTarget) closeMaterialPicker() }} onAddMaterial={handleAddMaterial} />
      <ZoomControls />
      <CommandPalette />

      {/* ── Edge cut button — shown when edge(s) selected ── */}
      {selectedEdges.length > 0 && (
        <div className="fixed bottom-20 right-4 z-50 animate-in fade-in zoom-in-95 duration-150">
          <button
            onClick={handleCutSelectedEdges}
            className="glass flex items-center gap-2 rounded-2xl px-4 py-2.5 shadow-xl text-[12px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
            title="剪断选中连接线 (Delete)"
          >
            <Scissors className="size-4" />
            剪断连接线
            {selectedEdges.length > 1 && (
              <span className="ml-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px]">
                {selectedEdges.length}
              </span>
            )}
          </button>
        </div>
      )}

    </div>
  )
}

function TopBarBtn({
  onClick,
  disabled,
  title,
  danger,
  children,
}: {
  onClick?: () => void
  disabled?: boolean
  title?: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-muted-foreground
        transition-all duration-150
        hover:bg-muted/60 hover:text-foreground
        disabled:pointer-events-none disabled:opacity-35
        ${danger ? 'hover:bg-destructive/10 hover:text-destructive' : ''}
      `}
    >
      {children}
    </button>
  )
}

export function AICanvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  )
}
