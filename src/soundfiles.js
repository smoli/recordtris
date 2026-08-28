/* Die Aufnahmen aus dem Datenordner.

   In diesem Fensterrahmen kommt keine Tondatei von selbst an: Die Quellen der
   <audio>-Elemente sind Pfade (assets/…), die das Bündeln stehen lässt, und auf
   Dateien neben der App hat der Rahmen keinen Zugriff. Jedes Element meldet darum
   "Quelle nicht spielbar (Fehler 4)", und es bleibt bei den eigenen Tönen.

   Es gibt genau einen Weg, auf dem die Bytes einer Aufnahme dennoch in die
   laufende App gelangen: das Dateisystem des Workspace (morphosFS). Von dort
   gelesen, werden sie in sound.js entpackt und ersetzen, was im Dokument steht.

   Gesucht wird beim Start, ohne Zutun — in dieser Ordnung:
     1. die Merkliste zuletzt von Hand gewählter Dateien (tetris-sounds.json),
     2. der Ordner tetris-sounds/,
     3. der Datenordner selbst.
   Welcher Klang gemeint ist, verrät der Dateiname.

   Zwei Formen werden gelesen:
     - eine Tondatei (mp3/wav/ogg/m4a), sofern das Dateisystem ihre Bytes
       unversehrt durchreicht;
     - eine Textdatei mit derselben Aufnahme in base64 (auch als data:-Zeile) —
       der Weg, der immer trägt, weil Text unterwegs nichts verliert.

   Dateien, die WOANDERS liegen — etwa im Ordner assets neben der App —, kann die
   App nicht von sich aus lesen: Der Datenordner ist alles, was sie sieht. Herein
   kommen sie über den Anwender, der sie im Dateidialog wählt oder über dem Fenster
   fallen lässt (intake/intakeAs). Was so ankommt, klingt auf der Stelle UND wird
   als base64 in tetris-sounds/ gesichert — die Suche findet es beim nächsten Start
   von selbst.

   Findet sich nichts, bleibt alles, wie es war: Die App klingt mit ihren eigenen
   Tönen weiter. Was gefunden wurde, gibt report() preis; die Ton-Diagnose
   (Taste T) zeigt es und nimmt Dateien entgegen. */
