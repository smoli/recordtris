/* Die Bedienleiste der Wiedergabe: Schieberegler, Transport, Tempo und der
   Wiedereinstieg. Sie kennt nur den Abspielkopf und meldet Wünsche nach oben. */
function ReplayBar({ frames, cur, canResume, onSeek, onStep, onPlay, onPause, onSpeed, onResume, onClose }) {
  const last = frames.length - 1;
  const frame = frames[cur.index];
  const forward = cur.playing && cur.dir > 0;
  const backward = cur.playing && cur.dir < 0;

  return html`<div class="replay-bar">
    <input class="scrub" type="range" min="0" max=${last} step="1" value=${cur.index}
      onInput=${(e) => onSeek(Number(e.target.value))} />
    <div class="replay-meta">
      <span>${TetrisReplay.formatTime(frame.t)} / ${TetrisReplay.formatTime(frames[last].t)}</span>
      <span>Bild ${cur.index + 1} von ${frames.length}</span>
    </div>

    <div class="replay-row">
      <button class="rb" title="An den Anfang" onClick=${() => onSeek(0)}>⏮</button>
      <button class="rb" title="Ein Bild zurück" onClick=${() => onStep(-1)}>◀|</button>
      <button class=${"rb" + (backward ? " on" : "")} title="Rückwärts abspielen"
        onClick=${() => (backward ? onPause() : onPlay(-1))}>◀◀</button>
      <button class=${"rb" + (forward ? " on" : "")} title="Vorwärts abspielen"
        onClick=${() => (forward ? onPause() : onPlay(1))}>${forward ? "⏸" : "▶"}</button>
      <button class="rb" title="Ein Bild vor" onClick=${() => onStep(1)}>|▶</button>
      <button class="rb" title="Ans Ende" onClick=${() => onSeek(last)}>⏭</button>
    </div>

    <div class="replay-row">
      <span class="replay-label">Tempo</span>
      ${TetrisReplay.SPEEDS.map((s, i) => html`
        <button key=${s} class=${"rb" + (cur.speed === s ? " on" : "")}
          onClick=${() => onSpeed(s)}>${TetrisReplay.SPEED_LABELS[i]}</button>`)}
    </div>

    <div class="replay-row wide">
      <button class="start small" disabled=${!canResume} onClick=${onResume}>Hier weiterspielen</button>
      <button class="rb wideb" onClick=${onClose}>Zurück</button>
    </div>
    ${!canResume && html`<p class="hint tight">Zum Weiterspielen ein Stück zurückspulen.</p>`}
  </div>`;
}

// Die Tastenhilfe der Wiedergabe — sie ersetzt in der Seitenspalte die des Spiels.
function ReplayKeys() {
  return html`<div class="box keys">
    <h2>Wiedergabe</h2>
    <p><kbd>←</kbd><kbd>→</kbd> ein Bild</p>
    <p><kbd>Leer</kbd> abspielen · <kbd>B</kbd> rückwärts</p>
    <p><kbd>1</kbd>…<kbd>5</kbd> Tempo</p>
    <p><kbd>Enter</kbd> hier weiterspielen</p>
    <p><kbd>S</kbd> Ton an/aus</p>
    <p><kbd>Esc</kbd> zurück</p>
  </div>`;
}
