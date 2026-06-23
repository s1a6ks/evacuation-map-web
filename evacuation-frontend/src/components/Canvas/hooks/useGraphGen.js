import { useEffect } from 'react'
import useStore from '../../../store/useStore'

const GRID = 20
const roomCellIndexCache = new WeakMap()
const graphCache = new Map()

function getRoomCellIndex(detectedRooms) {
  const cached = roomCellIndexCache.get(detectedRooms)
  if (cached) return cached

  const index = new Map()
  detectedRooms.forEach(room => {
    room.cells.forEach(([row, col]) => {
      index.set(`${row},${col}`, room)
    })
  })
  roomCellIndexCache.set(detectedRooms, index)
  return index
}

function graphSignature(detectedRooms, doors, exits, stairs, walls) {
  const roomPart = detectedRooms.map(room =>
    `${room.id}:${Math.round(room.cx)},${Math.round(room.cy)}:${room.cells.length}`
  ).join('|')
  const doorPart = doors.map(item => `${item.x},${item.y},${item.angle ?? ''}`).join('|')
  const exitPart = exits.map(item => `${item.x},${item.y},${item.angle ?? ''}`).join('|')
  const stairPart = stairs.map(item => `${item.x},${item.y},${item.width ?? ''},${item.height ?? ''},${item.angle ?? ''},${item.direction ?? ''}`).join('|')
  const wallPart = walls.map(item => `${item.x1},${item.y1},${item.x2},${item.y2}`).join('|')
  return `${roomPart}#${doorPart}#${exitPart}#${stairPart}#${wallPart}`
}

// ── Знайти кімнату за клітинкою (row, col) ──────────────────
function findRoomAtCell(detectedRooms, col, row) {
  return getRoomCellIndex(detectedRooms).get(`${row},${col}`) ?? null
}

function roomsAtPoint(detectedRooms, point) {
  const candidates = [
    { col: Math.floor(point.x / GRID), row: Math.floor(point.y / GRID) },
    { col: Math.round(point.x / GRID), row: Math.round(point.y / GRID) },
    { col: Math.ceil(point.x / GRID), row: Math.ceil(point.y / GRID) },
  ]

  return candidates
    .map(candidate => findRoomAtCell(detectedRooms, candidate.col, candidate.row))
    .filter(Boolean)
}

// ── Два сусідні регіони по обидва боки від двері/виходу ─────
function getWallAngle(item) {
  if (Number.isFinite(item.angle)) return item.angle
  return item.horiz ? 0 : Math.PI / 2
}

function getAdjacentRooms(item, detectedRooms) {
  const angle = getWallAngle(item)
  const normalX = -Math.sin(angle)
  const normalY = Math.cos(angle)
  const tangentX = Math.cos(angle)
  const tangentY = Math.sin(angle)
  const samples = []

  ;[-1, 1].forEach(side => {
    ;[0.65, 1.05, 1.45].forEach(distMul => {
      ;[-0.35, 0, 0.35].forEach(tangentMul => {
        samples.push({
          x: item.x + normalX * GRID * distMul * side + tangentX * GRID * tangentMul,
          y: item.y + normalY * GRID * distMul * side + tangentY * GRID * tangentMul,
        })
      })
    })
  })

  const rooms = samples.flatMap(point => roomsAtPoint(detectedRooms, point))

  return [...new Map(rooms.map(room => [room.id, room])).values()]
}

function getRoomContainingPoint(point, detectedRooms) {
  const candidates = [
    { col: Math.floor(point.x / GRID), row: Math.floor(point.y / GRID) },
    { col: Math.round(point.x / GRID), row: Math.round(point.y / GRID) },
  ]

  for (const candidate of candidates) {
    const room = findRoomAtCell(detectedRooms, candidate.col, candidate.row)
    if (room) return room
  }

  return null
}

// ── Найближчий вузол ─────────────────────────────────────────
function nearestNode(nodes, x, y, maxDist = Infinity) {
  let best = null, bestD = maxDist
  nodes.forEach(n => {
    const d = Math.hypot(n.x - x, n.y - y)
    if (d < bestD) { bestD = d; best = n }
  })
  return best
}

function nearestRoomCell(room, point) {
  let best = null
  let bestD = Infinity
  room.cells.forEach(([row, col]) => {
    const x = col * GRID + GRID / 2
    const y = row * GRID + GRID / 2
    const d = Math.hypot(point.x - x, point.y - y)
    if (d < bestD) {
      bestD = d
      best = { row, col }
    }
  })
  return best
}

