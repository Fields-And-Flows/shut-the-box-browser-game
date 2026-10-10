'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Tak = require('./tak-engine.js');

const piece = (player = 0, type = 'flat') => ({ player, type });
const place = (index, type = 'flat') => ({ type: 'place', index, piece: type });
const move = (index, count, direction, drops) => ({
  type: 'move', index, count, direction, drops
});
const ready = (size = 5) => ({ ...Tak.createGame(size), ply: 2 });

function rejectsUnchanged(game, action) {
  const before = structuredClone(game);
  assert.throws(() => Tak.applyMove(game, action), Error);
  assert.deepEqual(game, before);
}

test('all sizes have independent stacks and correct reserves; default and exports', () => {
  for (const [size, stones, caps] of [
    [3, 10, 0], [4, 15, 0], [5, 21, 1], [6, 30, 1], [7, 40, 2], [8, 50, 2]
  ]) {
    const game = Tak.createGame(size);
    assert.equal(game.size, size);
    assert.equal(game.board.length, size * size);
    assert.equal(new Set(game.board).size, size * size);
    assert.deepEqual(game.reserves, [{ stones, caps }, { stones, caps }]);
    assert.notEqual(game.reserves[0], game.reserves[1]);
    assert.equal(game.currentPlayer, 0);
    assert.equal(game.ply, 0);
    assert.equal(game.result, null);
  }
  assert.equal(Tak.createGame().size, 5);
  for (const size of [2, 9, 3.5, '5', null, NaN]) {
    assert.throws(() => Tak.createGame(size), Error);
  }
  assert.equal(globalThis.Tak, Tak);
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('./tak-engine.js'), 'utf8'), context);
  assert.equal(context.Tak.createGame().size, 5);
});

test('opening places opponent flats and then switches to own pieces immutably', () => {
  const original = Tak.createGame();
  const before = structuredClone(original);
  const first = Tak.applyMove(original, place(0));
  assert.deepEqual(original, before);
  assert.deepEqual(first.board[0], [piece(1)]);
  assert.deepEqual(first.reserves, [{ stones: 21, caps: 1 }, { stones: 20, caps: 1 }]);
  assert.equal(first.currentPlayer, 1);
  assert.equal(first.ply, 1);
  for (const game of [original, first]) {
    rejectsUnchanged(game, place(1, 'wall'));
    rejectsUnchanged(game, place(1, 'cap'));
    rejectsUnchanged(game, move(0, 1, 'E', [1]));
  }
  const second = Tak.applyMove(first, place(1));
  assert.deepEqual(second.board[1], [piece(0)]);
  const third = Tak.applyMove(second, place(2, 'wall'));
  assert.deepEqual(third.board[2], [piece(0, 'wall')]);
  assert.deepEqual(third.reserves[0], { stones: 19, caps: 1 });
  third.board[0][0].type = 'wall';
  third.reserves[1].stones = 0;
  assert.equal(first.board[0][0].type, 'flat');
  assert.equal(first.reserves[1].stones, 20);
});

test('invalid placements, coordinates, kinds, and exhausted reserves are atomic', () => {
  const game = ready();
  game.board[0] = [piece()];
  for (const action of [
    null, {}, place(-1), place(25), place(1.5), place('1'),
    place(0), place(1, 'unknown'), { type: 'unknown', index: 1 }
  ]) rejectsUnchanged(game, action);
  game.reserves[0].caps = 0;
  rejectsUnchanged(game, place(1, 'cap'));
  game.reserves[0].stones = 0;
  rejectsUnchanged(game, place(1));
  rejectsUnchanged(game, place(1, 'wall'));
  const small = ready(3);
  rejectsUnchanged(small, place(0, 'cap'));
});

test('capstones consume cap supply, and stones alone exhausted does not end game', () => {
  const game = ready();
  game.reserves[0].stones = 1;
  const noStones = Tak.applyMove(game, place(0));
  assert.deepEqual(noStones.reserves[0], { stones: 0, caps: 1 });
  assert.equal(noStones.result, null);
  const turnBack = Tak.applyMove(noStones, place(1));
  const ended = Tak.applyMove(turnBack, place(2, 'cap'));
  assert.deepEqual(ended.reserves[0], { stones: 0, caps: 0 });
  assert.deepEqual(ended.result, { winner: null, type: 'draw', scores: [1, 1] });
  assert.equal(ended.currentPlayer, 1);
  rejectsUnchanged(ended, place(3));
  const capOnly = ready();
  capOnly.reserves[0].caps = 1;
  assert.equal(Tak.applyMove(capOnly, place(0, 'cap')).result, null);
});

