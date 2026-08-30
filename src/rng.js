/* Der Zufall des Spiels: der 35er-Vorrat aus Tetris The Grand Master 3.
   Er besteht aus vier Teilen:
   1. einem 16-Bit-Schieberegister (LFSR) als Zufallsquelle — es hängt am Merkwort,
      damit dasselbe Wort dieselbe Steinfolge spielt,
   2. einem Vorrat von 35 Steinen (fünf je Sorte), aus dem gezogen wird,
   3. einem Gedächtnis der letzten vier Steine, gegen das bis zu sechsmal neu
      gewürfelt wird,
   4. einer Durstliste: Wer am längsten nicht kam, steht vorn und rückt bei jedem
      Zug in den frei gewordenen Platz des Vorrats nach. Das gleicht die Verteilung
      über die Zeit aus, ohne sie starr zu machen. */
const TetrisRng = (function () {
  // Reihenfolge der Steinsorten; ihr Platz darin ist zugleich ihre Kennziffer 0..6.
  const ORDER = ["T", "J", "Z", "O", "S", "L", "I"];
  const POOL = 35;    // fünf Steine je Sorte
  const COPIES = 5;
  const MEMORY = 4;   // so viele zuletzt gezogene Steine bleiben im Gedächtnis
  const ROLLS = 6;    // so oft darf gegen das Gedächtnis neu gewürfelt werden

  /* Das Gedächtnis startet mit S, Z, S, O. Damit sind beim allerersten Zug genau
     die drei Sorten gesperrt, mit denen sich schlecht anfangen lässt — das Spiel
     beginnt fast immer mit I, J, L oder T. */
  const START_MEMORY = [4, 2, 4, 3];

  function fullPool() {
    const p = [];
    for (let n = 0; n < COPIES; n++) {
      for (let i = 0; i < 7; i++) p.push(i);
    }
    return p;
  }

  function create(seed) {
    let reg = (seed | 0) & 0xffff;
    if (reg === 0) reg = 0x8988; // 0 wäre ein totes Register
    let pool = fullPool();
    let memory = START_MEMORY.slice();
    let drought = [0, 1, 2, 3, 4, 5, 6]; // vorn steht, wer am längsten aussetzt
    let cached = null;                   // der nach außen gereichte Zustand

    /* Ein Schritt des Schieberegisters: Bit 1 und Bit 9 werden verknüpft,
       das Ergebnis wandert oben wieder hinein. */
    function step() {
      const bit = ((reg >> 1) ^ (reg >> 9)) & 1;
      reg = ((reg >> 1) | (bit << 15)) & 0xffff;
    }

    /* Ein Zufallsbyte. Acht Schritte, damit zwei Bytes nacheinander nicht sieben
       ihrer acht Bits teilen — beide Hälften des Registers werden verschränkt. */
    function nextByte() {
      for (let i = 0; i < 8; i++) step();
      return ((reg >> 8) ^ reg) & 0xff;
    }

    /* Ein Platz im Vorrat, 0..34. 245 ist sieben mal fünfunddreißig: Alles darüber
       wird verworfen statt umgebogen, sonst wären die vorderen Plätze häufiger. */
    function nextSlot() {
      let b = nextByte();
      for (let guard = 0; b >= 245 && guard < 32; guard++) b = nextByte();
      return b % POOL;
    }

    /* Ein Zug: Bis zu sechsmal einen Platz greifen. Steht dort ein Stein, der noch
       im Gedächtnis liegt, bekommt dieser Platz sofort den durstigsten Stein und es
       wird neu gewürfelt; der letzte Wurf gilt in jedem Fall. Danach rückt in den
       geleerten Platz der durstigste Stein nach, und der gezogene wandert ans Ende
       der Durstliste. */
    function nextPiece() {
      let slot = 0;
      let piece = 0;
      for (let roll = 0; roll < ROLLS; roll++) {
        slot = nextSlot();
        piece = pool[slot];
        if (memory.indexOf(piece) < 0) break;
        if (roll < ROLLS - 1) pool[slot] = drought[0];
      }
      pool[slot] = drought[0];
      const d = drought.indexOf(piece);
      if (d >= 0) drought.splice(d, 1);
      drought.push(piece);
      memory.push(piece);
      while (memory.length > MEMORY) memory.shift();
      cached = null;
      return ORDER[piece];
    }

    /* Der ganze innere Zustand — damit eine Aufzeichnung ihn festhalten und ein
       späterer Wiedereinstieg ihn zurücksetzen kann. Die Listen werden zu
       Ziffernketten, weil jede Kennziffer einstellig ist; das Ergebnis wird
       aufgehoben und erst beim nächsten Zug erneuert. Die Aufzeichnung hält damit
       für alle Bilder zwischen zwei Steinen dasselbe Stück im Speicher, statt es
       sechzigmal in der Sekunde nachzubauen. */
    function getState() {
      if (!cached) {
        cached = {
          reg: reg,
          pool: pool.join(""),
          memory: memory.join(""),
          drought: drought.join("")
        };
      }
      return cached;
    }

    /* Was aus einer Datei kommt, ist fremd: Jede Liste darf als Ziffernkette oder
       als Zahlenreihe ankommen, und was nicht taugt, wird durch den Anfangszustand
       ersetzt. Ein altes Band ohne Vorrat läuft so weiter — der Zufall fängt darin
       lediglich von vorn an. */
    function setState(s) {
      if (!s) return;
      reg = (s.reg | 0) & 0xffff;
      if (reg === 0) reg = 0x8988;
      pool = toList(s.pool, POOL) || fullPool();
      memory = toList(s.memory, MEMORY) || START_MEMORY.slice();
      const d = toList(s.drought, 7);
      drought = d && complete(d) ? d : [0, 1, 2, 3, 4, 5, 6];
      cached = null;
    }

    return { nextPiece, getState, setState };
  }

  /* Eine Liste von n Kennziffern — aus einer Ziffernkette oder aus einer
     Zahlenreihe. Alles andere ergibt null. */
  function toList(v, n) {
    let a = v;
    if (typeof v === "string") {
      if (v.length !== n) return null;
      a = [];
      for (let i = 0; i < n; i++) a.push(v.charCodeAt(i) - 48);
    }
    if (!Array.isArray(a) || a.length !== n) return null;
    return a.every((x) => Number.isInteger(x) && x >= 0 && x < 7) ? a.slice() : null;
  }

  // Enthält die Durstliste jede Sorte genau einmal?
  function complete(a) {
    const seen = [];
    return a.every((v) => (seen[v] ? false : (seen[v] = true)));
  }

  // Ein Zufall, der genau dort weitermacht, wo ein gesicherter Zustand aufhörte.
  function restore(s) {
    const r = create(s && s.reg);
    r.setState(s);
    return r;
  }

  return { create, restore, POOL, MEMORY, ORDER };
})();
