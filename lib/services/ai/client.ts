/**
 * OpenAI 兼容协议 REST 客户端
 *
 * 使用原生 fetch 调用所有兼容 OpenAI 协议的接口，
 * 覆盖：通义千问/万相、DeepSeek、Kimi、火山引擎即梦、智谱 GLM。
 *
 * 不依赖 openai SDK，避免 Turbopack 下的 Node shim 问题。
 */

import type { TextGenRequest, TextGenResponse, ImageGenRequest, VideoGenRequest, VideoGenResponse, TaskStatus } from './types'
import { AIError } from './types'
import { getConfig } from './config'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 判断是否为可重试的网络错误 */
function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message + ((err as { code?: string }).code || '')
    return msg.includes('ConnectTimeout') || msg.includes('UND_ERR_CONNECT_TIMEOUT')
      || msg.includes('fetch failed') || msg.includes('ECONNRESET')
      || msg.includes('ETIMEDOUT') || msg.includes('UND_ERR_SOCKET')
  }
  return false
}

/** 带认证 + 自动重试的 fetch 请求 */
async function apiFetch(
  providerId: string,
  endpoint: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const config = getConfig(providerId)
  if (!config?.apiKey) {
    throw new AIError(`${config?.name ?? providerId} 未配置 API Key`, 401, providerId)
  }

  const url = `${config.baseUrl.replace(/\/+$/, '')}${endpoint}`
  const maxRetries = 3

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          ...extraHeaders,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      })

      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        throw new AIError(
          `${config.name} API 错误 [${resp.status}]: ${text.slice(0, 300)}`,
          resp.status,
          providerId,
        )
      }

      return resp
    } catch (err) {
      if (attempt < maxRetries && isRetryable(err)) {
        const delay = (attempt + 1) * 3000
        console.warn(`[${config.name}] 连接失败，${delay / 1000}s 后重试 (${attempt + 1}/${maxRetries})...`)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }

  throw new AIError(`${config.name} 连接失败，已重试 ${maxRetries} 次`, 503, providerId)
}

/** 火山方舟 Ark · Seedance 视频生成 */
interface ArkContentBlock {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string; role?: 'first_frame' | 'last_frame' | 'reference' }
}

async function toPublicImageUrl(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:')) return imageUrl
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl
  // Local path (e.g. /uploads/materials/xxx.png) → base64 data URL
  const fs = await import('fs/promises')
  const path = await import('path')
  const filePath = path.join(process.cwd(), 'public', imageUrl)
  const buf = await fs.readFile(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  return `data:${mime};base64,${buf.toString('base64')}`
}

export async function videoGenSeedance(
  req: VideoGenRequest,
): Promise<VideoGenResponse> {
  const providerId = 'volces'
  const config = getConfig(providerId)
  if (!config?.apiKey) {
    throw new AIError('火山引擎即梦 未配置 API Key', 401, 'volces')
  }

  // 构造 content 数组（Ark 多模态 content 格式）
  const content: ArkContentBlock[] = []

  // 首帧图
  if (req.firstFrameImage) {
    const url = await toPublicImageUrl(req.firstFrameImage)
    content.push({
      type: 'image_url',
      image_url: { url, role: 'first_frame' },
    })
  }

  // 尾帧图
  if (req.lastFrameImage) {
    const url = await toPublicImageUrl(req.lastFrameImage)
    content.push({
      type: 'image_url',
      image_url: { url, role: 'last_frame' },
    })
  }

  // 文字描述（即便有图片也必传，描述期望的动效）
  content.push({ type: 'text', text: req.prompt })

  // 构造请求体
  const body: Record<string, unknown> = {
    model: req.model,
    content,
  }

  if (req.resolution) {
    body.resolution = req.resolution
  }

  // 提交异步任务（带重试）
  const url = `${config.baseUrl.replace(/\/+$/, '')}/contents/generations/tasks`
  let resp: Response | undefined
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      })
      break
    } catch (err) {
      if (attempt < 3 && isRetryable(err)) {
        console.warn(`[Seedance] 提交失败，${(attempt + 1) * 3}s 后重试 (${attempt + 1}/3)...`)
        await new Promise((r) => setTimeout(r, (attempt + 1) * 3000))
        continue
      }
      throw err
    }
  }

  if (!resp || !resp.ok) {
    const text = resp ? await resp.text().catch(() => '') : ''
    throw new AIError(`Seedance API 错误 [${resp?.status ?? 'N/A'}]: ${text.slice(0, 300)}`, resp?.status ?? 503, 'volces')
  }

  const data = await resp.json() as { id: string }

  if (!data.id) {
    throw new AIError('Seedance 任务创建失败，未返回 taskId', 500, 'volces')
  }

  return {
    taskId: data.id,
    status: 'pending',
    estimatedSeconds: req.duration ? req.duration * 10 : 60,
  }
}

