import useStore from '../../store/useStore'

const COLORS = ['#4d9fff', '#22c984', '#f5c542', '#ff4422', '#c084fc', '#fb923c']

export default function RightPanel() {
  const { mode, detectedRooms, graphNodes, graphEdges, walls, doors, exits } = useStore()

  return (
    <div
  className="bg-[#f7f7f7] border-l border-[#e0e0e0] flex flex-col overflow-hidden flex-shrink-0"
  style={{ width: '220px', minWidth: '220px', maxWidth: '220px' }}
>

      {/* Header */}
      <div className="px-4 py-3 border-b border-[#f0f0f0]">
        <div className="text-[11px] font-semibold text-[#999] uppercase tracking-widest">
          {mode === 'constructor' ? 'Конструктор' : 'Евакуація'}
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-b border-[#f0f0f0]">
        <div className="text-[10px] font-semibold text-[#bbb] uppercase tracking-widest mb-2">План</div>
        <div className="flex flex-col gap-2">
          <Row label="Стін" value={walls.length} />
          <Row label="Дверей" value={doors.length} />
          <Row label="Виходів" value={exits.length} color="#22c984" />
          <Row label="Кімнат" value={detectedRooms.length} color="#22c984" />
        </div>
      </div>

      {/* Graph */}
      <div className="px-4 py-3 border-b border-[#f0f0f0]">
        <div className="text-[10px] font-semibold text-[#bbb] uppercase tracking-widest mb-2">Граф</div>
        <div className="flex flex-col gap-2">
          <Row label="Вузлів" value={graphNodes.length} />
          <Row label="Ребер" value={graphEdges.length} />
        </div>
      </div>

      {/* Rooms */}
      {detectedRooms.length > 0 && (
        <div className="px-4 py-3 border-b border-[#f0f0f0]">
          <div className="text-[10px] font-semibold text-[#bbb] uppercase tracking-widest mb-2">Кімнати</div>
          <div className="flex flex-col gap-1">
            {detectedRooms.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2 py-[5px] px-2 rounded-md hover:bg-[#f5f5f5] cursor-pointer transition-all group">
                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: COLORS[idx % COLORS.length] }} />
                <span className="text-[12px] text-[#555] group-hover:text-[#1a1a1a] flex-1 truncate">{r.label}</span>
                <span className="text-[10px] text-[#bbb] font-mono">{r.areaM2}м²</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!walls.length && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <div className="text-[32px] opacity-20">🗺</div>
          <div className="text-[11px] text-[#bbb] leading-relaxed">
            {mode === 'constructor'
              ? 'Оберіть інструмент і намалюйте план'
              : 'Завантажте або намалюйте план будівлі'
            }
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[#999]">{label}</span>
      <span className="text-[12px] font-mono font-medium" style={{ color: color || '#1a1a1a' }}>{value}</span>
    </div>
  )
}