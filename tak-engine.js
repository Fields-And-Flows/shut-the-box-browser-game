(function (root) {
  'use strict';

  const SUPPLIES = {
    3: [10, 0], 4: [15, 0], 5: [21, 1],
    6: [30, 1], 7: [40, 2], 8: [50, 2]
  };
  const TYPES = ['flat', 'wall', 'cap'];

  function createGame(size = 5) {
    if (!Number.isInteger(size) || !SUPPLIES[size]) {
      throw new Error('Board size must be an integer from 3 to 8.');
    }
    const [stones, caps] = SUPPLIES[size];
    return {
      size,
      board: Array.from({ length: size * size }, () => []),
      reserves: [{ stones, caps }, { stones, caps }],
      currentPlayer: 0,
      ply: 0,
      result: null
    };
  }

  function flatCounts(game) {
    const counts = [0, 0];
    for (const stack of game.board) {
      const top = stack[stack.length - 1];
      if (top && top.type === 'flat') counts[top.player]++;
    }
    return counts;
  }

  function findRoad(game, player) {
    const { size, board } = game;
    const isRoad = (index) => {
      const stack = board[index];
      const top = stack[stack.length - 1];
      return top && top.player === player &&
        (top.type === 'flat' || top.type === 'cap');
    };

    for (const vertical of [true, false]) {
      const queue = [];
      const previous = new Map();
      for (let n = 0; n < size; n++) {
        const index = vertical ? n : n * size;
        if (isRoad(index)) {
          previous.set(index, null);
          queue.push(index);
        }
      }
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const index = queue[cursor];
        const row = Math.floor(index / size);
        const col = index % size;
        if (vertical ? row === size - 1 : col === size - 1) {
          const path = [];
          for (let at = index; at !== null; at = previous.get(at)) path.push(at);
          return path.reverse();
        }
        const neighbors = [];
        if (row > 0) neighbors.push(index - size);
        if (col < size - 1) neighbors.push(index + 1);
        if (row < size - 1) neighbors.push(index + size);
        if (col > 0) neighbors.push(index - 1);
        for (const next of neighbors) {
          if (!previous.has(next) && isRoad(next)) {
            previous.set(next, index);
            queue.push(next);
          }
        }
      }
    }
    return null;
  }

  function finish(game, mover) {
    const scores = flatCounts(game);
    for (const player of [mover, 1 - mover]) {
      const path = findRoad(game, player);
      if (path) {
        game.result = { winner: player, type: 'road', path, scores };
        return;
      }
    }
    if (game.board.every((stack) => stack.length > 0) ||
        game.reserves.some(({ stones, caps }) => stones === 0 && caps === 0)) {
      const winner = scores[0] === scores[1] ? null : (scores[0] > scores[1] ? 0 : 1);
      game.result = { winner, type: winner === null ? 'draw' : 'flat', scores };
    }
  }

  function applyMove(game, move) {
    if (game.result) throw new Error('The game is already over.');
    if (!move || !Number.isInteger(move.index) ||
        move.index < 0 || move.index >= game.board.length) {
      throw new Error('Invalid square.');
    }
    const next = {
      ...game,
      board: game.board.map((stack) => stack.map((piece) => ({ ...piece }))),
      reserves: game.reserves.map((reserve) => ({ ...reserve })),
      result: null
    };
    const mover = game.currentPlayer;
    const stack = next.board[move.index];

    if (move.type === 'place') {
      if (!TYPES.includes(move.piece)) throw new Error('Invalid piece type.');
      if (stack.length) throw new Error('Placement requires an empty square.');
      if (game.ply < 2 && move.piece !== 'flat') {
        throw new Error('Opening placements must be opponent flats.');
      }
      const player = game.ply < 2 ? 1 - mover : mover;
      const supply = move.piece === 'cap' ? 'caps' : 'stones';
      if (next.reserves[player][supply] <= 0) throw new Error('No pieces in reserve.');
      next.reserves[player][supply]--;
      stack.push({ player, type: move.piece });
    } else if (move.type === 'move') {
      if (game.ply < 2) throw new Error('Stacks cannot move during the opening.');
      if (!stack.length || stack[stack.length - 1].player !== mover) {
        throw new Error('You must control the stack.');
      }
      if (!Number.isInteger(move.count) || move.count < 1 ||
          move.count > game.size || move.count > stack.length) {
        throw new Error('Invalid carry count.');
      }
      const directions = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
      if (!Object.prototype.hasOwnProperty.call(directions, move.direction)) {
        throw new Error('Invalid direction.');
      }
      if (!Array.isArray(move.drops) || !move.drops.length ||
          !Array.from(move.drops).every((drop) => Number.isInteger(drop) && drop > 0) ||
          move.drops.reduce((sum, drop) => sum + drop, 0) !== move.count) {
        throw new Error('Drops must be positive integers totaling the carry count.');
      }
      const carried = stack.splice(stack.length - move.count);
      const [dr, dc] = directions[move.direction];
      let row = Math.floor(move.index / game.size);
      let col = move.index % game.size;
      for (const drop of move.drops) {
        row += dr;
        col += dc;
        if (row < 0 || col < 0 || row >= game.size || col >= game.size) {
          throw new Error('Move leaves the board.');
        }
        const target = next.board[row * game.size + col];
        const top = target[target.length - 1];
        if (top && top.type === 'cap') throw new Error('Capstones cannot be covered.');
        if (top && top.type === 'wall') {
          // A wall can only be flattened by the last, lone carried capstone.
          if (carried.length !== 1 || drop !== 1 || carried[0].type !== 'cap') {
            throw new Error('Only a lone final capstone can flatten a wall.');
          }
          top.type = 'flat';
        }
        target.push(...carried.splice(0, drop));
      }
    } else {
      throw new Error('Invalid move type.');
    }

    next.ply++;
    next.currentPlayer = 1 - mover;
    finish(next, mover);
    return next;
  }

  const Tak = { createGame, applyMove, flatCounts, findRoad };
  root.Tak = Tak;
  if (typeof module !== 'undefined' && module.exports) module.exports = Tak;
})(globalThis);
