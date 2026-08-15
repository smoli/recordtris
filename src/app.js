/* Oberfläche und Steuerung. Der Spielzustand liegt in einer Ref und wird vom
   Bildtakt fortgeschrieben; neu gezeichnet wird nur, wenn sich etwas geändert hat. */
const { render } = preact;
const { useState, useRef, useEffect, useCallback } = preactHooks;

const DAS_START = 170; // Wartezeit bis zur Wiederholung beim Halten
const DAS_RATE = 50;   // Abstand der Wiederholungen
const DROP_RATE = 45;  // Wiederholung beim Halten von Pfeil runter

function Cell({ cell }) {
  const cls = cell.type
    ? "cell c-" + cell.type + (cell.kind === "ghost" ? " ghost" : "") +
      (cell.kind === "clear" ? " clear" : "")
    : "cell";
  return html`<div class=${cls}></div>`;
}

function Board({ game }) {
  const cells = TetrisEngine.renderCells(game);
  return html`<div class="board">${cells.map((c, i) => html`<${Cell} key=${i} cell=${c} />`)}</div>`;
}

function Preview({ type }) {
  const n = TetrisPieces.SIZE[type];
  const cells = TetrisPieces.SHAPES[type][0];
  const filled = new Set(cells.map((p) => p[1] * n + p[0]));
  const grid = [];
  for (let i = 0; i < n * n; i++) {
    grid.push(html`<div key=${i} class=${filled.has(i) ? "cell c-" + type : "cell empty"}></div>`);
  }
  return html`<div class="preview" style=${"grid-template-columns: repeat(" + n + ", var(--mini))"}>${grid}</div>`;
}

function Stats({ stats }) {
  return html`<div class="stats">
    ${TetrisPieces.TYPES.map((t) => html`
      <div class="stat" key=${t}>
        <span class=${"chip c-" + t}></span><span class="stat-name">${t}</span>
        <span class="stat-count">${stats[t]}</span>
      </div>`)}
  </div>`;
}

function StartScreen({ level, onLevel, onStart }) {
  const levels = [];
  for (let i = 0; i <= 9; i++) levels.push(i);
  return html`<div class="overlay">
    <h1>TETRIS</h1>
    <p class="lead">Steine ziehen wie im Original — mit dem Zufallsverfahren des NES.</p>
    <p class="label">Startlevel</p>
    <div class="levels">
      ${levels.map((i) => html`
        <button key=${i} class=${"lvl" + (i === level ? " on" : "")}
          onClick=${() => onLevel(i)}>${i}</button>`)}
    </div>
    <button class="start" onClick=${onStart}>Spiel starten</button>
    <p class="hint">Enter drücken geht auch</p>
  </div>`;
}

