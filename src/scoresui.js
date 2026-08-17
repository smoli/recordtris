/* Die Ansicht der Bestenliste: links jedes gespielte Merkwort mit seinem besten Wert
   und der Zahl der Partien, rechts alle Partien dieses Wortes im Einzelnen. */
const CLEAR_LABELS = ["Einfach", "Doppel", "Dreifach", "Tetris"];

function PlayCard({ entry, rank }) {
  const when = TetrisScores.formatDate(entry.date);
  return html`<div class=${"play" + (rank === 1 ? " top" : "")}>
    <div class="play-head">
      <span class="rank">${rank}.</span>
      <span class="play-score">${entry.score}</span>
      <span class="play-date">${when || "ohne Zeitpunkt"}</span>
    </div>
    <div class="facts">
      <span><b>${entry.lines}</b> Reihen</span>
      <span>Level <b>${entry.level}</b> · Start ${entry.startLevel}</span>
      <span>Dauer <b>${TetrisScores.formatDuration(entry.duration)}</b></span>
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

function ScoresScreen({ store, seed, onClose }) {
  const { useState } = preactHooks;
  const groups = TetrisScores.bySeed(store);
  const [sel, setSel] = useState(TetrisSeed.normalize(seed));
  const active = groups.filter((g) => g.key === sel)[0] || groups[0] || null;

  return html`<div class="scores">
    <div class="scores-head">
      <div>
        <h1>Bestenliste</h1>
        <p class="hint tight">
          ${store.entries.length} ${store.entries.length === 1 ? "Partie" : "Partien"}
          · ${groups.length} ${groups.length === 1 ? "Merkwort" : "Merkwörter"}
        </p>
      </div>
      <button class="rb wideb" onClick=${onClose}>Zurück</button>
    </div>

    ${active ? html`<div class="scores-body">
      <div class="seed-col">
        ${groups.map((g) => html`
          <button key=${g.key} class=${"seed-row-btn" + (g.key === active.key ? " on" : "")}
            onClick=${() => setSel(g.key)}>
            <span class="sr-word">${g.seed}</span>
            <span class="sr-score">${g.best.score}</span>
            <span class="sr-plays">${g.plays}× gespielt</span>
          </button>`)}
      </div>

      <div class="detail-col">
        <div class="detail-head">
          <p class="seed-word">${active.seed}</p>
          <p class="hint tight">
            ${active.plays} ${active.plays === 1 ? "Partie" : "Partien"}
            · Bestwert ${active.best.score} Punkte
          </p>
        </div>
        ${active.entries.map((e, i) => html`
          <${PlayCard} key=${e.date + ":" + i} entry=${e} rank=${i + 1} />`)}
      </div>
    </div>` : html`<div class="scores-empty">
      <p class="lead">Noch keine Partie gespeichert.</p>
      <p class="hint">Jede beendete Partie kommt von selbst hierher.</p>
    </div>`}

    ${store.storage === "memory" ? html`<p class="hint warn">
      Kein Datenordner verfügbar — die Liste gilt nur für diese Sitzung.
    </p>` : null}
    <p class="hint tight">Esc schließt die Liste.</p>
  </div>`;
}
