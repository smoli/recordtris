/* Die Auswertung einer aufgezeichneten Partie: die Zahlen hinter dem Ergebnis und
   zwei Kurven über die Spielzeit. Sie holt sich das Band selbst aus dem Archiv —
   erst dann, wenn der Anwender die Auswertung wirklich aufklappt. */

// Eine Kurve in einem festen Koordinatenfeld von 100 × 40; die Karte streckt es.
function CurveChart({ xs, series }) {
  const H = 40;
  return html`<svg class="chart-svg" viewBox="0 0 100 40" preserveAspectRatio="none">
    ${series.map((s) => {
      const max = Math.max(1, s.max);
      const pts = s.values
        .map((v, i) => xs[i].toFixed(2) + "," + (H - (v / max) * H).toFixed(2))
        .join(" ");
      return s.fill
        ? html`<polygon key=${s.key} class=${"cv cv-" + s.key} points=${"0,40 " + pts + " 100,40"} />`
        : html`<polyline key=${s.key} class=${"cv cv-" + s.key} points=${pts} />`;
    })}
  </svg>`;
}

function Chart({ title, xs, series }) {
  return html`<div class="chart">
    <div class="chart-head">
      <span class="chart-title">${title}</span>
      ${series.map((s) => html`
        <span key=${s.key} class=${"lg lg-" + s.key}>${s.label} <b>${s.top}</b></span>`)}
    </div>
    <${CurveChart} xs=${xs} series=${series} />
  </div>`;
}

// Ein Kasten mit vier Zahlen — die Auswertung besteht aus mehreren davon.
function FactBox({ title, rows }) {
  return html`<div class="fact-box">
    <h3>${title}</h3>
    ${rows.map((r) => html`<p key=${r[0]}><span>${r[0]}</span><b>${r[1]}</b></p>`)}
  </div>`;
}

function AnalysisBody({ a }) {
  const d = TetrisAnalysis.decimal;
  const dur = Math.max(1, a.duration);
  const xs = a.curve.map((p) => (p.t / dur) * 100);

  return html`<div class="analysis">
    <div class="fact-grid">
      <${FactBox} title="Tempo" rows=${[
        ["Punkte je Minute", Math.round(a.ppm)],
        ["Steine je Minute", d(a.spm)],
        ["Sekunden je Stein", d(a.secPerPiece, 2)],
        ["Reihen je Minute", d(a.lpm)]
      ]} />
      <${FactBox} title="Ausbeute" rows=${[
        ["Steine gesetzt", a.pieces],
        ["Reihen je Stein", d(a.efficiency, 2)],
        ["Anteil Tetris", Math.round(a.tetrisRate * 100) + " %"],
        ["längste Strecke ohne I", a.droughtI + " Steine"]
      ]} />
      <${FactBox} title="Stapel" rows=${[
        ["höchster Stand", a.maxHeight + " Reihen"],
        ["Stand am Ende", a.endHeight + " Reihen"],
        ["meiste Löcher", a.maxHoles],
        ["Löcher am Ende", a.endHoles]
      ]} />
      <${FactBox} title="Züge" rows=${[
        ["Drehungen", a.rotations],
        ["Verschiebungen", a.shifts],
        ["Züge je Stein", d(a.movesPerPiece)],
        ["Bilder im Band", a.frames]
      ]} />
    </div>

    <${Chart} title="Punkte und Reihen" xs=${xs} series=${[
      { key: "score", label: "Punkte", top: a.score, fill: true,
        max: Math.max(1, a.score), values: a.curve.map((p) => p.score) },
      { key: "lines", label: "Reihen", top: a.lines,
        max: Math.max(1, a.lines), values: a.curve.map((p) => p.lines) }
    ]} />

    <${Chart} title="Stapel über die Zeit" xs=${xs} series=${[
      { key: "height", label: "Höhe", top: a.maxHeight, fill: true,
        max: TetrisEngine.ROWS, values: a.curve.map((p) => p.height) },
      { key: "holes", label: "Löcher", top: a.maxHoles,
        max: Math.max(1, a.maxHoles), values: a.curve.map((p) => p.holes) }
    ]} />

    <p class="hint tight">
      Die Kurven laufen über die gespielte Zeit, von 0 bis ${TetrisReplay.formatTime(a.duration)}.
    </p>
  </div>`;
}

/* Die Hülle: lädt das Band, wertet es aus und sagt es, wenn beides nicht geht. */
function PlayAnalysis({ file }) {
  const { useState, useEffect } = preactHooks;
  const [view, setView] = useState({ state: "load" });

  useEffect(() => {
    let alive = true;
    setView({ state: "load" });
    TetrisArchive.load(file).then((frames) => {
      if (!alive) return;
      const a = frames ? TetrisAnalysis.analyze(frames) : null;
      setView(a ? { state: "ok", a: a } : { state: "fail" });
    });
    return () => { alive = false; };
  }, [file]);

  if (view.state === "load") return html`<p class="hint tight">Aufzeichnung wird gelesen …</p>`;
  if (view.state === "fail") return html`<p class="hint warn">Die Aufzeichnung ließ sich nicht lesen.</p>`;
  return html`<${AnalysisBody} a=${view.a} />`;
}
