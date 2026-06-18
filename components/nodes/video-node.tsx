'use client'

import { memo, useRef, useState, useMemo, useEffect, useLayoutEffect, useCallback } from 'react'
import { NodeProps, Node } from '@xyflow/react'
import { createPortal } from 'react-dom'
import { Video, Upload, ChevronDown, ArrowUp, Check, X, Maximize2, Play, ImageIcon, Music, Sparkles, Loader2, Link2, Unlink, Download } from 'lucide-react'
import { CustomNodeData, NodeType, useFlowStore, VIDEO_TAB_HANDLES, PROMPT_HANDLE } from '@/lib/store'
import { NodeBase } from './node-base'
import { ModelSelector, type ModelOption } from '@/components/model-selector'
import { Lightbox } from '@/components/lightbox'
import { VideoPlayer } from '@/components/video-player'
import { cn } from '@/lib/utils'
import { useModels } from '@/hooks/use-models'
import { useConnectedPrompt } from '@/hooks/use-connected-prompt'
import { saveToLibrary, extractVideoThumbnail } from '@/lib/save-to-library'


type Tab = 'text2video' | 'ref' | 'firstlast' | 'extend'
type Ratio = '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | 'auto'
type Resolution = '480p' | '720p' | '1080p'
type DurationMode = 'manual' | 'smart'

const TABS: { id: Tab; label: string }[] = [
  { id: 'text2video', label: '文生视频' },
  { id: 'ref',        label: '全能参考' },
  { id: 'firstlast',  label: '首尾帧' },
  { id: 'extend',     label: '视频延长' },
]
/** Tab → 左侧连接点 id（一一对应 NodeBase 上 inputPorts 的顺序） */
const TAB_HANDLES: Record<Tab, (typeof VIDEO_TAB_HANDLES)[number]> = {
  text2video: 'tab-text2video',
  ref:        'tab-ref',
  firstlast:  'tab-firstlast',
  extend:     'tab-extend',
}
const RATIOS: { id: Ratio; label: string; w: number; h: number }[] = [
  { id: '21:9',  label: '21:9', w: 21, h: 9 },
  { id: '16:9',  label: '16:9', w: 16, h: 9 },
  { id: '4:3',   label: '4:3',  w: 4,  h: 3 },
  { id: '1:1',   label: '1:1',  w: 1,  h: 1 },
  { id: '3:4',   label: '3:4',  w: 3,  h: 4 },
  { id: '9:16',  label: '9:16', w: 9,  h: 16 },
  { id: 'auto',  label: '智能',  w: 0,  h: 0 },
]
const RESOLUTIONS: Resolution[] = ['480p', '720p', '1080p']
const MAX_REF = 15

type VideoNodeProps = NodeProps<Node<CustomNodeData>>

