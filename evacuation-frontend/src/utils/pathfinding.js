// ── Спільна утиліта для пошуку шляху ─────────────────────────
// Використовується і в useEvacuation, і в evacAnalysis

import { detectRooms } from '../components/Canvas/hooks/useFloodFill'
import { generateGraph } from '../components/Canvas/hooks/useGraphGen'

const GRID = 20
const METER = 0.5
const STAIR_MATCH_DIST = GRID * 2   // 2 клітинки — вважаємо ті ж сходи
const CANVAS_COLS = 150
const CANVAS_ROWS = 100

export function pxToM(px) {
  return (px / GRID) * METER
}

export function mToPx(m) {
  return (m / METER) * GRID
}

// ── Побудова списку суміжності ────────────────────────────────
export function buildAdjacency(nodes, edges, weightFn) {
  const adj = new Map()
  nodes.forEach(n => adj.set(n.id, []))
  edges.forEach(e => {
    const w = weightFn ? weightFn(e) : (e.length ?? 1)
    if (adj.has(e.from)) adj.get(e.from).push({ to: e.to,   weight: w })
    if (adj.has(e.to))   adj.get(e.to).push({   to: e.from, weight: w })
  })
  return adj
}

// ── Dijkstra від одного джерела ───────────────────────────────
export function dijkstra(startId, adj) {
  const dist = new Map()
  const prev = new Map()
  const visited = new Set()

  adj.forEach((_, id) => dist.set(id, Infinity))
  dist.set(startId, 0)

  const queue = [{ id: startId, d: 0 }]

  while (queue.length > 0) {
    queue.sort((a, b) => a.d - b.d)
    const { id } = queue.shift()
    if (visited.has(id)) continue
    visited.add(id)

    for (const { to, weight } of (adj.get(id) ?? [])) {
      const nd = dist.get(id) + weight
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd)
        prev.set(to, id)
        queue.push({ id: to, d: nd })
      }
    }
  }

  return { dist, prev }
}

// ── Знайти маршрут від вузла до найближчого виходу ───────────
export function findRouteToExit(startNodeId, nodes, edges) {
  const exitNodes = nodes.filter(n => n.isExit)
  if (exitNodes.length === 0) return null

  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const adj = buildAdjacency(nodes, edges)
  const { dist, prev } = dijkstra(startNodeId, adj)

  let bestExit = null, bestDist = Infinity
  exitNodes.forEach(exit => {
    const d = dist.get(exit.id) ?? Infinity
    if (d < bestDist) { bestDist = d; bestExit = exit }
  })

  if (!bestExit || bestDist === Infinity) return null

  // Відновити шлях
  const path = []
  let cur = bestExit.id
  while (cur !== undefined && cur !== null) {
    const node = nodeMap.get(cur)
    if (node) path.unshift(node)
    if (cur === startNodeId) break
    cur = prev.get(cur)
  }

  return path.length > 1 ? path : null
}

// ── Побудувати граф поверху з raw даних ──────────────────────
function buildFloorGraph(floorData) {
  const { walls = [], doors = [], exits = [], stairs = [] } = floorData
  const rooms = detectRooms(walls, CANVAS_COLS, CANVAS_ROWS)
  const { nodes, edges } = generateGraph(rooms, doors, exits, stairs)
  return { rooms, nodes, edges }
}

// ── Знайти сходи на інших поверхах що відповідають позиції ───
function findLinkedStairs(stair, allFloorData, currentFloorId) {
  const linked = []
  Object.entries(allFloorData).forEach(([fid, data]) => {
    const floorId = Number(fid)
    if (floorId === currentFloorId) return
    const match = (data.stairs || []).find(s =>
      Math.hypot(s.x - stair.x, s.y - stair.y) <= STAIR_MATCH_DIST
    )
    if (match) linked.push({ floorId, stair: match })
  })
  return linked
}

// ── Відновити шлях з Dijkstra ─────────────────────────────────
function reconstructPath(startId, endId, nodeMap, prev) {
  const path = []
  let cur = endId
  while (cur !== undefined && cur !== null) {
    const node = nodeMap.get(cur)
    if (node) path.unshift(node)
    if (cur === startId) break
    cur = prev.get(cur)
  }
  return path
}

