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

   Findet sich nichts, bleibt alles, wie es war: Die App klingt mit ihren eigenen
   Tönen weiter. Was gefunden wurde, gibt report() preis; die Ton-Diagnose
   (Taste T) zeigt es und lässt Dateien von Hand wählen. */
const TetrisSoundFiles = (function () {
  const DIR = "tetris-sounds";
  const LIST = "tetris-sounds.json"; // die von Hand gewählten Dateien

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
      if (!NAMES[key] || done(key) || typeof map[key] !== "string") continue;
      await take(key, nameOf(map[key]), map[key]);
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

  /* Eine Aufnahme von Hand wählen. Der Dialog zeigt den Datenordner; der gewählte
     Pfad wird gemerkt, damit dieselbe Datei beim nächsten Start von selbst klingt. */
  async function pick(key) {
    const fs = window.morphosFS;
    if (!NAMES[key] || !fs || !fs.openFile) return false;
    let path;
    try {
      path = await fs.openFile({
        title: "Aufnahme wählen",
        extensions: ["mp3", "wav", "ogg", "m4a", "b64", "txt"]
      });
    } catch (e) { return false; }
    if (!path) return false;
    const ok = await take(key, nameOf(path), path);
    if (ok) await remember(key, path);
    return ok;
  }

  async function remember(key, path) {
    const fs = window.morphosFS;
    if (!fs || !fs.writeFile) return;
    if (!picks) picks = {};
    picks[key] = path;
    try { await fs.writeFile(LIST, JSON.stringify(picks, null, 1)); } catch (e) {}
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
    pick: pick,
    report: report,
    dir: DIR
  };
})();
