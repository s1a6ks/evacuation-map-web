import { useEffect } from 'react'
import useStore from '../../../store/useStore'

const GRID = 20
const METER = 0.5
const MIN_ROOM_CELLS = 4

function edgeKey(rowA, colA, rowB, colB) {
  return `${rowA},${colA}:${rowB},${colB}`
}

function addBlockedEdge(blockedEdges, rows, cols, rowA, colA, rowB, colB) {
  if (rowA < 0 || rowA >= rows || colA < 0 || colA >= cols) return
  if (rowB < 0 || rowB >= rows || colB < 0 || colB >= cols) return

  blockedEdges.add(edgeKey(rowA, colA, rowB, colB))
  blockedEdges.add(edgeKey(rowB, colB, rowA, colA))
}

function isBlocked(blockedEdges, rowA, colA, rowB, colB) {
  return blockedEdges.has(edgeKey(rowA, colA, rowB, colB))
}

function rasterizeSolidWall(grid, rows, cols, wall, minRow, minCol) {
  const col1 = wall.x1 / GRID - minCol
  const row1 = wall.y1 / GRID - minRow
  const col2 = wall.x2 / GRID - minCol
  const row2 = wall.y2 / GRID - minRow

  const steps = Math.ceil(Math.hypot(col2 - col1, row2 - row1) * 4)
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps
    const col = Math.round(col1 + (col2 - col1) * t)
    const row = Math.round(row1 + (row2 - row1) * t)
    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      grid[row][col] = 1
    }
  }
}

function rasterizeWallBarriers(grid, blockedEdges, rows, cols, wall, minRow, minCol) {
  const EPS = 0.001
  const isHorizontal = Math.abs(wall.y1 - wall.y2) < EPS
  const isVertical = Math.abs(wall.x1 - wall.x2) < EPS

  if (isHorizontal) {
    const rowBoundary = Math.round(wall.y1 / GRID) - minRow
    const startCol = Math.floor(Math.min(wall.x1, wall.x2) / GRID) - minCol
    const endCol = Math.ceil(Math.max(wall.x1, wall.x2) / GRID) - minCol - 1

    for (let col = startCol; col <= endCol; col++) {
      addBlockedEdge(blockedEdges, rows, cols, rowBoundary - 1, col, rowBoundary, col)
    }
    return
  }

  if (isVertical) {
    const colBoundary = Math.round(wall.x1 / GRID) - minCol
    const startRow = Math.floor(Math.min(wall.y1, wall.y2) / GRID) - minRow
    const endRow = Math.ceil(Math.max(wall.y1, wall.y2) / GRID) - minRow - 1

    for (let row = startRow; row <= endRow; row++) {
      addBlockedEdge(blockedEdges, rows, cols, row, colBoundary - 1, row, colBoundary)
    }
    return
  }

  rasterizeSolidWall(grid, rows, cols, wall, minRow, minCol)
}

function bfsFill(grid, startRow, startCol, rows, cols, targetVal, fillVal, blockedEdges) {
  if (grid[startRow][startCol] !== targetVal) return []

  const cells = []
  const queue = [[startRow, startCol]]
  grid[startRow][startCol] = fillVal

  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]]
  while (queue.length > 0) {
    const [row, col] = queue.shift()
    cells.push([row, col])

    for (const [dRow, dCol] of dirs) {
      const nextRow = row + dRow
      const nextCol = col + dCol
      if (
        nextRow >= 0 && nextRow < rows &&
        nextCol >= 0 && nextCol < cols &&
        grid[nextRow][nextCol] === targetVal &&
        !isBlocked(blockedEdges, row, col, nextRow, nextCol)
      ) {
        grid[nextRow][nextCol] = fillVal
        queue.push([nextRow, nextCol])
      }
    }
  }

  return cells
}

function findRoomAnchor(cells) {
  const cellSet = new Set(cells.map(([row, col]) => `${row},${col}`))
  const avgRow = cells.reduce((sum, [row]) => sum + row, 0) / cells.length
  const avgCol = cells.reduce((sum, [, col]) => sum + col, 0) / cells.length

  let best = cells[0]
  let bestScore = -Infinity

  cells.forEach(([row, col]) => {
    let minDistToEdge = Infinity

    cells.forEach(([otherRow, otherCol]) => {
      const isBoundary =
        !cellSet.has(`${otherRow - 1},${otherCol}`) ||
        !cellSet.has(`${otherRow + 1},${otherCol}`) ||
        !cellSet.has(`${otherRow},${otherCol - 1}`) ||
        !cellSet.has(`${otherRow},${otherCol + 1}`)

      if (isBoundary) {
        minDistToEdge = Math.min(minDistToEdge, Math.hypot(row - otherRow, col - otherCol))
      }
    })

    const distToAverage = Math.hypot(row - avgRow, col - avgCol)
    const score = minDistToEdge * 10 - distToAverage
    if (score > bestScore) {
      bestScore = score
      best = [row, col]
    }
  })

  return best
}

export function detectRooms(walls) {
  if (walls.length === 0) return []

  let minCol = Infinity, maxCol = -Infinity
  let minRow = Infinity, maxRow = -Infinity

  walls.forEach(wall => {
    minCol = Math.min(minCol, Math.floor(wall.x1 / GRID), Math.floor(wall.x2 / GRID))
    maxCol = Math.max(maxCol, Math.ceil(wall.x1 / GRID), Math.ceil(wall.x2 / GRID))
    minRow = Math.min(minRow, Math.floor(wall.y1 / GRID), Math.floor(wall.y2 / GRID))
    maxRow = Math.max(maxRow, Math.ceil(wall.y1 / GRID), Math.ceil(wall.y2 / GRID))
  })

  minCol -= 2
  maxCol += 2
  minRow -= 2
  maxRow += 2

  const cols = maxCol - minCol
  const rows = maxRow - minRow
  const grid = Array.from({ length: rows }, () => new Uint8Array(cols))
  const blockedEdges = new Set()

  walls.forEach(wall => {
    rasterizeWallBarriers(grid, blockedEdges, rows, cols, wall, minRow, minCol)
  })

  for (let col = 0; col < cols; col++) {
    if (grid[0][col] === 0) bfsFill(grid, 0, col, rows, cols, 0, 2, blockedEdges)
    if (grid[rows - 1][col] === 0) bfsFill(grid, rows - 1, col, rows, cols, 0, 2, blockedEdges)
  }

  for (let row = 0; row < rows; row++) {
    if (grid[row][0] === 0) bfsFill(grid, row, 0, rows, cols, 0, 2, blockedEdges)
    if (grid[row][cols - 1] === 0) bfsFill(grid, row, cols - 1, rows, cols, 0, 2, blockedEdges)
  }

  const rooms = []
  let roomIndex = 0

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (grid[row][col] === 0) {
        const cells = bfsFill(grid, row, col, rows, cols, 0, 3 + roomIndex, blockedEdges)
        if (cells.length >= MIN_ROOM_CELLS) {
          const [anchorRow, anchorCol] = findRoomAnchor(cells)

          const cx = (anchorCol + minCol) * GRID + GRID / 2
          const cy = (anchorRow + minRow) * GRID + GRID / 2
          const worldCells = cells.map(([cellRow, cellCol]) => [cellRow + minRow, cellCol + minCol])
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

export default function useFloodFill() {
  const { walls, setDetectedRooms } = useStore()

  useEffect(() => {
    const rooms = detectRooms(walls)
    setDetectedRooms(rooms)
  }, [walls, setDetectedRooms])
}
