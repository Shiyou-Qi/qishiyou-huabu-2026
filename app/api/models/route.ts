/**
 * GET /api/models
 *
 * 返回所有可用模型列表，支持按 type 筛选。
 * 自动排除 Provider 级别禁用的模型。
 *
 * Query: ?type=text|image|video|audio
 * Response: { models: ModelInfo[] }
 */

import { NextResponse } from 'next/server'
import { MODELS, getModelsByType } from '@/lib/services/ai/index'
import { getAllConfigs, getProviderForModel } from '@/lib/services/ai/config'

export async function GET(request: Request) {
  // 构建 Provider 启用状态 map
  const providerEnabled = new Map<string, boolean>()
  const disabledSet = new Set<string>()
  for (const cfg of getAllConfigs()) {
    providerEnabled.set(cfg.id, cfg.enabled)
    for (const m of cfg.disabledModels ?? []) {
      disabledSet.add(m)
    }
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  const allModels = type ? getModelsByType(type) : MODELS
  // 只过滤掉用户在设置中手动禁用的模型，不过滤未配置 API 密钥的 Provider
  const filtered = allModels.filter((m) => !disabledSet.has(m.id))

  // 附带每个模型的可用状态
  const models = filtered.map((m) => {
    const provider = getProviderForModel(m.id)
    const configured = provider ? (providerEnabled.get(provider) ?? false) : false
    return { ...m, configured }
  })

  return NextResponse.json({ models })
}
