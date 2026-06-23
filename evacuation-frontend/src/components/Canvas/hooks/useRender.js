import useStore from '../../../store/useStore'

const GRID = 20
const METER = 0.5

// Палітра кольорів для мульти-режиму (декілька / всі)
const MULTI_COLORS = [
  '#2563eb', '#0f766e', '#b45309', '#7c3aed', '#be123c',
]

// Modern room palette (advanced mode)
const ROOM_FILLS = [
  'rgba(59,130,246,0.07)',
  'rgba(16,185,129,0.07)',
  'rgba(245,158,11,0.07)',
  'rgba(239,68,68,0.07)',
  'rgba(139,92,246,0.07)',
  'rgba(236,72,153,0.07)',
  'rgba(6,182,212,0.07)',
  'rgba(234,179,8,0.07)',
]
const ROOM_FILLS_SEL = [
  'rgba(59,130,246,0.18)',
  'rgba(16,185,129,0.18)',
  'rgba(245,158,11,0.18)',
  'rgba(239,68,68,0.18)',
  'rgba(139,92,246,0.18)',
  'rgba(236,72,153,0.18)',
  'rgba(6,182,212,0.18)',
  'rgba(234,179,8,0.18)',
]
const ROOM_STROKES = [
  'rgba(59,130,246,0.30)',
  'rgba(16,185,129,0.30)',
  'rgba(245,158,11,0.30)',
  'rgba(239,68,68,0.30)',
  'rgba(139,92,246,0.30)',
  'rgba(236,72,153,0.30)',
  'rgba(6,182,212,0.30)',
  'rgba(234,179,8,0.30)',
]

export function pxToMeters(px) {
  return ((px / GRID) * METER).toFixed(1)
}

function getWallAngle(item) {
  if (Number.isFinite(item.angle)) return item.angle
  return item.horiz ? 0 : Math.PI / 2
}

function drawAlongWall(ctx, item, halfWidth, color, lineWidth, invScale, lineCap = 'butt') {
  ctx.save()
  ctx.translate(item.x, item.y)
  ctx.rotate(getWallAngle(item))
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth * invScale
  ctx.lineCap = lineCap
  ctx.beginPath()
  ctx.moveTo(-halfWidth, 0)
  ctx.lineTo(halfWidth, 0)
  ctx.stroke()
  ctx.restore()
}

function drawWallCut(ctx, item, halfWidth, wallThickness, invScale, bgColor) {
  drawAlongWall(ctx, item, halfWidth, bgColor, wallThickness + 4, invScale, 'butt')
}

function normalizeWindowSegment(windowItem) {
  if (windowItem.x1 != null) return windowItem
  const angle = windowItem.angle ?? (windowItem.horiz ? 0 : Math.PI / 2)
  const half = GRID * 0.9
  const dx = Math.cos(angle) * half
  const dy = Math.sin(angle) * half
  return {
    ...windowItem,
    x1: windowItem.x - dx,
    y1: windowItem.y - dy,
    x2: windowItem.x + dx,
    y2: windowItem.y + dy,
  }
}

function drawWindowSegment(ctx, windowItem, wallThickness, invScale, bgColor) {
  const segment = normalizeWindowSegment(windowItem)
  const dx = segment.x2 - segment.x1
  const dy = segment.y2 - segment.y1
  const length = Math.hypot(dx, dy)
  if (length < 2) return

  const cx = (segment.x1 + segment.x2) / 2
  const cy = (segment.y1 + segment.y2) / 2
  const angle = Math.atan2(dy, dx)
  const half = length / 2
  const gap = Math.max(2.8 * invScale, wallThickness * 0.22)

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)

  ctx.strokeStyle = bgColor
  ctx.lineWidth = (wallThickness + 4) * invScale
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(-half, 0)
  ctx.lineTo(half, 0)
  ctx.stroke()

  ctx.strokeStyle = '#475569'
  ctx.lineWidth = 1.1 * invScale
  ctx.lineCap = 'butt'
  ;[-gap, gap].forEach(y => {
    ctx.beginPath()
    ctx.moveTo(-half, y)
    ctx.lineTo(half, y)
    ctx.stroke()
  })

  ctx.strokeStyle = 'rgba(71,85,105,0.72)'
  ctx.lineWidth = 0.9 * invScale
  const dividerCount = Math.max(1, Math.floor(length / (GRID * 1.4)))
  for (let i = 1; i <= dividerCount; i++) {
    const x = -half + (length * i) / (dividerCount + 1)
    ctx.beginPath()
    ctx.moveTo(x, -gap)
    ctx.lineTo(x, gap)
    ctx.stroke()
  }

  ctx.restore()
}

// ═══════════════════════════════════════════════════════════════
//  ЕВАКУАЦІЙНІ МАРШРУТИ
// ═══════════════════════════════════════════════════════════════

