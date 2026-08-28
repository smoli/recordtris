/* Die Bestenliste: gespielte Partien als JSON-Datei im Datenordner.
   Jede beendete Partie wird als ein Eintrag festgehalten — mit Zeitpunkt, Punkten,
   Reihen, den Reihenschlägen 1 bis 4 und der Steinstatistik. Klassische Partien
   werden nach dem Merkwort gruppiert, denn es bestimmt die Steinfolge: dieselbe
   Partie, mehrfach gespielt. Endlospartien nach ihrem festen Level, und sie zählen
   nicht die Punkte, sondern die durchgehaltene Zeit.
   Fehlt der Datenordner, lebt die Liste nur in dieser Sitzung weiter. */
const TetrisScores = (function () {
  const FILE = "tetris-highscores.json";
  const VERSION = 1;

  function empty() {
    return { version: VERSION, entries: [], storage: "unknown" };
  }

  // Was aus der Datei kommt, ist fremder Text: alles Fragwürdige fliegt raus.
  function cleanEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const seed = TetrisSeed.sanitizeInput(raw.seed);
    if (!seed) return null;
    const clears = [0, 0, 0, 0];
    if (Array.isArray(raw.clears)) {
      for (let i = 0; i < 4; i++) clears[i] = num(raw.clears[i]);
    }
    const pieces = {};
    TetrisPieces.TYPES.forEach((t) => {
      pieces[t] = raw.pieces && typeof raw.pieces === "object" ? num(raw.pieces[t]) : 0;
    });
    return {
      seed: seed,
      // Ältere Dateien kennen die Spielart noch nicht — sie sind klassisch.
      mode: raw.mode === TetrisEngine.FOREVER ? TetrisEngine.FOREVER : TetrisEngine.CLASSIC,
      date: typeof raw.date === "string" ? raw.date : "",
      score: num(raw.score),
      lines: num(raw.lines),
      level: num(raw.level),
      startLevel: num(raw.startLevel),
      duration: num(raw.duration),
      clears: clears,
      pieces: pieces,
      resumed: !!raw.resumed
    };
  }

  function num(v) {
    const n = Number(v);
    return isFinite(n) && n >= 0 ? Math.round(n) : 0;
  }

  // Aus einem beendeten Spiel wird ein Eintrag — der Zeitpunkt ist der des Speicherns.
  function entryFrom(state) {
    const pieces = {};
    TetrisPieces.TYPES.forEach((t) => { pieces[t] = state.stats[t] || 0; });
    return {
      seed: state.seedWord,
      mode: state.mode === TetrisEngine.FOREVER ? TetrisEngine.FOREVER : TetrisEngine.CLASSIC,
      date: new Date().toISOString(),
      score: state.score,
      lines: state.lines,
      level: state.level,
      startLevel: state.startLevel,
      duration: Math.round(state.elapsed),
      clears: state.clears.slice(1, 5),
      pieces: pieces,
      resumed: !!state.resumed
    };
  }

  async function load() {
    const store = empty();
    const fs = window.morphosFS;
    if (!fs) { store.storage = "memory"; return store; }
    try {
      if (await fs.exists(FILE)) {
        const data = JSON.parse(await fs.readFile(FILE));
        if (data && Array.isArray(data.entries)) {
          store.entries = data.entries.map(cleanEntry).filter(Boolean);
        }
      }
      store.storage = "file";
    } catch (e) {
      store.storage = "memory";
    }
    return store;
  }

  // Anhängen liefert einen neuen Behälter — der Eintrag selbst bleibt derselbe,
  // sodass die Oberfläche die eben gespielte Partie wiedererkennt.
  function add(store, entry) {
    return { version: VERSION, entries: store.entries.concat([entry]), storage: store.storage };
  }

  async function save(store) {
    const fs = window.morphosFS;
    if (!fs) return { version: VERSION, entries: store.entries, storage: "memory" };
    try {
      await fs.writeFile(FILE, JSON.stringify({ version: VERSION, entries: store.entries }, null, 1));
      return { version: VERSION, entries: store.entries, storage: "file" };
    } catch (e) {
      return { version: VERSION, entries: store.entries, storage: "memory" };
    }
  }

  /* Gruppiert wird nach dem normalisierten Wort: "Grün" und "gruen" sind dieselbe
     Steinfolge, also dieselbe Reihe der Liste. */
  function keyOf(seed) { return TetrisSeed.normalize(seed); }

  function byScore(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return String(b.date).localeCompare(String(a.date));
  }

  /* Im Endlosspiel zählt, wie lange man durchgehalten hat; bei gleicher Zeit
     entscheiden die Punkte. */
  function byDuration(a, b) {
    if (b.duration !== a.duration) return b.duration - a.duration;
    if (b.score !== a.score) return b.score - a.score;
    return String(b.date).localeCompare(String(a.date));
  }

  function isForever(e) { return e.mode === TetrisEngine.FOREVER; }

  // Eine Zeile je Merkwort: der beste Wert, wie oft gespielt, wann zuletzt.
  // Nur klassische Partien — im Endlosspiel ist nicht das Wort die Aufgabe.
  function bySeed(store) {
    const map = {};
    store.entries.forEach((e) => {
      if (isForever(e)) return;
      const k = keyOf(e.seed);
      if (!k) return;
      if (!map[k]) map[k] = { key: k, seed: k, plays: 0, entries: [], best: null, last: "" };
      const g = map[k];
      g.plays++;
      g.entries.push(e);
      if (!g.best || byScore(e, g.best) < 0) g.best = e;
      if (String(e.date) > g.last) g.last = String(e.date);
    });
    const out = Object.keys(map).map((k) => map[k]);
    out.forEach((g) => g.entries.sort(byScore));
    out.sort((a, b) => byScore(a.best, b.best));
    return out;
  }

  // Alles, was über ein einzelnes Merkwort bekannt ist — oder null.
  function summaryFor(store, seed) {
    const k = keyOf(seed);
    if (!k) return null;
    const list = store.entries.filter((e) => !isForever(e) && keyOf(e.seed) === k).sort(byScore);
    if (!list.length) return null;
    return { key: k, seed: k, plays: list.length, entries: list, best: list[0] };
  }

  /* Das Endlosspiel hat je Level seine eigene Liste: Eine Zeile je gespieltem
     Level, die längste Partie oben. Gruppiert wird nach dem festen Startlevel. */
  function byLevel(store) {
    const map = {};
    store.entries.forEach((e) => {
      if (!isForever(e)) return;
      const k = String(e.startLevel);
      if (!map[k]) map[k] = { key: k, level: e.startLevel, plays: 0, entries: [], best: null, last: "" };
      const g = map[k];
      g.plays++;
      g.entries.push(e);
      if (!g.best || byDuration(e, g.best) < 0) g.best = e;
      if (String(e.date) > g.last) g.last = String(e.date);
    });
    const out = Object.keys(map).map((k) => map[k]);
    out.forEach((g) => g.entries.sort(byDuration));
    out.sort((a, b) => a.level - b.level); // nach Level geordnet, nicht nach Bestwert
    return out;
  }

  // Alles, was über ein einzelnes Endlos-Level bekannt ist — oder null.
  function foreverSummaryFor(store, level) {
    const list = store.entries
      .filter((e) => isForever(e) && e.startLevel === level)
      .sort(byDuration);
    if (!list.length) return null;
    return { key: String(level), level: level, plays: list.length, entries: list, best: list[0] };
  }

  // "17.08.2026, 14:32" — leer, wenn der Zeitpunkt fehlt oder unlesbar ist.
  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const p = (n) => (n < 10 ? "0" + n : String(n));
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() +
           ", " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  // "3:21" — die Spieldauer in Minuten und Sekunden.
  function formatDuration(ms) {
    const secs = Math.max(0, Math.round(ms / 1000));
    const ss = secs % 60;
    return Math.floor(secs / 60) + ":" + (ss < 10 ? "0" + ss : ss);
  }

  return {
    FILE: FILE,
    empty: empty,
    entryFrom: entryFrom,
    load: load,
    add: add,
    save: save,
    bySeed: bySeed,
    byLevel: byLevel,
    summaryFor: summaryFor,
    foreverSummaryFor: foreverSummaryFor,
    formatDate: formatDate,
    formatDuration: formatDuration
  };
})();