// ── Багатоповерховий пошук маршруту ──────────────────────────
// Якщо на поточному поверсі немає виходів — шукає через сходи
// Повертає масив вузлів. Вузол з isFloorChange=true означає перехід між поверхами.
export function findMultiFloorRoute(
  startNodeId,
  graphNodes,
  graphEdges,
  allFloorData,    // { [floorId]: { walls, doors, exits, stairs } }
  currentFloorId,
  floors           // [{ id, name }]
) {
  // 1. Спочатку шукаємо вихід на поточному поверсі
  const simpleRoute = findRouteToExit(startNodeId, graphNodes, graphEdges)
  if (simpleRoute) return { segments: [{ floorId: currentFloorId, path: simpleRoute }] }

  // 2. Немає виходів — шукаємо найближчі сходи
  const stairNodes = graphNodes.filter(n => n.isStair)
  if (stairNodes.length === 0) return null

  const nodeMap = new Map(graphNodes.map(n => [n.id, n]))
  const adj = buildAdjacency(graphNodes, graphEdges)
  const { dist, prev } = dijkstra(startNodeId, adj)

  let bestStair = null, bestStairDist = Infinity
  stairNodes.forEach(sn => {
    const d = dist.get(sn.id) ?? Infinity
    if (d < bestStairDist) { bestStairDist = d; bestStair = sn }
  })

  if (!bestStair || bestStairDist === Infinity) return null

  // Шлях до сходів на поточному поверсі
  const pathToStair = reconstructPath(startNodeId, bestStair.id, nodeMap, prev)
  if (pathToStair.length === 0) return null

  // 3. Знаходимо відповідні сходи на інших поверхах
  const linked = findLinkedStairs(bestStair, allFloorData, currentFloorId)
  if (linked.length === 0) {
    // Сходи є, але не прив'язані — повертаємо шлях до сходів
    return pathToStair
  }

  // 4. Для кожного зв'язаного поверху — шукаємо маршрут до виходу
  let bestContinuation = null
  let bestContDist = Infinity

  for (const { floorId, stair: linkedStair } of linked) {
    const floorData = allFloorData[floorId]
    if (!floorData) continue

    const { nodes: fNodes, edges: fEdges } = buildFloorGraph(floorData)

    // Знайти вузол сходів на цьому поверсі
    const stairNodeHere = fNodes
      .filter(n => n.isStair)
      .sort((a, b) =>
        Math.hypot(a.x - linkedStair.x, a.y - linkedStair.y) -
        Math.hypot(b.x - linkedStair.x, b.y - linkedStair.y)
      )[0]

    if (!stairNodeHere) continue

    const fNodeMap = new Map(fNodes.map(n => [n.id, n]))
    const fAdj = buildAdjacency(fNodes, fEdges)
    const { dist: fDist, prev: fPrev } = dijkstra(stairNodeHere.id, fAdj)

    // Знайти найближчий вихід
    const exitNodes = fNodes.filter(n => n.isExit)
    let bestExit = null, bd = Infinity
    exitNodes.forEach(en => {
      const d = fDist.get(en.id) ?? Infinity
      if (d < bd) { bd = d; bestExit = en }
    })

    if (!bestExit || bd === Infinity) continue

    if (bd < bestContDist) {
      bestContDist = bd
      const floorName = floors.find(f => f.id === floorId)?.name || `${floorId} поверх`
      const contPath = reconstructPath(stairNodeHere.id, bestExit.id, fNodeMap, fPrev)
      bestContinuation = { floorId, floorName, path: contPath }
    }
  }

  if (!bestContinuation) {
    // Сходи є але не зв'язані — повертаємо як одноповерховий маршрут
    return { segments: [{ floorId: currentFloorId, path: pathToStair }] }
  }

  // 5. Додаємо маркер переходу до останнього вузла першого сегменту
  const stairMarker = {
    ...bestStair,
    isFloorChange: true,
    targetFloorId: bestContinuation.floorId,
    targetFloorName: bestContinuation.floorName,
  }

  return {
    segments: [
      { floorId: currentFloorId, path: [...pathToStair.slice(0, -1), stairMarker] },
      { floorId: bestContinuation.floorId, path: bestContinuation.path },
    ]
  }
}

