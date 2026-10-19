export type Point = { row: number; col: number };
export type Board = (number | null)[][];
export type Level = {
  number: number;
  chapter: string;
  rows: number;
  cols: number;
  seconds: number;
  types: number;
  blockers: 0 | 4 | 8 | 12;
  gravity: boolean;
};

const CHAPTERS = [
  {
    name: "初识几何",
    rows: 6,
    cols: 6,
    seconds: [100, 95, 90, 85, 80, 75],
    types: [5, 6, 6, 7, 7, 8],
    blockers: [0, 0, 0, 0, 0, 0],
    gravity: false,
  },
  {
    name: "留白迷宫",
    rows: 6,
    cols: 8,
    seconds: [120, 115, 110, 105, 100, 95],
    types: [7, 8, 8, 9, 9, 10],
    blockers: [4, 4, 4, 8, 8, 8],
    gravity: false,
  },
  {
    name: "错落方阵",
    rows: 8,
    cols: 8,
    seconds: [145, 140, 135, 130, 125, 120],
    types: [8, 9, 9, 10, 10, 11],
    blockers: [4, 4, 8, 8, 12, 12],
    gravity: false,
  },
  {
    name: "重力变奏",
    rows: 8,
    cols: 10,
    seconds: [170, 165, 160, 155, 150, 145],
    types: [9, 9, 10, 10, 11, 11],
    blockers: [0, 4, 4, 8, 8, 12],
    gravity: true,
  },
  {
    name: "终章挑战",
    rows: 10,
    cols: 10,
    seconds: [200, 190, 180, 170, 160, 150],
    types: [10, 10, 11, 11, 12, 12],
    blockers: [4, 8, 8, 12, 12, 12],
    gravity: true,
  },
] as const;

export const LEVELS: Level[] = CHAPTERS.flatMap((chapter, chapterIndex) =>
  chapter.seconds.map((seconds, index) => ({
    number: chapterIndex * 6 + index + 1,
    chapter: chapter.name,
    rows: chapter.rows,
    cols: chapter.cols,
    seconds,
    types: chapter.types[index],
    blockers: chapter.blockers[index] as Level["blockers"],
    gravity: chapter.gravity,
  })),
);

const DIRECTIONS = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
] as const;

export function samePoint(a: Point, b: Point): boolean {
  return a.row === b.row && a.col === b.col;
}

export function findPath(
  board: Board,
  start: Point,
  end: Point,
): Point[] | null {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  if (!rows || !cols || samePoint(start, end)) return null;
  if (
    ![start, end].every(
      ({ row, col }) => row >= 0 && row < rows && col >= 0 && col < cols,
    )
  )
    return null;
  if (
    board[start.row][start.col] === null ||
    board[start.row][start.col]! < 0 ||
    board[start.row][start.col] !== board[end.row][end.col]
  )
    return null;

  type State = {
    row: number;
    col: number;
    direction: number;
    turns: number;
    path: Point[];
  };
  const queue: State[] = [];
  const best = new Map<string, { turns: number; steps: number }>();

  for (let direction = 0; direction < 4; direction++) {
    const row = start.row + 1 + DIRECTIONS[direction][0];
    const col = start.col + 1 + DIRECTIONS[direction][1];
    if (row < 0 || row > rows + 1 || col < 0 || col > cols + 1) continue;
    if (
      row > 0 &&
      row <= rows &&
      col > 0 &&
      col <= cols &&
      board[row - 1][col - 1] !== null &&
      !(row === end.row + 1 && col === end.col + 1)
    )
      continue;
    queue.push({
      row,
      col,
      direction,
      turns: 0,
      path: [
        { row: start.row + 1, col: start.col + 1 },
        { row, col },
      ],
    });
  }

  while (queue.length) {
    queue.sort((a, b) => a.turns - b.turns || a.path.length - b.path.length);
    const current = queue.shift()!;
    const key = `${current.row},${current.col},${current.direction}`;
    const previous = best.get(key);
    if (
      previous &&
      (previous.turns < current.turns ||
        (previous.turns === current.turns &&
          previous.steps <= current.path.length))
    )
      continue;
    best.set(key, { turns: current.turns, steps: current.path.length });

    if (current.row === end.row + 1 && current.col === end.col + 1)
      return current.path;

    for (let direction = 0; direction < 4; direction++) {
      const turns = current.turns + Number(direction !== current.direction);
      if (turns > 2) continue;
      const row = current.row + DIRECTIONS[direction][0];
      const col = current.col + DIRECTIONS[direction][1];
      if (row < 0 || row > rows + 1 || col < 0 || col > cols + 1) continue;
      if (
        row > 0 &&
        row <= rows &&
        col > 0 &&
        col <= cols &&
        board[row - 1][col - 1] !== null &&
        !(row === end.row + 1 && col === end.col + 1)
      )
        continue;
      queue.push({
        row,
        col,
        direction,
        turns,
        path: [...current.path, { row, col }],
      });
    }
  }
  return null;
}

