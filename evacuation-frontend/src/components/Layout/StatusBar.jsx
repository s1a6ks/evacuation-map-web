import { useState, useEffect } from 'react'
import useStore from '../../store/useStore'

export default function StatusBar() {
  const { tool, walls, graphNodes, graphEdges } = useStore()
  const [cursor, setCursor] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handler = (e) => setCursor({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  return (
    <div className="h-[24px] bg-[#f7f7f7] border-t border-[#e5e5e5] flex items-center px-3 gap-4 flex-shrink-0 select-none">
      <Item label="X" value={cursor.x} />
      <Item label="Y" value={cursor.y} />
      <div className="w-px h-3 bg-[#e5e5e5]" />
      <Item label="Стін" value={walls.length} />
      <Item label="Вузлів" value={graphNodes.length} />
      <Item label="Ребер" value={graphEdges.length} />
      <div className="w-px h-3 bg-[#e5e5e5]" />
      <span className="text-[10px] text-[#bbb] font-mono">{tool.toUpperCase()}</span>
      <span className="ml-auto text-[10px] text-[#ccc]">EvacRoute · ASP.NET Core 8</span>
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