import useStore from '../../store/useStore'

const GRID = 20
const METER = 0.5

function pxToM(px) {
  return ((px / GRID) * METER).toFixed(1)
}

export default function StatusBar() {
  const { tool, walls, doors, exits, mousePos, scale, setTransform, offset, resetTransform } = useStore()

  const mx = pxToM(mousePos.x)
  const my = pxToM(mousePos.y)

  const toolLabels = {
    wall: 'Стіна', door: 'Двері', exit: 'Вихід',
    stair: 'Сходи', erase: 'Стерти', select: 'Вибір',
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
    <div className="h-[24px] bg-[#f7f7f7] border-t border-[#e5e5e5] flex items-center px-3 gap-4 flex-shrink-0 select-none">
      <Item label="X" value={`${mx}м`} />
      <Item label="Y" value={`${my}м`} />
      <div className="w-px h-3 bg-[#e5e5e5]" />
      <Item label="Стін" value={walls.length} />
      <Item label="Дверей" value={doors.length} />
      <Item label="Виходів" value={exits.length} />
      <div className="w-px h-3 bg-[#e5e5e5]" />
      <span className="text-[10px] text-[#bbb]">{toolLabels[tool] ?? tool}</span>
      
      {/* Zoom controls */}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={handleZoomOut}
          className="w-5 h-5 rounded flex items-center justify-center text-[12px] text-[#888] hover:text-[#ff4422] hover:bg-[#f0f0f0] transition-all"
          title="Зменшити (Ctrl + -)"
        >
          −
        </button>
        <button
          onClick={handleZoomReset}
          className="text-[10px] text-[#888] hover:text-[#ff4422] font-mono transition-colors"
          title="Скинути масштаб"
        >
          {(scale * 100).toFixed(0)}%
        </button>
        <button
          onClick={handleZoomIn}
          className="w-5 h-5 rounded flex items-center justify-center text-[12px] text-[#888] hover:text-[#ff4422] hover:bg-[#f0f0f0] transition-all"
          title="Збільшити (Ctrl + +)"
        >
          +
        </button>
      </div>
    </div>
  )
}

function Item({ label, value }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-[#ccc] font-mono">{label}</span>
      <span className="text-[10px] text-[#999] font-mono">{value}</span>
    </div>
  )
}