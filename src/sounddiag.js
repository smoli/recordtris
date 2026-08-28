/* Die Ton-Diagnose. Taste T öffnet und schließt sie, überall in der App.

   Sie greift nicht ein, sie liest nur ab: was sound.js über jeden der vier Klänge
   weiß — ob sein Element im Dokument steht, ob seine Quelle eingebettet wurde, was
   das Entpacken ergab, welcher Weg zuletzt getragen hat und woran der letzte
   Versuch scheiterte. Dazu je Klang zwei Knöpfe, die ihn auf der Stelle spielen:
   einmal die ganze Kette, einmal nur den eigenen Ton.

   Der Klick ist dabei mehr als Bequemlichkeit: Er ist die stärkste Zustimmung des
   Anwenders, die der Browser kennt. Was auf Knopfdruck stumm bleibt, bleibt nicht
   wegen fehlender Zustimmung stumm.

   Darunter steht, was soundfiles.js im Datenordner gefunden hat — der einzige Weg,
   auf dem eine Aufnahme in diesem Fensterrahmen überhaupt in die App gelangt. Dort
   lässt sich für jeden Klang auch eine Datei von Hand wählen.

   Sie hängt an einer eigenen Wurzel (#diag) und liegt damit über jeder Ansicht,
   ohne dass eine davon etwas von ihr wissen muss. */

// Was die Zahlen des Elements bedeuten — in Worten statt in Kennziffern.
const DIAG_READY = ["nichts", "Metadaten", "erste Daten", "läuft durch", "vollständig"];
const DIAG_NET = ["leer", "im Leerlauf", "lädt", "keine Quelle"];
const DIAG_ERR = { 1: "abgebrochen", 2: "Netzfehler", 3: "nicht entschlüsselbar",
                   4: "Quelle nicht unterstützt" };
const DIAG_NAMES = { move: "Schieben / Drehen", drop: "Aufsetzen",
                     rows: "Reihe voll", tetris: "Tetris" };

function SoundDiagRow({ s }) {
  // Grün, solange etwas getragen hat; rot, wo der Weg nachweislich zu ist.
  const bad = !s.found || s.error > 0 || s.way === "stumm";
  const ok = s.way === "Element" || s.way === "Tonmaschine";
  return html`<tr class=${bad ? "bad" : ok ? "ok" : ""}>
    <td class="name">${DIAG_NAMES[s.key] || s.key}</td>
    <td>${s.file ? "Datei: " + s.file
      : !s.found ? "fehlt"
      : s.embedded ? "eingebettet " + s.kb + " KB"
      : s.src ? "Pfad: " + s.src : "ohne Quelle"}</td>
    <td>${s.found ? (DIAG_READY[s.ready] || s.ready) + " · " + (DIAG_NET[s.net] || s.net) : "—"}
      ${s.error > 0 && html`<b> · ${DIAG_ERR[s.error] || "Fehler " + s.error}</b>`}</td>
    <td>${s.decode}</td>
    <td class="way">${s.way}${s.voices ? " (" + s.voices + ")" : ""}</td>
    <td class="note">${s.note || "—"}</td>
    <td class="act">
      <button onClick=${() => TetrisSound.test(s.key)}>▶ Datei</button>
      <button onClick=${() => TetrisSound.test(s.key, "tone")}>▶ Ton</button>
    </td>
  </tr>`;
}

/* Die Aufnahmen aus dem Datenordner (soundfiles.js): was gefunden wurde, was fehlt
   und woran es lag. Von hier aus lässt sich für jeden Klang eine Datei wählen — das
   ist zugleich der einzige Weg, auf dem eine Aufnahme überhaupt in die App gelangt. */
// Was von einer gefundenen Datei zu sagen ist — nur, was auch dasteht.
function fileLine(f) {
  if (!f) return "keine Datei gefunden";
  const bits = [f.name];
  if (f.kb) bits.push(f.kb + " KB");
  if (f.how) bits.push(f.how);
  bits.push(f.state);
  return bits.join(" · ");
}

