/* Die vier Aufnahmen aus dem Ordner assets — auf dem Weg ins Spiel.

   Die Dateien liegen als Beigaben neben der App. Wo ihr Pfad im Markup oder im CSS
   steht, setzt das Bündeln ihre data:-Quelle ein; die App selbst kann sie nicht
   laden, denn Pfade führen im Fensterrahmen nirgendwohin. Alles hängt also daran,
   dass das Bündeln die Stelle erkennt, an der der Pfad steht.

   Genau das ist bisher nicht geschehen: Im gebündelten Dokument stand der Pfad
   eines <audio src="assets/…"> unverändert da. Deshalb liegt derselbe Pfad jetzt an
   DREI Stellen, die jede für sich in Frage kommt:
     1. als url(…) im CSS   (sounds.css, --snd-move und Geschwister),
     2. als <source> im <audio>,
     3. als <img> ohne Bild — eine Quelle ist eine Quelle, gleich an welchem Tag.
   Diese Datei liest alle drei ab und nimmt für jeden Klang die erste, aus der eine
   data:-Quelle geworden ist. Was ein Pfad geblieben ist, wird übergangen.

   Sie läuft beim Laden, noch vor der Suche im Datenordner (soundfiles.js). Was hier
   ankommt, gilt: Die Beigabe ist die Aufnahme, die der Anwender gemeint hat.

   Was jeder Weg ergeben hat, gibt report() preis — die Ton-Diagnose (Taste T) zeigt
   es. Trägt keiner, bleibt alles wie zuvor: Die App sucht im Datenordner weiter und
   klingt notfalls mit ihren eigenen Tönen. */
const TetrisSoundAssets = (function () {
  // Klang -> Dateiname der Beigabe. Nur zum Anzeigen; gefunden wird über die Stelle.
  const FILES = {
    move: "move-and-turn.mp3",
    drop: "drop-sound.mp3",
    rows: "row-completed-sound.mp3",
    tetris: "tetris-sound.mp3"
  };

  const state = {}; // key -> { way, kb, state }
  let note = "noch nicht gelesen";

  // --- Die drei Stellen ---

  /* Aus einer Stilregel: url("data:…") oder url(data:…). Der Browser gibt den Wert
     so zurück, wie er im Bündel steht — nur die Anführungszeichen sind seine. */
  function fromCss(key) {
    let raw;
    try {
      raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--snd-" + key);
    } catch (e) { return ""; }
    if (!raw) return "";
    const m = /^\s*url\(\s*(['"]?)([\s\S]*?)\1\s*\)\s*$/.exec(raw);
    return m ? m[2] : "";
  }

  function attrOf(el) {
    return el ? (el.getAttribute("src") || "") : "";
  }

  function fromSource(key) {
    return attrOf(document.querySelector('#snd-' + key + ' source'));
  }

  function fromCarrier(key) {
    return attrOf(document.querySelector('.snd-carrier[data-snd="' + key + '"]'));
  }

  const WAYS = [
    { name: "Stilregel", get: fromCss },
    { name: "Quelle im Klang", get: fromSource },
    { name: "verstecktes Element", get: fromCarrier }
  ];

  // --- Übernehmen ---

  function kbOf(uri) {
    const comma = uri.indexOf(",");
    return comma < 0 ? 0 : Math.round((uri.length - comma) * 0.75 / 1024 * 10) / 10;
  }

  function takeOne(key) {
    let last = null; // der letzte Weg, an dem überhaupt eine Quelle stand
    for (let i = 0; i < WAYS.length; i++) {
      const uri = WAYS[i].get(key);
      if (!uri || uri.slice(0, 5) !== "data:") continue;
      const ok = TetrisSound.adoptUri(key, uri, FILES[key]);
      last = state[key] = { way: WAYS[i].name, kb: kbOf(uri),
                            state: ok ? "übernommen" : "abgewiesen" };
      if (ok) return true;
    }
    // Stand nirgends eine Quelle, bleibt es dabei; sonst hat der Vermerk Vorrang.
    if (!last) state[key] = { way: "", kb: 0, state: "nicht eingebettet" };
    return false;
  }

  /* Einmal alles durchsehen. Läuft beim Laden von selbst; die Diagnose darf es
     wiederholen. */
  function read() {
    let n = 0;
    for (const key in FILES) if (takeOne(key)) n++;
    note = n === 4 ? "alle vier Aufnahmen übernommen"
      : n ? n + " von 4 Aufnahmen übernommen"
      : "keine Aufnahme eingebettet";
    return report();
  }

  // Nur Ablesen, kein Eingriff — für die Ton-Diagnose.
  function report() {
    return { note: note, files: FILES, found: state };
  }

  /* Gelesen wird, sobald das Dokument steht: Vorher gibt es weder die Elemente noch
     die Stilregel. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", read);
  } else {
    read();
  }

  return { read: read, report: report };
})();
