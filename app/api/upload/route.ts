/**
 * POST /api/upload
 *
 * 文件上传接口。
 * 接受 multipart/form-data，file 字段。
 * 文件保存到 public/uploads/ 目录，通过 /uploads/... 提供静态访问。
 *
 * Response: { url: string, name: string, size: number, type: string }
 */

import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const MAX_SIZE = 100 * 1024 * 1024 // 100 MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: '请上传文件（field: file）' },
        { status: 400 },
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `文件大小超过限制（最大 ${MAX_SIZE / 1024 / 1024} MB）` },
        { status: 413 },
      )
    }

    // 确保上传目录存在
    await mkdir(UPLOAD_DIR, { recursive: true })

    // 生成唯一文件名
    const ext = path.extname(file.name)
    const uuid = randomUUID()
    const filename = `${uuid}${ext}`
    const filePath = path.join(UPLOAD_DIR, filename)

    // 写入文件
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const url = `/uploads/${filename}`

    return NextResponse.json({
      url,
      name: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json(
      { error: '文件上传失败' },
      { status: 500 },
    )
  }
}
