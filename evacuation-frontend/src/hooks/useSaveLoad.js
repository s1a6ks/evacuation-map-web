import { useEffect, useRef, useCallback } from 'react'
import useStore from '../store/useStore'
import { saveFloorPlan, loadFloorPlan } from '../services/api'

const GRID = 20
const METER = 0.5
const LS_KEY = 'evacroute_plans'
const AUTOSAVE_DELAY = 3000

// ── localStorage helpers ──────────────────────────────────────
export function getLsPlans() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function setLsPlans(plans) {
  localStorage.setItem(LS_KEY, JSON.stringify(plans))
}

function genLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function pxToM(px) {
  return (px / GRID) * METER
}

function preparePayload(state, planName) {
  const { walls, doors, exits, stairs, extinguishers, graphNodes, graphEdges, detectedRooms } = state

  const nodes = graphNodes.map(n => ({
    id:          n.id,
    xMeters:     pxToM(n.x),
    yMeters:     pxToM(n.y),
    isExit:      n.isExit,
    isStair:     n.isStair,
    roomLocalId: n.roomId ?? null,
  }))

  const edges = graphEdges.map(e => ({
    from:   e.from,
    to:     e.to,
    length: pxToM(e.length),
    cost:   e.isStair ? 2.0 : 1.0,
  }))

  return {
    buildingName: planName,
    floorNumber:  1,
    rooms:        detectedRooms,
    nodes,
    edges,
    _raw: { walls, doors, exits, stairs, extinguishers },
  }
}

export default function useSaveLoad() {
  const store = useStore()
  const {
    walls, doors, exits, stairs, extinguishers,
    graphNodes, graphEdges, detectedRooms,
    setBuildingId, setFloorId, setIdMaps,
    setGraph, clearAll,
    isSaving, setIsSaving,
    lastSaved, setLastSaved,
    autoSave,
    currentPlanName, setCurrentPlanName,
  } = store

  const autoSaveTimer = useRef(null)
  const lastWallsRef  = useRef(null)

  // ── SAVE ────────────────────────────────────────────────────
  // Стратегія: спочатку завжди зберігаємо локально (щоб план
  // точно з'явився в списку), потім намагаємось синхронізувати
  // з бекендом. Якщо бекенд недоступний — план є локально.
  const save = useCallback(async (nameOverride) => {
    if (walls.length === 0) return
    const planName = nameOverride ?? currentPlanName ?? 'Без назви'

    setIsSaving(true)
    try {
      const payload = preparePayload(
        { walls, doors, exits, stairs, extinguishers, graphNodes, graphEdges, detectedRooms },
        planName
      )

      // 1. ── Завжди зберігаємо локально першим ────────────────
      const plans = getLsPlans()
      const existingIdx = plans.findIndex(p => p.name === planName)
      const existingEntry = existingIdx >= 0 ? plans[existingIdx] : null

      // Використовуємо існуючий id або генеруємо локальний
      const localId = existingEntry?.id ?? useStore.getState().buildingId ?? genLocalId()

      const localEntry = {
        id:         localId,
        buildingId: existingEntry?.buildingId ?? null,
        floorId:    existingEntry?.floorId ?? null,
        name:       planName,
        savedAt:    new Date().toISOString(),
        raw:        payload._raw,
        localOnly:  true,   // позначаємо — ще не синхронізовано
      }

      if (existingIdx >= 0) {
        plans[existingIdx] = localEntry
      } else {
        plans.push(localEntry)
      }
      setLsPlans(plans)
      setLastSaved(new Date())
      setCurrentPlanName(planName)

      // 2. ── Намагаємось синхронізувати з бекендом ────────────
      try {
        const currentBuildingId = useStore.getState().buildingId
        const { buildingId: bId, floorId: fId, roomIdMap, nodeIdMap } = await saveFloorPlan({
          ...payload,
          existingBuildingId: currentBuildingId,
        })
        setBuildingId(bId)
        setFloorId(fId)
        setIdMaps(roomIdMap, nodeIdMap)

        // Оновлюємо localStorage запис з бекенд-IDs
        // id НЕ перезаписуємо — URL має залишатись стабільним (local_xxx або числовий)
        const freshPlans = getLsPlans()
        const idx = freshPlans.findIndex(p => p.name === planName)
        if (idx >= 0) {
          freshPlans[idx] = {
            ...freshPlans[idx],
            buildingId: bId,
            floorId:    fId,
            localOnly:  false,
          }
          setLsPlans(freshPlans)
        }
      } catch {
        // Бекенд недоступний — план вже збережено локально, все ок
        console.warn('[useSaveLoad] backend offline — plan saved locally only')
      }
    } catch (err) {
      console.error('[useSaveLoad] save error:', err)
    } finally {
      setIsSaving(false)
    }
  }, [walls, doors, exits, stairs, extinguishers, graphNodes, graphEdges, detectedRooms, currentPlanName,
      setBuildingId, setFloorId, setIdMaps, setIsSaving, setLastSaved, setCurrentPlanName])

  // ── LOAD ────────────────────────────────────────────────────
  const loadPlan = useCallback(async (plan) => {
    clearAll()

    const { raw, buildingId: bId, floorId: fId, name } = plan
    const { addWall, addDoor, addExit, addStair, addExtinguisher } = useStore.getState()

    if (raw) {
      raw.walls?.forEach(w  => addWall(w))
      raw.doors?.forEach(d  => addDoor(d))
      raw.exits?.forEach(e  => addExit(e))
      raw.stairs?.forEach(s => addStair(s))
      raw.extinguishers?.forEach(ex => addExtinguisher(ex))
    }

    setBuildingId(bId ?? null)
    setFloorId(fId ?? null)
    setCurrentPlanName(name)

    // Намагаємось завантажити граф з бекенду якщо є floorId
    if (fId) {
      try {
        const { nodes, edges } = await loadFloorPlan(fId)
        setGraph(nodes, edges)
      } catch {
        console.warn('[useSaveLoad] backend offline — graph will regenerate locally')
      }
    }
  }, [clearAll, setBuildingId, setFloorId, setCurrentPlanName, setGraph])

  // ── NEW PLAN ─────────────────────────────────────────────────
  const newPlan = useCallback((name = 'Новий план') => {
    clearAll()
    setCurrentPlanName(name)
  }, [clearAll, setCurrentPlanName])

  // ── AUTOSAVE ─────────────────────────────────────────────────
  useEffect(() => {
    if (!autoSave) return
    if (walls.length === 0) return
    const wallsKey = JSON.stringify(walls)
    if (wallsKey === lastWallsRef.current) return
    lastWallsRef.current = wallsKey

    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => save(), AUTOSAVE_DELAY)

    return () => clearTimeout(autoSaveTimer.current)
  }, [walls, autoSave, save])

  const lastSavedLabel = lastSaved
    ? `Збережено о ${lastSaved.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`
    : null

  return { save, loadPlan, newPlan, isSaving, lastSavedLabel, plans: getLsPlans() }
}