/* Die Ansicht der Bestenliste. Sie hat zwei Register, denn die beiden Spielarten
   messen Verschiedenes: Klassisch gehört die Liste dem Merkwort und zählt die
   Punkte; endlos gehört sie dem festen Level und zählt die durchgehaltene Zeit.
   Links jede Zeile mit ihrem besten Wert, rechts alle Partien dazu im Einzelnen. */
const CLEAR_LABELS = ["Einfach", "Doppel", "Dreifach", "Tetris"];

function PlayCard({ entry, rank, metric }) {
  const when = TetrisScores.formatDate(entry.date);
  const time = metric === "time"; // im Endlosspiel steht die Zeit obenan
  return html`<div class=${"play" + (rank === 1 ? " top" : "")}>
    <div class="play-head">
      <span class="rank">${rank}.</span>
      <span class="play-score">
        ${time ? TetrisScores.formatDuration(entry.duration) : entry.score}</span>
      <span class="play-date">${when || "ohne Zeitpunkt"}</span>
    </div>
    <div class="facts">
      ${time
        ? html`
            <span><b>${entry.score}</b> Punkte</span>
            <span><b>${entry.lines}</b> Reihen</span>
            <span>Level <b>${entry.level}</b></span>
            <span>Wort <b>${entry.seed}</b></span>`
        : html`
            <span><b>${entry.lines}</b> Reihen</span>
            <span>Level <b>${entry.level}</b> · Start ${entry.startLevel}</span>
            <span>Dauer <b>${TetrisScores.formatDuration(entry.duration)}</b></span>`}
    </div>
    <div class="facts clears">
      ${CLEAR_LABELS.map((label, i) => html`
        <span key=${label}>${label} <b>${entry.clears[i]}</b></span>`)}
    </div>
    <div class="play-pieces">
      ${TetrisPieces.TYPES.map((t) => html`
        <span class="pc" key=${t}><span class=${"chip c-" + t}></span>${entry.pieces[t]}</span>`)}
    </div>
    ${entry.resumed ? html`<p class="resumed">↻ mit Wiedereinstieg gespielt</p>` : null}
  </div>`;
}

function ScoresScreen({ store, seed, nextSeed, level, mode, startLevel, running,
                        onPlay, onPlayLevel, onClose }) {
  const { useState, useEffect } = preactHooks;
  // Offen ist zunächst das Register der Spielart, aus der man kommt.
  const [tab, setTab] = useState(mode === TetrisEngine.FOREVER ? "forever" : "classic");
  const [sel, setSel] = useState(TetrisSeed.normalize(seed));
  const [selLevel, setSelLevel] = useState(String(level));

  const forever = tab === "forever";
  const groups = forever ? TetrisScores.byLevel(store) : TetrisScores.bySeed(store);
  const active = groups.filter((g) => g.key === (forever ? selLevel : sel))[0] || groups[0] || null;
  const plays = groups.reduce((n, g) => n + g.plays, 0);

  /* Enter spielt die gewählte Zeile noch einmal — aber nur, wenn dabei keine
     laufende Partie verloren geht; die will man nicht versehentlich wegwerfen. */
  const targetKey = active ? active.key : "";
  useEffect(() => {
    if (!targetKey || running) return;
    function onKey(e) {
      if (e.key !== "Enter" || e.repeat) return;
      if (forever) onPlayLevel(active.level);
      else onPlay(active.seed);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [targetKey, forever, running, onPlay, onPlayLevel]);

  return html`<div class="scores">
    <div class="scores-head">
      <div>
        <h1>Bestenliste</h1>
        <p class="hint tight">
          ${plays} ${plays === 1 ? "Partie" : "Partien"}
          · ${groups.length} ${forever
              ? "Level"
              : (groups.length === 1 ? "Merkwort" : "Merkwörter")}
        </p>
      </div>
      <button class="rb wideb" onClick=${onClose}>Zurück</button>
    </div>

    <div class="scores-tabs">
      <button class=${"rb" + (forever ? "" : " on")}
        onClick=${() => setTab("classic")}>Klassisch · Punkte</button>
      <button class=${"rb" + (forever ? " on" : "")}
        onClick=${() => setTab("forever")}>∞ Endlos · Zeit</button>
    </div>

    ${active ? html`<div class="scores-body">
      <div class="seed-col">
        ${groups.map((g) => html`
          <button key=${g.key} class=${"seed-row-btn" + (g.key === active.key ? " on" : "")}
            onClick=${() => (forever ? setSelLevel(g.key) : setSel(g.key))}>
            <span class="sr-word">${forever ? "Level " + g.level : g.seed}</span>
            <span class="sr-score">
              ${forever ? TetrisScores.formatDuration(g.best.duration) : g.best.score}</span>
            <span class="sr-plays">${g.plays}× gespielt</span>
          </button>`)}
      </div>

      <div class="detail-col">
        <div class="detail-head">
          <div class="dh-word">
            <p class="seed-word">${forever ? "Level " + active.level : active.seed}</p>
            <p class="hint tight">
              ${active.plays} ${active.plays === 1 ? "Partie" : "Partien"}
              · ${forever
                  ? "Bestzeit " + TetrisScores.formatDuration(active.best.duration)
                  : "Bestwert " + active.best.score + " Punkte"}
            </p>
          </div>
          <div class="dh-play">
            ${forever
              ? html`<button class="start small" onClick=${() => onPlayLevel(active.level)}>
                  ▶ Endlos auf Level ${active.level}
                </button>`
              : html`<button class="start small" onClick=${() => onPlay(active.seed)}>
                  ▶ Dieses Wort spielen
                </button>`}
            <p class=${"hint tight" + (running ? " warn" : "")}>
              ${(forever ? "Merkwort " + nextSeed : "Startlevel " + startLevel) +
                (running ? " · verwirft die laufende Partie" : " · Taste Enter")}
            </p>
          </div>
        </div>
        ${active.entries.map((e, i) => html`
          <${PlayCard} key=${e.date + ":" + i} entry=${e} rank=${i + 1}
            metric=${forever ? "time" : "score"} />`)}
      </div>
    </div>` : html`<div class="scores-empty">
      <p class="lead">${forever
        ? "Noch keine Endlospartie gespeichert."
        : "Noch keine klassische Partie gespeichert."}</p>
      <p class="hint">${forever
        ? "Im Endlosspiel bleibt das Level fest — gewertet wird die durchgehaltene Zeit."
        : "Jede beendete Partie kommt von selbst hierher."}</p>
    </div>`}

    ${store.storage === "memory" ? html`<p class="hint warn">
      Kein Datenordner verfügbar — die Liste gilt nur für diese Sitzung.
    </p>` : null}
    <p class="hint tight">Esc schließt die Liste.</p>
  </div>`;
}
