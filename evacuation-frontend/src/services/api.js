import axios from 'axios'

const BASE = 'https://localhost:7155/api'

const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
})

// ── Buildings ──────────────────────────────────────────────────
export const createBuilding = (name, address) =>
  api.post('/buildings', { name, address })

export const deleteBuilding = (id) =>
  api.delete(`/buildings/${id}`)

// ── Floors ────────────────────────────────────────────────────
export const createFloor = (buildingId, number, name) =>
  api.post(`/buildings/${buildingId}/floors`, { number, name })

// ── Rooms ─────────────────────────────────────────────────────
export const createRoom = (floorId, number, type) =>
  api.post(`/floors/${floorId}/rooms`, { number, type })

// ── Nodes ─────────────────────────────────────────────────────
export const createNode = (floorId, node) =>
  api.post(`/floors/${floorId}/nodes`, node)

// ── Edges ─────────────────────────────────────────────────────
export const createEdge = (edge) =>
  api.post('/edges', edge)

// ── Maps ──────────────────────────────────────────────────────
export const getFloorMap = (floorId) =>
  api.get(`/maps/floor/${floorId}`)

// ── Save entire floor plan ────────────────────────────────────
// Зберігає граф у бекенді. Raw canvas (walls/doors) — в localStorage.
export const saveFloorPlan = async ({ buildingName, floorNumber, rooms, nodes, edges, existingBuildingId }) => {
  // Якщо вже є збережена будівля — видаляємо стару (cascade)
  if (existingBuildingId) {
    try {
      await deleteBuilding(existingBuildingId)
    } catch {
      // Будівля могла бути вже видалена — ігноруємо
    }
  }

  // 1. Building
  const bRes = await createBuilding(buildingName, '')
  const buildingId = bRes.data.id

  // 2. Floor
  const fRes = await createFloor(buildingId, floorNumber, `${floorNumber} поверх`)
  const floorId = fRes.data.id

  // 3. Rooms
  const roomIdMap = {}
  for (const room of rooms) {
    const rRes = await createRoom(floorId, room.label, room.type || 'room')
    roomIdMap[room.id] = rRes.data.id
  }

  // 4. Nodes
  const nodeIdMap = {}
  for (const node of nodes) {
    const nRes = await createNode(floorId, {
      x: node.xMeters,
      y: node.yMeters,
      isExit: node.isExit,
      isStair: node.isStair,
      roomId: node.roomLocalId ? (roomIdMap[node.roomLocalId] ?? null) : null,
    })
    nodeIdMap[node.id] = nRes.data.id
  }

  // 5. Edges
  for (const edge of edges) {
    await createEdge({
      fromNodeId: nodeIdMap[edge.from],
      toNodeId:   nodeIdMap[edge.to],
      length: edge.length,
      cost:   edge.cost ?? 1.0,
      isBlocked: false,
    })
  }

  return { buildingId, floorId, roomIdMap, nodeIdMap }
}

// ── Load floor plan ───────────────────────────────────────────
export const loadFloorPlan = async (floorId) => {
  const res = await getFloorMap(floorId)
  const data = res.data

  const GRID = 20
  const METER = 0.5

  function mToPx(m) {
    return (m / METER) * GRID
  }

  const nodes = (data.nodes ?? []).map(n => ({
    id:      n.id,
    x:       mToPx(n.x),
    y:       mToPx(n.y),
    isExit:  n.isExit,
    isStair: n.isStair,
    roomId:  n.roomId ?? null,
  }))

  const edges = (data.edges ?? []).map(e => ({
    id:     e.id,
    from:   e.fromNodeId,
    to:     e.toNodeId,
    length: mToPx(e.length),
    cost:   e.cost,
  }))

  return { nodes, edges }
}

export default api
