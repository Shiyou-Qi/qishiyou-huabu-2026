'use client'

import { memo, useRef } from 'react'
import { NodeProps, Node } from '@xyflow/react'
import { AudioLines, Upload, Music2, X } from 'lucide-react'
import { CustomNodeData, useFlowStore } from '@/lib/store'
import { NodeBase } from './node-base'

type AudioNodeProps = NodeProps<Node<CustomNodeData>>

function AudioNode({ id, data, selected }: AudioNodeProps) {
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    updateNodeData(id, {
      audioUrl: url,
      status: 'ready',
      meta: `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`,
    })
    e.target.value = ''
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateNodeData(id, { audioUrl: undefined, status: 'idle', meta: undefined })
  }

  return (
    <NodeBase

      nodeType="audio"
      label={data.label}
      status={data.status}
      selected={selected}
      onDelete={() => deleteNode(id)}
      icon={<AudioLines className="size-3.5" />}
      hasInput={data.mode !== 'input'}
      hasOutput={true}
      width="w-[280px]"

    >
      {data.audioUrl ? (
        <div className="group relative rounded-xl border border-border/40 bg-muted/20 p-3">
          {/* Waveform decoration */}
          <div className="mb-2.5 flex items-center gap-1 px-1">
            {Array.from({ length: 28 }).map((_, i) => (
              <div
                key={i}
                className="w-0.5 rounded-full bg-emerald-500/60"
                style={{ height: `${8 + Math.sin(i * 0.8) * 6 + Math.random() * 4}px` }}
              />
            ))}
          </div>
          <audio src={data.audioUrl as string} controls className="w-full h-8" />
          {data.meta && (
            <p className="mt-2 truncate text-[13px] text-muted-foreground">{data.meta as string}</p>
          )}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleClear}
            className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:text-destructive"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/20 py-6 transition-colors hover:border-border hover:bg-muted/40"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted/60">
            <Music2 className="size-5 text-muted-foreground/60" />
          </div>
          <div className="flex items-center gap-1.5 text-[14px] text-muted-foreground">
            <Upload className="size-3" />
            点击上传音频文件
          </div>
          <p className="text-[13px] text-muted-foreground/50">MP3 · WAV · AAC · OGG</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </NodeBase>
  )
}

export default memo(AudioNode)
