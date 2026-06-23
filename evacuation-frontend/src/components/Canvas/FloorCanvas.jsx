import { useRef, useEffect, useCallback, useState } from 'react'
import useStore from '../../store/useStore'
import useDrawing, { snap } from './hooks/useDrawing'
import useRender from './hooks/useRender'
import useFloodFill from './hooks/useFloodFill'
import useGraphGen from './hooks/useGraphGen'
import useEvacuation from './hooks/useEvacuation'

export default function FloorCanvas() {
  const canvasRef = useRef(null)
  const {
    mode, tool, scale, offset, setTransform,
    floors, currentFloorId, addFloor, switchFloor, removeFloor, renameFloor,
    stairs, selectedStairInfo, setSelectedStairInfo, updateStair, pushHistory,
  } = useStore()
  const isPanning  = useRef(false)
  const hasPanned  = useRef(false)
  const isResizingStair = useRef(false)
  const isDraggingStair = useRef(false)
  const panStart   = useRef({ x: 0, y: 0 })
  const mouseStart = useRef({ x: 0, y: 0 })
  const resizingStairIdx = useRef(null)
  const draggingStairIdx = useRef(null)
  const stairDragOffset = useRef({ x: 0, y: 0 })
  const resizingStairPreview = useRef(null)
  const resizeFrame = useRef(null)
  const renderFrame = useRef(null)

  const [editingFloor, setEditingFloor]     = useState(null)
  const [floorNameInput, setFloorNameInput] = useState('')
  const [stairPreview, setStairPreview] = useState(null)

  const { drawing, drawStart, mousePos, handleMouseMove, handleClick, handleDoubleClick } = useDrawing(scale, offset)
  const { render } = useRender(canvasRef)
  const { handleEvacuationClick } = useEvacuation(scale, offset)

  useFloodFill(canvasRef)
  useGraphGen()

  // ── Wheel zoom ───────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const newScale = Math.min(Math.max(scale * factor, 0.2), 8)
    const newOffset = {
      x: mx - (mx - offset.x) * (newScale / scale),
      y: my - (my - offset.y) * (newScale / scale),
    }
    setTransform(newScale, newOffset)
  }, [scale, offset, setTransform])

  // ── Resize ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    function resize() {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  useEffect(() => {
    if (renderFrame.current) cancelAnimationFrame(renderFrame.current)
    renderFrame.current = requestAnimationFrame(() => {
      renderFrame.current = null
      render(drawing, drawStart, mousePos, scale, offset, stairPreview)
    })
    return () => {
      if (renderFrame.current) cancelAnimationFrame(renderFrame.current)
    }
  }, [drawing, drawStart, mousePos, render, scale, offset, stairPreview])

  // ── Pan ─────────────────────────────────────────────────
  function toCanvasPoint(e) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left - offset.x) / scale,
      y: (e.clientY - rect.top - offset.y) / scale,
    }
  }

  function stairControlPoints(stair) {
    const w = stair.width ?? 18
    const h = stair.height ?? 32
    const angle = stair.angle ?? 0

    function fromLocal(localX, localY) {
      return {
        x: stair.x + localX * Math.cos(angle) - localY * Math.sin(angle),
        y: stair.y + localX * Math.sin(angle) + localY * Math.cos(angle),
      }
    }

    return {
      resize: fromLocal(w / 2 + 10 / scale, h / 2 + 10 / scale),
      rotate: fromLocal(w / 2 + 10 / scale, -h / 2 - 10 / scale),
    }
  }

  function isPointInStair(stair, point, padding = 8 / scale) {
    const angle = -(stair.angle ?? 0)
    const dx = point.x - stair.x
    const dy = point.y - stair.y
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle)
    const localY = dx * Math.sin(angle) + dy * Math.cos(angle)
    const halfW = (stair.width ?? 18) / 2 + padding
    const halfH = (stair.height ?? 32) / 2 + padding
    return Math.abs(localX) <= halfW && Math.abs(localY) <= halfH
  }

  function findStairAtPoint(point) {
    if (mode !== 'constructor' || tool !== 'select') return null
    return stairs.reduce((best, stair, idx) => {
      if (!isPointInStair(stair, point)) return best
      const dist = Math.hypot(stair.x - point.x, stair.y - point.y)
      return !best || dist < best.dist ? { idx, stair, dist } : best
    }, null)
  }

  function findStairControl(point) {
    if (mode !== 'constructor' || !selectedStairInfo || selectedStairInfo.floorId !== currentFloorId) return null
    const stair = stairs[selectedStairInfo.idx]
    if (!stair) return null
    const controls = stairControlPoints(stair)
    const radius = 12 / scale
    if (Math.hypot(point.x - controls.resize.x, point.y - controls.resize.y) <= radius) {
      return { action: 'resize', idx: selectedStairInfo.idx }
    }
    if (Math.hypot(point.x - controls.rotate.x, point.y - controls.rotate.y) <= radius) {
      return { action: 'rotate', idx: selectedStairInfo.idx }
    }
    return null
  }

  function queueStairPreview(preview) {
    resizingStairPreview.current = preview
    if (resizeFrame.current) return
    resizeFrame.current = requestAnimationFrame(() => {
      resizeFrame.current = null
      setStairPreview(resizingStairPreview.current)
    })
  }

  function handleMouseDown(e) {
    const point = toCanvasPoint(e)
    const control = findStairControl(point)
    if (control?.action === 'resize') {
      pushHistory()
      isResizingStair.current = true
      resizingStairIdx.current = control.idx
      hasPanned.current = true
      return
    }
    if (control?.action === 'rotate') {
      const stair = stairs[control.idx]
      if (stair) {
        pushHistory()
        const nextAngle = ((stair.angle ?? 0) + Math.PI / 2) % (Math.PI * 2)
        updateStair(control.idx, { angle: nextAngle })
      }
      hasPanned.current = true
      return
    }

    const clickedStair = findStairAtPoint(point)
    if (clickedStair) {
      pushHistory()
      setSelectedStairInfo({
        floorId: currentFloorId,
        x: clickedStair.stair.x,
        y: clickedStair.stair.y,
        idx: clickedStair.idx,
      })
      isDraggingStair.current = true
      draggingStairIdx.current = clickedStair.idx
      stairDragOffset.current = {
        x: point.x - clickedStair.stair.x,
        y: point.y - clickedStair.stair.y,
      }
      hasPanned.current = true
      return
    }

    isPanning.current = true
    hasPanned.current = false
    mouseStart.current = { x: e.clientX, y: e.clientY }
    panStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
  }

  function handlePanMove(e) {
    if (isResizingStair.current && resizingStairIdx.current !== null) {
      const stair = stairs[resizingStairIdx.current]
      if (!stair) return
      const point = toCanvasPoint(e)
      const angle = -(stair.angle ?? 0)
      const dx = point.x - stair.x
      const dy = point.y - stair.y
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle)
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle)
      queueStairPreview({
        type: 'stair',
        idx: resizingStairIdx.current,
        width: Math.max(12, Math.round(Math.abs(localX) * 2)),
        height: Math.max(16, Math.round(Math.abs(localY) * 2)),
      })
      return
    }

    if (isDraggingStair.current && draggingStairIdx.current !== null) {
      const stair = stairs[draggingStairIdx.current]
      if (!stair) return
      const point = toCanvasPoint(e)
      const x = snap(point.x - stairDragOffset.current.x)
      const y = snap(point.y - stairDragOffset.current.y)
      queueStairPreview({
        type: 'stair',
        idx: draggingStairIdx.current,
        x,
        y,
      })
      return
    }

    if (isPanning.current) {
      if (Math.abs(e.clientX - mouseStart.current.x) > 3 || Math.abs(e.clientY - mouseStart.current.y) > 3) {
        hasPanned.current = true
      }
      setTransform(scale, {
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      })
      return
    }
    handleMouseMove(e)
  }

  function handleMouseUp() {
    if (isResizingStair.current && resizingStairIdx.current !== null && resizingStairPreview.current) {
      updateStair(resizingStairIdx.current, {
        width: resizingStairPreview.current.width,
        height: resizingStairPreview.current.height,
      })
    }
    if (isDraggingStair.current && draggingStairIdx.current !== null && resizingStairPreview.current) {
      updateStair(draggingStairIdx.current, {
        x: resizingStairPreview.current.x,
        y: resizingStairPreview.current.y,
      })
      setSelectedStairInfo({
        floorId: currentFloorId,
        x: resizingStairPreview.current.x,
        y: resizingStairPreview.current.y,
        idx: draggingStairIdx.current,
      })
    }
    isPanning.current = false
    isResizingStair.current = false
    isDraggingStair.current = false
    resizingStairIdx.current = null
    draggingStairIdx.current = null
    resizingStairPreview.current = null
    setStairPreview(null)
  }

  function handleUnifiedClick(e) {
    if (hasPanned.current) {
      hasPanned.current = false
      return
    }
    if (mode === 'evacuation') {
      setSelectedStairInfo(null)
      handleEvacuationClick(e)
    } else {
      handleClick(e)
    }
  }

  // ── Floor panel handlers ─────────────────────────────────
  const handleFloorRename = (floorId) => {
    if (floorNameInput.trim()) renameFloor(floorId, floorNameInput.trim())
    setEditingFloor(null)
  }

  return (
    <div className="relative flex-1 min-w-0 overflow-hidden">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className={`block w-full h-full ${mode === 'evacuation' || tool === 'select' ? 'cursor-pointer' : 'cursor-crosshair'} outline-none`}
        tabIndex={0}
        onMouseMove={handlePanMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleUnifiedClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* ── Floor panel (floating, right side) ── */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 select-none z-10">
        {floors.map(floor => (
          <div key={floor.id}>
            {editingFloor === floor.id ? (
              <input
                autoFocus
                value={floorNameInput}
                onChange={e => setFloorNameInput(e.target.value)}
                onBlur={() => handleFloorRename(floor.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleFloorRename(floor.id)
                  if (e.key === 'Escape') setEditingFloor(null)
                }}
                className="w-[72px] text-[11px] bg-white border border-[#ff4422] rounded-md px-1.5 py-[3px] outline-none shadow"
              />
            ) : (
              <div
                className={`group flex items-center justify-between gap-1 px-2 py-[4px] rounded-md text-[11px] font-medium cursor-pointer transition-all shadow-sm ${
                  floor.id === currentFloorId
                    ? 'bg-white text-[#1a1a1a] border border-[#e0e0e0]'
                    : 'bg-white/60 backdrop-blur-sm text-[#888] border border-white/80 hover:bg-white hover:text-[#555]'
                }`}
                onClick={() => switchFloor(floor.id)}
                onDoubleClick={() => { setEditingFloor(floor.id); setFloorNameInput(floor.name) }}
                title="Двічі клікни щоб перейменувати"
              >
                <span>{floor.name}</span>
                {floors.length > 1 && (
                  <button
                    onClick={e => { e.stopPropagation(); removeFloor(floor.id) }}
                    className="opacity-0 group-hover:opacity-100 text-[#ccc] hover:text-[#ff4422] text-[10px] leading-none transition-all"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add floor */}
        <button
          onClick={() => addFloor()}
          className="px-2 py-[4px] rounded-md text-[11px] text-[#aaa] bg-white/60 backdrop-blur-sm border border-white/80 hover:bg-white hover:text-[#ff4422] transition-all shadow-sm text-center"
          title="Додати поверх"
        >
          + Поверх
        </button>
      </div>
    </div>
  )
}
