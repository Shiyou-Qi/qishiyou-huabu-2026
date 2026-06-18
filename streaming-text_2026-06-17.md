# 文本生成流式输出 — 2026-06-17

## 目标
AI 文本采用流式，显示思考的过程，最终给到用户的是结果。

## 后端改动

### client.ts — 新增 `textGenStream()`
- 向上游 API 发送 `stream: true`
- 解析上游 SSE chunk (`delta.content` / `delta.reasoning_content`)
- 转换为我们自己的 SSE 格式：`reasoning` / `text` / `done` / `error` 事件
- 返回 `ReadableStream<Uint8Array>`

### index.ts — 新增 `generateTextStream()`
- 根据 model ID 路由到对应 provider，调用 textGenStream

### app/api/generate/text/route.ts
- 支持 `stream: true` 请求参数
- 流式模式返回 `text/event-stream` SSE 响应
- 非流式模式保持原有行为不变

## 前端改动

### text-node.tsx
- `handleGenerate` 改为 SSE 流式消费（ReadableStream reader）
- **思考过程面板**：浅紫折叠区，推理内容实时追加，可展开/折叠
- **流式文本**：正文逐字输出，末尾闪烁光标
- **中止按钮**：生成中显示红色方形停止键，中断 AbortController
- 完成后自动收起思考面板，显示最终结果

## 构建
Next.js 16.2.0 (Turbopack) 构建通过 ✅
