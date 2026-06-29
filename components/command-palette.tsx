'use client'

import { useCallback, useEffect, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  AlignLeft,
  Download,
  Clapperboard,
  FileCode2,
  ImageIcon,
  Moon,
  Redo2,
  RotateCcw,
  Sun,
  Undo2,
  Upload,
  Video,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { NodeType, useFlowStore } from '@/lib/store'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { screenToFlowPosition, fitView } = useReactFlow()
  const addNode = useFlowStore((s) => s.addNode)
  const resetCanvas = useFlowStore((s) => s.resetCanvas)
  const undo = useFlowStore((s) => s.undo)
  const redo = useFlowStore((s) => s.redo)
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const nodeCount = useFlowStore((s) => s.nodeCount)
  const loadCanvas = useFlowStore((s) => s.loadCanvas)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const addNodeAtCenter = useCallback(
    (type: NodeType) => {
      const pos = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      addNode(type, pos)
      setOpen(false)
    },
    [addNode, screenToFlowPosition]
  )

  const handleExportJSON = useCallback(() => {
    const snapshot = { nodes, edges, nodeCount }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-canvas-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }, [nodes, edges, nodeCount])

  const handleImportJSON = useCallback(() => {
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
            requestAnimationFrame(() => fitView({ duration: 300, padding: 0.18 }))
          }
        } catch { /* ignore invalid json */ }
      }
      reader.readAsText(file)
    }
    input.click()
    setOpen(false)
  }, [loadCanvas, fitView])

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="命令面板"
      description="搜索命令或节点类型"
    >
      <CommandInput placeholder="搜索命令…" />
      <CommandList>
        <CommandEmpty>没有找到匹配命令</CommandEmpty>

        <CommandGroup heading="添加节点">
          <CommandItem onSelect={() => addNodeAtCenter('text')}>
            <AlignLeft className="text-amber-400" />
            <span>AI 文本</span>
          </CommandItem>
          <CommandItem onSelect={() => addNodeAtCenter('image')}>
            <ImageIcon className="text-blue-400" />
            <span>AI 生图</span>
          </CommandItem>
          <CommandItem onSelect={() => addNodeAtCenter('video')}>
            <Video className="text-violet-400" />
            <span>AI 视频</span>
          </CommandItem>
          <CommandItem onSelect={() => addNodeAtCenter('script')}>
            <FileCode2 className="text-orange-400" />
            <span>AI 编剧</span>
          </CommandItem>
          <CommandItem onSelect={() => addNodeAtCenter('scene')}>
            <Clapperboard className="text-cyan-400" />
            <span>分镜</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="操作">
          <CommandItem onSelect={() => { undo(); setOpen(false) }}>
            <Undo2 />
            <span>撤销</span>
            <CommandShortcut>Ctrl+Z</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { redo(); setOpen(false) }}>
            <Redo2 />
            <span>重做</span>
            <CommandShortcut>Ctrl+Shift+Z</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { fitView({ duration: 300, padding: 0.18 }); setOpen(false) }}>
            <RotateCcw />
            <span>适应画布</span>
            <CommandShortcut>Ctrl+0</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { resetCanvas(); requestAnimationFrame(() => fitView({ duration: 300, padding: 0.18 })); setOpen(false) }}>
            <RotateCcw />
            <span>重置示例工作流</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="工作流">
          <CommandItem onSelect={handleExportJSON}>
            <Download />
            <span>导出工作流 JSON</span>
          </CommandItem>
          <CommandItem onSelect={handleImportJSON}>
            <Upload />
            <span>导入工作流 JSON</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="外观">
          <CommandItem onSelect={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setOpen(false) }}>
            {theme === 'dark' ? <Sun /> : <Moon />}
            <span>切换{theme === 'dark' ? '浅色' : '深色'}主题</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
