'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Plus,
  LayoutTemplate,
  Clock,
  Settings,
  X,
  AlignLeft,
  ImageIcon,
  Video,
  FileCode2,
  Clapperboard,
  Upload,
  Image as ImageLibrary,
  Search,
  MessageSquareText,
  Wand
} from 'lucide-react'
import { NodeType, useFlowStore } from '@/lib/store'
import { useReactFlow } from '@xyflow/react'
import { CanvasMenuPanelType } from './canvas-menu-panel'
import { cn } from '@/lib/utils'

interface SidebarToolbarProps {
  activePanel: CanvasMenuPanelType | null
  onOpenPanel: (panel: CanvasMenuPanelType) => void
  onOpenMaterials: () => void
}

const nodeOptions: {
  type: NodeType
  label: string
  icon: typeof AlignLeft
  color: string
  bgClass: string
  beta?: boolean
}[] = [
  { type: 'text',           label: 'AI 文本',  icon: AlignLeft,   color: 'text-amber-400',   bgClass: 'bg-amber-500/10' },
  { type: 'image',          label: 'AI 生图',  icon: ImageIcon,   color: 'text-blue-400',    bgClass: 'bg-blue-500/10' },
  { type: 'video',          label: 'AI 视频',  icon: Video,       color: 'text-violet-400',  bgClass: 'bg-violet-500/10' },
  { type: 'script',         label: '分镜脚本', icon: FileCode2,      color: 'text-orange-400',  bgClass: 'bg-orange-500/10' },
  { type: 'scene',          label: '分镜',     icon: Clapperboard,  color: 'text-cyan-400',    bgClass: 'bg-cyan-500/10' },
  { type: 'promptAssistant', label: '提示词助手', icon: MessageSquareText, color: 'text-emerald-400', bgClass: 'bg-emerald-500/10' },
]

const toolbarItems = [
  { id: 'templates'  as const, icon: LayoutTemplate, label: '模板工作流',  shortcut: 'T' },
  { id: 'history'    as const, icon: Clock,           label: '历史记录',    shortcut: 'H' },
  { id: 'materials'  as const, icon: ImageLibrary,    label: '素材库',      shortcut: 'M' },
  { id: 'settings'   as const, icon: Settings,        label: '画布设置',    shortcut: ',' },
]

/** 根据 MIME 类型判断节点类型 */
function getNodeTypeFromFile(file: File): NodeType | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return null
}

