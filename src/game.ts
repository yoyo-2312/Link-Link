export type Point = { row: number; col: number }
export type Board = (number | null)[][]
export type Difficulty = 'easy' | 'normal' | 'hard'

export const LEVELS: Record<Difficulty, { label: string; rows: number; cols: number; seconds: number }> = {
  easy: { label: '轻松', rows: 6, cols: 6, seconds: 180 },
  normal: { label: '标准', rows: 8, cols: 8, seconds: 240 },
  hard: { label: '挑战', rows: 8, cols: 10, seconds: 300 },
}

const DIRECTIONS = [[-1, 0], [0, 1], [1, 0], [0, -1]] as const

export function samePoint(a: Point, b: Point): boolean {
  return a.row === b.row && a.col === b.col
}

export function findPath(board: Board, start: Point, end: Point): Point[] | null {
  const rows = board.length
  const cols = board[0]?.length ?? 0
  if (!rows || !cols || samePoint(start, end)) return null
  if (![start, end].every(({ row, col }) => row >= 0 && row < rows && col >= 0 && col < cols)) return null
  if (board[start.row][start.col] === null || board[start.row][start.col] !== board[end.row][end.col]) return null

  type State = { row: number; col: number; direction: number; turns: number; path: Point[] }
  const queue: State[] = []
  const best = new Map<string, { turns: number; steps: number }>()

  for (let direction = 0; direction < 4; direction++) {
    const row = start.row + 1 + DIRECTIONS[direction][0]
    const col = start.col + 1 + DIRECTIONS[direction][1]
    if (row < 0 || row > rows + 1 || col < 0 || col > cols + 1) continue
    if (row > 0 && row <= rows && col > 0 && col <= cols && board[row - 1][col - 1] !== null && !(row === end.row + 1 && col === end.col + 1)) continue
    queue.push({ row, col, direction, turns: 0, path: [{ row: start.row + 1, col: start.col + 1 }, { row, col }] })
  }

  while (queue.length) {
    queue.sort((a, b) => a.turns - b.turns || a.path.length - b.path.length)
    const current = queue.shift()!
    const key = `${current.row},${current.col},${current.direction}`
    const previous = best.get(key)
    if (previous && (previous.turns < current.turns || (previous.turns === current.turns && previous.steps <= current.path.length))) continue
    best.set(key, { turns: current.turns, steps: current.path.length })

    if (current.row === end.row + 1 && current.col === end.col + 1) return current.path

    for (let direction = 0; direction < 4; direction++) {
      const turns = current.turns + Number(direction !== current.direction)
      if (turns > 2) continue
      const row = current.row + DIRECTIONS[direction][0]
      const col = current.col + DIRECTIONS[direction][1]
      if (row < 0 || row > rows + 1 || col < 0 || col > cols + 1) continue
      if (row > 0 && row <= rows && col > 0 && col <= cols && board[row - 1][col - 1] !== null && !(row === end.row + 1 && col === end.col + 1)) continue
      queue.push({ row, col, direction, turns, path: [...current.path, { row, col }] })
    }
  }
  return null
}

export function findAvailablePair(board: Board): { first: Point; second: Point; path: Point[] } | null {
  const positions = new Map<number, Point[]>()
  board.forEach((line, row) => line.forEach((value, col) => {
    if (value === null) return
    const points = positions.get(value) ?? []
    points.push({ row, col })
    positions.set(value, points)
  }))
  for (const points of positions.values()) {
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const path = findPath(board, points[i], points[j])
        if (path) return { first: points[i], second: points[j], path }
      }
    }
  }
  return null
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

export function reshuffleBoard(board: Board): Board {
  const positions: Point[] = []
  const values: number[] = []
  board.forEach((line, row) => line.forEach((value, col) => {
    if (value !== null) {
      positions.push({ row, col })
      values.push(value)
    }
  }))
  if (positions.length < 2) return board.map(line => [...line])

  for (let attempt = 0; attempt < 100; attempt++) {
    shuffle(values)
    const next = board.map(line => [...line])
    positions.forEach(({ row, col }, index) => { next[row][col] = values[index] })
    if (findAvailablePair(next)) return next
  }

  // Force a match onto any two positions that can connect, preserving all tile counts.
  const next = board.map(line => [...line])
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const first = positions[i]
      const second = positions[j]
      const original = next[second.row][second.col]
      next[second.row][second.col] = next[first.row][first.col]
      const connects = !!findPath(next, first, second)
      next[second.row][second.col] = original
      if (!connects) continue
      const pairIndex = positions.findIndex((point, index) => index !== i && next[point.row][point.col] === next[first.row][first.col])
      if (pairIndex !== -1) {
        const pair = positions[pairIndex]
        ;[next[second.row][second.col], next[pair.row][pair.col]] = [next[pair.row][pair.col], next[second.row][second.col]]
        return next
      }
    }
  }
  return next
}

export function createBoard(rows: number, cols: number): Board {
  if ((rows * cols) % 2 !== 0) throw new Error('The board must have an even number of cells.')
  const values = Array.from({ length: rows * cols / 2 }, (_, index) => index % 8).flatMap(value => [value, value])
  const board: Board = Array.from({ length: rows }, (_, row) => values.slice(row * cols, (row + 1) * cols))
  return reshuffleBoard(board)
}

export function remainingTiles(board: Board): number {
  return board.reduce((count, line) => count + line.filter(value => value !== null).length, 0)
}
