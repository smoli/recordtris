/* Was aus einer ganzen Partie ablesbar ist.
   Die Bestenliste kennt nur die Endzahlen. Das Band kennt jedes Bild — daraus
   entstehen hier die Zahlen dahinter: Tempo, Sauberkeit des Stapels, Zahl der Züge,
   die längste Durststrecke ohne lange Stange und die Kurven über die Spielzeit. */
const TetrisAnalysis = (function () {
  const COLS = TetrisEngine.COLS;
  const ROWS = TetrisEngine.ROWS;
  const CURVE_POINTS = 90; // so viele Stützstellen hat eine Kurve höchstens

  /* Höhe und Löcher eines Feldbilds. Die Höhe ist die oberste belegte Reihe,
     ein Loch ein leeres Feld, über dem in derselben Spalte etwas liegt.
     Der fallende Stein gehört nicht zum Feldbild und zählt deshalb nicht mit. */
  function metrics(text) {
    let height = 0, holes = 0, filled = 0;
    for (let c = 0; c < COLS; c++) {
      let covered = false;
      for (let r = 0; r < ROWS; r++) {
        if (text.charAt(r * COLS + c) !== ".") {
          filled++;
          if (!covered) { covered = true; if (ROWS - r > height) height = ROWS - r; }
        } else if (covered) {
          holes++;
        }
      }
    }
    return { height: height, holes: holes, filled: filled };
  }

  /* Die Folge der gezogenen Steine. Die Statistik im Bild zählt jede Sorte mit;
     wächst sie von einem Bild zum nächsten, ist genau dieser Stein erschienen. */
  function pieceSequence(frames) {
    const seq = [];
    const seen = {};
    TetrisPieces.TYPES.forEach((t) => { seen[t] = 0; });
    frames.forEach((f) => {
      TetrisPieces.TYPES.forEach((t) => {
        const n = f.stats[t] || 0;
        for (let i = seen[t]; i < n; i++) seq.push(t);
        if (n > seen[t]) seen[t] = n;
      });
    });
    return seq;
  }

  // Die längste Strecke ohne diese Steinsorte, in Steinen gezählt.
  function longestDrought(seq, type) {
    let worst = 0, run = 0;
    for (let i = 0; i < seq.length; i++) {
      if (seq[i] === type) run = 0;
      else if (++run > worst) worst = run;
    }
    return worst;
  }

  function analyze(frames) {
    if (!frames || !frames.length) return null;
    const cache = {};
    const at = (text) => cache[text] || (cache[text] = metrics(text));
    const last = frames[frames.length - 1];
    const duration = Math.max(1, last.t);

    let rotations = 0, shifts = 0, maxHeight = 0, maxHoles = 0;
    const curve = [];
    const every = Math.max(1, Math.ceil(frames.length / CURVE_POINTS));

    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const m = at(f.board);
      if (m.height > maxHeight) maxHeight = m.height;
      if (m.holes > maxHoles) maxHoles = m.holes;

      /* Züge zählen: Solange das Feldbild unverändert ist und dieselbe Sorte fällt,
         ist es derselbe Stein — jede Änderung von Drehlage oder Spalte war ein Zug.
         Ein Einrasten oder eine Reihenauflösung ändert das Feldbild und beendet
         die Zählung von selbst. */
      if (i > 0) {
        const p = frames[i - 1];
        if (p.piece && f.piece && p.board === f.board && p.piece.type === f.piece.type) {
          if (p.piece.rot !== f.piece.rot) rotations++;
          shifts += Math.abs(f.piece.x - p.piece.x);
        }
      }

      if (i % every === 0 || i === frames.length - 1) {
        curve.push({ t: f.t, score: f.score, lines: f.lines, level: f.level,
                     height: m.height, holes: m.holes });
      }
    }

    const seq = pieceSequence(frames);
    const pieces = seq.length;
    const minutes = duration / 60000;
    const lines = last.lines;
    const tetrisLines = (last.clears[4] || 0) * 4;
    const end = at(last.board);

    return {
      frames: frames.length,
      duration: duration,
      score: last.score,
      lines: lines,
      level: last.level,
      startLevel: last.startLevel,
      pieces: pieces,
      ppm: last.score / minutes,
      lpm: lines / minutes,
      spm: pieces / minutes,
      secPerPiece: pieces ? duration / pieces / 1000 : 0,
      efficiency: pieces ? lines / pieces : 0,
      tetrisRate: lines ? tetrisLines / lines : 0,
      rotations: rotations,
      shifts: shifts,
      movesPerPiece: pieces ? (rotations + shifts) / pieces : 0,
      maxHeight: maxHeight,
      endHeight: end.height,
      maxHoles: maxHoles,
      endHoles: end.holes,
      droughtI: longestDrought(seq, "I"),
      curve: curve
    };
  }

  // "1,8" — eine Zahl mit einer Nachkommastelle, für die Zahlenfelder der Ansicht.
  function decimal(n, digits) {
    const d = digits === undefined ? 1 : digits;
    if (!isFinite(n)) return "0";
    return n.toFixed(d).replace(".", ",");
  }

  return {
    metrics: metrics,
    analyze: analyze,
    decimal: decimal
  };
})();
