import { NextResponse } from 'next/server'
import { readFile, writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'materials.json')
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'materials')
const MAX_SIZE = 100 * 1024 * 1024

interface StoredMaterial {
  id: string
  title: string
  type: string
  category: string
  url: string
  thumbnail?: string
  filename: string
  size: number
  mimeType: string
  createdAt: string
}

interface MaterialStore {
  categories: { id: string; label: string }[]
  materials: StoredMaterial[]
}

const DEFAULT_CATEGORIES = [
  { id: 'ai-image', label: 'AI图片' },
  { id: 'ai-video', label: 'AI视频' },
  { id: 'character', label: '人物' },
  { id: 'scene', label: '场景' },
  { id: 'object', label: '物品' },
  { id: 'style', label: '风格' },
  { id: 'audio', label: '音效' },
  { id: 'other', label: '其他' },
]

async function loadStore(): Promise<MaterialStore> {
  try {
    if (!existsSync(DATA_FILE)) return { categories: [...DEFAULT_CATEGORIES], materials: [] }
    const raw = await readFile(DATA_FILE, 'utf-8')
    const store: MaterialStore = JSON.parse(raw)
    const existingIds = new Set(store.categories.map((c) => c.id))
    for (const def of DEFAULT_CATEGORIES) {
      if (!existingIds.has(def.id)) store.categories.unshift(def)
    }
    return store
  } catch {
    return { categories: [...DEFAULT_CATEGORIES], materials: [] }
  }
}

async function saveStore(store: MaterialStore) {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2))
}

