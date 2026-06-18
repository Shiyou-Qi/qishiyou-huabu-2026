'use client'

import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { NodeProps, Node } from '@xyflow/react'
import { FileCode2, Sparkles, Loader2, Palette, ChevronDown, ChevronRight, Film, ImageIcon } from 'lucide-react'
import { CustomNodeData, useFlowStore } from '@/lib/store'
import { ModelSelector } from '@/components/model-selector'
import { NodeBase } from './node-base'
import { useModels } from '@/hooks/use-models'
import { cn } from '@/lib/utils'

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
  const [outputMode, setOutputMode] = useState<'image' | 'video'>(() => {
    try {
      const meta = data.meta ? JSON.parse(data.meta as string) : {}
      return meta.outputMode || 'video'
    } catch { return 'video' }
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
    updateNodeData(id, { meta: JSON.stringify({ styles: next, outputMode }) })
  }, [id, updateNodeData, outputMode])

  const handleOutputModeChange = (mode: 'image' | 'video') => {
    setOutputMode(mode)
    updateNodeData(id, { meta: JSON.stringify({ styles: style, outputMode: mode }) })
  }

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
      ? `\n整体风格定位：${style.join('、')}，所有分镜都要贴合此风格`
      : ''

    const systemPrompt = outputMode === 'video'
      ? `你是专业的 AI 视频分镜师，为 Seedance 视频生成模型编写提示词。根据用户的主题描述，生成分镜脚本。

每个分镜的 description 按此结构编写（直接可用于视频生成 AI）：
- 主体+动作：谁/什么在做什么（具体动态描述）
- 场景环境：在哪里，周围元素
- 光线氛围：光源、色温、明暗
- 质量标签：从 cinematic, 8K, film grain, shallow depth of field, professional color grading, dramatic lighting, golden hour 中选 2-3 个

camera 运镜术语（中英双语格式）：
推进(dolly in) | 拉远(dolly out) | 左平移(pan left) | 右平移(pan right) | 上摇(tilt up) | 下摇(tilt down) | 跟随(tracking shot) | 环绕(orbit) | 手持(handheld) | 固定(static) | 航拍(aerial) | 慢推(slow push in) | 升降(crane)

negativePrompt 必填，常用组合：blurry, low quality, distorted, static, frozen, watermark, text, bad anatomy
duration：简单运动 5s，复杂运镜 8-10s
aspectRatio：横屏 16:9，竖屏 9:16，方形 1:1（根据内容选最佳）

要求：
1. 生成 4-8 个分镜，起承转合结构
2. 场景间视觉连贯，叙事递进${styleHint}

严格按 JSON 返回：
{"scenes":[{"description":"完整视频提示词","dialogue":"台词/旁白","duration":"5s","camera":"推进(dolly in)","negativePrompt":"blurry, low quality","aspectRatio":"16:9"}]}`
      : `你是专业的 AI 绘画分镜师，为图片生成 AI 编写提示词。根据用户的主题描述，生成分镜脚本。

每个分镜的 description 按此结构编写（直接可用于图片生成 AI）：
- 主体+状态：谁/什么，什么姿态/表情
- 构图+层次：主体位置，前景/背景
- 场景环境：场景细节、道具、色彩基调
- 光线材质：光源方向、阴影、质感
- 质量标签：从 8K, masterpiece, ultra-detailed, sharp focus, professional photography, studio lighting 中选 2-3 个

camera 描述景别构图（中英双语格式）：
特写(close-up) | 中景(medium shot) | 全景(wide shot) | 大全景(extreme wide) | 俯视(bird's eye) | 仰视(low angle) | 平视(eye level) | 侧面(side view) | 四分之三(three-quarter)

negativePrompt 必填，常用组合：blurry, low quality, distorted, watermark, text, bad anatomy, ugly
aspectRatio：横屏 16:9，竖屏 9:16，方形 1:1，4:3，3:4

要求：
1. 生成 4-8 个分镜，起承转合结构
2. 画面间视觉连贯，叙事递进${styleHint}

严格按 JSON 返回：
{"scenes":[{"description":"完整图片提示词","dialogue":"配文/旁白","duration":"","camera":"特写(close-up)","negativePrompt":"blurry, low quality","aspectRatio":"16:9"}]}`

    try {
      const res = await fetch('/api/generate/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: theme,
          systemPrompt,
          temperature: 0.8,
          maxTokens: 3000,
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
        duration: s.duration || (outputMode === 'video' ? '5s' : ''),
        camera: s.camera || '',
        negativePrompt: s.negativePrompt || '',
        aspectRatio: s.aspectRatio || '16:9',
        outputMode,
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStyleExpanded(!styleExpanded)}
            className="flex items-center gap-1.5"
          >
            <Palette className="size-3 text-muted-foreground/50" />
            <span className="text-[12px] font-medium text-muted-foreground/70">剧本风格</span>
            {style.length > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary">{style.length}</span>
            )}
            {styleExpanded
              ? <ChevronDown className="size-3 text-muted-foreground/40" />
              : <ChevronRight className="size-3 text-muted-foreground/40" />
            }
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 p-0.5">
            <button
              onClick={() => handleOutputModeChange('image')}
              className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition-colors',
                outputMode === 'image' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/50 hover:text-muted-foreground'
              )}
            >
              <ImageIcon className="size-3" />
              图片
            </button>
            <button
              onClick={() => handleOutputModeChange('video')}
              className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition-colors',
                outputMode === 'video' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/50 hover:text-muted-foreground'
              )}
            >
              <Film className="size-3" />
              视频
            </button>
          </div>
        </div>

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
          <span className="text-[12px] text-primary">AI 正在生成{outputMode === 'video' ? '视频' : '图片'}分镜脚本...</span>
        </div>
      )}
      {!isGenerating && sceneCount > 0 && (
        <div className="mt-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2.5 text-[12px] text-emerald-500">
          已生成 <span className="font-semibold">{sceneCount}</span> 个{outputMode === 'video' ? '视频' : '图片'}分镜节点
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
