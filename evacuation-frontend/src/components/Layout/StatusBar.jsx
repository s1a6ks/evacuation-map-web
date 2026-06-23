import useStore from '../../store/useStore'

export default function StatusBar() {
  const { tool, scale, setTransform, offset, resetTransform } = useStore()

  const toolLabels = {
    wall: 'Стіна',
    door: 'Двері',
    window: 'Вікно',
    exit: 'Вихід',
    stair: 'Сходи',
    erase: 'Стерти',
    select: 'Вибір',
  }

  function handleZoomIn() {
    const newScale = Math.min(scale * 1.2, 8)
    setTransform(newScale, offset)
  }

  function handleZoomOut() {
    const newScale = Math.max(scale / 1.2, 0.2)
    setTransform(newScale, offset)
  }

  function handleZoomReset() {
    resetTransform()
  }

  return (
    <div className="h-[28px] bg-[#fafafa] border-t border-[#ededed] flex items-center px-3 flex-shrink-0 select-none">
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-[#b8b8b8] uppercase tracking-[0.18em]">Інструмент</span>
        <span className="text-[#666]">{toolLabels[tool] ?? tool}</span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={handleZoomOut}
          className="w-5 h-5 rounded flex items-center justify-center text-[12px] text-[#888] hover:text-[#555] hover:bg-[#f0f0f0] transition-all"
          title="Зменшити"
        >
          в€’
        </button>
        <button
          onClick={handleZoomReset}
          className="min-w-[44px] px-1 text-[10px] text-[#777] hover:text-[#444] font-mono transition-colors"
          title="Скинути масштаб"
        >
          {(scale * 100).toFixed(0)}%
        </button>
        <button
          onClick={handleZoomIn}
          className="w-5 h-5 rounded flex items-center justify-center text-[12px] text-[#888] hover:text-[#555] hover:bg-[#f0f0f0] transition-all"
          title="Збільшити"
        >
          +
        </button>
      </div>
    </div>
  )
}
