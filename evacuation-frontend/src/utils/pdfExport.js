import jsPDF from 'jspdf'

const GRID = 20
const METER = 0.5

// ═══════════════════════════════════════════════════════════════
//  ЕВАКУАЦІЙНІ МАРШРУТИ (canvas helpers)
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

function drawEvacPath(ctx, fullPath, invScale, opts = {}) {
  if (!fullPath || fullPath.length < 2) return
  const { color = '#009944', lineWidth = 3, arrowSize = 10, arrowStep = 45 } = opts

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

  const segments = []
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]
    segments.push({
      from: (a.isDoor || a.isExit) ? wallOffset(a, b) : { x: a.x, y: a.y },
      to:   (b.isDoor || b.isExit) ? wallOffset(b, a) : { x: b.x, y: b.y },
    })
  }

  ctx.strokeStyle = color; ctx.lineWidth = lineWidth * invScale
  ctx.setLineDash([]); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  segments.forEach(seg => {
    if (Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y) < 1) return
    ctx.beginPath()
    ctx.moveTo(seg.from.x, seg.from.y)
    ctx.lineTo(seg.to.x, seg.to.y)
    ctx.stroke()
  })

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
      ctx.moveTo(AS, 0); ctx.lineTo(-AS*0.5, -AS*0.6); ctx.lineTo(-AS*0.5, AS*0.6)
      ctx.closePath(); ctx.fill(); ctx.restore()
      nextArrow += STEP
    }
    walked += segLen
  })

  if (last.isFloorChange) {
    drawFloorChangeBadge(ctx, last, invScale, color)
  } else if (last.isExit) {
    ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 * invScale
    ctx.beginPath(); ctx.arc(last.x, last.y, 10 * invScale, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${9 * invScale}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('▲', last.x, last.y - 0.5 * invScale)
  }

  ctx.fillStyle = color; ctx.beginPath()
  ctx.arc(path[0].x, path[0].y, 4 * invScale, 0, Math.PI * 2); ctx.fill()
}

// ═══════════════════════════════════════════════════════════════
//  РЕНДЕР ПОВЕРХУ (чистий план без оформлення)
// ═══════════════════════════════════════════════════════════════

function drawFloorOnCanvas(canvas, floorData, scale, offset, evacData) {
  const {
    walls = [], doors = [], exits = [], stairs = [],
    extinguishers = [], detectedRooms = [],
  } = floorData

  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  const invScale = 1 / scale
  const wallThickness = 3

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  ctx.translate(offset.x, offset.y)
  ctx.scale(scale, scale)

  // ── Евакуаційні маршрути ──────────────────────────────────
  if (evacData) {
    const { currentPath, allPaths, evacuationView, multiFloorPath, currentFloorId } = evacData
    const activePath = multiFloorPath
      ? (multiFloorPath.find(s => s.floorId === currentFloorId)?.path ?? null)
      : currentPath
    if (evacuationView === 'single' && activePath && activePath.length > 1)
      drawEvacPath(ctx, activePath, invScale, { color: '#009944' })
    if (evacuationView === 'all' && allPaths && allPaths.length > 0)
      allPaths.forEach(path => { if (path && path.length > 1) drawEvacPath(ctx, path, invScale, { color: '#009944' }) })
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
    ctx.strokeStyle = '#374151'; ctx.lineWidth = 1 * invScale
    const w = GRID * 0.8, h = GRID * 1.2
    ctx.strokeRect(stair.x - w / 2, stair.y - h / 2, w, h)
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(stair.x - w / 2 + 2 * invScale, stair.y + i * (h / 6))
      ctx.lineTo(stair.x + w / 2 - 2 * invScale, stair.y + i * (h / 6))
      ctx.stroke()
    }
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
    const fontSize = Math.max(10, 11 * invScale)
    ctx.font = `${fontSize}px Arial, sans-serif`
    ctx.fillStyle = '#374151'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(room.label, room.cx, room.cy)
  })

  ctx.restore()
}

// ── Будує offscreen canvas тільки з планом ────────────────────
function buildFloorCanvas(floorData, evacData) {
  const { walls = [], doors = [], exits = [], stairs = [], extinguishers = [] } = floorData

  const OUTPUT_W = 1400, OUTPUT_H = 990
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_W; canvas.height = OUTPUT_H

  const points = [
    ...walls.flatMap(w => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]),
    ...doors.map(d => ({ x: d.x, y: d.y })),
    ...exits.map(e => ({ x: e.x, y: e.y })),
    ...stairs.map(s => ({ x: s.x, y: s.y })),
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

  return canvas
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function getFloorData(floor, floorDataMap, currentFloorId, currentFloorData) {
  return floor.id === currentFloorId
    ? currentFloorData
    : (floorDataMap[floor.id] || { walls: [], doors: [], exits: [], stairs: [], extinguishers: [] })
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
    const canvas = buildFloorCanvas(data, evacData)
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageH)
  })

  pdf.save(`${planName}.pdf`)
}

export function exportAllFloorsToPNG(planName, floors, floorDataMap, currentFloorId, currentFloorData, routeData) {
  floors.forEach((floor, i) => {
    setTimeout(() => {
      const data = getFloorData(floor, floorDataMap, currentFloorId, currentFloorData)
      const evacData = floor.id === currentFloorId ? routeData : null
      const canvas = buildFloorCanvas(data, evacData)
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
    floorData || { walls: [], doors: [], exits: [], stairs: [], extinguishers: [] },
    null, planName, floorName
  )
  pdf.addImage(docCanvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210)
  pdf.save(`${planName}_${floorName}.pdf`)
}
