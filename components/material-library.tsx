'use client'

import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import {
  AudioLines, ImageIcon, Search, Sparkles, Video, X, Upload,
  Plus, Trash2, Pencil, Tag, Loader2, MoreVertical, Check,
} from 'lucide-react'
import { NodeType } from '@/lib/store'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

export interface MaterialItem {
  id: string
  title: string
  type: NodeType
  category: string
  thumbnail?: string
  url?: string
  meta: string
  filename?: string
  size?: number
  createdAt?: string
}

interface Category {
  id: string
  label: string
}

interface ApiMaterial {
  id: string
  title: string
  type: string
  category: string
  url: string
  thumbnail?: string
  filename: string
  size: number
  mimeType: string
  createdAt: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, typeof ImageIcon> = {
  image: ImageIcon, video: Video, audio: AudioLines,
  text: Sparkles, script: Sparkles, scene: Video, promptAssistant: Sparkles,
}
const TYPE_COLORS: Record<string, string> = {
  image: 'text-blue-400', video: 'text-violet-400', audio: 'text-emerald-400',
  text: 'text-amber-400', script: 'text-orange-400', scene: 'text-cyan-400',
  promptAssistant: 'text-emerald-400',
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function toMaterialItem(m: ApiMaterial, categories: Category[]): MaterialItem {
  const catLabel = categories.find((c) => c.id === m.category)?.label ?? m.category
  return {
    id: m.id,
    title: m.title,
    type: m.type as NodeType,
    category: m.category,
    thumbnail: m.thumbnail,
    url: m.url,
    meta: [formatSize(m.size), catLabel].filter(Boolean).join(' · '),
    filename: m.filename,
    size: m.size,
    createdAt: m.createdAt,
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function MaterialLibraryContent({ onAddMaterial }: {
  onAddMaterial: (material: MaterialItem) => void
}) {
  const [rawMaterials, setRawMaterials] = useState<ApiMaterial[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState('all')
  const [query, setQuery] = useState('')
  const [uploading, setUploading] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [menuId, setMenuId] = useState<string | null>(null)
  const [categoryPickId, setCategoryPickId] = useState<string | null>(null)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCatLabel, setNewCatLabel] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch ─────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch('/api/materials')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRawMaterials(data.materials || [])
      setCategories(data.categories || [])
    } catch { /* show empty */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Derived ───────────────────────────────────────
  const materials = useMemo(
    () => rawMaterials.map((m) => toMaterialItem(m, categories)),
    [rawMaterials, categories],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return materials.filter((m) => {
      const matchTab = activeTab === 'all' || m.category === activeTab
      const matchQ = !q || `${m.title} ${m.meta}`.toLowerCase().includes(q)
      return matchTab && matchQ
    })
  }, [materials, activeTab, query])

  const tabs = useMemo(
    () => [{ id: 'all', label: '全部' }, ...categories],
    [categories],
  )

  // ── Upload ────────────────────────────────────────
  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/'),
    )
    if (!arr.length) return
    setUploading((n) => n + arr.length)
    for (const file of arr) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('category', activeTab !== 'all' ? activeTab : 'other')
        const res = await fetch('/api/materials', { method: 'POST', body: fd })
        if (!res.ok) throw new Error()
        const mat: ApiMaterial = await res.json()
        setRawMaterials((prev) => [mat, ...prev])
      } catch (err) {
        console.error('素材上传失败:', err)
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }, [activeTab])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) uploadFiles(e.target.files)
    e.target.value = ''
  }

  // ── Management ────────────────────────────────────
  const renameMaterial = async (id: string, title: string) => {
    setEditingId(null)
    if (!title.trim()) return
    setRawMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, title: title.trim() } : m)))
    await fetch('/api/materials', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title: title.trim() }),
    })
  }

  const deleteMaterial = async (id: string) => {
    setRawMaterials((prev) => prev.filter((m) => m.id !== id))
    setMenuId(null)
    await fetch(`/api/materials?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  const changeCategory = async (id: string, category: string) => {
    setRawMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, category } : m)))
    setCategoryPickId(null)
    setMenuId(null)
    await fetch('/api/materials', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, category }),
    })
  }

  const addCategory = async () => {
    const label = newCatLabel.trim()
    if (!label) { setAddingCategory(false); return }
    const id = label.toLowerCase().replace(/[^a-z0-9一-鿿]+/gi, '-').replace(/^-|-$/g, '') || `cat-${Date.now()}`
    if (categories.some((c) => c.id === id)) { setAddingCategory(false); setNewCatLabel(''); return }
    setCategories((prev) => [...prev, { id, label }])
    setAddingCategory(false)
    setNewCatLabel('')
    await fetch('/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add-category', id, label }),
    })
  }

  const deleteCategory = async (catId: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== catId))
    setRawMaterials((prev) => prev.map((m) => (m.category === catId ? { ...m, category: 'other' } : m)))
    if (activeTab === catId) setActiveTab('all')
    await fetch('/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-category', id: catId }),
    })
  }

  // ── Drag-drop ─────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.types.includes('Files')) setDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
  }

  // Close menus on outside click
  useEffect(() => {
    if (!menuId && !categoryPickId) return
    const handler = () => { setMenuId(null); setCategoryPickId(null) }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [menuId, categoryPickId])

  useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  // ── Render ────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5 shrink-0">
        <h2 className="text-[14px] font-semibold">我的素材</h2>
        <div className="flex items-center gap-2">
          {uploading > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              上传中 ({uploading})
            </span>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Upload className="size-3.5" />
            上传
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-border/40 px-5 py-3 shrink-0">
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索素材名称…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/50"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border/40 px-5 py-2.5 shrink-0">
        {tabs.map((tab) => (
          <div key={tab.id} className="group/tab relative shrink-0">
            <button
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[12px] transition-colors',
                activeTab === tab.id
                  ? 'bg-secondary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
            {tab.id !== 'all' && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteCategory(tab.id) }}
                className="absolute -right-1 -top-1 hidden size-4 items-center justify-center rounded-full bg-muted-foreground/80 text-background transition-colors hover:bg-destructive group-hover/tab:flex"
                title="删除分类"
              >
                <X className="size-2.5" />
              </button>
            )}
          </div>
        ))}
        {addingCategory ? (
          <input
            value={newCatLabel}
            onChange={(e) => setNewCatLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addCategory()
              if (e.key === 'Escape') { setAddingCategory(false); setNewCatLabel('') }
            }}
            onBlur={addCategory}
            placeholder="分类名称"
            className="w-20 shrink-0 rounded-lg border border-border/50 bg-muted/30 px-2 py-1 text-[12px] outline-none focus:border-primary/40"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setAddingCategory(true)}
            className="shrink-0 flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            title="添加分类"
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>

      {/* Grid area */}
      <div
        className="relative flex-1 min-h-0 overflow-y-auto p-5"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <Upload className="size-8 text-primary/60" />
              <p className="text-[14px] font-medium text-primary/80">拖放文件到这里上传</p>
              <p className="text-[12px] text-muted-foreground">支持图片、视频、音频</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {/* Upload card */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="group flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 transition-colors hover:border-border hover:bg-muted/40"
              >
                <div className="flex size-9 items-center justify-center rounded-xl bg-muted/60 transition-colors group-hover:bg-muted">
                  <Plus className="size-4 text-muted-foreground" />
                </div>
                <span className="text-[11px] text-muted-foreground">上传素材</span>
              </button>

              {filtered.map((material) => {
                const Icon = TYPE_ICONS[material.type] || ImageIcon
                const iconColor = TYPE_COLORS[material.type] || 'text-muted-foreground'
                const catLabel = categories.find((c) => c.id === material.category)?.label
                const isEditing = editingId === material.id
                const isMenuOpen = menuId === material.id
                const isCatPick = categoryPickId === material.id

                return (
                  <div
                    key={material.id}
                    className="group relative overflow-hidden rounded-xl border border-border/50 bg-muted/20 text-left transition-all hover:border-border hover:bg-muted/40 hover:shadow-md"
                  >
                    {/* Thumbnail */}
                    <div
                      className="relative aspect-video cursor-pointer bg-muted/50"
                      onClick={() => onAddMaterial(material)}
                    >
                      {material.thumbnail ? (
                        <img
                          src={material.thumbnail}
                          alt={material.title}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Icon className={cn('size-8 opacity-40', iconColor)} />
                        </div>
                      )}
                      {catLabel && (
                        <span className="absolute left-2 top-2 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] text-foreground backdrop-blur-sm">
                          {catLabel}
                        </span>
                      )}
                      {/* Hover menu trigger */}
                      <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuId(isMenuOpen ? null : material.id)
                            setCategoryPickId(null)
                          }}
                          className="flex size-6 items-center justify-center rounded-md bg-background/85 text-foreground backdrop-blur-sm transition-colors hover:bg-background"
                        >
                          <MoreVertical className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-2.5">
                      <div className="mb-1 flex items-center gap-1.5">
                        <Icon className={cn('size-3 shrink-0', iconColor)} />
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') renameMaterial(material.id, editTitle)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            onBlur={() => renameMaterial(material.id, editTitle)}
                            className="min-w-0 flex-1 rounded border border-primary/40 bg-background px-1 py-0.5 text-[12px] font-medium outline-none"
                          />
                        ) : (
                          <span className="truncate text-[12px] font-medium">{material.title}</span>
                        )}
                      </div>
                      <p className="line-clamp-1 text-[10px] leading-relaxed text-muted-foreground">
                        {material.meta}
                      </p>
                    </div>

                    {/* Action menu */}
                    {isMenuOpen && (
                      <div
                        className="absolute right-2 top-8 z-20 w-32 rounded-lg border border-border/60 bg-card p-1 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setEditingId(material.id)
                            setEditTitle(material.title)
                            setMenuId(null)
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-foreground transition-colors hover:bg-muted/60"
                        >
                          <Pencil className="size-3" />
                          重命名
                        </button>
                        <button
                          onClick={() => { setCategoryPickId(material.id); setMenuId(null) }}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-foreground transition-colors hover:bg-muted/60"
                        >
                          <Tag className="size-3" />
                          修改分类
                        </button>
                        <div className="my-1 border-t border-border/30" />
                        <button
                          onClick={() => deleteMaterial(material.id)}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3" />
                          删除
                        </button>
                      </div>
                    )}

                    {/* Category picker */}
                    {isCatPick && (
                      <div
                        className="absolute right-2 top-8 z-20 w-32 max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-card p-1 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="px-2.5 py-1 text-[10px] font-medium text-muted-foreground">移动到分类</p>
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => changeCategory(material.id, cat.id)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition-colors hover:bg-muted/60',
                              material.category === cat.id ? 'text-primary font-medium' : 'text-foreground',
                            )}
                          >
                            {material.category === cat.id && <Check className="size-3" />}
                            <span className={material.category === cat.id ? '' : 'pl-5'}>{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 pt-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/40">
                  {query
                    ? <Search className="size-5 text-muted-foreground/50" />
                    : <Upload className="size-5 text-muted-foreground/50" />}
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {query ? '没有找到匹配素材' : '还没有素材，点击上传或拖放文件'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Modal wrapper */
export function MaterialLibrary({ isOpen, onClose, onAddMaterial }: {
  isOpen: boolean
  onClose: () => void
  onAddMaterial: (material: MaterialItem) => void
}) {
  if (!isOpen) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[780px] h-[80vh] flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <MaterialLibraryContent onAddMaterial={onAddMaterial} />
      </div>
    </div>
  )
}
