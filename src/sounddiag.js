/* Die Ton-Diagnose. Taste T öffnet und schließt sie, überall in der App.

   Sie greift nicht ein, sie liest nur ab: was sound.js über jeden der vier Klänge
   weiß — ob sein Element im Dokument steht, ob seine Quelle eingebettet wurde, was
   das Entpacken ergab, welcher Weg zuletzt getragen hat und woran der letzte
   Versuch scheiterte. Dazu je Klang zwei Knöpfe, die ihn auf der Stelle spielen:
   einmal die ganze Kette, einmal nur den eigenen Ton.

   Der Klick ist dabei mehr als Bequemlichkeit: Er ist die stärkste Zustimmung des
   Anwenders, die der Browser kennt. Was auf Knopfdruck stumm bleibt, bleibt nicht
   wegen fehlender Zustimmung stumm.

   Darunter steht, was soundfiles.js an Aufnahmen hat — und dort kommen sie auch
   herein: Die vier Dateien im Ordner assets neben der App erreicht die App nicht
   von sich aus, wohl aber der Anwender. Er wählt sie im Dateidialog oder lässt sie
   über dem Fenster fallen; gesichert werden sie danach im Datenordner.

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

/* Die Aufnahmen (soundfiles.js): was übernommen wurde, was fehlt und woran es lag.

   Von hier aus kommen die Dateien auch herein. Die vier Aufnahmen liegen im Ordner
   assets neben der App — dorthin reicht der Arm der App nicht, sie sieht nur den
   Datenordner. Der Anwender aber kann sie ihr geben: im Dateidialog des Browsers
   oder indem er sie über dem Fenster fallen lässt. Was so ankommt, klingt sofort
   und wird zugleich im Datenordner gesichert. */

// Womit der Dateidialog aufmacht — Tonformen und die base64-Textfassung.
const DIAG_ACCEPT = "audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.txt,.b64";

// Was von einer Aufnahme zu sagen ist — nur, was auch dasteht.
function fileLine(f) {
  if (!f) return "noch keine Aufnahme";
  const bits = [f.name];
  if (f.kb) bits.push(f.kb + " KB");
  if (f.how) bits.push(f.how);
  bits.push(f.state);
  return bits.join(" · ");
}

/* Aus dem Ereignis eines Dateifelds die Dateien holen. Kopiert wird sofort in ein
   Feld: Das Zurücksetzen des Felds leert seine Liste, und die Übernahme läuft
   danach noch eine Weile weiter. */
function filesOf(e) {
  const list = Array.prototype.slice.call(e.target.files || []);
  e.target.value = "";
  return list;
}

function SoundFilesBlock({ onDone }) {
  const { useState } = preactHooks;
  const [busy, setBusy] = useState("");
  const [over, setOver] = useState(false);
  const r = TetrisSoundFiles.report();
  const keys = ["move", "drop", "rows", "tetris"];

  async function takeOne(key, file) {
    if (!file) return;
    setBusy(key);
    try { await TetrisSoundFiles.intakeAs(key, file); }
    catch (err) { /* der Vermerk der Aufnahme sagt es */ }
    finally { setBusy(""); onDone(); }
  }

  async function takeMany(list) {
    if (!list.length) return;
    setBusy("alle");
    try { await TetrisSoundFiles.intake(list); }
    catch (err) { /* der Vermerk sagt es */ }
    finally { setBusy(""); onDone(); }
  }

  /* Das Fallenlassen hier drin ist dasselbe wie überall im Fenster — nur bleibt es
     hier stehen, damit es nicht zweimal übernommen wird. */
  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    takeMany(Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []));
  }

  return html`<div class="diag-files">
    <h3>Aufnahmen <span>${busy === "alle" ? "wird übernommen …" : r.note}</span></h3>
    <div class=${"diag-drop" + (over ? " over" : "")}
      onDragOver=${(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave=${(e) => {
        // Der Wechsel auf ein Kind meldet sich auch als Verlassen — er zählt nicht.
        if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
        setOver(false);
      }}
      onDrop=${onDrop}>
      <b>Aufnahmen hierher ziehen</b>
      <label class="diag-take">Dateien wählen …
        <input type="file" multiple accept=${DIAG_ACCEPT}
          onChange=${(e) => takeMany(filesOf(e))} />
      </label>
    </div>
    <p class="diag-hint">Die vier Dateien liegen im Ordner <b>assets</b> neben der
      App: <i>move-and-turn</i>, <i>drop-sound</i>, <i>row-completed-sound</i>,
      <i>tetris-sound</i>. Wähle sie alle auf einmal — welcher Klang gemeint ist,
      verrät der Name. ${r.fs
        ? html`Danach liegen sie gesichert in <b>${r.dir}</b> im Datenordner und
            klingen bei jedem Start von selbst.`
        : html`<b>Es ist kein Datenordner festgelegt</b> — sie klingen dann nur in
            dieser Sitzung und müssen beim nächsten Start erneut gewählt werden.`}</p>
    <ul>
      ${keys.map((k) => {
        const f = r.files[k];
        const good = !!f && f.ok;
        return html`<li key=${k} class=${good ? "ok" : f ? "bad" : ""}>
          <b>${DIAG_NAMES[k]}</b>
          <span>${fileLine(f)}</span>
          <label class=${"diag-take" + (busy === k ? " busy" : "")}>
            ${busy === k ? "…" : "Datei wählen"}
            <input type="file" accept=${DIAG_ACCEPT}
              onChange=${(e) => takeOne(k, filesOf(e)[0])} />
          </label>
        </li>`;
      })}
    </ul>
    <button class="diag-again"
      onClick=${() => TetrisSoundFiles.scan().then(onDone, () => {})}>Im Datenordner
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

  /* Aufnahmen darf man überall über dem Fenster fallen lassen, nicht nur hier: Die
     Tafel geht dann von selbst auf und zeigt, was daraus wurde. Ohne das
     Abfangen zeigte der Rahmen die Datei bloß an, statt sie zu übernehmen. */
  useEffect(() => {
    function hasFiles(e) {
      const t = e.dataTransfer && e.dataTransfer.types;
      return !!t && Array.prototype.indexOf.call(t, "Files") >= 0;
    }
    function onOver(e) { if (hasFiles(e)) e.preventDefault(); }
    function onDrop(e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      const list = Array.prototype.slice.call(e.dataTransfer.files || []);
      if (!list.length) return;
      setOpen(true);
      TetrisSoundFiles.intake(list).then(() => bump((v) => v + 1), () => {});
    }
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
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
      <${SoundFilesBlock} onDone=${() => bump((v) => v + 1)} />
      <p class="diag-hint">Ein Klang geht drei Wege, bis einer trägt:
        <b>Element</b> → <b>Tonmaschine</b> → <b>eigener Ton</b>. Liegt eine
        Aufnahme aus dem Datenordner bereit, klingt sie zuerst. Steht in
        „zuletzt über“ noch <i>noch nichts</i>, war dieser Klang noch nicht
        fällig. <kbd>T</kbd> schließt wieder.</p>
    </div>
  </div>`;
}

preact.render(html`<${SoundDiag} />`, document.getElementById("diag"));
