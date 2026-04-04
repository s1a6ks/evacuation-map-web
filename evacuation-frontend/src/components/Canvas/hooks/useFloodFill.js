import { useEffect } from 'react'
import useStore from '../../../store/useStore'

const GRID = 20
const METER = 0.5
const MIN_ROOM_CELLS = 4 // мінімум клітинок щоб вважатись кімнатою

// ── BFS flood fill ───────────────────────────────────────────
function bfsFill(grid, startR, startC, rows, cols, targetVal, fillVal) {
  if (grid[startR][startC] !== targetVal) return []
  const cells = []
  const queue = [[startR, startC]]
  grid[startR][startC] = fillVal

  const dirs = [[0,1],[0,-1],[1,0],[-1,0]]
  while (queue.length > 0) {
    const [r, c] = queue.shift()
    cells.push([r, c])
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === targetVal) {
        grid[nr][nc] = fillVal
        queue.push([nr, nc])
      }
    }
  }
  return cells
}

// ── Рядки для підпису кімнат ─────────────────────────────────
// Room labels — просто нумерація

// ── Rasterize і Main detection (Dynamic Bounds) ────────────────
export function detectRooms(walls) {
  if (walls.length === 0) return []

  // 1. Знаходимо реальні межі усіх стін
  let minC = Infinity, maxC = -Infinity
  let minR = Infinity, maxR = -Infinity

  walls.forEach(w => {
    minC = Math.min(minC, Math.floor(w.x1 / GRID), Math.floor(w.x2 / GRID))
    maxC = Math.max(maxC, Math.ceil(w.x1 / GRID), Math.ceil(w.x2 / GRID))
    minR = Math.min(minR, Math.floor(w.y1 / GRID), Math.floor(w.y2 / GRID))
    maxR = Math.max(maxR, Math.ceil(w.y1 / GRID), Math.ceil(w.y2 / GRID))
  })

  // Запас з усіх сторін (щоб вода точно обтекла все зовні)
  minC -= 2
  maxC += 2
  minR -= 2
  maxR += 2

  const cols = maxC - minC
  const rows = maxR - minR

  // 0 = free, 1 = wall
  const grid = Array.from({ length: rows }, () => new Uint8Array(cols))

  walls.forEach(wall => {
    const c1 = wall.x1 / GRID - minC
    const r1 = wall.y1 / GRID - minR
    const c2 = wall.x2 / GRID - minC
    const r2 = wall.y2 / GRID - minR

    const steps = Math.ceil(Math.hypot(c2 - c1, r2 - r1) * 4)
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps
      const c = Math.round(c1 + (c2 - c1) * t)
      const r = Math.round(r1 + (r2 - r1) * t)
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        grid[r][c] = 1
      }
    }
  })

  // Затопити "зовні" від усіх країв (значення 2)
  for (let c = 0; c < cols; c++) {
    if (grid[0][c] === 0) bfsFill(grid, 0, c, rows, cols, 0, 2)
    if (grid[rows - 1][c] === 0) bfsFill(grid, rows - 1, c, rows, cols, 0, 2)
  }
  for (let r = 0; r < rows; r++) {
    if (grid[r][0] === 0) bfsFill(grid, r, 0, rows, cols, 0, 2)
    if (grid[r][cols - 1] === 0) bfsFill(grid, r, cols - 1, rows, cols, 0, 2)
  }

  // Знайти всі незатоплені внутрішні регіони (значення 0) → кімнати
  const rooms = []
  let roomIndex = 0

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0) {
        const cells = bfsFill(grid, r, c, rows, cols, 0, 3 + roomIndex)
        if (cells.length >= MIN_ROOM_CELLS) {
          // Центроїд у пікселях
          const sumR = cells.reduce((s, [cr]) => s + cr, 0)
          const sumC = cells.reduce((s, [, cc]) => s + cc, 0)
          
          const cx = ((sumC / cells.length) + minC) * GRID + GRID / 2
          const cy = ((sumR / cells.length) + minR) * GRID + GRID / 2

          // Мапимо відносні координати назад у світові (grid)
          const worldCells = cells.map(([cr, cc]) => [cr + minR, cc + minC])

          const areaM2 = (cells.length * METER * METER).toFixed(1)
          const label = `Кімната ${roomIndex + 1}`

          rooms.push({ id: roomIndex + 1, cells: worldCells, cx, cy, label, areaM2 })
          roomIndex++
        }
      }
    }
  }

  return rooms
}

// ── Hook ─────────────────────────────────────────────────────
export default function useFloodFill(canvasRef) {
  const { walls, setDetectedRooms } = useStore()

  useEffect(() => {
    const rooms = detectRooms(walls)
    setDetectedRooms(rooms)
  }, [walls]) // eslint-disable-line react-hooks/exhaustive-deps
}