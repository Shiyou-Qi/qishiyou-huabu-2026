'use client'

import { memo, useState, useCallback, useRef, useLayoutEffect } from 'react'
import { NodeProps, Node } from '@xyflow/react'
import { Clapperboard, Plus, Upload, X } from 'lucide-react'
import { CustomNodeData, useFlowStore } from '@/lib/store'
import { NodeBase } from './node-base'

interface StoryboardRow {
  sceneIndex: number
  description: string
  sceneImage?: string
  characters?: string[]
  shotType?: string
  camera: string
  dialogue: string
  duration?: string
  negativePrompt?: string
  aspectRatio?: string
  outputMode?: string
}

function parseRows(content?: string): StoryboardRow[] {
  if (!content) return [emptyRow(1)]
  try {
    const arr = JSON.parse(content)
    return Array.isArray(arr) && arr.length > 0 ? arr : [emptyRow(1)]
  } catch {
    return [emptyRow(1)]
  }
}

function emptyRow(idx: number): StoryboardRow {
  return { sceneIndex: idx, description: '', camera: '', dialogue: '', shotType: '' }
}

type StoryboardNodeProps = NodeProps<Node<CustomNodeData>>

function StoryboardNode({ id, data, selected }: StoryboardNodeProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const openMaterialPicker = useFlowStore((s) => s.openMaterialPicker)
  const [rows, setRows] = useState<StoryboardRow[]>(() => parseRows(data.content))

  const wrapperRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])
  const [portTops, setPortTops] = useState<Record<string, string>>({})

  useLayoutEffect(() => {
    const measure = () => {
      const wrap = wrapperRef.current
      if (!wrap || wrap.getBoundingClientRect().height === 0) {
        requestAnimationFrame(measure)
        return
      }
      const wrapBox = wrap.getBoundingClientRect()
      const next: Record<string, string> = {}
      rowRefs.current.forEach((el, i) => {
        if (!el) return
        const box = el.getBoundingClientRect()
        const centerY = box.top - wrapBox.top + box.height / 2
        next[`row-${i}`] = `${(centerY / wrapBox.height) * 100}%`
      })
      setPortTops((prev) => {
        const changed = Object.keys(next).some((k) => next[k] !== prev[k])
        return changed ? next : prev
      })
    }
    measure()
    const rafId = requestAnimationFrame(measure)
    const wrap = wrapperRef.current
    if (!wrap) return () => cancelAnimationFrame(rafId)
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => { cancelAnimationFrame(rafId); ro.disconnect() }
  }, [rows.length])

  const persist = useCallback((next: StoryboardRow[]) => {
    setRows(next)
    const hasContent = next.some((r) => r.description.trim())
    updateNodeData(id, { content: JSON.stringify(next), status: hasContent ? 'ready' : 'idle' })
  }, [id, updateNodeData])

  const updateRow = (idx: number, patch: Partial<StoryboardRow>) => {
    const next = rows.map((r, i) => i === idx ? { ...r, ...patch } : r)
    persist(next)
  }

  const addRow = () => {
    persist([...rows, emptyRow(rows.length + 1)])
  }

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return
    const next = rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, sceneIndex: i + 1 }))
    persist(next)
  }

  const outputPorts = rows.map((_, i) => ({
    id: `row-${i}`,
    top: portTops[`row-${i}`] ?? `${((i + 0.5) / rows.length) * 100}%`,
  }))

  return (
    <NodeBase
      ref={wrapperRef}
      nodeType="storyboard"
      label={data.label}
      status={data.status}
      selected={selected}
      onDelete={() => deleteNode(id)}
      icon={<Clapperboard className="size-3.5" />}
      hasOutput={false}
      outputPorts={outputPorts}
      width="w-[740px]"
      noPadding
    >
      <div className="nodrag nopan overflow-x-auto" onPointerDown={(e) => e.stopPropagation()}>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30 text-muted-foreground">
              <th className="w-[36px] px-2 py-2 text-center font-medium">镜号</th>
              <th className="min-w-[180px] px-2 py-2 text-left font-medium">画面内容</th>
              <th className="w-[56px] px-1 py-2 text-center font-medium">场景图</th>
              <th className="w-[72px] px-1 py-2 text-center font-medium">角色</th>
              <th className="w-[60px] px-1 py-2 text-center font-medium">镜头</th>
              <th className="w-[60px] px-1 py-2 text-center font-medium">运镜</th>
              <th className="min-w-[100px] px-2 py-2 text-left font-medium">旁白</th>
              <th className="w-[28px]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                ref={(el) => { rowRefs.current[i] = el }}
                className="group/row border-b border-border/30 transition-colors hover:bg-muted/10"
              >
                {/* 镜号 */}
                <td className="px-2 py-1.5 text-center font-bold text-primary/60">{i + 1}</td>

                {/* 画面内容 */}
                <td className="px-2 py-1">
                  <textarea
                    value={row.description}
                    onChange={(e) => updateRow(i, { description: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="画面描述..."
                    rows={2}
                    className="w-full resize-none rounded border-0 bg-transparent px-1 py-0.5 text-[12px] leading-relaxed text-foreground placeholder:text-muted-foreground/30 focus:bg-muted/20 focus:outline-none"
                  />
                </td>

                {/* 场景图 */}
                <td className="px-1 py-1 text-center">
                  {row.sceneImage ? (
                    <div className="group/img relative mx-auto size-10 overflow-hidden rounded-md">
                      <img src={row.sceneImage} alt="" className="size-full object-cover" />
                      <button
                        onClick={() => updateRow(i, { sceneImage: undefined })}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover/img:opacity-100"
                      >
                        <X className="size-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => openMaterialPicker(`${id}:scene:${i}`)}
                      className="mx-auto flex size-10 items-center justify-center rounded-md border border-dashed border-border/40 text-muted-foreground/30 transition-colors hover:border-border/60 hover:text-muted-foreground/50"
                    >
                      <Upload className="size-3" />
                    </button>
                  )}
                </td>

                {/* 角色 */}
                <td className="px-1 py-1 text-center">
                  <div className="flex flex-col items-center gap-1">
                    {row.characters && row.characters.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-0.5">
                        {row.characters.map((name) => (
                          <span key={name} className="rounded bg-blue-500/10 px-1 py-0.5 text-[9px] font-medium text-blue-400">
                            @{name}
                          </span>
                        ))}
                      </div>
                    )}
                    {row.characterImage ? (
                      <div className="group/cimg relative mx-auto size-10 overflow-hidden rounded-md">
                        <img src={row.characterImage} alt="" className="size-full object-cover" />
                        <button
                          onClick={() => updateRow(i, { characterImage: undefined })}
                          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover/cimg:opacity-100"
                        >
                          <X className="size-3 text-white" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openMaterialPicker(`${id}:char:${i}`)}
                        className="mx-auto flex size-10 items-center justify-center rounded-md border border-dashed border-border/40 text-muted-foreground/30 transition-colors hover:border-border/60 hover:text-muted-foreground/50"
                      >
                        <Upload className="size-3" />
                      </button>
                    )}
                  </div>
                </td>

                {/* 镜头 */}
                <td className="px-1 py-1">
                  <input
                    value={row.shotType || ''}
                    onChange={(e) => updateRow(i, { shotType: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="景别"
                    className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-center text-[11px] text-foreground placeholder:text-muted-foreground/25 focus:bg-muted/20 focus:outline-none"
                  />
                </td>

                {/* 运镜 */}
                <td className="px-1 py-1">
                  <input
                    value={row.camera}
                    onChange={(e) => updateRow(i, { camera: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="运镜"
                    className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-center text-[11px] text-foreground placeholder:text-muted-foreground/25 focus:bg-muted/20 focus:outline-none"
                  />
                </td>

                {/* 旁白 */}
                <td className="px-2 py-1">
                  <input
                    value={row.dialogue}
                    onChange={(e) => updateRow(i, { dialogue: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="台词/旁白"
                    className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-[11px] text-foreground placeholder:text-muted-foreground/25 focus:bg-muted/20 focus:outline-none"
                  />
                </td>

                {/* 删除行 */}
                <td className="px-0.5 py-1 text-center">
                  <button
                    onClick={() => removeRow(i)}
                    className="rounded p-0.5 text-muted-foreground/0 transition-colors group-hover/row:text-muted-foreground/40 hover:!text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 添加行 */}
        <button
          onClick={addRow}
          className="flex w-full items-center justify-center gap-1 border-t border-dashed border-border/30 py-2 text-[11px] text-muted-foreground/40 transition-colors hover:bg-muted/20 hover:text-muted-foreground/60"
        >
          <Plus className="size-3" />
          添加分镜
        </button>
      </div>
    </NodeBase>
  )
}

export default memo(StoryboardNode)
