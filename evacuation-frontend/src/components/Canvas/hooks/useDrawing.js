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

function projectPointToSegment(x, y, wall, edgeMargin = 0.08) {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const len2 = dx * dx + dy * dy
  if (len2 === 0) {
    return { x: wall.x1, y: wall.y1, t: 0, angle: 0, horiz: true }
  }

  let t = ((x - wall.x1) * dx + (y - wall.y1) * dy) / len2
  t = Math.max(edgeMargin, Math.min(1 - edgeMargin, t))

  return {
    x: wall.x1 + t * dx,
    y: wall.y1 + t * dy,
    t,
    angle: Math.atan2(dy, dx),
    horiz: Math.abs(dx) >= Math.abs(dy),
  }
}

export function projectOnWall(x, y, wall) {
  return projectPointToSegment(x, y, wall)
}

export function findNearestWall(x, y, walls, maxDist = 28) {
  let best = null, bestD = maxDist
  walls.forEach(w => {
    const d = distToSegment(x, y, w)
    if (d < bestD) { bestD = d; best = w }
  })
  return best
}

function findRoomAtPixel(detectedRooms, px, py) {
  const col = Math.floor(px / GRID)
  const row = Math.floor(py / GRID)
  return detectedRooms.find(room =>
    room.cells.some(([r, c]) => r === row && c === col)
  ) ?? null
}

function isPointInStair(stair, px, py, padding = 8) {
  const angle = -(stair.angle ?? 0)
  const dx = px - stair.x
  const dy = py - stair.y
  const localX = dx * Math.cos(angle) - dy * Math.sin(angle)
  const localY = dx * Math.sin(angle) + dy * Math.cos(angle)
  const halfW = (stair.width ?? GRID * 0.9) / 2 + padding
  const halfH = (stair.height ?? GRID * 1.6) / 2 + padding
  return Math.abs(localX) <= halfW && Math.abs(localY) <= halfH
}

export default function useDrawing(scale = 1, offset = { x: 0, y: 0 }) {
  const {
    tool, walls, doors, exits, stairs, detectedRooms,
    addWall, addDoor, addExit, addStair,
    removeWall, removeDoor, removeExit, removeStair,
    pushHistory,
    setMousePos,
    setSelectedStairInfo, setSelectedRoomId, currentFloorId,
  } = useStore()

  const [drawing, setDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState(null)
  const [mousePos, setLocalMousePos] = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const rawX = (e.clientX - rect.left - offset.x) / scale
    const rawY = (e.clientY - rect.top - offset.y) / scale
    const snapped = snapPoint(rawX, rawY)
    setLocalMousePos(snapped)
    setMousePos(snapped)
  }, [setMousePos, scale, offset])

  const handleClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const rawX = (e.clientX - rect.left - offset.x) / scale
    const rawY = (e.clientY - rect.top - offset.y) / scale
    const x = snap(rawX)
    const y = snap(rawY)

    if (tool === 'select') {
      const clickedStair = stairs.reduce((best, s, i) => {
        if (!isPointInStair(s, rawX, rawY)) return best
        const d = Math.hypot(s.x - rawX, s.y - rawY)
        if (!best || d < best.d) return { idx: i, d, x: s.x, y: s.y }
        return best
      }, null)

      if (clickedStair) {
        setSelectedRoomId(null)
        setSelectedStairInfo({ floorId: currentFloorId, x: clickedStair.x, y: clickedStair.y, idx: clickedStair.idx })
        return
      }

      const clickedRoom = findRoomAtPixel(detectedRooms, rawX, rawY)
      setSelectedRoomId(clickedRoom?.id ?? null)
      setSelectedStairInfo(null)
      return
    }

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
      const wall = findNearestWall(rawX, rawY, walls)
      if (wall) {
        pushHistory()
        const pt = projectOnWall(rawX, rawY, wall)
        addDoor({ x: pt.x, y: pt.y, horiz: pt.horiz, angle: pt.angle })
      }
    }

    if (tool === 'exit') {
      const wall = findNearestWall(rawX, rawY, walls)
      const label = `Вихід ${exits.length + 1}`
      pushHistory()
      if (wall) {
        const pt = projectOnWall(rawX, rawY, wall)
        addExit({ x: pt.x, y: pt.y, horiz: pt.horiz, angle: pt.angle, label })
      } else {
        addExit({ x, y, horiz: true, label })
      }
    }

    if (tool === 'stair') {
      pushHistory()
      addStair({ x, y, width: GRID * 0.9, height: GRID * 1.6, angle: 0, direction: 'up' })
    }


    // ── Клік на сходи (будь-який інструмент крім erase) — виділяємо ──
    if (tool !== 'erase' && tool !== 'wall') {
      const clickedStair = stairs.reduce((best, s, i) => {
        if (!isPointInStair(s, x, y)) return best
        const d = Math.hypot(s.x - x, s.y - y)
        if (!best || d < best.d) return { idx: i, d, x: s.x, y: s.y }
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
        if (!isPointInStair(s, x, y)) return
        const dist = Math.hypot(s.x - x, s.y - y)
        candidates.push({ type: 'stair', index: i, dist })
      })


      if (candidates.length === 0) return

      // Видаляємо найближчий
      candidates.sort((a, b) => a.dist - b.dist)
      const target = candidates[0]
      pushHistory()

      switch (target.type) {
        case 'wall': removeWall(target.index); break
        case 'door': removeDoor(target.index); break
        case 'exit': removeExit(target.index); break
        case 'stair': removeStair(target.index); break
      }
    }
  }, [tool, drawing, drawStart, walls, doors, exits, stairs,
    detectedRooms,
    addWall, addDoor, addExit, addStair,
    removeWall, removeDoor, removeExit, removeStair,
    pushHistory, setSelectedStairInfo, setSelectedRoomId, currentFloorId, scale, offset])

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
