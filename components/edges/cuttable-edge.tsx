'use client'

import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import { Scissors } from 'lucide-react'

export function CuttableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const edgeData = data as { edgeType?: string; isActive?: boolean } | null
  const isCurve = edgeData?.edgeType === 'curve'
  const isActive = edgeData?.isActive === true

  const [edgePath, labelX, labelY] = isCurve
    ? getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
    : getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        borderRadius: 12,
        offset: 32,
      })

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />

      {isActive && (
        <>
          <path
            d={edgePath}
            fill="none"
            stroke="var(--edge-flow)"
            strokeWidth={5}
            strokeLinecap="round"
            className="edge-energy-glow"
          />
          <path
            d={edgePath}
            fill="none"
            stroke="var(--edge-flow-bright)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="14 10"
            className="edge-energy-flow"
          />
        </>
      )}

      {selected && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-auto absolute z-30 -translate-x-1/2 -translate-y-1/2"
            style={{ left: labelX, top: labelY }}
          >
            <button
              className="
                flex size-7 items-center justify-center
                rounded-full bg-destructive text-white
                shadow-lg shadow-destructive/30
                transition-all duration-150
                hover:scale-110 hover:shadow-xl hover:shadow-destructive/40
                active:scale-95
                animate-in fade-in zoom-in-95 duration-150
              "
              title="剪断连接线"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                window.dispatchEvent(new CustomEvent('cut-edge', { detail: { edgeId: id } }))
              }}
            >
              <Scissors className="size-3.5" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
