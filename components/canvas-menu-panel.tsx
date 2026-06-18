'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Edge, MarkerType, Node, useReactFlow } from '@xyflow/react'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Film,
  GitBranch,
  Globe,
  ImageIcon,
  Key,
  LayoutTemplate,
  Loader2,
  Moon,
  RotateCcw,
  Route,
  Save,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Volume2,
  X,
  Info,
  Mail,
  MessageCircle,
  User,
  Zap,
} from 'lucide-react'
import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils'
import { CustomNodeData, EdgeStyleType, NodeType, useFlowStore, WorkflowSnapshot } from '@/lib/store'
import { MaterialLibraryContent } from './material-library'

export type CanvasMenuPanelType = 'templates' | 'history' | 'settings' | 'materials'

/* ─── Settings Types ─── */

interface ProviderConfigUI {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  hasKey: boolean
  enabled: boolean
  models: string[]
  allModels: string[]
  disabledModels: string[]
}

interface ModelMeta {
  id: string
  name: string
  type: string
  provider: string
  description: string
  tags?: string[]
}

const TYPE_LABEL: Record<string, string> = {
  text: '文本大模型',
  image: '图片模型',
  video: '视频模型',
  audio: '音频模型',
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  text: <FileText className="size-3" />,
  image: <ImageIcon className="size-3" />,
  video: <Film className="size-3" />,
  audio: <Volume2 className="size-3" />,
}

const TYPE_ORDER = ['text', 'image', 'video', 'audio']

interface CanvasMenuPanelProps {
  activePanel: CanvasMenuPanelType | null
  onClose: () => void
  onAddMaterial: (material: { type: NodeType; title: string; url?: string; meta?: string }) => void
}

interface HistoryItem extends WorkflowSnapshot {
  id: string
  title: string
  createdAt: string
}

interface TemplateItem {
  id: string
  title: string
  subtitle: string
  description: string
  tags: string[]
  icon: typeof LayoutTemplate
  snapshot: WorkflowSnapshot
}

const HISTORY_KEY = 'ai-canvas-history'
const edgeStyle = { stroke: 'var(--edge-color)', strokeWidth: 2 }

const nodeTypeMap: Record<NodeType, string> = {
  text: 'textNode',
  image: 'imageNode',
  video: 'videoNode',
  audio: 'audioNode',
  script: 'scriptNode',
  scene: 'sceneNode',
  promptAssistant: 'promptAssistantNode',
}

function workflowNode(
  id: string,
  type: NodeType,
  position: { x: number; y: number },
  data: Partial<CustomNodeData>
): Node<CustomNodeData> {
  return {
    id,
    type: nodeTypeMap[type],
    position,
    data: {
      label: data.label ?? '节点',
      type,
      status: 'idle',
      ...data,
    },
  }
}

function workflowEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
    sourceHandle: 'output',
    targetHandle: 'input',
    type: 'default',
    selectable: true,
    interactionWidth: 24,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
      color: 'var(--edge-color)',
    },
    style: edgeStyle,
  }
}

