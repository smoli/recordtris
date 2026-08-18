/* Die Ansichten des Spiels: Feld, Vorschau, Statistik und der Startbildschirm.
   Sie zeigen nur an, was man ihnen gibt — gesteuert wird in app.js. */
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

function StartScreen({ level, onLevel, seed, onSeed, summary, onScores, onStart }) {
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
    <p class="label">Merkwort</p>
    <div class="seed-row">
      <input class="seed-input" type="text" value=${seed} spellcheck="false"
        maxLength=${TetrisSeed.MAX_LEN} placeholder="Wort eingeben"
        onInput=${(e) => onSeed(TetrisSeed.sanitizeInput(e.target.value))} />
      <button class="dice" title="Neues Wort würfeln"
        onClick=${() => onSeed(TetrisSeed.randomWord())}>🎲</button>
    </div>
    ${summary
      ? html`<p class="hint seed-hint">Bestwert <b>${summary.best.score}</b> aus
          ${summary.plays === 1 ? "1 Partie" : summary.plays + " Partien"}</p>`
      : html`<p class="hint seed-hint">Dasselbe Wort spielt dieselbe Steinfolge.</p>`}
    <button class="start" onClick=${onStart}>Spiel starten</button>
    <button class="start small" onClick=${onScores}>Bestenliste</button>
    <p class="hint">Enter startet · H zeigt die Bestenliste</p>
  </div>`;
}
