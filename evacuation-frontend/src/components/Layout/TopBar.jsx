import useStore from '../../store/useStore'

export default function TopBar() {
  const { mode, setMode } = useStore()

  return (
    <div className="h-[48px] bg-[#f7f7f7] border-b border-[#e5e5e5] flex items-center px-4 flex-shrink-0 select-none">

      {/* Logo */}
      <div className="flex items-center gap-2 w-[160px]">
        <div className="w-6 h-6 bg-[#ff4422] rounded-md flex items-center justify-center text-[11px]">🚪</div>
        <span className="text-[13px] font-semibold text-[#1a1a1a]">Evac<span className="text-[#ff4422]">Route</span></span>
      </div>

      {/* Mode tabs — center */}
      <div className="flex-1 flex justify-center">
        <div className="flex bg-[#f0f0f0] rounded-lg p-[3px] gap-[2px]">
          <button
            onClick={() => setMode('constructor')}
            className={`px-4 py-[5px] rounded-md text-[12px] font-medium transition-all ${
              mode === 'constructor'
                ? 'bg-[#f7f7f7] text-[#1a1a1a] shadow-sm'
                : 'text-[#999] hover:text-[#555]'
            }`}
          >
            Конструктор
          </button>
          <button
            onClick={() => setMode('evacuation')}
            className={`px-4 py-[5px] rounded-md text-[12px] font-medium transition-all ${
              mode === 'evacuation'
                ? 'bg-[#ff4422] text-white shadow-sm'
                : 'text-[#999] hover:text-[#555]'
            }`}
          >
            🔥 Евакуація
          </button>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3 w-[160px] justify-end">
        <select className="bg-[#f5f5f5] border border-[#e0e0e0] text-[#666] text-[11px] px-2 py-[5px] rounded-md outline-none cursor-pointer">
          <option>Новий план</option>
        </select>
        <div className="flex items-center gap-1.5">
          <div className="w-[6px] h-[6px] rounded-full bg-[#22c984]" />
          <span className="text-[11px] text-[#bbb]">Online</span>
        </div>
      </div>
    </div>
  )
}