// ─── Input node ───────────────────────────────────────────────────────────────
function VideoInputNode({ id, data, selected }: VideoNodeProps) {
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const openMaterialPicker = useFlowStore((s) => s.openMaterialPicker)
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const mediaUrl = (data.imageUrl || data.videoUrl) as string | undefined

  const handleMediaLoad = (e: React.SyntheticEvent<HTMLVideoElement | HTMLImageElement>) => {
    if (e.currentTarget instanceof HTMLVideoElement) {
      const v = e.currentTarget
      if (v.videoWidth && v.videoHeight) {
        setAspectRatio(v.videoWidth / v.videoHeight)
        setNaturalSize({ w: v.videoWidth, h: v.videoHeight })
      }
    } else {
      const img = e.currentTarget
      setAspectRatio(img.naturalWidth / img.naturalHeight)
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateNodeData(id, { imageUrl: undefined, videoUrl: undefined, status: 'idle', meta: undefined })
    setAspectRatio(16 / 9)
    setNaturalSize(null)
  }

  const nodeWidth = naturalSize
    ? Math.max(220, Math.min(460, Math.round(280 * aspectRatio)))
    : 300

  return (
    <NodeBase

      nodeType="video"
      label={data.label}
      status={data.status}
      selected={selected}
      onDelete={() => deleteNode(id)}
      icon={<Video className="size-3.5" />}
      hasInput={false}
      hasOutput={true}
      widthPx={nodeWidth}
      noPadding
    >
      <div className="relative overflow-hidden bg-muted/30" style={{ aspectRatio }}>
        {mediaUrl ? (
          <>
            {data.videoUrl
              ? <VideoPlayer src={mediaUrl!} onLoadedMetadata={handleMediaLoad} className="size-full" />
              : (
                <div
                  role="button"
                  tabIndex={0}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setLightboxSrc(mediaUrl!)}
                  onKeyDown={(e) => e.key === 'Enter' && setLightboxSrc(mediaUrl!)}
                  className="group/img relative cursor-zoom-in size-full"
                  title="点击放大查看"
                >
                  <img src={mediaUrl} alt={data.label} onLoad={handleMediaLoad} className="size-full object-cover" />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover/img:bg-black/10 group-hover/img:opacity-100">
                    <Maximize2 className="size-5 text-white drop-shadow-md opacity-0 scale-75 transition-all delay-75 duration-200 group-hover/img:opacity-100 group-hover/img:scale-100" />
                  </div>
                </div>
              )}
            <button onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); openMaterialPicker(id) }}
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm transition-all hover:bg-background hover:scale-105"
              title="从资源库替换">
              <Upload className="size-3.5" />
            </button>
            <button onPointerDown={(e) => e.stopPropagation()}
              onClick={handleClear}
              className="absolute right-10 top-2 flex size-7 items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm transition-all hover:bg-destructive hover:text-white hover:scale-105"
              title="清除">
              <X className="size-3.5" />
            </button>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 px-2 py-2">
              <p className="truncate text-[13px] text-white/90">
                {naturalSize ? `${naturalSize.w}×${naturalSize.h}` : ''}{data.meta ? ` · ${data.meta as string}` : ''}
              </p>
            </div>
          </>
        ) : (
          <div role="button" tabIndex={0}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => openMaterialPicker(id)}
            onKeyDown={(e) => e.key === 'Enter' && openMaterialPicker(id)}
            className="flex size-full cursor-pointer flex-col items-center justify-center gap-2 transition-colors hover:bg-muted/50">
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

// ─── Result node ──────────────────────────────────────────────────────────────
function VideoResultNode({ id, data, selected }: VideoNodeProps) {
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9)

  const handleVideoLoad = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget
    if (v.videoWidth && v.videoHeight) {
      setAspectRatio(v.videoWidth / v.videoHeight)
      setNaturalSize({ w: v.videoWidth, h: v.videoHeight })
    }
  }

  const nodeWidth = naturalSize
    ? Math.max(220, Math.min(460, Math.round(280 * aspectRatio)))
    : 300

  return (
    <NodeBase

      nodeType="video"
      label={data.label}
      status={data.status}
      selected={selected}
      onDelete={() => deleteNode(id)}
      icon={<Video className="size-3.5" />}
      hasInput={true}
      hasOutput={true}
      widthPx={nodeWidth}
      noPadding
    >
      <div className="relative overflow-hidden bg-muted/30" style={{ aspectRatio }}>
        {data.videoUrl ? (
          <VideoPlayer
            src={data.videoUrl as string}
            className="size-full"
            onLoadedMetadata={handleVideoLoad}
            downloadName={`${data.label || 'video'}.mp4`}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            {data.status === 'generating'
              ? <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
              : <Play className="size-8 text-muted-foreground/20 ml-0.5" />}
            <p className="text-[14px] text-muted-foreground/50">
              {data.status === 'generating' ? '生成中…' : '等待生成'}
            </p>
            {data.meta && <p className="text-[13px] text-muted-foreground/40">{data.meta as string}</p>}
          </div>
        )}
      </div>
    </NodeBase>
  )
}

