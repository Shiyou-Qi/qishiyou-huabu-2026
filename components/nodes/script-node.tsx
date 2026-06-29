'use client'

import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { NodeProps, Node } from '@xyflow/react'
import { FileCode2, Sparkles, Loader2, Palette, ChevronDown, ChevronRight, Film, ImageIcon, Check, RotateCcw, Users, Clapperboard } from 'lucide-react'
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

interface ScriptResult {
  title: string
  synopsis: string
  characters: Array<{ name: string; appearance: string; role: string }>
  scenes: Array<{ description: string; dialogue: string; duration: string; camera: string; negativePrompt: string; aspectRatio: string; characters?: string[] }>
}

type ScriptNodeProps = NodeProps<Node<CustomNodeData>>

function ScriptNode({ id, data, selected }: ScriptNodeProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const createScreenplayNode = useFlowStore((s) => s.createScreenplayNode)

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
  const [generated, setGenerated] = useState(false)
  const [lastResult, setLastResult] = useState<{ charCount: number; sceneCount: number; title: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { models: textModels } = useModels({ type: 'text' })
  const [selectedModel, setSelectedModel] = useState('')
  useEffect(() => {
    if (textModels.length > 0 && !selectedModel) setSelectedModel(textModels[0].id)
  }, [textModels, selectedModel])

  const persistMeta = useCallback((styles: string[], mode: string) => {
    updateNodeData(id, { meta: JSON.stringify({ styles, outputMode: mode }) })
  }, [id, updateNodeData])

  const handleOutputModeChange = (mode: 'image' | 'video') => {
    setOutputMode(mode)
    persistMeta(style, mode)
  }

  const toggleStyle = (s: string) => {
    const next = style.includes(s) ? style.filter(v => v !== s) : [...style, s]
    setStyle(next)
    persistMeta(next, outputMode)
  }

  const handleThemeChange = (value: string) => {
    setTheme(value)
    updateNodeData(id, { content: value, status: value.trim() ? 'ready' : 'idle' })
  }

  const handleGenerate = async () => {
    if (!theme.trim() || isGenerating || !selectedModel) return
    setIsGenerating(true)
    setGenerated(false)
    setLastResult(null)
    updateNodeData(id, { status: 'generating' })

    const controller = new AbortController()
    abortRef.current = controller

    const styleHint = style.length > 0
      ? `\n整体风格定位：${style.join('、')}，所有角色和分镜都要贴合此风格`
      : ''

    const cameraTerms = outputMode === 'video'
      ? '推进(dolly in) | 拉远(dolly out) | 左平移(pan left) | 右平移(pan right) | 上摇(tilt up) | 下摇(tilt down) | 跟随(tracking shot) | 环绕(orbit) | 手持(handheld) | 固定(static) | 航拍(aerial) | 慢推(slow push in) | 升降(crane)'
      : '特写(close-up) | 中景(medium shot) | 全景(wide shot) | 大全景(extreme wide) | 俯视(bird\'s eye) | 仰视(low angle) | 平视(eye level) | 侧面(side view) | 四分之三(three-quarter)'

    const mediaType = outputMode === 'video' ? '视频' : '图片'
    const qualityTags = outputMode === 'video'
      ? 'cinematic, 8K, film grain, shallow depth of field, professional color grading, dramatic lighting, golden hour'
      : '8K, masterpiece, ultra-detailed, sharp focus, professional photography, studio lighting'

    const systemPrompt = `你是专业的 AI ${mediaType}编剧和分镜师，精通 Seedance 2.0 视频模型的提示词格式。根据用户的主题描述，生成一个完整的剧本，包含角色提取和分镜脚本。

一、角色提取：
- 从剧情中提取所有有辨识度的角色（主角、配角、重要路人）
- 每个角色需要详细的外貌描述（用于生成角色三视图参考），包括：
  · 性别、年龄段、体型
  · 发型发色、五官特征
  · 服装材质、颜色、配饰
  · 标志性特征（如伤疤、纹身、特殊道具）

二、分镜脚本（Seedance 2.0 时间轴格式）：
每个分镜的 description 必须使用 Seedance 2.0 时间轴 + @角色引用格式：
- 使用 [起始时间-结束时间] 标记时间轴片段，例如 [0s-2s]、[2s-5s]
- 使用 @角色名 引用角色（需与 characters 里的 name 完全一致）
- 每个时间片段描述：@角色 + 动作 + 场景环境 + 光影氛围
- 质量标签（选 2-3 个）：${qualityTags}

description 示例：
"[0s-2s] @小明 站在雨中的街头，低头看着手中的信，城市霓虹灯光反射在湿润的地面上，cinematic, dramatic lighting [2s-4s] @小明 缓缓抬起头望向远方，雨水沿发丝滑落，浅景深虚化背景，8K, shallow depth of field [4s-5s] 远景拉开，@小明 的身影在雨中渐渐模糊，冷色调城市夜景"

characters 字段：列出该分镜中出场的角色名数组（用于 @引用匹配）

camera ${outputMode === 'video' ? '运镜' : '构图'}术语（中英双语）：${cameraTerms}
negativePrompt 必填：blurry, low quality, distorted, watermark, text, bad anatomy${outputMode === 'video' ? ', static, frozen' : ', ugly'}
${outputMode === 'video' ? 'duration：简单运动 5s，复杂运镜 8-10s' : ''}
aspectRatio：横屏 16:9，竖屏 9:16，方形 1:1${styleHint}

要求：
1. 角色数量 2-6 个，要有辨识度
2. 分镜 4-8 个，起承转合结构
3. description 必须包含时间轴标记 [Xs-Ys]
4. 出场角色必须用 @角色名 引用

严格按 JSON 返回：
{"title":"剧本标题","synopsis":"概要（2-3句话描述整体故事）","characters":[{"name":"角色名","appearance":"详细外貌/服装/特征描述","role":"主角/配角"}],"scenes":[{"description":"[0s-2s] @角色 时间轴提示词...","dialogue":"台词/旁白","duration":"${outputMode === 'video' ? '5s' : ''}","camera":"运镜术语","negativePrompt":"排除词","aspectRatio":"16:9","characters":["出场角色名1","出场角色名2"]}]}`

    try {
      const res = await fetch('/api/generate/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: theme,
          systemPrompt,
          temperature: 0.8,
          maxTokens: 4000,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({} as Record<string, string>))
        throw new Error(errBody.error || `HTTP ${res.status}`)
      }
      const result = await res.json() as { text: string }
      const text = result.text?.trim()
      if (!text) throw new Error('生成结果为空')

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('无法解析 JSON')

      const parsed = JSON.parse(jsonMatch[0])
      if (!parsed.scenes || !Array.isArray(parsed.scenes)) throw new Error('格式错误：缺少 scenes')

      const scriptData: ScriptResult = {
        title: parsed.title || '未命名剧本',
        synopsis: parsed.synopsis || '',
        characters: (parsed.characters || []).map((c: Record<string, string>) => ({
          name: c.name || '未命名角色',
          appearance: c.appearance || '',
          role: c.role || '配角',
        })),
        scenes: parsed.scenes.map((s: Record<string, unknown>) => ({
          description: (s.description as string) || '',
          dialogue: (s.dialogue as string) || '',
          duration: (s.duration as string) || (outputMode === 'video' ? '5s' : ''),
          camera: (s.camera as string) || '',
          negativePrompt: (s.negativePrompt as string) || 'blurry, low quality',
          aspectRatio: (s.aspectRatio as string) || '16:9',
          characters: Array.isArray(s.characters) ? (s.characters as string[]) : [],
        })),
      }

      // Create screenplay node only — user confirms there to create character/scene nodes
      createScreenplayNode(id, {
        ...scriptData,
        scenes: scriptData.scenes.map(s => ({ ...s, outputMode })),
      })

      setGenerated(true)
      setLastResult({
        title: scriptData.title,
        charCount: scriptData.characters.length,
        sceneCount: scriptData.scenes.length,
      })
      updateNodeData(id, { status: 'completed' })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('剧本生成失败:', err)
      updateNodeData(id, { status: 'failed' })
    } finally {
      setIsGenerating(false)
      abortRef.current = null
    }
  }

  const handleReset = () => {
    setGenerated(false)
    setLastResult(null)
    updateNodeData(id, { status: theme.trim() ? 'ready' : 'idle' })
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
      {/* Theme input */}
      <div className="nodrag nopan rounded-xl border border-border/50 bg-muted/20 transition-colors focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20">
        <textarea
          value={theme}
          onChange={(e) => handleThemeChange(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="输入主题或创意想法，AI 将生成完整剧本（含角色、分镜）..."
          rows={3}
          className="nodrag nopan block w-full resize-none bg-transparent px-3.5 py-3 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
        />
      </div>

      {/* Style selector */}
      <div className="nodrag nopan mt-2.5" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <button onClick={() => setStyleExpanded(!styleExpanded)} className="flex items-center gap-1.5">
            <Palette className="size-3 text-muted-foreground/50" />
            <span className="text-[12px] font-medium text-muted-foreground/70">剧本风格</span>
            {style.length > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary">{style.length}</span>
            )}
            {styleExpanded
              ? <ChevronDown className="size-3 text-muted-foreground/40" />
              : <ChevronRight className="size-3 text-muted-foreground/40" />}
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 p-0.5">
            <button
              onClick={() => handleOutputModeChange('image')}
              className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition-colors',
                outputMode === 'image' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/50 hover:text-muted-foreground'
              )}
            >
              <ImageIcon className="size-3" /> 图片
            </button>
            <button
              onClick={() => handleOutputModeChange('video')}
              className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition-colors',
                outputMode === 'video' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/50 hover:text-muted-foreground'
              )}
            >
              <Film className="size-3" /> 视频
            </button>
          </div>
        </div>

        {!styleExpanded && style.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {style.map(s => (
              <span key={s} className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">{s}</span>
            ))}
          </div>
        )}

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
          <span className="text-[12px] text-primary">AI 正在生成剧本，完成后自动创建节点...</span>
        </div>
      )}

      {/* Generated result summary */}
      {generated && lastResult && (
        <div className="mt-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Check className="size-3.5 text-emerald-500" />
            <span className="text-[12px] font-medium text-emerald-400">{lastResult.title}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-emerald-600/70">
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {lastResult.charCount} 个角色节点
            </span>
            <span className="flex items-center gap-1">
              <Clapperboard className="size-3" />
              {lastResult.sceneCount} 个分镜节点
            </span>
          </div>
          <p className="mt-1 text-[10px] text-emerald-600/50">已创建剧本概览、角色三视图、分镜节点</p>
        </div>
      )}

      {/* Bottom bar */}
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
        ) : generated ? (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleReset}
            title="重新生成"
            className="flex items-center gap-1.5 rounded-full border border-border/40 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/30"
          >
            <RotateCcw className="size-3" />
            重新生成
          </button>
        ) : (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleGenerate}
            disabled={!canGenerate}
            title="AI 生成剧本并创建节点"
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-40"
          >
            <Sparkles className="size-3" />
            生成剧本
          </button>
        )}
      </div>
    </NodeBase>
  )
}

export default memo(ScriptNode)