/** 火山方舟 Ark · Seedance 任务状态查询 */
export async function videoTaskSeedance(taskId: string): Promise<VideoGenResponse> {
  const providerId = 'volces'
  const config = getConfig(providerId)
  if (!config?.apiKey) {
    throw new AIError('火山引擎即梦 未配置 API Key', 401, 'volces')
  }

  const url = `${config.baseUrl.replace(/\/+$/, '')}/contents/generations/tasks/${taskId}`

  let resp: Response | undefined
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
        signal: AbortSignal.timeout(30_000),
      })
      break
    } catch (err) {
      if (attempt < 2 && isRetryable(err)) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000))
        continue
      }
      throw err
    }
  }

  if (!resp || !resp.ok) {
    const text = resp ? await resp.text().catch(() => '') : ''
    throw new AIError(`Seedance 查询错误 [${resp?.status ?? 'N/A'}]: ${text.slice(0, 200)}`, resp?.status ?? 503, 'volces')
  }

  const data = await resp.json() as {
    id: string
    status: string  // queued | running | succeeded | failed
    content?: { video_url?: string }
    error?: { code: string; message: string }
  }

  const arkStatus = data.status
  // 映射 Ark 状态 → 应用状态
  const mappedStatus: TaskStatus =
    arkStatus === 'succeeded' ? 'completed' :
    arkStatus === 'failed'    ? 'failed' :
    arkStatus === 'running'   ? 'running' :
    'pending'

  return {
    taskId,
    status: mappedStatus,
    videoUrl: data.content?.video_url,
  }
}


