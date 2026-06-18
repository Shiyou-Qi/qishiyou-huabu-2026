'use client'

import { memo, useState, useEffect, useRef } from 'react'
import { NodeProps, Node } from '@xyflow/react'
import { MessageSquareText, Loader2, Sparkles, ChevronDown, ChevronRight, Brain, Wand, Copy, Check } from 'lucide-react'
import { CustomNodeData, useFlowStore } from '@/lib/store'
import { ModelSelector } from '@/components/model-selector'
import { NodeBase } from './node-base'
import { useModels } from '@/hooks/use-models'
import { cn } from '@/lib/utils'

type PromptAssistantNodeProps = NodeProps<Node<CustomNodeData>>

const PROMPT_ASSISTANT_SYSTEM = `你是一个世界顶级的提示词工程师（Prompt Engineer）。你的职责是将用户的模糊意图转化为高质量、结构化的提示词。

优化规则：
1. 识别用户意图的核心目标（写文案/生图/做分析/写代码/翻译/总结等）
2. 补全缺失的上下文：角色设定、受众、语气、输出格式、长度限制
3. 添加约束条件减少歧义：明确禁止项、边界条件
4. 使用清晰的 Markdown 结构组织提示词
5. 如果是生图/生视频类提示词，加入视觉风格、构图、光线、色彩等描述维度
6. 只返回优化后的完整提示词，不要任何解释、不要标注"优化后"/"以下是优化结果"等引导语`

