import { useState, useCallback } from 'react'
import useStore from '../../../store/useStore'

const GRID = 20

export function snap(v) {
  return Math.round(v / GRID) * GRID
}

export function snapPoint(x, y) {
  return { x: snap(x), y: snap(y) }
}

export function distToSegment(px, py, wall) {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - wall.x1, py - wall.y1)
  let t = ((px - wall.x1) * dx + (py - wall.y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (wall.x1 + t * dx), py - (wall.y1 + t * dy))
}

export function projectOnWall(x, y, wall) {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const len2 = dx * dx + dy * dy
  let t = ((x - wall.x1) * dx + (y - wall.y1) * dy) / len2
  t = Math.max(0.1, Math.min(0.9, t))
  return {
    x: snap(wall.x1 + t * dx),
    y: snap(wall.y1 + t * dy),
    horiz: Math.abs(dx) > Math.abs(dy),
  }
}

export function findNearestWall(x, y, walls, maxDist = 16) {
  let best = null, bestD = maxDist
  walls.forEach(w => {
    const d = distToSegment(x, y, w)
    if (d < bestD) { bestD = d; best = w }
  })
  return best
}

export default function useDrawing(scale = 1, offset = { x: 0, y: 0 }) {
  const {
    tool, walls, doors, exits, stairs, extinguishers,
    addWall, addDoor, addExit, addStair, addExtinguisher,
    removeWall, removeDoor, removeExit, removeStair, removeExtinguisher,
    pushHistory,
    setMousePos,
    setSelectedStairInfo, currentFloorId,
  } = useStore()

  const [drawing, setDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState(null)
  const [mousePos, setLocalMousePos] = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const rawX = (e.clientX - rect.left - offset.x) / scale
    const rawY = (e.clientY - rect.top  - offset.y) / scale
    const snapped = snapPoint(rawX, rawY)
    setLocalMousePos(snapped)
    setMousePos(snapped)
  }, [setMousePos, scale, offset])

  const handleClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = snap((e.clientX - rect.left - offset.x) / scale)
    const y = snap((e.clientY - rect.top  - offset.y) / scale)

    if (tool === 'wall') {
      if (!drawing) {
        pushHistory()
        setDrawing(true)
        setDrawStart({ x, y })
      } else {
        if (drawStart.x !== x || drawStart.y !== y) {
          addWall({ x1: drawStart.x, y1: drawStart.y, x2: x, y2: y })
        }
        setDrawing(false)
        setDrawStart(null)
      }
    }

    if (tool === 'door') {
      const wall = findNearestWall(x, y, walls)
      if (wall) {
        pushHistory()
        const pt = projectOnWall(x, y, wall)
        addDoor({ x: pt.x, y: pt.y, horiz: pt.horiz })
      }
    }

    if (tool === 'exit') {
      const wall = findNearestWall(x, y, walls)
      const label = `Вихід ${exits.length + 1}`
      pushHistory()
      if (wall) {
        const pt = projectOnWall(x, y, wall)
        addExit({ x: pt.x, y: pt.y, horiz: pt.horiz, label })
      } else {
        addExit({ x, y, horiz: true, label })
      }
    }

    if (tool === 'stair') {
      pushHistory()
      addStair({ x, y })
    }

    if (tool === 'extinguisher') {
      pushHistory()
      addExtinguisher({ x, y })
    }

    // ── Клік на сходи (будь-який інструмент крім erase) — виділяємо ──
    if (tool !== 'erase' && tool !== 'wall') {
      const CLICK_R = 20
      const clickedStair = stairs.reduce((best, s, i) => {
        const d = Math.hypot(s.x - x, s.y - y)
        if (d < CLICK_R && (!best || d < best.d)) return { idx: i, d, x: s.x, y: s.y }
        return best
      }, null)
      if (clickedStair && tool !== 'door' && tool !== 'exit' && tool !== 'stair') {
        setSelectedStairInfo({ floorId: currentFloorId, x: clickedStair.x, y: clickedStair.y, idx: clickedStair.idx })
        return
      }
    }

    if (tool === 'erase') {
      // ── Шукаємо найближчий елемент будь-якого типу ────────
      const ERASE_RADIUS = 20

      const candidates = []

      // Стіни (лінії)
      walls.forEach((w, i) => {
        const d = distToSegment(x, y, w)
        if (d < ERASE_RADIUS) candidates.push({ type: 'wall', index: i, dist: d })
      })

      // Двері (точки)
      doors.forEach((d, i) => {
        const dist = Math.hypot(d.x - x, d.y - y)
        if (dist < ERASE_RADIUS) candidates.push({ type: 'door', index: i, dist })
      })

      // Виходи (точки)
      exits.forEach((ex, i) => {
        const dist = Math.hypot(ex.x - x, ex.y - y)
        if (dist < ERASE_RADIUS) candidates.push({ type: 'exit', index: i, dist })
      })

      // Сходи (точки)
      stairs.forEach((s, i) => {
        const dist = Math.hypot(s.x - x, s.y - y)
        if (dist < ERASE_RADIUS) candidates.push({ type: 'stair', index: i, dist })
      })

      // Вогнегасники
      extinguishers.forEach((ex, i) => {
        const dist = Math.hypot(ex.x - x, ex.y - y)
        if (dist < ERASE_RADIUS) candidates.push({ type: 'extinguisher', index: i, dist })
      })

      if (candidates.length === 0) return

      // Видаляємо найближчий
      candidates.sort((a, b) => a.dist - b.dist)
      const target = candidates[0]
      pushHistory()

      switch (target.type) {
        case 'wall':  removeWall(target.index);  break
        case 'door':  removeDoor(target.index);  break
        case 'exit':  removeExit(target.index);  break
        case 'stair': removeStair(target.index); break
        case 'extinguisher': removeExtinguisher(target.index); break
      }
    }
  }, [tool, drawing, drawStart, walls, doors, exits, stairs,
      addWall, addDoor, addExit, addStair,
      removeWall, removeDoor, removeExit, removeStair, removeExtinguisher,
      addExtinguisher, extinguishers,
      pushHistory, setSelectedStairInfo, currentFloorId, scale, offset])

  const handleDoubleClick = useCallback(() => {
    if (tool === 'wall' && drawing) {
      setDrawing(false)
      setDrawStart(null)
    }
  }, [tool, drawing])

  return {
    drawing,
    drawStart,
    mousePos,
    handleMouseMove,
    handleClick,
    handleDoubleClick,
    GRID,
  }
}