import { useEffect } from 'react'
import useStore from '../../../store/useStore'

const GRID = 20

// ── Знайти кімнату за клітинкою (row, col) ──────────────────
function findRoomAtCell(detectedRooms, col, row) {
  return detectedRooms.find(room =>
    room.cells.some(([r, c]) => r === row && c === col)
  ) ?? null
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
  const sampleDist = GRID * 0.75

  const samples = [
    { x: item.x + normalX * sampleDist, y: item.y + normalY * sampleDist },
    { x: item.x - normalX * sampleDist, y: item.y - normalY * sampleDist },
  ]

  const rooms = samples.map(point => {
    const col = Math.round(point.x / GRID)
    const row = Math.round(point.y / GRID)
    return findRoomAtCell(detectedRooms, col, row)
  }).filter(Boolean)

  return [...new Map(rooms.map(room => [room.id, room])).values()]
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

function simplifyPolyline(points) {
  if (points.length <= 2) return points
  const simplified = [points[0]]

  for (let i = 1; i < points.length - 1; i++) {
    const prev = simplified[simplified.length - 1]
    const current = points[i]
    const next = points[i + 1]
    const dx1 = Math.sign(current.x - prev.x)
    const dy1 = Math.sign(current.y - prev.y)
    const dx2 = Math.sign(next.x - current.x)
    const dy2 = Math.sign(next.y - current.y)
    if (dx1 !== dx2 || dy1 !== dy2) simplified.push(current)
  }

  simplified.push(points[points.length - 1])
  return simplified
}

function polylineLength(points) {
  let length = 0
  for (let i = 0; i < points.length - 1; i++) {
    length += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y)
  }
  return length
}

function buildRoomPath(room, from, to) {
  if (!room?.cells?.length) return null

  const start = nearestRoomCell(room, from)
  const finish = nearestRoomCell(room, to)
  if (!start || !finish) return null

  const allowed = new Set(room.cells.map(([row, col]) => `${row},${col}`))
  const queue = [start]
  const seen = new Set([cellKey(start)])
  const prev = new Map()
  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ]

  while (queue.length > 0) {
    const cell = queue.shift()
    if (cell.row === finish.row && cell.col === finish.col) break

    directions.forEach(direction => {
      const next = { row: cell.row + direction.row, col: cell.col + direction.col }
      const key = cellKey(next)
      if (!allowed.has(key) || seen.has(key)) return
      seen.add(key)
      prev.set(key, cell)
      queue.push(next)
    })
  }

  if (!seen.has(cellKey(finish))) return null

  const cells = []
  let current = finish
  while (current) {
    cells.unshift(current)
    if (current.row === start.row && current.col === start.col) break
    current = prev.get(cellKey(current))
  }

  const points = [
    { x: from.x, y: from.y },
    ...cells.map(cell => ({
      x: cell.col * GRID + GRID / 2,
      y: cell.row * GRID + GRID / 2,
    })),
    { x: to.x, y: to.y },
  ]

  return simplifyPolyline(points)
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
export function generateGraph(detectedRooms, doors, exits, stairs) {
  const nodes = []
  const edges = []
  let uid = 1

  // Хелпер: додати ребро (уникаємо дублів)
  const edgeSet = new Set()
  function addEdge(fromId, toId, roomId = null) {
    const key = `${Math.min(fromId, toId)}-${Math.max(fromId, toId)}`
    if (edgeSet.has(key)) return
    edgeSet.add(key)
    const a = nodes.find(n => n.id === fromId)
    const b = nodes.find(n => n.id === toId)
    if (!a || !b) return
    const room = roomId ? detectedRooms.find(r => r.id === roomId) : null
    const points = room ? buildRoomPath(room, a, b) : null
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

  // ── 5. Сходи ──────────────────────────────────────────────
  stairs.forEach(stair => {
    const stairNode = {
      id: uid++,
      x: stair.x,
      y: stair.y,
      isExit: false,
      isStair: true,
    }
    nodes.push(stairNode)
    const nearest = nearestNode([...roomNodeMap.values()], stairNode.x, stairNode.y, 300)
    if (nearest) addEdge(nearest.id, stairNode.id, nearest.roomId)
  })

  // ── 6. Зв'язність: висячі транзитні вузли ────────────────
  const allTransitNodes = nodes.filter(n => n.isDoor || n.isExit)

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
  const { detectedRooms, doors, exits, stairs, setGraph } = useStore()

  useEffect(() => {
    if (detectedRooms.length === 0 && exits.length === 0 && stairs.length === 0) {
      setGraph([], [])
      return
    }

    const { nodes, edges } = generateGraph(detectedRooms, doors, exits, stairs)
    setGraph(nodes, edges)
  }, [detectedRooms, doors, exits, stairs, setGraph])
}
