/**
 * POST /api/generate/text
 *
 * 文本生成接口。支持串联上游节点输出作为上下文。
 *
 * Body: { model, prompt, systemPrompt?, temperature?, maxTokens?, contextTexts?, stream? }
 *
 * 非流式: { text, model, usage? }
 * 流式 (stream: true): SSE 格式
 *   event: reasoning → 思考过程块
 *   event: text      → 正文块
 *   event: done      → 完成 (含完整文本)
 *   event: error     → 错误
 */

import { NextResponse } from 'next/server'
import { generateText, generateTextStream } from '@/lib/services/ai/index'
import { AIError } from '@/lib/services/ai/types'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.model || !body.prompt) {
      return NextResponse.json(
        { error: '缺少必填参数 model / prompt' },
        { status: 400 },
      )
    }

    const req = {
      model: body.model,
      prompt: body.prompt,
      systemPrompt: body.systemPrompt,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      contextTexts: body.contextTexts,
    }

    // ── 流式模式 ──
    if (body.stream) {
      const stream = await generateTextStream(req)
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // ── 非流式模式 ──
    const result = await generateText(req)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json(
        { error: err.message, provider: err.provider },
        { status: err.statusCode },
      )
    }
    console.error('Text generation error:', err)
    return NextResponse.json(
      { error: '文本生成失败' },
      { status: 500 },
    )
  }
}
