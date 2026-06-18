/**
 * AI 服务通用类型定义
 */

/** 生成任务状态 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

/** 文本生成请求 */
export interface TextGenRequest {
  model: string
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  /** 上游节点的输出文本（串联上下文） */
  contextTexts?: string[]
}

/** 文本生成响应 */
export interface TextGenResponse {
  text: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/** 图片生成请求 */
export interface ImageGenRequest {
  model: string
  prompt: string
  negativePrompt?: string
  width?: number
  height?: number
  count?: number
  /** 参考图 URL（图生图） */
  referenceImage?: string
  /** 风格参考 */
  styleReference?: string
}

/** 视频生成请求 */
export interface VideoGenRequest {
  model: string
  prompt: string
  negativePrompt?: string
  duration?: number
  resolution?: string
  /** 首帧图片 */
  firstFrameImage?: string
  /** 尾帧图片 */
  lastFrameImage?: string
  /** 参考视频 URL */
  referenceVideo?: string
}

/** 视频生成响应 */
export interface VideoGenResponse {
  taskId: string
  status: TaskStatus
  /** 完成后返回的视频 URL */
  videoUrl?: string
  /** 预估等待时间（秒） */
  estimatedSeconds?: number
}

/** 音频生成请求 */
export interface AudioGenRequest {
  model: string
  text: string
  voice?: string
  speed?: number
  /** 参考音频 URL（音色克隆） */
  referenceAudio?: string
}

/** 音频生成响应 */
export interface AudioGenResponse {
  taskId: string
  status: TaskStatus
  audioUrl?: string
  duration?: number
}

/** 模型信息 */
export interface ModelInfo {
  id: string
  name: string
  type: 'text' | 'image' | 'video' | 'audio'
  provider: string
  description?: string
  tags?: string[]
  /** 模型能力 */
  capabilities?: {
    maxTokens?: number
    maxResolution?: string
    maxDuration?: number
    supportedRatios?: string[]
  }
}

/** Provider 配置 */
export interface ProviderConfig {
  id?: string
  name: string
  apiKey: string
  baseUrl: string
  /** 当前启用的模型列表（已排除被禁用的） */
  models: string[]
  /** 全部模型列表（含被禁用的） */
  allModels?: string[]
  /** 被禁用的模型 ID 列表 */
  disabledModels?: string[]
  enabled: boolean
}

/** API 错误 */
export class AIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public provider?: string,
  ) {
    super(message)
    this.name = 'AIError'
  }
}
