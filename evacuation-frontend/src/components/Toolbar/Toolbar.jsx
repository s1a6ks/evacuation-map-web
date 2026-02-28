import useStore from '../../store/useStore'

// ── Архітектурні SVG іконки ──────────────────────────────────

// Стрілка вибору (курсор)
function IconSelect() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 2l10 5.5-5 1.5-2 5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  )
}

// Стіна — товста лінія як перетин стіни в плані
function IconWall() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <line x1="3" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="4" strokeLinecap="butt"/>
    </svg>
  )
}

// Двері — класичний архітектурний символ: лінія + дуга
function IconDoor() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {/* Прибите до стіни */}
      <line x1="4" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Прорив у стіні */}
      <line x1="4" y1="14" x2="4" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Дуга — траєкторія дверей */}
      <path d="M4 6 A8 8 0 0 1 12 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" strokeDasharray="none"/>
      {/* Полотно дверей */}
      <line x1="4" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

// Аварійний вихід — стрілка крізь прямокутник
function IconExit() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {/* Рамка */}
      <rect x="2" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      {/* Стрілка виходу вгору */}
      <path d="M9 12V7M6.5 9.5L9 7l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Сходи — ступінчастий профіль (вигляд зверху)
function IconStair() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2.5" y="2.5" width="13" height="13" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      {/* Ступені */}
      <path d="M5.5 14.5 V11 H8.5 V8 H11.5 V5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Гумка (стерти)
function IconErase() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 13.5L7.5 5l6 3.5-4.5 7H3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <line x1="3" y1="13.5" x2="15" y2="13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="7.5" y1="5" x2="13.5" y2="9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

// Undo
function IconUndo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3.5 6H10a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M3.5 3.5L1 6l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Очистити все
function IconClear() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M6 4V3h4v1M5.5 4l.5 8h4l.5-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Вогнегасник — чіткий силует: корпус + Т-ручка + шланг
function IconExtinguisher() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {/* Корпус балону */}
      <rect x="6" y="7" width="5" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      {/* Голівка */}
      <rect x="6.5" y="5" width="4" height="2" rx="0.5" stroke="currentColor" strokeWidth="1.3"/>
      {/* Штуцер вгору */}
      <line x1="8.5" y1="5" x2="8.5" y2="3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Т-ручка */}
      <line x1="6" y1="3.5" x2="11" y2="3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Шланг */}
      <path d="M11 8.5 Q14 8.5 13.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

// ── Інструменти ──────────────────────────────────────────────
const tools = [
  { id: 'select', Icon: IconSelect, label: 'Вибір',  shortcut: 'V' },
  { id: 'wall',   Icon: IconWall,   label: 'Стіна',  shortcut: 'W' },
  { id: 'door',   Icon: IconDoor,   label: 'Двері',  shortcut: 'D' },
  { id: 'exit',   Icon: IconExit,   label: 'Вихід',  shortcut: 'E' },
  { id: 'stair',  Icon: IconStair,  label: 'Сходи',  shortcut: 'S' },
  null, // separator
  { id: 'extinguisher', Icon: IconExtinguisher, label: 'Вогнегасник', shortcut: 'F' },
  { id: 'erase',  Icon: IconErase,  label: 'Стерти', shortcut: 'X' },
]

export default function Toolbar() {
  const { tool, setTool, undo, clearAll, history, walls } = useStore()

  return (
    <div
      className="flex flex-col items-center py-3 gap-0.5 flex-shrink-0 border-r border-[#e8e8e8]"
      style={{ width: '48px', minWidth: '48px', background: '#f9f9f9' }}
    >
      {tools.map((t, i) => {
        if (t === null) return <div key={i} className="w-5 h-px bg-[#e5e5e5] my-1.5" />

        const active = tool === t.id
        return (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={`${t.label} (${t.shortcut})`}
            className="group relative w-9 h-9 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: active ? '#1a1a1a' : 'transparent',
              color: active ? '#ffffff' : '#888',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#ececec'; if (!active) e.currentTarget.style.color = '#1a1a1a' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; if (!active) e.currentTarget.style.color = '#888' }}
          >
            <t.Icon />
            <div className="absolute left-[44px] top-1/2 -translate-y-1/2 bg-[#1a1a1a] text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
              {t.label}
              <span className="ml-2 text-[#666] font-mono text-[10px]">{t.shortcut}</span>
            </div>
          </button>
        )
      })}

      {/* Bottom actions */}
      <div className="mt-auto flex flex-col items-center gap-0.5">
        <div className="w-5 h-px bg-[#e5e5e5] mb-1.5" />

        <button
          onClick={undo}
          disabled={!history.length}
          title="Скасувати (Ctrl+Z)"
          className="group relative w-9 h-9 rounded-lg flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
          style={{ color: '#888' }}
          onMouseEnter={e => { if (history.length) { e.currentTarget.style.background = '#ececec'; e.currentTarget.style.color = '#1a1a1a' } }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' }}
        >
          <IconUndo />
          <div className="absolute left-[44px] top-1/2 -translate-y-1/2 bg-[#1a1a1a] text-white text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            Скасувати <span className="text-[#666] font-mono text-[10px]">Ctrl+Z</span>
          </div>
        </button>

        <button
          onClick={() => { if (confirm('Очистити весь план?')) clearAll() }}
          disabled={!walls.length}
          title="Очистити план"
          className="group relative w-9 h-9 rounded-lg flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
          style={{ color: '#888' }}
          onMouseEnter={e => { if (walls.length) { e.currentTarget.style.background = '#fff1f0'; e.currentTarget.style.color = '#cc3311' } }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' }}
        >
          <IconClear />
          <div className="absolute left-[44px] top-1/2 -translate-y-1/2 bg-[#1a1a1a] text-white text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            Очистити все
          </div>
        </button>
      </div>
    </div>
  )
}