import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'materials')

function extFromContentType(ct: string, fallbackType: 'image' | 'video'): string {
  if (ct.includes('png')) return '.png'
  if (ct.includes('webp')) return '.webp'
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg'
  if (ct.includes('mp4')) return '.mp4'
  if (ct.includes('webm')) return '.webm'
  return fallbackType === 'image' ? '.png' : '.mp4'
}

/**
 * Download an external URL to local uploads directory with robust retry.
 * Returns the local URL path (e.g. `/uploads/materials/xxx.png`).
 */
export async function downloadToLocal(
  externalUrl: string,
  type: 'image' | 'video',
): Promise<string> {
  if (externalUrl.startsWith('/uploads/') || externalUrl.startsWith('data:')) {
    return externalUrl
  }

  await mkdir(UPLOAD_DIR, { recursive: true })

  const timeout = type === 'video' ? 120_000 : 60_000
  let resp: Response | undefined
  let lastError: unknown

  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      resp = await fetch(externalUrl, { signal: AbortSignal.timeout(timeout) })
      if (resp.ok) break
      const status = resp.status
      if (status >= 400 && status < 500) {
        throw new Error(`下载失败 HTTP ${status} (不可重试)`)
      }
      lastError = new Error(`HTTP ${status}`)
    } catch (e: unknown) {
      lastError = e
      const err = e instanceof Error ? e : undefined
      const msg = [
        err?.message,
        (err?.cause as Error | undefined)?.message,
        (err?.cause as Record<string, unknown> | undefined)?.code,
      ].filter(Boolean).join(' ')

      const retryable = /timeout|ECONNRESET|ECONNREFUSED|ENOTFOUND|UND_ERR|fetch failed|HTTP 5/i.test(msg)
      if (!retryable || attempt === 3) throw e

      const delay = (attempt + 1) * 3000
      console.log(`[素材下载] 第${attempt + 1}次失败 (${msg.slice(0, 80)})，${delay / 1000}s 后重试...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }

  if (!resp?.ok) {
    throw lastError || new Error('下载失败')
  }

  const ct = resp.headers.get('content-type') || ''
  const ext = extFromContentType(ct, type)
  const id = randomUUID()
  const diskName = `${id}${ext}`
  const buffer = Buffer.from(await resp.arrayBuffer())
  await writeFile(path.join(UPLOAD_DIR, diskName), buffer)

  return `/uploads/materials/${diskName}`
}
