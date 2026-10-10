(() => {
  "use strict";

  const names = ["White", "Black"];
  const $ = (id) => document.getElementById(id);
  const ui = Object.fromEntries([
    "boardSize", "newGame", "board", "turnMarker", "turnText", "turnHint",
    "moveNumber", "reserves", "placeMode", "moveMode", "placementControls",
    "movementControls", "carryCount", "direction", "drops", "confirmMove",
    "cancelMove", "undo", "message", "stackHeading", "stackInspector",
    "history", "movePreview"
  ].map((id) => [id, $(id)]));
  let game = Tak.createGame(5);
  let mode = "place";
  let piece = "flat";
  let selected = null;
  let past = [];
  let moves = [];

  function coordinate(index) {
    return `${String.fromCharCode(97 + index % game.size)}${game.size - Math.floor(index / game.size)}`;
  }

  function say(text, error = false) {
    ui.message.textContent = text;
    ui.message.classList.toggle("error", error);
  }

  function resetSelection() {
    selected = null;
    ui.carryCount.replaceChildren();
    ui.drops.value = "";
  }

  function movement() {
    const raw = ui.drops.value.trim();
    if (!/^\d+(?:\s*,\s*\d+)*$/.test(raw)) {
      throw new Error("Enter positive drop counts separated by commas.");
    }
    return {
      type: "move",
      index: selected,
      count: Number(ui.carryCount.value),
      direction: ui.direction.value,
      drops: raw.split(",").map(Number)
    };
  }

  function preview() {
    ui.confirmMove.disabled = true;
    ui.movePreview.textContent = "";
    for (const square of ui.board.children) square.classList.remove("destination");
    if (mode !== "move" || selected === null || game.result) return;
    const stack = game.board[selected];
    if (!stack.length || stack[stack.length - 1].player !== game.currentPlayer) {
      ui.movePreview.textContent = "Choose a stack with your color on top.";
      return;
    }
    try {
      const move = movement();
      Tak.applyMove(game, move);
      const [dr, dc] = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] }[move.direction];
      const route = move.drops.map((drop, i) => {
        const row = Math.floor(selected / game.size) + dr * (i + 1);
        const col = selected % game.size + dc * (i + 1);
        const index = row * game.size + col;
        ui.board.children[index].classList.add("destination");
        return `${coordinate(index)} (${drop})`;
      });
      ui.movePreview.textContent = `From ${coordinate(selected)} → ${route.join(" → ")}`;
      ui.confirmMove.disabled = false;
    } catch (error) {
      ui.movePreview.textContent = error.message;
    }
  }

  function renderBoard() {
    const focused = document.activeElement?.closest("[data-index]");
    const focusIndex = focused ? Number(focused.dataset.index) : null;
    ui.board.style.setProperty("--size", game.size);
    const road = new Set(game.result?.path || []);
    const squares = game.board.map((stack, index) => {
      const square = document.createElement("button");
      const row = Math.floor(index / game.size);
      const col = index % game.size;
      square.className = `square${(row + col) % 2 ? " dark-square" : ""}`;
      square.classList.toggle("selected", selected === index);
      square.classList.toggle("road", road.has(index));
      square.dataset.index = index;
      square.setAttribute("aria-pressed", String(selected === index));
      const top = stack[stack.length - 1];
      square.setAttribute("aria-label", `${coordinate(index)}: ${top ? `${names[top.player]} ${top.type === "cap" ? "capstone" : top.type}, ${stack.length} ${stack.length === 1 ? "piece" : "pieces"}` : "empty"}`);
      const label = document.createElement("span");
      label.className = "coordinate";
      label.textContent = coordinate(index);
      square.append(label);
      if (top) {
        const stone = document.createElement("span");
        stone.className = `piece ${top.type}${top.player === 1 ? " black" : ""}`;
        stone.setAttribute("aria-hidden", "true");
        square.append(stone);
        if (stack.length > 1) {
          const badge = document.createElement("span");
          badge.className = "height-badge";
          badge.textContent = stack.length;
          square.append(badge);
        }
      }
      return square;
    });
    ui.board.replaceChildren(...squares);
    if (focusIndex !== null) ui.board.children[focusIndex]?.focus();
  }

  function renderInspector() {
    ui.stackHeading.textContent = selected === null ? "Stack inspector" : `Stack at ${coordinate(selected)} · top first`;
    if (selected === null || !game.board[selected].length) {
      const hint = document.createElement("p");
      hint.className = "label";
      hint.textContent = "Select an occupied square to see every piece.";
      ui.stackInspector.replaceChildren(hint);
      return;
    }
    const list = document.createElement("ol");
    list.className = "stack-list";
    [...game.board[selected]].reverse().forEach((stone, i) => {
      const item = document.createElement("li");
      item.className = stone.player === 1 ? "black" : "";
      item.textContent = `${names[stone.player]} ${stone.type === "cap" ? "capstone" : stone.type}${i === 0 ? " · controls this square" : ""}`;
      list.append(item);
    });
    ui.stackInspector.replaceChildren(list);
  }

  function render() {
    const opening = game.ply < 2;
    const scores = Tak.flatCounts(game);
    ui.turnMarker.classList.toggle("black", (game.result?.winner ?? game.currentPlayer) === 1);
    if (game.result) {
      ui.turnText.textContent = game.result.winner === null ? "A beautifully matched draw" : `${names[game.result.winner]} wins by ${game.result.type}!`;
      ui.turnHint.textContent = `Visible flats: White ${scores[0]} · Black ${scores[1]}. Start a new game or undo the last turn.`;
    } else {
      ui.turnText.textContent = `${names[game.currentPlayer]}'s turn`;
      ui.turnHint.textContent = opening
        ? `Opening exchange: place a ${names[1 - game.currentPlayer].toLowerCase()} flat stone on an empty square.`
        : "Place a piece or move a stack you control.";
    }
    ui.moveNumber.textContent = `TURN ${game.ply + (game.result ? 0 : 1)}`;
    ui.reserves.replaceChildren(...game.reserves.map((reserve, player) => {
      const row = document.createElement("div");
      row.className = `reserve-row${!game.result && player === game.currentPlayer ? " active" : ""}`;
      const title = document.createElement("strong");
      title.textContent = names[player];
      const counts = document.createElement("span");
      counts.textContent = `${reserve.stones} stones · ${reserve.caps} caps`;
      const score = document.createElement("small");
      score.textContent = `${scores[player]} visible flats`;
      counts.append(score);
      row.append(title, counts);
      return row;
    }));
    ui.placeMode.setAttribute("aria-pressed", String(mode === "place"));
    ui.moveMode.setAttribute("aria-pressed", String(mode === "move"));
    ui.moveMode.disabled = opening || Boolean(game.result);
    ui.placeMode.disabled = Boolean(game.result);
    ui.placementControls.hidden = mode !== "place";
    ui.movementControls.hidden = mode !== "move";
    const reserve = game.reserves[opening ? 1 - game.currentPlayer : game.currentPlayer];
    document.querySelectorAll("[data-piece]").forEach((button) => {
      const type = button.dataset.piece;
      button.setAttribute("aria-pressed", String(piece === type));
      button.disabled = Boolean(game.result) || (opening && type !== "flat") || (type === "cap" ? reserve.caps === 0 : reserve.stones === 0);
    });
    ui.undo.disabled = past.length === 0;
    ui.cancelMove.disabled = selected === null;
    ui.carryCount.disabled = game.result !== null || selected === null || !game.board[selected].length || game.board[selected].at(-1).player !== game.currentPlayer;
    ui.drops.disabled = ui.carryCount.disabled;
    ui.direction.disabled = ui.carryCount.disabled;
    renderBoard();
    renderInspector();
    preview();
    ui.history.replaceChildren(...(moves.length ? moves.map((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }) : [Object.assign(document.createElement("li"), { textContent: "Your story starts here.", className: "label" })]));
    ui.history.scrollTop = ui.history.scrollHeight;
  }

  function play(move) {
    if (game.result) return;
    try {
      const next = Tak.applyMove(game, move);
      const description = move.type === "place"
        ? `${names[game.currentPlayer]}: ${game.ply < 2 ? `${names[1 - game.currentPlayer]} ` : ""}${move.piece === "cap" ? "capstone" : move.piece} at ${coordinate(move.index)}`
        : `${names[game.currentPlayer]}: ${move.count} from ${coordinate(move.index)} ${move.direction}, drops ${move.drops.join(", ")}`;
      past.push(game);
      moves.push(description);
      game = next;
      resetSelection();
      mode = "place";
      piece = "flat";
      say(game.result ? "Game complete." : "Move played. Pass the board to your opponent.");
      render();
    } catch (error) {
      say(error.message, true);
    }
  }

  function selectStack(index) {
    selected = index;
    ui.carryCount.replaceChildren();
    const stack = game.board[index];
    if (stack.length && stack.at(-1).player === game.currentPlayer) {
      const limit = Math.min(stack.length, game.size);
      for (let count = 1; count <= limit; count++) {
        const option = document.createElement("option");
        option.value = count;
        option.textContent = `${count} ${count === 1 ? "piece" : "pieces"}`;
        ui.carryCount.append(option);
      }
      ui.carryCount.value = String(limit);
      ui.drops.value = String(limit);
    } else {
      ui.drops.value = "";
    }
    say(mode === "move" ? "Choose a direction and drop counts; highlighted squares show a legal route." : "Stack inspected. Choose “Move a stack” to move your own pieces.");
    render();
  }

  ui.board.addEventListener("click", (event) => {
    const square = event.target.closest("[data-index]");
    if (!square) return;
    const index = Number(square.dataset.index);
    if (game.board[index].length || game.result) selectStack(index);
    else if (mode === "place") play({ type: "place", index, piece });
    else say("Select a stack you control first.", true);
  });
  for (const action of ["place", "move"]) {
    ui[`${action}Mode`].addEventListener("click", () => {
      mode = action;
      say("");
      if (selected !== null && action === "move") selectStack(selected);
      else render();
    });
  }
  document.querySelectorAll("[data-piece]").forEach((button) => {
    button.addEventListener("click", () => {
      piece = button.dataset.piece;
      say(`Choose an empty square for your ${piece === "cap" ? "capstone" : piece}.`);
      render();
    });
  });
  ui.carryCount.addEventListener("change", () => {
    ui.drops.value = ui.carryCount.value;
    preview();
  });
  ui.direction.addEventListener("change", preview);
  ui.drops.addEventListener("input", preview);
  ui.confirmMove.addEventListener("click", () => {
    try { play(movement()); } catch (error) { say(error.message, true); }
  });
  ui.cancelMove.addEventListener("click", () => {
    resetSelection();
    say("");
    render();
  });
  ui.undo.addEventListener("click", () => {
    if (!past.length) return;
    game = past.pop();
    moves.pop();
    resetSelection();
    mode = "place";
    piece = "flat";
    say("Last turn undone.");
    render();
  });
  ui.newGame.addEventListener("click", () => {
    if (past.length && !game.result && !window.confirm("Start a new game? Your current game will be lost.")) return;
    game = Tak.createGame(Number(ui.boardSize.value));
    past = [];
    moves = [];
    mode = "place";
    piece = "flat";
    resetSelection();
    say("A new game begins.");
    render();
  });
  render();
})();
