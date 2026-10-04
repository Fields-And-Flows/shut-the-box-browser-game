const MAX_ROUNDS = 5;
const TILE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const state = {
  playerCount: 2,
  currentPlayer: 0,
  currentRound: 1,
  rulesMode: "classic", // "classic" or "alwaysSum"
  players: [],
  tilesOpen: new Set(TILE_VALUES),
  selectedTiles: new Set(),
  dice: [null, null],
  rolled: false,
  lastRollTotal: null,
  canUseOneDie: false,
  turnFinished: false
};

const el = {
  playerCount: document.getElementById("playerCount"),
  rulesMode: document.getElementById("rulesMode"),
  newGameBtn: document.getElementById("newGameBtn"),
  turnText: document.getElementById("turnText"),
  diceText: document.getElementById("diceText"),
  roundText: document.getElementById("roundText"),
  rollBtn: document.getElementById("rollBtn"),
  die1: document.getElementById("die1"),
  die2: document.getElementById("die2"),
  rollValue: document.getElementById("rollValue"),
  oneDieHint: document.getElementById("oneDieHint"),
  tiles: document.getElementById("tiles"),
  selectionText: document.getElementById("selectionText"),
  confirmMoveBtn: document.getElementById("confirmMoveBtn"),
  clearSelectionBtn: document.getElementById("clearSelectionBtn"),
  endTurnBtn: document.getElementById("endTurnBtn"),
  scoresList: document.getElementById("scoresList"),
  winnerText: document.getElementById("winnerText")
};

function initGame() {
  state.playerCount = Number(el.playerCount.value);
  state.rulesMode = el.rulesMode.value;
  state.currentPlayer = 0;
  state.currentRound = 1;
  state.players = Array.from({ length: state.playerCount }, (_, i) => ({
    name: `Player ${i + 1}`,
    roundScores: [],
    totalScore: 0
  }));
  resetTurnBoard();
  renderTiles();
  renderAll();
}

function resetTurnBoard() {
  state.tilesOpen = new Set(TILE_VALUES);
  state.selectedTiles = new Set();
  state.dice = [null, null];
  state.rolled = false;
  state.lastRollTotal = null;
  state.turnFinished = false;
  updateOneDieEligibility();
}

function renderTiles() {
  el.tiles.innerHTML = "";
  TILE_VALUES.forEach((value) => {
    const btn = document.createElement("button");
    btn.className = "tile";
    btn.textContent = value;
    btn.dataset.value = String(value);
    btn.addEventListener("click", () => toggleTileSelection(value));
    el.tiles.appendChild(btn);
  });
  paintTiles();
}

function paintTiles() {
  [...el.tiles.children].forEach((tileEl) => {
    const val = Number(tileEl.dataset.value);
    tileEl.classList.toggle("closed", !state.tilesOpen.has(val));
    tileEl.disabled = !state.tilesOpen.has(val);

    const isSelected = state.selectedTiles.has(val);
    tileEl.classList.toggle("selected", isSelected);
  });
}

function renderAll() {
  el.turnText.textContent = `${state.players[state.currentPlayer].name}'s turn`;
  el.roundText.textContent = `Round ${state.currentRound} of ${MAX_ROUNDS}`;

  const d1 = state.dice[0] ?? "-";
  const d2 = state.dice[1] ?? "-";
  el.die1.textContent = d1;
  el.die2.textContent = state.canUseOneDie && state.rolled ? "•" : d2;

  el.rollValue.textContent = `Roll total: ${state.lastRollTotal ?? "-"}`;
  el.selectionText.textContent =
    `Selected: ${[...state.selectedTiles].sort((a, b) => a - b).join(", ") || "none"}`;

  el.clearSelectionBtn.disabled = state.selectedTiles.size === 0 || !state.rolled;
  el.confirmMoveBtn.disabled = !isCurrentSelectionValid();
  el.endTurnBtn.disabled = !state.rolled || !state.turnFinished;

  el.rollBtn.disabled = state.rolled && !state.turnFinished;
  el.diceText.textContent = state.rolled
    ? "Select tiles based on your roll."
    : "Roll to begin your move.";

  el.oneDieHint.textContent = state.canUseOneDie
    ? "One-die mode active (7, 8, and 9 are closed)."
    : "";

  renderScores();
  paintTiles();
}

function renderScores() {
  el.scoresList.innerHTML = "";
  state.players.forEach((p, i) => {
    const li = document.createElement("li");
    const rounds = p.roundScores.length ? p.roundScores.join(", ") : "-";
    li.textContent = `${p.name}: total ${p.totalScore} | rounds: ${rounds}`;
    if (i === state.currentPlayer) li.style.borderColor = "#3b82f6";
    el.scoresList.appendChild(li);
  });
}

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function handleRoll() {
  if (state.rolled && !state.turnFinished) return;

  state.selectedTiles.clear();
  state.turnFinished = false;
  updateOneDieEligibility();

  if (state.canUseOneDie) {
    const d1 = rollDie();
    state.dice = [d1, null];
    state.lastRollTotal = d1;
  } else {
    const d1 = rollDie();
    const d2 = rollDie();
    state.dice = [d1, d2];
    state.lastRollTotal = d1 + d2;
  }

  state.rolled = true;

  if (!hasAnyLegalMove()) {
    // automatic bust/end turn
    scoreAndAdvanceTurn();
    return;
  }

  renderAll();
}