// ── A* алгоритм ───────────────────────────────────────────────
export function aStar(startId, goalIds, adj, nodes) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const goalSet = new Set(goalIds)

  // Евристика — мінімальна відстань до будь-якого виходу
  function h(id) {
    const n = nodeMap.get(id)
    if (!n) return 0
    let minD = Infinity
    goalIds.forEach(gId => {
      const g = nodeMap.get(gId)
      if (g) minD = Math.min(minD, Math.hypot(g.x - n.x, g.y - n.y))
    })
    return minD
  }

  const gScore = new Map()
  const fScore = new Map()
  const prev = new Map()
  const open = new Set([startId])
  const closed = new Set()

  nodes.forEach(n => { gScore.set(n.id, Infinity); fScore.set(n.id, Infinity) })
  gScore.set(startId, 0)
  fScore.set(startId, h(startId))

  while (open.size > 0) {
    // Вибираємо вузол з мінімальним fScore
    let current = null, minF = Infinity
    open.forEach(id => {
      const f = fScore.get(id) ?? Infinity
      if (f < minF) { minF = f; current = id }
    })

    if (current === null) break
    if (goalSet.has(current)) {
      // Відновлення шляху
      const path = []
      let c = current
      while (c !== undefined) {
        const node = nodeMap.get(c)
        if (node) path.unshift(node)
        c = prev.get(c)
      }
      return { path, visitedCount: closed.size }
    }

    open.delete(current)
    closed.add(current)

    for (const { to, weight } of (adj.get(current) ?? [])) {
      if (closed.has(to)) continue
      const tentativeG = (gScore.get(current) ?? Infinity) + weight
      if (tentativeG < (gScore.get(to) ?? Infinity)) {
        prev.set(to, current)
        gScore.set(to, tentativeG)
        fScore.set(to, tentativeG + h(to))
        open.add(to)
      }
    }
  }
  return null
}

// ── Пошук маршруту з метриками (A* або Dijkstra) ─────────────
export function findRouteWithMetrics(startNodeId, nodes, edges, useAstar = true) {
  const exitNodes = nodes.filter(n => n.isExit)
  if (exitNodes.length === 0) return null

  const adj = buildAdjacency(nodes, edges)
  const t0 = performance.now()
  let path, visitedCount

  if (useAstar) {
    const result = aStar(startNodeId, exitNodes.map(n => n.id), adj, nodes)
    path = result?.path ?? null
    visitedCount = result?.visitedCount ?? 0
  } else {
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const { dist, prev } = dijkstra(startNodeId, adj)
    let bestExit = null, bestDist = Infinity
    exitNodes.forEach(exit => {
      const d = dist.get(exit.id) ?? Infinity
      if (d < bestDist) { bestDist = d; bestExit = exit }
    })
    if (!bestExit || bestDist === Infinity) return null
    const reconstructed = []
    let cur = bestExit.id
    while (cur !== undefined) {
      const node = nodeMap.get(cur)
      if (node) reconstructed.unshift(node)
      if (cur === startNodeId) break
      cur = prev.get(cur)
    }
    path = reconstructed.length > 1 ? reconstructed : null
    visitedCount = dist.size
  }

  const ms = performance.now() - t0

  if (!path) return null

  // Рахуємо відстань
  let distPx = 0
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]
    const edge = edges.find(e =>
      (e.from === a.id && e.to === b.id) || (e.from === b.id && e.to === a.id)
    )
    if (edge) distPx += edge.length
  }

  return {
    path,
    algorithm: useAstar ? 'A*' : 'Dijkstra',
    ms: ms.toFixed(2),
    visitedCount,
    distPx,
  }
}