function App() {
  const gameRef = useRef(null);
  const heldRef = useRef({});
  const [startLevel, setStartLevel] = useState(0);
  const [, bump] = useState(0);

  const startGame = useCallback((lvl) => {
    heldRef.current = {};
    gameRef.current = TetrisEngine.create(lvl);
    bump((v) => v + 1);
  }, []);

  const quit = useCallback(() => {
    gameRef.current = null;
    heldRef.current = {};
    bump((v) => v + 1);
  }, []);

  // Bildtakt: Schwerkraft, Tastenwiederholung, und nur bei Änderung neu zeichnen.
  useEffect(() => {
    let raf = 0;
    let last = null;
    let seen = -1;
    const step = (t) => {
      const dt = last === null ? 0 : Math.min(t - last, 200);
      last = t;
      const g = gameRef.current;
      if (g) {
        repeatKeys(g, dt);
        TetrisEngine.update(g, dt);
        if (g.version !== seen) { seen = g.version; bump((v) => v + 1); }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  function repeatKeys(g, dt) {
    const held = heldRef.current;
    tick(held.left, dt, DAS_START, DAS_RATE, () => TetrisEngine.move(g, -1));
    tick(held.right, dt, DAS_START, DAS_RATE, () => TetrisEngine.move(g, 1));
    tick(held.down, dt, DROP_RATE, DROP_RATE, () => TetrisEngine.softDrop(g));
  }

  function tick(entry, dt, first, rate, action) {
    if (!entry) return;
    entry.timer += dt;
    let guard = 0;
    while (entry.timer >= (entry.fired ? rate : first) && guard++ < 20) {
      entry.timer -= entry.fired ? rate : first;
      entry.fired = true;
      action();
    }
  }

  useEffect(() => {
    function press(key) { heldRef.current[key] = { timer: 0, fired: false }; }

    function onDown(e) {
      const k = e.key;
      if (k === " " || k.indexOf("Arrow") === 0) e.preventDefault();
      if (e.repeat) return;
      const g = gameRef.current;

      if (!g) {
        if (k === "Enter" || k === " ") startGame(startLevel);
        return;
      }
      if (g.over) {
        if (k === "Enter") startGame(g.startLevel);
        else if (k === "Escape") quit();
        return;
      }
      if (k === "p" || k === "P") { TetrisEngine.togglePause(g); return; }
      if (k === "Escape") { quit(); return; }
      if (g.paused) return;

      if (k === "ArrowLeft") { TetrisEngine.move(g, -1); press("left"); }
      else if (k === "ArrowRight") { TetrisEngine.move(g, 1); press("right"); }
      else if (k === "ArrowDown") { TetrisEngine.softDrop(g); press("down"); }
      else if (k === "a" || k === "A") TetrisEngine.rotate(g, -1);
      else if (k === "d" || k === "D") TetrisEngine.rotate(g, 1);
      else if (k === " ") TetrisEngine.hardDrop(g);
    }

    function onUp(e) {
      const k = e.key;
      if (k === "ArrowLeft") heldRef.current.left = null;
      else if (k === "ArrowRight") heldRef.current.right = null;
      else if (k === "ArrowDown") heldRef.current.down = null;
    }

    function onBlur() { heldRef.current = {}; }

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [startLevel, startGame, quit]);

  const g = gameRef.current;

  if (!g) {
    return html`<div class="app">
      <div class="stage intro">
        <${StartScreen} level=${startLevel} onLevel=${setStartLevel}
          onStart=${() => startGame(startLevel)} />
      </div>
    </div>`;
  }

  return html`<div class="app">
    <aside class="panel left">
      <h2>Statistik</h2>
      <${Stats} stats=${g.stats} />
    </aside>

    <div class="stage">
      <${Board} game=${g} />
      ${g.paused && html`<div class="overlay small">
        <h1>Pause</h1><p class="hint">P zum Weiterspielen</p></div>`}
      ${g.over && html`<div class="overlay small">
        <h1>Game Over</h1>
        <p class="lead">${g.score} Punkte, ${g.lines} Reihen</p>
        <button class="start" onClick=${() => startGame(g.startLevel)}>Noch einmal</button>
        <p class="hint">Enter für neu, Esc zurück zum Start</p></div>`}
    </div>

    <aside class="panel right">
      <div class="box">
        <h2>Punkte</h2><p class="big">${g.score}</p>
      </div>
      <div class="box row">
        <div><h2>Level</h2><p class="big">${g.level}</p></div>
        <div><h2>Reihen</h2><p class="big">${g.lines}</p></div>
      </div>
      <div class="box">
        <h2>Nächster</h2>
        <${Preview} type=${g.nextType} />
      </div>
      <div class="box keys">
        <h2>Tasten</h2>
        <p><kbd>←</kbd><kbd>→</kbd> verschieben</p>
        <p><kbd>A</kbd><kbd>D</kbd> drehen</p>
        <p><kbd>↓</kbd> ein Feld tiefer</p>
        <p><kbd>Leer</kbd> fallen lassen</p>
        <p><kbd>P</kbd> Pause · <kbd>Esc</kbd> Ende</p>
      </div>
    </aside>
  </div>`;
}

render(html`<${App} />`, document.getElementById("app"));
