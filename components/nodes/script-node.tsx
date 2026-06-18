'use client'

import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { NodeProps, Node } from '@xyflow/react'
import { FileCode2, Sparkles, Loader2, Palette, ChevronDown, ChevronRight } from 'lucide-react'
import { CustomNodeData, useFlowStore } from '@/lib/store'
import { ModelSelector } from '@/components/model-selector'
import { NodeBase } from './node-base'
import { useModels } from '@/hooks/use-models'

const STYLE_GROUPS: { group: string; items: string[] }[] = [
  { group: '内容类型', items: ['电影', '短剧', '微电影', '短视频', '广告', '宣传片', 'MV', 'Vlog', '纪录片', '教程', '解说', '直播', '动态海报'] },
  { group: '剧情风格', items: ['剧情', '喜剧', '悬疑', '恐怖', '惊悚', '动作', '爱情', '科幻', '奇幻', '武侠', '仙侠', '战争', '犯罪', '谍战', '历史', '青春', '家庭', '职场', '校园', '都市', '乡村', '体育', '音乐剧', '儿童'] },
  { group: '视觉风格', items: ['写实', '动画', '二次元', '3D渲染', 'CG', '像素风', '赛博朋克', '蒸汽朋克', '古风', '国潮', '日系', '韩系', '欧美', '复古', '黑白', '胶片', '超现实', '水彩', '油画', '水墨', '素描', '极简', '暗黑', '梦幻', '童话', '田园', '废土', '哥特', '波普艺术', '扁平插画'] },
  { group: '氛围调性', items: ['温馨', '治愈', '热血', '燃', '搞笑', '沙雕', '催泪', '压抑', '紧张', '神秘', '浪漫', '清新', '文艺', '史诗', '暴力美学', '荒诞', '讽刺', '励志', '怀旧', '空灵'] },
]

type ScriptNodeProps = NodeProps<Node<CustomNodeData>>