export function SidebarToolbar({ onOpenMaterials, activePanel, onOpenPanel }: SidebarToolbarProps) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const addNode = useFlowStore((state) => state.addNode)
  const { screenToFlowPosition } = useReactFlow()

  // ── Close add menu on outside click ──
  useEffect(() => {
    if (!showAddMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
        setSearchQuery('')
      }
    }
    // Delay listener to avoid immediate close on the same click
    const id = window.setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { window.clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [showAddMenu])

  // ── Close on Escape ──
  useEffect(() => {
    if (!showAddMenu) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowAddMenu(false); setSearchQuery('') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showAddMenu])

  const handleAddNode = useCallback((type: NodeType) => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    addNode(type, position)
    setShowAddMenu(false)
    setSearchQuery('')
  }, [addNode, screenToFlowPosition])

  const handleDragStart = (event: React.DragEvent, type: NodeType) => {
    event.dataTransfer.setData('application/reactflow', type)
    event.dataTransfer.effectAllowed = 'move'
  }

  const filteredNodeOptions = searchQuery.trim()
    ? nodeOptions.filter((opt) => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : nodeOptions

  /** 处理文件 → 创建节点 */
  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files)
    arr.forEach((file, i) => {
      const nodeType = getNodeTypeFromFile(file)
      if (!nodeType) return

      const url = URL.createObjectURL(file)
      const position = screenToFlowPosition({
        x: window.innerWidth / 2 + i * 40,
        y: window.innerHeight / 2 + i * 40,
      })

      const mediaData =
        nodeType === 'image' ? { imageUrl: url }
        : nodeType === 'video' ? { videoUrl: url }
        : { audioUrl: url }

      addNode(nodeType, position, {
        label: file.name.replace(/\.[^.]+$/, ''),
        status: 'ready',
        mode: 'input',
        meta: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        ...mediaData,
      })
    })
    setShowAddMenu(false)
  }, [addNode, screenToFlowPosition])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files)
    e.target.value = ''
  }

  return (
    <div className="fixed left-1/2 bottom-6 z-50 -translate-x-1/2 flex flex-col items-center gap-3">
      {/* ── Main Toolbar Pill ── */}
      <div className="glass flex items-center gap-0.5 rounded-full px-1.5 py-1.5 shadow-2xl ring-1 ring-border/40">
        {/* Add Node Button */}
        <div className="relative" ref={menuRef}>
          <PillButton
            icon={showAddMenu ? X : Plus}
            label={showAddMenu ? '关闭菜单' : '添加节点'}
            shortcut="N"
            active={showAddMenu}
            onClick={() => { setShowAddMenu(!showAddMenu); setSearchQuery('') }}
            rotate={showAddMenu}
          />

          {/* ── Flyout Add Menu ── */}
          {showAddMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[320px] glass rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 zoom-in-95 duration-150 origin-bottom">
              {/* Search */}
              <div className="px-3 pt-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索节点类型…"
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full rounded-xl border border-border/40 bg-muted/30 py-2 pl-8 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none"
                  />
                </div>
              </div>

              {/* Node type list */}
              <div className="px-2 pt-2 pb-1">
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  AI 工具节点
                </div>
                {filteredNodeOptions.map((opt) => (
                  <button
                    key={opt.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, opt.type)}
                    onClick={() => handleAddNode(opt.type)}
                    title="点击添加 · 可拖拽到画布指定位置"
                    className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all duration-150 hover:bg-muted/60 active:scale-[0.98]"
                  >
                    <div className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                      opt.bgClass
                    )}>
                      <opt.icon className={cn('size-3.5', opt.color)} />
                    </div>
                    <span className="flex-1 text-left text-[12.5px] font-medium">{opt.label}</span>
                    {opt.beta && (
                      <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-blue-400">
                        Beta
                      </span>
                    )}
                    <span className="text-[9px] text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
                      ⌘
                    </span>
                  </button>
                ))}
                {filteredNodeOptions.length === 0 && (
                  <div className="py-6 text-center text-[11px] text-muted-foreground/60">
                    没有匹配的节点类型
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="mx-3 my-1 border-t border-border/40" />

              {/* Resource section */}
              <div className="px-2 pb-3 pt-1">
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  素材导入
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all duration-150 hover:bg-muted/60 active:scale-[0.98]"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/60 group-hover:bg-muted transition-colors">
                    <Upload className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[12.5px] font-medium">上传文件</span>
                    <span className="text-[10px] text-muted-foreground/60">图片 · 视频 · 音频</span>
                  </div>
                </button>

                <button
                  onClick={() => { onOpenMaterials(); setShowAddMenu(false) }}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all duration-150 hover:bg-muted/60 active:scale-[0.98]"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/60 group-hover:bg-muted transition-colors">
                    <ImageLibrary className="size-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-[12.5px] font-medium">从素材库选择</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pill divider dot */}
        <span className="mx-1 h-4 w-px bg-border/40" />

        {/* Tool Items */}
        {toolbarItems.map((item) => (
          <PillButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            shortcut={item.shortcut}
            active={activePanel === item.id}
            onClick={() => onOpenPanel(item.id)}
          />
        ))}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>

      {/* ── Keyboard shortcut hints ── */}
      <div className="hidden xl:block">
        <div className="glass rounded-full px-4 py-1.5 text-[10px] text-muted-foreground/50">
          <kbd className="font-mono text-[10px]">N</kbd> 添加  ·  <kbd className="font-mono text-[10px]">Ctrl+Z</kbd> 撤销  ·  <kbd className="font-mono text-[10px]">Del</kbd> 删除
        </div>
      </div>
    </div>
  )
}

/* ─── Pill Button for horizontal capsule toolbar ─── */

function PillButton({
  icon: Icon,
  label,
  shortcut,
  active,
  onClick,
  rotate,
}: {
  icon: typeof Plus
  label: string
  shortcut?: string
  active?: boolean
  onClick?: () => void
  rotate?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group/pb relative flex size-9 items-center justify-center rounded-full transition-all duration-200',
        active
          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      )}
    >
      <span className={cn(
        'flex transition-transform duration-200',
        rotate && 'rotate-45',
        !active && 'group-hover/pb:scale-110'
      )}>
        <Icon className="size-4" />
      </span>

      {/* ── Floating tooltip above pill ── */}
      <div className={cn(
        'pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2',
        'flex items-center gap-2 rounded-xl bg-popover px-3 py-1.5 shadow-xl border border-border/50',
        'opacity-0 translate-y-1 transition-all duration-200',
        'group-hover/pb:opacity-100 group-hover/pb:translate-y-0',
        active && '!opacity-0',
      )}>
        <span className="whitespace-nowrap text-[12px] font-medium text-foreground">{label}</span>
        {shortcut && (
          <kbd className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {shortcut}
          </kbd>
        )}
        {/* Arrow */}
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-[5px] border-transparent border-t-popover" />
      </div>
    </button>
  )
}