function SoundFilesBlock() {
  const { useState } = preactHooks;
  const [busy, setBusy] = useState("");
  const r = TetrisSoundFiles.report();
  const keys = ["move", "drop", "rows", "tetris"];

  async function choose(key) {
    setBusy(key);
    try { await TetrisSoundFiles.pick(key); } finally { setBusy(""); }
  }

  return html`<div class="diag-files">
    <h3>Aufnahmen aus dem Datenordner <span>${r.note}</span></h3>
    ${!r.fs
      ? html`<p class="diag-hint">Es ist kein Datenordner festgelegt — ohne ihn
          bleibt es bei den eigenen Tönen.</p>`
      : html`<p class="diag-hint">Tondateien neben der App sind hier nicht
          erreichbar; nur der Datenordner führt hinein. Lege die vier Aufnahmen in
          <b>${r.dir}</b> oder in den Datenordner selbst — erkannt werden sie am
          Namen (<i>move</i>, <i>drop</i>, <i>row</i>, <i>tetris</i>). Kommt eine
          Datei <i>als Text zerfallen</i> an, trägt dieselbe Aufnahme als
          <b>base64</b> in einer <b>.txt</b> ganz sicher.</p>`}
    <ul>
      ${keys.map((k) => {
        const f = r.files[k];
        const good = !!f && f.ok;
        return html`<li key=${k} class=${good ? "ok" : f ? "bad" : ""}>
          <b>${DIAG_NAMES[k]}</b>
          <span>${fileLine(f)}</span>
          <button disabled=${busy === k} onClick=${() => choose(k)}>
            ${busy === k ? "…" : "Datei wählen"}</button>
        </li>`;
      })}
    </ul>
    <button class="diag-again" onClick=${() => TetrisSoundFiles.scan().catch(() => {})}>Erneut
      suchen</button>
  </div>`;
}

function SoundDiag() {
  const { useState, useEffect } = preactHooks;
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);

  // Taste T — aber nicht, während der Anwender ein Merkwort tippt.
  useEffect(() => {
    function onKey(e) {
      if (e.target && e.target.tagName === "INPUT") return;
      if (e.repeat) return;
      /* Nur T — Esc gehört dem Spiel (Aufgeben, Liste schließen) und würde sonst
         zweierlei zugleich tun. */
      if (e.key === "t" || e.key === "T") setOpen((o) => !o);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Solange sie offen ist, liest sie sich viermal je Sekunde neu ab.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => bump((v) => v + 1), 250);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;
  const r = TetrisSound.report();

  return html`<div class="diag">
    <div class="diag-box">
      <div class="diag-head">
        <h2>Ton-Diagnose</h2>
        <span class="diag-ctx">Tonmaschine: <b>${r.ctx}</b> · Uhr ${r.clock}s
          · Ton ${r.muted ? "aus" : "an"}</span>
        <button class="diag-close" onClick=${() => setOpen(false)}>Schließen</button>
      </div>
      ${r.muted && html`<p class="diag-warn">Der Ton ist abgeschaltet —
        <kbd>S</kbd> schaltet ihn an. Solange bleibt auch die Probe stumm.</p>`}
      <table>
        <thead><tr>
          <th>Klang</th><th>Quelle</th><th>Element</th><th>Entpacken</th>
          <th>zuletzt über</th><th>Vermerk</th><th></th>
        </tr></thead>
        <tbody>
          ${r.sounds.map((s) => html`<${SoundDiagRow} key=${s.key} s=${s} />`)}
        </tbody>
      </table>
      <${SoundFilesBlock} />
      <p class="diag-hint">Ein Klang geht drei Wege, bis einer trägt:
        <b>Element</b> → <b>Tonmaschine</b> → <b>eigener Ton</b>. Liegt eine
        Aufnahme aus dem Datenordner bereit, klingt sie zuerst. Steht in
        „zuletzt über“ noch <i>noch nichts</i>, war dieser Klang noch nicht
        fällig. <kbd>T</kbd> schließt wieder.</p>
    </div>
  </div>`;
}

preact.render(html`<${SoundDiag} />`, document.getElementById("diag"));
