'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ModelOption {
  id: string
  name: string
  description: string
  icon?: React.ReactNode
  tags?: string[]
  configured?: boolean
}

interface ModelSelectorProps {
  models: ModelOption[]
  selected: string
  onSelect: (modelId: string) => void
  className?: string
}

export function ModelSelector({ models, selected, onSelect, className }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const initialPos = useRef({ top: -9999, left: -9999 })
  const current = models.find((m) => m.id === selected) ?? models[0]

  // RAF loop: keep dropdown anchored to button while open
  useEffect(() => {
    if (!open) return
    let rafId: number
    const sync = () => {
      const btn = btnRef.current
      const drop = dropRef.current
      if (btn && drop) {
        const rect = btn.getBoundingClientRect()
        const dropH = drop.offsetHeight
        const spaceBelow = window.innerHeight - rect.bottom - 8
        const top = spaceBelow >= dropH ? rect.bottom + 6 : rect.top - dropH - 6
        drop.style.top = `${top}px`
        drop.style.left = `${rect.left}px`
      }
      rafId = requestAnimationFrame(sync)
    }
    rafId = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(rafId)
  }, [open])

  // Outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) setOpen(false)
    }
    const id = window.setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { window.clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [open])

  // Esc
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      initialPos.current = { top: rect.bottom + 6, left: rect.left }
    }
    setOpen(!open)
  }

  if (models.length === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-1.5 text-[14px] font-medium text-muted-foreground">
        <span className="flex size-3.5 items-center justify-center rounded-full bg-primary/10">
          <span className="text-[7px] font-bold text-primary/50">…</span>
        </span>
        <span className="text-muted-foreground/50">加载模型中…</span>
        <ChevronDown className="size-3" />
      </div>
    )
  }

  const dropdown = open && createPortal(
    <div
      ref={dropRef}
      style={{
        position: 'fixed',
        top: initialPos.current.top,
        left: initialPos.current.left,
        zIndex: 99999,
      }}
      className="w-[260px] rounded-xl border border-border/60 bg-popover/98 shadow-2xl backdrop-blur-xl"
    >
      <div className="px-2 pt-2 pb-1 text-[13px] font-semibold uppercase tracking-widest text-muted-foreground/50">
        选择模型
      </div>
      <div className="max-h-[50vh] overflow-y-auto">
        {models.map((model) => {
          const isConfigured = model.configured !== false
          return (
            <div key={model.id}>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => { if (isConfigured) { onSelect(model.id); setOpen(false) } }}
                disabled={!isConfigured}
                className={cn(
                  'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
                  !isConfigured && 'opacity-40 cursor-not-allowed',
                  selected === model.id && isConfigured ? 'bg-primary/5' : isConfigured ? 'hover:bg-muted/40' : '',
                )}
              >
                <div className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  selected === model.id && isConfigured
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/30',
                )}>
                  {selected === model.id && isConfigured && <Check className="size-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[14px] font-semibold',
                      isConfigured
                        ? selected === model.id ? 'text-foreground' : 'text-foreground/90'
                        : 'text-muted-foreground/60',
                    )}>{model.name}</span>
                    {model.tags?.map((tag) => (
                      <span key={tag} className="rounded-md bg-muted/50 px-1.5 py-px text-[11px] text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                    {!isConfigured && (
                      <span className="rounded-md bg-amber-500/10 px-1.5 py-px text-[11px] text-amber-500">
                        需配置
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{model.description}</p>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>,
    document.body,
  )

  return (
    <div className={cn('relative', className)}>
      <button
        ref={btnRef}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleToggle}
        className={cn(
          'flex items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-1.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground',
        )}
      >
        {current?.icon ?? (
          <span className="flex size-3.5 items-center justify-center rounded-full bg-primary/10">
            <span className="text-[7px] font-bold text-primary">{current?.name?.charAt(0) ?? '?'}</span>
          </span>
        )}
        <span>{current?.name ?? '未知模型'}</span>
        <ChevronDown className={cn('size-3 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {dropdown}
    </div>
  )
}