test('carry top pieces and drop bottom-first without changing source game or move', () => {
  const game = ready();
  game.board[10] = [piece(1, 'wall'), piece(1), piece(0), piece(0, 'cap')];
  game.board[11] = [piece(1)];
  const action = move(10, 3, 'E', [2, 1]);
  const before = structuredClone(game);
  const next = Tak.applyMove(game, action);
  assert.deepEqual(game, before);
  assert.deepEqual(action, move(10, 3, 'E', [2, 1]));
  assert.deepEqual(next.board[10], [piece(1, 'wall')]);
  assert.deepEqual(next.board[11], [piece(1), piece(1), piece(0)]);
  assert.deepEqual(next.board[12], [piece(0, 'cap')]);
  assert.deepEqual(next.reserves, game.reserves);
  assert.equal(next.currentPlayer, 1);
  assert.equal(next.ply, 3);
});

test('directions are orthogonal and all four work', () => {
  for (const [direction, target] of [['N', 7], ['E', 13], ['S', 17], ['W', 11]]) {
    const game = ready();
    game.board[12] = [piece()];
    const next = Tak.applyMove(game, move(12, 1, direction, [1]));
    assert.deepEqual(next.board[12], []);
    assert.deepEqual(next.board[target], [piece()]);
  }
});

test('invalid stack moves are atomic, including failure after an earlier drop', () => {
  const game = ready(3);
  game.board[3] = [piece(1), piece(), piece(), piece()];
  game.board[8] = [piece(1)];
  for (const action of [
    move(0, 1, 'E', [1]), move(8, 1, 'W', [1]),
    move(3, 0, 'E', [1]), move(3, 4, 'E', [4]),
    move(3, 1.5, 'E', [1.5]), move(3, 1, 'X', [1]),
    move(3, 1, 'toString', [1]), move(3, 1, 'E', []),
    move(3, 2, 'E', [1]), move(3, 2, 'E', [0, 2]),
    move(3, 2, 'E', [-1, 3]), move(3, 2, 'E', [0.5, 1.5]),
    move(3, 2, 'E', ['1', 1]), move(3, 1, 'E', null),
    move(3, 1, 'E', [, 1]),
    move(3, 3, 'E', [1, 1, 1]), move(3, 1, 'W', [1]),
    move(3, 2, 'N', [1, 1])
  ]) rejectsUnchanged(game, action);
  game.board[4] = [piece(1, 'cap')];
  rejectsUnchanged(game, move(3, 1, 'E', [1]));
  game.board[4] = [];
  game.board[5] = [piece(1, 'wall')];
  rejectsUnchanged(game, move(3, 2, 'E', [1, 1]));
  const short = ready();
  short.board[0] = [piece()];
  rejectsUnchanged(short, move(0, 2, 'E', [2]));
});

test('walls can move onto flats, but neither flats nor walls can cover walls', () => {
  const game = ready();
  game.board[0] = [piece(0, 'wall')];
  game.board[1] = [piece(1)];
  const next = Tak.applyMove(game, move(0, 1, 'E', [1]));
  assert.deepEqual(next.board[1], [piece(1), piece(0, 'wall')]);
  assert.deepEqual(Tak.flatCounts(next), [0, 0]);
  for (const type of ['flat', 'wall']) {
    game.board[0] = [piece(0, type)];
    game.board[1] = [piece(1, 'wall')];
    rejectsUnchanged(game, move(0, 1, 'E', [1]));
  }
});

test('cap flattening requires a lone final cap; can spread carried stack first', () => {
  const game = ready();
  game.board[5] = [piece(1), piece(), piece(0, 'cap')];
  game.board[7] = [piece(1, 'wall')];
  const next = Tak.applyMove(game, move(5, 3, 'E', [2, 1]));
  assert.deepEqual(next.board[6], [piece(1), piece()]);
  assert.deepEqual(next.board[7], [piece(1), piece(0, 'cap')]);
  assert.equal(game.board[7][0].type, 'wall');
  const lone = ready();
  lone.board[0] = [piece(0, 'cap')];
  lone.board[1] = [piece(0, 'wall')];
  assert.deepEqual(Tak.applyMove(lone, move(0, 1, 'E', [1])).board[1],
    [piece(0), piece(0, 'cap')]);
  game.board[6] = [piece(1, 'wall')];
  rejectsUnchanged(game, move(5, 3, 'E', [2, 1]));
  rejectsUnchanged(game, move(5, 3, 'E', [3]));
  game.board[6] = [];
  game.board[7] = [piece(1, 'cap')];
  rejectsUnchanged(game, move(5, 3, 'E', [2, 1]));
});

