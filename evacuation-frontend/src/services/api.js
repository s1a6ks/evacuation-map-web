import axios from 'axios'

const BASE = 'https://localhost:7155/api'

const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
})

// ── Buildings ──────────────────────────────────────────────────
export const createBuilding = (name, address) =>
  api.post('/buildings', { name, address })

export const getBuildings = () =>
  api.get('/buildings')

// ── Floors ────────────────────────────────────────────────────
export const createFloor = (buildingId, number, name) =>
  api.post(`/buildings/${buildingId}/floors`, { number, name })

export const getFloor = (floorId) =>
  api.get(`/floors/${floorId}`)

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

export const validateFloor = (floorId) =>
  api.get(`/maps/floor/${floorId}/validate`)

// ── Navigation ────────────────────────────────────────────────
export const findRoomToExit = (roomId, algorithm = 'astar') =>
  api.get(`/navigation/room-to-exit?roomId=${roomId}&algorithm=${algorithm}`)

export const findRoomToExitMulti = (roomId, algorithm = 'astar') =>
  api.get(`/navigation/room-to-exit-multi?roomId=${roomId}&algorithm=${algorithm}`)

export const findPath = (fromNodeId, toNodeId, algorithm = 'astar') =>
  api.get(`/navigation/path?fromNodeId=${fromNodeId}&toNodeId=${toNodeId}&algorithm=${algorithm}`)

// ── Save entire floor plan ────────────────────────────────────
// Зберігає весь план: будівля → поверх → кімнати → вузли → ребра
export const saveFloorPlan = async ({ buildingName, floorNumber, rooms, nodes, edges }) => {
  // 1. Building
  const bRes = await createBuilding(buildingName, '')
  const buildingId = bRes.data.id

  // 2. Floor
  const fRes = await createFloor(buildingId, floorNumber, `${floorNumber} поверх`)
  const floorId = fRes.data.id

  // 3. Rooms
  const roomIdMap = {} // localId → backendId
  for (const room of rooms) {
    const rRes = await createRoom(floorId, room.label, room.type || 'room')
    roomIdMap[room.id] = rRes.data.id
  }

  // 4. Nodes
  const nodeIdMap = {} // localId → backendId
  for (const node of nodes) {
    const nRes = await createNode(floorId, {
      x: node.xMeters,
      y: node.yMeters,
      isExit: node.isExit,
      isStair: node.isStair,
      roomId: node.roomLocalId ? roomIdMap[node.roomLocalId] : null,
    })
    nodeIdMap[node.id] = nRes.data.id
  }

  // 5. Edges
  for (const edge of edges) {
    await createEdge({
      fromNodeId: nodeIdMap[edge.from],
      toNodeId: nodeIdMap[edge.to],
      length: edge.length,
      cost: edge.cost,
      isBlocked: false,
    })
  }

  return { buildingId, floorId, roomIdMap, nodeIdMap }
}

export default api