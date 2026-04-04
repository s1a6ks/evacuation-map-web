// ── Аналіз безпеки евакуаційного плану ───────────────────────
import { buildAdjacency, dijkstra, pxToM } from './pathfinding'

const WALK_SPEED = 1.4 // м/с
const GRID = 20
const METER = 0.5

// ── Метрики поточного маршруту ────────────────────────────────
export function computeRouteMetrics(currentPath, graphEdges, doors) {
  if (!currentPath || currentPath.length < 2) return null

  const pathIds = currentPath.map(n => n.id)

  let distancePx = 0
  for (let i = 0; i < pathIds.length - 1; i++) {
    const a = pathIds[i], b = pathIds[i + 1]
    const edge = graphEdges.find(e =>
      (e.from === a && e.to === b) || (e.from === b && e.to === a)
    )
    if (edge) distancePx += edge.length
  }
  const distanceM = pxToM(distancePx)
  const timeS = distanceM / WALK_SPEED

  let doorCount = 0
  currentPath.forEach(node => {
    const close = doors.some(d => Math.hypot(d.x - node.x, d.y - node.y) < 15)
    if (close) doorCount++
  })

  const lastNode = currentPath[currentPath.length - 1]
  const reachesExit = lastNode?.isExit ?? false

  return {
    distanceM: distanceM.toFixed(1),
    timeS: Math.round(timeS),
    timeMin: (timeS / 60).toFixed(1),
    nodeCount: currentPath.length,
    doorCount,
    reachesExit,
  }
}

// ── Знайти кути кімнати ────────────────────────────────────────
function getRoomCorners(room) {
  if (!room.cells || room.cells.length === 0) return []
  
  let minR = Infinity, maxR = -Infinity
  let minC = Infinity, maxC = -Infinity
  
  room.cells.forEach(([r, c]) => {
    minR = Math.min(minR, r)
    maxR = Math.max(maxR, r)
    minC = Math.min(minC, c)
    maxC = Math.max(maxC, c)
  })

  // 4 кути прямокутника що обмежує кімнату
  return [
    { x: minC * GRID, y: minR * GRID },
    { x: maxC * GRID + GRID, y: minR * GRID },
    { x: minC * GRID, y: maxR * GRID + GRID },
    { x: maxC * GRID + GRID, y: maxR * GRID + GRID },
  ]
}