test('roads use top flats and caps in both axes, never walls, buried pieces or diagonals', () => {
  for (const [indices, player] of [[[0, 3, 6], 0], [[3, 4, 5], 1]]) {
    const game = ready(3);
    for (const index of indices) game.board[index] = [piece(1 - player), piece(player)];
    game.board[indices[1]][1].type = 'cap';
    assert.deepEqual(Tak.findRoad(game, player), indices);
    assert.equal(Tak.findRoad(game, 1 - player), null);
    game.board[indices[1]][1].type = 'wall';
    assert.equal(Tak.findRoad(game, player), null);
  }
  const game = ready(3);
  for (const index of [0, 4, 8]) game.board[index] = [piece()];
  assert.equal(Tak.findRoad(game, 0), null);
  for (const index of [2, 3]) game.board[index] = [piece()];
  assert.equal(Tak.findRoad(game, 0), null); // Adjacent flat indices do not wrap rows.
});

test('findRoad follows winding connected paths and does not mutate', () => {
  const game = ready(5);
  const indices = [1, 6, 7, 8, 13, 18, 17, 16, 21];
  for (const index of indices) game.board[index] = [piece()];
  const before = structuredClone(game);
  assert.deepEqual(Tak.findRoad(game, 0), indices);
  assert.deepEqual(game, before);
});

test('road results include path and scores; successful move switches player', () => {
  const game = ready(3);
  game.board[0] = [piece()];
  game.board[3] = [piece()];
  const next = Tak.applyMove(game, place(6));
  assert.deepEqual(next.result, { winner: 0, type: 'road', path: [0, 3, 6], scores: [3, 0] });
  assert.equal(next.currentPlayer, 1);
  rejectsUnchanged(next, move(6, 1, 'E', [1]));
});

test('simultaneous roads award mover; uncovering only opponent road awards opponent', () => {
  const game = ready(3);
  for (const index of [0, 2]) game.board[index] = [piece(1)];
  game.board[1] = [piece(1), piece()];
  for (const index of [3, 5]) game.board[index] = [piece()];
  const next = Tak.applyMove(game, move(1, 1, 'S', [1]));
  assert.deepEqual(next.result, { winner: 0, type: 'road', path: [3, 4, 5], scores: [3, 3] });
  game.board[3] = [];
  game.board[5] = [];
  assert.equal(Tak.applyMove(game, move(1, 1, 'S', [1])).result.winner, 1);
  game.currentPlayer = 1;
  for (const stack of game.board) {
    for (const stone of stack) stone.player = 1 - stone.player;
  }
  game.board[3] = [piece(1)];
  game.board[5] = [piece(1)];
  assert.equal(Tak.applyMove(game, move(1, 1, 'S', [1])).result.winner, 1);
});

test('flat counts exclude caps, walls and buried flats', () => {
  const game = ready();
  game.board[0] = [piece(1), piece()];
  game.board[1] = [piece(), piece(1)];
  game.board[2] = [piece(), piece(0, 'wall')];
  game.board[3] = [piece(1), piece(1, 'cap')];
  assert.deepEqual(Tak.flatCounts(game), [1, 1]);
});

test('full board flat win or draw, and exhaustion of either player ends game', () => {
  const game = ready(3);
  game.board = Array.from({ length: 9 }, () => [piece(1, 'wall')]);
  game.board[0] = [piece()];
  game.board[1] = [];
  assert.deepEqual(Tak.applyMove(game, place(1)).result,
    { winner: 0, type: 'flat', scores: [2, 0] });
  game.board[0] = [piece(1)];
  assert.deepEqual(Tak.applyMove(game, place(1)).result,
    { winner: null, type: 'draw', scores: [1, 1] });
  const exhausted = ready(3);
  exhausted.reserves[1] = { stones: 0, caps: 0 };
  exhausted.board[0] = [piece(1)];
  exhausted.board[1] = [piece(1)];
  assert.deepEqual(Tak.applyMove(exhausted, place(8)).result,
    { winner: 1, type: 'flat', scores: [1, 2] });
});

test('road wins over full-board scoring and over reserve exhaustion', () => {
  const game = ready(3);
  game.board = Array.from({ length: 9 }, () => [piece(1, 'wall')]);
  for (const index of [0, 3]) game.board[index] = [piece()];
  game.board[6] = [];
  for (const index of [1, 2, 4, 5]) game.board[index] = [piece(1)];
  const full = Tak.applyMove(game, place(6));
  assert.equal(full.result.type, 'road');
  assert.equal(full.result.winner, 0);
  assert.deepEqual(full.result.scores, [3, 4]);
  const exhausted = ready(3);
  exhausted.board[0] = [piece()];
  exhausted.board[3] = [piece()];
  exhausted.reserves[0].stones = 1;
  assert.equal(Tak.applyMove(exhausted, place(6)).result.type, 'road');
});