function ScriptNode({ id, data, selected }: ScriptNodeProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const createScenesFromScript = useFlowStore((s) => s.createScenesFromScript)

  const [theme, setTheme] = useState(data.content || '')
  const [style, setStyle] = useState<string[]>(() => {
    try {
      const meta = data.meta ? JSON.parse(data.meta as string) : {}
      return meta.styles || []
    } catch { return [] }
  })
  const [styleExpanded, setStyleExpanded] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [sceneCount, setSceneCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const { models: textModels } = useModels({ type: 'text' })
  const [selectedModel, setSelectedModel] = useState('')
  useEffect(() => {
    if (textModels.length > 0 && !selectedModel) setSelectedModel(textModels[0].id)
  }, [textModels, selectedModel])

  const persistStyle = useCallback((next: string[]) => {
    setStyle(next)
    updateNodeData(id, { meta: JSON.stringify({ styles: next }) })
  }, [id, updateNodeData])

  const toggleStyle = (s: string) => {
    const next = style.includes(s) ? style.filter(v => v !== s) : [...style, s]
    persistStyle(next)
  }

  const handleThemeChange = (value: string) => {
    setTheme(value)
    updateNodeData(id, { content: value, status: value.trim() ? 'ready' : 'idle' })
  }

  const handleGenerate = async () => {
    if (!theme.trim() || isGenerating || !selectedModel) return
    setIsGenerating(true)
    updateNodeData(id, { status: 'generating' })

    const controller = new AbortController()
    abortRef.current = controller

    const styleHint = style.length > 0
      ? `\n6. 整体风格定位：${style.join('、')}，所有分镜的画面描述、台词和镜头运动都要贴合此风格`
      : ''

    try {
      const res = await fetch('/api/generate/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: theme,
          systemPrompt: `你是一个专业的短视频分镜脚本师。根据用户输入的主题或描述，生成一份分镜脚本。

要求：
1. 生成 4-8 个分镜场景
2. 每个场景包含：画面描述(description)、台词或旁白(dialogue)、建议时长(duration)、镜头运动(camera)
3. 时长用秒数表示如 "3s"、"5s"
4. 镜头运动如：推进、拉远、平移、特写、全景、跟随等
5. 整体结构要有起承转合${styleHint}

请严格按以下 JSON 格式返回，不要包含其他内容：
{"scenes":[{"description":"画面描述","dialogue":"台词/旁白","duration":"3s","camera":"镜头运动"}]}`,
          temperature: 0.8,
          maxTokens: 2048,
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json() as { text: string }
      const text = result.text?.trim()
      if (!text) throw new Error('生成结果为空')

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('无法解析 JSON')

      const parsed = JSON.parse(jsonMatch[0])
      if (!parsed.scenes || !Array.isArray(parsed.scenes)) throw new Error('格式错误')

      const styleStr = style.join(',')
      const scenes = parsed.scenes.map((s: Record<string, string>) => ({
        description: s.description || '',
        dialogue: s.dialogue || '',
        duration: s.duration || '3s',
        camera: s.camera || '',
        style: styleStr,
      }))

      createScenesFromScript(id, scenes)
      setSceneCount(scenes.length)
      updateNodeData(id, { status: 'completed' })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('分镜生成失败:', err)
      updateNodeData(id, { status: 'failed' })
    } finally {
      setIsGenerating(false)
      abortRef.current = null
    }
  }

  const canGenerate = !isGenerating && !!theme.trim() && !!selectedModel

  return (
    <NodeBase
      nodeType="script"
      label={data.label}
      status={data.status}
      selected={selected}
      onDelete={() => deleteNode(id)}
      icon={<FileCode2 className="size-3.5" />}
      width={styleExpanded ? 'w-[520px]' : 'w-[360px]'}
    >
      {/* Theme / prompt input */}
      <div className="nodrag nopan rounded-xl border border-border/40 bg-muted/20">
        <textarea
          value={theme}
          onChange={(e) => handleThemeChange(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="输入视频主题或创意描述，AI 将自动生成分镜节点..."
          rows={3}
          className="nodrag nopan block w-full resize-none bg-transparent px-3.5 py-3 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
        />
      </div>

      {/* Style selector */}
      <div className="nodrag nopan mt-2.5" onPointerDown={(e) => e.stopPropagation()}>
        <button
          onClick={() => setStyleExpanded(!styleExpanded)}
          className="flex w-full items-center gap-1.5 text-left"
        >
          <Palette className="size-3 text-muted-foreground/50" />
          <span className="text-[12px] font-medium text-muted-foreground/70">剧本风格</span>
          {style.length > 0 && (
            <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary">{style.length}</span>
          )}
          <div className="flex-1" />
          {styleExpanded
            ? <ChevronDown className="size-3 text-muted-foreground/40" />
            : <ChevronRight className="size-3 text-muted-foreground/40" />
          }
        </button>

        {/* Selected tags (always visible when collapsed) */}
        {!styleExpanded && style.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {style.map(s => (
              <span key={s} className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">{s}</span>
            ))}
          </div>
        )}

        {/* Full style panel */}
        {styleExpanded && (
          <div className="mt-2 rounded-xl border border-border/30 bg-muted/10 p-2.5" onKeyDown={(e) => e.stopPropagation()}>
            {STYLE_GROUPS.map(({ group, items }) => (
              <div key={group} className="mb-2.5 last:mb-0">
                <div className="mb-1 text-[10px] font-medium text-muted-foreground/50">{group}</div>
                <div className="flex flex-wrap gap-1">
                  {items.map(s => (
                    <button
                      key={s}
                      onClick={() => toggleStyle(s)}
                      className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                        style.includes(s)
                          ? 'bg-primary/20 text-primary ring-1 ring-primary/30'
                          : 'bg-muted/40 text-foreground/60 hover:bg-muted/60'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generation status */}
      {isGenerating && (
        <div className="mt-2.5 flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 py-3">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="text-[12px] text-primary">AI 正在生成分镜脚本...</span>
        </div>
      )}
      {!isGenerating && sceneCount > 0 && (
        <div className="mt-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2.5 text-[12px] text-emerald-500">
          已生成 <span className="font-semibold">{sceneCount}</span> 个分镜节点，可连接参考图后生成画面
        </div>
      )}

      {/* Bottom bar: model + generate */}
      <div className="-mx-3.5 mt-3 flex items-center gap-1.5 border-t border-border/40 px-3.5 pt-2.5">
        <ModelSelector models={textModels} selected={selectedModel} onSelect={setSelectedModel} />
        <div className="flex-1" />
        {isGenerating ? (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => abortRef.current?.abort()}
            className="flex size-7 items-center justify-center rounded-full bg-red-500 shadow-md shadow-red-500/20 transition-all hover:bg-red-600 active:scale-95"
            title="中止生成"
          >
            <div className="size-2.5 rounded-sm bg-white" />
          </button>
        ) : (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleGenerate}
            disabled={!canGenerate}
            title="AI 生成分镜"
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-40"
          >
            <Sparkles className="size-3" />
            生成分镜
          </button>
        )}
      </div>
    </NodeBase>
  )
}

export default memo(ScriptNode)
