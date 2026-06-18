/**
 * API 密钥与 Provider 配置管理
 *
 * 配置优先级：环境变量 > config 文件 > 默认值
 * 运行时可通过 /api/config 读写（仅影响当前进程，重启后回退到文件/环境变量）
 */

import type { ProviderConfig } from './types'

type DefaultConfig = Omit<ProviderConfig, 'id' | 'apiKey'>

const DEFAULT_CONFIGS: Record<string, DefaultConfig> = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'dall-e-3', 'o4-mini'],
    enabled: false,
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash'],
    enabled: false,
  },
  qwen: {
    name: '通义千问 / 万相',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen3-max', 'qwen3-plus', 'qwen-vl-max', 'wan2.1-t2i-xl', 'cosyvoice-2'],
    enabled: false,
  },
  kimi: {
    name: 'Moonshot Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-auto', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    enabled: false,
  },
  volces: {
    name: '火山引擎（即梦）',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [
      'doubao-seed-2-0-pro-260215',
      'doubao-seedream-5-0-260128',
      'doubao-seedream-4-5-251128',
      'doubao-seedream-4-0-250828',
      'doubao-seedance-2-0-260128',
      'doubao-seedance-2-0-fast-260128',
      'doubao-seedance-1-5-pro-251215',
      'doubao-seedance-1-0-pro-250528',
      'doubao-seedance-1-0-pro-fast-251015',
    ],
    enabled: false,
  },
  zhipu: {
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4v-plus', 'cogview-4', 'cogvideo-x'],
    enabled: false,
  },
}

/** 环境变量 → Provider 映射 */
const ENV_KEY_MAP: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  qwen: 'DASHSCOPE_API_KEY',
  kimi: 'MOONSHOT_API_KEY',
  volces: 'ARK_API_KEY',
  zhipu: 'ZHIPU_API_KEY',
}

/** 运行时内存中的覆盖配置（setConfig 写入，重启后丢失） */
interface RuntimeOverride {
  apiKey?: string
  enabled?: boolean
  /** 禁用的模型 ID 集合。为空/不存在表示全部启用 */
  disabledModels?: string[]
}

const runtimeOverrides = new Map<string, RuntimeOverride>()

/** 读取所有 Provider 配置（合并环境变量 > 运行时覆盖 > 默认值） */
export function getAllConfigs(): ProviderConfig[] {
  return Object.entries(DEFAULT_CONFIGS).map(([id, defaults]) => {
    const envKey = process.env[ENV_KEY_MAP[id]] ?? ''
    const override = runtimeOverrides.get(id) ?? {}
    const disabledSet = new Set(override.disabledModels ?? [])
    return {
      ...defaults,
      id,
      apiKey: override.apiKey ?? envKey,
      enabled: override.enabled ?? (!!envKey || defaults.enabled),
      models: defaults.models.filter((m) => !disabledSet.has(m)),
      allModels: defaults.models,
      disabledModels: override.disabledModels ?? [],
    }
  })
}

/** 获取单个 Provider 配置 */
export function getConfig(providerId: string): ProviderConfig | undefined {
  return getAllConfigs().find((c) => c.id === providerId)
}

/** 运行时设置 API Key / enabled / disabledModels（不影响环境变量和文件） */
export function setConfig(
  providerId: string,
  patch: Partial<Pick<ProviderConfig, 'apiKey' | 'enabled'>> & { disabledModels?: string[] },
) {
  const existing = runtimeOverrides.get(providerId) ?? {}
  runtimeOverrides.set(providerId, { ...existing, ...patch })
}

/** 获取指定模型的 Provider 配置（modelId → provider） */
const MODEL_PROVIDER_MAP: Record<string, string> = {}
for (const [providerId, cfg] of Object.entries(DEFAULT_CONFIGS)) {
  for (const model of cfg.models) {
    MODEL_PROVIDER_MAP[model] = providerId
  }
}

export function getProviderForModel(modelId: string): string | undefined {
  return MODEL_PROVIDER_MAP[modelId]
}

export { DEFAULT_CONFIGS, ENV_KEY_MAP }
