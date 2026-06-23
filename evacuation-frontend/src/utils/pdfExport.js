import jsPDF from 'jspdf'
import { computeSafetyAnalysis } from './evacAnalysis'

const GRID = 20
const METER = 0.5
const MULTI_COLORS = [
  '#2563eb', '#0f766e', '#b45309', '#7c3aed', '#be123c',
]

const REC_STYLES = {
  ok: { bg: '#f0fdf4', border: '#86efac', dot: '#22c984', text: '#166534' },
  warning: { bg: '#fffbeb', border: '#fcd34d', dot: '#f5c542', text: '#92400e' },
  error: { bg: '#fff1f2', border: '#fca5a5', dot: '#ff4422', text: '#991b1b' },
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

function drawWindowSegment(ctx, windowItem, wallThickness, invScale) {
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
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = (wallThickness + 4) * invScale
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(-half, 0)
  ctx.lineTo(half, 0)
  ctx.stroke()

  ctx.strokeStyle = '#475569'
  ctx.lineWidth = 1.1 * invScale
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
//  ЕВАКУАЦІЙНІ МАРШРУТИ (canvas helpers)
// ═══════════════════════════════════════════════════════════════

function drawFloorChangeBadge(ctx, node, invScale) {
  const x = node.x, y = node.y
  const text = `↓ ${node.targetFloorName}`
  const fontSize = 9 * invScale, pad = 4 * invScale, R = 3 * invScale
  ctx.font = `bold ${fontSize}px sans-serif`
  const tw = ctx.measureText(text).width
  const bw = tw + pad * 2, bh = fontSize + pad * 1.5
  ctx.fillStyle = '#f5c542'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * invScale
  ctx.beginPath()
  ctx.moveTo(x - bw/2 + R, y - bh/2); ctx.lineTo(x + bw/2 - R, y - bh/2)
  ctx.arcTo(x + bw/2, y - bh/2, x + bw/2, y - bh/2 + R, R)
  ctx.lineTo(x + bw/2, y + bh/2 - R)
  ctx.arcTo(x + bw/2, y + bh/2, x + bw/2 - R, y + bh/2, R)
  ctx.lineTo(x - bw/2 + R, y + bh/2)
  ctx.arcTo(x - bw/2, y + bh/2, x - bw/2, y + bh/2 - R, R)
  ctx.lineTo(x - bw/2, y - bh/2 + R)
  ctx.arcTo(x - bw/2, y - bh/2, x - bw/2 + R, y - bh/2, R)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
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
    edges = [],
    seenSegments = null,
  } = opts

  const floorChangeIdx = fullPath.findIndex(n => n.isFloorChange)
  const path = floorChangeIdx >= 0 ? fullPath.slice(0, floorChangeIdx + 1) : fullPath
  const last = path[path.length - 1]

  const TRIM = 13

  function wallOffset(wallNode, toward) {
    const dx = toward.x - wallNode.x
    const dy = toward.y - wallNode.y
    const len = Math.hypot(dx, dy)
    if (len < 2) return { x: wallNode.x, y: wallNode.y }
    const t = Math.min(TRIM / len, 0.45)
    return { x: wallNode.x + dx * t, y: wallNode.y + dy * t }
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
    const startIsPortal = startNode.isDoor || startNode.isExit
    const endIsPortal = endNode.isDoor || endNode.isExit

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
      return cleanupRoutePoints(removePortalHooks([
        (a.isDoor || a.isExit) ? wallOffset(a, b) : { x: a.x, y: a.y },
        (b.isDoor || b.isExit) ? wallOffset(b, a) : { x: b.x, y: b.y },
      ], a, b))
    }

    const points = edge.from === a.id
      ? edge.points.map(point => ({ x: point.x, y: point.y }))
      : [...edge.points].reverse().map(point => ({ x: point.x, y: point.y }))

    if (points.length > 1) {
      points[0] = (a.isDoor || a.isExit) ? wallOffset(a, points[1]) : { x: a.x, y: a.y }
      points[points.length - 1] = (b.isDoor || b.isExit)
        ? wallOffset(b, points[points.length - 2])
        : { x: b.x, y: b.y }
    }

    return cleanupRoutePoints(removePortalHooks(points, a, b))
  }

  const segments = []
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]
    const points = edgePoints(a, b)
    for (let j = 0; j < points.length - 1; j++) {
      segments.push({ from: points[j], to: points[j + 1] })
    }
  }

  const drawableSegments = seenSegments ? dedupeSegments(segments, seenSegments) : segments

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
      ctx.moveTo(AS, 0); ctx.lineTo(-AS*0.5, -AS*0.6); ctx.lineTo(-AS*0.5, AS*0.6)
      ctx.closePath(); ctx.fill(); ctx.restore()
      nextArrow += STEP
    }
    walked += segLen
  })

  if (last.isFloorChange) {
    drawFloorChangeBadge(ctx, last, invScale)
  } else if (last.isExit) {
    ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 * invScale
    ctx.beginPath(); ctx.arc(last.x, last.y, 10 * invScale, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${9 * invScale}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('▲', last.x, last.y - 0.5 * invScale)
  }

  if (showStartDot) {
    ctx.fillStyle = color; ctx.beginPath()
    ctx.arc(path[0].x, path[0].y, 4 * invScale, 0, Math.PI * 2); ctx.fill()
  }
}

