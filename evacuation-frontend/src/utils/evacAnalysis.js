// ── Аналіз безпеки евакуаційного плану ───────────────────────
import { buildAdjacency, dijkstra, pxToM } from './pathfinding'

const WALK_SPEED = 1.4 // м/с

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

function ukPlural(count, one, few, many) {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function formatList(items, limit = 4) {
  const unique = [...new Set(items.filter(Boolean))]
  if (unique.length === 0) return 'не визначено'
  if (unique.length <= limit) return unique.join(', ')
  return `${unique.slice(0, limit).join(', ')} та ще ${unique.length - limit}`
}

function getRoomLabelByNode(node, detectedRooms) {
  const room = detectedRooms.find(r => r.id === node?.roomId)
  return room?.label || `Кімната ${node?.roomId ?? node?.id}`
}

// ── Аналіз безпеки плану ──────────────────────────────────────
export function computeSafetyAnalysis(graphNodes, graphEdges, detectedRooms, options = {}) {
  if (graphNodes.length === 0) return null

  const {
    stairLinks = {},
    currentFloorId = null,
    blockedExits = [],
    blockedDoors = [],
    exits = [],
    doors = [],
  } = options
  const blockedNodeIds = new Set()

  blockedExits.forEach(idx => {
    const exit = exits[idx]
    if (!exit) return
    graphNodes.forEach(node => {
      if (node.isExit && Math.hypot(node.x - exit.x, node.y - exit.y) < 2) {
        blockedNodeIds.add(node.id)
      }
    })
  })

  blockedDoors.forEach(idx => {
    const door = doors[idx]
    if (!door) return
    graphNodes.forEach(node => {
      if (node.isDoor && Math.hypot(node.x - door.x, node.y - door.y) < 2) {
        blockedNodeIds.add(node.id)
      }
    })
  })

  const activeGraphNodes = graphNodes.filter(node => !blockedNodeIds.has(node.id))
  const stairKey = node => `${currentFloorId}:${node.x}:${node.y}`
  const isLinkedStair = node => Boolean(node?.isStair && currentFloorId != null && stairLinks?.[stairKey(node)])
  const adj = buildAdjacency(activeGraphNodes, graphEdges, e => pxToM(e.length))
  const exitNodes = activeGraphNodes.filter(n => n.isExit)
  const linkedStairNodes = activeGraphNodes.filter(isLinkedStair)
  const evacuationNodes = [...exitNodes, ...linkedStairNodes]

  // 1. Загальна площа поверху
  const totalAreaM2 = detectedRooms.reduce((sum, room) => {
    return sum + parseFloat(room.areaM2 || 0)
  }, 0)

  // 2. Кількість виходів за ДБН В.1.1-7
  const directExitCount = exitNodes.length
  const stairExitCount = linkedStairNodes.length
  const exitCount = evacuationNodes.length
  let requiredExits = 1
  if (totalAreaM2 > 1000) requiredExits = 3
  else if (totalAreaM2 > 300) requiredExits = 2
  const hasEnoughExits = exitCount >= requiredExits

  // 3. Тупикові кімнати
  const deadendIds = new Set()
  adj.forEach((neighbors, id) => {
    const node = activeGraphNodes.find(n => n.id === id)
    if (!node || node.isExit || node.isStair || node.isDoor) return
    
    if (neighbors.length === 0) {
      deadendIds.add(id)
    } else if (neighbors.length === 1) {
      // Кімната з 1 дверима. Перевіряємо, куди вона веде
      const doorId = neighbors[0].to
      const doorNeighbors = adj.get(doorId) || []
      
      const leadsToSafeZone = doorNeighbors.some(n => {
        const neighborNode = activeGraphNodes.find(gn => gn.id === n.to)
        if (!neighborNode) return false
        if (neighborNode.isExit) return true // Веде одразу на вулицю
        if (isLinkedStair(neighborNode)) return true
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
  activeGraphNodes.forEach(n => distToExit.set(n.id, Infinity))

  evacuationNodes.forEach(evacuationNode => {
    const { dist } = dijkstra(evacuationNode.id, adj)
    dist.forEach((d, id) => {
      if (d < (distToExit.get(id) ?? Infinity)) {
        distToExit.set(id, d)
      }
    })
  })

  const roomRanking = detectedRooms
    .map(room => {
      const node = activeGraphNodes.find(n => n.roomId === room.id)
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
  let unreachableRooms = []
  if (evacuationNodes.length > 0) {
    const { dist } = dijkstra(evacuationNodes[0].id, adj)
    const unreachable = activeGraphNodes
      .filter(n => n.roomId != null)
      .filter(n => (dist.get(n.id) ?? Infinity) === Infinity)
    isFullyConnected = unreachable.length === 0
    unreachableRooms = unreachable.map(node => getRoomLabelByNode(node, detectedRooms))
  } else {
    unreachableRooms = detectedRooms.map(room => room.label)
  }

  // 6. Найдальша точка за реальним маршрутом графа, як у списку "Відстані до виходу".
  const farthestReachableRoom = roomRanking.find(r => r.distM !== null)
  const farthestCornerDist = farthestReachableRoom ? parseFloat(farthestReachableRoom.distM) : 0
  const farthestCornerRoom = farthestReachableRoom?.label ?? null

  // 7. Вузькі місця
  const bottlenecks = activeGraphNodes
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

  const deadendRooms = activeGraphNodes
    .filter(node => deadendIds.has(node.id))
    .map(node => getRoomLabelByNode(node, detectedRooms))

  const bottleneckRooms = bottlenecks
    .map(node => node.room?.label || getRoomLabelByNode(node, detectedRooms))

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
    const roomWord = ukPlural(deadendIds.size, 'тупикову кімнату', 'тупикові кімнати', 'тупикових кімнат')
    recommendations.push({
      level: 'warning',
      text: `Виявлено ${deadendIds.size} ${roomWord}: ${formatList(deadendRooms)}. Передбачте альтернативні шляхи виходу`
    })
  }

  if (!isFullyConnected) {
    recommendations.push({
      level: 'error',
      text: `Є ізольовані кімнати: ${formatList(unreachableRooms)}. Граф не зв'язний, евакуація неможлива`
    })
  }

  if (bottlenecks.length > 0) {
    const placeWord = ukPlural(
      bottlenecks.length,
      'потенційне вузьке місце',
      'потенційні вузькі місця',
      'потенційних вузьких місць'
    )
    recommendations.push({
      level: 'warning',
      text: `Виявлено ${bottlenecks.length} ${placeWord}: ${formatList(bottleneckRooms)}. На цих ділянках може виникнути затор під час евакуації`
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
    directExitCount,
    stairExitCount,
    requiredExits,
    hasEnoughExits,
    totalAreaM2: totalAreaM2.toFixed(0),
    farthestCornerDist: farthestCornerDist.toFixed(1),
    farthestCornerRoom,
    deadendCount: deadendIds.size,
    isFullyConnected,
    unreachableRooms,
    roomRanking,
    bottlenecks,
    recommendations,
  }
}