/** 文本生成（流式 SSE） */
export async function textGenStream(
  providerId: string,
  req: TextGenRequest,
): Promise<ReadableStream<Uint8Array>> {
  const config = getConfig(providerId)
  if (!config?.apiKey) {
    throw new AIError(`${config?.name ?? providerId} 未配置 API Key`, 401, providerId)
  }

  const messages: ChatMessage[] = []

  if (req.systemPrompt) {
    messages.push({ role: 'system', content: req.systemPrompt })
  }

  let userContent = req.prompt
  if (req.contextTexts?.length) {
    userContent = [
      ...req.contextTexts.map((t, i) => `[参考上下文 ${i + 1}]\n${t}`),
      `[当前指令]\n${req.prompt}`,
    ].join('\n\n---\n\n')
  }

  messages.push({ role: 'user', content: userContent })

  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens,
      stream: true,
    }),
    signal: AbortSignal.timeout(300_000),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new AIError(
      `${config.name} API 错误 [${resp.status}]: ${text.slice(0, 300)}`,
      resp.status,
      providerId,
    )
  }

  if (!resp.body) {
    throw new AIError('流式响应无 body', 500, providerId)
  }

  // 转换上游 SSE → 我们的 SSE 格式
  const encoder = new TextEncoder()
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let fullReasoning = ''

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            // 发送完成事件
            controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ text: fullText, reasoning: fullReasoning || null })}\n\n`))
            controller.close()
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data:')) continue

            const jsonStr = trimmed.slice(5).trim()
            if (jsonStr === '[DONE]') continue

            try {
              const chunk = JSON.parse(jsonStr)
              const delta = chunk.choices?.[0]?.delta
              if (!delta) continue

              // 思考内容 (DeepSeek R1 / 豆包 Seed 1.6 reasoning)
              if (delta.reasoning_content) {
                fullReasoning += delta.reasoning_content
                controller.enqueue(encoder.encode(
                  `event: reasoning\ndata: ${JSON.stringify({ content: delta.reasoning_content })}\n\n`
                ))
              }

              // 正文内容
              if (delta.content) {
                fullText += delta.content
                controller.enqueue(encoder.encode(
                  `event: text\ndata: ${JSON.stringify({ content: delta.content })}\n\n`
                ))
              }
            } catch {
              // 跳过无法解析的行
            }
          }
        }
      } catch (err) {
        controller.enqueue(encoder.encode(
          `event: error\ndata: ${JSON.stringify({ message: err instanceof Error ? err.message : '流式传输中断' })}\n\n`
        ))
        controller.close()
      }
    },
  })

  return stream
}

/** 文本生成（非流式） */
export async function textGen(
  providerId: string,
  req: TextGenRequest,
): Promise<TextGenResponse> {
  const messages: ChatMessage[] = []

  if (req.systemPrompt) {
    messages.push({ role: 'system', content: req.systemPrompt })
  }

  let userContent = req.prompt
  if (req.contextTexts?.length) {
    userContent = [
      ...req.contextTexts.map((t, i) => `[参考上下文 ${i + 1}]\n${t}`),
      `[当前指令]\n${req.prompt}`,
    ].join('\n\n---\n\n')
  }

  messages.push({ role: 'user', content: userContent })

  const resp = await apiFetch(providerId, '/chat/completions', {
    model: req.model,
    messages,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens,
  })

  const data = await resp.json() as {
    choices: { message: { content?: string; reasoning_content?: string } }[]
    model: string
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  }

  const choice = data.choices?.[0]
  const text = choice?.message?.content
    || choice?.message?.reasoning_content
    || ''

  return {
    text,
    model: data.model,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  }
}

/** 图片生成 - DALL·E 兼容接口 */
async function imageGenDalle(providerId: string, req: ImageGenRequest): Promise<{ imageUrl: string }> {
  const resp = await apiFetch(providerId, '/images/generations', {
    model: req.model,
    prompt: req.prompt,
    n: req.count ?? 1,
    size: req.width && req.height
      ? `${req.width}x${req.height}`
      : '1024x1024',
  })

  const data = await resp.json() as { data: { url?: string; b64_json?: string }[] }
  const imageUrl = data.data?.[0]?.url ?? data.data?.[0]?.b64_json
  if (!imageUrl) throw new AIError('图片生成返回空结果', 500, providerId)

  return { imageUrl }
}

/** 火山引擎即梦图片生成 */
async function imageGenVolces(providerId: string, req: ImageGenRequest): Promise<{ imageUrl: string }> {
  const refImage = req.referenceImage ? await toPublicImageUrl(req.referenceImage) : undefined
  const resp = await apiFetch(providerId, '/images/generations', {
    model: req.model,
    prompt: req.prompt,
    negative_prompt: req.negativePrompt,
    size: `${req.width ?? 1024}x${req.height ?? 1024}`,
    n: req.count ?? 1,
    reference_image: refImage,
  })

  const data = await resp.json() as { data: { url: string }[] }
  const imageUrl = data.data?.[0]?.url
  if (!imageUrl) throw new AIError('即梦返回空结果', 500, 'volces')

  return { imageUrl }
}

/** 图片生成入口 */
export async function imageGen(
  providerId: string,
  req: ImageGenRequest,
): Promise<{ imageUrl: string }> {
  if (providerId === 'volces') {
    return imageGenVolces(providerId, req)
  }
  return imageGenDalle(providerId, req)
}

/** 智谱 CogVideoX 视频生成（异步任务） */
export async function videoGenCogVideoX(
  req: VideoGenRequest,
): Promise<VideoGenResponse> {
  const providerId = 'zhipu'
  const config = getConfig(providerId)
  if (!config?.apiKey) {
    throw new AIError('智谱 GLM 未配置 API Key', 401, 'zhipu')
  }

  const url = `${config.baseUrl.replace(/\/+$/, '')}/videos/generations`
  const body: Record<string, unknown> = {
    model: req.model,
    prompt: req.prompt,
  }

  if (req.firstFrameImage) {
    body.image_url = req.firstFrameImage
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new AIError(`CogVideoX API 错误 [${resp.status}]: ${text.slice(0, 300)}`, resp.status, 'zhipu')
  }

  const data = await resp.json() as { id?: string; task_id?: string }
  const taskId = data.id || data.task_id

  if (!taskId) {
    throw new AIError('CogVideoX 任务创建失败，未返回 taskId', 500, 'zhipu')
  }

  return {
    taskId,
    status: 'pending',
    estimatedSeconds: 120,
  }
}

/** 智谱 CogVideoX 任务状态查询 */
export async function videoTaskCogVideoX(taskId: string): Promise<VideoGenResponse> {
  const providerId = 'zhipu'
  const config = getConfig(providerId)
  if (!config?.apiKey) {
    throw new AIError('智谱 GLM 未配置 API Key', 401, 'zhipu')
  }

  const url = `${config.baseUrl.replace(/\/+$/, '')}/async-result/${taskId}`
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
    signal: AbortSignal.timeout(30_000),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new AIError(`CogVideoX 查询错误 [${resp.status}]: ${text.slice(0, 200)}`, resp.status, 'zhipu')
  }

  const data = await resp.json() as {
    task_status: string
    video_result?: { url?: string }[]
  }

  const status = data.task_status
  const mappedStatus: TaskStatus =
    status === 'SUCCESS' ? 'completed' :
    status === 'FAIL'    ? 'failed' :
    status === 'PROCESSING' ? 'running' :
    'pending'

  return {
    taskId,
    status: mappedStatus,
    videoUrl: data.video_result?.[0]?.url,
  }
}

/** 通义 CosyVoice 语音合成 */
export async function audioGenCosyVoice(
  req: import('./types').AudioGenRequest,
): Promise<import('./types').AudioGenResponse> {
  const providerId = 'qwen'
  const config = getConfig(providerId)
  if (!config?.apiKey) {
    throw new AIError('通义千问 未配置 API Key', 401, 'qwen')
  }

  const body: Record<string, unknown> = {
    model: req.model,
    input: {
      text: req.text,
    },
    parameters: {
      ...(req.voice ? { voice: req.voice } : { voice: 'longxiaochun' }),
      ...(req.speed != null ? { rate: req.speed } : {}),
      format: 'mp3',
      sample_rate: 22050,
    },
  }

  if (req.referenceAudio) {
    body.input = {
      ...body.input as object,
      reference_audio: req.referenceAudio,
    }
  }

  const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2audio/text-synthesis'
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new AIError(`CosyVoice API 错误 [${resp.status}]: ${text.slice(0, 300)}`, resp.status, 'qwen')
  }

  const data = await resp.json() as {
    output?: { task_id?: string; task_status?: string }
    request_id?: string
  }

  const taskId = data.output?.task_id
  if (!taskId) {
    throw new AIError('CosyVoice 任务创建失败', 500, 'qwen')
  }

  return {
    taskId,
    status: 'pending',
    duration: 0,
  }
}

/** 通义 CosyVoice 任务状态查询 */
export async function audioTaskCosyVoice(taskId: string): Promise<import('./types').AudioGenResponse> {
  const providerId = 'qwen'
  const config = getConfig(providerId)
  if (!config?.apiKey) {
    throw new AIError('通义千问 未配置 API Key', 401, 'qwen')
  }

  const url = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
    signal: AbortSignal.timeout(30_000),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new AIError(`CosyVoice 查询错误 [${resp.status}]: ${text.slice(0, 200)}`, resp.status, 'qwen')
  }

  const data = await resp.json() as {
    output?: {
      task_status?: string
      results?: { url?: string }[]
    }
  }

  const status = data.output?.task_status
  const mappedStatus: TaskStatus =
    status === 'SUCCEEDED' ? 'completed' :
    status === 'FAILED'    ? 'failed' :
    status === 'RUNNING'   ? 'running' :
    'pending'

  return {
    taskId,
    status: mappedStatus,
    audioUrl: data.output?.results?.[0]?.url,
    duration: 0,
  }
}
