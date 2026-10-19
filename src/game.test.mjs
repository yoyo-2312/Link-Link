import test from 'node:test'
import assert from 'node:assert/strict'
import { createBoard, findAvailablePair, findPath, remainingTiles, reshuffleBoard } from './game.ts'

test('connects adjacent matching tiles', () => {
  assert.ok(findPath([[1, 1]], { row: 0, col: 0 }, { row: 0, col: 1 }))
})

test('uses the outside border for a two-turn route', () => {
  const board = [[1, 2, 1], [2, 2, 2]]
  const path = findPath(board, { row: 0, col: 0 }, { row: 0, col: 2 })
  assert.ok(path)
  assert.ok(path.some(point => point.row === 0))
})

test('rejects different shapes and routes needing more than two turns', () => {
  assert.equal(findPath([[1, 2]], { row: 0, col: 0 }, { row: 0, col: 1 }), null)
  const board = Array.from({ length: 7 }, () => Array(7).fill(2))
  board[2][2] = 1
  board[4][4] = 1
  board[2][3] = null
  board[3][3] = null
  board[3][4] = null
  assert.equal(findPath(board, { row: 2, col: 2 }, { row: 4, col: 4 }), null)
})

test('generated and reshuffled boards preserve pairs and a playable move', () => {
  const board = createBoard(8, 8)
  assert.equal(remainingTiles(board), 64)
  assert.ok(findAvailablePair(board))
  const shuffled = reshuffleBoard(board)
  assert.deepEqual(board.flat().sort(), shuffled.flat().sort())
  assert.ok(findAvailablePair(shuffled))
})
