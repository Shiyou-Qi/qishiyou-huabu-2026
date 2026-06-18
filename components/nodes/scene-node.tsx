'use client'

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { NodeProps, Node } from '@xyflow/react'
import { Clapperboard, Camera, Clock, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'
import { CustomNodeData, useFlowStore } from '@/lib/store'
import { NodeBase } from './node-base'

interface SceneData {
  sceneIndex: number
  description: string
  dialogue: string
  duration: string
  camera: string
  negativePrompt?: string
  aspectRatio?: string
  outputMode?: string
}

function parseScene(content?: string): SceneData {
  if (!content) return { sceneIndex: 1, description: '', dialogue: '', duration: '3s', camera: '' }
  try { return JSON.parse(content) } catch { return { sceneIndex: 1, description: content, dialogue: '', duration: '3s', camera: '' } }
}

type SceneNodeProps = NodeProps<Node<CustomNodeData>>

function SceneNode({ id, data, selected }: SceneNodeProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const [scene, setScene] = useState<SceneData>(() => parseScene(data.content))
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => { autoResize() }, [scene.description, collapsed, autoResize])

  const persist = useCallback((next: SceneData) => {
    setScene(next)
    const hasContent = next.description.trim()
    updateNodeData(id, { content: JSON.stringify(next), status: hasContent ? 'ready' : 'idle', meta: next.duration })
  }, [id, updateNodeData])

  const update = (patch: Partial<SceneData>) => persist({ ...scene, ...patch })

  const hasContent = scene.description.trim()

  return (
    <NodeBase
      nodeType="scene"
      label={data.label}
      status={data.status}
      selected={selected}
      onDelete={() => deleteNode(id)}
      icon={<Clapperboard className="size-3.5" />}
      badge={
        <span className="flex size-6 items-center justify-center rounded-lg bg-primary/15 text-[11px] font-bold text-primary">
          {scene.sceneIndex}
        </span>
      }
      width="w-[300px]"
    >
      {/* Collapsed preview */}
      {collapsed && hasContent ? (
        <div
          className="relative cursor-pointer rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5"
          onClick={() => setCollapsed(false)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p className="line-clamp-2 text-[13px] leading-relaxed text-foreground/80">{scene.description}</p>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-xl bg-gradient-to-t from-muted/40 to-transparent" />
        </div>
      ) : collapsed ? (
        <button
          className="w-full rounded-xl border border-dashed border-border/40 py-3 text-center text-[12px] text-muted-foreground/40"
          onClick={() => setCollapsed(false)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          点击展开编辑
        </button>
      ) : (
        <>
          {/* Description */}
          <div className="nodrag nopan rounded-xl border border-border/40 bg-muted/20">
            <textarea
              ref={textareaRef}
              value={scene.description}
              onChange={(e) => { update({ description: e.target.value }); autoResize() }}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="描述这个镜头的画面..."
              rows={1}
              className="nodrag nopan block w-full resize-none bg-transparent px-3 py-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </div>

          {/* Dialogue */}
          {(scene.dialogue || editing === 'dialogue') ? (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-border/30 bg-muted/10 px-2.5 py-2">
              <MessageSquare className="mt-0.5 size-3 shrink-0 text-muted-foreground/50" />
              <input
                value={scene.dialogue}
                onChange={(e) => update({ dialogue: e.target.value })}
                onBlur={() => { if (!scene.dialogue.trim()) setEditing(null) }}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="台词 / 旁白..."
                autoFocus={editing === 'dialogue'}
                className="nodrag nopan w-full bg-transparent text-[12px] text-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none"
              />
            </div>
          ) : (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setEditing('dialogue')}
              className="mt-2 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-border/30 px-2.5 py-1.5 text-[11px] text-muted-foreground/40 hover:border-border/50 hover:text-muted-foreground/60 transition-colors"
            >
              <MessageSquare className="size-3" />
              添加台词 / 旁白
            </button>
          )}

          {/* Negative prompt */}
          {(scene.negativePrompt || editing === 'negative') ? (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2">
              <span className="mt-0.5 shrink-0 text-[10px] font-bold text-amber-500/50">排除</span>
              <input
                value={scene.negativePrompt || ''}
                onChange={(e) => update({ negativePrompt: e.target.value })}
                onBlur={() => { if (!scene.negativePrompt?.trim()) setEditing(null) }}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="负向提示词..."
                autoFocus={editing === 'negative'}
                className="nodrag nopan w-full bg-transparent text-[12px] text-amber-600/70 placeholder:text-amber-400/30 focus:outline-none"
              />
            </div>
          ) : (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setEditing('negative')}
              className="mt-2 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-amber-500/20 px-2.5 py-1.5 text-[11px] text-amber-400/40 hover:border-amber-500/30 hover:text-amber-400/60 transition-colors"
            >
              添加负向提示词
            </button>
          )}

          {/* Duration + Camera row */}
          <div className="mt-2 flex gap-2">
            {scene.outputMode !== 'image' && (
              <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-border/30 bg-muted/10 px-2.5 py-1.5">
                <Clock className="size-3 shrink-0 text-muted-foreground/50" />
                <input
                  value={scene.duration}
                  onChange={(e) => update({ duration: e.target.value })}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="5s"
                  className="nodrag nopan w-full bg-transparent text-[12px] text-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none"
                />
              </div>
            )}
            <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-border/30 bg-muted/10 px-2.5 py-1.5">
              <Camera className="size-3 shrink-0 text-muted-foreground/50" />
              <input
                value={scene.camera}
                onChange={(e) => update({ camera: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={scene.outputMode === 'image' ? '构图景别...' : '运镜术语...'}
                className="nodrag nopan w-full bg-transparent text-[12px] text-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none"
              />
            </div>
          </div>

          {/* Metadata tags */}
          {(scene.aspectRatio || scene.outputMode) && (
            <div className="mt-1.5 flex items-center gap-1">
              {scene.outputMode && (
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${scene.outputMode === 'video' ? 'bg-violet-500/10 text-violet-400' : 'bg-blue-500/10 text-blue-400'}`}>
                  {scene.outputMode === 'video' ? '视频' : '图片'}
                </span>
              )}
              {scene.aspectRatio && (
                <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground/60">{scene.aspectRatio}</span>
              )}
            </div>
          )}
        </>
      )}

      {/* Collapse toggle footer */}
      {hasContent && (
        <div className="mt-1.5 flex items-center justify-between">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed) }}
            className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
            {collapsed ? '展开' : '收起'}
          </button>
          {collapsed && (
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
              <Clock className="size-2.5" />{scene.duration}
              {scene.camera && <><Camera className="ml-1 size-2.5" />{scene.camera}</>}
            </span>
          )}
        </div>
      )}
    </NodeBase>
  )
}

export default memo(SceneNode)
