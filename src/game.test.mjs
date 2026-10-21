import test from "node:test";
import assert from "node:assert/strict";
import {
  applyGravity,
  createBoard,
  createLevelBoard,
  findAvailablePair,
  findPath,
  LEVELS,
  remainingTiles,
  reshuffleBoard,
} from "./game.ts";

test("connects adjacent matching tiles", () => {
  assert.ok(findPath([[1, 1]], { row: 0, col: 0 }, { row: 0, col: 1 }));
});

test("uses the outside border for a two-turn route", () => {
  const board = [
    [1, 2, 1],
    [2, 2, 2],
  ];
  const path = findPath(board, { row: 0, col: 0 }, { row: 0, col: 2 });
  assert.ok(path);
  assert.ok(path.some((point) => point.row === 0));
});

test("rejects different shapes and routes needing more than two turns", () => {
  assert.equal(
    findPath([[1, 2]], { row: 0, col: 0 }, { row: 0, col: 1 }),
    null,
  );
  const board = Array.from({ length: 7 }, () => Array(7).fill(2));
  board[2][2] = 1;
  board[4][4] = 1;
  board[2][3] = null;
  board[3][3] = null;
  board[3][4] = null;
  assert.equal(findPath(board, { row: 2, col: 2 }, { row: 4, col: 4 }), null);
});

test("generated and reshuffled boards preserve pairs and a playable move", () => {
  const board = createBoard(8, 8);
  assert.equal(remainingTiles(board), 64);
  assert.ok(findAvailablePair(board));
  const shuffled = reshuffleBoard(board);
  assert.deepEqual(board.flat().sort(), shuffled.flat().sort());
  assert.ok(findAvailablePair(shuffled));
});

test("ten stages retain the original easiest and hardest settings", () => {
  assert.equal(LEVELS.length, 10);
  assert.deepEqual(
    LEVELS.map((level) => level.sourceNumber),
    [1, 4, 7, 10, 13, 17, 20, 24, 27, 30],
  );
  assert.deepEqual(
    LEVELS[0],
    {
      number: 1,
      sourceNumber: 1,
      chapter: "初识几何",
      rows: 6,
      cols: 6,
      seconds: 100,
      types: 5,
      blockers: 0,
      gravity: false,
    },
  );
  assert.deepEqual(
    LEVELS[9],
    {
      number: 10,
      sourceNumber: 30,
      chapter: "终章挑战",
      rows: 10,
      cols: 10,
      seconds: 150,
      types: 12,
      blockers: 12,
      gravity: true,
    },
  );
});

test("all ten stages have the configured size, obstacles, pairs, and an opening move", () => {
  assert.equal(LEVELS.length, 10);
  for (const level of LEVELS) {
    const board = createLevelBoard(level);
    assert.equal(board.length, level.rows);
    assert.ok(board.every((row) => row.length === level.cols));
    assert.equal(
      board.flat().filter((value) => value === -1).length,
      level.blockers,
    );
    assert.equal(
      remainingTiles(board),
      level.rows * level.cols - level.blockers,
    );
    assert.ok(
      findAvailablePair(board),
      `level ${level.number} has no opening move`,
    );
    const counts = new Map();
    board
      .flat()
      .filter((value) => value !== -1)
      .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    assert.ok([...counts.values()].every((count) => count % 2 === 0));
  }
});

test("gravity drops tiles within each wall-separated segment", () => {
  const board = [
    [1, null],
    [null, 2],
    [-1, null],
    [3, null],
    [null, 4],
  ];
  assert.deepEqual(applyGravity(board), [
    [null, null],
    [1, null],
    [-1, null],
    [null, 2],
    [3, 4],
  ]);
});

test("every stage remains clearable through reshuffles and gravity", () => {
  for (const level of LEVELS) {
    let board = createLevelBoard(level);
    const pairs = (level.rows * level.cols - level.blockers) / 2;
    for (let move = 0; move < pairs; move++) {
      let pair = findAvailablePair(board);
      if (!pair) {
        board = reshuffleBoard(board);
        pair = findAvailablePair(board);
      }
      assert.ok(pair, `level ${level.number} stuck after ${move} moves`);
      board[pair.first.row][pair.first.col] = null;
      board[pair.second.row][pair.second.col] = null;
      if (level.gravity) board = applyGravity(board);
    }
    assert.equal(
      remainingTiles(board),
      0,
      `level ${level.number} did not clear`,
    );
  }
});
