'use client'

import { memo, useState, useMemo } from 'react'
import { NodeProps, Node } from '@xyflow/react'
import { BookOpen, Users, Clapperboard, ChevronDown, ChevronRight, Sparkles, Check, Pencil } from 'lucide-react'
import { CustomNodeData, useFlowStore } from '@/lib/store'
import { NodeBase } from './node-base'
import { cn } from '@/lib/utils'

interface CharacterData { name: string; appearance: string; role: string }
interface SceneData { description: string; dialogue: string; duration: string; camera: string; negativePrompt?: string; aspectRatio?: string; outputMode?: string; characters?: string[] }
interface ScriptData { title: string; synopsis: string; characters: CharacterData[]; scenes: SceneData[] }

type ScreenplayNodeProps = NodeProps<Node<CustomNodeData>>

function ScreenplayNode({ id, data, selected }: ScreenplayNodeProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const createNodesFromScreenplay = useFlowStore((s) => s.createNodesFromScreenplay)

  const script = useMemo<ScriptData | null>(() => {
    try {
      return JSON.parse(data.content as string)
    } catch { return null }
  }, [data.content])

  const [scenesExpanded, setScenesExpanded] = useState(false)
  const [charsExpanded, setCharsExpanded] = useState(true)
  const [editingChar, setEditingChar] = useState<number | null>(null)
  const [editedScript, setEditedScript] = useState<ScriptData | null>(null)
  const [confirmed, setConfirmed] = useState(data.status === 'completed')

  const currentScript = editedScript ?? script
  if (!currentScript) return null

  const updateCharacter = (index: number, patch: Partial<CharacterData>) => {
    const s = editedScript ?? { ...currentScript }
    const chars = [...s.characters]
    chars[index] = { ...chars[index], ...patch }
    const updated = { ...s, characters: chars }
    setEditedScript(updated)
    updateNodeData(id, { content: JSON.stringify(updated) })
  }

  const updateScene = (index: number, patch: Partial<SceneData>) => {
    const s = editedScript ?? { ...currentScript }
    const scenes = [...s.scenes]
    scenes[index] = { ...scenes[index], ...patch }
    const updated = { ...s, scenes }
    setEditedScript(updated)
    updateNodeData(id, { content: JSON.stringify(updated) })
  }

  const handleConfirm = () => {
    const s = currentScript
    createNodesFromScreenplay(id, {
      characters: s.characters,
      scenes: s.scenes,
    })
    setConfirmed(true)
    updateNodeData(id, { status: 'completed' })
  }

  return (
    <NodeBase
      nodeType="screenplay"
      label={data.label}
      status={data.status}
      selected={selected}
      onDelete={() => deleteNode(id)}
      icon={<BookOpen className="size-3.5" />}
      width="w-[420px]"
    >
      {/* Title + synopsis */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5">
        <h3 className="text-[13px] font-semibold text-foreground">{currentScript.title}</h3>
        {currentScript.synopsis && (
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{currentScript.synopsis}</p>
        )}
      </div>

      {/* Characters */}
      <div className="mt-2.5 rounded-xl border border-border/30 bg-muted/10 px-3 py-2.5">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setCharsExpanded(!charsExpanded)}
          className="flex w-full items-center gap-1.5"
        >
          <Users className="size-3 text-blue-400" />
          <span className="text-[12px] font-medium text-foreground/80">角色</span>
          <span className="rounded-full bg-blue-500/15 px-1.5 text-[10px] font-medium text-blue-400">{currentScript.characters.length}</span>
          {!confirmed && <span className="ml-auto text-[10px] text-muted-foreground/40">确认后生成三视图节点</span>}
          {charsExpanded
            ? <ChevronDown className="size-3 text-muted-foreground/40" />
            : <ChevronRight className="size-3 text-muted-foreground/40" />}
        </button>
        {charsExpanded && (
          <div className="mt-2 space-y-1.5" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {currentScript.characters.map((char, i) => (
              <div key={i} className="rounded-lg border border-border/20 bg-background/50 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-foreground">{char.name}</span>
                  <span className={cn('rounded-md px-1.5 py-0.5 text-[10px]',
                    char.role === '主角' ? 'bg-amber-500/15 text-amber-400' : 'bg-muted/40 text-muted-foreground/60'
                  )}>{char.role}</span>
                  {!confirmed && (
                    <button
                      onClick={() => setEditingChar(editingChar === i ? null : i)}
                      className="ml-auto rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground/50 transition-colors hover:bg-muted/30 hover:text-muted-foreground"
                    >
                      <Pencil className="size-3" />
                    </button>
                  )}
                </div>
                {editingChar === i && !confirmed ? (
                  <div className="mt-1.5 space-y-1">
                    <input
                      value={char.name}
                      onChange={(e) => updateCharacter(i, { name: e.target.value })}
                      className="nodrag nopan w-full rounded-md border border-border/30 bg-muted/20 px-2 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary/40"
                      placeholder="角色名"
                    />
                    <textarea
                      value={char.appearance}
                      onChange={(e) => updateCharacter(i, { appearance: e.target.value })}
                      rows={3}
                      className="nodrag nopan w-full resize-none rounded-md border border-border/30 bg-muted/20 px-2 py-1 text-[11px] leading-relaxed text-foreground focus:outline-none focus:border-primary/40"
                      placeholder="外貌描述"
                    />
                  </div>
                ) : (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{char.appearance}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scenes */}
      <div className="mt-2 rounded-xl border border-border/30 bg-muted/10 px-3 py-2.5">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setScenesExpanded(!scenesExpanded)}
          className="flex w-full items-center gap-1.5"
        >
          <Clapperboard className="size-3 text-violet-400" />
          <span className="text-[12px] font-medium text-foreground/80">分镜</span>
          <span className="rounded-full bg-violet-500/15 px-1.5 text-[10px] font-medium text-violet-400">{currentScript.scenes.length}</span>
          {scenesExpanded
            ? <ChevronDown className="size-3 ml-auto text-muted-foreground/40" />
            : <ChevronRight className="size-3 ml-auto text-muted-foreground/40" />}
        </button>
        {scenesExpanded && (
          <div className="mt-2 space-y-1" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {currentScript.scenes.map((scene, i) => (
              <div key={i} className="rounded-lg border border-border/20 bg-background/50 px-2.5 py-1.5">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 text-[11px] font-bold text-primary/60">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    {scene.characters && scene.characters.length > 0 && (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {scene.characters.map((name) => (
                          <span key={name} className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-medium text-blue-400">@{name}</span>
                        ))}
                      </div>
                    )}
                    {!confirmed ? (
                      <textarea
                        value={scene.description}
                        onChange={(e) => updateScene(i, { description: e.target.value })}
                        rows={2}
                        className="nodrag nopan w-full resize-none rounded-md border border-border/20 bg-muted/10 px-2 py-1 text-[11px] leading-relaxed text-foreground/70 focus:outline-none focus:border-primary/30"
                      />
                    ) : (
                      <p className="line-clamp-2 text-[11px] leading-relaxed text-foreground/70">{scene.description}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground/40">{scene.duration}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="-mx-3.5 mt-3 flex items-center justify-end gap-1.5 border-t border-border/40 px-3.5 pt-2.5">
        {confirmed ? (
          <div className="flex items-center gap-2 text-[11px] text-emerald-400">
            <Check className="size-3.5" />
            <span>角色 + 分镜节点已创建</span>
          </div>
        ) : (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleConfirm}
            className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-[11px] font-medium text-white shadow-md shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-95"
          >
            <Sparkles className="size-3" />
            生成角色 + 分镜节点
          </button>
        )}
      </div>
    </NodeBase>
  )
}

export default memo(ScreenplayNode)