function drawFloorChangeBadge(ctx, node, invScale, color) {
  const x = node.x, y = node.y
  const text = `↓ ${node.targetFloorName}`
  const fontSize = 9 * invScale, pad = 4 * invScale, R = 3 * invScale

  ctx.font = `bold ${fontSize}px sans-serif`
  const tw = ctx.measureText(text).width
  const bw = tw + pad * 2, bh = fontSize + pad * 1.5

  ctx.fillStyle = '#f5c542'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * invScale
  ctx.beginPath()
  ctx.moveTo(x - bw / 2 + R, y - bh / 2); ctx.lineTo(x + bw / 2 - R, y - bh / 2)
  ctx.arcTo(x + bw / 2, y - bh / 2, x + bw / 2, y - bh / 2 + R, R)
  ctx.lineTo(x + bw / 2, y + bh / 2 - R)
  ctx.arcTo(x + bw / 2, y + bh / 2, x + bw / 2 - R, y + bh / 2, R)
  ctx.lineTo(x - bw / 2 + R, y + bh / 2)
  ctx.arcTo(x - bw / 2, y + bh / 2, x - bw / 2, y + bh / 2 - R, R)
  ctx.lineTo(x - bw / 2, y - bh / 2 + R)
  ctx.arcTo(x - bw / 2, y - bh / 2, x - bw / 2 + R, y - bh / 2, R)
  ctx.closePath(); ctx.fill(); ctx.stroke()

  ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)

  ctx.strokeStyle = color; ctx.lineWidth = 2 * invScale
  ctx.beginPath(); ctx.arc(x, y - bh, 6 * invScale, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = color; ctx.font = `${8 * invScale}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('⊞', x, y - bh)
}

function segmentChunkKey(a, b) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const axis = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
  const line = axis === 'h' ? Math.round(my / 8) * 8 : Math.round(mx / 8) * 8
  const pos = axis === 'h' ? Math.round(mx / 8) * 8 : Math.round(my / 8) * 8
  return `${axis}:${line}:${pos}`
}

function dedupeSegments(segments, seenSegments) {
  if (!seenSegments) return segments

  const result = []
  segments.forEach(seg => {
    const dx = seg.to.x - seg.from.x
    const dy = seg.to.y - seg.from.y
    const len = Math.hypot(dx, dy)
    if (len < 1) return

    const steps = Math.max(1, Math.ceil(len / 10))
    let openStart = null
    let lastPoint = seg.from

    for (let i = 0; i < steps; i++) {
      const fromT = i / steps
      const toT = (i + 1) / steps
      const from = {
        x: seg.from.x + dx * fromT,
        y: seg.from.y + dy * fromT,
      }
      const to = {
        x: seg.from.x + dx * toT,
        y: seg.from.y + dy * toT,
      }
      const key = segmentChunkKey(from, to)

      if (seenSegments.has(key)) {
        if (openStart) {
          result.push({ from: openStart, to: from })
          openStart = null
        }
      } else {
        seenSegments.add(key)
        if (!openStart) openStart = from
      }
      lastPoint = to
    }

    if (openStart) result.push({ from: openStart, to: lastPoint })
  })

  return result
}

function withAlpha(color, alphaHex = 'cc') {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return `${color}${alphaHex}`
  if (/^#[0-9a-fA-F]{8}$/.test(color)) return `${color.slice(0, 7)}${alphaHex}`
  return color
}

function drawEvacPath(ctx, fullPath, invScale, opts = {}) {
  if (!fullPath || fullPath.length < 2) return
  const {
    color = '#009944',
    lineWidth = 3,
    arrowSize = 7.5,
    arrowStep = 96,
    minArrowSegment = 42,
    dashed = true,
    alpha = 'd9',
    halo = true,
    showStartDot = true,
    showExitMarker = true,
    edges = [],
    seenSegments = null,
  } = opts

  const floorChangeIdx = fullPath.findIndex(n => n.isFloorChange)
  const path = floorChangeIdx >= 0 ? fullPath.slice(0, floorChangeIdx + 1) : fullPath
  const last = path[path.length - 1]

  // Вузли дверей і виходів знаходяться НА стіні.
  // Щоб стрілка не заходила в стіну — зсуваємо кінці сегментів
  // що торкаються таких вузлів вглиб (убік від стіни).
  const TRIM = 13  // px

  function wallOffset(wallNode, toward) {
    const dx = toward.x - wallNode.x
    const dy = toward.y - wallNode.y
    const len = Math.hypot(dx, dy)
    if (len < 2) return { x: wallNode.x, y: wallNode.y }
    const t = Math.min(TRIM / len, 0.45)
    return { x: wallNode.x + dx * t, y: wallNode.y + dy * t }
  }

  function stairRoutePoint(stairNode) {
    if (!stairNode?.isStair) return { x: stairNode.x, y: stairNode.y }
    const vector = stairDirectionVector(stairNode)
    const halfH = (stairNode.height ?? GRID * 1.6) / 2
    return {
      x: stairNode.x + vector.x * halfH,
      y: stairNode.y + vector.y * halfH,
    }
  }

  function stairDirectionVector(stairNode) {
    const angle = stairNode.angle ?? 0
    const direction = stairNode.direction === 'down' ? -1 : 1
    return {
      x: -Math.sin(angle) * direction,
      y: Math.cos(angle) * direction,
    }
  }

  function stairLeadPoint(stairNode) {
    const point = stairRoutePoint(stairNode)
    const vector = stairDirectionVector(stairNode)
    return {
      x: point.x + vector.x * GRID * 0.9,
      y: point.y + vector.y * GRID * 0.9,
    }
  }

  function routePoint(node, toward) {
    if (node.isDoor || node.isExit) return wallOffset(node, toward)
    if (node.isStair) return stairRoutePoint(node)
    return { x: node.x, y: node.y }
  }

  function findEdge(a, b) {
    return edges.find(edge =>
      (edge.from === a.id && edge.to === b.id) ||
      (edge.from === b.id && edge.to === a.id)
    )
  }

  function cleanupRoutePoints(points) {
    if (points.length <= 2) return points

    function pointLineDistance(point, a, b) {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len2 = dx * dx + dy * dy
      if (len2 < 1) return Math.hypot(point.x - a.x, point.y - a.y)
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2))
      const x = a.x + dx * t
      const y = a.y + dy * t
      return Math.hypot(point.x - x, point.y - y)
    }

    const cleaned = [points[0]]
    for (let i = 1; i < points.length - 1; i++) {
      const prev = cleaned[cleaned.length - 1]
      const current = points[i]
      const next = points[i + 1]
      const prevDist = Math.hypot(current.x - prev.x, current.y - prev.y)
      const nextDist = Math.hypot(next.x - current.x, next.y - current.y)
      const sameVertical = Math.abs(prev.x - current.x) < 1 && Math.abs(current.x - next.x) < 1
      const sameHorizontal = Math.abs(prev.y - current.y) < 1 && Math.abs(current.y - next.y) < 1
      const almostStraight = pointLineDistance(current, prev, next) < GRID * 0.28
      const smallHook = prevDist + nextDist < GRID * 2.2

      if (prevDist < GRID * 0.65 || nextDist < GRID * 0.45) continue
      if (sameVertical || sameHorizontal) continue
      if (almostStraight) continue
      if (smallHook) continue
      cleaned.push(current)
    }
    cleaned.push(points[points.length - 1])

    return cleaned
  }

  function removePortalHooks(points, startNode, endNode) {
    const result = [...points]
    const startIsPortal = startNode.isDoor || startNode.isExit || startNode.isStair
    const endIsPortal = endNode.isDoor || endNode.isExit || endNode.isStair

    while (
      startIsPortal &&
      result.length > 2 &&
      Math.hypot(result[1].x - startNode.x, result[1].y - startNode.y) < GRID * 1.35
    ) {
      result.splice(1, 1)
    }

    while (
      endIsPortal &&
      result.length > 2 &&
      Math.hypot(result[result.length - 2].x - endNode.x, result[result.length - 2].y - endNode.y) < GRID * 1.35
    ) {
      result.splice(result.length - 2, 1)
    }

    return result
  }

  function edgePoints(a, b) {
    const edge = findEdge(a, b)
    if (!edge?.points?.length) {
      const points = [routePoint(a, b), routePoint(b, a)]
      if (a.isStair) points.splice(1, 0, stairLeadPoint(a))
      if (b.isStair) points.splice(points.length - 1, 0, stairLeadPoint(b))
      return cleanupRoutePoints(removePortalHooks(points, a, b))
    }

    const points = edge.from === a.id
      ? edge.points.map(point => ({ x: point.x, y: point.y }))
      : [...edge.points].reverse().map(point => ({ x: point.x, y: point.y }))

    if (points.length > 1) {
      points[0] = routePoint(a, points[1])
      points[points.length - 1] = routePoint(b, points[points.length - 2])
      if (a.isStair) points.splice(1, 0, stairLeadPoint(a))
      if (b.isStair) points.splice(points.length - 1, 0, stairLeadPoint(b))
    }

    return cleanupRoutePoints(removePortalHooks(points, a, b))
  }

  // Будуємо масив сегментів з обрізаними кінцями біля стін
  const segments = []
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]
    const points = edgePoints(a, b)
    for (let j = 0; j < points.length - 1; j++) {
      segments.push({ from: points[j], to: points[j + 1] })
    }
  }

  const drawableSegments = seenSegments ? dedupeSegments(segments, seenSegments) : segments

  // Малюємо кожен сегмент окремо (зазор біля стін — навмисний)
  const dash = dashed ? [16 * invScale, 12 * invScale] : []
  function strokeSegments(style, width) {
    ctx.strokeStyle = style
    ctx.lineWidth = width * invScale
    ctx.setLineDash(dash)
    ctx.lineDashOffset = 0
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    drawableSegments.forEach(seg => {
      if (Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y) < 1) return
      ctx.beginPath()
      ctx.moveTo(seg.from.x, seg.from.y)
      ctx.lineTo(seg.to.x, seg.to.y)
      ctx.stroke()
    })
  }

  if (halo) strokeSegments('rgba(255,255,255,0.86)', lineWidth + 3.2)
  strokeSegments(withAlpha(color, alpha), lineWidth)
  ctx.setLineDash([])

  // Стрілки вздовж сегментів
  const AS = arrowSize * invScale, STEP = arrowStep * invScale
  let nextArrow = STEP * 0.5, walked = 0
  drawableSegments.forEach(seg => {
    const dx = seg.to.x - seg.from.x
    const dy = seg.to.y - seg.from.y
    const segLen = Math.hypot(dx, dy)
    if (segLen < minArrowSegment * invScale) { walked += segLen; return }
    const angle = Math.atan2(dy, dx)
    while (nextArrow <= walked + segLen) {
      const t = (nextArrow - walked) / segLen
      const ax = seg.from.x + dx * t, ay = seg.from.y + dy * t
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(angle)
      ctx.fillStyle = withAlpha(color, 'e6'); ctx.beginPath()
      ctx.moveTo(AS, 0); ctx.lineTo(-AS * 0.5, -AS * 0.6); ctx.lineTo(-AS * 0.5, AS * 0.6)
      ctx.closePath(); ctx.fill(); ctx.restore()
      nextArrow += STEP
    }
    walked += segLen
  })

  // Маркер виходу / переходу — на реальній позиції вузла
  if (last.isFloorChange) {
    drawFloorChangeBadge(ctx, last, invScale, color)
  } else if (showExitMarker && last.isExit) {
    ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 * invScale
    ctx.beginPath(); ctx.arc(last.x, last.y, 10 * invScale, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${9 * invScale}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('▲', last.x, last.y - 0.5 * invScale)
  }
  if (showStartDot) {
    const startPoint = path.length > 1 ? routePoint(path[0], path[1]) : path[0]
    ctx.fillStyle = color; ctx.beginPath()
    ctx.arc(startPoint.x, startPoint.y, 4 * invScale, 0, Math.PI * 2); ctx.fill()
  }
}

// ═══════════════════════════════════════════════════════════════
//  РЕНДЕР
// ═══════════════════════════════════════════════════════════════

export default function useRender(canvasRef) {
  const {
    walls, doors, exits, stairs, windows, extinguishers,
    detectedRooms, graphNodes, graphEdges,
    currentPath, multiFloorPath, allPaths, evacuationView, tool, selectedRoomId, viewMode,
    mode, currentFloorId, blockedExits, blockedDoors,
    multiRoomPaths, showEdgeWeights, selectedStairInfo,
  } = useStore()

  const render = (drawing, drawStart, mousePos, scale = 1, offset = { x: 0, y: 0 }, editPreview = null) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height

    ctx.clearRect(0, 0, W, H)

    const isSimple = viewMode === 'simple'
    const isAdvanced = viewMode === 'advanced'

    // ── Background ──────────────────────────────────────────
    ctx.fillStyle = isSimple ? '#ffffff' : '#f8fafc'
    ctx.fillRect(0, 0, W, H)

    ctx.save()
    ctx.translate(offset.x, offset.y)
    ctx.scale(scale, scale)

    const invScale = 1 / scale
    const startX = -offset.x * invScale
    const startY = -offset.y * invScale
    const endX = startX + W * invScale
    const endY = startY + H * invScale
    const edgeWeightLabels = []

    // ══════════════════════════════════════════════════════════
    //  DOT GRID (advanced, Figma-style)
    // ══════════════════════════════════════════════════════════
    if (isAdvanced && GRID * scale > 4) {
      ctx.fillStyle = '#c8d4e0'
      for (let x = Math.floor(startX / GRID) * GRID; x < endX; x += GRID) {
        for (let y = Math.floor(startY / GRID) * GRID; y < endY; y += GRID) {
          ctx.beginPath()
          ctx.arc(x, y, 1 * invScale, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // ══════════════════════════════════════════════════════════
    //  КІМНАТИ (advanced only)
    // ══════════════════════════════════════════════════════════
    if (isAdvanced) {
      detectedRooms.forEach((room, i) => {
        const isSelected = room.id === selectedRoomId
        ctx.fillStyle = isSelected ? ROOM_FILLS_SEL[i % ROOM_FILLS_SEL.length] : ROOM_FILLS[i % ROOM_FILLS.length]
        room.cells.forEach(([row, col]) => {
          ctx.fillRect(col * GRID + 1, row * GRID + 1, GRID - 2, GRID - 2)
        })
        if (isSelected) {
          ctx.strokeStyle = ROOM_STROKES[i % ROOM_STROKES.length]
          ctx.lineWidth = 1.5 * invScale
          ctx.setLineDash([4 * invScale, 3 * invScale])
          room.cells.forEach(([row, col]) => {
            ctx.strokeRect(col * GRID + 1, row * GRID + 1, GRID - 2, GRID - 2)
          })
          ctx.setLineDash([])
        }
      })
    }

    const selectedRoom = detectedRooms.find(room => room.id === selectedRoomId)
    if (mode === 'constructor' && selectedRoom) {
      ctx.fillStyle = 'rgba(59,130,246,0.045)'
      selectedRoom.cells.forEach(([row, col]) => {
        ctx.fillRect(col * GRID + 1, row * GRID + 1, GRID - 2, GRID - 2)
      })
      ctx.strokeStyle = 'rgba(59,130,246,0.45)'
      ctx.lineWidth = 1.1 * invScale
      ctx.setLineDash([3 * invScale, 3 * invScale])
      selectedRoom.cells.forEach(([row, col]) => {
        ctx.strokeRect(col * GRID + 1, row * GRID + 1, GRID - 2, GRID - 2)
      })
      ctx.setLineDash([])
    }

    // ══════════════════════════════════════════════════════════
    //  ГРАФ (advanced only)
    // ══════════════════════════════════════════════════════════
    if (isAdvanced) {
      const pathIds = mode === 'evacuation'
        ? (multiFloorPath?.find(s => s.floorId === currentFloorId)?.path ?? currentPath ?? []).map(n => n.id)
        : []

      graphEdges.forEach(edge => {
        const a = graphNodes.find(n => n.id === edge.from)
        const b = graphNodes.find(n => n.id === edge.to)
        if (!a || !b) return
        const onPath = pathIds.includes(a.id) && pathIds.includes(b.id)
          && Math.abs(pathIds.indexOf(a.id) - pathIds.indexOf(b.id)) === 1

        const graphMuted = mode === 'evacuation'
        ctx.strokeStyle = graphMuted
          ? (onPath ? 'rgba(16,185,129,0.18)' : 'rgba(147,197,253,0.18)')
          : (onPath ? '#10b981' : '#bfdbfe')
        ctx.lineWidth = (graphMuted ? (onPath ? 1.2 : 0.8) : (onPath ? 2.5 : 1)) * invScale
        ctx.setLineDash(onPath ? [6 * invScale, 4 * invScale] : [3 * invScale, 4 * invScale])
        const edgePoints = edge.points?.length
          ? (edge.from === a.id ? edge.points : [...edge.points].reverse())
          : [a, b]

        ctx.beginPath()
        edgePoints.forEach((point, idx) => {
          if (idx === 0) ctx.moveTo(point.x, point.y)
          else ctx.lineTo(point.x, point.y)
        })
        ctx.stroke()
        ctx.setLineDash([])

        // Ваги ребер: завжди для onPath, або для всіх якщо showEdgeWeights
        if (onPath || showEdgeWeights) {
          const midPoint = edgePoints[Math.floor(edgePoints.length / 2)] ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
          const mx = midPoint.x, my = midPoint.y
          const meters = ((edge.length ?? Math.hypot(b.x - a.x, b.y - a.y)) / GRID * METER).toFixed(1)
          edgeWeightLabels.push({ mx, my, meters, onPath })
        }
      })

      graphNodes.forEach(node => {
        const onPath = pathIds.includes(node.id)
        const color = node.isExit ? '#ef4444'
          : node.isStair ? '#f59e0b'
            : node.isDoor ? (mode === 'evacuation' ? 'rgba(148,163,184,0.55)' : '#94a3b8')
              : onPath ? (mode === 'evacuation' ? 'rgba(16,185,129,0.55)' : '#10b981')
                : (mode === 'evacuation' ? 'rgba(59,130,246,0.28)' : '#3b82f6')

        ctx.fillStyle = color + '28'
        ctx.beginPath(); ctx.arc(node.x, node.y, (node.isDoor ? 6 : 9) * invScale, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = color
        ctx.beginPath(); ctx.arc(node.x, node.y, (node.isDoor ? 3 : 4.5) * invScale, 0, Math.PI * 2); ctx.fill()
      })
    }

    // ══════════════════════════════════════════════════════════
    //  ЕВАКУАЦІЙНІ МАРШРУТИ
    // ══════════════════════════════════════════════════════════
    const activePath = (() => {
      if (multiFloorPath) {
        const seg = multiFloorPath.find(s => s.floorId === currentFloorId)
        return seg?.path ?? null
      }
      return currentPath
    })()

    if (mode === 'evacuation' && isSimple) {
      if (evacuationView === 'single' && activePath && activePath.length > 1)
        drawEvacPath(ctx, activePath, invScale, { color: '#009944', lineWidth: 2.6, arrowStep: 105, edges: graphEdges })
      if (evacuationView === 'all' && allPaths.length > 0) {
        const seenSegments = new Set()
        allPaths.forEach((p, i) => {
          if (p && p.length > 1) drawEvacPath(ctx, p, invScale, {
            color: MULTI_COLORS[i % MULTI_COLORS.length],
            lineWidth: 2.1,
            arrowSize: 7,
            arrowStep: 118,
            alpha: 'b8',
            halo: false,
            edges: graphEdges,
            seenSegments,
          })
        })
      }
    }
    if (mode === 'evacuation' && isAdvanced) {
      if (activePath && activePath.length > 1)
        drawEvacPath(ctx, activePath, invScale, { color: '#10b981', lineWidth: 2.5, arrowStep: 105, edges: graphEdges })
      if (evacuationView === 'all' && allPaths.length > 0) {
        const seenSegments = new Set()
        allPaths.forEach((p, i) => {
          if (p && p.length > 1) drawEvacPath(ctx, p, invScale, {
            color: MULTI_COLORS[i % MULTI_COLORS.length],
            lineWidth: 1.9,
            arrowSize: 6.8,
            arrowStep: 122,
            alpha: 'ad',
            halo: false,
            edges: graphEdges,
            seenSegments,
          })
        })
      }
    }

    // ── Мульти-кімнатні маршрути (обидва режими) ───────────────
    if (mode === 'evacuation' && evacuationView === 'multi' && multiRoomPaths) {
      const seenSegments = new Set()
      Object.entries(multiRoomPaths).forEach(([, entry]) => {
        if (entry.path && entry.path.length > 1)
          drawEvacPath(ctx, entry.path, invScale, {
            color: entry.color,
            lineWidth: isAdvanced ? 2 : 2.2,
            arrowSize: 7,
            arrowStep: 116,
            alpha: 'bf',
            halo: false,
            edges: graphEdges,
            seenSegments,
          })
      })
    }

    // ══════════════════════════════════════════════════════════
    //  СТІНИ
    // ══════════════════════════════════════════════════════════
    const wallThickness = 7
    const wallColor = isSimple ? '#111827' : '#1e293b'
    walls.forEach(wall => {
      const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1
      const len = Math.hypot(dx, dy)
      if (len === 0) return
      const nx = (-dy / len) * wallThickness / 2
      const ny = (dx / len) * wallThickness / 2
      ctx.fillStyle = wallColor
      ctx.beginPath()
      ctx.moveTo(wall.x1 + nx, wall.y1 + ny); ctx.lineTo(wall.x2 + nx, wall.y2 + ny)
      ctx.lineTo(wall.x2 - nx, wall.y2 - ny); ctx.lineTo(wall.x1 - nx, wall.y1 - ny)
      ctx.closePath(); ctx.fill()
    })
    // Заповнюємо кутові дірочки — коло в кожній точці з'єднання стін
    ctx.fillStyle = wallColor
    walls.forEach(wall => {
      const r = wallThickness / 2
        ;[[wall.x1, wall.y1], [wall.x2, wall.y2]].forEach(([x, y]) => {
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
        })
    })

    // ══════════════════════════════════════════════════════════
    //  ВІКНА
    // ══════════════════════════════════════════════════════════
    windows?.forEach(windowItem => {
      drawWindowSegment(ctx, windowItem, wallThickness, invScale, isSimple ? '#ffffff' : '#f8fafc')
    })


    // ══════════════════════════════════════════════════════════
    //  ДВЕРІ
    // ══════════════════════════════════════════════════════════
    doors.forEach((door, doorIdx) => {
      const r = GRID * 0.9
      const isBlocked = blockedDoors.includes(doorIdx)

      // Прорізання стіни
      drawWallCut(ctx, door, r, wallThickness, invScale, isSimple ? '#ffffff' : '#f8fafc')

      ctx.setLineDash([])
      ctx.lineCap = 'round'

      if (isBlocked) {
        // Заблоковані двері — діагональна штриховка (стандарт на планах евакуації)
        const hs = GRID * 0.75
        ctx.save()
        ctx.translate(door.x, door.y)
        ctx.rotate(getWallAngle(door))
        ctx.beginPath()
        ctx.rect(-hs, -hs, hs * 2, hs * 2)
        ctx.clip()
        ctx.fillStyle = 'rgba(239,68,68,0.08)'
        ctx.fillRect(-hs, -hs, hs * 2, hs * 2)
        ctx.strokeStyle = 'rgba(239,68,68,0.55)'
        ctx.lineWidth = 1.2 * invScale
        ctx.setLineDash([])
        const step = 6 * invScale
        for (let k = -4; k <= 4; k++) {
          const offset2 = k * step
          ctx.beginPath()
          ctx.moveTo(-hs, offset2)
          ctx.lineTo(offset2, -hs)
          ctx.moveTo(offset2, hs)
          ctx.lineTo(hs, offset2)
          ctx.stroke()
        }
        // Червона рамка
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 1.5 * invScale
        ctx.strokeRect(-hs, -hs, hs * 2, hs * 2)
        ctx.restore()
      } else if (isSimple) {
        ctx.save()
        ctx.translate(door.x, door.y)
        ctx.rotate(getWallAngle(door))
        ctx.strokeStyle = '#b0b8c4'
        ctx.lineWidth = 0.8 * invScale
        ctx.beginPath(); ctx.arc(-r, 0, r, 0, Math.PI / 2); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r, -r); ctx.stroke()
        ctx.restore()
      } else {
        // Advanced — синя дуга + точка петлі
        ctx.save()
        ctx.translate(door.x, door.y)
        ctx.rotate(getWallAngle(door))
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1.5 * invScale
        ctx.beginPath(); ctx.arc(-r, 0, r, 0, Math.PI / 2); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r, -r); ctx.stroke()
        ctx.fillStyle = '#3b82f6'
        ctx.beginPath(); ctx.arc(-r, 0, 3 * invScale, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }
    })

    // ══════════════════════════════════════════════════════════
    //  ВИХОДИ
    // ══════════════════════════════════════════════════════════
    exits.forEach((exit, exitIdx) => {
      const hw = GRID * 0.9
      const isBlocked = blockedExits.includes(exitIdx)

      // Прорізання стіни
      drawWallCut(ctx, exit, hw, wallThickness, invScale, isSimple ? '#ffffff' : '#f8fafc')

      const fontSize = 8 * invScale
      const bh = 16 * invScale
      ctx.font = `bold ${fontSize}px Arial, sans-serif`

      if (isBlocked) {
        const text = '✕ БЛОК'
        const bw = ctx.measureText(text).width + 10 * invScale
        if (isAdvanced) {
          ctx.fillStyle = 'rgba(239,68,68,0.15)'
          ctx.beginPath()
          ctx.roundRect(exit.x - bw / 2 - 5 * invScale, exit.y - bh / 2 - 5 * invScale, bw + 10 * invScale, bh + 10 * invScale, (bh / 2 + 5 * invScale))
          ctx.fill()
        }
        ctx.fillStyle = '#ef4444'
        ctx.beginPath(); ctx.roundRect(exit.x - bw / 2, exit.y - bh / 2, bw, bh, bh / 2); ctx.fill()
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(text, exit.x, exit.y)
      } else if (isSimple) {
        const text = `↑ ${exit.label || 'ВИХІД'}`
        const bw = ctx.measureText(text).width + 10 * invScale
        ctx.fillStyle = '#009944'
        ctx.beginPath(); ctx.roundRect(exit.x - bw / 2, exit.y - bh / 2, bw, bh, bh / 2); ctx.fill()
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(text, exit.x, exit.y)
      } else {
        // Advanced — зелена лінія + glowing badge
        drawAlongWall(ctx, exit, hw, '#00a651', 2.5, invScale, 'round')
        const text = `${exit.label || 'ВИХІД'} ↑`
        const bw = ctx.measureText(text).width + 10 * invScale
        ctx.fillStyle = 'rgba(0,166,81,0.13)'
        ctx.beginPath()
        ctx.roundRect(exit.x - bw / 2 - 5 * invScale, exit.y - bh / 2 - 5 * invScale, bw + 10 * invScale, bh + 10 * invScale, (bh / 2 + 5 * invScale))
        ctx.fill()
        ctx.fillStyle = '#00a651'
        ctx.beginPath(); ctx.roundRect(exit.x - bw / 2, exit.y - bh / 2, bw, bh, bh / 2); ctx.fill()
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(text, exit.x, exit.y)
      }
    })

    // ══════════════════════════════════════════════════════════
    //  СХОДИ
    // ══════════════════════════════════════════════════════════
    stairs.forEach((stair, stairIdx) => {
      const preview = editPreview?.type === 'stair' && editPreview.idx === stairIdx ? editPreview : null
      const drawStair = preview ? { ...stair, ...preview } : stair
      const w = preview?.width ?? stair.width ?? GRID * 0.9
      const h = preview?.height ?? stair.height ?? GRID * 1.6
      const angle = drawStair.angle ?? 0
      const direction = drawStair.direction === 'down' ? -1 : 1
      const isSelectedStair = mode === 'constructor'
        && selectedStairInfo?.floorId === currentFloorId
        && (selectedStairInfo.idx === stairIdx || Math.hypot(selectedStairInfo.x - drawStair.x, selectedStairInfo.y - drawStair.y) < 2)

      ctx.save()
      ctx.translate(drawStair.x, drawStair.y)
      ctx.rotate(angle)

      if (isSelectedStair) {
        ctx.fillStyle = 'rgba(245,158,11,0.16)'
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2 * invScale
        ctx.beginPath()
        ctx.roundRect(-w / 2 - 4 * invScale, -h / 2 - 4 * invScale, w + 8 * invScale, h + 8 * invScale, 6 * invScale)
        ctx.fill()
        ctx.stroke()
      }

      if (isSimple) {
        ctx.strokeStyle = '#374151'; ctx.lineWidth = 1 * invScale
        ctx.strokeRect(-w / 2, -h / 2, w, h)
        for (let i = -2; i <= 2; i++) {
          const y = i * (h / 6)
          ctx.beginPath()
          ctx.moveTo(-w / 2 + 2 * invScale, y)
          ctx.lineTo(w / 2 - 2 * invScale, y)
          ctx.stroke()
        }
      } else {
        ctx.fillStyle = '#fef3c7'; ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5 * invScale
        ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 3 * invScale); ctx.fill(); ctx.stroke()
        ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1 * invScale
        for (let i = -2; i <= 2; i++) {
          const y = i * (h / 6)
          ctx.beginPath()
          ctx.moveTo(-w / 2 + 4 * invScale, y)
          ctx.lineTo(w / 2 - 4 * invScale, y)
          ctx.stroke()
        }
      }

      ctx.strokeStyle = isSimple ? '#374151' : '#92400e'
      ctx.fillStyle = isSimple ? '#374151' : '#92400e'
      ctx.lineWidth = 1.2 * invScale
      ctx.beginPath()
      ctx.moveTo(0, direction * (-h / 2 + 5 * invScale))
      ctx.lineTo(0, direction * (h / 2 - 7 * invScale))
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, direction * (h / 2 - 5 * invScale))
      ctx.lineTo(-4 * invScale, direction * (h / 2 - 12 * invScale))
      ctx.lineTo(4 * invScale, direction * (h / 2 - 12 * invScale))
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      if (isSelectedStair) {
        ctx.save()
        ctx.translate(drawStair.x, drawStair.y)
        ctx.rotate(angle)

        const resizeX = w / 2 + 10 * invScale
        const resizeY = h / 2 + 10 * invScale
        const rotateX = w / 2 + 10 * invScale
        const rotateY = -h / 2 - 10 * invScale
        const buttonR = 8 * invScale
        const boxSize = 15 * invScale

        ctx.fillStyle = 'rgba(255,255,255,0.96)'
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 1.4 * invScale

        ctx.beginPath()
        ctx.roundRect(resizeX - boxSize / 2, resizeY - boxSize / 2, boxSize, boxSize, 4 * invScale)
        ctx.fill()
        ctx.stroke()
        ctx.strokeStyle = '#d97706'
        ctx.lineWidth = 1.2 * invScale
        ctx.beginPath()
        ctx.moveTo(resizeX - 3.5 * invScale, resizeY + 3.5 * invScale)
        ctx.lineTo(resizeX + 3.5 * invScale, resizeY - 3.5 * invScale)
        ctx.moveTo(resizeX + 0.5 * invScale, resizeY + 4 * invScale)
        ctx.lineTo(resizeX + 4 * invScale, resizeY + 4 * invScale)
        ctx.lineTo(resizeX + 4 * invScale, resizeY + 0.5 * invScale)
        ctx.stroke()

        ctx.fillStyle = 'rgba(255,255,255,0.96)'
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 1.4 * invScale
        ctx.beginPath()
        ctx.arc(rotateX, rotateY, buttonR, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#92400e'
        ctx.font = `700 ${11 * invScale}px Manrope, Arial, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('↻', rotateX, rotateY + 0.5 * invScale)

        ctx.restore()

        const text = `Сходи ${stairIdx + 1}`
        const fontSize = Math.max(9, 10 * invScale)
        const badgeY = drawStair.y - GRID * 1.15
        ctx.font = `600 ${fontSize}px Manrope, Arial, sans-serif`
        const bw = ctx.measureText(text).width + 12 * invScale
        const bh = 16 * invScale
        ctx.fillStyle = 'rgba(255,255,255,0.94)'
        ctx.strokeStyle = 'rgba(245,158,11,0.55)'
        ctx.lineWidth = 1 * invScale
        ctx.beginPath()
        ctx.roundRect(drawStair.x - bw / 2, badgeY - bh / 2, bw, bh, 5 * invScale)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#92400e'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(text, drawStair.x, badgeY)
      }
    })

    // ══════════════════════════════════════════════════════════
    //  ВОГНЕГАСНИКИ
    // ══════════════════════════════════════════════════════════
    extinguishers?.forEach(ext => {
      const x = ext.x, y = ext.y, s = invScale, r = 8 * s
      if (isAdvanced) {
        ctx.fillStyle = 'rgba(220,38,38,0.10)'
        ctx.beginPath(); ctx.arc(x, y, r + 4 * s, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = '#dc2626'
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 * s; ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${6.5 * s}px Arial, sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('ВП', x, y)
    })

    // ══════════════════════════════════════════════════════════
    //  ПІДПИСИ КІМНАТ
    // ══════════════════════════════════════════════════════════
	    detectedRooms.forEach((room, i) => {
      const isSelected = room.id === selectedRoomId
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'

      if (isSimple) {
        const fs = Math.max(9, 10 * invScale)
        ctx.font = `${fs}px Arial, sans-serif`
        ctx.fillStyle = 'rgba(55,65,81,0.82)'
        ctx.fillText(room.label, room.cx, room.cy)
      } else {
        const compactLabel = scale < 0.82 || detectedRooms.length >= 9
        const nameSize = compactLabel ? Math.max(8, 9.5 * invScale) : Math.max(9, 11 * invScale)
        const areaSize = Math.max(7, 8 * invScale)

        ctx.font = `600 ${nameSize}px Manrope, Arial, sans-serif`
        const nameW = ctx.measureText(room.label).width
        ctx.font = `${areaSize}px JetBrains Mono, monospace`
        const areaW = ctx.measureText(`${room.areaM2}м²`).width
        const pillW = (compactLabel ? nameW : Math.max(nameW, areaW)) + (compactLabel ? 9 : 12) * invScale
        const pillH = compactLabel ? nameSize + 7 * invScale : nameSize + areaSize + 8 * invScale

        ctx.fillStyle = isSelected ? 'rgba(255,68,34,0.11)' : 'rgba(255,255,255,0.72)'
        ctx.strokeStyle = isSelected ? 'rgba(255,68,34,0.38)' : ROOM_STROKES[i % ROOM_STROKES.length].replace('0.30', compactLabel ? '0.16' : '0.22')
        ctx.lineWidth = 0.8 * invScale
        ctx.beginPath()
        ctx.roundRect(room.cx - pillW / 2, room.cy - pillH / 2, pillW, pillH, 4 * invScale)
        ctx.fill(); ctx.stroke()

        ctx.font = `600 ${nameSize}px Manrope, Arial, sans-serif`
        ctx.fillStyle = isSelected ? '#ff4422' : 'rgba(30,41,59,0.82)'
        ctx.fillText(room.label, room.cx, compactLabel ? room.cy : room.cy - areaSize / 2 - 1.5 * invScale)

        if (!compactLabel) {
          ctx.font = `${areaSize}px JetBrains Mono, monospace`
          ctx.fillStyle = isSelected ? '#ff7755' : 'rgba(100,116,139,0.78)'
          ctx.fillText(`${room.areaM2}м²`, room.cx, room.cy + nameSize / 2 + 1 * invScale)
        }
      }
	    })

    if (isAdvanced && edgeWeightLabels.length > 0) {
      edgeWeightLabels.forEach(({ mx, my, meters, onPath }) => {
        ctx.fillStyle = onPath ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.9)'
        ctx.strokeStyle = onPath ? 'rgba(16,185,129,0.28)' : 'rgba(148,163,184,0.25)'
        ctx.lineWidth = 0.8 * invScale
        ctx.beginPath()
        ctx.roundRect(mx - 14 * invScale, my - 7 * invScale, 28 * invScale, 14 * invScale, 2 * invScale)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = onPath ? '#10b981' : '#64748b'
        ctx.font = `${8 * invScale}px JetBrains Mono, monospace`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(`${meters}м`, mx, my)
      })
    }

    // ══════════════════════════════════════════════════════════
    //  PREVIEW МАЛЮВАННЯ
    // ══════════════════════════════════════════════════════════
    if (mode === 'constructor' && drawing && drawStart) {
      const isWindowPreview = tool === 'window'
      ctx.strokeStyle = isWindowPreview ? 'rgba(71,85,105,0.55)' : '#ff442250'
      ctx.lineWidth = 2 * invScale
      ctx.setLineDash([6 * invScale, 4 * invScale])
      ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(drawStart.x, drawStart.y); ctx.lineTo(mousePos.x, mousePos.y); ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = isWindowPreview ? '#475569' : '#ff4422'
      ctx.beginPath(); ctx.arc(drawStart.x, drawStart.y, 4 * invScale, 0, Math.PI * 2); ctx.fill()

      const dist = Math.hypot(mousePos.x - drawStart.x, mousePos.y - drawStart.y)
      const meters = ((dist / GRID) * METER).toFixed(1)
      const mx = (drawStart.x + mousePos.x) / 2, my = (drawStart.y + mousePos.y) / 2
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = isWindowPreview ? 'rgba(71,85,105,0.22)' : '#ff442230'; ctx.lineWidth = 1 * invScale
      ctx.beginPath(); ctx.roundRect(mx - 18 * invScale, my - 8 * invScale, 36 * invScale, 16 * invScale, 3 * invScale); ctx.fill(); ctx.stroke()
      ctx.fillStyle = isWindowPreview ? '#475569' : '#ff4422'; ctx.font = `bold ${9 * invScale}px JetBrains Mono, monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`${meters}м`, mx, my)
    }

    ctx.restore()

    // ══════════════════════════════════════════════════════════
    //  SNAP CURSOR
    // ══════════════════════════════════════════════════════════
    if (mode === 'constructor' && tool !== 'select') {
      const sx = mousePos.x * scale + offset.x
      const sy = mousePos.y * scale + offset.y
      ctx.strokeStyle = '#ff442255'; ctx.lineWidth = 1; ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(sx, sy - 8); ctx.lineTo(sx, sy + 8)
      ctx.moveTo(sx - 8, sy); ctx.lineTo(sx + 8, sy)
      ctx.stroke()
    }
  }

  return { render }
}
