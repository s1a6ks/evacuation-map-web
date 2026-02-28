import { useRef, useEffect, useCallback, useState } from 'react'
import useStore from '../../store/useStore'
import useDrawing from './hooks/useDrawing'
import useRender from './hooks/useRender'
import useFloodFill from './hooks/useFloodFill'
import useGraphGen from './hooks/useGraphGen'
import useEvacuation from './hooks/useEvacuation'

export default function FloorCanvas() {
  const canvasRef = useRef(null)
  const { mode, scale, offset, setTransform, floors, currentFloorId, addFloor, switchFloor, removeFloor, renameFloor, setSelectedStairInfo } = useStore()
  const isPanning  = useRef(false)
  const panStart   = useRef({ x: 0, y: 0 })

  const [editingFloor, setEditingFloor]     = useState(null)
  const [floorNameInput, setFloorNameInput] = useState('')

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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  useEffect(() => {
    render(drawing, drawStart, mousePos, scale, offset)
  }, [drawing, drawStart, mousePos, render, scale, offset])

  // ── Pan ─────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || e.button === 2) {
      isPanning.current = true
      panStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
      e.preventDefault()
    }
  }, [offset])

  const handlePanMove = useCallback((e) => {
    if (isPanning.current) {
      setTransform(scale, {
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      })
      return
    }
    handleMouseMove(e)
  }, [isPanning, scale, setTransform, handleMouseMove])

  const handleMouseUp = useCallback((e) => {
    if (e.button === 1 || e.button === 2) isPanning.current = false
  }, [])

  function handleUnifiedClick(e) {
    if (isPanning.current) return
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
        className={`block w-full h-full ${mode === 'evacuation' ? 'cursor-pointer' : 'cursor-crosshair'} outline-none`}
        tabIndex={0}
        onMouseMove={handlePanMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
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