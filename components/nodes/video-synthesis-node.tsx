'use client'

import { memo, useState } from 'react'
import { NodeProps, Node } from '@xyflow/react'
import {
  Scissors, Sparkles, ChevronDown, Search,
  Video, User, Volume2, Shuffle, Languages,
  ArrowUp, Zap, Loader2,
} from 'lucide-react'
import { CustomNodeData, useFlowStore } from '@/lib/store'
import { NodeBase } from './node-base'
import { cn } from '@/lib/utils'

type VideoSynthesisNodeProps = NodeProps<Node<CustomNodeData>>

function VideoSynthesisNode({ id, data, selected }: VideoSynthesisNodeProps) {
  const [activeTab, setActiveTab] = useState('全能参考')
  const [prompt, setPrompt] = useState('以当前图为首帧生成视频。')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [motion, setMotion] = useState('缓慢推进')
  const [refMode, setRefMode] = useState('主体一致')
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const updateNodeData = useFlowStore((s) => s.updateNodeData)

  // ── AI 提示词优化
  const optimizePrompt = async () => {
    if (!prompt.trim() || isOptimizing) return
    setIsOptimizing(true)
    try {
      const res = await fetch('/api/generate/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'doubao-seed-2-0-pro-260215',
          prompt,
          systemPrompt: `你是一个专业的AI视频提示词优化师。请将用户输入优化为一个高质量的视频生成提示词。要求:
1. 如果输入是简短描述,扩展场景细节(运镜、光线、氛围、动作、速度感)
2. 如果输入已经详细,保持原意但让表达更精准
3. 添加合适的视频画质关键词(如 cinematic, 8K, 慢动作, 电影感等)
4. 只返回优化后的提示词,不要解释`,
          temperature: 0.7,
          maxTokens: 800,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = (await res.json()) as { text: string }
      if (result.text?.trim()) {
        setPrompt(result.text.trim())
      }
    } catch (err) {
      console.error('提示词优化失败:', err)
    } finally {
      setIsOptimizing(false)
    }
  }

  const tabs = ['文生视频', '全能参考', '图生视频', '首尾帧', '图片参考']

  const handleGenerate = () => {
    setIsGenerating(true)
    updateNodeData(id, { status: 'generating', meta: prompt.trim() || '正在合成视频' })
    setTimeout(() => {
      updateNodeData(id, { status: 'completed', meta: '视频已进入成片队列' })
      setIsGenerating(false)
    }, 2000)
  }

  return (
    <NodeBase

      nodeType="videoSynthesis"
      label={data.label}
      status={data.status}
      selected={selected}
      onDelete={() => deleteNode(id)}
      icon={<Scissors className="size-3.5" />}
      badge={
        <span className="rounded px-1.5 py-0.5 text-[13px] font-semibold bg-amber-500/15 text-amber-500">
          Beta
        </span>
      }
      width="w-[500px]"

    >
      {/* Tabs */}
      <div className="mb-3 flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-[14px] transition-colors',
              activeTab === tab
                ? 'bg-secondary text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Quick actions + reference images */}
      <div className="mb-3 flex items-start gap-3">
        <div className="flex gap-2">
          {[{ icon: Search, label: '标记' }, { icon: Video, label: '运镜' }, { icon: User, label: '角色库' }].map(({ icon: Icon, label }) => (
            <button key={label} className="flex flex-col items-center gap-1 rounded-xl bg-muted/40 p-2.5 transition-colors hover:bg-muted/70 min-w-[52px]">
              <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60">
                <Icon className="size-3.5 text-muted-foreground" />
              </div>
              <span className="text-[13px] text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          {[
            { src: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=100&h=100&fit=crop', n: 1 },
            { src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop', n: 2 },
          ].map(({ src, n }) => (
            <div key={n} className="relative size-14 overflow-hidden rounded-xl border border-border/50 bg-muted transition-transform hover:scale-105 cursor-pointer">
              <img src={src} alt={`参考图 ${n}`} className="size-full object-cover" />
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded bg-blue-500 text-[13px] font-bold text-white">
                {n}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述你想生成的视频内容…"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px' }}
          rows={4}
          className="nodrag nopan mb-3 min-h-[72px] w-full resize-none overflow-y-auto rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 pb-8 text-[13px] leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); optimizePrompt() }}
          disabled={!prompt.trim() || isOptimizing}
          title="AI 优化提示词"
          className="absolute right-2 bottom-5 z-10 text-indigo-400 transition-all hover:text-indigo-300 hover:scale-110 disabled:opacity-15 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isOptimizing
            ? <Loader2 className="size-3.5 animate-spin" />
            : <Sparkles className="size-3.5" />
          }
        </button>
      </div>

      {/* Presets */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <PresetGroup label="镜头运动" options={['缓慢推进', '环绕', '固定']} value={motion} onChange={setMotion} />
        <PresetGroup label="参考强度" options={['主体一致', '风格参考', '构图参考']} value={refMode} onChange={setRefMode} />
      </div>

      {/* Settings + generate */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button className="flex items-center gap-1.5 rounded-xl bg-muted/40 px-2.5 py-1.5 text-[14px] text-muted-foreground transition-colors hover:bg-muted/70">
          <Sparkles className="size-3.5 text-amber-400" />
          <span className="font-medium">Seedance 2.0 VIP</span>
          <span className="text-amber-400">💎</span>
          <ChevronDown className="size-3" />
        </button>
        {['16:9', '720P', '5s'].map((v) => (
          <button key={v} className="flex items-center gap-1 rounded-xl bg-muted/40 px-2.5 py-1.5 text-[14px] text-muted-foreground transition-colors hover:bg-muted/70">
            {v}<ChevronDown className="size-3" />
          </button>
        ))}
        <button className="flex items-center gap-1 rounded-xl bg-muted/40 px-2.5 py-1.5 text-[14px] text-muted-foreground transition-colors hover:bg-muted/70">
          <Volume2 className="size-3.5" /><ChevronDown className="size-3" />
        </button>

        <div className="flex-1" />

        <button className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/50"><Languages className="size-3.5" /></button>
        <button className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/50"><Shuffle className="size-3.5" /></button>
        <span className="text-[14px] text-muted-foreground">1个</span>

        <div className="flex items-center gap-1 px-1.5 text-[14px]">
          <Zap className="size-3 text-amber-400" />
          <span className="font-medium text-amber-400">108</span>
          <span className="text-muted-foreground/60">/ 835</span>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex size-9 items-center justify-center rounded-full bg-primary shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50"
        >
          {isGenerating
            ? <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            : <ArrowUp className="size-4 text-primary-foreground" />}
        </button>
      </div>
    </NodeBase>
  )
}

function PresetGroup({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div className="flex rounded-lg bg-muted/30 p-0.5">
        {options.map((opt) => (
          <button key={opt} onClick={() => onChange(opt)}
            className={cn('flex-1 rounded-md px-1.5 py-1 text-[14px] transition-colors',
              value === opt ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export default memo(VideoSynthesisNode)
