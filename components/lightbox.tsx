'use client'

import { useEffect, useCallback } from 'react'
import { X, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LightboxProps {
  /** 图片地址；为 null/undefined 时关闭 */
  src: string | null | undefined
  /** 关闭回调 */
  onClose: () => void
  /** 图片 alt 文本 */
  alt?: string
}

export function Lightbox({ src, onClose, alt = '' }: LightboxProps) {
  const isOpen = !!src

  // ── Escape 键关闭 ──
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (!isOpen) return
    window.addEventListener('keydown', handleKeyDown)
    // 阻止画布滚动
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!src) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center',
        'bg-black/70 backdrop-blur-md',
        'animate-in fade-in duration-150'
      )}
      onPointerDown={(e) => {
        // 点击遮罩关闭
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* 图片容器 */}
      <div className="relative flex max-h-[90vh] max-w-[90vw] items-center justify-center">
        <img
          src={src}
          alt={alt}
          className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          onPointerDown={(e) => e.stopPropagation()}
        />
        {/* 关闭按钮 — 贴在图片右上角 */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="absolute -right-3 -top-3 z-[101] flex size-8 items-center justify-center rounded-full bg-black/60 text-white/90 shadow-lg ring-1 ring-white/10 backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-110"
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
