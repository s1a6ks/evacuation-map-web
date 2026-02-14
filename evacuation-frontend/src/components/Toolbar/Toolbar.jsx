import useStore from '../../store/useStore'

const tools = [
  { id: 'select', icon: '↖', label: 'Вибір',  shortcut: 'V' },
  { id: 'wall',   icon: '╱', label: 'Стіна',  shortcut: 'W' },
  { id: 'door',   icon: '▭', label: 'Двері',  shortcut: 'D' },
  { id: 'exit',   icon: '⊙', label: 'Вихід',  shortcut: 'E' },
  { id: 'stair',  icon: '≡', label: 'Сходи',  shortcut: 'S' },
  { id: 'erase',  icon: '⌫', label: 'Стерти', shortcut: 'X' },
]

export default function Toolbar() {
  const { tool, setTool, undo, clearAll, history, walls } = useStore()

  return (
    <div className="bg-[#f7f7f7] border-r border-[#e0e0e0] flex flex-col items-center py-3 gap-1 flex-shrink-0" style={{ width: '48px', minWidth: '48px' }}>

      {tools.map((t) => (
        <div key={t.id}>
          {t.id === 'erase' && <div className="w-6 h-px bg-[#e5e5e5] my-1 mx-auto" />}
          <button
            onClick={() => setTool(t.id)}
            title={`${t.label} (${t.shortcut})`}
            className={`group relative w-9 h-9 rounded-lg flex items-center justify-center text-[16px] transition-all ${
              tool === t.id
                ? 'bg-[#ff4422] text-white'
                : 'text-[#999] hover:bg-[#f5f5f5] hover:text-[#333]'
            }`}
          >
            {t.icon}
            {/* Tooltip */}
            <div className="absolute left-[44px] top-1/2 -translate-y-1/2 bg-[#333] text-white text-[11px] font-medium px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
              {t.label}
              <span className="ml-2 text-[#888] font-mono text-[10px]">{t.shortcut}</span>
            </div>
          </button>
        </div>
      ))}

      {/* Bottom */}
      <div className="mt-auto flex flex-col items-center gap-1">
        <div className="w-6 h-px bg-[#e5e5e5]" />
        <button
          onClick={undo}
          disabled={!history.length}
          title="Undo (Ctrl+Z)"
          className="group relative w-9 h-9 rounded-lg flex items-center justify-center text-[16px] text-[#999] hover:bg-[#f5f5f5] hover:text-[#333] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
        >
          ↩
          <div className="absolute left-[44px] top-1/2 -translate-y-1/2 bg-[#333] text-white text-[11px] px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            Undo <span className="text-[#888] font-mono text-[10px]">Ctrl+Z</span>
          </div>
        </button>
        <button
          onClick={() => { if (confirm('Очистити весь план?')) clearAll() }}
          disabled={!walls.length}
          title="Очистити"
          className="group relative w-9 h-9 rounded-lg flex items-center justify-center text-[16px] text-[#999] hover:bg-[#fff0ee] hover:text-[#ff4422] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
        >
          ✕
          <div className="absolute left-[44px] top-1/2 -translate-y-1/2 bg-[#333] text-white text-[11px] px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            Очистити все
          </div>
        </button>
      </div>
    </div>
  )
}