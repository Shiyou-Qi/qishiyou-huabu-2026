'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Play, Pause, Maximize2, Volume2, VolumeX, Download, RotateCcw } from 'lucide-react'

interface VideoPlayerProps {
  src: string
  className?: string
  onLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement>) => void
  downloadName?: string
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function VideoPlayer({ src, className, onLoadedMetadata, downloadName }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [ended, setEnded] = useState(false)
  const [dragging, setDragging] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setShowControls(true)
    hideTimer.current = setTimeout(() => {
      if (!dragging) setShowControls(false)
    }, 2500)
  }, [dragging])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (ended) {
      v.currentTime = 0
      setEnded(false)
    }
    if (v.paused) { v.play(); setPlaying(true) }
    else { v.pause(); setPlaying(false) }
    scheduleHide()
  }, [ended, scheduleHide])

  const handleMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration)
    onLoadedMetadata?.(e)
  }

  const seek = useCallback((clientX: number) => {
    const bar = progressRef.current
    const v = videoRef.current
    if (!bar || !v) return
    const rect = bar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    v.currentTime = pct * v.duration
    setCurrentTime(v.currentTime)
  }, [])

  const handleProgressDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setDragging(true)
    seek(e.clientX)
    const onMove = (ev: PointerEvent) => seek(ev.clientX)
    const onUp = () => {
      setDragging(false)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [seek])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => setCurrentTime(v.currentTime)
    const onEnd = () => { setPlaying(false); setEnded(true); setShowControls(true) }
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('ended', onEnd)
    return () => { v.removeEventListener('timeupdate', onTime); v.removeEventListener('ended', onEnd) }
  }, [])

  const goFullscreen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    videoRef.current?.requestFullscreen?.()
  }, [])

  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = src
    a.download = downloadName || 'video.mp4'
    a.click()
  }, [src, downloadName])

  return (
    <div
      className={`group/vp relative overflow-hidden bg-black ${className || ''}`}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={scheduleHide}
    >
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        playsInline
        preload="metadata"
        onLoadedMetadata={handleMetadata}
        onClick={togglePlay}
        className="size-full cursor-pointer object-cover"
      />

      {/* Center play/replay overlay */}
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
          !playing && showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
          {ended
            ? <RotateCcw className="size-5 text-white" />
            : <Play className="ml-0.5 size-5 text-white" />
          }
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pb-1.5 pt-6 transition-opacity duration-200 ${
          showControls || !playing ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="nodrag nopan group/bar relative mb-1.5 h-1 cursor-pointer rounded-full bg-white/20"
          onPointerDown={handleProgressDown}
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-75" style={{ width: `${progress}%` }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-white shadow-md opacity-0 transition-opacity group-hover/bar:opacity-100"
            style={{ left: `calc(${progress}% - 5px)` }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-1">
          <button onClick={togglePlay} className="flex size-6 items-center justify-center rounded-md text-white/80 transition-colors hover:text-white">
            {ended ? <RotateCcw className="size-3.5" /> : playing ? <Pause className="size-3.5" /> : <Play className="ml-0.5 size-3.5" />}
          </button>

          <span className="min-w-0 text-[10px] tabular-nums text-white/60">
            {formatTime(currentTime)}<span className="text-white/30"> / </span>{formatTime(duration)}
          </span>

          <div className="flex-1" />

          <button onClick={(e) => { e.stopPropagation(); setMuted(!muted) }} className="flex size-6 items-center justify-center rounded-md text-white/60 transition-colors hover:text-white" title={muted ? '取消静音' : '静音'}>
            {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </button>

          {downloadName && (
            <button onClick={handleDownload} className="flex size-6 items-center justify-center rounded-md text-white/60 transition-colors hover:text-white" title="下载视频">
              <Download className="size-3.5" />
            </button>
          )}

          <button onClick={goFullscreen} className="flex size-6 items-center justify-center rounded-md text-white/60 transition-colors hover:text-white" title="全屏">
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
