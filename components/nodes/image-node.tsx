'use client'

import { memo, useRef, useState, useLayoutEffect, useEffect } from 'react'
import { NodeProps, Node } from '@xyflow/react'
import { ImageIcon, Upload, ArrowUp, X, Maximize2, Sparkles, Loader2, Link2, Unlink, Download } from 'lucide-react'
import { CustomNodeData, useFlowStore, IMAGE_TAB_HANDLES, PROMPT_HANDLE } from '@/lib/store'
import { ModelSelector, type ModelOption } from '@/components/model-selector'
import { Lightbox } from '@/components/lightbox'
import { NodeBase } from './node-base'
import { cn } from '@/lib/utils'
import { useModels } from '@/hooks/use-models'
import { useConnectedPrompt } from '@/hooks/use-connected-prompt'
import { saveToLibrary } from '@/lib/save-to-library'

type Tab = 'prompt' | 'text2img' | 'img2img' | 'ref'
type Ratio = '1:1' | '4:3' | '16:9' | '9:16' | '3:4'

const TABS: { id: Tab; label: string }[] = [
  { id: 'prompt',   label: '提示词' },
  { id: 'text2img', label: '文生图' },
  { id: 'img2img',  label: '图生图' },
  { id: 'ref',      label: '参考图' },
]
const RATIOS: Ratio[] = ['1:1', '4:3', '16:9', '9:16', '3:4']
const COUNTS = [1, 2, 4]

type ImageNodeProps = NodeProps<Node<CustomNodeData>>

// ─── Input node: standalone image card with upload ────────────────────────────
function ImageInputNode({ id, data, selected }: ImageNodeProps) {
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const openMaterialPicker = useFlowStore((s) => s.openMaterialPicker)
  const [aspectRatio, setAspectRatio] = useState<number>(1)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setAspectRatio(img.naturalWidth / img.naturalHeight)
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateNodeData(id, { imageUrl: undefined, status: 'idle', meta: undefined })
    setAspectRatio(1)
    setNaturalSize(null)
  }

  const nodeWidth = naturalSize
    ? Math.max(220, Math.min(460, Math.round(280 * aspectRatio)))
    : 280

  return (
    <NodeBase

      nodeType="image"
      label={data.label}
      status={data.status}
      selected={selected}
      onDelete={() => deleteNode(id)}
      icon={<ImageIcon className="size-3.5" />}
      hasInput={false}
      hasOutput={true}
      widthPx={nodeWidth}
      noPadding
    >
      <div className="relative overflow-hidden bg-muted/30" style={{ aspectRatio }}>
        {data.imageUrl ? (
          <>
            <div
              role="button"
              tabIndex={0}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setLightboxSrc(data.imageUrl as string)}
              onKeyDown={(e) => e.key === 'Enter' && setLightboxSrc(data.imageUrl as string)}
              className="group/img relative cursor-zoom-in size-full"
              title="点击放大查看"
            >
              <img src={data.imageUrl as string} alt={data.label} onLoad={handleImageLoad} className="size-full object-cover" />
              {/* 悬浮放大提示 */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover/img:bg-black/10 group-hover/img:opacity-100">
                <Maximize2 className="size-5 text-white drop-shadow-md opacity-0 scale-75 transition-all delay-75 duration-200 group-hover/img:opacity-100 group-hover/img:scale-100" />
              </div>
            </div>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); openMaterialPicker(id) }}
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg bg-background/80 text-foreground backdrop-blur-sm transition-all hover:bg-background hover:scale-105"
              title="从资源库替换"
            >
              <Upload className="size-3.5" />
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleClear}
              className="absolute right-10 top-2 flex size-7 items-center justify-center rounded-lg bg-background/80 text-foreground backdrop-blur-sm transition-all hover:bg-destructive hover:text-white hover:scale-105"
              title="清除"
            >
              <X className="size-3.5" />
            </button>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 px-2 py-2">
              <p className="truncate text-[13px] text-white/90">
                {naturalSize ? `${naturalSize.w}×${naturalSize.h}` : ''}{data.meta ? ` · ${data.meta as string}` : ''}
              </p>
            </div>
          </>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => openMaterialPicker(id)}
            onKeyDown={(e) => e.key === 'Enter' && openMaterialPicker(id)}
            className="flex size-full cursor-pointer flex-col items-center justify-center gap-2 transition-colors hover:bg-muted/50"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted/60">
              <Upload className="size-4 text-muted-foreground" />
            </div>
            <p className="text-[14px] text-muted-foreground">点击选择素材</p>
          </div>
        )}
      </div>
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} alt={data.label} />
    </NodeBase>
  )
}