const TetrisSoundFiles = (function () {
  const DIR = "tetris-sounds";
  const LIST = "tetris-sounds.json"; // die Merkliste: Klang -> gesicherte Datei

  // Woran ein Klang in einem Dateinamen zu erkennen ist — ohne Endung, klein
  // geschrieben, ohne Trennzeichen. Erst genau, dann als Teil des Namens.
  const NAMES = {
    move: ["move", "moveandturn", "moveturn", "schieben", "drehen"],
    drop: ["drop", "dropsound", "aufsetzen", "fallen"],
    rows: ["rows", "row", "rowcompleted", "rowcompletedsound", "reihe", "line"],
    tetris: ["tetris", "tetrissound", "viererreihe"]
  };

  const MIME = { mp3: "audio/mpeg", mpeg: "audio/mpeg", wav: "audio/wav",
                 ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4",
                 aac: "audio/aac", flac: "audio/flac", webm: "audio/webm" };

  /* Nur diese Endungen kommen beim Durchsehen eines Ordners in Frage. Die Grenze
     ist nötig, weil im Datenordner auch die Dateien der App liegen: Ohne sie
     hielte die Merkliste "tetris-sounds.json" sich selbst für den Tetris-Klang. */
  const EXTS = ["mp3", "mpeg", "wav", "ogg", "oga", "m4a", "aac", "flac", "webm",
                "b64", "base64", "txt"];

  const found = {};          // key -> { name, path, how, kb, state }
  let note = "noch nicht gesucht";
  let picks = null;          // die Merkliste, sobald sie gelesen wurde

  // --- Namen ---

  function extOf(name) {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  }
  function baseOf(name) {
    const dot = name.lastIndexOf(".");
    return (dot > 0 ? name.slice(0, dot) : name).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function keyOf(name) {
    if (EXTS.indexOf(extOf(name)) < 0) return null;
    const b = baseOf(name);
    if (!b) return null;
    for (const key in NAMES) {
      if (NAMES[key].indexOf(b) >= 0) return key;
    }
    for (const key in NAMES) {
      const list = NAMES[key];
      for (let i = 0; i < list.length; i++) {
        if (b.indexOf(list[i]) >= 0) return key;
      }
    }
    return null;
  }

  // --- Aus Text werden Bytes ---

  function fromBase64(s) {
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  /* Das Dateisystem liefert Text. Steht darin base64 (auch mit data:-Kopf), ist der
     Fall klar. Sonst können es die Bytes selbst sein, Zeichen für Zeichen — aber nur,
     wenn sie den Weg unbeschadet überstanden haben: Ein Zeichen über 255 heißt, dass
     die Datei als Text gelesen wurde und dabei zerfiel — auch das Ersatzzeichen, mit
     dem ein Leser jedes unverständliche Byte quittiert, liegt darüber. */
  function bytesOf(text) {
    if (typeof text !== "string" || !text.length) return { err: "leer" };
    let s = text;
    if (/^\s*data:[^,]{0,200},/.test(s)) s = s.slice(s.indexOf(",") + 1);
    const clean = s.replace(/\s+/g, "");
    if (clean.length > 64 && /^[A-Za-z0-9+/]+={0,2}$/.test(clean)) {
      try { return { buf: fromBase64(clean), how: "base64" }; } catch (e) { /* dann eben nicht */ }
    }
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c > 255) return { err: "als Text zerfallen" };
      bytes[i] = c;
    }
    return { buf: bytes.buffer, how: "Bytes" };
  }

  /* Woran eine Aufnahme zu erkennen ist, wenn die Endung nichts verrät (base64 in
     einer .txt): an ihren ersten Bytes. Nur das Element braucht diese Auskunft —
     das Entpacken riecht selbst, was es vor sich hat. */
  function sniff(buffer) {
    const n = Math.min(12, buffer.byteLength);
    const b = new Uint8Array(buffer, 0, n);
    const head = String.fromCharCode(b[0] || 0, b[1] || 0, b[2] || 0, b[3] || 0);
    if (head === "RIFF") return "audio/wav";
    if (head === "OggS") return "audio/ogg";
    if (head === "fLaC") return "audio/flac";
    if (head.slice(0, 3) === "ID3") return "audio/mpeg";
    if (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0) return "audio/mpeg";
    if (n >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
      return "audio/mp4";
    }
    return "";
  }

  // Der letzte Teil eines Pfades — die Dialoge dürfen auch Windows-Trenner liefern.
  function nameOf(path) {
    return String(path).split(/[\\/]/).pop();
  }

  // --- Lesen und übergeben ---

  function done(key) {
    return !!(found[key] && found[key].ok);
  }

  async function take(key, name, path) {
    const fs = window.morphosFS;
    const f = found[key] = { name: name, path: path, how: "", kb: 0,
                             ok: false, state: "wird gelesen" };
    if (!fs) { f.state = "kein Datenordner"; return false; }
    let text;
    try { text = await fs.readFile(path); }
    catch (e) { f.state = "nicht lesbar"; return false; }
    const r = bytesOf(text);
    if (!r.buf) { f.state = r.err; return false; }
    f.how = r.how;
    f.kb = Math.round(r.buf.byteLength / 1024 * 10) / 10;
    /* Erkennt der Blick auf die ersten Bytes keine Tonform, ist die Datei auf dem
       Weg durch das Dateisystem als Text zerfallen. Versucht wird es trotzdem —
       aber der Vermerk sagt, woran es liegt, wenn nichts klingt. */
    const kind = sniff(r.buf);
    f.ok = TetrisSound.adopt(key, r.buf, kind || MIME[extOf(name)] || "audio/mpeg", name);
    f.state = !f.ok ? "abgewiesen"
      : kind ? "übernommen"
      : "übernommen, aber keine Tonform erkennbar";
    return f.ok;
  }

  async function fromDir(dir) {
    const fs = window.morphosFS;
    let entries;
    try { entries = await fs.list(dir); } catch (e) { return; }
    if (!Array.isArray(entries)) return;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e || e.isDir || !e.name) continue;
      const key = keyOf(e.name);
      if (!key || done(key)) continue;
      // Der Pfad wird selbst gebaut wie im Archiv: relativ zum Datenordner.
      await take(key, e.name, dir ? dir + "/" + e.name : e.name);
    }
  }

  async function fromPicks() {
    const fs = window.morphosFS;
    let text;
    try { text = await fs.readFile(LIST); } catch (e) { return; }
    let map;
    try { map = JSON.parse(text); } catch (e) { return; }
    if (!map || typeof map !== "object") return;
    picks = map;
    for (const key in map) {
      if (!NAMES[key] || done(key)) continue;
      const entry = map[key];
      /* Zwei Formen: früher stand hier nur der Pfad, heute steht daneben auch der
         Name der Datei, aus der die gesicherte Fassung entstanden ist. */
      const path = typeof entry === "string" ? entry
        : entry && typeof entry.path === "string" ? entry.path : "";
      if (!path) continue;
      const name = entry && typeof entry.name === "string" ? entry.name : nameOf(path);
      await take(key, name, path);
    }
  }

  // --- Was von außen aufgerufen wird ---

  /* Einmal alles durchsehen. Läuft beim Start von selbst und noch einmal, wenn die
     Diagnose darum bittet. */
  async function scan() {
    const fs = window.morphosFS;
    if (!fs || !fs.list) { note = "kein Datenordner"; return report(); }
    note = "wird gesucht …";
    await fromPicks();
    await fromDir(DIR);
    await fromDir("");
    let n = 0;
    for (const key in NAMES) if (done(key)) n++;
    note = n ? n + " von 4 Aufnahmen übernommen" : "keine Aufnahme gefunden";
    return report();
  }

  // --- Aufnahmen von außen hereinholen ---

  /* Die vier Aufnahmen liegen im Ordner assets neben der App. Dorthin reicht der
     Arm der App nicht: Sie sieht nur den Datenordner. Der Anwender aber kann sie
     ihr geben — im Dateidialog des Browsers oder indem er sie über dem Fenster
     fallen lässt. Von dort kommen echte Bytes an, kein Pfad; damit ist der Umweg
     über das Dateisystem gar nicht nötig.

     Gesichert wird trotzdem: Was hereinkommt, wandert als base64 nach
     tetris-sounds/<klang>.txt. Beim nächsten Start findet die Suche es dort von
     selbst wieder — einmal hereingeholt, bleibt es. */

  function readBytes(file) {
    return new Promise(function (resolve) {
      let r;
      try { r = new FileReader(); } catch (e) { resolve(null); return; }
      r.onload = function () { resolve(r.result || null); };
      r.onerror = function () { resolve(null); };
      try { r.readAsArrayBuffer(file); } catch (e) { resolve(null); }
    });
  }

  // Bytes als Zeichen — in Häppchen, sonst sprengt der Aufruf den Stapel.
  function latin1(buffer) {
    const bytes = new Uint8Array(buffer);
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return s;
  }

  /* In den Datenordner sichern. Der Name ist der Klang selbst — er trifft die
     Namenserkennung immer, gleich wie die Datei ursprünglich hieß. Wie sie hieß,
     merkt sich daneben die Merkliste, damit die Diagnose es weiter zeigen kann. */
  async function store(key, name, b64) {
    const fs = window.morphosFS;
    if (!fs || !fs.writeFile) return "";
    const path = DIR + "/" + key + ".txt";
    if (fs.mkdir) { try { await fs.mkdir(DIR); } catch (e) { /* gibt es schon */ } }
    try { await fs.writeFile(path, b64); } catch (e) { return ""; }
    if (!picks) picks = {};
    picks[key] = { path: path, name: name };
    try { await fs.writeFile(LIST, JSON.stringify(picks, null, 1)); } catch (e) {}
    return path;
  }

  /* Eine hereingereichte Datei für einen bestimmten Klang übernehmen. */
  async function intakeAs(key, file) {
    if (!NAMES[key] || !file) return false;
    const name = file.name || "Datei";
    const f = found[key] = { name: name, path: "", how: "", kb: 0,
                             ok: false, state: "wird gelesen" };
    let buffer = await readBytes(file);
    if (!buffer || !buffer.byteLength) { f.state = "nicht lesbar"; return false; }
    let how = "Datei";
    /* Auch eine Textdatei mit base64 darf hereingereicht werden — dann steckt die
       Aufnahme in ihren Zeichen, nicht in ihren Bytes. */
    if (!sniff(buffer)) {
      const r = bytesOf(latin1(buffer));
      if (r.buf && sniff(r.buf)) { buffer = r.buf; how = r.how; }
    }
    let b64;
    // Vor dem Übernehmen: das Entpacken frisst den Puffer auf.
    try { b64 = btoa(latin1(buffer)); } catch (e) { b64 = ""; }
    f.how = how;
    f.kb = Math.round(buffer.byteLength / 1024 * 10) / 10;
    const kind = sniff(buffer) || MIME[extOf(name)] || "audio/mpeg";
    f.ok = TetrisSound.adopt(key, buffer, kind, name);
    if (!f.ok) { f.state = "abgewiesen"; return false; }
    f.path = b64 ? await store(key, name, b64) : "";
    f.state = f.path ? "übernommen und gesichert" : "übernommen (nur diese Sitzung)";
    return true;
  }

  /* Mehrere Dateien auf einmal — welcher Klang gemeint ist, verrät der Name. Das
     ist der Weg für das Fallenlassen und für die Wahl aller vier auf einmal. */
  async function intake(files) {
    const list = files ? Array.prototype.slice.call(files) : [];
    let taken = 0;
    let missed = 0;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      if (!file || !file.name) continue;
      const key = keyOf(file.name);
      if (!key) { missed++; continue; }
      if (await intakeAs(key, file)) taken++; else missed++;
    }
    note = taken
      ? taken + (taken === 1 ? " Aufnahme übernommen" : " Aufnahmen übernommen")
          + (missed ? ", " + missed + " nicht zugeordnet" : "")
      : list.length
        ? "keine der " + list.length + " Dateien ließ sich zuordnen"
        : "keine Datei dabei";
    return report();
  }

  // Nur Ablesen, kein Eingriff — für die Ton-Diagnose.
  function report() {
    return {
      fs: !!(window.morphosFS && window.morphosFS.list),
      dir: DIR,
      note: note,
      files: found
    };
  }

  // Beim Start einmal von selbst: Was hier liegt, klingt ab dem ersten Zug.
  function begin() { scan().catch(function () { note = "Suche misslungen"; }); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin);
  } else {
    begin();
  }

  return {
    scan: scan,
    intake: intake,
    intakeAs: intakeAs,
    report: report,
    dir: DIR
  };
})();