function PromptAssistantNode({ id, data, selected }: PromptAssistantNodeProps) {
  const [text, setText] = useState(data.content || '')
  const [collapsed, setCollapsed] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [reasoning, setReasoning] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [showReasoning, setShowReasoning] = useState(true)
  const [copied, setCopied] = useState(false)
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { models: textModels } = useModels({ type: 'text' })
  const [selectedModel, setSelectedModel] = useState<string>('')
  useEffect(() => {
    if (textModels.length > 0 && !selectedModel) {
      setSelectedModel(textModels[0].id)
    }
  }, [textModels, selectedModel])

  const syncHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  useEffect(syncHeight, [text, collapsed])

  const handleExpand = () => {
    setCollapsed(false)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
  }

  const handleBlur = () => {
    updateNodeData(id, { content: text, status: text.trim() ? 'ready' : 'idle' })
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* fallback */ }
  }

  const optimizePrompt = async () => {
    if (!text.trim() || isOptimizing) return
    setIsOptimizing(true)
    try {
      const res = await fetch('/api/generate/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'doubao-seed-2-0-pro-260215',
          prompt: text,
          systemPrompt: PROMPT_ASSISTANT_SYSTEM,
          temperature: 0.7,
          maxTokens: 1500,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = (await res.json()) as { text: string }
      if (result.text?.trim()) {
        setText(result.text.trim())
        updateNodeData(id, { content: result.text.trim(), status: 'completed' })
      }
    } catch (err) {
      console.error('提示词优化失败:', err)
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleGenerate = async () => {
    if (!text.trim() || isGenerating || !selectedModel) return
    setIsGenerating(true)
    setReasoning(null)
    setStreamingText('')
    setShowReasoning(true)
    updateNodeData(id, { status: 'generating' })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/generate/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: text,
          systemPrompt: PROMPT_ASSISTANT_SYSTEM,
          temperature: 0.8,
          maxTokens: 2048,
          stream: true,
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('无响应流')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let resultText = ''
      let resultReasoning = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const lines = part.split('\n')
          let eventType = ''
          let eventData = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim()
            else if (line.startsWith('data: ')) eventData = line.slice(6).trim()
          }
          if (!eventData) continue
          try {
            const parsed = JSON.parse(eventData)
            if (eventType === 'reasoning') { resultReasoning += parsed.content; setReasoning(resultReasoning) }
            else if (eventType === 'text') { resultText += parsed.content; setStreamingText(resultText) }
            else if (eventType === 'done') { resultText = parsed.text || resultText; setStreamingText(resultText) }
            else if (eventType === 'error') { throw new Error(parsed.message || '流式传输中断') }
          } catch { /* skip */ }
        }
      }

      if (resultText.trim()) {
        setText(resultText.trim())
        updateNodeData(id, { content: resultText.trim(), status: 'completed' })
      } else {
        throw new Error('生成结果为空')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('提示词生成失败:', err)
      updateNodeData(id, { status: 'failed' })
    } finally {
      setIsGenerating(false)
      setReasoning(null)
      setStreamingText('')
      abortRef.current = null
    }
  }

  const handleAbort = () => { abortRef.current?.abort() }

  const canGenerate = !isGenerating && !!text.trim() && !!selectedModel
  const charCount = text.length

  return (
    <NodeBase

      nodeType="promptAssistant"
      label={data.label}
      status={data.status}
      selected={selected}
      onDelete={() => deleteNode(id)}
      icon={<MessageSquareText className="size-3.5" />}
      width="w-[360px]"

    >
      <div className="nodrag nopan relative rounded-xl border border-border/40 bg-muted/20">
        {/* Reasoning panel (streaming only) */}
        {isGenerating && reasoning && (
          <div className="m-2.5 mb-0 rounded-lg border border-emerald-200/30 bg-emerald-50/30 p-2.5">
            <button
              className="flex w-full items-center gap-1.5 text-[13px] font-medium text-emerald-600"
              onClick={(e) => { e.stopPropagation(); setShowReasoning(!showReasoning) }}
            >
              {showReasoning ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              <Brain className="size-3" />
              思考过程
              <Loader2 className="ml-auto size-2.5 animate-spin" />
            </button>
            {showReasoning && (
              <p className="mt-1.5 text-[14px] leading-relaxed text-emerald-700/80 whitespace-pre-wrap">{reasoning}</p>
            )}
          </div>
        )}

        {/* Streaming overlay OR always-editable textarea OR collapsed preview */}
        {isGenerating ? (
          <div className="min-h-[96px] max-h-[400px] overflow-y-auto p-3.5 text-[13px] leading-relaxed text-foreground">
            {streamingText ? (
              <pre className="whitespace-pre-wrap font-sans">{streamingText}<span className="inline-block w-1.5 h-4 bg-emerald-400 animate-pulse align-middle ml-0.5" /></pre>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                生成中…
              </div>
            )}
          </div>
        ) : collapsed && text.trim() ? (
          <div
            className="relative cursor-pointer p-3.5"
            onClick={handleExpand}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p className="line-clamp-3 text-[13px] leading-relaxed text-foreground/80">{text}</p>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted/40 to-transparent rounded-b-xl" />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onBlur={handleBlur}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="点击输入意图，AI 帮你生成高质量提示词…"
            rows={3}
            className="nodrag nopan block min-h-[96px] w-full resize-none bg-transparent p-3.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
          />
        )}

        {/* Footer: collapse toggle + char count + copy */}
        {!isGenerating && (
          <div className="flex items-center justify-between border-t border-border/30 px-3 py-1.5">
            <div className="flex items-center gap-2">
              {text.trim() && (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed) }}
                  className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  {collapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
                  {collapsed ? '展开' : '收起'}
                </button>
              )}
              <span className="text-[12px] tabular-nums text-muted-foreground/50">{charCount} 字</span>
            </div>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleCopy}
              disabled={!text.trim()}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30"
            >
              {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        )}
      </div>

      {/* Bottom bar: model + optimize + generate */}
      <div className="-mx-3.5 mt-3 flex items-center gap-1.5 border-t border-border/40 px-3.5 pt-2.5">
        <ModelSelector models={textModels} selected={selectedModel} onSelect={setSelectedModel} />
        <div className="flex-1" />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); optimizePrompt() }}
          disabled={!text.trim() || isOptimizing || isGenerating}
          title="AI 优化提示词"
          className={cn(
            'flex size-7 items-center justify-center rounded-lg transition-all',
            'text-emerald-400 hover:text-emerald-300 hover:scale-110',
            'disabled:opacity-15 disabled:cursor-not-allowed disabled:hover:scale-100'
          )}
        >
          {isOptimizing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        </button>
        {isGenerating ? (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleAbort}
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
            className="flex size-7 items-center justify-center rounded-full bg-emerald-500 shadow-md shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-95 disabled:opacity-40"
          >
            <Wand className="size-3.5 text-white" />
          </button>
        )}
      </div>
    </NodeBase>
  )
}

export default memo(PromptAssistantNode)