// ─── Result node: shows generated image ──────────────────────────────────────
function ImageResultNode({ id, data, selected }: ImageNodeProps) {
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const [aspectRatio, setAspectRatio] = useState<number>(1)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setAspectRatio(img.naturalWidth / img.naturalHeight)
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
  }

  const nodeWidth = naturalSize
    ? Math.max(220, Math.min(460, Math.round(280 * aspectRatio)))
    : 280

  return (
    <NodeBase

      nodeType="image"
      label={data.label}
      status={data.status}
      selected={selected}
      onDelete={() => deleteNode(id)}
      icon={<ImageIcon className="size-3.5" />}
      hasInput={true}
      hasOutput={true}
      widthPx={nodeWidth}
      noPadding
    >
      <div className="relative overflow-hidden bg-muted/30" style={{ aspectRatio }}>
        {data.imageUrl ? (
          <>
            <div
              role="button"
              tabIndex={0}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setLightboxSrc(data.imageUrl as string)}
              onKeyDown={(e) => e.key === 'Enter' && setLightboxSrc(data.imageUrl as string)}
              className="group/img relative cursor-zoom-in size-full"
              title="点击放大查看"
            >
              <img src={data.imageUrl as string} alt={data.label} onLoad={handleImageLoad} className="size-full object-cover" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover/img:bg-black/10 group-hover/img:opacity-100">
                <Maximize2 className="size-5 text-white drop-shadow-md opacity-0 scale-75 transition-all delay-75 duration-200 group-hover/img:opacity-100 group-hover/img:scale-100" />
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 px-2 py-2">
              <p className="truncate text-[13px] text-white/80">
                {naturalSize ? `${naturalSize.w}×${naturalSize.h}` : ''}{data.meta ? ` · ${data.meta as string}` : ''}
              </p>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  const a = document.createElement('a')
                  a.href = data.imageUrl as string
                  a.download = `${data.label || 'image'}.png`
                  a.click()
                }}
                className="shrink-0 flex size-7 items-center justify-center rounded-lg bg-white/15 text-white/80 backdrop-blur-sm transition-colors hover:bg-white/30 hover:text-white"
                title="下载图片"
              >
                <Download className="size-3.5" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            {data.status === 'generating'
              ? <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
              : <ImageIcon className="size-8 text-muted-foreground/20" />}
            <p className="text-[14px] text-muted-foreground/50">
              {data.status === 'generating' ? '生成中…' : '等待生成'}
            </p>
          </div>
        )}
      </div>
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} alt={data.label} />
    </NodeBase>
  )
}

/** Tab → 左侧连接点 id */
const TAB_HANDLES: Record<Tab, string> = {
  prompt:   PROMPT_HANDLE,
  text2img: 'tab-text2img',
  img2img:  'tab-img2img',
  ref:      'tab-imgref',
}

