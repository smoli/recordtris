/* Das Merkwort, aus dem die Steinfolge entsteht.
   Ein Wort wird auf einen 16-Bit-Startwert des Schieberegisters abgebildet;
   dasselbe Wort ergibt damit immer dieselbe Folge. */
const TetrisSeed = (function () {
  const MAX_LEN = 16;

  // Bausteine für ein aussprechbares Wort — bewusst kurz und tippbar.
  const ONSETS = ["b", "d", "f", "g", "k", "l", "m", "n", "p", "r", "s", "t", "w", "z",
                  "br", "kl", "st", "tr", "fl", "gr", "sch", "kn", "sp"];
  const NUCLEI = ["a", "e", "i", "o", "u", "au", "ei", "ie", "or", "al", "im", "un"];

  /* Alles, was nicht Buchstabe oder Ziffer ist, fliegt raus; Umlaute werden
     ausgeschrieben, damit "grün" und "gruen" dieselbe Folge ergeben. */
  function normalize(word) {
    return String(word == null ? "" : word)
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, MAX_LEN);
  }

  // Was der Anwender beim Tippen sehen darf: dieselben Zeichen, aber noch roh.
  function sanitizeInput(word) {
    return String(word == null ? "" : word)
      .toLowerCase()
      .replace(/[^a-zäöüß0-9]/g, "")
      .slice(0, MAX_LEN);
  }

  /* Wort zu Startwert: FNV-1a über die Zeichen, dann auf 16 Bit gefaltet.
     Die 0 ist ein totes Register und wird durch den Startwert des Originals ersetzt. */
  function toRegister(word) {
    const s = normalize(word);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    const reg = (h ^ (h >>> 16)) & 0xffff;
    return reg === 0 ? 0x8988 : reg;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // Ein zufälliges Wort aus zwei oder drei Silben, z. B. "trakimo".
  function randomWord() {
    const syllables = 2 + Math.floor(Math.random() * 2);
    let out = "";
    for (let i = 0; i < syllables; i++) out += pick(ONSETS) + pick(NUCLEI);
    return out.slice(0, MAX_LEN);
  }

  return {
    MAX_LEN: MAX_LEN,
    normalize: normalize,
    sanitizeInput: sanitizeInput,
    toRegister: toRegister,
    randomWord: randomWord
  };
})();