function cellKey(cell) {
  return `${cell.row},${cell.col}`
}

function pointToSegmentDistance(point, segment) {
  const ax = segment.x1, ay = segment.y1
  const bx = segment.x2, by = segment.y2
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(point.x - ax, point.y - ay)

  const t = Math.max(0, Math.min(1, ((point.x - ax) * dx + (point.y - ay) * dy) / len2))
  const x = ax + dx * t
  const y = ay + dy * t
  return Math.hypot(point.x - x, point.y - y)
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)
  if (Math.abs(value) < 0.001) return 0
  return value > 0 ? 1 : 2
}

function onSegment(a, b, c) {
  return (
    b.x <= Math.max(a.x, c.x) + 0.001 &&
    b.x + 0.001 >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) + 0.001 &&
    b.y + 0.001 >= Math.min(a.y, c.y)
  )
}

function segmentsIntersect(a, b, wall) {
  const c = { x: wall.x1, y: wall.y1 }
  const d = { x: wall.x2, y: wall.y2 }
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)

  if (o1 !== o2 && o3 !== o4) return true
  if (o1 === 0 && onSegment(a, c, b)) return true
  if (o2 === 0 && onSegment(a, d, b)) return true
  if (o3 === 0 && onSegment(c, a, d)) return true
  if (o4 === 0 && onSegment(c, b, d)) return true
  return false
}

function segmentIntersectionPoint(a, b, wall) {
  const c = { x: wall.x1, y: wall.y1 }
  const d = { x: wall.x2, y: wall.y2 }
  const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x)

  if (Math.abs(den) < 0.001) {
    const points = [a, b, c, d].filter(point =>
      pointToSegmentDistance(point, wall) < 1 &&
      pointToSegmentDistance(point, { x1: a.x, y1: a.y, x2: b.x, y2: b.y }) < 1
    )
    return points[0] ?? null
  }

  return {
    x: ((a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x)) / den,
    y: ((a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x)) / den,
  }
}

function isNearPortalOpening(point, wall, portals, radius = GRID * 0.85) {
  return portals.some(portal =>
    Math.hypot(point.x - portal.x, point.y - portal.y) <= radius &&
    pointToSegmentDistance(portal, wall) <= GRID * 0.2
  )
}

function segmentTouchesWall(a, b, wall, portals = []) {
  if (segmentsIntersect(a, b, wall)) {
    const point = segmentIntersectionPoint(a, b, wall)
    if (!point || !isNearPortalOpening(point, wall, portals)) return true
  }

  const samples = 6
  for (let i = 1; i < samples; i++) {
    const t = i / samples
    const point = {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    }
    if (pointToSegmentDistance(point, wall) < 2 && !isNearPortalOpening(point, wall, portals)) return true
  }

  return false
}

function hasClearLine(a, b, walls, clearance = GRID * 0.45, portals = []) {
  const samples = Math.max(4, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (GRID / 2)))

  return !walls.some(wall => {
    if (segmentTouchesWall(a, b, wall, portals)) return true

    for (let i = 1; i < samples; i++) {
      const t = i / samples
      const point = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      }
      if (pointToSegmentDistance(point, wall) < clearance && !isNearPortalOpening(point, wall, portals)) return true
    }

    return false
  })
}

function wallPenalty(point, walls) {
  if (walls.length === 0) return 0
  const minDist = Math.min(...walls.map(wall => pointToSegmentDistance(point, wall)))
  const comfortable = GRID * 1.2
  return Math.max(0, comfortable - minDist) * 0.45
}

function simplifyPolyline(points) {
  if (points.length <= 2) return points
  const withoutTinySteps = [points[0]]

  for (let i = 1; i < points.length; i++) {
    const prev = withoutTinySteps[withoutTinySteps.length - 1]
    const current = points[i]
    if (Math.hypot(current.x - prev.x, current.y - prev.y) >= GRID * 0.35 || i === points.length - 1) {
      withoutTinySteps.push(current)
    }
  }

  const simplified = [withoutTinySteps[0]]

  for (let i = 1; i < withoutTinySteps.length - 1; i++) {
    const prev = simplified[simplified.length - 1]
    const current = withoutTinySteps[i]
    const next = withoutTinySteps[i + 1]
    const dx1 = Math.sign(current.x - prev.x)
    const dy1 = Math.sign(current.y - prev.y)
    const dx2 = Math.sign(next.x - current.x)
    const dy2 = Math.sign(next.y - current.y)
    if (dx1 !== dx2 || dy1 !== dy2) simplified.push(current)
  }

  simplified.push(withoutTinySteps[withoutTinySteps.length - 1])
  return simplified
}

