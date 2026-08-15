/* Das Spielfeld und alle Regeln. Der Zustand ist ein einfaches Objekt, das hier
   verändert wird; version zählt jede sichtbare Änderung, damit die Oberfläche
   weiß, wann sie neu zeichnen muss. */
const TetrisEngine = (function () {
  const COLS = 10;
  const ROWS = 20;
  const CLEAR_MS = 220; // Dauer des Aufblitzens voller Reihen

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
  }

  function collides(board, type, rot, x, y) {
    const cells = TetrisPieces.SHAPES[type][rot];
    for (let i = 0; i < cells.length; i++) {
      const cx = x + cells[i][0];
      const cy = y + cells[i][1];
      if (cx < 0 || cx >= COLS || cy >= ROWS) return true;
      if (cy >= 0 && board[cy][cx]) return true;
    }
    return false;
  }

  function create(startLevel) {
    const stats = {};
    TetrisPieces.TYPES.forEach((t) => { stats[t] = 0; });
    const state = {
      rng: NesRng.create(1 + Math.floor(Math.random() * 0xfffe)),
      board: emptyBoard(),
      piece: null,
      nextType: null,
      score: 0,
      lines: 0,
      level: startLevel,
      startLevel: startLevel,
      stats: stats,
      over: false,
      paused: false,
      dropTimer: 0,
      clearRows: null,
      clearTimer: 0,
      version: 0
    };
    state.nextType = state.rng.nextPiece();
    spawn(state);
    return state;
  }

  function spawn(state) {
    const type = state.nextType;
    state.nextType = state.rng.nextPiece();
    state.stats[type]++;
    state.piece = { type: type, rot: 0, x: TetrisPieces.spawnX(type), y: TetrisPieces.spawnY(type) };
    state.dropTimer = 0;
    if (collides(state.board, type, 0, state.piece.x, state.piece.y)) {
      state.over = true;
      state.piece = null;
    }
    state.version++;
  }

  function move(state, dx) {
    if (!playable(state)) return false;
    const p = state.piece;
    if (collides(state.board, p.type, p.rot, p.x + dx, p.y)) return false;
    p.x += dx;
    state.version++;
    return true;
  }

  /* Gedreht wird um die Mitte des Steinfelds. Passt die neue Lage nicht,
     wird sie um bis zu zwei Spalten verschoben noch einmal versucht. */
  function rotate(state, dir) {
    if (!playable(state)) return false;
    const p = state.piece;
    const rot = (p.rot + dir + 4) % 4;
    const kicks = [0, -1, 1, -2, 2];
    for (let i = 0; i < kicks.length; i++) {
      if (!collides(state.board, p.type, rot, p.x + kicks[i], p.y)) {
        p.rot = rot;
        p.x += kicks[i];
        state.version++;
        return true;
      }
    }
    return false;
  }

  // Ein Feld tiefer durch Schwerkraft. Geht es nicht mehr, rastet der Stein ein.
  function stepDown(state) {
    const p = state.piece;
    if (!collides(state.board, p.type, p.rot, p.x, p.y + 1)) {
      p.y++;
      state.version++;
      return true;
    }
    lock(state);
    return false;
  }

  // Ein Feld tiefer auf Tastendruck: gibt zusätzlich einen Punkt.
  function softDrop(state) {
    if (!playable(state)) return false;
    if (stepDown(state)) {
      state.score++;
      state.dropTimer = 0;
      return true;
    }
    return false;
  }

  function dropDistance(state) {
    const p = state.piece;
    let d = 0;
    while (!collides(state.board, p.type, p.rot, p.x, p.y + d + 1)) d++;
    return d;
  }

  function hardDrop(state) {
    if (!playable(state)) return false;
    const d = dropDistance(state);
    state.piece.y += d;
    state.score += d;
    lock(state);
    return true;
  }

  function lock(state) {
    const p = state.piece;
    const cells = TetrisPieces.SHAPES[p.type][p.rot];
    let aboveField = false;
    for (let i = 0; i < cells.length; i++) {
      const cx = p.x + cells[i][0];
      const cy = p.y + cells[i][1];
      if (cy < 0) { aboveField = true; continue; }
      state.board[cy][cx] = p.type;
    }
    state.piece = null;
    state.version++;
    if (aboveField) { state.over = true; return; }

    const full = [];
    for (let r = 0; r < ROWS; r++) {
      if (state.board[r].every((c) => c !== null)) full.push(r);
    }
    if (full.length) {
      state.clearRows = full;
      state.clearTimer = CLEAR_MS;
    } else {
      spawn(state);
    }
  }

  function finishClear(state) {
    const rows = state.clearRows;
    state.clearRows = null;
    const kept = state.board.filter((_, r) => rows.indexOf(r) === -1);
    while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(null));
    state.board = kept;
    state.lines += rows.length;
    state.score += TetrisPieces.LINE_SCORE[rows.length] * (state.level + 1);
    state.level = state.startLevel + Math.floor(state.lines / 10);
    spawn(state);
  }

  function playable(state) {
    return !state.over && !state.paused && state.piece !== null;
  }

  function update(state, dt) {
    if (state.over || state.paused) return;
    if (state.clearRows) {
      state.clearTimer -= dt;
      if (state.clearTimer <= 0) finishClear(state);
      return;
    }
    if (!state.piece) return;
    state.dropTimer += dt;
    const interval = TetrisPieces.gravityMs(state.level);
    while (state.dropTimer >= interval) {
      state.dropTimer -= interval;
      if (!stepDown(state)) break;
    }
  }

  function togglePause(state) {
    if (state.over) return;
    state.paused = !state.paused;
    state.version++;
  }

  /* Baut das Bild des Feldes: liegende Steine, blinkende Reihen,
     Schattenriss der Landestelle und der fallende Stein selbst. */
  function renderCells(state) {
    const out = new Array(ROWS * COLS);
    for (let r = 0; r < ROWS; r++) {
      const flashing = state.clearRows && state.clearRows.indexOf(r) !== -1;
      for (let c = 0; c < COLS; c++) {
        out[r * COLS + c] = { type: state.board[r][c], kind: flashing ? "clear" : "fixed" };
      }
    }
    if (state.piece && !state.over) {
      const p = state.piece;
      const cells = TetrisPieces.SHAPES[p.type][p.rot];
      const d = dropDistance(state);
      if (d > 0) {
        for (let i = 0; i < cells.length; i++) {
          const cx = p.x + cells[i][0];
          const cy = p.y + cells[i][1] + d;
          if (cy >= 0) out[cy * COLS + cx] = { type: p.type, kind: "ghost" };
        }
      }
      for (let i = 0; i < cells.length; i++) {
        const cx = p.x + cells[i][0];
        const cy = p.y + cells[i][1];
        if (cy >= 0) out[cy * COLS + cx] = { type: p.type, kind: "active" };
      }
    }
    return out;
  }

  return {
    COLS: COLS, ROWS: ROWS,
    create: create, update: update,
    move: move, rotate: rotate, softDrop: softDrop, hardDrop: hardDrop,
    togglePause: togglePause, renderCells: renderCells
  };
})();