export function findAvailablePair(
  board: Board,
): { first: Point; second: Point; path: Point[] } | null {
  const positions = new Map<number, Point[]>();
  board.forEach((line, row) =>
    line.forEach((value, col) => {
      if (value === null || value < 0) return;
      const points = positions.get(value) ?? [];
      points.push({ row, col });
      positions.set(value, points);
    }),
  );
  for (const points of positions.values()) {
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const path = findPath(board, points[i], points[j]);
        if (path) return { first: points[i], second: points[j], path };
      }
    }
  }
  return null;
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function reshuffleBoard(board: Board): Board {
  const positions: Point[] = [];
  const values: (number | null)[] = [];
  board.forEach((line, row) =>
    line.forEach((value, col) => {
      if (value !== -1) {
        positions.push({ row, col });
        values.push(value);
      }
    }),
  );
  if (values.filter((value) => value !== null).length < 2)
    return board.map((line) => [...line]);

  for (let attempt = 0; attempt < 100; attempt++) {
    shuffle(values);
    const next = board.map((line) => [...line]);
    positions.forEach(({ row, col }, index) => {
      next[row][col] = values[index];
    });
    if (findAvailablePair(next)) return next;
  }

  // Force a pair into adjacent open cells if random layouts could not connect.
  const next = board.map((line) => [...line]);
  const first = positions.find((point) =>
    positions.some(
      (other) =>
        (point.row === other.row && Math.abs(point.col - other.col) === 1) ||
        (point.col === other.col && Math.abs(point.row - other.row) === 1),
    ),
  );
  if (!first) return next;
  const second = positions.find(
    (point) =>
      (point.row === first.row && Math.abs(point.col - first.col) === 1) ||
      (point.col === first.col && Math.abs(point.row - first.row) === 1),
  )!;
  const pairValue = values.find((value) => value !== null)!;
  const swapInto = (target: Point) => {
    if (next[target.row][target.col] === pairValue) return;
    const source = positions.find(
      (point) =>
        !samePoint(point, first) &&
        !samePoint(point, second) &&
        next[point.row][point.col] === pairValue,
    );
    if (!source) return;
    [next[target.row][target.col], next[source.row][source.col]] = [
      next[source.row][source.col],
      next[target.row][target.col],
    ];
  };
  swapInto(first);
  swapInto(second);
  return next;
}

export function createBoard(rows: number, cols: number): Board {
  if ((rows * cols) % 2 !== 0)
    throw new Error("The board must have an even number of cells.");
  const values = Array.from(
    { length: (rows * cols) / 2 },
    (_, index) => index % 8,
  ).flatMap((value) => [value, value]);
  const board: Board = Array.from({ length: rows }, (_, row) =>
    values.slice(row * cols, (row + 1) * cols),
  );
  return reshuffleBoard(board);
}

export function remainingTiles(board: Board): number {
  return board.reduce(
    (count, line) =>
      count + line.filter((value) => value !== null && value >= 0).length,
    0,
  );
}

export function createLevelBoard(level: Level): Board {
  const board: Board = Array.from({ length: level.rows }, () =>
    Array(level.cols).fill(null),
  );
  const midRow = Math.floor(level.rows / 2);
  const midCol = Math.floor(level.cols / 2);
  const candidates: Point[] = [
    { row: midRow - 1, col: midCol - 1 },
    { row: midRow - 1, col: midCol },
    { row: midRow, col: midCol - 1 },
    { row: midRow, col: midCol },
    { row: 1, col: 1 },
    { row: 1, col: level.cols - 2 },
    { row: level.rows - 2, col: 1 },
    { row: level.rows - 2, col: level.cols - 2 },
    { row: midRow - 1, col: 1 },
    { row: midRow, col: 1 },
    { row: midRow - 1, col: level.cols - 2 },
    { row: midRow, col: level.cols - 2 },
  ];
  candidates.slice(0, level.blockers).forEach(({ row, col }) => {
    board[row][col] = -1;
  });
  const open = level.rows * level.cols - level.blockers;
  const values = shuffle(
    Array.from({ length: open / 2 }, (_, index) => index % level.types).flatMap(
      (value) => [value, value],
    ),
  );
  let index = 0;
  board.forEach((line, row) =>
    line.forEach((value, col) => {
      if (value !== -1) board[row][col] = values[index++];
    }),
  );
  return reshuffleBoard(board);
}

export function applyGravity(board: Board): Board {
  const next = board.map((line) => [...line]);
  const cols = next[0]?.length ?? 0;
  for (let col = 0; col < cols; col++) {
    let bottom = next.length - 1;
    while (bottom >= 0) {
      if (next[bottom][col] === -1) {
        bottom--;
        continue;
      }
      let top = bottom;
      while (top >= 0 && next[top][col] !== -1) top--;
      const values: number[] = [];
      for (let row = bottom; row > top; row--) {
        const value = next[row][col];
        if (value !== null) values.push(value);
      }
      for (let row = bottom; row > top; row--)
        next[row][col] = values[bottom - row] ?? null;
      bottom = top - 1;
    }
  }
  return next;
}