function polylineLength(points) {
  let length = 0
  for (let i = 0; i < points.length - 1; i++) {
    length += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y)
  }
  return length
}

function isAxisAligned(a, b) {
  return Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1
}

function chooseOrthogonalCorner(a, b, walls, portals) {
  if (isAxisAligned(a, b)) return null

  const corners = [
    { x: b.x, y: a.y },
    { x: a.x, y: b.y },
  ]

  return corners
    .filter(corner =>
      hasClearLine(a, corner, walls, GRID * 0.45, portals) &&
      hasClearLine(corner, b, walls, GRID * 0.45, portals)
    )
    .sort((left, right) => wallPenalty(left, walls) - wallPenalty(right, walls))[0] ?? null
}

function orthogonalizePath(points, walls, portals = []) {
  if (points.length <= 1) return points

  const result = [points[0]]
  for (let i = 0; i < points.length - 1; i++) {
    const from = result[result.length - 1]
    const to = points[i + 1]
    const corner = chooseOrthogonalCorner(from, to, walls, portals)
    if (corner) result.push(corner)
    result.push(to)
  }

  return simplifyPolyline(result)
}

function trimPortalCellHooks(points, walls, portals = []) {
  if (points.length <= 3) return points

  const result = [...points]
  const maxHook = GRID * 1.15

  function canSkip(indexBefore, indexAfter) {
    return hasClearLine(result[indexBefore], result[indexAfter], walls, GRID * 0.45, portals)
  }

  while (
    result.length > 3 &&
    Math.hypot(result[1].x - result[0].x, result[1].y - result[0].y) <= maxHook &&
    canSkip(0, 2)
  ) {
    result.splice(1, 1)
  }

  while (
    result.length > 3 &&
    Math.hypot(
      result[result.length - 2].x - result[result.length - 1].x,
      result[result.length - 2].y - result[result.length - 1].y
    ) <= maxHook &&
    canSkip(result.length - 3, result.length - 1)
  ) {
    result.splice(result.length - 2, 1)
  }

  return result
}

function cellCenter(cell) {
  return {
    x: cell.col * GRID + GRID / 2,
    y: cell.row * GRID + GRID / 2,
  }
}

function buildRoomPath(room, from, to, walls = []) {
  if (!room?.cells?.length) return null

  const start = nearestRoomCell(room, from)
  const finish = nearestRoomCell(room, to)
  if (!start || !finish) return null

  const startPoint = cellCenter(start)
  const finishPoint = cellCenter(finish)
  const portals = [{ x: from.x, y: from.y }, { x: to.x, y: to.y }]

  if (hasClearLine(from, to, walls, GRID * 0.45, portals)) {
    return orthogonalizePath([{ x: from.x, y: from.y }, { x: to.x, y: to.y }], walls, portals)
  }

  if (hasClearLine(startPoint, finishPoint, walls, GRID * 0.45, portals)) {
    return trimPortalCellHooks(orthogonalizePath([
      { x: from.x, y: from.y },
      startPoint,
      finishPoint,
      { x: to.x, y: to.y },
    ], walls, portals), walls, portals)
  }

  const allowed = new Set(room.cells.map(([row, col]) => `${row},${col}`))
  const open = [{ cell: start, score: 0 }]
  const bestCost = new Map([[cellKey(start), 0]])
  const prev = new Map()
  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ]

  while (open.length > 0) {
    open.sort((a, b) => a.score - b.score)
    const { cell } = open.shift()
    if (cell.row === finish.row && cell.col === finish.col) break

    directions.forEach(direction => {
      const next = { row: cell.row + direction.row, col: cell.col + direction.col }
      const key = cellKey(next)
      if (!allowed.has(key)) return

      const fromPoint = cellCenter(cell)
      const toPoint = cellCenter(next)
      if (!hasClearLine(fromPoint, toPoint, walls, GRID * 0.2, portals)) return

      const moveCost = Math.hypot(direction.row, direction.col) * GRID + wallPenalty(toPoint, walls)
      const nextCost = (bestCost.get(cellKey(cell)) ?? Infinity) + moveCost
      if (nextCost >= (bestCost.get(key) ?? Infinity)) return

      bestCost.set(key, nextCost)
      prev.set(key, cell)
      const heuristic = Math.hypot(finish.row - next.row, finish.col - next.col) * GRID
      open.push({ cell: next, score: nextCost + heuristic })
    })
  }

  if (!bestCost.has(cellKey(finish))) return null

  const cells = []
  let current = finish
  while (current) {
    cells.unshift(current)
    if (current.row === start.row && current.col === start.col) break
    current = prev.get(cellKey(current))
  }

  const points = [
    { x: from.x, y: from.y },
    ...cells.map(cellCenter),
    { x: to.x, y: to.y },
  ]

  return trimPortalCellHooks(orthogonalizePath(points, walls, portals), walls, portals)
}