export async function GET() {
  const store = await loadStore()
  return NextResponse.json(store)
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const body = await request.json()
      const store = await loadStore()

      if (body.action === 'add-category') {
        const { id, label } = body
        if (!id || !label) return NextResponse.json({ error: '缺少分类信息' }, { status: 400 })
        if (store.categories.some((c: { id: string }) => c.id === id)) {
          return NextResponse.json({ error: '分类已存在' }, { status: 409 })
        }
        store.categories.push({ id, label })
        await saveStore(store)
        return NextResponse.json({ categories: store.categories })
      }

      if (body.action === 'register-local') {
        const { url, title, type, category, thumbnail } = body as {
          url: string; title: string; type: string; category: string; thumbnail?: string
        }
        if (!url || !type) return NextResponse.json({ error: '缺少 url / type' }, { status: 400 })

        const id = randomUUID()
        const filename = url.split('/').pop() || id
        let fileSize = 0
        try {
          const { stat } = await import('fs/promises')
          const filePath = path.join(process.cwd(), 'public', url)
          const s = await stat(filePath)
          fileSize = s.size
        } catch { /* file may not exist yet */ }

        const ext = path.extname(filename).toLowerCase()
        const mimeType = ext === '.png' ? 'image/png'
          : ext === '.webp' ? 'image/webp'
          : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
          : ext === '.mp4' ? 'video/mp4'
          : ext === '.webm' ? 'video/webm'
          : type === 'image' ? 'image/png' : 'video/mp4'

        let thumbnailUrl: string | undefined
        if (thumbnail?.startsWith('data:')) {
          const thumbData = thumbnail.split(',')[1]
          if (thumbData) {
            await mkdir(UPLOAD_DIR, { recursive: true })
            const thumbName = `${id}-thumb.jpg`
            await writeFile(path.join(UPLOAD_DIR, thumbName), Buffer.from(thumbData, 'base64'))
            thumbnailUrl = `/uploads/materials/${thumbName}`
          }
        }
        if (!thumbnailUrl && type === 'image') thumbnailUrl = url

        const cat = category || (type === 'image' ? 'ai-image' : type === 'video' ? 'ai-video' : 'other')
        if (!store.categories.some((c: { id: string }) => c.id === cat)) {
          const label = cat === 'ai-image' ? 'AI图片' : cat === 'ai-video' ? 'AI视频' : cat
          store.categories.push({ id: cat, label })
        }

        const material: StoredMaterial = {
          id, title: title || `AI ${type} ${new Date().toLocaleTimeString()}`,
          type, category: cat, url, thumbnail: thumbnailUrl,
          filename, size: fileSize, mimeType,
          createdAt: new Date().toISOString(),
        }
        store.materials.unshift(material)
        await saveStore(store)
        return NextResponse.json(material)
      }

      if (body.action === 'save-from-url') {
        const { url, title, type, category, thumbnail } = body as {
          url: string; title: string; type: string; category: string; thumbnail?: string
        }
        if (!url || !type) return NextResponse.json({ error: '缺少 url / type' }, { status: 400 })

        await mkdir(UPLOAD_DIR, { recursive: true })
        const id = randomUUID()

        // Download the file from URL (with retry for transient network errors)
        let resp: Response | undefined
        for (let attempt = 0; attempt <= 3; attempt++) {
          try {
            resp = await fetch(url, { signal: AbortSignal.timeout(30_000) })
            if (resp.ok) break
          } catch (e: unknown) {
            const err = e instanceof Error ? e : undefined
            const msg = [err?.message, (err?.cause as Error | undefined)?.message, (err?.cause as Record<string, unknown> | undefined)?.code].join(' ')
            const retryable = /timeout|ECONNRESET|ECONNREFUSED|ENOTFOUND|UND_ERR|fetch failed/i.test(msg)
            if (!retryable || attempt === 3) throw e
            console.log(`[素材下载] 失败，${(attempt + 1) * 3}s 后重试 (${attempt + 1}/3)...`)
            await new Promise(r => setTimeout(r, (attempt + 1) * 3000))
          }
        }
        if (!resp || !resp.ok) return NextResponse.json({ error: '下载文件失败' }, { status: 502 })

        const contentType = resp.headers.get('content-type') || ''
        const ext = contentType.includes('png') ? '.png'
          : contentType.includes('webp') ? '.webp'
          : contentType.includes('mp4') ? '.mp4'
          : contentType.includes('webm') ? '.webm'
          : type === 'image' ? '.png' : '.mp4'

        const diskName = `${id}${ext}`
        const buffer = Buffer.from(await resp.arrayBuffer())
        await writeFile(path.join(UPLOAD_DIR, diskName), buffer)
        const savedUrl = `/uploads/materials/${diskName}`

        // Save thumbnail if provided (base64 data URL)
        let thumbnailUrl: string | undefined
        if (thumbnail?.startsWith('data:')) {
          const thumbId = `${id}-thumb`
          const thumbData = thumbnail.split(',')[1]
          if (thumbData) {
            const thumbBuf = Buffer.from(thumbData, 'base64')
            const thumbName = `${thumbId}.jpg`
            await writeFile(path.join(UPLOAD_DIR, thumbName), thumbBuf)
            thumbnailUrl = `/uploads/materials/${thumbName}`
          }
        }
        if (!thumbnailUrl && type === 'image') thumbnailUrl = savedUrl

        const cat = category || (type === 'image' ? 'ai-image' : type === 'video' ? 'ai-video' : 'other')
        // Ensure category exists
        if (!store.categories.some((c: { id: string }) => c.id === cat)) {
          const label = cat === 'ai-image' ? 'AI图片' : cat === 'ai-video' ? 'AI视频' : cat
          store.categories.push({ id: cat, label })
        }

        const material: StoredMaterial = {
          id, title: title || `AI ${type} ${new Date().toLocaleTimeString()}`,
          type, category: cat, url: savedUrl, thumbnail: thumbnailUrl,
          filename: diskName, size: buffer.length,
          mimeType: contentType || (type === 'image' ? 'image/png' : 'video/mp4'),
          createdAt: new Date().toISOString(),
        }
        store.materials.unshift(material)
        await saveStore(store)
        return NextResponse.json(material)
      }

      if (body.action === 'delete-category') {
        const { id } = body
        store.categories = store.categories.filter((c: { id: string }) => c.id !== id)
        store.materials.forEach((m: StoredMaterial) => {
          if (m.category === id) m.category = 'other'
        })
        await saveStore(store)
        return NextResponse.json({ categories: store.categories })
      }

      return NextResponse.json({ error: '未知操作' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const title = (formData.get('title') as string) || ''
    const category = (formData.get('category') as string) || 'other'
    const thumbnailData = (formData.get('thumbnail') as string) || ''

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '文件过大（最大 100 MB）' }, { status: 413 })
    }

    const type = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
          ? 'audio'
          : null
    if (!type) {
      return NextResponse.json({ error: '不支持的文件类型' }, { status: 400 })
    }

    await mkdir(UPLOAD_DIR, { recursive: true })

    const id = randomUUID()
    const ext = path.extname(file.name) || `.${file.type.split('/')[1]}`
    const diskName = `${id}${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(UPLOAD_DIR, diskName), buffer)

    const url = `/uploads/materials/${diskName}`

    // Save thumbnail if provided as base64 data URL
    let thumbnailUrl: string | undefined
    if (thumbnailData.startsWith('data:')) {
      const thumbB64 = thumbnailData.split(',')[1]
      if (thumbB64) {
        const thumbBuf = Buffer.from(thumbB64, 'base64')
        const thumbName = `${id}-thumb.jpg`
        await writeFile(path.join(UPLOAD_DIR, thumbName), thumbBuf)
        thumbnailUrl = `/uploads/materials/${thumbName}`
      }
    }
    if (!thumbnailUrl && type === 'image') thumbnailUrl = url

    // Ensure category exists
    const store = await loadStore()
    if (!store.categories.some((c: { id: string }) => c.id === category)) {
      const label = category === 'ai-image' ? 'AI图片' : category === 'ai-video' ? 'AI视频' : category
      store.categories.push({ id: category, label })
    }

    const material: StoredMaterial = {
      id,
      title: title || file.name.replace(/\.[^.]+$/, ''),
      type,
      category,
      url,
      thumbnail: thumbnailUrl,
      filename: file.name,
      size: file.size,
      mimeType: file.type,
      createdAt: new Date().toISOString(),
    }

    store.materials.unshift(material)
    await saveStore(store)

    return NextResponse.json(material)
  } catch (err) {
    console.error('Material upload error:', err)
    return NextResponse.json({ error: '上传失败' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, title, category } = body
    if (!id) return NextResponse.json({ error: '缺少素材 ID' }, { status: 400 })

    const store = await loadStore()
    const material = store.materials.find((m: StoredMaterial) => m.id === id)
    if (!material) return NextResponse.json({ error: '素材不存在' }, { status: 404 })

    if (title !== undefined) material.title = title
    if (category !== undefined) material.category = category
    await saveStore(store)

    return NextResponse.json(material)
  } catch (err) {
    console.error('Material update error:', err)
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: '缺少素材 ID' }, { status: 400 })

    const store = await loadStore()
    const idx = store.materials.findIndex((m: StoredMaterial) => m.id === id)
    if (idx === -1) return NextResponse.json({ error: '素材不存在' }, { status: 404 })

    const [removed] = store.materials.splice(idx, 1)
    try {
      await unlink(path.join(process.cwd(), 'public', removed.url))
    } catch { /* file may already be deleted */ }

    await saveStore(store)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Material delete error:', err)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
