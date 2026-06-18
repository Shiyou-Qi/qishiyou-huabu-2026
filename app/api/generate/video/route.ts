/**
 * POST /api/generate/video
 *
 * 视频生成接口（异步任务）。
 *
 * Body: { model, prompt, negativePrompt?, duration?, resolution?, firstFrameImage?, lastFrameImage?, referenceVideo? }
 * Response: { taskId, status, estimatedSeconds? }
 *
 * GET /api/generate/video?taskId=xxx
 * 查询视频生成任务状态。Response: { taskId, status, videoUrl? }
 */

import { NextResponse } from 'next/server'
import { generateVideo, queryVideoTask } from '@/lib/services/ai/index'
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

    const result = await generateVideo({
      model: body.model,
      prompt: body.prompt,
      negativePrompt: body.negativePrompt,
      duration: body.duration,
      resolution: body.resolution,
      firstFrameImage: body.firstFrameImage,
      lastFrameImage: body.lastFrameImage,
      referenceVideo: body.referenceVideo,
      references: body.references,
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json(
        { error: err.message, provider: err.provider },
        { status: err.statusCode },
      )
    }
    console.error('Video generation error:', err)
    return NextResponse.json(
      { error: '视频生成失败' },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json({ error: '缺少 taskId' }, { status: 400 })
  }

  try {
    const provider = searchParams.get('provider') || undefined
    const result = await queryVideoTask(taskId, provider)

    if (result.status === 'completed' && result.videoUrl && !result.videoUrl.startsWith('/uploads/') && !result.videoUrl.startsWith('data:')) {
      try {
        result.videoUrl = await downloadToLocal(result.videoUrl, 'video')
      } catch (e) {
        console.error('[视频落库] 下载失败，返回原始URL:', e)
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
    console.error('Video task query error:', err)
    return NextResponse.json(
      { error: '任务查询失败' },
      { status: 500 },
    )
  }
}
