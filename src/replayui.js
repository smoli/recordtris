/* Die Bedienleiste der Wiedergabe: Schieberegler, Transport, Tempo und der
   Wiedereinstieg. Sie kennt nur den Abspielkopf und meldet Wünsche nach oben. */
function ReplayBar({ frames, cur, canResume, warn, onSeek, onStep, onPlay, onPause, onSpeed, onResume, onClose }) {
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
    ${canResume && warn ? html`<p class="hint tight warn">${warn}</p>` : null}
  </div>`;
}

/* Die ganze Ansicht der Wiedergabe: statt des Spiels das aufgezeichnete Bild, samt
   Zahlen und Bedienleiste. Gezeigt wird entweder das Band der laufenden Partie oder
   eine Partie aus dem Archiv — dann steht deren Eintrag der Bestenliste in archive. */
function ReplayScreen({ frames, cur, view, frame, archive, warn,
                        onSeek, onStep, onPlay, onPause, onSpeed, onResume, onClose }) {
  return html`<div class=${"app replaying lv" + (view.level % 10)}>
    <aside class="panel left">
      <h2>Statistik</h2>
      <${Stats} stats=${view.stats} />
    </aside>

    <div class="center">
      <div class="stage">
        <${Board} game=${view} />
        <div class=${"replay-tag" + (frame.over ? " end" : "")}>
          ${archive ? "Archiv · " + archive.seed : (frame.over ? "Game Over" : "Wiedergabe")}
        </div>
      </div>
      <${ReplayBar} frames=${frames} cur=${cur} canResume=${!frame.over} warn=${warn}
        onSeek=${onSeek} onStep=${onStep} onPlay=${onPlay} onPause=${onPause}
        onSpeed=${onSpeed} onResume=${onResume} onClose=${onClose} />
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
      ${archive ? html`<div class="box">
        <h2>Aus dem Archiv</h2>
        <p class="seed-word">${archive.seed}</p>
        <p class="hint tight">${TetrisScores.formatDate(archive.date)}</p>
        <p class="hint tight">${archive.score} Punkte · ${archive.lines} Reihen</p>
      </div>` : null}
      <${ReplayKeys} archived=${!!archive} />
    </aside>
  </div>`;
}

// Die Tastenhilfe der Wiedergabe — sie ersetzt in der Seitenspalte die des Spiels.
function ReplayKeys({ archived }) {
  return html`<div class="box keys">
    <h2>Wiedergabe</h2>
    <p><kbd>←</kbd><kbd>→</kbd> ein Bild</p>
    <p><kbd>Leer</kbd> abspielen · <kbd>B</kbd> rückwärts</p>
    <p><kbd>1</kbd>…<kbd>5</kbd> Tempo</p>
    <p><kbd>Enter</kbd> hier weiterspielen</p>
    <p><kbd>Esc</kbd> ${archived ? "zurück zur Bestenliste" : "zurück"}</p>
  </div>`;
}
