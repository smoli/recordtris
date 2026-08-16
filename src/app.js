/* Zustand und Steuerung. Der Spielzustand liegt in einer Ref und wird vom Bildtakt
   fortgeschrieben; neu gezeichnet wird nur, wenn sich etwas geändert hat. Derselbe
   Takt schreibt jedes veränderte Bild aufs Band — und spielt es auf Wunsch wieder ab. */
const { render } = preact;
const { useState, useRef, useEffect, useCallback } = preactHooks;

const DAS_START = 170; // Wartezeit bis zur Wiederholung beim Halten
const DAS_RATE = 50;   // Abstand der Wiederholungen
const DROP_RATE = 45;  // Wiederholung beim Halten von Pfeil runter

function App() {
  const gameRef = useRef(null);
  const heldRef = useRef({});
  const tapeRef = useRef([]);   // die Aufzeichnung der laufenden Partie
  const replayRef = useRef(null); // der Abspielkopf, solange die Wiedergabe läuft
  const [startLevel, setStartLevel] = useState(0);
  const [seedWord, setSeedWord] = useState(() => TetrisSeed.randomWord());
  const [, bump] = useState(0);

  const startGame = useCallback((lvl, word) => {
    heldRef.current = {};
    tapeRef.current = [];
    replayRef.current = null;
    gameRef.current = TetrisEngine.create(lvl, word);
    setSeedWord(gameRef.current.seedWord); // ein gewürfeltes Wort bleibt sichtbar
    bump((v) => v + 1);
  }, []);

  const quit = useCallback(() => {
    gameRef.current = null;
    heldRef.current = {};
    tapeRef.current = [];
    replayRef.current = null;
    bump((v) => v + 1);
  }, []);

  // Bildtakt: Schwerkraft, Tastenwiederholung, Aufzeichnung — oder die Wiedergabe.
  useEffect(() => {
    let raf = 0;
    let last = null;
    let seen = -1;
    const step = (t) => {
      const dt = last === null ? 0 : Math.min(t - last, 200);
      last = t;
      const g = gameRef.current;
      const rp = replayRef.current;
      if (rp) {
        if (TetrisReplay.advance(rp, tapeRef.current, dt)) bump((v) => v + 1);
      } else if (g) {
        repeatKeys(g, dt);
        TetrisEngine.update(g, dt);
        if (g.version !== seen) {
          seen = g.version;
          if (!g.paused) TetrisReplay.record(tapeRef.current, g);
          bump((v) => v + 1);
        }
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

  // --- Wiedergabe ---

  const openReplay = useCallback(() => {
    const frames = tapeRef.current;
    if (!frames.length) return;
    heldRef.current = {};
    replayRef.current = TetrisReplay.cursor(frames, frames.length - 1);
    bump((v) => v + 1);
  }, []);

  const closeReplay = useCallback(() => {
    replayRef.current = null;
    bump((v) => v + 1);
  }, []);

  const seekTo = useCallback((i) => {
    const rp = replayRef.current;
    if (!rp) return;
    rp.playing = false;
    TetrisReplay.seek(rp, tapeRef.current, i);
    bump((v) => v + 1);
  }, []);

  const stepBy = useCallback((d) => {
    const rp = replayRef.current;
    if (!rp) return;
    TetrisReplay.step(rp, tapeRef.current, d);
    bump((v) => v + 1);
  }, []);

  const playFrom = useCallback((dir) => {
    const rp = replayRef.current;
    if (!rp) return;
    TetrisReplay.play(rp, tapeRef.current, dir);
    bump((v) => v + 1);
  }, []);

  const pausePlayback = useCallback(() => {
    const rp = replayRef.current;
    if (!rp) return;
    TetrisReplay.pause(rp, tapeRef.current);
    bump((v) => v + 1);
  }, []);

  const setSpeed = useCallback((s) => {
    const rp = replayRef.current;
    if (!rp) return;
    rp.speed = s;
    bump((v) => v + 1);
  }, []);

  /* Wiedereinstieg: Aus dem gezeigten Bild wird wieder ein laufendes Spiel. Das Band
     endet an dieser Stelle und zeichnet von hier an den neuen Verlauf auf. */
  const resumeHere = useCallback(() => {
    const rp = replayRef.current;
    if (!rp) return;
    const frames = tapeRef.current;
    const frame = frames[rp.index];
    if (!frame || frame.over) return;
    tapeRef.current = frames.slice(0, rp.index + 1);
    gameRef.current = TetrisEngine.fromSnapshot(frame);
    replayRef.current = null;
    heldRef.current = {};
    bump((v) => v + 1);
  }, []);

  useEffect(() => {
    function press(key) { heldRef.current[key] = { timer: 0, fired: false }; }

    function onDown(e) {
      const k = e.key;
      // Im Eingabefeld gehören die Tasten dem Anwender, nicht dem Spiel.
      const inField = e.target && e.target.tagName === "INPUT";
      if (!inField && (k === " " || k.indexOf("Arrow") === 0)) e.preventDefault();

      // In der Wiedergabe gehören die Tasten dem Abspielkopf.
      const rp = replayRef.current;
      if (rp) {
        if (k === "Escape") { closeReplay(); return; }
        if (k === "Enter") { resumeHere(); return; }
        if (inField) return; // der Schieberegler bedient sich sonst selbst
        if (k === "ArrowRight") stepBy(1);
        else if (k === "ArrowLeft") stepBy(-1);
        else if (e.repeat) return;
        else if (k === " ") { if (rp.playing && rp.dir > 0) pausePlayback(); else playFrom(1); }
        else if (k === "b" || k === "B") { if (rp.playing && rp.dir < 0) pausePlayback(); else playFrom(-1); }
        else if (k === "Home") seekTo(0);
        else if (k === "End") seekTo(tapeRef.current.length - 1);
        else if (k.length === 1 && k >= "1" && k <= "5") setSpeed(TetrisReplay.SPEEDS[Number(k) - 1]);
        return;
      }

      if (e.repeat) return;
      const g = gameRef.current;

      if (!g) {
        if (k === "Enter" || (k === " " && !inField)) startGame(startLevel, seedWord);
        return;
      }
      if (g.over) {
        if (k === "Enter") startGame(g.startLevel, g.seedWord);
        else if (k === "r" || k === "R") openReplay();
        else if (k === "Escape") quit();
        return;
      }
      if (k === "p" || k === "P") { TetrisEngine.togglePause(g); return; }
      if (k === "Escape") { quit(); return; }
      if (g.paused) {
        if (k === "r" || k === "R") openReplay();
        return;
      }

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
  }, [startLevel, seedWord, startGame, quit, openReplay, closeReplay,
      seekTo, stepBy, playFrom, pausePlayback, setSpeed, resumeHere]);

  const g = gameRef.current;
  const rp = replayRef.current;

  // Die Wiedergabe zeigt statt des Spiels das aufgezeichnete Bild — samt Zahlen.
  if (rp && tapeRef.current.length) {
    const frames = tapeRef.current;
    const frame = frames[rp.index];
    const view = TetrisEngine.fromSnapshot(frame);
    return html`<div class="app replaying">
      <aside class="panel left">
        <h2>Statistik</h2>
        <${Stats} stats=${view.stats} />
      </aside>

      <div class="center">
        <div class="stage">
          <${Board} game=${view} />
          <div class=${"replay-tag" + (frame.over ? " end" : "")}>
            ${frame.over ? "Game Over" : "Wiedergabe"}
          </div>
        </div>
        <${ReplayBar} frames=${frames} cur=${rp} canResume=${!frame.over}
          onSeek=${seekTo} onStep=${stepBy} onPlay=${playFrom} onPause=${pausePlayback}
          onSpeed=${setSpeed} onResume=${resumeHere} onClose=${closeReplay} />
      </div>

      <aside class="panel right">
        <div class="box">
          <h2>Punkte</h2><p class="big">${view.score}</p>
        </div>
        <div class="box row">
          <div><h2>Level</h2><p class="big">${view.level}</p></div>
          <div><h2>Reihen</h2><p class="big">${view.lines}</p></div>
        </div>
        <div class="box">
          <h2>Nächster</h2>
          <${Preview} type=${view.nextType} />
        </div>
        <${ReplayKeys} />
      </aside>
    </div>`;
  }

  if (!g) {
    return html`<div class="app">
      <div class="stage intro">
        <${StartScreen} level=${startLevel} onLevel=${setStartLevel}
          seed=${seedWord} onSeed=${setSeedWord}
          onStart=${() => startGame(startLevel, seedWord)} />
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
        <h1>Pause</h1>
        <p class="hint">P zum Weiterspielen</p>
        <button class="start small" disabled=${!tapeRef.current.length}
          onClick=${openReplay}>Aufzeichnung ansehen</button>
        <p class="hint">Taste R</p></div>`}
      ${g.over && html`<div class="overlay small">
        <h1>Game Over</h1>
        <p class="lead">${g.score} Punkte, ${g.lines} Reihen</p>
        <p class="hint seed-hint">Merkwort <b class="seed-word">${g.seedWord}</b></p>
        <button class="start" onClick=${() => startGame(g.startLevel, g.seedWord)}>Noch einmal</button>
        <button class="start small" disabled=${!tapeRef.current.length}
          onClick=${openReplay}>Aufzeichnung ansehen</button>
        <p class="hint">Enter spielt dieselbe Folge, R zeigt die Aufzeichnung, Esc zurück</p></div>`}
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
      </div>
    </aside>
  </div>`;
}

render(html`<${App} />`, document.getElementById("app"));
