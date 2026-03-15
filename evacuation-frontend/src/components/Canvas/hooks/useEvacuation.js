import useStore from '../../../store/useStore'
import {
  findMultiFloorRouteWithLinks,
  findRouteWithMetrics,
} from '../../../utils/pathfinding'

const GRID = 20
const HIT_RADIUS = GRID * 1.2   // радіус кліку для виходів/дверей

// Палітра кольорів для мульти-режиму
const MULTI_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#14b8a6', // teal
]

function findRoomAtPixel(detectedRooms, px, py) {
  const col = Math.floor(px / GRID)
  const row = Math.floor(py / GRID)
  return detectedRooms.find(room =>
    room.cells.some(([r, c]) => r === row && c === col)
  ) ?? null
}

function findElementAtPixel(elements, px, py) {
  let best = null, bestD = Infinity
  elements.forEach((el, idx) => {
    const d = Math.hypot(el.x - px, el.y - py)
    if (d < HIT_RADIUS && d < bestD) { bestD = d; best = idx }
  })
  return best  // null або індекс
}

export default function useEvacuation(scale = 1, offset = { x: 0, y: 0 }) {
  const {
    mode, evacuationView,
    graphNodes, graphEdges,
    detectedRooms,
    algorithm,
    setCurrentPath, setAllPaths, setMultiFloorPath,
    setSelectedRoomId,
    setAlgorithmMetrics,
    floorDataMap, currentFloorId, floors,
    walls, doors, exits, stairs,
    stairLinks,
    blockedExits, blockedDoors,
    toggleBlockedExit, toggleBlockedDoor,
    selectedRoomIds, toggleSelectedRoomId, setMultiRoomPaths,
  } = useStore()

  function getAllFloorData() {
    return {
      ...floorDataMap,
      [currentFloorId]: { walls, doors, exits, stairs },
    }
  }

  // ── Фільтруємо заблоковані виходи і двері з graphNodes ────
  function getEffectiveNodes() {
    const blockedIds = new Set()

    blockedExits.forEach(idx => {
      const exit = exits[idx]
      if (!exit) return
      graphNodes.forEach(n => {
        if (n.isExit && Math.abs(n.x - exit.x) < 2 && Math.abs(n.y - exit.y) < 2)
          blockedIds.add(n.id)
      })
    })

    blockedDoors.forEach(idx => {
      const door = doors[idx]
      if (!door) return
      graphNodes.forEach(n => {
        if (n.isDoor && Math.abs(n.x - door.x) < 2 && Math.abs(n.y - door.y) < 2)
          blockedIds.add(n.id)
      })
    })

    if (blockedIds.size === 0) return graphNodes
    return graphNodes.filter(n => !blockedIds.has(n.id))
  }

  // ── Локальний пошук з метриками ────────────────────────────
  function findLocalRoute(startNodeId) {
    const effectiveNodes = getEffectiveNodes()
    const hasExitsHere = effectiveNodes.some(n => n.isExit)

    if (hasExitsHere) {
      const astarResult = findRouteWithMetrics(startNodeId, effectiveNodes, graphEdges, true)
      const dijkResult = findRouteWithMetrics(startNodeId, effectiveNodes, graphEdges, false)

      if (setAlgorithmMetrics && (astarResult || dijkResult)) {
        setAlgorithmMetrics({
          astar: astarResult ? { ms: astarResult.ms, visited: astarResult.visitedCount, distPx: astarResult.distPx } : null,
          dijkstra: dijkResult ? { ms: dijkResult.ms, visited: dijkResult.visitedCount, distPx: dijkResult.distPx } : null,
        })
      }

      const chosen = algorithm === 'astar' ? astarResult : dijkResult
      if (!chosen?.path) return null
      return { segments: [{ floorId: currentFloorId, path: chosen.path }] }
    }

    return findMultiFloorRouteWithLinks(
      startNodeId, effectiveNodes, graphEdges,
      getAllFloorData(), currentFloorId, floors, stairLinks
    )
  }

  function saveRoute(result) {
    if (!result) { setCurrentPath(null); return }
    if (result.segments?.length === 1) {
      setCurrentPath(result.segments[0].path)
    } else if (result.segments?.length > 1) {
      setMultiFloorPath(result.segments)
    } else {
      setCurrentPath(result)
    }
  }
  // ── Мульти-кімнатний режим ─────────────────────────────────
  function computeMultiRoomPaths(roomIdsToCompute) {
    const effectiveNodes = getEffectiveNodes()
    const result = {}
    roomIdsToCompute.forEach((roomId, i) => {
      const room = detectedRooms.find(r => r.id === roomId)
      const roomNode = graphNodes.find(n => n.roomId === roomId)
      if (!roomNode) return
      const route = findRouteWithMetrics(roomNode.id, effectiveNodes, graphEdges, algorithm === 'astar')
      result[roomId] = {
        path: route?.path ?? null,
        color: MULTI_COLORS[i % MULTI_COLORS.length],
        label: room?.label ?? roomId,
        distPx: route?.distPx ?? null,
        ms: route?.ms ?? null,
      }
    })
    setMultiRoomPaths(result)
  }

  // ── Загальний план ─────────────────────────────────────────
  function computeAllPaths() {
    const paths = []
    for (const node of graphNodes.filter(n => n.roomId != null && !n.isExit)) {
      const result = findLocalRoute(node.id)
      if (result?.segments) {
        const seg = result.segments.find(s => s.floorId === currentFloorId)
        if (seg?.path) paths.push(seg.path)
      }
    }
    setAllPaths(paths)
  }

  async function handleEvacuationClick(e) {
    if (mode !== 'evacuation') return

    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left - offset.x) / scale
    const py = (e.clientY - rect.top - offset.y) / scale

    // ── Пріоритет: клік на вихід → toggle блокування ────────
    const exitIdx = findElementAtPixel(exits, px, py)
    if (exitIdx !== null) {
      toggleBlockedExit(exitIdx)
      // Читаємо СВІЖИЙ стан після toggle (уникаємо stale closure)
      const fresh = useStore.getState()
      if (fresh.selectedRoomId) {
        const roomNode = fresh.graphNodes.find(n => n.roomId === fresh.selectedRoomId)
        if (roomNode) {
          // Фільтруємо заблоковані з свіжого стану
          const effectiveNodes = fresh.graphNodes.filter(n => {
            if (n.isExit) return !fresh.blockedExits.some(idx => {
              const ex = fresh.exits[idx]
              return ex && Math.abs(n.x - ex.x) < 2 && Math.abs(n.y - ex.y) < 2
            })
            if (n.isDoor) return !fresh.blockedDoors.some(idx => {
              const d = fresh.doors[idx]
              return d && Math.abs(n.x - d.x) < 2 && Math.abs(n.y - d.y) < 2
            })
            return true
          })
          const result = findRouteWithMetrics(roomNode.id, effectiveNodes, fresh.graphEdges, fresh.algorithm === 'astar')
          saveRoute(result ? { segments: [{ floorId: fresh.currentFloorId, path: result.path }] } : null)
        }
      }
      return
    }

    // ── Клік на двері → toggle блокування ───────────────────
    const doorIdx = findElementAtPixel(doors, px, py)
    if (doorIdx !== null) {
      toggleBlockedDoor(doorIdx)
      // Читаємо СВІЖИЙ стан після toggle
      const fresh = useStore.getState()
      if (fresh.selectedRoomId) {
        const roomNode = fresh.graphNodes.find(n => n.roomId === fresh.selectedRoomId)
        if (roomNode) {
          const effectiveNodes = fresh.graphNodes.filter(n => {
            if (n.isExit) return !fresh.blockedExits.some(idx => {
              const ex = fresh.exits[idx]
              return ex && Math.abs(n.x - ex.x) < 2 && Math.abs(n.y - ex.y) < 2
            })
            if (n.isDoor) return !fresh.blockedDoors.some(idx => {
              const d = fresh.doors[idx]
              return d && Math.abs(n.x - d.x) < 2 && Math.abs(n.y - d.y) < 2
            })
            return true
          })
          const result = findRouteWithMetrics(roomNode.id, effectiveNodes, fresh.graphEdges, fresh.algorithm === 'astar')
          saveRoute(result ? { segments: [{ floorId: fresh.currentFloorId, path: result.path }] } : null)
        }
      }
      return
    }

    // ── Мульти-кімнатний вибір ──────────────────────────────
    if (evacuationView === 'multi') {
      const room = findRoomAtPixel(detectedRooms, px, py)
      if (!room) return
      toggleSelectedRoomId(room.id)
      const fresh = useStore.getState()
      computeMultiRoomPaths(fresh.selectedRoomIds)
      return
    }

    // ── Загальний план — перераховуємо ──────────────────────
    if (evacuationView === 'all') {
      computeAllPaths()
      return
    }

    // ── Клік на кімнату → маршрут ───────────────────────────
    const room = findRoomAtPixel(detectedRooms, px, py)
    if (!room) {
      setCurrentPath(null)
      setSelectedRoomId(null)
      return
    }

    setSelectedRoomId(room.id)
    const roomNode = graphNodes.find(n => n.roomId === room.id)
    if (!roomNode) { setCurrentPath(null); return }

    saveRoute(findLocalRoute(roomNode.id))
  }

  return { handleEvacuationClick, computeAllPaths, computeMultiRoomPaths }
}
