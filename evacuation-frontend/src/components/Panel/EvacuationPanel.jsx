import useStore from '../../store/useStore'
import { computeRouteMetrics, computeSafetyAnalysis } from '../../utils/evacAnalysis'

const GRID = 20
const METER = 0.5
const WALK_SPEED = 1.4

const LEVEL_STYLES = {
  ok:      { bg: '#f0fdf4', border: '#86efac', dot: '#22c984', text: '#166534' },
  warning: { bg: '#fffbeb', border: '#fcd34d', dot: '#f5c542', text: '#92400e' },
  error:   { bg: '#fff1f2', border: '#fca5a5', dot: '#ff4422', text: '#991b1b' },
}

function pxToM(px) { return (px / GRID) * METER }

function Section({ title, children }) {
  return (
    <div className="px-4 py-3 border-b border-[#f0f0f0]">
      <div className="text-[10px] font-semibold text-[#bbb] uppercase tracking-widest mb-2">{title}</div>
      {children}
    </div>
  )
}

function MetricRow({ icon, label, value, sub, highlight }) {
  return (
    <div className="flex items-start gap-2 py-[4px]">
      <span className="text-[13px] mt-[1px] flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-[#888]">{label}</div>
        <div className="text-[12px] font-medium" style={{ color: highlight || '#1a1a1a' }}>{value}</div>
        {sub && <div className="text-[10px] text-[#bbb] font-mono">{sub}</div>}
      </div>
    </div>
  )
}

