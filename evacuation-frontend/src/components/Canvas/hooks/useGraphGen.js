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
function getAdjacentRooms(px, py, horiz, detectedRooms) {
  const col = Math.round(px / GRID)
  const row = Math.round(py / GRID)

  let roomA, roomB
  if (horiz) {
    roomA = findRoomAtCell(detectedRooms, col, row - 1)
    roomB = findRoomAtCell(detectedRooms, col, row + 1)
  } else {
    roomA = findRoomAtCell(detectedRooms, col - 1, row)
    roomB = findRoomAtCell(detectedRooms, col + 1, row)
  }

  return [roomA, roomB].filter(Boolean)
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
  function addEdge(fromId, toId) {
    const key = `${Math.min(fromId, toId)}-${Math.max(fromId, toId)}`
    if (edgeSet.has(key)) return
    edgeSet.add(key)
    const a = nodes.find(n => n.id === fromId)
    const b = nodes.find(n => n.id === toId)
    if (!a || !b) return
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    edges.push({ id: uid++, from: fromId, to: toId, length })
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

    const adjacent = getAdjacentRooms(door.x, door.y, door.horiz, detectedRooms)

    // Реєструємо doorNode для кожної суміжної кімнати
    adjacent.forEach(room => {
      if (!roomDoorNodes.has(room.id)) roomDoorNodes.set(room.id, [])
      roomDoorNodes.get(room.id).push(doorNode)

      // З'єднуємо центроїд кімнати з дверима
      const roomNode = roomNodeMap.get(room.id)
      if (roomNode) addEdge(roomNode.id, doorNode.id)
    })
  })

  // ── 3. Door-to-door в межах кімнати ───────────────────────
  //    Це ключова зміна: якщо кімната має кілька дверей,
  //    з'єднуємо їх між собою напряму.
  //    Маршрут "транзитом" через кімнату піде door→door,
  //    без заходу в центроїд.
  roomDoorNodes.forEach((doorNodes) => {
    for (let i = 0; i < doorNodes.length; i++) {
      for (let j = i + 1; j < doorNodes.length; j++) {
        addEdge(doorNodes[i].id, doorNodes[j].id)
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

    const adjacent = getAdjacentRooms(exit.x, exit.y, exit.horiz, detectedRooms)

    adjacent.forEach(room => {
      // Реєструємо exit як "двері" для door-to-door транзиту
      if (!roomDoorNodes.has(room.id)) roomDoorNodes.set(room.id, [])
      const roomDoors = roomDoorNodes.get(room.id)

      // З'єднуємо exit з усіма дверима цієї кімнати (door-to-exit)
      roomDoors.forEach(dn => addEdge(dn.id, exitNode.id))

      // З'єднуємо exit з центроїдом
      const roomNode = roomNodeMap.get(room.id)
      if (roomNode) addEdge(roomNode.id, exitNode.id)

      // Додаємо exit до списку "дверей" кімнати
      roomDoors.push(exitNode)
    })

    // Якщо exit не біля жодної кімнати — fallback
    if (adjacent.length === 0) {
      const nearest = nearestNode([...roomNodeMap.values()], exitNode.x, exitNode.y, 300)
      if (nearest) addEdge(nearest.id, exitNode.id)
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
    if (nearest) addEdge(nearest.id, stairNode.id)
  })

  // ── 6. Зв'язність: висячі транзитні вузли ────────────────
  const allTransitNodes = nodes.filter(n => n.isDoor || n.isExit)

  function getConnectedIds(nodeId) {
    const ids = new Set()
    edges.forEach(e => {
      if (e.from === nodeId) ids.add(e.to)
      if (e.to === nodeId) ids.add(e.from)
    })
    return ids
  }

  function getEdgeCount(nodeId) {
    return edges.filter(e => e.from === nodeId || e.to === nodeId).length
  }

  allTransitNodes.forEach(node => {
    if (getEdgeCount(node.id) === 0) {
      const nearest = nearestNode(
        nodes.filter(n => n.id !== node.id),
        node.x, node.y, 300
      )
      if (nearest) addEdge(node.id, nearest.id)
    }
  })

  allTransitNodes.forEach(node => {
    if (getEdgeCount(node.id) === 1) {
      const connected = getConnectedIds(node.id)
      const candidates = allTransitNodes.filter(n =>
        n.id !== node.id && !connected.has(n.id)
      )
      const nearest = nearestNode(candidates, node.x, node.y, 300)
      if (nearest) addEdge(node.id, nearest.id)
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
  }, [detectedRooms, doors, exits, stairs]) // eslint-disable-line react-hooks/exhaustive-deps
}