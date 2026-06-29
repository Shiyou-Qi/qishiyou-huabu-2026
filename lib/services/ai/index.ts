/**
 * AI 服务统一入口
 *
 * 根据 modelId → Provider 分发到对应的客户端
 */

import type {
  TextGenRequest,
  TextGenResponse,
  ImageGenRequest,
  VideoGenRequest,
  VideoGenResponse,
  AudioGenRequest,
  AudioGenResponse,
  ModelInfo,
} from './types'
import { AIError } from './types'
import { getProviderForModel } from './config'
import {
  textGen, textGenStream, imageGen,
  videoGenSeedance, videoTaskSeedance,
  videoGenCogVideoX, videoTaskCogVideoX,
  audioGenCosyVoice, audioTaskCosyVoice,
} from './client'

/** 模型列表（供前端使用） */
export const MODELS: ModelInfo[] = [
  // ── 文本模型 ──
  { id: 'deepseek-v4-pro',   name: 'DeepSeek V4 Pro',  type: 'text',  provider: 'deepseek', description: '最新旗舰 · 百万上下文 · 多模态', tags: ['旗舰'], capabilities: { maxTokens: 131072 } },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', type: 'text', provider: 'deepseek', description: '轻量极速 · 高性价比',             tags: ['轻量'], capabilities: { maxTokens: 65536 } },
  { id: 'doubao-seed-2-0-pro-260215', name: '豆包 Seed 2.0 Pro', type: 'text', provider: 'volces',  description: '多模态旗舰 · 原生全模态理解 · 长推理', tags: ['旗舰'], capabilities: { maxTokens: 16384 } },
  { id: 'gpt-4o',        name: 'GPT-4o',          type: 'text',  provider: 'openai',   description: '多模态旗舰 · 128K 上下文',      tags: ['旗舰'], capabilities: { maxTokens: 16384 } },
  { id: 'gpt-4o-mini',   name: 'GPT-4o Mini',     type: 'text',  provider: 'openai',   description: '轻量快速 · 日常任务',            tags: ['轻量'], capabilities: { maxTokens: 16384 } },
  { id: 'o4-mini',       name: 'o4-mini',          type: 'text',  provider: 'openai',   description: '推理增强 · 复杂逻辑',            tags: ['推理'], capabilities: { maxTokens: 100000 } },
  { id: 'qwen3-max',     name: 'Qwen3 Max',        type: 'text',  provider: 'qwen',     description: '阿里旗舰 · 多语言 · 长文本',      tags: ['旗舰'], capabilities: { maxTokens: 32768 } },
  { id: 'qwen3-plus',    name: 'Qwen3 Plus',       type: 'text',  provider: 'qwen',     description: '均衡体验 · 高性价比',              tags: [],       capabilities: { maxTokens: 131072 } },
  { id: 'moonshot-v1-auto', name: 'Kimi Auto',     type: 'text',  provider: 'kimi',     description: '长文本 · 20万字上下文',           tags: ['长文'], capabilities: { maxTokens: 8192 } },
  { id: 'glm-4-plus',    name: 'GLM-4 Plus',       type: 'text',  provider: 'zhipu',    description: '智谱旗舰 · 多模态理解',           tags: ['旗舰'], capabilities: { maxTokens: 4096 } },

  // ── 图片模型 ──
  { id: 'dall-e-3',      name: 'DALL·E 3',         type: 'image', provider: 'openai',   description: '高清写实 · 宽画幅 · 理解力强',    tags: ['写实'], capabilities: { maxResolution: '1792x1024', supportedRatios: ['1:1','16:9','9:16'] } },
  { id: 'wan2.1-t2i-xl', name: '通义万相 2.1',      type: 'image', provider: 'qwen',     description: '文生图 · 国风擅长 · 多比例',      tags: ['国风'], capabilities: { maxResolution: '1920x1080', supportedRatios: ['1:1','16:9','9:16','4:3','3:4'] } },
  { id: 'doubao-seedream-5-0-260128', name: '即梦 Seedream 5.0',  type: 'image', provider: 'volces',   description: '最新旗舰 · 视觉推理 · 信息可视化',    tags: ['旗舰'], capabilities: { maxResolution: '2048x2048', supportedRatios: ['1:1','16:9','9:16','4:3','3:4'] } },
  { id: 'doubao-seedream-4-5-251128', name: '即梦 Seedream 4.5',  type: 'image', provider: 'volces',   description: '高清质感 · 人像优化 · 细节控',    tags: ['高清'], capabilities: { maxResolution: '2048x2048', supportedRatios: ['1:1','16:9','9:16','4:3','3:4'] } },
  { id: 'doubao-seedream-4-0-250828', name: '即梦 Seedream 4.0',  type: 'image', provider: 'volces',   description: '快速出图 · 批量生成',              tags: ['快速'], capabilities: { maxResolution: '1024x1024', supportedRatios: ['1:1','16:9','9:16'] } },
  { id: 'cogview-4',     name: 'CogView-4',         type: 'image', provider: 'zhipu',    description: '智谱生图 · 中文理解力强',          tags: [],       capabilities: { maxResolution: '1024x1024' } },

  // ── 视频模型 ──
  { id: 'doubao-seedance-2-0-260128',    name: '即梦 Seedance 2.0',      type: 'video', provider: 'volces', description: '旗舰视频生成 · 高画质 · 多模态',     tags: ['旗舰'], capabilities: { maxDuration: 15 } },
  { id: 'doubao-seedance-2-0-fast-260128', name: '即梦 Seedance 2.0 Fast', type: 'video', provider: 'volces', description: '快速出片 · 标准画质 · 3–10s',     tags: ['快速'], capabilities: { maxDuration: 10 } },
  { id: 'doubao-seedance-1-5-pro-251215',  name: '即梦 Seedance 1.5 Pro',  type: 'video', provider: 'volces', description: '稳定输出 · 首尾帧 · 3–15s',       tags: [],       capabilities: { maxDuration: 15 } },
  { id: 'doubao-seedance-1-0-pro-250528',  name: '即梦 Seedance 1.0 Pro',  type: 'video', provider: 'volces', description: '经典款 · 5–10s',                   tags: [],       capabilities: { maxDuration: 10 } },
  { id: 'doubao-seedance-1-0-pro-fast-251015', name: '即梦 Seedance 1.0 Fast', type: 'video', provider: 'volces', description: '极速预览 · 3–5s',                 tags: ['快速'], capabilities: { maxDuration: 5 } },
  { id: 'cogvideo-x',    name: 'CogVideoX',         type: 'video', provider: 'zhipu',    description: '智谱视频 · 6s 短视频',             tags: [],       capabilities: { maxDuration: 6 } },

  // ── 音频模型 ──
  { id: 'cosyvoice-2',   name: 'CosyVoice 2',      type: 'audio', provider: 'qwen',     description: '阿里语音合成 · 音色克隆',         tags: ['克隆'], capabilities: {} },
]

