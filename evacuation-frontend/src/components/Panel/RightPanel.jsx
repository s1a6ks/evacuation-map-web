import { useState } from 'react'
import useStore from '../../store/useStore'
import EvacuationPanel from './EvacuationPanel'
import { exportPlanToPDF, exportAllFloorsToPNG } from '../../utils/pdfExport'

const COLORS = ['#4d9fff', '#22c984', '#f5c542', '#ff4422', '#c084fc', '#fb923c']

export default function RightPanel() {
  const {
    mode, detectedRooms, graphNodes, graphEdges,
    walls, doors, exits, stairs, windows, extinguishers,
    selectedRoomId, setSelectedRoomId, viewMode,
    selectedStairInfo, setSelectedStairInfo, setStairLink,
    setRoomName,
    stairLinks, floors, currentFloorId, floorDataMap,
    currentPath, allPaths, evacuationView, multiFloorPath,
    blockedExits, blockedDoors,
  } = useStore()

  const [editingRoom, setEditingRoom] = useState(null)
  const [roomNameInput, setRoomNameInput] = useState('')
  const [editingExit, setEditingExit] = useState(null)
  const [exitNameInput, setExitNameInput] = useState('')

  const currentPlanName = useStore(s => s.currentPlanName)
  const renameExit = useStore(s => s.renameExit)

  function currentFloorData() {
    return { walls, doors, exits, stairs, windows, extinguishers, detectedRooms }
  }

  function routeData() {
    return {
      currentPath,
      allPaths,
      evacuationView,
      multiFloorPath,
      currentFloorId,
      graphNodes,
      graphEdges,
      detectedRooms,
      stairLinks,
      blockedExits,
      blockedDoors,
      exits,
      doors,
      multiRoomPaths: useStore.getState().multiRoomPaths,
    }
  }

  // ── PNG Export (всі поверхи) ──────────────────────────────────
  function handleExportPNG() {
    exportAllFloorsToPNG(currentPlanName || 'План', floors, floorDataMap, currentFloorId, currentFloorData(), routeData())
  }

  // ── PDF Export (всі поверхи) ──────────────────────────────────
  function handleExportPDF() {
    exportPlanToPDF(currentPlanName || 'План', floors, floorDataMap, currentFloorId, currentFloorData(), routeData())
  }

  // ── Stair connection UI ──────────────────────────────────────
  const stairLink = selectedStairInfo
    ? stairLinks[`${selectedStairInfo.floorId}:${selectedStairInfo.x}:${selectedStairInfo.y}`]
    : null

  // Інші поверхи та їхні сходи
  const otherFloors = floors.filter(f => f.id !== currentFloorId)
  const stairTargets = otherFloors.flatMap(f => {
    const floorData = floorDataMap[f.id] || { stairs: [] }
    return (floorData.stairs || []).map((stair, idx) => ({
      floorId: f.id,
      floorName: f.name,
      stair,
      idx,
      value: `${f.id}:${idx}`,
    }))
  })

  const selectedTargetValue = stairLink
    ? stairTargets.find(target =>
      target.floorId === stairLink.toFloorId &&
      Math.hypot(target.stair.x - stairLink.toX, target.stair.y - stairLink.toY) < 2
    )?.value ?? ''
    : ''

  function handleStairConnect(targetValue) {
    if (!selectedStairInfo) return
    const { floorId, x, y } = selectedStairInfo

    if (targetValue === '') {
      // Видалити зв'язок
      setStairLink(floorId, x, y, null, null, null)
      return
    }

    const target = stairTargets.find(item => item.value === targetValue)
    if (!target) return

    setStairLink(floorId, x, y, target.floorId, target.stair.x, target.stair.y)
  }

  function getLinkedStairLabel() {
    if (!stairLink) return ''
    const target = stairTargets.find(item =>
      item.floorId === stairLink.toFloorId &&
      Math.hypot(item.stair.x - stairLink.toX, item.stair.y - stairLink.toY) < 2
    )
    if (target) return `${target.floorName} — Сходи ${target.idx + 1}`
    return floors.find(f => f.id === stairLink.toFloorId)?.name || 'іншим поверхом'
  }

  return (
    <div
      className="bg-[#f7f7f7] border-l border-[#e0e0e0] flex flex-col overflow-hidden flex-shrink-0"
      style={{ width: '220px', minWidth: '220px', maxWidth: '220px' }}
    >
      {/* Header + Export */}
      <div className="px-4 py-3 border-b border-[#f0f0f0] flex items-center justify-between flex-shrink-0">
        <div className="text-[11px] font-semibold text-[#8d8d8d] uppercase tracking-widest">
          {mode === 'constructor' ? 'Конструктор' : 'Евакуація'}
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleExportPNG}
            title="Зберегти як PNG"
            className="text-[10px] px-2 py-[3px] rounded-md bg-[#f0f0f0] hover:bg-[#e0e0e0] text-[#555] transition-all"
          >
            PNG
          </button>
          <button
            onClick={handleExportPDF}
            title="Зберегти як PDF"
            className="text-[10px] px-2 py-[3px] rounded-md bg-[#f0f0f0] hover:bg-[#e0e0e0] text-[#555] transition-all"
          >
            PDF
          </button>
        </div>
      </div>

      {/* ── Евакуація ── */}
      {mode === 'evacuation' && (
        <div className="flex-1 overflow-y-auto">
          <EvacuationPanel />
        </div>
      )}

      {/* ── Конструктор ── */}
      {mode === 'constructor' && (
        <>
          {/* Stats */}
          <div className="px-4 py-3 border-b border-[#f0f0f0]">
            <div className="text-[10px] font-semibold text-[#8d8d8d] uppercase tracking-widest mb-2">План</div>
            <div className="flex flex-col gap-2">
              <Row label="Стін"    value={walls.length} />
              <Row label="Дверей"  value={doors.length} />
              <Row label="Вікон"   value={windows.length} />
              <Row label="Виходів" value={exits.length}         color="#22c984" />
              <Row label="Кімнат"  value={detectedRooms.length} color="#22c984" />
              <Row label="Сходів"  value={stairs.length}        color="#f5c542" />
            </div>
          </div>

          {/* Exits list */}
          {exits.length > 0 && (
            <div className="px-4 py-3 border-b border-[#f0f0f0]">
              <div className="text-[10px] font-semibold text-[#8d8d8d] uppercase tracking-widest mb-2">Виходи</div>
              <div className="flex flex-col gap-[2px]">
                {exits.map((exit, idx) => (
                  editingExit === idx ? (
                    <input
                      key={idx}
                      autoFocus
                      value={exitNameInput}
                      onChange={e => setExitNameInput(e.target.value)}
                      onBlur={() => {
                        if (exitNameInput.trim()) renameExit(idx, exitNameInput.trim())
                        setEditingExit(null)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { if (exitNameInput.trim()) renameExit(idx, exitNameInput.trim()); setEditingExit(null) }
                        if (e.key === 'Escape') setEditingExit(null)
                      }}
                      className="text-[12px] bg-white border border-[#22c984] rounded-md px-2 py-[4px] outline-none w-full"
                    />
                  ) : (
                    <button
                      key={idx}
                      onDoubleClick={() => { setEditingExit(idx); setExitNameInput(exit.label || `Вихід ${idx + 1}`) }}
                      className="flex items-center gap-2 py-[6px] px-2 rounded-md hover:bg-[#f0f0f0] transition-all text-left w-full"
                      title="Подвійний клік, щоб перейменувати"
                    >
                      <div className="w-2 h-2 rounded-sm flex-shrink-0 bg-[#22c984]" />
                        <span className="text-[12px] flex-1 truncate text-[#444]">
                          {exit.label || `Вихід ${idx + 1}`}
                        </span>
                    </button>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Graph — тільки в advanced */}
          {viewMode === 'advanced' && (
            <div className="px-4 py-3 border-b border-[#f0f0f0]">
              <div className="text-[10px] font-semibold text-[#8d8d8d] uppercase tracking-widest mb-2">Граф</div>
              <div className="flex flex-col gap-2">
                <Row label="Вузлів" value={graphNodes.length} />
                <Row label="Ребер"  value={graphEdges.length} />
              </div>
            </div>
          )}

          {/* ── Виділені сходи ── */}
          {selectedStairInfo && selectedStairInfo.floorId === currentFloorId && (
            <div className="px-4 py-3 border-b border-[#f0f0f0] bg-[#fffbeb]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-semibold text-[#92400e] uppercase tracking-widest">Сходи</div>
                <button
                  onClick={() => setSelectedStairInfo(null)}
                  className="text-[10px] text-[#999] hover:text-[#ff4422]"
                >✕</button>
              </div>

              {otherFloors.length === 0 ? (
                <div className="text-[11px] text-[#8d8d8d] py-1">
                  Додайте ще поверхи щоб з'єднати сходи
                </div>
              ) : stairTargets.length === 0 ? (
                <div className="text-[11px] text-[#8d8d8d] py-1 leading-relaxed">
                  На інших поверхах немає сходів. Додайте сходи на потрібному поверсі.
                </div>
              ) : (
                <>
                  <div className="text-[11px] text-[#555] mb-1.5">З'єднати зі сходами:</div>
                  <select
                    value={selectedTargetValue}
                    onChange={e => handleStairConnect(e.target.value)}
                    className="w-full text-[11px] border border-[#e0e0e0] rounded-md px-2 py-[5px] bg-white outline-none focus:border-[#f5c542]"
                  >
                    <option value="">— не з'єднано —</option>
                    {stairTargets.map(target => (
                      <option key={target.value} value={target.value}>
                        {target.floorName} — Сходи {target.idx + 1}
                      </option>
                    ))}
                  </select>
                  {stairLink && (
                    <div className="mt-1.5 text-[10px] text-[#22c984]">
                      З'єднано з {getLinkedStairLabel()}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Rooms list */}
          {detectedRooms.length > 0 && (
            <div className="px-4 py-3 border-b border-[#f0f0f0] flex-1 overflow-y-auto">
              <div className="text-[10px] font-semibold text-[#8d8d8d] uppercase tracking-widest mb-2">Кімнати</div>
              <div className="flex flex-col gap-[2px]">
                {detectedRooms.map((room, idx) => {
                  const isSelected = selectedRoomId === room.id
                  return editingRoom === room.id ? (
                    <input
                      key={room.id}
                      autoFocus
                      value={roomNameInput}
                      onChange={e => setRoomNameInput(e.target.value)}
                      onBlur={() => { if (roomNameInput.trim()) setRoomName(room.id, roomNameInput.trim()); setEditingRoom(null) }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { if (roomNameInput.trim()) setRoomName(room.id, roomNameInput.trim()); setEditingRoom(null) }
                        if (e.key === 'Escape') setEditingRoom(null)
                      }}
                      className="text-[12px] bg-white border border-[#ff4422] rounded-md px-2 py-[4px] outline-none w-full"
                    />
                  ) : (
                    <button
                      key={room.id}
                      onClick={() => setSelectedRoomId(room.id)}
                      onDoubleClick={() => { setEditingRoom(room.id); setRoomNameInput(room.label) }}
                      className={`flex items-center gap-2 py-[6px] px-2 rounded-md transition-all text-left w-full ${
                        isSelected
                          ? 'bg-[#fff0ee] ring-1 ring-[#ff4422]/30'
                          : 'hover:bg-[#f0f0f0]'
                      }`}
                      title="Подвійний клік, щоб перейменувати"
                    >
                      <div
                        className="w-2 h-2 rounded-sm flex-shrink-0"
                        style={{ background: COLORS[idx % COLORS.length] }}
                      />
                      <span className={`text-[12px] flex-1 truncate ${isSelected ? 'text-[#ff4422] font-medium' : 'text-[#555]'}`}>
                        {room.label}
                      </span>
                      <span className="text-[10px] text-[#9a9a9a] font-mono flex-shrink-0">
                        {room.areaM2}м²
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!walls.length && !selectedStairInfo && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
                            <div className="text-[11px] text-[#8d8d8d] leading-relaxed">
                Оберіть інструмент і намалюйте план
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Row({ label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[#7a7a7a]">{label}</span>
      <span className="text-[12px] font-mono font-medium" style={{ color: color || '#1a1a1a' }}>{value}</span>
    </div>
  )
}
