/* Die vier Aufnahmen aus dem Ordner assets — auf dem Weg ins Spiel.

   Die Dateien liegen als Beigaben neben der App. Wo ihr Pfad im Markup steht,
   setzt das Bündeln ihre data:-Quelle ein; die App selbst kann sie nicht laden,
   denn Pfade führen im Fensterrahmen nirgendwohin. Alles hängt also daran, dass
   das Bündeln die Stelle erkennt, an der der Pfad steht.

   Welche Stelle das ist, ist inzwischen erwiesen: das src eines <source> im
   <audio> (index.html). Im gebauten Dokument steht dort eine data:-Quelle. Die
   beiden Ausweichwege von früher — eine Stilregel url(…) und ein verstecktes
   Bildelement — sind damit überflüssig und wieder entfernt; sie hätten jede
   Aufnahme ein zweites und drittes Mal ins Dokument gelegt.

   Diese Datei liest die Quelle ab und reicht sie mit adoptUri() an sound.js
   weiter. Was ein Pfad geblieben ist, wird übergangen.

   Sie läuft beim Laden, noch vor der Suche im Datenordner (soundfiles.js). Was
   hier ankommt, gilt: Die Beigabe ist die Aufnahme, die der Anwender gemeint hat —
   eine ältere Fassung im Datenordner überschreibt sie nicht.

   Was dabei herauskam, gibt report() preis — die Ton-Diagnose (Taste T) zeigt es.
   Trägt der Weg nicht, bleibt alles wie zuvor: Die App sucht im Datenordner
   weiter und klingt notfalls mit ihren eigenen Tönen. */
const TetrisSoundAssets = (function () {
  // Klang -> Dateiname der Beigabe. Nur zum Anzeigen; gefunden wird über die Stelle.
  const FILES = {
    move: "move-and-turn-shorter.wav",
    drop: "drop-sound.mp3",
    rows: "row-completed-sound.mp3",
    tetris: "tetris-sound.mp3"
  };

  const state = {}; // key -> { way, kb, state }
  let note = "noch nicht gelesen";

  // --- Die Stelle ---

  /* Die Quelle steht am <source> im <audio>, nicht am Element selbst — das ist die
     Schreibweise, an der das Bündeln eine Beigabe erkennt. */
  function fromSource(key) {
    const el = document.querySelector("#snd-" + key + " source");
    return el ? (el.getAttribute("src") || "") : "";
  }

  // --- Übernehmen ---

  function kbOf(uri) {
    const comma = uri.indexOf(",");
    return comma < 0 ? 0 : Math.round((uri.length - comma) * 0.75 / 1024 * 10) / 10;
  }

  function takeOne(key) {
    const uri = fromSource(key);
    if (!uri || uri.slice(0, 5) !== "data:") {
      state[key] = { way: "", kb: 0, state: "nicht eingebettet" };
      return false;
    }
    const ok = TetrisSound.adoptUri(key, uri, FILES[key]);
    state[key] = { way: "Quelle im Klang", kb: kbOf(uri),
                   state: ok ? "übernommen" : "abgewiesen" };
    return ok;
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

  /* Gelesen wird, sobald das Dokument steht: Vorher gibt es die Elemente noch
     nicht. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", read);
  } else {
    read();
  }

  return { read: read, report: report };
})();