// ── Генерація графа ──────────────────────────────────────────
//
// Структура:
//   roomNode  = центроїд кімнати (для маршрутів "з кімнати")
//   doorNode  = точка на дверях (транзит)
//   exitNode  = точка виходу
//
// Ребра:
//   roomNode ↔ кожен doorNode цієї кімнати   (старт маршруту)
//   doorNode ↔ doorNode в межах кімнати       (транзит door-to-door)
//   exitNode ↔ doorNode / roomNode            (фінал маршруту)
//
export function generateGraph(detectedRooms, doors, exits, stairs, walls = []) {
  const nodes = []
  const edges = []
  let uid = 1

  // Хелпер: додати ребро (уникаємо дублів)
  const edgeSet = new Set()
  function addEdge(fromId, toId, roomId = null) {
    const key = `${Math.min(fromId, toId)}-${Math.max(fromId, toId)}`
    if (edgeSet.has(key)) return
    const a = nodes.find(n => n.id === fromId)
    const b = nodes.find(n => n.id === toId)
    if (!a || !b) return
    const room = roomId ? detectedRooms.find(r => r.id === roomId) : null
    const points = room ? buildRoomPath(room, a, b, walls) : null

    if (room && (!points || points.length < 2)) return
    if (!room && !hasClearLine(a, b, walls, GRID * 0.45, [...doors, ...exits, ...stairs])) return

    edgeSet.add(key)
    const length = points?.length > 1 ? polylineLength(points) : Math.hypot(b.x - a.x, b.y - a.y)
    edges.push({ id: uid++, from: fromId, to: toId, length, points: points ?? null })
  }

  // ── 1. Вузол-центроїд для кожної кімнати ─────────────────
  const roomNodeMap = new Map()  // roomId → node

  detectedRooms.forEach(room => {
    const node = {
      id: uid++,
      x: Math.round(room.cx),
      y: Math.round(room.cy),
      isExit: false,
      isStair: false,
      roomId: room.id,
    }
    nodes.push(node)
    roomNodeMap.set(room.id, node)
  })

  // ── 2. Двері — проміжні вузли ─────────────────────────────
  // Для кожних дверей зберігаємо які кімнати вони з'єднують
  const roomDoorNodes = new Map()  // roomId → [doorNode, doorNode, ...]

  doors.forEach(door => {
    const doorNode = {
      id: uid++,
      x: door.x,
      y: door.y,
      isExit: false,
      isStair: false,
      isDoor: true,
    }
    nodes.push(doorNode)

    const adjacent = getAdjacentRooms(door, detectedRooms)

    // Реєструємо doorNode для кожної суміжної кімнати
    adjacent.forEach(room => {
      if (!roomDoorNodes.has(room.id)) roomDoorNodes.set(room.id, [])
      roomDoorNodes.get(room.id).push(doorNode)

      // З'єднуємо центроїд кімнати з дверима
      const roomNode = roomNodeMap.get(room.id)
      if (roomNode) addEdge(roomNode.id, doorNode.id, room.id)
    })
  })

  // ── 3. Door-to-door в межах кімнати ───────────────────────
  //    Це ключова зміна: якщо кімната має кілька дверей,
  //    з'єднуємо їх між собою напряму.
  //    Маршрут "транзитом" через кімнату піде door→door,
  //    без заходу в центроїд.
  stairs.forEach(stair => {
    const stairNode = {
      id: uid++,
      x: stair.x,
      y: stair.y,
      width: stair.width,
      height: stair.height,
      angle: stair.angle,
      direction: stair.direction,
      isExit: false,
      isStair: true,
    }
    nodes.push(stairNode)

    const roomAtStair = getRoomContainingPoint(stair, detectedRooms)
    const adjacent = roomAtStair ? [roomAtStair] : getAdjacentRooms(stair, detectedRooms)
    adjacent.forEach(room => {
      if (!roomDoorNodes.has(room.id)) roomDoorNodes.set(room.id, [])
      roomDoorNodes.get(room.id).push(stairNode)

      const roomNode = roomNodeMap.get(room.id)
      if (roomNode) addEdge(roomNode.id, stairNode.id, room.id)
    })

    if (adjacent.length === 0) {
      const nearest = nearestNode([...roomNodeMap.values()], stairNode.x, stairNode.y, 300)
      if (nearest) addEdge(nearest.id, stairNode.id, nearest.roomId)
    }
  })

  roomDoorNodes.forEach((doorNodes, roomId) => {
    for (let i = 0; i < doorNodes.length; i++) {
      for (let j = i + 1; j < doorNodes.length; j++) {
        addEdge(doorNodes[i].id, doorNodes[j].id, roomId)
      }
    }
  })

  // ── 4. Виходи ─────────────────────────────────────────────
  const exitNodesList = []
  exits.forEach(exit => {
    const exitNode = {
      id: uid++,
      x: exit.x,
      y: exit.y,
      isExit: true,
      isStair: false,
    }
    nodes.push(exitNode)
    exitNodesList.push(exitNode)

    const adjacent = getAdjacentRooms(exit, detectedRooms)

    adjacent.forEach(room => {
      // Реєструємо exit як "двері" для door-to-door транзиту
      if (!roomDoorNodes.has(room.id)) roomDoorNodes.set(room.id, [])
      const roomDoors = roomDoorNodes.get(room.id)

      // З'єднуємо exit з усіма дверима цієї кімнати (door-to-exit)
      roomDoors.forEach(dn => addEdge(dn.id, exitNode.id, room.id))

      // З'єднуємо exit з центроїдом
      const roomNode = roomNodeMap.get(room.id)
      if (roomNode) addEdge(roomNode.id, exitNode.id, room.id)

      // Додаємо exit до списку "дверей" кімнати
      roomDoors.push(exitNode)
    })

    // Якщо exit не біля жодної кімнати — fallback
    if (adjacent.length === 0) {
      const nearest = nearestNode([...roomNodeMap.values()], exitNode.x, exitNode.y, 300)
      if (nearest) addEdge(nearest.id, exitNode.id, nearest.roomId)
    }
  })

  // ── 6. Зв'язність: висячі транзитні вузли ────────────────
  const allTransitNodes = nodes.filter(n => n.isDoor || n.isExit || n.isStair)

  function getEdgeCount(nodeId) {
    return edges.filter(e => e.from === nodeId || e.to === nodeId).length
  }

  // Fallback лише для повністю ізольованих транзитних вузлів —
  // з'єднуємо тільки з найближчим room-centroid (не з іншими door/exit через стіну)
  const roomNodeValues = [...roomNodeMap.values()]
  allTransitNodes.forEach(node => {
    if (getEdgeCount(node.id) === 0) {
      const nearest = nearestNode(roomNodeValues, node.x, node.y, 200)
      if (nearest) addEdge(node.id, nearest.id, nearest.roomId)
    }
  })

  // ── 7. Ізольовані кімнати ─────────────────────────────────
  const connectedIds = new Set(edges.flatMap(e => [e.from, e.to]))
  const roomNodes = [...roomNodeMap.values()]

  roomNodes.forEach(node => {
    if (!connectedIds.has(node.id) && roomNodes.length > 1) {
      const nearest = nearestNode(
        roomNodes.filter(n => n.id !== node.id),
        node.x, node.y
      )
      if (nearest) addEdge(node.id, nearest.id)
    }
  })

  return { nodes, edges }
}

// ── Hook ─────────────────────────────────────────────────────
export default function useGraphGen() {
  const { detectedRooms, doors, exits, stairs, walls, setGraph } = useStore()

  useEffect(() => {
    if (detectedRooms.length === 0 && exits.length === 0 && stairs.length === 0) {
      setGraph([], [])
      return
    }

    const cacheKey = graphSignature(detectedRooms, doors, exits, stairs, walls)
    const cachedGraph = graphCache.get(cacheKey)
    const { nodes, edges } = cachedGraph ?? generateGraph(detectedRooms, doors, exits, stairs, walls)
    if (!cachedGraph) {
      graphCache.set(cacheKey, { nodes, edges })
      if (graphCache.size > 20) graphCache.delete(graphCache.keys().next().value)
    }
    setGraph(nodes, edges)
  }, [detectedRooms, doors, exits, stairs, walls, setGraph])
}
