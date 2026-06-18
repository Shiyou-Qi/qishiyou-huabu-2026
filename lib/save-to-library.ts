/** Save a generated AI asset to the material library. */
export async function saveToLibrary(opts: {
  url: string
  title: string
  type: 'image' | 'video'
  category?: string
  thumbnail?: string
}) {
  try {
    const isLocal = opts.url.startsWith('/uploads/')
    const action = isLocal ? 'register-local' : 'save-from-url'

    const res = await fetch('/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        url: opts.url,
        title: opts.title,
        type: opts.type,
        category: opts.category || (opts.type === 'image' ? 'ai-image' : 'ai-video'),
        thumbnail: opts.thumbnail,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[素材入库] 失败:', err)
    }
  } catch (err) {
    console.error('[素材入库] 失败:', err)
  }
}

/** Extract a video frame as a base64 JPEG data URL */
export function extractVideoThumbnail(videoUrl: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'

    const cleanup = () => { video.src = ''; video.load() }
    const timeout = setTimeout(() => { cleanup(); resolve(undefined) }, 10_000)

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1)
    }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          clearTimeout(timeout)
          cleanup()
          resolve(dataUrl)
          return
        }
      } catch { /* CORS or other error */ }
      clearTimeout(timeout)
      cleanup()
      resolve(undefined)
    }
    video.onerror = () => { clearTimeout(timeout); cleanup(); resolve(undefined) }

    video.src = videoUrl
    video.load()
  })
}
