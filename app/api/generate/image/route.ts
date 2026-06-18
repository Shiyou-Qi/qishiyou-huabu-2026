/**
 * POST /api/generate/image
 *
 * 图片生成接口。支持文生图、图生图（通过 referenceImage）。
 *
 * Body: { model, prompt, negativePrompt?, width?, height?, count?, referenceImage?, styleReference? }
 * Response: { imageUrl }
 */

import { NextResponse } from 'next/server'
import { generateImage } from '@/lib/services/ai/index'
import { AIError } from '@/lib/services/ai/types'
import { downloadToLocal } from '@/lib/download-to-local'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.model || !body.prompt) {
      return NextResponse.json(
        { error: '缺少必填参数 model / prompt' },
        { status: 400 },
      )
    }

    const result = await generateImage({
      model: body.model,
      prompt: body.prompt,
      negativePrompt: body.negativePrompt,
      width: body.width,
      height: body.height,
      count: body.count,
      referenceImage: body.referenceImage,
      styleReference: body.styleReference,
    })

    if (result.imageUrl && !result.imageUrl.startsWith('/uploads/') && !result.imageUrl.startsWith('data:')) {
      try {
        result.imageUrl = await downloadToLocal(result.imageUrl, 'image')
      } catch (e) {
        console.error('[图片落库] 下载失败，返回原始URL:', e)
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json(
        { error: err.message, provider: err.provider },
        { status: err.statusCode },
      )
    }
    console.error('Image generation error:', err)
    return NextResponse.json(
      { error: '图片生成失败' },
      { status: 500 },
    )
  }
}
