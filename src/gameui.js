/* Die Ansichten des Spiels: Feld, Vorschau, Statistik und der Startbildschirm.
   Sie zeigen nur an, was man ihnen gibt — gesteuert wird in app.js. */

/* Das Feld ist eine Leinwand: Preact hängt sie nur auf und reicht ihr den
   jeweils neuesten Spielzustand; gezeichnet wird in fx.js mit eigenem Bildtakt. */
function Board({ game }) {
  const { useRef, useEffect } = preactHooks;
  const nodeRef = useRef(null);
  const fxRef = useRef(null);

  useEffect(() => {
    const fx = TetrisFx.create(nodeRef.current);
    fxRef.current = fx;
    fx.setGame(game);
    return () => { fx.destroy(); fxRef.current = null; };
  }, []);

  // Nach jedem Neuzeichnen bekommt die Leinwand den aktuellen Stand gereicht.
  useEffect(() => { if (fxRef.current) fxRef.current.setGame(game); });

  return html`<canvas class="board" ref=${nodeRef}></canvas>`;
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

/* Die Kopfkarte der rechten Spalte: klassisch zählen die Punkte, im Endlosspiel
   die durchgehaltene Zeit — sie ist dort das Ergebnis. */
function ScoreBox({ game }) {
  if (game.mode === TetrisEngine.FOREVER) {
    return html`<div class="box">
      <h2>Zeit</h2>
      <p class="big">${TetrisScores.formatDuration(game.elapsed)}</p>
      <p class="mode-line">${game.score} Punkte</p>
    </div>`;
  }
  return html`<div class="box">
    <h2>Punkte</h2><p class="big">${game.score}</p>
  </div>`;
}

/* Das Klangbett in Worten: welche Stufe der Tonart gerade steht und welche mit
   dem nächsten Stein kommt. Nur das musikalische Endlosspiel zeigt sie. */
function ChordBox({ game }) {
  /* Zwischen zwei Steinen — während die vollen Reihen fallen — gibt es keinen
     Stein, wohl aber einen Akkord: den, der noch steht. */
  const next = TetrisPad.chordOf(game.nextType);
  const cur = TetrisPad.chordOf(game.piece ? game.piece.type : TetrisPad.playing()) || next;
  if (!cur) return null;
  // Auf welchem Ton des Akkords der Bass gerade steht — die Züge stellen ihn.
  const bass = TetrisPad.bassNote();
  return html`<div class="box">
    <h2>Akkord</h2>
    <p class="big degree">${cur.deg}</p>
    <p class="mode-line">${cur.name} · ${TetrisPad.keyName()}</p>
    ${next && html`<p class="mode-line">dann ${next.deg} · ${next.name}</p>`}
    ${bass && html`<p class="mode-line">Bass ${bass} · ← tiefer · → höher · Drehen springt</p>`}
  </div>`;
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

/* Die Ansicht der laufenden Partie: das Feld mit seinen Einblendungen, links die
   Statistik, rechts Zahlen, Vorschau, Merkwort und Tastenhilfe. Wo diese Partie
   unter den bisherigen desselben Merkworts steht, rechnet app.js aus. */
function GameScreen({ game, summary, isRecord, rank, canReplay, onRestart, onReplay, onScores }) {
  const g = game;
  return html`<div class=${"app lv" + (g.level % 10)}>
    <aside class="panel left">
      <h2>Statistik</h2>
      <${Stats} stats=${g.stats} />
    </aside>

    <div class="stage">
      <${Board} game=${g} />
      ${g.paused && html`<div class="overlay small">
        <h1>Pause</h1>
        <p class="hint">P zum Weiterspielen</p>
        <button class="start small" disabled=${!canReplay}
          onClick=${onReplay}>Aufzeichnung ansehen</button>
        <button class="start small" onClick=${onScores}>Bestenliste</button>
        <p class="hint">Taste R · Taste H</p></div>`}
      ${g.over && html`<div class="overlay small">
        <h1>Game Over</h1>
        <p class="lead">${g.score} Punkte, ${g.lines} Reihen</p>
        ${isRecord && summary.plays > 1 && html`<p class="record">Neuer Bestwert für dieses Wort!</p>`}
        ${rank > 1 && html`<p class="hint">
          Platz ${rank} von ${summary.plays} · Bestwert ${summary.best.score}</p>`}
        <p class="hint seed-hint">Merkwort <b class="seed-word">${g.seedWord}</b></p>
        <button class="start" onClick=${onRestart}>Noch einmal</button>
        <button class="start small" disabled=${!canReplay}
          onClick=${onReplay}>Aufzeichnung ansehen</button>
        <button class="start small" onClick=${onScores}>Bestenliste</button>
        <p class="hint">Enter dieselbe Folge · R Aufzeichnung · H Bestenliste · Esc zurück mit neuem Wort</p></div>`}
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
      <div class="box">
        <h2>Merkwort</h2>
        <p class="seed-word">${g.seedWord}</p>
      </div>
      <div class="box keys">
        <h2>Tasten</h2>
        <p><kbd>←</kbd><kbd>→</kbd> verschieben</p>
        <p><kbd>A</kbd><kbd>D</kbd> drehen</p>
        <p><kbd>↓</kbd> ein Feld tiefer</p>
        <p><kbd>Leer</kbd> fallen lassen</p>
        <p><kbd>P</kbd> Pause · <kbd>Esc</kbd> Ende</p>
        <p><kbd>R</kbd> Aufzeichnung (in Pause)</p>
        <p><kbd>H</kbd> Bestenliste (in Pause)</p>
      </div>
    </aside>
  </div>`;
}

// Der Schriftzug zerfällt in Buchstaben, damit jeder für sich leuchten kann.
const TITLE_LETTERS = ["T", "E", "T", "R", "I", "S"];

function StartScreen({ level, onLevel, mode, onMode, musical, onMusical, seed, onSeed,
                       summary, onScores, muted, onSound, onStart }) {
  const levels = [];
  for (let i = 0; i <= 9; i++) levels.push(i);
  const forever = mode === TetrisEngine.FOREVER;
  return html`<div class="overlay">
    <h1 class="title">${TITLE_LETTERS.map((ch, i) => html`
      <span class="tl" key=${i} style=${"--i:" + i}>${ch}</span>`)}</h1>
    <p class="lead">${forever
      ? "Endlos: Das Level bleibt, wo es beginnt. Es zählt, wie lange du durchhältst."
      : "Steine aus einem Vorrat von 35 — was lange ausbleibt, wird nachgelegt."}</p>
    <p class="label">Spielart</p>
    <div class="modes">
      <button class=${"lvl" + (forever ? "" : " on")}
        onClick=${() => onMode(TetrisEngine.CLASSIC)}>Klassisch</button>
      <button class=${"lvl" + (forever ? " on" : "")}
        onClick=${() => onMode(TetrisEngine.FOREVER)}>∞ Endlos</button>
    </div>
    ${forever && html`<div class="modes one">
      <button class=${"lvl" + (musical ? " on" : "")} onClick=${onMusical}>
        ${musical ? "♫ Musik an" : "♫ Musik aus"}</button>
    </div>`}
    ${forever && musical && html`<p class="hint tight">Jeder Stein ist eine Stufe
      in ${TetrisPad.keyName()} — sein Akkord klingt, sobald er erscheint.
      Darunter steht ein Bass auf einem Ton des Akkords: Drehen schlägt ihn
      erneut an, Links und Rechts suchen einen anderen.
      Die Spielgeräusche schweigen dann.</p>`}
    <p class="label">${forever ? "Festes Level" : "Startlevel"}</p>
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
    ${forever
      ? (summary
          ? html`<p class="hint seed-hint">Bestzeit auf Level ${level}
              <b>${TetrisScores.formatDuration(summary.best.duration)}</b> aus
              ${summary.plays === 1 ? "1 Partie" : summary.plays + " Partien"}</p>`
          : html`<p class="hint seed-hint">Level ${level} — noch keine Partie durchgehalten.</p>`)
      : (summary
          ? html`<p class="hint seed-hint">Bestwert <b>${summary.best.score}</b> aus
              ${summary.plays === 1 ? "1 Partie" : summary.plays + " Partien"}</p>`
          : html`<p class="hint seed-hint">Dasselbe Wort spielt dieselbe Steinfolge.</p>`)}
    <button class="start" onClick=${onStart}>Spiel starten</button>
    <div class="start-row">
      <button class="start small" onClick=${onScores}>Bestenliste</button>
      <button class="start small" onClick=${onSound}>${muted ? "🔇 Ton aus" : "🔊 Ton an"}</button>
    </div>
    <p class="hint">Enter startet · M wechselt die Spielart${forever ? " · K die Musik" : ""}
      · H zeigt die Bestenliste · S schaltet den Ton · T prüft ihn</p>
  </div>`;
}
