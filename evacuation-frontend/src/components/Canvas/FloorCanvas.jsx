import { useRef, useEffect } from 'react'
import useStore from '../../store/useStore'

const GRID = 20

export default function FloorCanvas() {
  const canvasRef = useRef(null)
  const { mode } = useStore()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function resize() {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      draw()
    }

    function draw() {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // Background
      ctx.fillStyle = '#fafafa'
      ctx.fillRect(0, 0, W, H)

      // Grid minor
      ctx.strokeStyle = '#f0f0f0'
      ctx.lineWidth = 1
      for (let x = 0; x < W; x += GRID) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y < H; y += GRID) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      // Grid major (every 5 cells)
      ctx.strokeStyle = '#e8e8e8'
      for (let x = 0; x < W; x += GRID * 5) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y < H; y += GRID * 5) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      // Placeholder text
      ctx.fillStyle = '#ddd'
      ctx.font = '13px Manrope, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        mode === 'constructor'
          ? 'Оберіть інструмент і почніть малювати план'
          : 'Завантажте план для перегляду',
        W / 2, H / 2
      )
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [mode])

  return (
   <canvas
  ref={canvasRef}
  className="block cursor-crosshair"
  style={{ flex: '1 1 0', minWidth: 0 }}
/>
  )
}