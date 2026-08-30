/* Das Archiv der Partien. Die Bestenliste hält nur Endzahlen fest — hier liegt die
   Partie selbst: das ganze Band der Aufzeichnung, Bild für Bild. Damit lässt sich
   eine alte Partie später wieder ansehen, von jeder Stelle fortsetzen und auswerten.

   Ein Ordner, eine Datei je Partie; der Eintrag der Bestenliste merkt sich nur den
   Dateinamen. Verdichtet wird zweifach: Feldbilder wiederholen sich und stehen
   deshalb nur einmal in einem Verzeichnis, jedes Bild nennt nur noch ihre Nummer;
   der Rest eines Bildes wird zu einer nackten Wertereihe ohne Feldnamen. */
const TetrisArchive = (function () {
  const DIR = "tetris-games";
  const VERSION = 2; // 2: der Zufallszustand des 35er-Vorrats an den Stellen 13…15
  const TYPES = TetrisPieces.TYPES;
  const COLUMNS = 29; // so viele Werte hat ein Bild

  function typeIndex(t) { return TYPES.indexOf(t); }        // -1: kein Stein
  function typeAt(i) { return i >= 0 && i < TYPES.length ? TYPES[i] : null; }

  /* Ein Bild als Wertereihe, in fester Ordnung — Zahlen bis auf die beiden
     Ziffernketten des Zufalls:
     0 Zeit, 1 Nummer des Feldbilds, 2 Steinsorte, 3 Drehlage, 4 x, 5 y,
     6 nächste Sorte, 7 Punkte, 8 Reihen, 9 Level,
     10 Merker (1 = Ende, 2 = Wiedereinstieg),
     11 Uhr der Reihenauflösung, 12 Uhr der Schwerkraft,
     13 Register, 14 Vorrat als Ziffernkette, 15 Gedächtnis und Durstliste,
     16 volle Reihen als Bitmuster (-1 = keine),
     17…23 Steinstatistik, 24…28 Reihenschläge.
     In Dateien der Fassung 1 standen an 13…15 drei Zahlen: das Register, der
     Steinzähler und der zuletzt gezogene Stein des alten NES-Zufalls. Solche
     Bänder laufen weiter — nur der Zufall beginnt beim Wiedereinstieg neu. */
  function packFrame(snap, boardIdx) {
    const p = snap.piece;
    let mask = -1;
    if (snap.clearRows) {
      mask = 0;
      snap.clearRows.forEach((r) => { mask |= (1 << r); });
    }
    const row = [
      Math.round(snap.t), boardIdx,
      p ? typeIndex(p.type) : -1, p ? p.rot : 0, p ? p.x : 0, p ? p.y : 0,
      typeIndex(snap.nextType), snap.score, snap.lines, snap.level,
      (snap.over ? 1 : 0) | (snap.resumed ? 2 : 0),
      Math.round(snap.clearTimer), Math.round(snap.dropTimer),
      snap.rng.reg, snap.rng.pool, snap.rng.memory + snap.rng.drought,
      mask
    ];
    TYPES.forEach((t) => row.push(snap.stats[t] || 0));
    for (let i = 0; i < 5; i++) row.push(snap.clears[i] || 0);
    return row;
  }

  /* Zurück zur Momentaufnahme, wie sie die Regel selbst schreibt — sie taugt
     damit sowohl zum Anzeigen als auch zum Weiterspielen. */
  function unpackFrame(row, boards, seedWord, startLevel) {
    const board = boards[row[1]];
    const size = TetrisEngine.ROWS * TetrisEngine.COLS;
    if (typeof board !== "string" || board.length !== size) return null;

    const stats = {};
    TYPES.forEach((t, i) => { stats[t] = row[17 + i] || 0; });
    const clears = [];
    for (let i = 0; i < 5; i++) clears.push(row[24 + i] || 0);
    let clearRows = null;
    if (row[16] >= 0) {
      clearRows = [];
      for (let r = 0; r < TetrisEngine.ROWS; r++) if (row[16] & (1 << r)) clearRows.push(r);
    }
    const type = typeAt(row[2]);
    return {
      t: row[0],
      board: board,
      piece: type ? { type: type, rot: row[3], x: row[4], y: row[5] } : null,
      nextType: typeAt(row[6]),
      score: row[7],
      lines: row[8],
      level: row[9],
      startLevel: startLevel,
      seedWord: seedWord,
      stats: stats,
      clears: clears,
      resumed: (row[10] & 2) !== 0,
      over: (row[10] & 1) !== 0,
      clearRows: clearRows,
      clearTimer: row[11],
      dropTimer: row[12],
      rng: rngFrom(row)
    };
  }

  /* Der Zufallszustand eines Bildes. Steht an 14 eine Ziffernkette, stammt das Band
     aus dieser Fassung; sonst ist es ein altes und nur das Register taugt noch —
     Vorrat, Gedächtnis und Durstliste beginnt der Zufall dann von vorn. */
  function rngFrom(row) {
    const s = { reg: row[13] | 0 };
    if (typeof row[14] === "string" && typeof row[15] === "string") {
      s.pool = row[14];
      s.memory = row[15].slice(0, TetrisRng.MEMORY);
      s.drought = row[15].slice(TetrisRng.MEMORY);
    }
    return s;
  }

  function pack(frames, entry) {
    const boards = [];
    const seen = {}; // Feldbild → Nummer
    const rows = frames.map((f) => {
      let i = seen[f.board];
      if (i === undefined) { i = boards.length; boards.push(f.board); seen[f.board] = i; }
      return packFrame(f, i);
    });
    return {
      v: VERSION,
      seed: entry.seed,
      date: entry.date,
      startLevel: entry.startLevel,
      boards: boards,
      frames: rows
    };
  }

  // Was aus der Datei kommt, ist fremder Text: unbrauchbare Bilder fallen weg.
  function unpack(data) {
    if (!data || !Array.isArray(data.frames) || !Array.isArray(data.boards)) return null;
    const seed = TetrisSeed.sanitizeInput(data.seed) || "spiel";
    const level = Math.max(0, Math.round(Number(data.startLevel) || 0));
    const out = [];
    data.frames.forEach((row) => {
      if (!Array.isArray(row) || row.length < COLUMNS) return;
      const frame = unpackFrame(row, data.boards, seed, level);
      if (frame) out.push(frame);
    });
    return out.length ? out : null;
  }

  /* Der Dateiname trägt Zeitpunkt und Merkwort, damit der Ordner auch von außen
     lesbar bleibt. Der Zeitpunkt macht ihn eindeutig. */
  function nameFor(entry) {
    const stamp = String(entry.date || "").replace(/[^0-9A-Za-z]/g, "-") || "partie";
    const word = TetrisSeed.normalize(entry.seed) || "spiel";
    return DIR + "/" + stamp + "_" + word + ".json";
  }

  // Liefert den Dateinamen — oder "", wenn nichts abgelegt werden konnte.
  async function save(entry, frames) {
    const fs = window.morphosFS;
    if (!fs || !frames || !frames.length) return "";
    const file = nameFor(entry);
    try { await fs.mkdir(DIR); } catch (e) { /* der Ordner steht schon */ }
    try {
      await fs.writeFile(file, JSON.stringify(pack(frames, entry)));
      return file;
    } catch (e) {
      return "";
    }
  }

  // Das Band einer alten Partie — oder null, wenn die Datei fehlt oder unlesbar ist.
  async function load(file) {
    const fs = window.morphosFS;
    if (!fs || !file) return null;
    try {
      if (!(await fs.exists(file))) return null;
      return unpack(JSON.parse(await fs.readFile(file)));
    } catch (e) {
      return null;
    }
  }

  return {
    DIR: DIR,
    pack: pack,
    unpack: unpack,
    save: save,
    load: load
  };
})();