// ── Оновлений multi-floor з використанням stairLinks ─────────
export function findMultiFloorRouteWithLinks(
  startNodeId,
  graphNodes,
  graphEdges,
  allFloorData,
  currentFloorId,
  floors,
  stairLinks   // { "floorId:x:y": { toFloorId, toX, toY } }
) {
  // 1. Спочатку шукаємо вихід на поточному поверсі
  const simpleRoute = findRouteToExit(startNodeId, graphNodes, graphEdges)
  if (simpleRoute) return { segments: [{ floorId: currentFloorId, path: simpleRoute }] }

  // 2. Немає виходів — шукаємо сходи з явними зв'язками
  const stairNodes = graphNodes.filter(n => n.isStair)
  if (stairNodes.length === 0) return null

  const adj = buildAdjacency(graphNodes, graphEdges)
  const nodeMap = new Map(graphNodes.map(n => [n.id, n]))
  const { dist, prev } = dijkstra(startNodeId, adj)

  // Знаходимо найближчі сходи ЩО МАЮТЬ зв'язок
  let bestStair = null, bestStairDist = Infinity

  stairNodes.forEach(sn => {
    const key = `${currentFloorId}:${sn.x}:${sn.y}`
    const hasLink = stairLinks && stairLinks[key]
    if (!hasLink) return
    const d = dist.get(sn.id) ?? Infinity
    if (d < bestStairDist) { bestStairDist = d; bestStair = sn }
  })

  // Fallback: якщо немає явних зв'язків — пробуємо автоматичний збіг
  if (!bestStair) {
    stairNodes.forEach(sn => {
      const d = dist.get(sn.id) ?? Infinity
      if (d < bestStairDist) { bestStairDist = d; bestStair = sn }
    })
  }

  if (!bestStair || bestStairDist === Infinity) return null

  // Відновлюємо шлях до сходів
  function reconstructPath(endId) {
    const path = []
    let cur = endId
    while (cur !== undefined) {
      const node = nodeMap.get(cur)
      if (node) path.unshift(node)
      if (cur === startNodeId) break
      cur = prev.get(cur)
    }
    return path
  }
  const pathToStair = reconstructPath(bestStair.id)
  if (pathToStair.length === 0) return null

  // Знаходимо цільовий поверх через stairLinks
  const key = `${currentFloorId}:${bestStair.x}:${bestStair.y}`
  const link = stairLinks?.[key]
  const targetFloorId = link?.toFloorId ?? null

  if (!targetFloorId) {
    return { segments: [{ floorId: currentFloorId, path: pathToStair }] }
  }

  // Будуємо маршрут на цільовому поверсі від точки сходів
  const floorData = allFloorData[targetFloorId]
  if (!floorData) return { segments: [{ floorId: currentFloorId, path: pathToStair }] }

  const { nodes: fNodes, edges: fEdges } = buildFloorGraph(floorData)
  const linkedX = link.toX ?? bestStair.x
  const linkedY = link.toY ?? bestStair.y

  // Знаходимо найближчий вузол сходів на цільовому поверсі
  const stairNodeHere = fNodes
    .filter(n => n.isStair)
    .sort((a, b) =>
      Math.hypot(a.x - linkedX, a.y - linkedY) - Math.hypot(b.x - linkedX, b.y - linkedY)
    )[0]

  if (!stairNodeHere) return { segments: [{ floorId: currentFloorId, path: pathToStair }] }

  const fNodeMap = new Map(fNodes.map(n => [n.id, n]))
  const fAdj = buildAdjacency(fNodes, fEdges)
  const { dist: fDist, prev: fPrev } = dijkstra(stairNodeHere.id, fAdj)

  const exitNodes = fNodes.filter(n => n.isExit)
  let bestExit = null, bd = Infinity
  exitNodes.forEach(en => {
    const d = fDist.get(en.id) ?? Infinity
    if (d < bd) { bd = d; bestExit = en }
  })

  if (!bestExit) return { segments: [{ floorId: currentFloorId, path: pathToStair }] }

  const floorName = floors.find(f => f.id === targetFloorId)?.name || `${targetFloorId} поверх`
  const contPath = []
  let cur = bestExit.id
  while (cur !== undefined) {
    const node = fNodeMap.get(cur)
    if (node) contPath.unshift(node)
    if (cur === stairNodeHere.id) break
    cur = fPrev.get(cur)
  }

  const stairMarker = {
    ...bestStair,
    isFloorChange: true,
    targetFloorId,
    targetFloorName: floorName,
  }

  return {
    segments: [
      { floorId: currentFloorId, path: [...pathToStair.slice(0, -1), stairMarker] },
      { floorId: targetFloorId, path: contPath },
    ]
  }
}