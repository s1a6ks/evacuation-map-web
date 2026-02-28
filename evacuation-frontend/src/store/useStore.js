import { create } from 'zustand'

const useStore = create((set) => ({
  // ── Режим ──────────────────────────────────────────────────
  mode: 'constructor',
  setMode: (mode) => set({ mode }),

  // ── Режим відображення ─────────────────────────────────────
  viewMode: 'simple',        // 'simple' | 'advanced'
  setViewMode: (v) => set({ viewMode: v }),

  // ── Режим евакуації ────────────────────────────────────────
  evacuationView: 'single',  // 'single' | 'all'
  setEvacuationView: (v) => set({ evacuationView: v }),
  allPaths: [],              // маршрути для всіх кімнат (загальний план)
  setAllPaths: (paths) => set({ allPaths: paths }),

  // ── Інструмент ─────────────────────────────────────────────
  tool: 'wall',
  setTool: (tool) => set({ tool }),

  // ── Поверхи ────────────────────────────────────────────────
  floors: [{ id: 1, name: '1 поверх' }],
  currentFloorId: 1,
  floorDataMap: {},  // { floorId: { walls, doors, exits, stairs } }

  addFloor: (name) => set(s => {
    const maxId = s.floors.reduce((m, f) => Math.max(m, f.id), 0)
    const newId = maxId + 1
    // Зберігаємо поточний поверх
    const saved = { ...s.floorDataMap }
    saved[s.currentFloorId] = {
      walls: s.walls, doors: s.doors, exits: s.exits, stairs: s.stairs, extinguishers: s.extinguishers,
    }
    return {
      floors: [...s.floors, { id: newId, name: name || `${newId} поверх` }],
      currentFloorId: newId,
      floorDataMap: saved,
      // Очищаємо canvas для нового поверху
      walls: [], doors: [], exits: [], stairs: [], extinguishers: [],
      detectedRooms: [], graphNodes: [], graphEdges: [],
      currentPath: null, multiFloorPath: null, allPaths: [], selectedRoomId: null,
    }
  }),

  switchFloor: (floorId) => set(s => {
    if (floorId === s.currentFloorId) return s
    // Зберігаємо поточний поверх
    const saved = { ...s.floorDataMap }
    saved[s.currentFloorId] = {
      walls: s.walls, doors: s.doors, exits: s.exits, stairs: s.stairs, extinguishers: s.extinguishers,
    }
    // Завантажуємо цільовий поверх
    const target = saved[floorId] || { walls: [], doors: [], exits: [], stairs: [], extinguishers: [] }
    return {
      currentFloorId: floorId,
      floorDataMap: saved,
      walls: target.walls,
      doors: target.doors,
      exits: target.exits,
      stairs: target.stairs,
      extinguishers: target.extinguishers ?? [],
      // Скидаємо залежні дані — перерахуються автоматично
      // currentPath і multiFloorPath НЕ скидаємо — щоб маршрут зберігався при переключенні поверху
      detectedRooms: [], graphNodes: [], graphEdges: [],
      allPaths: [], selectedRoomId: null,
    }
  }),

  removeFloor: (floorId) => set(s => {
    if (s.floors.length <= 1) return s  // не видаляти останній
    const newFloors = s.floors.filter(f => f.id !== floorId)
    const saved = { ...s.floorDataMap }
    delete saved[floorId]
    // Якщо видаляємо поточний — перемикаємось на перший
    if (floorId === s.currentFloorId) {
      const target = saved[newFloors[0].id] || { walls: [], doors: [], exits: [], stairs: [] }
      return {
        floors: newFloors,
        currentFloorId: newFloors[0].id,
        floorDataMap: saved,
        walls: target.walls, doors: target.doors,
        exits: target.exits, stairs: target.stairs,
        detectedRooms: [], graphNodes: [], graphEdges: [],
        currentPath: null, multiFloorPath: null, allPaths: [], selectedRoomId: null,
      }
    }
    return { floors: newFloors, floorDataMap: saved }
  }),

  renameFloor: (floorId, name) => set(s => ({
    floors: s.floors.map(f => f.id === floorId ? { ...f, name } : f),
  })),

  // ── Дані плану ─────────────────────────────────────────────
  walls: [],
  doors: [],
  exits: [],
  stairs: [],
  extinguishers: [],

  addWall:  (wall)  => set(s => ({ walls:  [...s.walls,  wall]  })),
  addDoor:  (door)  => set(s => ({ doors:  [...s.doors,  door]  })),
  addExit:  (exit)  => set(s => ({ exits:  [...s.exits,  exit]  })),
  renameExit: (idx, label) => set(s => ({
    exits: s.exits.map((e, i) => i === idx ? { ...e, label } : e),
  })),
  addStair: (stair) => set(s => ({ stairs: [...s.stairs, stair] })),

  removeWall:  (idx) => set(s => ({ walls:  s.walls.filter((_,  i) => i !== idx) })),
  removeDoor:  (idx) => set(s => ({ doors:  s.doors.filter((_,  i) => i !== idx) })),
  removeExit:  (idx) => set(s => ({ exits:  s.exits.filter((_,  i) => i !== idx) })),
  removeStair:        (idx) => set(s => ({ stairs:        s.stairs.filter((_, i) => i !== idx) })),
  addExtinguisher:    (e)   => set(s => ({ extinguishers: [...s.extinguishers, e] })),
  removeExtinguisher: (idx) => set(s => ({ extinguishers: s.extinguishers.filter((_, i) => i !== idx) })),

  // ── Кімнати ────────────────────────────────────────────────
  detectedRooms: [],
  setDetectedRooms: (rooms) => set({ detectedRooms: rooms }),
  setRoomName: (roomId, name) => set(s => ({
    detectedRooms: s.detectedRooms.map(r => r.id === roomId ? { ...r, label: name } : r)
  })),
  selectedRoomId: null,
  setSelectedRoomId: (id) => set(s => ({
    selectedRoomId: s.selectedRoomId === id ? null : id,
  })),

  // ── Граф ───────────────────────────────────────────────────
  graphNodes: [],
  graphEdges: [],
  setGraph: (nodes, edges) => set({ graphNodes: nodes, graphEdges: edges }),

  // ── Навігація ──────────────────────────────────────────────
  algorithm: 'astar',
  setAlgorithm: (algo) => set({ algorithm: algo }),
  currentPath: null,
  setCurrentPath: (path) => set({ currentPath: path, multiFloorPath: null }),
  algorithmMetrics: null,  // { astar: { ms, visited, distPx }, dijkstra: { ... } }
  setAlgorithmMetrics: (m) => set({ algorithmMetrics: m }),
  // Багатоповерховий маршрут: [{ floorId, path }]
  multiFloorPath: null,
  setMultiFloorPath: (segments) => set({ multiFloorPath: segments, currentPath: null }),

  // ── Блокування виходів і дверей (симуляція сценаріїв) ────
  blockedExits: [],   // індекси заблокованих виходів
  blockedDoors: [],   // індекси заблокованих дверей
  toggleBlockedExit: (idx) => set(s => ({
    blockedExits: s.blockedExits.includes(idx)
      ? s.blockedExits.filter(i => i !== idx)
      : [...s.blockedExits, idx],
  })),
  toggleBlockedDoor: (idx) => set(s => ({
    blockedDoors: s.blockedDoors.includes(idx)
      ? s.blockedDoors.filter(i => i !== idx)
      : [...s.blockedDoors, idx],
  })),
  clearBlockages: () => set({ blockedExits: [], blockedDoors: [] }),

  // ── З'єднання сходів між поверхами ───────────────────────
  // stairLinks: { "floorId:x:y": { toFloorId, toX, toY } }
  stairLinks: {},
  setStairLink: (fromFloorId, fromX, fromY, toFloorId, toX, toY) => set(s => {
    const key = `${fromFloorId}:${fromX}:${fromY}`
    const reverseKey = `${toFloorId}:${toX}:${toY}`
    const links = { ...s.stairLinks }
    if (toFloorId === null) {
      delete links[key]
      // видаляємо зворотний зв'язок
      Object.keys(links).forEach(k => {
        if (links[k]?.toFloorId === fromFloorId && links[k]?.toX === fromX && links[k]?.toY === fromY) {
          delete links[k]
        }
      })
    } else {
      links[key] = { toFloorId, toX, toY }
      links[reverseKey] = { toFloorId: fromFloorId, toX: fromX, toY: fromY }
    }
    return { stairLinks: links }
  }),
  selectedStairInfo: null, // { floorId, x, y, idx }
  setSelectedStairInfo: (info) => set({ selectedStairInfo: info }),

  // ── Курсор ─────────────────────────────────────────────────
  mousePos: { x: 0, y: 0 },
  setMousePos: (pos) => set({ mousePos: pos }),

  // ── Зум / пан ──────────────────────────────────────────────
  scale: 1,
  offset: { x: 0, y: 0 },
  setTransform: (scale, offset) => set({ scale, offset }),
  resetTransform: () => set({ scale: 1, offset: { x: 0, y: 0 } }),

  // ── Бекенд IDs ─────────────────────────────────────────────
  buildingId: null,
  floorId: null,
  setBuildingId: (id) => set({ buildingId: id }),
  setFloorId:    (id) => set({ floorId: id }),

  // ── Маппінг локальних ID → бекенд ID ──────────────────────
  roomIdMap: {},
  nodeIdMap: {},
  setIdMaps: (roomIdMap, nodeIdMap) => set({ roomIdMap, nodeIdMap }),

  // ── Збереження ─────────────────────────────────────────────
  currentPlanName: 'Новий план',
  setCurrentPlanName: (name) => set({ currentPlanName: name }),

  isSaving: false,
  setIsSaving: (v) => set({ isSaving: v }),

  lastSaved: null,
  setLastSaved: (date) => set({ lastSaved: date }),

  autoSave: true,
  setAutoSave: (v) => set({ autoSave: v }),

  // ── Undo ───────────────────────────────────────────────────
  history: [],
  pushHistory: () => set(s => ({
    history: [...s.history, {
      walls:        [...s.walls],
      doors:        [...s.doors],
      exits:        [...s.exits],
      stairs:       [...s.stairs],
      extinguishers:[...s.extinguishers],
    }]
  })),
  undo: () => set(s => {
    if (!s.history.length) return s
    const prev = s.history[s.history.length - 1]
    return { ...prev, history: s.history.slice(0, -1) }
  }),

  // ── Очистити все ───────────────────────────────────────────
  clearAll: () => set({
    walls: [], doors: [], exits: [], stairs: [], extinguishers: [],
    detectedRooms: [], graphNodes: [], graphEdges: [],
    currentPath: null, multiFloorPath: null, allPaths: [], history: [],
    stairLinks: {}, selectedStairInfo: null,
    buildingId: null, floorId: null, viewMode: 'simple',
    roomIdMap: {}, nodeIdMap: {},
    selectedRoomId: null, lastSaved: null,
    currentPlanName: 'Новий план',
    floors: [{ id: 1, name: '1 поверх' }],
    currentFloorId: 1,
    floorDataMap: {},
  }),
}))

export default useStore