// ═══════════════════════════════════════════════════════════════
//  РЕНДЕР ПОВЕРХУ (чистий план без оформлення)
// ═══════════════════════════════════════════════════════════════

function drawFloorOnCanvas(canvas, floorData, scale, offset, evacData) {
  const {
    walls = [], doors = [], exits = [], stairs = [], windows = [],
    extinguishers = [], detectedRooms = [],
  } = floorData

  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  const invScale = 1 / scale
  const wallThickness = 5

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  ctx.translate(offset.x, offset.y)
  ctx.scale(scale, scale)

  // ── Евакуаційні маршрути ──────────────────────────────────
  if (evacData) {
    const { currentPath, allPaths, evacuationView, multiFloorPath, currentFloorId, multiRoomPaths, graphEdges = [] } = evacData
    const activePath = multiFloorPath
      ? (multiFloorPath.find(s => s.floorId === currentFloorId)?.path ?? null)
      : currentPath
    if (evacuationView === 'single' && activePath && activePath.length > 1)
      drawEvacPath(ctx, activePath, invScale, { color: '#009944', lineWidth: 2.6, arrowStep: 105, edges: graphEdges })
    if (evacuationView === 'all' && allPaths && allPaths.length > 0) {
      const seenSegments = new Set()
      allPaths.forEach((path, i) => {
        if (path && path.length > 1) drawEvacPath(ctx, path, invScale, {
          color: MULTI_COLORS[i % MULTI_COLORS.length],
          lineWidth: 2,
          arrowSize: 7,
          arrowStep: 120,
          alpha: 'b8',
          halo: false,
          edges: graphEdges,
          seenSegments,
        })
      })
    }
    if (evacuationView === 'multi' && multiRoomPaths) {
      const seenSegments = new Set()
      Object.values(multiRoomPaths).forEach(entry => {
        if (entry?.path && entry.path.length > 1) {
          drawEvacPath(ctx, entry.path, invScale, {
            color: entry.color || '#009944',
            lineWidth: 2,
            arrowSize: 7,
            arrowStep: 116,
            alpha: 'bf',
            halo: false,
            edges: graphEdges,
            seenSegments,
          })
        }
      })
    }
  }

  // ── Стіни ────────────────────────────────────────────────
  walls.forEach(wall => {
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1
    const len = Math.hypot(dx, dy)
    if (len === 0) return
    const nx = (-dy / len) * wallThickness / 2
    const ny = (dx / len) * wallThickness / 2
    ctx.fillStyle = '#111827'
    ctx.beginPath()
    ctx.moveTo(wall.x1 + nx, wall.y1 + ny); ctx.lineTo(wall.x2 + nx, wall.y2 + ny)
    ctx.lineTo(wall.x2 - nx, wall.y2 - ny); ctx.lineTo(wall.x1 - nx, wall.y1 - ny)
    ctx.closePath(); ctx.fill()
  })

  // ── Двері ────────────────────────────────────────────────
  windows.forEach(windowItem => {
    drawWindowSegment(ctx, windowItem, wallThickness, invScale)
  })

  doors.forEach(door => {
    const r = GRID * 0.9
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (wallThickness + 4) * invScale; ctx.lineCap = 'butt'
    if (door.horiz) {
      ctx.beginPath(); ctx.moveTo(door.x - r, door.y); ctx.lineTo(door.x + r, door.y); ctx.stroke()
    } else {
      ctx.beginPath(); ctx.moveTo(door.x, door.y - r); ctx.lineTo(door.x, door.y + r); ctx.stroke()
    }
    ctx.strokeStyle = '#b0b8c4'; ctx.lineWidth = 0.8 * invScale; ctx.setLineDash([]); ctx.lineCap = 'round'
    if (door.horiz) {
      ctx.beginPath(); ctx.arc(door.x - r, door.y, r, 0, Math.PI / 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(door.x - r, door.y); ctx.lineTo(door.x - r, door.y - r); ctx.stroke()
    } else {
      ctx.beginPath(); ctx.arc(door.x, door.y - r, r, Math.PI / 2, Math.PI); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(door.x, door.y - r); ctx.lineTo(door.x + r, door.y - r); ctx.stroke()
    }
  })

  // ── Виходи ───────────────────────────────────────────────
  exits.forEach(exit => {
    const hw = GRID * 0.9
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (wallThickness + 4) * invScale; ctx.lineCap = 'butt'
    if (exit.horiz) {
      ctx.beginPath(); ctx.moveTo(exit.x - hw, exit.y); ctx.lineTo(exit.x + hw, exit.y); ctx.stroke()
    } else {
      ctx.beginPath(); ctx.moveTo(exit.x, exit.y - hw); ctx.lineTo(exit.x, exit.y + hw); ctx.stroke()
    }
    const bh = 16 * invScale
    const fontSize = 8 * invScale
    ctx.font = `bold ${fontSize}px Arial, sans-serif`
    const text = `↑ ${exit.label || 'ВИХІД'}`
    const bw = ctx.measureText(text).width + 10 * invScale
    ctx.fillStyle = '#009944'
    ctx.beginPath(); ctx.roundRect(exit.x - bw / 2, exit.y - bh / 2, bw, bh, bh / 2); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(text, exit.x, exit.y)
  })

  // ── Сходи ────────────────────────────────────────────────
  stairs.forEach(stair => {
    const w = stair.width ?? GRID * 0.9
    const h = stair.height ?? GRID * 1.6
    const angle = stair.angle ?? 0
    const direction = stair.direction === 'down' ? -1 : 1
    ctx.save()
    ctx.translate(stair.x, stair.y)
    ctx.rotate(angle)
    ctx.strokeStyle = '#374151'; ctx.lineWidth = 1 * invScale
    ctx.strokeRect(-w / 2, -h / 2, w, h)
    for (let i = -2; i <= 2; i++) {
      const y = i * (h / 6)
      ctx.beginPath()
      ctx.moveTo(-w / 2 + 2 * invScale, y)
      ctx.lineTo(w / 2 - 2 * invScale, y)
      ctx.stroke()
    }
    ctx.fillStyle = '#374151'
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
  })

  // ── Вогнегасники ─────────────────────────────────────────
  extinguishers.forEach(ext => {
    const x = ext.x, y = ext.y, s = invScale, r = 8 * s
    ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 * s; ctx.stroke()
    ctx.fillStyle = '#ffffff'; ctx.font = `bold ${6.5 * s}px Arial, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('ВП', x, y)
  })

  // ── Підписи кімнат ───────────────────────────────────────
  detectedRooms.forEach(room => {
    const fontSize = Math.max(9, 10 * invScale)
    ctx.font = `${fontSize}px Arial, sans-serif`
    ctx.fillStyle = 'rgba(55,65,81,0.78)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(room.label, room.cx, room.cy)
  })

  ctx.restore()
}

// ── Будує offscreen canvas тільки з планом ────────────────────
function buildFloorCanvas(floorData, evacData) {
  const { walls = [], doors = [], exits = [], stairs = [], windows = [], extinguishers = [] } = floorData

  const OUTPUT_W = 1400, OUTPUT_H = 990
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_W; canvas.height = OUTPUT_H

  const points = [
    ...walls.flatMap(w => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]),
    ...doors.map(d => ({ x: d.x, y: d.y })),
    ...exits.map(e => ({ x: e.x, y: e.y })),
    ...windows.flatMap(w => {
      const segment = normalizeWindowSegment(w)
      return [{ x: segment.x1, y: segment.y1 }, { x: segment.x2, y: segment.y2 }]
    }),
    ...stairs.flatMap(s => {
      const halfW = (s.width ?? GRID * 0.9) / 2
      const halfH = (s.height ?? GRID * 1.6) / 2
      return [
        { x: s.x - halfW, y: s.y - halfH },
        { x: s.x + halfW, y: s.y + halfH },
      ]
    }),
    ...extinguishers.map(e => ({ x: e.x, y: e.y })),
  ]

  if (points.length === 0) {
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, OUTPUT_W, OUTPUT_H)
    ctx.fillStyle = '#ccc'; ctx.font = '28px Arial, sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('Поверх порожній', OUTPUT_W / 2, OUTPUT_H / 2)
    return canvas
  }

  const minX = points.reduce((m, p) => Math.min(m, p.x), Infinity)
  const minY = points.reduce((m, p) => Math.min(m, p.y), Infinity)
  const maxX = points.reduce((m, p) => Math.max(m, p.x), -Infinity)
  const maxY = points.reduce((m, p) => Math.max(m, p.y), -Infinity)

  const PAD = 80
  const contentW = maxX - minX + PAD * 2
  const contentH = maxY - minY + PAD * 2
  const scale = Math.min(OUTPUT_W / contentW, OUTPUT_H / contentH)
  const scaledW = contentW * scale, scaledH = contentH * scale

  const offset = {
    x: (OUTPUT_W - scaledW) / 2 - (minX - PAD) * scale,
    y: (OUTPUT_H - scaledH) / 2 - (minY - PAD) * scale,
  }

  drawFloorOnCanvas(canvas, floorData, scale, offset, evacData)
  return canvas
}

// ═══════════════════════════════════════════════════════════════
//  ПОВНИЙ ДОКУМЕНТ — A4 альбом, стиль «план на стіні»
// ═══════════════════════════════════════════════════════════════

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''

  words.forEach(word => {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width <= maxWidth) line = test
    else {
      if (line) lines.push(line)
      line = word
    }
  })

  if (line) lines.push(line)
  return lines
}

function drawRecommendationCard(ctx, rec, x, y, w) {
  const style = REC_STYLES[rec.level] || REC_STYLES.warning
  ctx.font = '14px Manrope, Arial, sans-serif'
  const lines = wrapText(ctx, rec.text, w - 42)
  const h = Math.max(52, 24 + Math.min(lines.length, 4) * 18)

  ctx.fillStyle = style.bg
  ctx.strokeStyle = style.border
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 8)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = style.dot
  ctx.beginPath()
  ctx.arc(x + 16, y + 21, 5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = style.text
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  lines.slice(0, 4).forEach((line, i) => ctx.fillText(line, x + 30, y + 12 + i * 18))
  return h
}

function drawAnalysisPanel(ctx, evacData, floorData, x, y, w, bottomY) {
  const analysis = evacData?.graphNodes
    ? computeSafetyAnalysis(
      evacData.graphNodes,
      evacData.graphEdges || [],
      evacData.detectedRooms || floorData.detectedRooms || [],
	      {
	        stairLinks: evacData.stairLinks || {},
	        currentFloorId: evacData.currentFloorId,
	        blockedExits: evacData.blockedExits || [],
	        blockedDoors: evacData.blockedDoors || [],
	        exits: evacData.exits || [],
	        doors: evacData.doors || [],
	      }
	    )
    : null

  ctx.font = 'bold 18px Manrope, Arial, sans-serif'
  ctx.fillStyle = '#1a1a1a'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('АНАЛІЗ', x, y)
  y += 26

  if (!analysis) {
    ctx.font = '14px Manrope, Arial, sans-serif'
    ctx.fillStyle = '#777'
    ctx.fillText('Дані аналізу відсутні', x, y)
    return
  }

  ctx.font = '14px Manrope, Arial, sans-serif'
  const exitLabel = analysis.stairExitCount > 0 ? `${analysis.exitCount} евак. точ.` : `${analysis.exitCount} вих.`
  ;[
    ['Площа', `${analysis.totalAreaM2} м²`],
    ['Виходи', exitLabel],
    ['Тупики', `${analysis.deadendCount}`],
    ['Найдальша точка', `${analysis.farthestCornerDist} м`],
  ].forEach(([label, value]) => {
    ctx.fillStyle = '#777'
    ctx.textAlign = 'left'
    ctx.fillText(label, x, y)
    ctx.fillStyle = '#1a1a1a'
    ctx.textAlign = 'right'
    ctx.fillText(value, x + w, y)
    y += 21
  })

  y += 16
  ctx.font = 'bold 18px Manrope, Arial, sans-serif'
  ctx.fillStyle = '#1a1a1a'
  ctx.textAlign = 'left'
  ctx.fillText('РЕКОМЕНДАЦІЇ', x, y)
  y += 22

  const recommendations = analysis.recommendations?.length
    ? analysis.recommendations
    : [{ level: 'ok', text: 'План відповідає базовим вимогам безпеки' }]

  for (const rec of recommendations.slice(0, 4)) {
    const cardH = drawRecommendationCard(ctx, rec, x, y, w)
    y += cardH + 8
    if (y > bottomY - 60) break
  }
}

function buildDocumentCanvas(floorData, evacData, planName, floorName) {
  // A4 landscape @ ~152 DPI: 1772 × 1252
  const W = 1772, H = 1252
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  const M = 36           // outer margin
  const BP = 14          // border-inner padding
  const TITLE_H = 118    // header height
  const FOOTER_H = 76    // footer height
  const LEGEND_W = 318   // legend width (right side)

  // ── Фон ─────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // ── Подвійна рамка ───────────────────────────────────────
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 10
  ctx.strokeRect(M, M, W - M * 2, H - M * 2)
  ctx.lineWidth = 2
  ctx.strokeRect(M + BP, M + BP, W - M * 2 - BP * 2, H - M * 2 - BP * 2)

  // ── Зелений хедер ───────────────────────────────────────
  ctx.fillStyle = '#00703c'
  ctx.fillRect(M, M, W - M * 2, TITLE_H)

  // Головний заголовок
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 60px Manrope, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('ПЛАН ЕВАКУАЦІЇ ПРИ ПОЖЕЖІ', W / 2, M + 72)

  // Підзаголовок: назва плану (ліво) | поверх (право)
  ctx.font = '26px Manrope, Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(planName, M + 24, M + 104)
  ctx.textAlign = 'right'
  ctx.fillText(floorName, W - M - 24, M + 104)

  // Лінія під хедером
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 4
  ctx.beginPath(); ctx.moveTo(M, M + TITLE_H); ctx.lineTo(W - M, M + TITLE_H); ctx.stroke()

  const contentY = M + TITLE_H
  const footerY = H - M - FOOTER_H
  const legendX = W - M - LEGEND_W

  // ── Вертикальний роздільник легенди ─────────────────────
  ctx.strokeStyle = '#c0c0c0'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(legendX, contentY); ctx.lineTo(legendX, footerY); ctx.stroke()

  // ── Вставляємо план поверху ──────────────────────────────
  const planCanvas = buildFloorCanvas(floorData, evacData)
  const planAreaW = legendX - M - 16
  const planAreaH = footerY - contentY - 16
  const ratio = planCanvas.height / planCanvas.width
  let imgW = planAreaW, imgH = planAreaW * ratio
  if (imgH > planAreaH) { imgH = planAreaH; imgW = planAreaH / ratio }
  const imgX = M + 8 + (planAreaW - imgW) / 2
  const imgY = contentY + 8 + (planAreaH - imgH) / 2
  ctx.drawImage(planCanvas, imgX, imgY, imgW, imgH)

  // ═══════════════════════════════════════════════════════
  //  ЛЕГЕНДА
  // ═══════════════════════════════════════════════════════
  const lx = legendX + 20
  const legendInnerW = LEGEND_W - 40
  let ly = contentY + 42

  // Заголовок легенди
  ctx.font = 'bold 22px Manrope, Arial, sans-serif'
  ctx.fillStyle = '#1a1a1a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('УМОВНІ ПОЗНАЧЕННЯ', legendX + LEGEND_W / 2, ly)
  ly += 16
  ctx.strokeStyle = '#c0c0c0'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + legendInnerW, ly); ctx.stroke()
  ly += 36

  const SYM_W = 56
  const ITEM_H = 50

  function legendRow(drawFn, label) {
    drawFn(lx, ly)
    ctx.font = '19px Manrope, Arial, sans-serif'
    ctx.fillStyle = '#2a2a2a'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(label, lx + SYM_W + 4, ly)
    ly += ITEM_H
  }

  // Напрямок евакуації
  legendRow((x, y) => {
    ctx.strokeStyle = '#009944'; ctx.lineWidth = 7; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 36, y); ctx.stroke()
    ctx.fillStyle = '#009944'; ctx.beginPath()
    ctx.moveTo(x + 50, y); ctx.lineTo(x + 36, y - 11); ctx.lineTo(x + 36, y + 11)
    ctx.closePath(); ctx.fill()
  }, 'Напрямок евакуації')

  // Аварійний вихід
  legendRow((x, y) => {
    ctx.fillStyle = '#009944'
    ctx.beginPath(); ctx.roundRect(x, y - 14, 52, 24, 3); ctx.fill()
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px Arial, sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('ВИХІД', x + 26, y - 2)
  }, 'Аварійний вихід')

  // Вогнегасник
  legendRow((x, y) => {
    ctx.fillStyle = '#cc2200'
    ctx.beginPath(); ctx.arc(x + 20, y, 18, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px Arial, sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('ВП', x + 20, y)
  }, 'Вогнегасник (ВП)')

  // Сходи
  legendRow((x, y) => {
    ctx.strokeStyle = '#444'; ctx.lineWidth = 2
    const sw = 30, sh = 38
    ctx.strokeRect(x + 2, y - sh / 2, sw, sh)
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(x + 4, y + i * (sh / 6))
      ctx.lineTo(x + sw, y + i * (sh / 6))
      ctx.stroke()
    }
  }, 'Сходи')

  // Двері
  legendRow((x, y) => {
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
    const r = 24
    ctx.beginPath(); ctx.moveTo(x, y + r); ctx.lineTo(x, y - 4); ctx.stroke()
    ctx.beginPath(); ctx.arc(x, y + r, r, -Math.PI / 2, 0); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x, y + r); ctx.lineTo(x + r, y + r); ctx.stroke()
  }, 'Двері')

  // ── "ВИ ЗНАХОДИТЕСЬ ТУТ" ────────────────────────────────
  ly += 10
  ctx.strokeStyle = '#c0c0c0'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(lx, ly - 8); ctx.lineTo(lx + legendInnerW, ly - 8); ctx.stroke()
  ly += 14

  ctx.fillStyle = '#eaf6ef'; ctx.strokeStyle = '#009944'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.roundRect(lx - 6, ly - 12, legendInnerW + 12, 64, 10)
  ctx.fill(); ctx.stroke()

  ctx.fillStyle = '#00703c'
  ctx.beginPath(); ctx.arc(lx + 20, ly + 20, 17, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 17px sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('★', lx + 20, ly + 20)

  ctx.font = 'bold 18px Manrope, Arial, sans-serif'
  ctx.fillStyle = '#00703c'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText('ВИ ЗНАХОДИТЕСЬ ТУТ', lx + 44, ly + 20)

  // ── Масштаб ──────────────────────────────────────────────
  ly += 80
  ctx.font = '18px Manrope, Arial, sans-serif'
  ctx.fillStyle = '#888'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText('Масштаб: 1:100', lx, ly)

  // ═══════════════════════════════════════════════════════
  //  ФУТЕР
  // ═══════════════════════════════════════════════════════
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 4
  ctx.beginPath(); ctx.moveTo(M, footerY); ctx.lineTo(W - M, footerY); ctx.stroke()

  ctx.fillStyle = '#f5f5f5'
  ctx.fillRect(M + 2, footerY + 2, W - M * 2 - 4, FOOTER_H - 2)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(legendX + 2, contentY + 2, LEGEND_W - 4, footerY - contentY - 4)
  ctx.strokeStyle = '#c0c0c0'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(legendX, contentY)
  ctx.lineTo(legendX, footerY)
  ctx.stroke()
  drawAnalysisPanel(ctx, evacData, floorData, legendX + 20, contentY + 42, LEGEND_W - 40, footerY)

  const dateStr = new Date().toLocaleDateString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  ctx.font = '20px Manrope, Arial, sans-serif'
  ctx.fillStyle = '#666'; ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(`Дата складання: ${dateStr}`, M + 24, footerY + FOOTER_H / 2)
  ctx.textAlign = 'center'
  ctx.fillText('Складено відповідно до ДСТУ ISO 23601:2012', W / 2, footerY + FOOTER_H / 2)
  ctx.textAlign = 'right'
  ctx.fillText('EvacRoute', W - M - 24, footerY + FOOTER_H / 2)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  const CLEAN_M = 44
  const CLEAN_GAP = 24
  const CLEAN_RIGHT_W = 310
  const cleanPlanCanvas = buildFloorCanvas(floorData, evacData)
  const cleanPlanAreaW = W - CLEAN_M * 2 - CLEAN_RIGHT_W - CLEAN_GAP
  const cleanPlanAreaH = H - CLEAN_M * 2
  const cleanRatio = cleanPlanCanvas.height / cleanPlanCanvas.width
  let cleanImgW = cleanPlanAreaW
  let cleanImgH = cleanPlanAreaW * cleanRatio

  if (cleanImgH > cleanPlanAreaH) {
    cleanImgH = cleanPlanAreaH
    cleanImgW = cleanPlanAreaH / cleanRatio
  }

  const cleanImgX = CLEAN_M + (cleanPlanAreaW - cleanImgW) / 2
  const cleanImgY = CLEAN_M + (cleanPlanAreaH - cleanImgH) / 2
  ctx.drawImage(cleanPlanCanvas, cleanImgX, cleanImgY, cleanImgW, cleanImgH)

  const cleanPanelX = W - CLEAN_M - CLEAN_RIGHT_W
  drawAnalysisPanel(ctx, evacData, floorData, cleanPanelX, CLEAN_M + 18, CLEAN_RIGHT_W, H - CLEAN_M)

  return canvas
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function getFloorData(floor, floorDataMap, currentFloorId, currentFloorData) {
  return floor.id === currentFloorId
    ? currentFloorData
    : (floorDataMap[floor.id] || { walls: [], doors: [], exits: [], stairs: [], windows: [], extinguishers: [] })
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════

export function exportPlanToPDF(planName, floors, floorDataMap, currentFloorId, currentFloorData, routeData) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = 297, pageH = 210

  floors.forEach((floor, i) => {
    if (i > 0) pdf.addPage()
    const data = getFloorData(floor, floorDataMap, currentFloorId, currentFloorData)
    const evacData = floor.id === currentFloorId ? routeData : null
    const canvas = buildDocumentCanvas(data, evacData, planName, floor.name)
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageH)
  })

  pdf.save(`${planName}.pdf`)
}

export function exportAllFloorsToPNG(planName, floors, floorDataMap, currentFloorId, currentFloorData, routeData) {
  floors.forEach((floor, i) => {
    setTimeout(() => {
      const data = getFloorData(floor, floorDataMap, currentFloorId, currentFloorData)
      const evacData = floor.id === currentFloorId ? routeData : null
      const canvas = buildDocumentCanvas(data, evacData, planName, floor.name)
      const link = document.createElement('a')
      link.download = `${planName}_${floor.name}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }, i * 400)
  })
}

export function exportCurrentFloorToPDF(planName, floorName, floorData) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const docCanvas = buildDocumentCanvas(
    floorData || { walls: [], doors: [], exits: [], stairs: [], windows: [], extinguishers: [] },
    null, planName, floorName
  )
  pdf.addImage(docCanvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210)
  pdf.save(`${planName}_${floorName}.pdf`)
}