function toggleTileSelection(value) {
  if (!state.rolled) return;
  if (!state.tilesOpen.has(value)) return;

  if (state.selectedTiles.has(value)) {
    state.selectedTiles.delete(value);
  } else {
    state.selectedTiles.add(value);
  }
  renderAll();
}

function selectedSum() {
  return [...state.selectedTiles].reduce((a, b) => a + b, 0);
}

function isCurrentSelectionValid() {
  if (!state.rolled || state.selectedTiles.size === 0) return false;

  const sum = selectedSum();
  if (sum !== state.lastRollTotal) return false;

  // Always Sum: any open-tile combination matching total is valid
  if (state.rulesMode === "alwaysSum") return true;

  // Classic:
  // - one tile equal to total OR
  // - if using two dice and dice differ, exactly those two face values
  if (state.canUseOneDie) {
    return state.selectedTiles.size === 1 && state.selectedTiles.has(state.lastRollTotal);
  }

  const [d1, d2] = state.dice;
  if (state.selectedTiles.size === 1 && state.selectedTiles.has(state.lastRollTotal)) {
    return true;
  }

  if (d1 !== d2 && state.selectedTiles.size === 2) {
    return state.selectedTiles.has(d1) && state.selectedTiles.has(d2);
  }

  return false;
}

function hasAnyLegalMove() {
  const open = [...state.tilesOpen].sort((a, b) => a - b);
  const target = state.lastRollTotal;

  if (state.rulesMode === "alwaysSum") {
    return hasSubsetSum(open, target);
  }

  if (state.canUseOneDie) {
    return state.tilesOpen.has(target);
  }

  const [d1, d2] = state.dice;
  const totalMoveExists = state.tilesOpen.has(target);
  const pairMoveExists = d1 !== d2 && state.tilesOpen.has(d1) && state.tilesOpen.has(d2);
  return totalMoveExists || pairMoveExists;
}

function hasSubsetSum(nums, target) {
  // small set (1..9) brute force is fine
  const n = nums.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) sum += nums[i];
    }
    if (sum === target) return true;
  }
  return false;
}

function handleConfirmMove() {
  if (!isCurrentSelectionValid()) return;

  // close selected tiles
  state.selectedTiles.forEach((v) => state.tilesOpen.delete(v));
  state.selectedTiles.clear();

  // check instant shut
  if (state.tilesOpen.size === 0) {
    scoreAndAdvanceTurn(0);
    return;
  }

  // allow another roll
  state.rolled = false;
  state.dice = [null, null];
  state.lastRollTotal = null;
  updateOneDieEligibility();
  renderAll();
}

function updateOneDieEligibility() {
  state.canUseOneDie = !state.tilesOpen.has(7) && !state.tilesOpen.has(8) && !state.tilesOpen.has(9);
}

function handleEndTurn() {
  if (!state.turnFinished) return;
  advanceTurn();
}

function scoreAndAdvanceTurn(forcedScore = null) {
  state.turnFinished = true;
  const score = forcedScore ?? [...state.tilesOpen].reduce((a, b) => a + b, 0);

  const player = state.players[state.currentPlayer];
  player.roundScores.push(score);
  player.totalScore += score;

  el.diceText.textContent = `${player.name} ends turn with score ${score}.`;
  renderAll();
}

function advanceTurn() {
  // next player
  state.currentPlayer++;

  if (state.currentPlayer >= state.playerCount) {
    state.currentPlayer = 0;
    state.currentRound++;
  }

  if (state.currentRound > MAX_ROUNDS) {
    endGame();
    return;
  }

  resetTurnBoard();
  renderAll();
}

function endGame() {
  const minScore = Math.min(...state.players.map((p) => p.totalScore));
  const winners = state.players.filter((p) => p.totalScore === minScore).map((p) => p.name);

  el.winnerText.textContent =
    winners.length === 1
      ? `Winner: ${winners[0]} with ${minScore} points!`
      : `Tie: ${winners.join(", ")} with ${minScore} points each!`;

  // freeze game actions until New Game
  state.rolled = true;
  state.turnFinished = false;
  el.rollBtn.disabled = true;
  el.confirmMoveBtn.disabled = true;
  el.clearSelectionBtn.disabled = true;
  el.endTurnBtn.disabled = true;
}

el.newGameBtn.addEventListener("click", initGame);
el.playerCount.addEventListener("change", () => {
  // allow quick re-init by changing player count
  initGame();
});
el.rulesMode.addEventListener("change", () => {
  state.rulesMode = el.rulesMode.value;
  renderAll();
});

el.rollBtn.addEventListener("click", handleRoll);
el.confirmMoveBtn.addEventListener("click", handleConfirmMove);
el.clearSelectionBtn.addEventListener("click", () => {
  state.selectedTiles.clear();
  renderAll();
});
el.endTurnBtn.addEventListener("click", handleEndTurn);

// initial render
initGame();