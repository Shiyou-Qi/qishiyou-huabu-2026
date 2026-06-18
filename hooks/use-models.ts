'use client'

import { useEffect, useState } from 'react'

export interface ModelOption {
  id: string
  name: string
  description: string
  tags?: string[]
  /** Provider 的 API 密钥是否已配置 */
  configured?: boolean
}

interface UseModelsOptions {
  /** 模型类型筛选: text | image | video | audio */
  type?: string
}

/**
 * 从 GET /api/models 获取模型列表
 * 缓存 5 分钟避免重复请求
 */
let globalCache: Record<string, { models: ModelOption[]; ts: number }> = {}
const CACHE_TTL = 5 * 60 * 1000

export function useModels(opts: UseModelsOptions = {}) {
  const [models, setModels] = useState<ModelOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const key = opts.type ?? '__all__'

  useEffect(() => {
    const cached = globalCache[key]
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setModels(cached.models)
      setLoading(false)
      return
    }

    let cancelled = false

    const fetchModels = async () => {
      try {
        const url = opts.type
          ? `/api/models?type=${encodeURIComponent(opts.type)}`
          : '/api/models'
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const list: ModelOption[] = (data.models || []).map((m: Record<string, unknown>) => ({
          id: String(m.id),
          name: String(m.name),
          description: String(m.description || ''),
          tags: Array.isArray(m.tags) ? m.tags as string[] : undefined,
          configured: Boolean(m.configured),
        }))
        if (!cancelled) {
          globalCache[key] = { models: list, ts: Date.now() }
          setModels(list)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载模型列表失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchModels()
    return () => { cancelled = true }
  }, [key, opts.type])

  return { models, loading, error }
}
