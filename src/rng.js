/* Der Zufall des originalen NES-Tetris.
   Er besteht aus zwei Teilen:
   1. einem 16-Bit-Schieberegister (LFSR), das die Konsole als Zufallsquelle nutzt,
   2. dem Auswahlverfahren mit Wiederholungssperre und zweitem Wurf. */
const NesRng = (function () {
  // Reihenfolge der Steine, wie sie im Original in der Tabelle steht.
  const ORDER = ["T", "J", "Z", "O", "S", "L", "I"];

  function create(seed) {
    let reg = (seed | 0) & 0xffff;
    if (reg === 0) reg = 0x8988; // Startwert des Originals; 0 wäre ein totes Register
    let spawnCount = 0;          // zählt jeden gezogenen Stein, wie im Original
    let prev = null;             // zuletzt gezogener Stein

    /* Ein Schritt des Schieberegisters: Bit 1 und Bit 9 werden verknüpft,
       das Ergebnis wandert oben wieder hinein. Genutzt wird das obere Byte. */
    function nextByte() {
      const bit = ((reg >> 1) ^ (reg >> 9)) & 1;
      reg = ((reg >> 1) | (bit << 15)) & 0xffff;
      return (reg >> 8) & 0xff;
    }

    /* Erster Wurf: Zufallsbyte plus Zähler, auf 0..7 beschnitten.
       Fällt dabei die leere achte Stelle oder derselbe Stein wie zuvor,
       gibt es genau einen zweiten Wurf — verschoben gegen den letzten Stein.
       Dadurch kommen Wiederholungen seltener, aber nicht nie vor. */
    function nextPiece() {
      spawnCount = (spawnCount + 1) & 0xff;
      let index = (nextByte() + spawnCount) & 7;
      if (index === 7 || ORDER[index] === prev) {
        const prevIndex = prev === null ? 0 : ORDER.indexOf(prev);
        index = ((nextByte() & 7) + prevIndex) % 7;
      }
      prev = ORDER[index];
      return prev;
    }

    /* Der ganze innere Zustand als einfaches Objekt — damit eine Aufzeichnung
       ihn festhalten und ein späterer Wiedereinstieg ihn zurücksetzen kann. */
    function getState() {
      return { reg: reg, spawnCount: spawnCount, prev: prev };
    }

    function setState(s) {
      reg = (s.reg | 0) & 0xffff;
      if (reg === 0) reg = 0x8988;
      spawnCount = s.spawnCount | 0;
      prev = s.prev === undefined ? null : s.prev;
    }

    return { nextPiece, nextByte, getState, setState };
  }

  // Ein Register, das genau dort weitermacht, wo ein gesicherter Zustand aufhörte.
  function restore(s) {
    const r = create(s.reg);
    r.setState(s);
    return r;
  }

  return { create, restore, ORDER };
})();