/** 按类型筛选模型 */
export function getModelsByType(type: string): ModelInfo[] {
  return MODELS.filter((m) => m.type === type)
}

/** 文本生成 */
export async function generateText(req: TextGenRequest): Promise<TextGenResponse> {
  const provider = getProviderForModel(req.model)
  if (!provider) throw new AIError(`不支持的模型: ${req.model}`, 400)
  return textGen(provider, req)
}

/** 文本生成（流式 SSE） */
export async function generateTextStream(req: TextGenRequest): Promise<ReadableStream<Uint8Array>> {
  const provider = getProviderForModel(req.model)
  if (!provider) throw new AIError(`不支持的模型: ${req.model}`, 400)
  return textGenStream(provider, req)
}

/** 图片生成 */
export async function generateImage(req: ImageGenRequest): Promise<{ imageUrl: string }> {
  const provider = getProviderForModel(req.model)
  if (!provider) throw new AIError(`不支持的模型: ${req.model}`, 400)
  return imageGen(provider, req)
}

/** 视频生成（异步任务） */
export async function generateVideo(req: VideoGenRequest): Promise<VideoGenResponse> {
  const provider = getProviderForModel(req.model)
  if (!provider) throw new AIError(`不支持的模型: ${req.model}`, 400)

  if (provider === 'volces') {
    return videoGenSeedance(req)
  }
  if (provider === 'zhipu') {
    return videoGenCogVideoX(req)
  }

  throw new AIError(`视频生成暂不支持 ${provider}`, 400, provider)
}

/** 视频任务状态查询 */
export async function queryVideoTask(taskId: string, provider?: string): Promise<VideoGenResponse> {
  if (provider === 'zhipu') {
    return videoTaskCogVideoX(taskId)
  }
  return videoTaskSeedance(taskId)
}

/** 音频生成（CosyVoice TTS） */
export async function generateAudio(req: AudioGenRequest): Promise<AudioGenResponse> {
  const provider = getProviderForModel(req.model)
  if (!provider) throw new AIError(`不支持的模型: ${req.model}`, 400)

  if (provider === 'qwen') {
    return audioGenCosyVoice(req)
  }

  throw new AIError(`音频生成暂不支持 ${provider}`, 400, provider)
}

/** 音频任务状态查询 */
export async function queryAudioTask(taskId: string): Promise<AudioGenResponse> {
  return audioTaskCosyVoice(taskId)
}
