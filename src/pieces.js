/* Die sieben Steine, ihre vier Drehlagen, das Falltempo und die Punkte.
   Die Startlagen entsprechen dem Original: die flache Seite liegt oben. */
const TetrisPieces = (function () {
  // Grundlage jeder Drehung ist ein quadratisches Feld; gedreht wird um dessen Mitte.
  const BASE = {
    T: [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
    J: [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
    Z: [[0, 0, 0], [1, 1, 0], [0, 1, 1]],
    O: [[1, 1], [1, 1]],
    S: [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
    L: [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]]
  };

  const TYPES = ["T", "J", "Z", "O", "S", "L", "I"];

  function rotateCw(m) {
    const n = m.length;
    return m.map((row, r) => row.map((_, c) => m[n - 1 - c][r]));
  }

  function cellsOf(m) {
    const out = [];
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m.length; c++) {
        if (m[r][c]) out.push([c, r]);
      }
    }
    return out;
  }

  // Für jeden Stein vier Zellenlisten, im Uhrzeigersinn durchgedreht.
  const SHAPES = {};
  const SIZE = {};
  TYPES.forEach((t) => {
    let m = BASE[t];
    SIZE[t] = m.length;
    const states = [];
    for (let i = 0; i < 4; i++) {
      states.push(cellsOf(m));
      m = rotateCw(m);
    }
    SHAPES[t] = states;
  });

  // Startposition: waagerecht mittig, oberste belegte Reihe genau am Feldrand.
  function spawnX(type) { return Math.floor((10 - SIZE[type]) / 2); }
  function spawnY(type) { return type === "O" ? 0 : -1; }

  // Bilder pro Feld, mit denen ein Stein je Level fällt (Tabelle des Originals).
  const GRAVITY = [48, 43, 38, 33, 28, 23, 18, 13, 8, 6,
                   5, 5, 5, 4, 4, 4, 3, 3, 3, 2,
                   2, 2, 2, 2, 2, 2, 2, 2, 2, 1];
  const FRAME_MS = 1000 / 60.0988;

  function gravityMs(level) {
    const frames = level >= GRAVITY.length ? 1 : GRAVITY[level];
    return frames * FRAME_MS;
  }

  // Punkte für 1 bis 4 Reihen, jeweils mal (Level + 1).
  const LINE_SCORE = [0, 40, 100, 300, 1200];

  return { TYPES, SHAPES, SIZE, spawnX, spawnY, gravityMs, LINE_SCORE };
})();