// ─── Tool node ────────────────────────────────────────────────────────────────
function VideoToolNode({ id, data, selected }: VideoNodeProps) {
  const [tab, setTab] = useState<Tab>('text2video')
  const [ratio, setRatio] = useState<Ratio>('16:9')
  const [resolution, setResolution] = useState<Resolution>('720p')
  const [durationMode, setDurationMode] = useState<DurationMode>('manual')
  const [duration, setDuration] = useState(5)
  const [genCount, setGenCount] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [inputCreated, setInputCreated] = useState<Partial<Record<Tab, boolean>>>({})
  const [refCount, setRefCount] = useState(0)
  const [prompt, setPrompt] = useState<string>('')
  const [isOptimizing, setIsOptimizing] = useState(false)
  const connectedPrompt = useConnectedPrompt(id)
  const effectivePrompt = connectedPrompt ? connectedPrompt.text : prompt
  const promptRef = useRef<HTMLDivElement>(null)
  // ── 模型列表（从后端动态获取）
  const { models: videoModels } = useModels({ type: 'video' })
  const [selectedModel, setSelectedModel] = useState<string>('')
  useEffect(() => {
    if (videoModels.length > 0 && !selectedModel) {
      setSelectedModel(videoModels[0].id)
    }
  }, [videoModels, selectedModel])

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

  // ── 测量 wrapper + 4 个 tab 按钮的真实位置，动态算每个端口的 top%
  const wrapperRef = useRef<HTMLDivElement>(null)
  const tabBtnRefs = useRef<Partial<Record<Tab, HTMLButtonElement>>>({})
  /**
   * 端口 id → top% 字符串。
   * 初始值用「4 等分」占位（避免 measure 跑完前 4 个端口全部 fallback 到 '50%' 堆在一起），
   * useLayoutEffect 测到真实位置后会立刻覆盖。
   */
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
      // 注意：不要在 height===0 时早返回 —— React Flow 节点初次挂载时可能还是 0，
      // 早返回会导致 portTops 永远是初始 fallback。直接尝试算即可（NaN 也会被覆盖）。
      if (wrapBox.height === 0) {
        // 等一帧再试；ResizeObserver 在 wrapper 高度真正出现时会再触发 measure
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
      // prompt handle aligned to prompt section
      const pEl = promptRef.current
      if (pEl) {
        const pBox = pEl.getBoundingClientRect()
        const pCenter = pBox.top - wrapBox.top + pBox.height / 2
        next[PROMPT_HANDLE] = `${(pCenter / wrapBox.height) * 100}%`
      }
      // 仅在值真正变化时 setState，避免无谓 re-render
      setPortTops((prev) => {
        const changed = Object.keys(next).some((k) => next[k] !== prev[k])
        return changed ? next : prev
      })
    }
    measure()
    // rAF 兜底：节点首次挂载 + tab 按钮 ref 真正可读，通常是下一个动画帧
    const rafId = requestAnimationFrame(measure)
    // 监听 wrapper 尺寸变化（窗口缩放、options 折行、生成中预览变化等）
    const wrap = wrapperRef.current
    if (!wrap) return () => cancelAnimationFrame(rafId)
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [])

  const deleteNode = useFlowStore((s) => s.deleteNode)
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const addResultNode = useFlowStore((s) => s.addResultNode)
  const addInputNode = useFlowStore((s) => s.addInputNode)
  const removeEdgesWhere = useFlowStore((s) => s.removeEdgesWhere)

  const handleTabChange = (t: Tab) => {
    setTab(t)
    // 切换到"首尾帧"tab 自动创建首帧+尾帧节点并连线
    if (t === 'firstlast') {
      handleCreateInputForTab('firstlast')
    }
    // 切换到"视频延长"tab 自动创建源视频节点并连线
    if (t === 'extend') {
      handleCreateInputForTab('extend')
    }
  }

  const handleCreateInputForTab = (t: Tab) => {
    if (inputCreated[t]) return
    const handleId = TAB_HANDLES[t]
    if (t === 'ref') {
      setInputCreated((p) => ({ ...p, [t]: true }))
    }
    if (t === 'firstlast') {
      addInputNode(id, 'image', { label: '首帧', status: 'idle', mode: 'input', meta: '首帧参考图' }, handleId)
      window.setTimeout(
        () => addInputNode(id, 'image', { label: '尾帧', status: 'idle', mode: 'input', meta: '尾帧参考图' }, handleId),
        50
      )
      setInputCreated((p) => ({ ...p, [t]: true }))
    }
    if (t === 'extend') {
      addInputNode(
        id, 'video', { label: '源视频', status: 'idle', mode: 'input', meta: '视频延长' }, handleId
      )
      setInputCreated((p) => ({ ...p, [t]: true }))
    }
  }

  const handleAddRef = (refType: NodeType) => {
    if (refCount >= MAX_REF) return
    const next = refCount + 1
    const typeLabel: Record<NodeType, string> = {
      image: '参考图',
      video: '参考视频',
      audio: '参考音频',
      text: '参考文本',
      script: '参考脚本',
      scene: '参考分镜',
    }
    addInputNode(
      id,
      refType,
      {
        label: `${typeLabel[refType]} ${next}`,
        status: 'idle',
        mode: 'input',
      },
      TAB_HANDLES.ref
    )
    setRefCount(next)
  }

  const handleGenerate = async () => {
    if (!selectedModel || !effectivePrompt.trim()) return
    setIsGenerating(true)
    updateNodeData(id, { status: 'generating' })
    try {
      // 从 store 收集首帧/尾帧/参考图 URL（扫描所有 handle，不限当前 tab）
      const state = useFlowStore.getState()
      const edges = state.edges || []
      const findMediaEdge = (handleId: string) =>
        edges.find((e: Record<string, unknown>) => {
          if (e.target !== id || e.targetHandle !== handleId) return false
          const src = (state.nodes as Record<string, unknown>[]).find(
            (n: Record<string, unknown>) => n.id === e.source,
          )
          const srcType = ((src?.data ?? {}) as Record<string, unknown>).type
          return srcType !== 'text' && srcType !== 'promptAssistant' && srcType !== 'scene'
        })
      const getImageUrl = (edge: Record<string, unknown> | undefined) => {
        if (!edge) return undefined
        const src = (state.nodes as Record<string, unknown>[]).find(
          (n: Record<string, unknown>) => n.id === edge.source,
        )
        return ((src?.data ?? {}) as Record<string, unknown>).imageUrl as string | undefined
      }

      // 首尾帧
      const firstLastEdge = findMediaEdge(TAB_HANDLES.firstlast)
      let firstFrameImage = getImageUrl(firstLastEdge)

      // 全能参考也可作为首帧
      if (!firstFrameImage) {
        const refEdge = findMediaEdge(TAB_HANDLES.ref)
        firstFrameImage = getImageUrl(refEdge)
      }

      // 当前 tab handle 作为补充
      if (!firstFrameImage) {
        const tabEdge = findMediaEdge(TAB_HANDLES[tab])
        firstFrameImage = getImageUrl(tabEdge)
      }

      let lastFrameImage: string | undefined
      if (firstLastEdge) {
        const src = (state.nodes as Record<string, unknown>[]).find(
          (n: Record<string, unknown>) => n.id === (firstLastEdge as Record<string, unknown>).source,
        )
        const meta = ((src?.data ?? {}) as Record<string, unknown>).meta
        if (meta === '尾帧参考图') lastFrameImage = firstFrameImage
      }

      const ratioMap: Record<Ratio, string> = {
        '21:9': '21:9', '16:9': '16:9', '4:3': '4:3',
        '1:1': '1:1', '3:4': '3:4', '9:16': '9:16', 'auto': '16:9',
      }

      // POST 提交异步任务
      const submitRes = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: effectivePrompt,
          duration: durationMode === 'manual' ? duration : undefined,
          resolution: resolution === '720p' ? '720p' : resolution,
          firstFrameImage,
          lastFrameImage,
        }),
      })
      if (!submitRes.ok) {
        const err = await submitRes.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${submitRes.status}`)
      }
      const { taskId } = await submitRes.json() as { taskId: string }

      // 轮询任务状态
      let attempts = 0
      const maxAttempts = 120  // 最多等 10 分钟（5s 间隔）
      const poll = async (): Promise<string | undefined> => {
        const pollRes = await fetch(`/api/generate/video?taskId=${encodeURIComponent(taskId)}`)
        if (!pollRes.ok) throw new Error(`轮询失败 HTTP ${pollRes.status}`)
        const result = await pollRes.json() as {
          status: string; videoUrl?: string
        }
        if (result.status === 'completed' || result.status === 'failed') {
          return result.videoUrl
        }
        if (++attempts >= maxAttempts) throw new Error('视频生成超时')
        await new Promise((r) => setTimeout(r, 5000))
        return poll()
      }

      updateNodeData(id, {
        status: 'generating',
        meta: `${resolution} · ${ratioMap[ratio]} · ${durationMode === 'smart' ? '智能时长' : duration + 's'} · 提交成功，等待视频…`,
      })
      const videoUrl = await poll()

      if (!videoUrl) throw new Error('生成未返回视频地址')

      const metaStr = `${resolution} · ${ratioMap[ratio]} · ${durationMode === 'smart' ? '智能时长' : duration + 's'}`
      updateNodeData(id, { status: 'completed', videoUrl })

      for (let i = 0; i < genCount; i++) {
        setTimeout(() => {
          addResultNode(id, 'video', {
            videoUrl,
            status: 'completed',
            meta: metaStr,
            mode: 'result',
          })
        }, i * 150)
      }

      extractVideoThumbnail(videoUrl).then((thumb) => {
        saveToLibrary({ url: videoUrl, title: `${data.label} · ${metaStr}`, type: 'video', thumbnail: thumb })
      })
    } catch (err) {
      console.error('视频生成失败:', err)
      updateNodeData(id, { status: 'failed', meta: String(err instanceof Error ? err.message : '未知错误') })
    } finally {
      setIsGenerating(false)
    }
  }

  const canGenerate = !isGenerating && !!effectivePrompt.trim()

  const ratioToAspect: Record<Ratio, number> = {
    '21:9': 21 / 9,
    '16:9': 16 / 9,
    '4:3': 4 / 3,
    '1:1': 1,
    '3:4': 3 / 4,
    '9:16': 9 / 16,
    'auto': 16 / 9,
  }

  return (
    <NodeBase
      ref={wrapperRef}

      nodeType="video"
      label={data.label}
      status={data.status}
      selected={selected}
      onDelete={() => deleteNode(id)}
      icon={<Video className="size-3.5" />}
      hasInput={false}
      inputPorts={[
        { id: TAB_HANDLES.text2video, label: '文生视频', top: portTops[TAB_HANDLES.text2video] },
        { id: TAB_HANDLES.ref,        label: '全能参考', top: portTops[TAB_HANDLES.ref] },
        { id: TAB_HANDLES.firstlast,  label: '首尾帧',   top: portTops[TAB_HANDLES.firstlast] },
        { id: TAB_HANDLES.extend,     label: '视频延长', top: portTops[TAB_HANDLES.extend] },
        { id: PROMPT_HANDLE, label: '提示词', top: portTops[PROMPT_HANDLE] ?? '75%', color: '!bg-amber-400 !border-background !border-2' },
      ]}
      width="w-[560px]"

    >
      {/* 左侧 Tab 列 + 右侧两段式（提示行上方 / 视频预览下方），对齐 image 节点 */}
      <div className="-mx-3.5 mb-3 flex gap-2 px-3.5">
        {/* 左侧 Tab 列（垂直，对齐 image 节点） */}
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

        {/* 右侧主内容：上方提示行 / 下方视频内嵌预览 */}
        <div className="flex flex-1 min-w-0 flex-col gap-2">
          {/* 上：tab 对应的 hint / ref 计数 / 提示行 */}
          <div className="flex flex-col gap-1.5">
            {tab === 'ref' && (
              <div className="flex items-center gap-2 rounded-lg border-2 border-border/30 bg-muted/20 px-2.5 py-1.5">
                <span className="text-[13px] text-muted-foreground">
                  已连接 <span className="font-semibold text-foreground">{refCount}</span> / {MAX_REF} 个参考
                </span>
                <div className="flex-1" />
                {refCount < MAX_REF ? (
                  <div className="flex gap-1">
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => handleAddRef('image')}
                      className="flex items-center gap-1 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[13px] font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
                    >
                      <ImageIcon className="size-2.5" />
                      图片
                    </button>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => handleAddRef('video')}
                      className="flex items-center gap-1 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[13px] font-medium text-violet-400 transition-colors hover:bg-violet-500/20"
                    >
                      <Video className="size-2.5" />
                      视频
                    </button>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => handleAddRef('audio')}
                      className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[13px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
                    >
                      <Music className="size-2.5" />
                      音频
                    </button>
                  </div>
                ) : (
                  <span className="text-[13px] text-amber-400">已达上限</span>
                )}
              </div>
            )}
            {tab === 'firstlast' && inputCreated['firstlast'] && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-2.5 py-1.5">
                <div className="size-1.5 rounded-full bg-blue-400" />
                <p className="text-[13px] leading-tight text-blue-400">首帧 / 尾帧节点已创建，请在左侧分别上传</p>
              </div>
            )}
            {tab === 'extend' && inputCreated['extend'] && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-2.5 py-1.5">
                <div className="size-1.5 rounded-full bg-blue-400" />
                <p className="text-[13px] leading-tight text-blue-400">源视频节点已创建，请在左侧上传要延长的视频</p>
              </div>
            )}
            <p className="text-[13px] leading-relaxed text-muted-foreground/70">
              {connectedPrompt
                ? <span className="text-amber-500/80">提示词已由外部节点提供</span>
                : !effectivePrompt.trim()
                  ? <span className="text-amber-400/80">待填写提示词，或连接文本节点</span>
                  : '提示词直接在本卡片中编辑'
              }
            </p>
          </div>

          {/* 下：内嵌视频预览 —— AI 结果缩略图（与 image 内嵌预览对齐；生成完仍自动外抛 result 节点） */}
          <div
            className="relative overflow-hidden rounded-xl border-2 border-border/30 bg-muted/30"
            style={{ aspectRatio: ratioToAspect[ratio], maxHeight: 220 }}
          >
            {data.videoUrl ? (
              <VideoPlayer
                src={data.videoUrl as string}
                className="size-full"
                downloadName={`${data.label || 'video'}.mp4`}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                {data.status === 'generating' || isGenerating ? (
                  <>
                    <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
                    <p className="text-[14px] text-muted-foreground/60">正在生成 {durationMode === 'smart' ? '智能时长' : `${duration}s`}…</p>
                  </>
                ) : (
                  <>
                    <Play className="size-7 text-muted-foreground/20 ml-0.5" />
                    <p className="text-[14px] text-muted-foreground/50">生成结果将显示在这里</p>
                    <p className="text-[13px] text-muted-foreground/30">完成时也会自动在右侧生成 result 节点</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 提示词区域 — 内联编辑 / 外部节点排斥切换 */}
      <div ref={promptRef} className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[13px] text-muted-foreground">提示词</span>
          {connectedPrompt ? (
            <span className="flex items-center gap-1 text-[13px] text-amber-500">
              <Link2 className="size-3" />
              来自「{connectedPrompt.label}」
            </span>
          ) : !prompt.trim() ? (
            <span className="text-[13px] text-amber-400/80">待填写</span>
          ) : null}
        </div>
        {connectedPrompt && (
          <div className="mb-1.5 flex items-center justify-between rounded-md bg-amber-500/10 px-2.5 py-1.5" title="外部提示词已接入，本地输入已锁定">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-amber-600">
              <Link2 className="size-3" />
              外部提示词已接入，本地输入已锁定
            </span>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setPrompt(connectedPrompt.text); connectedPrompt.disconnect() }}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Unlink className="size-3" />
              断开连接
            </button>
          </div>
        )}
        <div className="relative">
          <textarea
            value={connectedPrompt ? connectedPrompt.text : prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px' }}
            disabled={!!connectedPrompt}
            placeholder="描述你想生成的画面，或从左侧连接文本/提示词助手节点…"
            rows={4}
            title={connectedPrompt ? '外部提示词已接入，本地输入已锁定' : undefined}
            className={cn(
              'w-full resize-none overflow-y-auto rounded-lg border-2 px-2.5 py-2 pb-8 text-[12.5px] leading-relaxed focus:outline-none',
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
              className="absolute right-1.5 bottom-3 z-10 text-indigo-400 transition-all hover:text-indigo-300 hover:scale-110 disabled:opacity-15 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isOptimizing
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Sparkles className="size-3.5" />
              }
            </button>
          )}
        </div>
      </div>

      {/* Options — compact chip row */}
      <div className="mb-2 grid grid-cols-4 gap-1.5">
        <OptionChip
          label="比例"
          value={ratio}
          options={RATIOS.map((r) => ({ id: r.id, label: r.label }))}
          onSelect={(v) => setRatio(v as Ratio)}
        />
        <OptionChip
          label="分辨率"
          value={resolution}
          options={RESOLUTIONS.map((r) => ({ id: r, label: r }))}
          onSelect={(v) => setResolution(v as Resolution)}
        />
        <OptionChip
          label="时长"
          value={durationMode === 'smart' ? 'smart' : String(duration)}
          options={[
            { id: 'smart', label: '智能时长' },
            { id: '4', label: '4s' }, { id: '5', label: '5s' },
            { id: '6', label: '6s' }, { id: '8', label: '8s' },
            { id: '10', label: '10s' }, { id: '12', label: '12s' },
            { id: '15', label: '15s' },
          ]}
          renderValue={(v) => v === 'smart' ? '智能' : `${v}s`}
          onSelect={(v) => {
            if (v === 'smart') { setDurationMode('smart') }
            else { setDurationMode('manual'); setDuration(Number(v)) }
          }}
        />
        <OptionChip
          label="数量"
          value={String(genCount)}
          options={[
            { id: '1', label: '1 条' }, { id: '2', label: '2 条' },
            { id: '3', label: '3 条' }, { id: '4', label: '4 条' },
          ]}
          renderValue={(v) => `${v}条`}
          onSelect={(v) => setGenCount(Number(v))}
        />
      </div>

      {/* Bottom bar — mx-3.5 收边避开圆角 */}
      <div className="-mx-3.5 mt-3 flex items-center gap-1.5 border-t border-border/40 px-3.5 pt-2.5">
        <ModelSelector
          models={videoModels}
          selected={selectedModel}
          onSelect={setSelectedModel}
        />
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
function VideoNode(props: VideoNodeProps) {
  const { data } = props
  if (data.mode === 'input') return <VideoInputNode {...props} />
  if (data.mode === 'result') return <VideoResultNode {...props} />
  return <VideoToolNode {...props} />
}

function OptionChip({
  label,
  value,
  options,
  onSelect,
  renderValue,
}: {
  label: string
  value: string
  options: { id: string; label: string }[]
  onSelect: (id: string) => void
  renderValue?: (v: string) => string
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const initialPos = useRef({ top: -9999, left: -9999 })

  useEffect(() => {
    if (!open) return
    let rafId: number
    const sync = () => {
      const btn = btnRef.current
      const drop = dropRef.current
      if (btn && drop) {
        const r = btn.getBoundingClientRect()
        const dH = drop.offsetHeight
        const below = window.innerHeight - r.bottom - 8
        drop.style.top = `${below >= dH ? r.bottom + 4 : r.top - dH - 4}px`
        drop.style.left = `${r.left}px`
      }
      rafId = requestAnimationFrame(sync)
    }
    rafId = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(rafId)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node))
        setOpen(false)
    }
    const id = window.setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { window.clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [open])

  const display = renderValue ? renderValue(value) : options.find((o) => o.id === value)?.label ?? value

  return (
    <>
      <button
        ref={btnRef}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect()
            initialPos.current = { top: r.bottom + 4, left: r.left }
          }
          setOpen(!open)
        }}
        className={cn(
          'flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors',
          open ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted/30 hover:bg-muted/50',
        )}
      >
        <span className="text-[11px] text-muted-foreground/70">{label}</span>
        <span className="flex items-center gap-0.5 text-[13px] font-medium">
          {display}
          <ChevronDown className={cn('size-2.5 text-muted-foreground/50 transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: initialPos.current.top, left: initialPos.current.left, zIndex: 99999 }}
          className="min-w-[100px] rounded-lg border border-border/60 bg-popover/98 py-1 shadow-xl backdrop-blur-xl"
        >
          {options.map((opt) => (
            <button
              key={opt.id}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => { onSelect(opt.id); setOpen(false) }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors',
                value === opt.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80 hover:bg-muted/40',
              )}
            >
              {value === opt.id && <Check className="size-3 shrink-0" />}
              <span className={value !== opt.id ? 'ml-5' : ''}>{opt.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

export default memo(VideoNode)
