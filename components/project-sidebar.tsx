'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  FolderOpen,
  Check,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore, Project } from '@/lib/project-store'

export function ProjectSidebar() {
  const {
    projects,
    activeProjectId,
    sidebarCollapsed,
    toggleSidebar,
    createProject,
    renameProject,
    deleteProject,
    switchProject,
    duplicateProject,
    saveCurrentProject,
  } = useProjectStore()

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [renamingId])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    const id = window.setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { window.clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [menuOpenId])

  const startRename = useCallback((p: Project) => {
    setRenamingId(p.id)
    setRenameValue(p.name)
    setMenuOpenId(null)
  }, [])

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      renameProject(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }, [renamingId, renameValue, renameProject])

  const handleCreateProject = () => {
    createProject()
  }

  const handleDelete = (id: string) => {
    deleteProject(id)
    setConfirmDeleteId(null)
    setMenuOpenId(null)
  }

  const handleDuplicate = (id: string) => {
    duplicateProject(id)
    setMenuOpenId(null)
  }

  // Auto-save on interval
  useEffect(() => {
    if (!activeProjectId) return
    const timer = setInterval(() => saveCurrentProject(), 30_000)
    return () => clearInterval(timer)
  }, [activeProjectId, saveCurrentProject])

  // Auto-save on beforeunload
  useEffect(() => {
    const handler = () => saveCurrentProject()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveCurrentProject])

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin} 分钟前`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour} 小时前`
    const diffDay = Math.floor(diffHour / 24)
    if (diffDay < 7) return `${diffDay} 天前`
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  // Collapsed state
  if (sidebarCollapsed) {
    return (
      <div className="fixed left-3 top-1/2 z-40 -translate-y-1/2">
        <button
          onClick={toggleSidebar}
          className="glass flex size-9 items-center justify-center rounded-xl shadow-lg transition-all hover:bg-muted/60"
          title="展开项目面板"
        >
          <PanelLeftOpen className="size-4 text-muted-foreground" />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed left-0 top-0 z-40 flex h-screen w-[240px] flex-col border-r border-border/40 bg-background/95 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="size-4 text-primary" />
          <span className="text-[13px] font-semibold">项目</span>
          <span className="rounded-full bg-muted/60 px-1.5 text-[10px] text-muted-foreground">{projects.length}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleCreateProject}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            title="新建项目"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            onClick={toggleSidebar}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            title="折叠面板"
          >
            <PanelLeftClose className="size-3.5" />
          </button>
        </div>
      </div>

      {/* New project button */}
      <div className="px-2.5 pt-2.5">
        <button
          onClick={handleCreateProject}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border/50 px-3 py-2.5 text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          <Plus className="size-3.5" />
          新建项目
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-2.5 pt-2">
        {projects.length === 0 && (
          <div className="mt-8 text-center">
            <FolderOpen className="mx-auto size-8 text-muted-foreground/20" />
            <p className="mt-2 text-[12px] text-muted-foreground/40">还没有项目</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/30">点击上方按钮新建</p>
          </div>
        )}

        <div className="space-y-1">
          {projects.map((p) => {
            const isActive = p.id === activeProjectId
            const isRenaming = p.id === renamingId
            const isMenuOpen = p.id === menuOpenId
            const isConfirmingDelete = p.id === confirmDeleteId

            return (
              <div
                key={p.id}
                className={cn(
                  'group relative rounded-xl px-2.5 py-2 transition-colors cursor-pointer',
                  isActive
                    ? 'bg-primary/10 ring-1 ring-primary/20'
                    : 'hover:bg-muted/40'
                )}
                onClick={() => {
                  if (!isRenaming && !isConfirmingDelete) switchProject(p.id)
                }}
              >
                {/* Name row */}
                <div className="flex items-center gap-1.5">
                  {isRenaming ? (
                    <input
                      ref={renameRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setRenamingId(null)
                        e.stopPropagation()
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 rounded-md border border-primary/40 bg-background px-1.5 py-0.5 text-[12px] text-foreground outline-none"
                    />
                  ) : (
                    <span className={cn(
                      'flex-1 truncate text-[12px] font-medium',
                      isActive ? 'text-primary' : 'text-foreground/80'
                    )}>
                      {p.name}
                    </span>
                  )}

                  {/* Menu trigger */}
                  {!isRenaming && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpenId(isMenuOpen ? null : p.id)
                        setConfirmDeleteId(null)
                      }}
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-md transition-all',
                        isMenuOpen
                          ? 'bg-muted/60 text-foreground'
                          : 'text-muted-foreground/0 group-hover:text-muted-foreground/60 hover:bg-muted/40'
                      )}
                    >
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Meta row */}
                {!isRenaming && (
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground/50">
                    <span>{formatTime(p.updatedAt)}</span>
                    {p.snapshot && (
                      <span>{p.snapshot.nodes.length} 节点</span>
                    )}
                  </div>
                )}

                {/* Context menu */}
                {isMenuOpen && (
                  <div
                    ref={menuRef}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full z-50 mt-1 w-[140px] overflow-hidden rounded-xl border border-border/40 bg-popover shadow-xl animate-in fade-in zoom-in-95 duration-100"
                  >
                    <button
                      onClick={() => startRename(p)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-foreground/80 transition-colors hover:bg-muted/50"
                    >
                      <Pencil className="size-3" />
                      重命名
                    </button>
                    <button
                      onClick={() => handleDuplicate(p.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-foreground/80 transition-colors hover:bg-muted/50"
                    >
                      <Copy className="size-3" />
                      复制项目
                    </button>
                    <div className="mx-2 border-t border-border/30" />
                    {isConfirmingDelete ? (
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-[11px] text-destructive">确认删除？</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="flex size-5 items-center justify-center rounded bg-destructive text-white"
                          >
                            <Check className="size-3" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="flex size-5 items-center justify-center rounded bg-muted text-muted-foreground"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3" />
                        删除
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/30 px-3 py-2">
        <div className="text-center text-[10px] text-muted-foreground/30">
          数据保存在本地浏览器
        </div>
      </div>
    </div>
  )
}
