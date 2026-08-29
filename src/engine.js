/* Das Spielfeld und alle Regeln. Der Zustand ist ein einfaches Objekt, das hier
   verändert wird; version zählt jede sichtbare Änderung, damit die Oberfläche
   weiß, wann sie neu zeichnen muss. */
const TetrisEngine = (function () {
  const COLS = 10;
  const ROWS = 20;
  const CLEAR_MS = 220; // Dauer des Aufblitzens voller Reihen
  const CLASSIC = "classic"; // das Level steigt alle zehn Reihen
  const FOREVER = "forever"; // das Level bleibt fest, es zählt die durchgehaltene Zeit

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
  }

  // Das Feld als eine Zeichenkette — kurz genug, um es für jedes Bild zu sichern.
  function boardToText(board) {
    let s = "";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) s += board[r][c] || ".";
    }
    return s;
  }

  function boardFromText(text) {
    const board = emptyBoard();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = text.charAt(r * COLS + c);
        if (ch !== ".") board[r][c] = ch;
      }
    }
    return board;
  }

  /* Was der Zustand nicht selbst verrät, meldet er: ein kurzes Band von Ereignissen,
     das die Bildschau ausliest und danach leert. Es gehört nicht zum Spielstand und
     steht deshalb auch nicht in der Momentaufnahme. */
  function emit(state, ev) {
    /* Der Ton hängt nicht am Band, sondern hier: Das Band wird erst im nächsten
       Bild gelesen, und ein Klang, der ein Bild zu spät kommt, klingt nach dem
       Tastendruck statt mit ihm. Gehört wird also im Augenblick des Zuges. */
    if (typeof TetrisSound !== "undefined") {
      if (ev.k === "move" || ev.k === "rot") TetrisSound.play("move");
      else if (ev.k === "drop") TetrisSound.play("drop");
    }
    if (state.fx && state.fx.length < 48) state.fx.push(ev);
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

  /* Der Akkord des Steins, der gerade fällt — das Klangbett des musikalischen
     Endlosspiels. Es klingt nur, wenn die Partie musikalisch ist; sonst tut der
     Aufruf nichts. Aufgerufen wird er beim Erscheinen eines Steins und immer
     dann, wenn das Bett unterbrochen war (Pause, Wiedereinstieg). */
  function chordCue(state) {
    if (typeof TetrisPad === "undefined") return;
    if (!state || !state.musical || !state.piece || state.over || state.paused) return;
    TetrisPad.chord(state.piece.type);
  }

  function padStop() {
    if (typeof TetrisPad !== "undefined") TetrisPad.stop();
  }

  /* Das Merkwort bestimmt den Startwert des Schieberegisters: dasselbe Wort
     spielt dieselbe Steinfolge. Fehlt es, entsteht eines zufällig.
     Die Spielart ist "classic" (das Level steigt alle zehn Reihen) oder "forever"
     (das Level bleibt, wo es begann — es zählt allein, wie lange man durchhält).
     Das Endlosspiel kann dazu musikalisch sein: Dann ist jeder Stein eine Stufe
     der Tonart und klingt beim Erscheinen. An der Regel ändert das nichts. */
  function create(startLevel, seedWord, mode, musical) {
    const stats = {};
    TetrisPieces.TYPES.forEach((t) => { stats[t] = 0; });
    const word = TetrisSeed.normalize(seedWord) ? TetrisSeed.sanitizeInput(seedWord) : TetrisSeed.randomWord();
    const state = {
      mode: mode === FOREVER ? FOREVER : CLASSIC,
      musical: mode === FOREVER && !!musical, // das Klangbett gehört dem Endlosspiel
      seedWord: word,
      rng: NesRng.create(TetrisSeed.toRegister(word)),
      board: emptyBoard(),
      piece: null,
      nextType: null,
      score: 0,
      lines: 0,
      level: startLevel,
      startLevel: startLevel,
      stats: stats,
      clears: [0, 0, 0, 0, 0], // wie oft 1, 2, 3, 4 Reihen auf einmal fielen
      resumed: false,          // wurde in dieser Partie aus der Aufzeichnung wiedereingestiegen?
      over: false,
      paused: false,
      dropTimer: 0,
      clearRows: null,
      clearTimer: 0,
      elapsed: 0,
      fx: [],
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
      padStop();
    } else {
      // Der neue Stein bringt seinen Akkord mit — er löst den vorigen ab.
      chordCue(state);
    }
    state.version++;
  }

  function move(state, dx) {
    if (!playable(state)) return false;
    const p = state.piece;
    if (collides(state.board, p.type, p.rot, p.x + dx, p.y)) return false;
    p.x += dx;
    emit(state, { k: "move", type: p.type, rot: p.rot, x: p.x, y: p.y, dx: dx });
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
        emit(state, { k: "rot", type: p.type, rot: p.rot, x: p.x, y: p.y });
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
    if (!p) return 0;
    let d = 0;
    while (!collides(state.board, p.type, p.rot, p.x, p.y + d + 1)) d++;
    return d;
  }

  function hardDrop(state) {
    if (!playable(state)) return false;
    const d = dropDistance(state);
    const from = state.piece.y;
    state.piece.y += d;
    state.score += d;
    emit(state, { k: "drop", type: state.piece.type, rot: state.piece.rot,
      x: state.piece.x, from: from, to: state.piece.y, dist: d });
    lock(state);
    return true;
  }

  function lock(state) {
    const p = state.piece;
    const cells = TetrisPieces.SHAPES[p.type][p.rot];
    emit(state, { k: "lock", type: p.type, rot: p.rot, x: p.x, y: p.y });
    let aboveField = false;
    for (let i = 0; i < cells.length; i++) {
      const cx = p.x + cells[i][0];
      const cy = p.y + cells[i][1];
      if (cy < 0) { aboveField = true; continue; }
      state.board[cy][cx] = p.type;
    }
    state.piece = null;
    state.version++;
    if (aboveField) { state.over = true; padStop(); return; }

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
    state.clears[rows.length]++;
    state.score += TetrisPieces.LINE_SCORE[rows.length] * (state.level + 1);
    // Im Endlosspiel bleibt das Level, wo es begann — das Tempo ist die Aufgabe.
    if (state.mode !== FOREVER) state.level = state.startLevel + Math.floor(state.lines / 10);
    spawn(state);
  }

  function playable(state) {
    return !state.over && !state.paused && state.piece !== null;
  }

  function update(state, dt) {
    if (state.over || state.paused) return;
    state.elapsed += dt; // die gespielte Zeit; sie ist die Zeitachse der Aufzeichnung
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
    // In der Pause schweigt auch das Klangbett; danach steht wieder der Akkord des Steins.
    if (state.paused) padStop(); else chordCue(state);
    state.version++;
  }

  /* Eine vollständige Momentaufnahme: alles, was das Bild ausmacht, und dazu der
     Zustand des Zufalls. Aus ihr lässt sich das Bild zeigen UND weiterspielen. */
  function snapshot(state) {
    return {
      t: state.elapsed,
      mode: state.mode,
      musical: state.musical,
      board: boardToText(state.board),
      piece: state.piece
        ? { type: state.piece.type, rot: state.piece.rot, x: state.piece.x, y: state.piece.y }
        : null,
      nextType: state.nextType,
      score: state.score,
      lines: state.lines,
      level: state.level,
      startLevel: state.startLevel,
      seedWord: state.seedWord,
      stats: Object.assign({}, state.stats),
      clears: state.clears.slice(),
      resumed: state.resumed,
      over: state.over,
      clearRows: state.clearRows ? state.clearRows.slice() : null,
      clearTimer: state.clearTimer,
      dropTimer: state.dropTimer,
      rng: state.rng.getState()
    };
  }

  // Aus einer Momentaufnahme wieder ein lebendiges Spiel — laufbereit, nicht pausiert.
  function fromSnapshot(snap) {
    return {
      mode: snap.mode === FOREVER ? FOREVER : CLASSIC,
      musical: snap.mode === FOREVER && !!snap.musical,
      seedWord: snap.seedWord,
      rng: NesRng.restore(snap.rng),
      board: boardFromText(snap.board),
      piece: snap.piece ? Object.assign({}, snap.piece) : null,
      nextType: snap.nextType,
      score: snap.score,
      lines: snap.lines,
      level: snap.level,
      startLevel: snap.startLevel,
      stats: Object.assign({}, snap.stats),
      clears: snap.clears ? snap.clears.slice() : [0, 0, 0, 0, 0],
      resumed: !!snap.resumed,
      over: snap.over,
      paused: false,
      dropTimer: snap.dropTimer,
      clearRows: snap.clearRows ? snap.clearRows.slice() : null,
      clearTimer: snap.clearTimer,
      elapsed: snap.t,
      fx: [],
      version: 0
    };
  }

  return {
    COLS: COLS, ROWS: ROWS,
    CLASSIC: CLASSIC, FOREVER: FOREVER,
    create: create, update: update,
    move: move, rotate: rotate, softDrop: softDrop, hardDrop: hardDrop,
    dropDistance: dropDistance, togglePause: togglePause,
    chordCue: chordCue,
    snapshot: snapshot, fromSnapshot: fromSnapshot
  };
})();
