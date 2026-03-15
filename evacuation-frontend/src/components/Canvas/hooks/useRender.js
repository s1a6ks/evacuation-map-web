import useStore from '../../../store/useStore'

const GRID = 20
const METER = 0.5

// Палітра кольорів для мульти-режиму (декілька / всі)
const MULTI_COLORS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899',
  '#06b6d4', '#84cc16', '#f97316', '#14b8a6',
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

function drawEvacPath(ctx, fullPath, invScale, opts = {}) {
  if (!fullPath || fullPath.length < 2) return
  const { color = '#009944', lineWidth = 3, arrowSize = 10, arrowStep = 45, showStartDot = true, showExitMarker = true } = opts

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

  // Будуємо масив сегментів з обрізаними кінцями біля стін
  const segments = []
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]
    segments.push({
      from: (a.isDoor || a.isExit) ? wallOffset(a, b) : { x: a.x, y: a.y },
      to: (b.isDoor || b.isExit) ? wallOffset(b, a) : { x: b.x, y: b.y },
    })
  }

  // Малюємо кожен сегмент окремо (зазор біля стін — навмисний)
  ctx.strokeStyle = color; ctx.lineWidth = lineWidth * invScale
  ctx.setLineDash([]); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  segments.forEach(seg => {
    if (Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y) < 1) return
    ctx.beginPath()
    ctx.moveTo(seg.from.x, seg.from.y)
    ctx.lineTo(seg.to.x, seg.to.y)
    ctx.stroke()
  })

  // Стрілки вздовж сегментів
  const AS = arrowSize * invScale, STEP = arrowStep * invScale
  let nextArrow = STEP * 0.5, walked = 0
  segments.forEach(seg => {
    const dx = seg.to.x - seg.from.x
    const dy = seg.to.y - seg.from.y
    const segLen = Math.hypot(dx, dy)
    if (segLen < 1) { walked += segLen; return }
    const angle = Math.atan2(dy, dx)
    while (nextArrow <= walked + segLen) {
      const t = (nextArrow - walked) / segLen
      const ax = seg.from.x + dx * t, ay = seg.from.y + dy * t
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(angle)
      ctx.fillStyle = color; ctx.beginPath()
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
    ctx.fillStyle = color; ctx.beginPath()
    ctx.arc(path[0].x, path[0].y, 4 * invScale, 0, Math.PI * 2); ctx.fill()
  }
}

// ═══════════════════════════════════════════════════════════════
//  РЕНДЕР
// ═══════════════════════════════════════════════════════════════

export default function useRender(canvasRef) {
  const {
    walls, doors, exits, stairs, extinguishers,
    detectedRooms, graphNodes, graphEdges,
    currentPath, multiFloorPath, allPaths, evacuationView, tool, selectedRoomId, viewMode,
    mode, currentFloorId, blockedExits, blockedDoors,
    multiRoomPaths, showEdgeWeights, selectedRoomIds,
  } = useStore()

  const render = (drawing, drawStart, mousePos, scale = 1, offset = { x: 0, y: 0 }) => {
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

    // ══════════════════════════════════════════════════════════
    //  ГРАФ (advanced only)
    // ══════════════════════════════════════════════════════════
    if (isAdvanced) {
      const pathIds = (multiFloorPath?.find(s => s.floorId === currentFloorId)?.path ?? currentPath ?? []).map(n => n.id)

      graphEdges.forEach(edge => {
        const a = graphNodes.find(n => n.id === edge.from)
        const b = graphNodes.find(n => n.id === edge.to)
        if (!a || !b) return
        const onPath = pathIds.includes(a.id) && pathIds.includes(b.id)
          && Math.abs(pathIds.indexOf(a.id) - pathIds.indexOf(b.id)) === 1

        ctx.strokeStyle = onPath ? '#10b981' : '#bfdbfe'
        ctx.lineWidth = (onPath ? 2.5 : 1) * invScale
        ctx.setLineDash(onPath ? [6 * invScale, 3 * invScale] : [3 * invScale, 3 * invScale])
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        ctx.setLineDash([])

        // Ваги ребер: завжди для onPath, або для всіх якщо showEdgeWeights
        if (onPath || showEdgeWeights) {
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
          const meters = (Math.hypot(b.x - a.x, b.y - a.y) / GRID * METER).toFixed(1)
          ctx.fillStyle = onPath ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.82)'
          ctx.beginPath()
          ctx.roundRect(mx - 14 * invScale, my - 7 * invScale, 28 * invScale, 14 * invScale, 2 * invScale)
          ctx.fill()
          ctx.fillStyle = onPath ? '#10b981' : '#94a3b8'
          ctx.font = `${8 * invScale}px JetBrains Mono, monospace`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(`${meters}м`, mx, my)
        }
      })

      graphNodes.forEach(node => {
        const onPath = pathIds.includes(node.id)
        const color = node.isExit ? '#ef4444'
          : node.isStair ? '#f59e0b'
            : node.isDoor ? '#94a3b8'
              : onPath ? '#10b981'
                : '#3b82f6'

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

    if (isSimple) {
      if (evacuationView === 'single' && activePath && activePath.length > 1)
        drawEvacPath(ctx, activePath, invScale, { color: '#009944' })
      if (evacuationView === 'all' && allPaths.length > 0)
        allPaths.forEach((p, i) => { if (p && p.length > 1) drawEvacPath(ctx, p, invScale, { color: MULTI_COLORS[i % MULTI_COLORS.length] }) })
    }
    if (isAdvanced) {
      if (activePath && activePath.length > 1)
        drawEvacPath(ctx, activePath, invScale, { color: '#10b981', lineWidth: 2.5 })
      if (evacuationView === 'all' && allPaths.length > 0)
        allPaths.forEach((p, i) => { if (p && p.length > 1) drawEvacPath(ctx, p, invScale, { color: MULTI_COLORS[i % MULTI_COLORS.length] + 'cc', lineWidth: 2 }) })
    }

    // ── Мульти-кімнатні маршрути (обидва режими) ───────────────
    if (evacuationView === 'multi' && multiRoomPaths) {
      Object.entries(multiRoomPaths).forEach(([, entry]) => {
        if (entry.path && entry.path.length > 1)
          drawEvacPath(ctx, entry.path, invScale, { color: entry.color, lineWidth: isAdvanced ? 2.5 : 3 })
      })
    }

    // ══════════════════════════════════════════════════════════
    //  СТІНИ
    // ══════════════════════════════════════════════════════════
    const wallThickness = isSimple ? 3 : 5
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
    //  ДВЕРІ
    // ══════════════════════════════════════════════════════════
    doors.forEach((door, doorIdx) => {
      const r = GRID * 0.9
      const isBlocked = blockedDoors.includes(doorIdx)

      // Прорізання стіни
      ctx.strokeStyle = isSimple ? '#ffffff' : '#f8fafc'
      ctx.lineWidth = (wallThickness + 4) * invScale
      ctx.lineCap = 'butt'
      if (door.horiz) {
        ctx.beginPath(); ctx.moveTo(door.x - r, door.y); ctx.lineTo(door.x + r, door.y); ctx.stroke()
      } else {
        ctx.beginPath(); ctx.moveTo(door.x, door.y - r); ctx.lineTo(door.x, door.y + r); ctx.stroke()
      }

      ctx.setLineDash([])
      ctx.lineCap = 'round'

      if (isBlocked) {
        // Заблоковані двері — діагональна штриховка (стандарт на планах евакуації)
        const hs = GRID * 0.75
        ctx.save()
        ctx.beginPath()
        ctx.rect(door.x - hs, door.y - hs, hs * 2, hs * 2)
        ctx.clip()
        ctx.fillStyle = 'rgba(239,68,68,0.08)'
        ctx.fillRect(door.x - hs, door.y - hs, hs * 2, hs * 2)
        ctx.strokeStyle = 'rgba(239,68,68,0.55)'
        ctx.lineWidth = 1.2 * invScale
        ctx.setLineDash([])
        const step = 6 * invScale
        for (let k = -4; k <= 4; k++) {
          const offset2 = k * step
          ctx.beginPath()
          ctx.moveTo(door.x - hs, door.y + offset2)
          ctx.lineTo(door.x + offset2, door.y - hs)
          ctx.moveTo(door.x + offset2, door.y + hs)
          ctx.lineTo(door.x + hs, door.y + offset2)
          ctx.stroke()
        }
        ctx.restore()
        // Червона рамка
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 1.5 * invScale
        ctx.strokeRect(door.x - hs, door.y - hs, hs * 2, hs * 2)
      } else if (isSimple) {
        ctx.strokeStyle = '#b0b8c4'
        ctx.lineWidth = 0.8 * invScale
        if (door.horiz) {
          ctx.beginPath(); ctx.arc(door.x - r, door.y, r, 0, Math.PI / 2); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(door.x - r, door.y); ctx.lineTo(door.x - r, door.y - r); ctx.stroke()
        } else {
          ctx.beginPath(); ctx.arc(door.x, door.y - r, r, Math.PI / 2, Math.PI); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(door.x, door.y - r); ctx.lineTo(door.x + r, door.y - r); ctx.stroke()
        }
      } else {
        // Advanced — синя дуга + точка петлі
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1.5 * invScale
        if (door.horiz) {
          ctx.beginPath(); ctx.arc(door.x - r, door.y, r, 0, Math.PI / 2); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(door.x - r, door.y); ctx.lineTo(door.x - r, door.y - r); ctx.stroke()
          ctx.fillStyle = '#3b82f6'
          ctx.beginPath(); ctx.arc(door.x - r, door.y, 3 * invScale, 0, Math.PI * 2); ctx.fill()
        } else {
          ctx.beginPath(); ctx.arc(door.x, door.y - r, r, Math.PI / 2, Math.PI); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(door.x, door.y - r); ctx.lineTo(door.x + r, door.y - r); ctx.stroke()
          ctx.fillStyle = '#3b82f6'
          ctx.beginPath(); ctx.arc(door.x, door.y - r, 3 * invScale, 0, Math.PI * 2); ctx.fill()
        }
      }
    })

    // ══════════════════════════════════════════════════════════
    //  ВИХОДИ
    // ══════════════════════════════════════════════════════════
    exits.forEach((exit, exitIdx) => {
      const hw = GRID * 0.9
      const isBlocked = blockedExits.includes(exitIdx)

      // Прорізання стіни
      ctx.strokeStyle = isSimple ? '#ffffff' : '#f8fafc'
      ctx.lineWidth = (wallThickness + 4) * invScale
      ctx.lineCap = 'butt'
      if (exit.horiz) {
        ctx.beginPath(); ctx.moveTo(exit.x - hw, exit.y); ctx.lineTo(exit.x + hw, exit.y); ctx.stroke()
      } else {
        ctx.beginPath(); ctx.moveTo(exit.x, exit.y - hw); ctx.lineTo(exit.x, exit.y + hw); ctx.stroke()
      }

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
        ctx.strokeStyle = '#00a651'; ctx.lineWidth = 2.5 * invScale
        if (exit.horiz) {
          ctx.beginPath(); ctx.moveTo(exit.x - hw, exit.y); ctx.lineTo(exit.x + hw, exit.y); ctx.stroke()
        } else {
          ctx.beginPath(); ctx.moveTo(exit.x, exit.y - hw); ctx.lineTo(exit.x, exit.y + hw); ctx.stroke()
        }
        const text = `${exit.label || 'EXIT'} ↑`
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
    stairs.forEach(stair => {
      if (isSimple) {
        // Класичний архітектурний символ
        ctx.strokeStyle = '#374151'; ctx.lineWidth = 1 * invScale
        const w = GRID * 0.8, h = GRID * 1.2
        ctx.strokeRect(stair.x - w / 2, stair.y - h / 2, w, h)
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath()
          ctx.moveTo(stair.x - w / 2 + 2 * invScale, stair.y + i * (h / 6))
          ctx.lineTo(stair.x + w / 2 - 2 * invScale, stair.y + i * (h / 6))
          ctx.stroke()
        }
      } else {
        // Advanced — amber rounded box
        const w = GRID * 0.82, h = GRID * 1.25
        ctx.fillStyle = '#fef3c7'; ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5 * invScale
        ctx.beginPath(); ctx.roundRect(stair.x - w / 2, stair.y - h / 2, w, h, 3 * invScale); ctx.fill(); ctx.stroke()
        ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1 * invScale
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath()
          ctx.moveTo(stair.x - w / 2 + 4 * invScale, stair.y + i * (h / 6))
          ctx.lineTo(stair.x + w / 2 - 4 * invScale, stair.y + i * (h / 6))
          ctx.stroke()
        }
        ctx.fillStyle = '#92400e'; ctx.font = `bold ${8 * invScale}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('↕', stair.x, stair.y)
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
        const fs = Math.max(10, 11 * invScale)
        ctx.font = `${fs}px Arial, sans-serif`
        ctx.fillStyle = '#374151'
        ctx.fillText(room.label, room.cx, room.cy)
      } else {
        // Advanced — pill з назвою + площею
        const nameSize = Math.max(10, 12 * invScale)
        const areaSize = Math.max(8, 9 * invScale)

        ctx.font = `600 ${nameSize}px Manrope, Arial, sans-serif`
        const nameW = ctx.measureText(room.label).width
        ctx.font = `${areaSize}px JetBrains Mono, monospace`
        const areaW = ctx.measureText(`${room.areaM2}м²`).width
        const pillW = Math.max(nameW, areaW) + 14 * invScale
        const pillH = nameSize + areaSize + 10 * invScale

        ctx.fillStyle = isSelected ? 'rgba(255,68,34,0.10)' : 'rgba(255,255,255,0.88)'
        ctx.strokeStyle = isSelected ? 'rgba(255,68,34,0.35)' : ROOM_STROKES[i % ROOM_STROKES.length]
        ctx.lineWidth = 1 * invScale
        ctx.beginPath()
        ctx.roundRect(room.cx - pillW / 2, room.cy - pillH / 2, pillW, pillH, 5 * invScale)
        ctx.fill(); ctx.stroke()

        ctx.font = `600 ${nameSize}px Manrope, Arial, sans-serif`
        ctx.fillStyle = isSelected ? '#ff4422' : '#1e293b'
        ctx.fillText(room.label, room.cx, room.cy - areaSize / 2 - 2 * invScale)

        ctx.font = `${areaSize}px JetBrains Mono, monospace`
        ctx.fillStyle = isSelected ? '#ff7755' : '#94a3b8'
        ctx.fillText(`${room.areaM2}м²`, room.cx, room.cy + nameSize / 2 + 1 * invScale)
      }
    })

    // ══════════════════════════════════════════════════════════
    //  PREVIEW МАЛЮВАННЯ
    // ══════════════════════════════════════════════════════════
    if (mode === 'constructor' && drawing && drawStart) {
      ctx.strokeStyle = '#ff442250'
      ctx.lineWidth = 2 * invScale
      ctx.setLineDash([6 * invScale, 4 * invScale])
      ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(drawStart.x, drawStart.y); ctx.lineTo(mousePos.x, mousePos.y); ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = '#ff4422'
      ctx.beginPath(); ctx.arc(drawStart.x, drawStart.y, 4 * invScale, 0, Math.PI * 2); ctx.fill()

      const dist = Math.hypot(mousePos.x - drawStart.x, mousePos.y - drawStart.y)
      const meters = ((dist / GRID) * METER).toFixed(1)
      const mx = (drawStart.x + mousePos.x) / 2, my = (drawStart.y + mousePos.y) / 2
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = '#ff442230'; ctx.lineWidth = 1 * invScale
      ctx.beginPath(); ctx.roundRect(mx - 18 * invScale, my - 8 * invScale, 36 * invScale, 16 * invScale, 3 * invScale); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#ff4422'; ctx.font = `bold ${9 * invScale}px JetBrains Mono, monospace`
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