// ─── Tool node: prompt + params, no upload area ───────────────────────────────
function ImageToolNode({ id, data, selected }: ImageNodeProps) {
  const [tab, setTab] = useState<Tab>('prompt')
  const [ratio, setRatio] = useState<Ratio>('16:9')
  const [count, setCount] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [prompt, setPrompt] = useState<string>((data.content as string) || '')
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [inputCreated, setInputCreated] = useState<Partial<Record<Tab, boolean>>>({})
  const connectedPrompt = useConnectedPrompt(id)
  const effectivePrompt = connectedPrompt ? connectedPrompt.text : prompt
  // ── 模型列表（从后端动态获取）
  const { models: imageModels, loading: modelsLoading } = useModels({ type: 'image' })
  const [selectedModel, setSelectedModel] = useState<string>('')
  // 模型列表加载后自动选第一个
  useEffect(() => {
    if (imageModels.length > 0 && !selectedModel) {
      setSelectedModel(imageModels[0].id)
    }
  }, [imageModels, selectedModel])

  const deleteNode = useFlowStore((s) => s.deleteNode)
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const addResultNode = useFlowStore((s) => s.addResultNode)
  const addInputNode = useFlowStore((s) => s.addInputNode)

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
          systemPrompt: `你是一个专业的AI绘画提示词优化师。请将用户输入优化为一个高质量的绘画提示词。要求:
1. 如果输入是简短描述,扩展细节(光线、构图、风格、材质、色彩)
2. 如果输入已经详细,保持原意但让表达更精准
3. 添加合适的画质关键词(如 8K、大师作品、超精细等)
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

  // ── 测量 wrapper + 3 个 tab 按钮的真实位置，动态算每个端口的 top% ──
  const wrapperRef = useRef<HTMLDivElement>(null)
  const tabBtnRefs = useRef<Partial<Record<Tab, HTMLButtonElement>>>({})
  const [portTops, setPortTops] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    TABS.forEach((t, i) => {
      init[TAB_HANDLES[t.id]] = `${((i + 1) / (TABS.length + 1)) * 100}%`
    })
    return init
  })

  useLayoutEffect(() => {
    const measure = () => {
      const wrap = wrapperRef.current
      if (!wrap) return
      const wrapBox = wrap.getBoundingClientRect()
      if (wrapBox.height === 0) {
        requestAnimationFrame(measure)
        return
      }
      const next: Record<string, string> = {}
      TABS.forEach((t) => {
        const btn = tabBtnRefs.current[t.id]
        if (!btn) return
        const btnBox = btn.getBoundingClientRect()
        const centerY = btnBox.top - wrapBox.top + btnBox.height / 2
        next[TAB_HANDLES[t.id]] = `${(centerY / wrapBox.height) * 100}%`
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
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  const handleTabChange = (t: Tab) => {
    setTab(t)
    if ((t === 'img2img' || t === 'ref') && !inputCreated[t]) {
      addInputNode(id, 'image', {
        label: t === 'img2img' ? '参考图' : '风格参考图',
        status: 'idle',
        mode: 'input',
      }, TAB_HANDLES[t])
      setInputCreated((prev) => ({ ...prev, [t]: true }))
    }
  }

  const canGenerate = !isGenerating && !!effectivePrompt.trim()

  const handleGenerate = async () => {
    if (!canGenerate || !selectedModel) return
    setIsGenerating(true)
    updateNodeData(id, { status: 'generating' })

    try {
      // 收集参考图 URL（从左侧连接的 input 节点获取）
      const state = useFlowStore.getState()
      const edges = state.edges || []
      const incomingEdge = edges.find(
        (e: Record<string, unknown>) => {
          if (e.target !== id || e.targetHandle !== TAB_HANDLES[tab]) return false
          const src = state.nodes?.find((n: Record<string, unknown>) => n.id === e.source)
          const srcType = (src?.data as Record<string, unknown> | undefined)?.type
          return srcType !== 'text' && srcType !== 'promptAssistant' && srcType !== 'scene'
        },
      )
      let referenceImage: string | undefined
      if (incomingEdge) {
        const sourceNode = state.nodes?.find(
          (n: Record<string, unknown>) => n.id === incomingEdge.source,
        )
        const nodeData = sourceNode?.data as Record<string, unknown> | undefined
        referenceImage = (nodeData?.imageUrl as string | undefined) || undefined
      }

      const standardSize: Record<Ratio, string> = {
        '1:1':   '1024x1024',
        '4:3':   '1024x768',
        '3:4':   '768x1024',
        '16:9':  '1344x768',
        '9:16':  '768x1344',
      }
      const hiresSize: Record<Ratio, string> = {
        '1:1':   '1920x1920',
        '4:3':   '2048x1536',
        '3:4':   '1536x2048',
        '16:9':  '2560x1440',
        '9:16':  '1440x2560',
      }
      const needsHires = selectedModel.includes('seedream-5') || selectedModel.includes('seedream-4-5')
      const ratioToSize = needsHires ? hiresSize : standardSize
      const [wStr, hStr] = (ratioToSize[ratio] || (needsHires ? '1920x1920' : '1024x1024')).split('x')
      const resW = parseInt(wStr, 10)
      const resH = parseInt(hStr, 10)

      const result = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: effectivePrompt,
          width: resW,
          height: resH,
          count,
          referenceImage: tab === 'img2img' || tab === 'ref' ? referenceImage : undefined,
        }),
      })

      if (!result.ok) {
        const err = await result.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${result.status}`)
      }

      const data = await result.json()
      const imageUrl = data.imageUrl as string | undefined

      if (imageUrl) {
        updateNodeData(id, { status: 'completed' })
        // 为每个生成结果创建 result 节点
        for (let i = 0; i < count; i++) {
          setTimeout(() => {
            addResultNode(id, 'image', {
              imageUrl,
              status: 'completed',
              meta: ratio,
              mode: 'result',
            })
          }, i * 150)
        }
        saveToLibrary({ url: imageUrl, title: `${data.label} · ${ratio}`, type: 'image' })
      } else {
        throw new Error('接口未返回图片地址')
      }
    } catch (err) {
      console.error('图片生成失败:', err)
      updateNodeData(id, { status: 'failed', meta: err instanceof Error ? err.message : '未知错误' })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <NodeBase
      ref={wrapperRef}

      nodeType="image"
      label={data.label}
      status={data.status}
      selected={selected}
      onDelete={() => deleteNode(id)}
      icon={<ImageIcon className="size-3.5" />}
      hasInput={false}
      inputPorts={[
        { id: TAB_HANDLES.prompt,   label: '提示词', top: portTops[TAB_HANDLES.prompt], color: '!bg-amber-400 !border-background !border-2' },
        { id: TAB_HANDLES.text2img, label: '文生图', top: portTops[TAB_HANDLES.text2img] },
        { id: TAB_HANDLES.img2img,  label: '图生图', top: portTops[TAB_HANDLES.img2img] },
        { id: TAB_HANDLES.ref,      label: '参考图', top: portTops[TAB_HANDLES.ref] },
      ]}
      width="w-[560px]"

    >
      {/* 左侧 Tab 列 + 右侧提示词 */}
      <div className="-mx-3.5 mb-3 flex gap-2 px-3.5">
        <div className="flex w-[68px] shrink-0 flex-col gap-1 rounded-xl bg-muted/30 p-1">
          {TABS.map((t) => (
            <button key={t.id} ref={(el) => { if (el) tabBtnRefs.current[t.id] = el }}
              onClick={() => handleTabChange(t.id)}
              className={cn('rounded-lg py-1.5 text-[14px] font-medium transition-colors',
                tab === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 min-w-0 flex-col gap-1.5">
          {(tab === 'img2img' || tab === 'ref') && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-2.5 py-1.5">
              <div className="size-1.5 rounded-full bg-blue-400" />
              <p className="text-[12px] leading-tight text-blue-400">
                {tab === 'img2img' ? '请在左侧连接「参考图」素材节点' : '请在左侧连接「风格参考」素材节点'}
              </p>
            </div>
          )}
          {connectedPrompt && (
            <div className="flex items-center justify-between rounded-md bg-amber-500/10 px-2.5 py-1" title="外部提示词已接入，本地输入已锁定">
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
                <Link2 className="size-3" />
                来自「{connectedPrompt.label}」
              </span>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setPrompt(connectedPrompt.text); connectedPrompt.disconnect() }}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Unlink className="size-2.5" />
                断开
              </button>
            </div>
          )}
          <div className="relative flex-1">
            <textarea
              value={connectedPrompt ? connectedPrompt.text : prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px' }}
              disabled={!!connectedPrompt}
              placeholder="描述你想生成的画面…"
              rows={3}
              title={connectedPrompt ? '外部提示词已接入，本地输入已锁定' : undefined}
              className={cn(
                'w-full h-full min-h-[80px] resize-none overflow-y-auto rounded-lg border-2 px-2.5 py-2 pb-7 text-[12.5px] leading-relaxed focus:outline-none',
                connectedPrompt
                  ? 'cursor-not-allowed border-amber-400/30 bg-muted/40 text-foreground/50'
                  : 'border-border/30 bg-muted/20 text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40'
              )}
            />
            {!connectedPrompt && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); optimizePrompt() }}
                disabled={!prompt.trim() || isOptimizing}
                title="AI 优化提示词"
                className="absolute right-1.5 bottom-2 z-10 text-indigo-400 transition-all hover:text-indigo-300 hover:scale-110 disabled:opacity-15 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isOptimizing
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <Sparkles className="size-3.5" />
                }
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar — 尺寸比例移到这里，和数量对齐 */}
      <div className="-mx-3.5 mt-3 flex items-center gap-1.5 border-t border-border/40 px-3.5 pt-2.5">
        <ModelSelector
          models={imageModels}
          selected={selectedModel}
          onSelect={setSelectedModel}
        />
        <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 p-0.5">
          {COUNTS.map((c) => (
            <button key={c} onClick={() => setCount(c)}
              className={cn('rounded-md px-2 py-1 text-[14px] transition-colors',
                count === c ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {c}张
            </button>
          ))}
        </div>
        <select value={ratio} onChange={(e) => setRatio(e.target.value as Ratio)}
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded-lg border border-border/40 bg-muted/40 px-2 py-1 text-[14px] text-foreground focus:outline-none">
          {RATIOS.map((r) => <option key={r}>{r}</option>)}
        </select>
        <div className="flex-1" />
        <button className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/50">
          <Maximize2 className="size-3.5" />
        </button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={handleGenerate} disabled={!canGenerate}
          className="flex size-8 items-center justify-center rounded-full bg-primary shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-40">
          {isGenerating
            ? <div className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            : <ArrowUp className="size-3.5 text-primary-foreground" />}
        </button>
      </div>
    </NodeBase>
  )
}

// ─── Router ───────────────────────────────────────────────────────────────────
function ImageNode(props: ImageNodeProps) {
  const { data } = props
  if (data.mode === 'input') return <ImageInputNode {...props} />
  if (data.mode === 'result') return <ImageResultNode {...props} />
  return <ImageToolNode {...props} />
}

function OptionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export default memo(ImageNode)