const templates: TemplateItem[] = [
  {
    id: 'image-to-video',
    title: '图片生成短视频',
    subtitle: '替换首帧图片和提示词即可出片',
    description: '适合把产品图、人物图或场景图快速转成 5-10 秒动态视频。',
    tags: ['首帧', '文生视频', '短片'],
    icon: Film,
    snapshot: {
      nodes: [
        workflowNode('tpl-iv-prompt', 'text', { x: 80, y: 70 }, {
          label: '视频画面描述',
          content: '替换为你想要的视频内容:镜头运动、主体动作、氛围和风格。',
          status: 'ready',
        }),
        workflowNode('tpl-iv-image', 'image', { x: 500, y: 70 }, {
          label: '替换你的首帧图片',
          imageUrl: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&h=450&fit=crop',
          mode: 'input',
          status: 'ready',
          meta: '上传或拖入自己的图片',
        }),
        workflowNode('tpl-iv-video', 'video', { x: 930, y: 95 }, {
          label: 'AI 视频生成',
          status: 'idle',
          meta: '输出 16:9 · 5s',
        }),
      ],
      edges: [
        workflowEdge('tpl-iv-e1', 'tpl-iv-prompt', 'tpl-iv-video'),
        workflowEdge('tpl-iv-e2', 'tpl-iv-image', 'tpl-iv-video'),
      ],
    },
  },
  {
    id: 'product-commercial',
    title: '产品广告工作流',
    subtitle: '商品图 + 卖点脚本 + 视频成片',
    description: '用于电商主图、品牌短片、产品发布素材,用户只要替换商品图和卖点。',
    tags: ['产品图', '广告脚本', '成片'],
    icon: Sparkles,
    snapshot: {
      nodes: [
        workflowNode('tpl-ad-product', 'image', { x: 80, y: 80 }, {
          label: '替换产品图片',
          imageUrl: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&h=450&fit=crop',
          mode: 'input',
          status: 'ready',
          meta: '透明底或场景图均可',
        }),
        workflowNode('tpl-ad-script', 'script', { x: 500, y: 45 }, {
          label: '广告脚本模板',
          content: '开场吸引注意 → 产品特写 → 3 个卖点 → 使用场景 → 结尾 CTA。',
          status: 'ready',
          meta: '替换品牌名和卖点',
        }),
        workflowNode('tpl-ad-image', 'image', { x: 500, y: 330 }, {
          label: '场景氛围图',
          status: 'idle',
          meta: '可选:生成背景或分镜图',
        }),
        workflowNode('tpl-ad-video', 'video', { x: 950, y: 160 }, {
          label: '广告视频输出',
          status: 'idle',
          meta: '9:16 / 16:9 可调整',
        }),
      ],
      edges: [
        workflowEdge('tpl-ad-e1', 'tpl-ad-product', 'tpl-ad-script'),
        workflowEdge('tpl-ad-e2', 'tpl-ad-script', 'tpl-ad-video'),
        workflowEdge('tpl-ad-e3', 'tpl-ad-image', 'tpl-ad-video'),
      ],
    },
  },
  {
    id: 'character-consistency',
    title: '角色一致性视频',
    subtitle: '角色参考图 + 分镜描述 + 视频节点',
    description: '适合虚拟人、IP 角色、剧情短片,先锁定角色,再生成分镜与视频。',
    tags: ['角色参考', '分镜', '一致性'],
    icon: ImageIcon,
    snapshot: {
      nodes: [
        workflowNode('tpl-char-ref', 'image', { x: 80, y: 80 }, {
          label: '替换角色参考图',
          imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=450&fit=crop',
          mode: 'input',
          status: 'ready',
          meta: '建议上传清晰半身或头像',
        }),
        workflowNode('tpl-char-text', 'text', { x: 500, y: 70 }, {
          label: '角色与分镜描述',
          content: '描述角色外观、服装、镜头动作、场景变化和情绪。',
          status: 'ready',
        }),
        workflowNode('tpl-char-scene', 'image', { x: 500, y: 330 }, {
          label: '关键分镜图',
          status: 'idle',
          meta: '用于锁定画面构图',
        }),
        workflowNode('tpl-char-video', 'video', { x: 960, y: 170 }, {
          label: '角色视频生成',
          status: 'idle',
          meta: '人物一致性优先',
        }),
      ],
      edges: [
        workflowEdge('tpl-char-e1', 'tpl-char-ref', 'tpl-char-text'),
        workflowEdge('tpl-char-e2', 'tpl-char-text', 'tpl-char-scene'),
        workflowEdge('tpl-char-e3', 'tpl-char-ref', 'tpl-char-video'),
        workflowEdge('tpl-char-e4', 'tpl-char-scene', 'tpl-char-video'),
      ],
    },
  },
]

function getStoredHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveStoredHistory(items: HistoryItem[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function CanvasMenuPanel({ activePanel, onClose, onAddMaterial }: CanvasMenuPanelProps) {
  const { fitView } = useReactFlow()
  const { theme, setTheme } = useTheme()
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [notice, setNotice] = useState('')
  const nodes = useFlowStore((state) => state.nodes)
  const edges = useFlowStore((state) => state.edges)
  const nodeCount = useFlowStore((state) => state.nodeCount)
  const edgeStyleType = useFlowStore((state) => state.edgeStyleType)
  const setEdgeStyleType = useFlowStore((state) => state.setEdgeStyleType)
  const loadCanvas = useFlowStore((state) => state.loadCanvas)
  const resetCanvas = useFlowStore((state) => state.resetCanvas)

  const title = useMemo(() => {
    if (activePanel === 'templates') return '模板工作流'
    if (activePanel === 'history') return '历史记录'
    if (activePanel === 'settings') return '画布设置'
    if (activePanel === 'materials') return '素材库'
    return ''
  }, [activePanel])

  useEffect(() => {
    setHistoryItems(getStoredHistory())
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 1800)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!activePanel) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activePanel, onClose])

  const applySnapshot = (snapshot: WorkflowSnapshot, message: string) => {
    loadCanvas(snapshot)
    setNotice(message)
    requestAnimationFrame(() => fitView({ duration: 300, padding: 0.18 }))
  }

  const saveHistory = () => {
    const item: HistoryItem = {
      id: `history-${Date.now()}`,
      title: `画布记录 ${historyItems.length + 1}`,
      createdAt: new Date().toISOString(),
      nodes,
      edges,
      nodeCount,
    }
    const nextItems = [item, ...historyItems].slice(0, 12)
    setHistoryItems(nextItems)
    saveStoredHistory(nextItems)
    setNotice('已保存当前画布')
  }

  const deleteHistory = (id: string) => {
    const nextItems = historyItems.filter((item) => item.id !== id)
    setHistoryItems(nextItems)
    saveStoredHistory(nextItems)
    setNotice('已删除记录')
  }

  const clearHistory = () => {
    setHistoryItems([])
    saveStoredHistory([])
    setNotice('历史记录已清空')
  }

  const setLineStyle = (style: EdgeStyleType) => {
    setEdgeStyleType(style)
    setNotice(style === 'curve' ? '已切换为曲线连线' : '已切换为直线连线')
  }

  if (!activePanel) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex w-[720px] max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* ── Header ── */}
        <div className="flex items-start justify-between border-b border-border/40 px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                {activePanel === 'templates' && <LayoutTemplate className="size-4.5" />}
                {activePanel === 'history' && <Clock className="size-4.5" />}
                {activePanel === 'settings' && <Settings className="size-4.5" />}
                {activePanel === 'materials' && <ImageIcon className="size-4.5" />}
              </span>
              <h2 className="text-[16px] font-semibold">{title}</h2>
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              {activePanel === 'templates' && '预搭建链路，替换图片和内容即可使用'}
              {activePanel === 'history' && '保存、恢复或管理你的画布版本'}
              {activePanel === 'settings' && '调整主题、连线样式、API 密钥和画布状态'}
              {activePanel === 'materials' && '浏览、搜索和管理你的创作素材'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label="关闭菜单"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {notice && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-400">
            <CheckCircle2 className="size-4" />
            {notice}
          </div>
        )}

        {/* ── Content ── */}
        {activePanel !== 'materials' ? (
        <div className="max-h-[calc(85vh-110px)] overflow-y-auto p-6">
        {activePanel === 'templates' && (
          <div className="grid grid-cols-2 gap-3">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => applySnapshot(template.snapshot, `已载入：${template.title}`)}
                className="group w-full rounded-2xl border border-border/50 bg-muted/20 p-4 text-left transition-all hover:border-border hover:bg-muted/40 hover:shadow-lg"
              >
                <div className="flex gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <template.icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-[13px] font-semibold">{template.title}</h3>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                        使用模板
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-muted-foreground">{template.subtitle}</p>
                    <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground/80">
                      {template.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {template.tags.map((tag) => (
                        <span key={tag} className="rounded-md bg-background/70 px-2 py-1 text-[11px] text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {activePanel === 'history' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={saveHistory}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Save className="size-4" />
                保存当前画布
              </button>
              <button
                onClick={clearHistory}
                disabled={historyItems.length === 0}
                className="rounded-xl border border-border/50 px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                清空
              </button>
            </div>

            {historyItems.length > 0 ? (
              <div className="space-y-2.5">
                {historyItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border/50 bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-medium">{item.title}</div>
                        <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
                          <Clock className="size-3.5" />
                          {formatTime(item.createdAt)}
                          <span>·</span>
                          {item.nodes.length} 节点
                        </div>
                      </div>
                      <button
                        onClick={() => deleteHistory(item.id)}
                        className="flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="删除记录"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => applySnapshot(item, '已恢复历史画布')}
                      className="mt-3 w-full rounded-xl bg-secondary px-3 py-2 text-[12px] font-medium transition-colors hover:bg-secondary/80"
                    >
                      恢复到画布
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 px-5 py-10 text-center">
                <Clock className="mx-auto size-8 text-muted-foreground/40" />
                <p className="mt-3 text-[13px] font-medium">暂无历史记录</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  点击"保存当前画布"创建第一个版本。
                </p>
              </div>
            )}
          </div>
        )}

        {activePanel === 'settings' && (
          <SettingsContent
            theme={theme!}
            edgeStyleType={edgeStyleType}
            setTheme={setTheme}
            setLineStyle={setLineStyle}
            nodes={nodes}
            edges={edges}
            nodeCount={nodeCount}
            loadCanvas={loadCanvas}
            resetCanvas={resetCanvas}
            fitView={fitView}
            setNotice={setNotice}
          />
        )}
      </div>
        ) : (
          <div className="flex-1 min-h-0">
            <MaterialLibraryContent
              onAddMaterial={(m) => {
                onAddMaterial({ type: m.type, title: m.title, url: m.url, meta: m.meta })
                onClose()
              }}
            />
          </div>
        )}
    </div>
    </div>
  )
}

/* ─── Settings Panel with left tabs + right content ─── */

function SettingsContent({
  theme, edgeStyleType, setTheme, setLineStyle, nodes, edges, nodeCount,
  loadCanvas, resetCanvas, fitView, setNotice,
}: {
  theme: string
  edgeStyleType: 'curve' | 'straight'
  setTheme: (v: 'light' | 'dark') => void
  setLineStyle: (v: 'curve' | 'straight') => void
  nodes: { id: string }[]
  edges: { id: string }[]
  nodeCount: Record<string, number>
  loadCanvas: (s: WorkflowSnapshot) => void
  resetCanvas: () => void
  fitView: (opts?: { duration?: number; padding?: number }) => void
  setNotice: (v: string) => void
}) {
  const [tab, setTab] = useState<'appearance' | 'line' | 'canvas' | 'apikey' | 'about'>('appearance')

  const settingTabs = [
    { id: 'appearance' as const, label: '外观主题', icon: theme === 'light' ? Sun : Moon },
    { id: 'line' as const,       label: '连线样式', icon: Route },
    { id: 'canvas' as const,     label: '画布管理', icon: RotateCcw },
    { id: 'apikey' as const,     label: 'API 密钥', icon: Key },
    { id: 'about' as const,      label: '版权信息', icon: Info },
  ]

  return (
    <div className="flex gap-6">
      {/* Left: setting tabs */}
      <div className="flex w-[140px] shrink-0 flex-col gap-1">
        {settingTabs.map((st) => {
          const Icon = st.icon
          return (
            <button
              key={st.id}
              onClick={() => setTab(st.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-medium transition-colors',
                tab === st.id
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              )}
            >
              <Icon className="size-4" />
              <span>{st.label}</span>
            </button>
          )
        })}
      </div>

      {/* Right: tab content */}
      <div className="flex-1 min-w-0">
        {tab === 'appearance' && (
          <div className="space-y-4">
            <p className="text-[12px] text-muted-foreground">选择浅色或深色工作台主题，立即生效。</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTheme('dark')}
                className={cn(
                  'flex flex-col items-center gap-3 rounded-2xl border p-5 transition-all',
                  theme === 'dark'
                    ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border/40 bg-muted/10 hover:bg-muted/20'
                )}
              >
                <div className={cn(
                  'flex size-12 items-center justify-center rounded-2xl transition-colors',
                  theme === 'dark' ? 'bg-primary/20 text-primary' : 'bg-muted/30 text-muted-foreground'
                )}>
                  <Moon className="size-6" />
                </div>
                <span className={cn(
                  'text-[12px] font-semibold',
                  theme === 'dark' ? 'text-primary' : 'text-muted-foreground'
                )}>深色</span>
                {theme === 'dark' && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">当前</span>
                )}
              </button>
              <button
                onClick={() => setTheme('light')}
                className={cn(
                  'flex flex-col items-center gap-3 rounded-2xl border p-5 transition-all',
                  theme === 'light'
                    ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border/40 bg-muted/10 hover:bg-muted/20'
                )}
              >
                <div className={cn(
                  'flex size-12 items-center justify-center rounded-2xl transition-colors',
                  theme === 'light' ? 'bg-primary/20 text-primary' : 'bg-muted/30 text-muted-foreground'
                )}>
                  <Sun className="size-6" />
                </div>
                <span className={cn(
                  'text-[12px] font-semibold',
                  theme === 'light' ? 'text-primary' : 'text-muted-foreground'
                )}>浅色</span>
                {theme === 'light' && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">当前</span>
                )}
              </button>
            </div>
          </div>
        )}

        {tab === 'line' && (
          <div className="space-y-4">
            <p className="text-[12px] text-muted-foreground">节点之间连接线的默认形态。</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLineStyle('curve')}
                className={cn(
                  'flex flex-col items-center gap-3 rounded-2xl border p-5 transition-all',
                  edgeStyleType === 'curve'
                    ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border/40 bg-muted/10 hover:bg-muted/20'
                )}
              >
                <div className={cn(
                  'flex size-12 items-center justify-center rounded-2xl transition-colors',
                  edgeStyleType === 'curve' ? 'bg-primary/20 text-primary' : 'bg-muted/30 text-muted-foreground'
                )}>
                  <GitBranch className="size-6" />
                </div>
                <span className={cn(
                  'text-[12px] font-semibold',
                  edgeStyleType === 'curve' ? 'text-primary' : 'text-muted-foreground'
                )}>贝塞尔曲线</span>
                {edgeStyleType === 'curve' && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">当前</span>
                )}
              </button>
              <button
                onClick={() => setLineStyle('straight')}
                className={cn(
                  'flex flex-col items-center gap-3 rounded-2xl border p-5 transition-all',
                  edgeStyleType === 'straight'
                    ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border/40 bg-muted/10 hover:bg-muted/20'
                )}
              >
                <div className={cn(
                  'flex size-12 items-center justify-center rounded-2xl transition-colors',
                  edgeStyleType === 'straight' ? 'bg-primary/20 text-primary' : 'bg-muted/30 text-muted-foreground'
                )}>
                  <Route className="size-6" />
                </div>
                <span className={cn(
                  'text-[12px] font-semibold',
                  edgeStyleType === 'straight' ? 'text-primary' : 'text-muted-foreground'
                )}>直线</span>
                {edgeStyleType === 'straight' && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">当前</span>
                )}
              </button>
            </div>
          </div>
        )}

        {tab === 'canvas' && (
          <div className="space-y-4">
            <p className="text-[12px] text-muted-foreground">导出、导入或重置当前工作流。</p>
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    const snapshot = { nodes, edges, nodeCount }
                    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `ai-canvas-${new Date().toISOString().slice(0, 10)}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                    setNotice('工作流已导出')
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border/60 px-3 py-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                >
                  <Download className="size-4" />
                  导出 JSON
                </button>
                <button
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = '.json'
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = () => {
                        try {
                          const data = JSON.parse(reader.result as string)
                          if (data.nodes && data.edges) {
                            loadCanvas(data)
                            setNotice('工作流已导入')
                            requestAnimationFrame(() => fitView({ duration: 300, padding: 0.18 }))
                          }
                        } catch { setNotice('导入失败：JSON 格式错误') }
                      }
                      reader.readAsText(file)
                    }
                    input.click()
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border/60 px-3 py-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                >
                  <Upload className="size-4" />
                  导入 JSON
                </button>
              </div>
              <button
                onClick={() => {
                  resetCanvas()
                  setNotice('画布已重置')
                  requestAnimationFrame(() => fitView({ duration: 300, padding: 0.18 }))
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 px-3 py-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
              >
                <RotateCcw className="size-4" />
                重置示例工作流
              </button>
            </div>
          </div>
        )}

        {tab === 'apikey' && (
          <ApiKeySettings />
        )}

        {tab === 'about' && (
          <AboutContent />
        )}
      </div>
    </div>
  )
}

/* ─── About / Copyright ─── */

function AboutContent() {
  const [qrEnlarged, setQrEnlarged] = useState(false)

  return (
    <div className="space-y-5">
      <p className="text-[12px] text-muted-foreground">AI 画布工作台 — 节点式 AI 创作工作流平台</p>

      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
          <User className="size-4 shrink-0 text-primary" />
          <div className="text-[13px]">
            <span className="text-muted-foreground/60">作者：</span>
            <span className="font-medium text-foreground">北山</span>
          </div>
        </div>

        <a
          href="mailto:blacklaw@foxmail.com"
          className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3 transition-colors hover:bg-muted/20"
        >
          <Mail className="size-4 shrink-0 text-primary" />
          <div className="text-[13px]">
            <span className="text-muted-foreground/60">邮箱：</span>
            <span className="font-medium text-foreground">blacklaw@foxmail.com</span>
          </div>
        </a>

        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
          <MessageCircle className="size-4 shrink-0 text-primary" />
          <div className="text-[13px]">
            <span className="text-muted-foreground/60">微信：</span>
            <span className="font-medium text-foreground">BEISHAN5678</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[12px] text-muted-foreground">微信二维码（点击放大）</p>
        <button
          onClick={() => setQrEnlarged(true)}
          className="group overflow-hidden rounded-xl border border-border/40 bg-white p-2 transition-all hover:border-primary/40 hover:shadow-lg"
        >
          <img
            src="/weichat-qr.svg"
            alt="微信二维码"
            className="size-36 transition-transform group-hover:scale-105"
          />
        </button>
      </div>

      {qrEnlarged && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setQrEnlarged(false)}
        >
          <div className="relative rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src="/weichat-qr.svg" alt="微信二维码" className="size-80" />
            <button
              onClick={() => setQrEnlarged(false)}
              className="absolute -right-3 -top-3 flex size-8 items-center justify-center rounded-full bg-black/80 text-white shadow-lg transition-colors hover:bg-black"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

/* ─── API Key Settings Component ─── */

const PROVIDER_DOCS: Record<string, string> = {
  openai: 'https://platform.openai.com/api-keys',
  deepseek: 'https://platform.deepseek.com/api_keys',
  qwen: 'https://dashscope.console.aliyun.com/apiKey',
  kimi: 'https://platform.moonshot.cn/console/api-keys',
  volces: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
  zhipu: 'https://open.bigmodel.cn/usercenter/apikeys',
}

const PROVIDER_DESC: Record<string, string> = {
  openai: 'GPT-4o · DALL-E 3 · o4 推理',
  deepseek: 'V4 Pro · V4 Flash · 高性价比',
  qwen: '通义千问 · 万相生图 · CosyVoice',
  kimi: 'Moonshot · 超长上下文 · 200K',
  volces: '豆包 · 即梦生图 · Seedance 视频',
  zhipu: 'GLM-4 · CogView · CogVideoX',
}

function ApiKeySettings() {
  const [providers, setProviders] = useState<ProviderConfigUI[]>([])
  const [allModels, setAllModels] = useState<ModelMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saveResult, setSaveResult] = useState<{ id: string; ok: boolean } | null>(null)
  const [activeProvider, setActiveProvider] = useState('')
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({})

  const [keys, setKeys] = useState<Record<string, string>>({})
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [enabledProviders, setEnabledProviders] = useState<Record<string, boolean>>({})
  const [disabledModels, setDisabledModels] = useState<Record<string, string[]>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [configRes, modelsRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/models'),
      ])
      const configData = await configRes.json()
      const modelsData = await modelsRes.json()

      const provs: ProviderConfigUI[] = configData.configs || []
      const metas: ModelMeta[] = modelsData.models || []

      setProviders(provs)
      setAllModels(metas)

      const k: Record<string, string> = {}
      const sk: Record<string, boolean> = {}
      const ep: Record<string, boolean> = {}
      const dm: Record<string, string[]> = {}

      for (const p of provs) {
        k[p.id] = ''
        sk[p.id] = false
        ep[p.id] = p.enabled
        dm[p.id] = [...(p.disabledModels || [])]
      }

      setKeys(k)
      setShowKeys(sk)
      setEnabledProviders(ep)
      setDisabledModels(dm)

      if (provs.length > 0 && !activeProvider) {
        setActiveProvider(provs[0].id)
      }
    } catch (err) {
      console.error('Failed to load config:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const saveProvider = async (providerId: string) => {
    setSaving(providerId)
    setSaveResult(null)
    try {
      const body: Record<string, unknown> = { providerId }
      if (keys[providerId]) {
        body.apiKey = keys[providerId]
      }
      body.enabled = enabledProviders[providerId]
      const originalDM = providers.find((p) => p.id === providerId)?.disabledModels || []
      const currentDM = disabledModels[providerId] || []
      if (JSON.stringify([...originalDM].sort()) !== JSON.stringify([...currentDM].sort())) {
        body.disabledModels = currentDM
      }

      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Save failed')

      setSaveResult({ id: providerId, ok: true })
      await fetchData()
      setTimeout(() => setSaveResult(null), 2500)
    } catch (err) {
      console.error('Save error:', err)
      setSaveResult({ id: providerId, ok: false })
      setTimeout(() => setSaveResult(null), 3000)
    } finally {
      setSaving(null)
    }
  }

  const toggleModel = (providerId: string, modelId: string) => {
    setDisabledModels((prev) => {
      const current = prev[providerId] || []
      const idx = current.indexOf(modelId)
      if (idx >= 0) {
        return { ...prev, [providerId]: current.filter((m) => m !== modelId) }
      } else {
        return { ...prev, [providerId]: [...current, modelId] }
      }
    })
  }

  const toggleProvider = (providerId: string) => {
    setEnabledProviders((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }))
  }

  const getModelsByProvider = (providerId: string) => {
    return allModels.filter((m) => m.provider === providerId)
  }

  const getModelsByType = (models: ModelMeta[]) => {
    const groups: Record<string, ModelMeta[]> = {}
    for (const m of models) {
      if (!groups[m.type]) groups[m.type] = []
      groups[m.type].push(m)
    }
    return groups
  }

  const configuredCount = providers.filter((p) => p.hasKey).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="size-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold">AI 服务商配置</div>
          <div className="text-[11px] text-muted-foreground">
            已配置 <span className="text-primary font-medium">{configuredCount}</span>/{providers.length} 个服务商
            <span className="mx-1.5 text-border">|</span>
            密钥仅保存在服务端运行时内存
          </div>
        </div>
      </div>

      {/* Provider cards list */}
      <div className="grid grid-cols-3 gap-1.5">
        {providers.map((p) => {
          const isActive = activeProvider === p.id
          return (
            <button
              key={p.id}
              onClick={() => setActiveProvider(p.id)}
              className={cn(
                'relative flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-center transition-all',
                isActive
                  ? 'bg-primary/10 ring-1 ring-primary/30'
                  : 'bg-muted/15 hover:bg-muted/30'
              )}
            >
              <div className={cn(
                'absolute right-1.5 top-1.5 size-1.5 rounded-full',
                p.hasKey ? 'bg-emerald-500' : 'bg-muted-foreground/20'
              )} />
              <span className={cn(
                'text-[11px] font-semibold leading-tight',
                isActive ? 'text-primary' : 'text-foreground/80'
              )}>
                {p.name}
              </span>
              <span className="text-[9px] text-muted-foreground/70 leading-tight line-clamp-1">
                {PROVIDER_DESC[p.id] || ''}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active provider detail */}
      {providers.map((p) => {
        if (activeProvider !== p.id) return null
        const providerModels = getModelsByProvider(p.id)
        const modelsByType = getModelsByType(providerModels)
        const isChecked = enabledProviders[p.id] ?? p.enabled

        return (
          <div key={p.id} className="space-y-3">
            {/* Provider header card */}
            <div className="rounded-xl border border-border/30 bg-muted/10 overflow-hidden">
              {/* Top row: name + enable toggle */}
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    'flex size-7 items-center justify-center rounded-lg',
                    p.hasKey ? 'bg-emerald-500/10' : 'bg-muted/30'
                  )}>
                    {p.hasKey ? <ShieldCheck className="size-3.5 text-emerald-500" /> : <Shield className="size-3.5 text-muted-foreground" />}
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold">{p.name}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Globe className="size-2.5" />
                      <span className="truncate max-w-[180px]">{p.baseUrl}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleProvider(p.id)}
                  className={cn(
                    'relative h-5 w-9 rounded-full transition-colors',
                    isChecked ? 'bg-primary' : 'bg-muted-foreground/20'
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform',
                    isChecked && 'translate-x-4'
                  )} />
                </button>
              </div>

              {/* API Key input area */}
              <div className="border-t border-border/20 px-3.5 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                    <Key className="size-3" />
                    API Key
                    {p.hasKey && <span className="text-emerald-500 font-semibold">· 已配置</span>}
                  </span>
                  {PROVIDER_DOCS[p.id] && (
                    <a
                      href={PROVIDER_DOCS[p.id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 text-[10px] text-primary/70 hover:text-primary transition-colors"
                    >
                      获取密钥 <ExternalLink className="size-2.5" />
                    </a>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type={showKeys[p.id] ? 'text' : 'password'}
                      value={keys[p.id]}
                      onChange={(e) => setKeys((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder={p.hasKey ? p.apiKey : '输入 API Key…'}
                      className="w-full rounded-lg border border-border/40 bg-background/60 px-2.5 py-1.5 pr-8 text-[11px] font-mono outline-none transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                    />
                    <button
                      onClick={() => setShowKeys((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      {showKeys[p.id] ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    </button>
                  </div>
                  <button
                    onClick={() => saveProvider(p.id)}
                    disabled={saving === p.id}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all shrink-0',
                      saveResult?.id === p.id && saveResult.ok
                        ? 'bg-emerald-500 text-white'
                        : saveResult?.id === p.id && !saveResult.ok
                          ? 'bg-destructive text-white'
                          : 'bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50'
                    )}
                  >
                    {saving === p.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : saveResult?.id === p.id && saveResult.ok ? (
                      <><Check className="size-3.5" /> 已保存</>
                    ) : saveResult?.id === p.id && !saveResult.ok ? (
                      '失败'
                    ) : (
                      <><Save className="size-3" /> 保存</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Models section */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80">
                <Zap className="size-3.5" />
                可用模型
                <span className="text-muted-foreground/50 font-normal ml-0.5">
                  {providerModels.length} 个
                </span>
              </div>

              {TYPE_ORDER.map((type) => {
                const models = modelsByType[type]
                if (!models || models.length === 0) return null
                const typeKey = `${p.id}-${type}`
                const isExpanded = expandedTypes[typeKey] !== false

                const enabledCount = models.filter(
                  (m) => !(disabledModels[p.id] || []).includes(m.id)
                ).length
                const allEnabled = enabledCount === models.length

                return (
                  <div key={type} className="rounded-xl border border-border/20 overflow-hidden">
                    {/* Type header */}
                    <button
                      onClick={() => setExpandedTypes((prev) => ({ ...prev, [typeKey]: !isExpanded }))}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/10 transition-colors"
                    >
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        {TYPE_ICON[type]}
                        {TYPE_LABEL[type]}
                      </span>
                      <span className={cn(
                        'ml-auto rounded-md px-1.5 py-0.5 text-[9px] font-semibold',
                        allEnabled
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : enabledCount > 0
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-muted/30 text-muted-foreground'
                      )}>
                        {enabledCount}/{models.length}
                      </span>
                      <ChevronRight className={cn(
                        'size-3 text-muted-foreground/50 transition-transform',
                        isExpanded && 'rotate-90'
                      )} />
                    </button>

                    {/* Model list */}
                    {isExpanded && (
                      <div className="border-t border-border/15">
                        {/* Batch toggle */}
                        <div className="flex items-center justify-end px-3 py-1">
                          <button
                            onClick={() => {
                              const newDisabled = allEnabled
                                ? [...(disabledModels[p.id] || []), ...models.map((m) => m.id)]
                                : (disabledModels[p.id] || []).filter((id) => !models.some((m) => m.id === id))
                              setDisabledModels((prev) => ({ ...prev, [p.id]: newDisabled }))
                            }}
                            className="text-[9px] text-muted-foreground/60 hover:text-primary transition-colors"
                          >
                            {allEnabled ? '全部禁用' : '全部启用'}
                          </button>
                        </div>
                        {models.map((model) => {
                          const isModelEnabled = !(disabledModels[p.id] || []).includes(model.id)
                          return (
                            <label
                              key={model.id}
                              className={cn(
                                'flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all border-t border-border/10',
                                isModelEnabled ? 'hover:bg-muted/10' : 'opacity-35'
                              )}
                            >
                              <button
                                onClick={(e) => { e.preventDefault(); toggleModel(p.id, model.id) }}
                                className={cn(
                                  'flex size-4 shrink-0 items-center justify-center rounded transition-all',
                                  isModelEnabled
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'border-2 border-border/30'
                                )}
                              >
                                {isModelEnabled && <Check className="size-2.5" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-medium">{model.name}</span>
                                  {model.tags?.map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded px-1 py-px text-[8px] font-semibold bg-primary/8 text-primary/70"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                                {model.description && (
                                  <div className="text-[9.5px] text-muted-foreground/70 truncate mt-0.5">
                                    {model.description}
                                  </div>
                                )}
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {providerModels.length === 0 && (
                <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border/30 py-4 text-center">
                  <span className="text-[10px] text-muted-foreground">暂无已注册模型</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