export default function EvacuationPanel() {
  const {
    currentPath, multiFloorPath, graphNodes, graphEdges,
    detectedRooms, doors, exits,
    algorithm, setAlgorithm,
    evacuationView, setEvacuationView,
    allPaths, setAllPaths,
    selectedRoomId, setCurrentPath, setSelectedRoomId, setMultiFloorPath,
    algorithmMetrics, currentFloorId,
    blockedExits, blockedDoors, clearBlockages,
  } = useStore()

  // Активний маршрут (з multiFloorPath або currentPath)
  const activePath = (() => {
    if (multiFloorPath) {
      const seg = multiFloorPath.find(s => s.floorId === currentFloorId)
      return seg?.path ?? null
    }
    return currentPath
  })()

  const isMultiFloor = !!multiFloorPath && multiFloorPath.length > 1

  const metrics  = computeRouteMetrics(activePath, graphEdges, doors)
  const analysis = computeSafetyAnalysis(graphNodes, graphEdges, detectedRooms)
  const hasGraph = graphNodes.length > 0
  const selectedRoom = detectedRooms.find(r => r.id === selectedRoomId)

  function handleClearRoute() {
    setCurrentPath(null)
    setMultiFloorPath(null)
    setSelectedRoomId(null)
  }

  return (
    <div className="flex flex-col overflow-hidden flex-1">

      {/* ── Алгоритм ── */}
      <Section title="Алгоритм">
        <div className="flex gap-1.5">
          {['astar', 'dijkstra'].map(alg => (
            <button
              key={alg}
              onClick={() => setAlgorithm(alg)}
              className={`flex-1 py-[5px] rounded-md text-[11px] font-medium transition-all border ${
                algorithm === alg
                  ? 'bg-[#ff4422] text-white border-[#ff4422]'
                  : 'bg-white text-[#888] border-[#e0e0e0] hover:border-[#ccc]'
              }`}
            >
              {alg === 'astar' ? 'A*' : 'Dijkstra'}
            </button>
          ))}
        </div>
        <div className="mt-1.5 text-[10px] text-[#bbb] leading-relaxed">
          {algorithm === 'astar'
            ? 'A* — евристика, швидше на великих планах'
            : 'Dijkstra — гарантує оптимальний шлях'}
        </div>

        </Section>

      {/* ── Вид евакуації ── */}
      <Section title="Вид">
        <div className="flex gap-1.5">
          {[
            { id: 'single', label: '📍 З кімнати' },
            { id: 'all',    label: '🗺 Загальний' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => {
                setEvacuationView(id)
                if (id === 'single') { setAllPaths([]) }
                else { setCurrentPath(null); setMultiFloorPath(null); setSelectedRoomId(null) }
              }}
              className={`flex-1 py-[5px] rounded-md text-[11px] font-medium transition-all border ${
                evacuationView === id
                  ? 'bg-[#ff4422] text-white border-[#ff4422]'
                  : 'bg-white text-[#888] border-[#e0e0e0] hover:border-[#ccc]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 text-[10px] text-[#bbb] leading-relaxed">
          {evacuationView === 'single'
            ? 'Клікніть на кімнату для маршруту'
            : `Клікніть на полотно щоб показати всі маршрути${allPaths.length > 0 ? ` · ${allPaths.length} маршрутів` : ''}`
          }
        </div>
      </Section>

      {/* ── Маршрут ── */}
      <Section title="Маршрут">
        {!selectedRoom ? (
          <div className="text-[11px] text-[#bbb] py-1 leading-relaxed">
            👆 Клікніть на кімнату щоб побудувати маршрут до виходу
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[11px] text-[#888]">Обрана кімната</div>
                <div className="text-[13px] font-semibold text-[#1a1a1a]">{selectedRoom.label}</div>
                <div className="text-[10px] text-[#bbb] font-mono">{selectedRoom.areaM2} м²</div>
              </div>
              <button
                onClick={handleClearRoute}
                className="text-[10px] text-[#ccc] hover:text-[#ff4422] transition-colors px-1"
              >✕</button>
            </div>

            {isMultiFloor && (
              <div className="mb-2 px-2 py-1.5 rounded-md text-[10px] bg-[#fffbeb] border border-[#fcd34d] text-[#92400e]">
                ⊞ Маршрут через {multiFloorPath.length} поверхи — перемкніть поверх щоб побачити продовження
              </div>
            )}

            {metrics ? (
              <>
                <MetricRow
                  icon="📏"
                  label="Відстань"
                  value={`${metrics.distanceM} м`}
                  sub={`${metrics.nodeCount} вузлів · ${algorithm.toUpperCase()}`}
                />
                <MetricRow
                  icon="⏱"
                  label="Орієнтовний час"
                  value={`~${metrics.timeS} сек`}
                  sub="швидкість 1.4 м/с"
                />
                {metrics.doorCount > 0 && (
                  <MetricRow
                    icon="🚪"
                    label="Проходів"
                    value={`${metrics.doorCount}`}
                  />
                )}
                {/* Нормативна перевірка ДБН В.1.1-7 */}
                {(() => {
                  const dist = parseFloat(metrics.distanceM)
                  if (dist > 25) {
                    return (
                      <div className="mt-2 px-2 py-1.5 rounded-md text-[10px] bg-[#fffbeb] border border-[#fcd34d] text-[#92400e]">
                        ⚠️ ДБН В.1.1-7: відстань {metrics.distanceM}м перевищує рекомендовані 25м
                      </div>
                    )
                  }
                  return null
                })()}
                <div
                  className="mt-2 px-2 py-1.5 rounded-md text-[11px] font-medium"
                  style={metrics.reachesExit
                    ? { background: '#f0fdf4', color: '#166534' }
                    : { background: '#fff1f2', color: '#991b1b' }
                  }
                >
                  {metrics.reachesExit
                    ? '✅ Маршрут веде до виходу'
                    : isMultiFloor
                      ? '⊞ Маршрут через сходи на інший поверх'
                      : '⚠️ Маршрут не досягає виходу'}
                </div>
              </>
            ) : (
              <div className="text-[11px] text-[#ff4422] py-1">
                ⚠️ Виходів не знайдено — додайте EXIT або з'єднайте сходи
              </div>
            )}
          </>
        )}
      </Section>

      {/* ── Порівняння алгоритмів ── */}
      <Section title="Порівняння алгоритмів">
        {algorithmMetrics && (algorithmMetrics.astar || algorithmMetrics.dijkstra) ? (() => {
          const a = algorithmMetrics.astar
          const d = algorithmMetrics.dijkstra

          // Визначаємо переможця по кожній метриці
          const fasterIs  = a && d ? (parseFloat(a.ms) <= parseFloat(d.ms) ? 'astar' : 'dijkstra') : null
          const fewerIs   = a && d ? (a.visited <= d.visited ? 'astar' : 'dijkstra') : null
          const shorterIs = a && d ? (a.distPx <= d.distPx ? 'astar' : 'dijkstra') : null

          function cellColor(algo, winner) {
            if (!winner) return '#555'
            return winner === algo ? '#16a34a' : '#94a3b8'
          }

          return (
            <div className="rounded-md border border-[#e0e0e0] overflow-hidden">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-[#f5f5f5] border-b border-[#ebebeb]">
                    <td className="px-2 py-[5px] text-[#bbb] text-[9px] uppercase tracking-wide">Метрика</td>
                    <td className="px-2 py-[5px] text-center font-semibold text-[#555]">A*</td>
                    <td className="px-2 py-[5px] text-center font-semibold text-[#555]">Dijkstra</td>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#f5f5f5]">
                    <td className="px-2 py-[5px] text-[#aaa]">Час (мс)</td>
                    <td className="px-2 py-[5px] text-center font-mono font-medium" style={{ color: cellColor('astar', fasterIs) }}>
                      {a ? a.ms : '—'}
                    </td>
                    <td className="px-2 py-[5px] text-center font-mono font-medium" style={{ color: cellColor('dijkstra', fasterIs) }}>
                      {d ? d.ms : '—'}
                    </td>
                  </tr>
                  <tr className="border-b border-[#f5f5f5]">
                    <td className="px-2 py-[5px] text-[#aaa]">Вузлів</td>
                    <td className="px-2 py-[5px] text-center font-mono font-medium" style={{ color: cellColor('astar', fewerIs) }}>
                      {a ? a.visited : '—'}
                    </td>
                    <td className="px-2 py-[5px] text-center font-mono font-medium" style={{ color: cellColor('dijkstra', fewerIs) }}>
                      {d ? d.visited : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-[5px] text-[#aaa]">Шлях (м)</td>
                    <td className="px-2 py-[5px] text-center font-mono font-medium" style={{ color: cellColor('astar', shorterIs) }}>
                      {a ? pxToM(a.distPx).toFixed(1) : '—'}
                    </td>
                    <td className="px-2 py-[5px] text-center font-mono font-medium" style={{ color: cellColor('dijkstra', shorterIs) }}>
                      {d ? pxToM(d.distPx).toFixed(1) : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="px-2 py-[5px] bg-[#f5f5f5] border-t border-[#ebebeb] text-[9px] text-[#aaa]">
                Зелений — краще значення по метриці
              </div>
            </div>
          )
        })() : (
          <div className="text-[11px] text-[#bbb] leading-relaxed">
            Оберіть кімнату щоб побачити порівняння A* і Dijkstra
          </div>
        )}
      </Section>

      {/* ── Блокування ── */}
      {(exits.length > 0 || doors.length > 0) && (
        <Section title="Сценарій блокування">
          {(blockedExits.length > 0 || blockedDoors.length > 0) ? (
            <>
              <div className="flex flex-col gap-[4px] mb-2">
                {blockedExits.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-[5px] rounded-md bg-[#fff1f2] border border-[#fca5a5]">
                    <span className="text-[#ef4444] text-[11px]">✕</span>
                    <span className="text-[11px] text-[#dc2626] font-medium">
                      {blockedExits.length} {blockedExits.length === 1 ? 'вихід заблоковано' : 'виходи заблоковано'}
                    </span>
                  </div>
                )}
                {blockedDoors.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-[5px] rounded-md bg-[#fff1f2] border border-[#fca5a5]">
                    <span className="text-[#ef4444] text-[11px]">✕</span>
                    <span className="text-[11px] text-[#dc2626] font-medium">
                      {blockedDoors.length} {blockedDoors.length === 1 ? 'двері заблоковано' : 'дверей заблоковано'}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={clearBlockages}
                className="w-full py-[5px] rounded-md text-[11px] font-medium bg-white border border-[#e0e0e0] text-[#888] hover:border-[#ff4422] hover:text-[#ff4422] transition-all"
              >
                Скинути блокування
              </button>
            </>
          ) : (
            <div className="text-[11px] text-[#bbb] leading-relaxed">
              Клікніть на вихід або двері на плані щоб заблокувати. Маршрут перебудується автоматично.
            </div>
          )}
        </Section>
      )}

      {/* ── Аналіз безпеки ── */}
      {analysis ? (
        <>
          <Section title="Безпека (ДБН В.1.1-7)">
            <div className="mb-2 text-[10px] text-[#888]">
              Площа поверху: <span className="font-mono font-medium text-[#1a1a1a]">{analysis.totalAreaM2} м²</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <div>
                <div className="text-[10px] text-[#bbb] mb-0.5">Виходів</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-semibold" style={{ color: analysis.hasEnoughExits ? '#22c984' : '#ff4422' }}>
                    {analysis.exitCount}
                  </span>
                  {!analysis.hasEnoughExits && (
                    <span className="text-[9px] text-[#ff4422]">мін. {analysis.requiredExits}</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#bbb] mb-0.5">Тупиків</div>
                <span className="text-[14px] font-semibold" style={{ color: analysis.deadendCount > 0 ? '#f5c542' : '#22c984' }}>
                  {analysis.deadendCount}
                </span>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] text-[#bbb] mb-0.5">Зв'язність</div>
                <div className="text-[11px] font-medium" style={{ color: analysis.isFullyConnected ? '#22c984' : '#ff4422' }}>
                  {analysis.isFullyConnected ? "✓ Граф повністю зв'язний" : "✗ Є ізольовані вузли"}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] text-[#bbb] mb-0.5">Найдальша точка</div>
                <div className="text-[11px] font-medium" style={{ color: parseFloat(analysis.farthestCornerDist) > 25 ? '#f5c542' : '#22c984' }}>
                  {analysis.farthestCornerDist}м {analysis.farthestCornerRoom && `("${analysis.farthestCornerRoom}")`}
                </div>
              </div>
            </div>
          </Section>

          {analysis.roomRanking.length > 0 && (
            <Section title="Рейтинг кімнат">
              <div className="flex flex-col gap-[3px]">
                {analysis.roomRanking.slice(0, 6).map((room) => {
                  const distVal = room.distM ? parseFloat(room.distM) : null
                  const barColor = !room.isReachable ? '#ff4422'
                    : distVal > 25 ? '#f5c542'
                    : '#22c984'
                  const barWidth = distVal ? Math.min(100, (distVal / 40) * 100) : 100
                  return (
                    <div key={room.id} className="py-[3px]">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] text-[#555] truncate flex-1">{room.label}</span>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                          {room.isDeadend && <span className="text-[9px] text-[#f5c542]">тупик</span>}
                          {distVal > 25 && <span className="text-[9px] text-[#f5c542]">!</span>}
                          <span className="text-[11px] font-mono font-medium" style={{ color: barColor }}>
                            {room.isReachable ? `${room.distM}м` : '∞'}
                          </span>
                        </div>
                      </div>
                      <div className="h-[3px] bg-[#f0f0f0] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: barColor }} />
                      </div>
                    </div>
                  )
                })}
                {analysis.roomRanking.length > 6 && (
                  <div className="text-[10px] text-[#bbb] pt-1">+{analysis.roomRanking.length - 6} кімнат...</div>
                )}
              </div>
            </Section>
          )}

          <Section title="Рекомендації">
            <div className="flex flex-col gap-2">
              {analysis.recommendations.map((rec, i) => {
                const s = LEVEL_STYLES[rec.level]
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2 px-2 py-2 rounded-md border text-[11px] leading-relaxed"
                    style={{ background: s.bg, borderColor: s.border, color: s.text }}
                  >
                    <div className="w-[6px] h-[6px] rounded-full flex-shrink-0 mt-[3px]" style={{ background: s.dot }} />
                    <span>{rec.text}</span>
                  </div>
                )
              })}
            </div>
          </Section>
        </>
      ) : (
        !hasGraph && (
          <Section title="Аналіз">
            <div className="text-[11px] text-[#bbb]">
              Намалюйте план і додайте виходи щоб побачити аналіз
            </div>
          </Section>
        )
      )}
    </div>
  )
}