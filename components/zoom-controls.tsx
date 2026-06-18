'use client'

import { useState, useEffect, useCallback } from 'react'
import { Maximize2, Minus, Plus, Users, Eye } from 'lucide-react'
import { useReactFlow, useOnViewportChange } from '@xyflow/react'

export function ZoomControls() {
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow()
  const [zoom, setZoom] = useState(100)

  const syncZoom = useCallback(() => {
    setZoom(Math.round(getZoom() * 100))
  }, [getZoom])

  useOnViewportChange({ onEnd: syncZoom })
  useEffect(() => { syncZoom() }, [syncZoom])

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
      {/* Secondary actions */}
      <div className="glass flex items-center gap-0.5 rounded-2xl p-1.5 shadow-lg">
        <ZBtn onClick={() => fitView({ duration: 300, padding: 0.15 })} title="适应画布 (Ctrl+0)">
          <Maximize2 className="size-3.5" />
        </ZBtn>
        <ZBtn title="协作模式">
          <Users className="size-3.5" />
        </ZBtn>
        <ZBtn title="预览模式">
          <Eye className="size-3.5" />
        </ZBtn>
      </div>

      {/* Zoom controls */}
      <div className="glass flex items-center gap-1 rounded-2xl p-1.5 shadow-lg">
        <ZBtn onClick={() => zoomOut({ duration: 200 })} title="缩小 (Ctrl+-)">
          <Minus className="size-3.5" />
        </ZBtn>

        <button
          onClick={() => fitView({ duration: 300, padding: 0.15 })}
          title="点击适应画布"
          className="w-14 rounded-xl py-1 text-center text-[12px] font-medium tabular text-foreground/80 transition-colors hover:bg-muted/60"
        >
          {zoom}%
        </button>

        <ZBtn onClick={() => zoomIn({ duration: 200 })} title="放大 (Ctrl++)">
          <Plus className="size-3.5" />
        </ZBtn>
      </div>
    </div>
  )
}

function ZBtn({
  onClick,
  title,
  children,
}: {
  onClick?: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="
        group flex size-8 items-center justify-center rounded-xl
        text-muted-foreground transition-all duration-150
        hover:bg-muted/60 hover:text-foreground
      "
    >
      <span className="transition-transform duration-150 group-hover:scale-110">
        {children}
      </span>
    </button>
  )
}
