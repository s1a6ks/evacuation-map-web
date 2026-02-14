import { create } from 'zustand'

const useStore = create((set) => ({
  // ── Режим ──────────────────────────────────────────────────
  mode: 'constructor', // 'constructor' | 'evacuation'
  setMode: (mode) => set({ mode }),

  // ── Інструмент ─────────────────────────────────────────────
  tool: 'wall', // 'wall' | 'door' | 'exit' | 'stair' | 'erase' | 'select'
  setTool: (tool) => set({ tool }),

  // ── Дані плану ─────────────────────────────────────────────
  walls: [],
  doors: [],
  exits: [],
  stairs: [],

  addWall:   (wall)  => set(s => ({ walls:  [...s.walls,  wall]  })),
  addDoor:   (door)  => set(s => ({ doors:  [...s.doors,  door]  })),
  addExit:   (exit)  => set(s => ({ exits:  [...s.exits,  exit]  })),
  addStair:  (stair) => set(s => ({ stairs: [...s.stairs, stair] })),

  removeWall: (idx) => set(s => ({ walls: s.walls.filter((_,i) => i !== idx) })),

  // ── Кімнати (автодетекція) ─────────────────────────────────
  detectedRooms: [],
  setDetectedRooms: (rooms) => set({ detectedRooms: rooms }),
  selectedRoomId: null,
  setSelectedRoomId: (id) => set({ selectedRoomId: id }),

  // ── Граф (автогенерація) ───────────────────────────────────
  graphNodes: [],
  graphEdges: [],
  setGraph: (nodes, edges) => set({ graphNodes: nodes, graphEdges: edges }),

  // ── Навігація ──────────────────────────────────────────────
  algorithm: 'astar', // 'astar' | 'dijkstra'
  setAlgorithm: (algo) => set({ algorithm: algo }),
  currentPath: null,
  setCurrentPath: (path) => set({ currentPath: path }),

  // ── Бекенд IDs ────────────────────────────────────────────
  buildingId: null,
  floorId: null,
  setBuildingId: (id) => set({ buildingId: id }),
  setFloorId: (id) => set({ floorId: id }),

  // ── Undo/Redo ──────────────────────────────────────────────
  history: [],
  pushHistory: () => set(s => ({
    history: [...s.history, {
      walls: [...s.walls],
      doors: [...s.doors],
      exits: [...s.exits],
      stairs: [...s.stairs],
    }]
  })),
  undo: () => set(s => {
    if (!s.history.length) return s
    const prev = s.history[s.history.length - 1]
    return { ...prev, history: s.history.slice(0, -1) }
  }),

  // ── Очистити все ───────────────────────────────────────────
  clearAll: () => set({
    walls: [], doors: [], exits: [], stairs: [],
    detectedRooms: [], graphNodes: [], graphEdges: [],
    currentPath: null, history: [],
    buildingId: null, floorId: null,
  }),
}))

export default useStore