// ── Аналіз безпеки плану ──────────────────────────────────────
export function computeSafetyAnalysis(graphNodes, graphEdges, detectedRooms) {
  if (graphNodes.length === 0) return null

  const adj = buildAdjacency(graphNodes, graphEdges, e => pxToM(e.length))
  const exitNodes = graphNodes.filter(n => n.isExit)

  // 1. Загальна площа поверху
  const totalAreaM2 = detectedRooms.reduce((sum, room) => {
    return sum + parseFloat(room.areaM2 || 0)
  }, 0)

  // 2. Кількість виходів за ДБН В.1.1-7
  const exitCount = exitNodes.length
  let requiredExits = 1
  if (totalAreaM2 > 1000) requiredExits = 3
  else if (totalAreaM2 > 300) requiredExits = 2
  const hasEnoughExits = exitCount >= requiredExits

  // 3. Тупикові кімнати
  const deadendIds = new Set()
  adj.forEach((neighbors, id) => {
    const node = graphNodes.find(n => n.id === id)
    if (!node || node.isExit || node.isStair || node.isDoor) return
    
    if (neighbors.length === 0) {
      deadendIds.add(id)
    } else if (neighbors.length === 1) {
      // Кімната з 1 дверима. Перевіряємо, куди вона веде
      const doorId = neighbors[0].to
      const doorNeighbors = adj.get(doorId) || []
      
      const leadsToSafeZone = doorNeighbors.some(n => {
        const neighborNode = graphNodes.find(gn => gn.id === n.to)
        if (!neighborNode) return false
        if (neighborNode.isExit) return true // Веде одразу на вулицю
        if (neighborNode.roomId != null && neighborNode.id !== id) {
          const roomObj = detectedRooms.find(r => r.id === neighborNode.roomId)
          // Якщо це коридор, хол або вестибюль — це нормальний вихід, а не тупик
          const lbl = (roomObj?.label || '').toLowerCase()
          return lbl.includes('коридор') || lbl.includes('хол') || lbl.includes('вестибюль')
        }
        return false
      })

      // Якщо кімната веде тільки в іншу звичайну кімнату (яка не є коридором), тоді це тупик
      if (!leadsToSafeZone) {
        deadendIds.add(id)
      }
    }
  })

  // 4. Рейтинг кімнат за відстанню до найближчого виходу
  const distToExit = new Map()
  graphNodes.forEach(n => distToExit.set(n.id, Infinity))

  exitNodes.forEach(exit => {
    const { dist } = dijkstra(exit.id, adj)
    dist.forEach((d, id) => {
      if (d < (distToExit.get(id) ?? Infinity)) {
        distToExit.set(id, d)
      }
    })
  })

  const roomRanking = detectedRooms
    .map(room => {
      const node = graphNodes.find(n => n.roomId === room.id)
      const dist = node ? (distToExit.get(node.id) ?? Infinity) : Infinity
      const isDeadend = node ? deadendIds.has(node.id) : false
      return {
        id: room.id,
        label: room.label,
        areaM2: room.areaM2,
        distM: dist === Infinity ? null : dist.toFixed(1),
        isDeadend,
        isReachable: dist !== Infinity,
      }
    })
    .sort((a, b) => {
      if (a.distM === null) return 1
      if (b.distM === null) return -1
      return parseFloat(b.distM) - parseFloat(a.distM)
    })

  // 5. Зв'язність графа
  let isFullyConnected = false
  if (exitNodes.length > 0) {
    const { dist } = dijkstra(exitNodes[0].id, adj)
    const unreachable = graphNodes
      .filter(n => n.roomId != null)
      .filter(n => (dist.get(n.id) ?? Infinity) === Infinity)
    isFullyConnected = unreachable.length === 0
  }

  // 6. Найдальша точка на поверсі від виходу (кути всіх кімнат)
  let farthestCornerDist = 0
  let farthestCornerRoom = null

  detectedRooms.forEach(room => {
    const corners = getRoomCorners(room)
    corners.forEach(corner => {
      // Відстань від кута до найближчого виходу (Евклідова)
      exitNodes.forEach(exit => {
        const d = Math.hypot(corner.x - exit.x, corner.y - exit.y)
        const dM = pxToM(d)
        if (dM > farthestCornerDist) {
          farthestCornerDist = dM
          farthestCornerRoom = room.label
        }
      })
    })
  })

  // 7. Вузькі місця
  const bottlenecks = graphNodes
    .filter(n => !n.isExit && !n.isDoor && n.roomId != null) // Двері технічно мають багато ребер для транзиту, відкидаємо їх
    .map(n => {
      const room = detectedRooms.find(r => r.id === n.roomId)
      const degree = (adj.get(n.id) ?? []).length
      return { ...n, degree, room }
    })
    .filter(n => {
      if (n.degree < 3) return false // Тільки перехрестя
      // Якщо це великий коридор — він розрахований на високий трафік, це не вузьке місце
      const area = parseFloat(n.room?.areaM2 || 0)
      if (area > 50 && (n.room?.label || '').toLowerCase().includes('коридор')) return false
      return true
    })
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 3)

  // 8. Рекомендації
  const recommendations = []

  if (!hasEnoughExits) {
    recommendations.push({
      level: 'error',
      text: `ДБН В.1.1-7: ${exitCount} вихід${exitCount === 1 ? '' : 'и'} при площі ${totalAreaM2.toFixed(0)}м². Норматив: мінімум ${requiredExits} вихід${requiredExits === 1 ? '' : 'и'}`
    })
  }

  if (farthestCornerDist > 25) {
    recommendations.push({
      level: 'warning',
      text: `ДБН В.1.1-7: найдальша точка ("${farthestCornerRoom}") на ${farthestCornerDist.toFixed(1)}м від виходу (норма ≤25м)`
    })
  }

  if (deadendIds.size > 0) {
    recommendations.push({
      level: 'warning',
      text: `${deadendIds.size} тупикових кімнат — передбачте альтернативні шляхи виходу`
    })
  }

  if (!isFullyConnected) {
    recommendations.push({
      level: 'error',
      text: 'Є ізольовані кімнати — граф не зв\'язний, евакуація неможлива'
    })
  }

  if (bottlenecks.length > 0) {
    recommendations.push({
      level: 'warning',
      text: `${bottlenecks.length} вузьких місць де може виникнути затор під час евакуації`
    })
  }

  const farthest = roomRanking.find(r => r.distM !== null)
  if (farthest && parseFloat(farthest.distM) > 25) {
    recommendations.push({
      level: 'warning',
      text: `ДБН В.1.1-7: кімната "${farthest.label}" на ${farthest.distM}м від виходу (норма ≤25м)`
    })
  }

  if (recommendations.length === 0 && isFullyConnected && hasEnoughExits) {
    recommendations.push({
      level: 'ok',
      text: 'План відповідає базовим вимогам ДБН В.1.1-7 з пожежної безпеки'
    })
  }

  return {
    exitCount,
    requiredExits,
    hasEnoughExits,
    totalAreaM2: totalAreaM2.toFixed(0),
    farthestCornerDist: farthestCornerDist.toFixed(1),
    farthestCornerRoom,
    deadendCount: deadendIds.size,
    isFullyConnected,
    roomRanking,
    bottlenecks,
    recommendations,
  }
}