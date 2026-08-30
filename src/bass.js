/* Der Bass des musikalischen Endlosspiels: EIN Ton, und der Anwender spielt ihn.

   Das Pad (pad.js) hält die Oberstimmen; hier unten steht der Grund. Es ist
   genau eine Stimme, und sie klingt durch — sie schreitet den Akkord nicht mehr
   aus, sondern bleibt auf dem Ton stehen, auf den der Anwender sie gestellt hat.

   Was der Anwender damit in der Hand hat:
     ein neuer Stein  → derselbe Platz, aber die Töne des neuen Akkords
     eine Drehung     → ein Sprung über zwei Sprossen, also ebenfalls ein
                        anderer Ton desselben Akkords
     links / rechts   → eine Sprosse tiefer / höher, also ein anderer Ton
                        desselben Akkords

   Die Sprossen sind die Töne des Dreiklangs im Bassbereich, aufsteigend:
   Grundton, Terz, Quinte, Grundton eine Oktave höher. An den Enden der Leiter
   bleibt der Schritt zur Seite stehen und wiederholt nur den Ton; der Sprung
   der Drehung läuft dagegen oben um und beginnt wieder unten.

   Es klingt EINE Stimme, die durchläuft, statt für jeden Anschlag eine neue:
   So gibt es beim Wechsel weder ein Knacken noch eine Lücke, und die Tonhöhe
   kann auch ohne neuen Anschlag nachrücken. Denn eine gehaltene Taste wiederholt
   sich zwanzigmal in der Sekunde — so eng angeschlagen wäre der Bass ein
   Maschinengewehr. Liegen zwei Züge dichter beieinander als MIN_GAP, rückt daher
   nur noch die Tonhöhe nach, ohne neuen Anschlag.

   Der Puls des Schlagzeugs liegt nicht mehr hier: Seit der Bass keine Figur mehr
   ausschreitet, hat er keine eigene Uhr, und drums.js führt seine selbst.

   Was hier steht, klingt nur — es kennt weder Spiel noch Tonart. */
const TetrisBass = (function () {
  const LEVEL = 0.26;    // wie laut der Bass im Anschlag steht
  const SUSTAIN = 0.6;   // auf diesen Anteil sinkt er danach und bleibt stehen
  const MIN_GAP = 0.11;  // so dicht dürfen zwei Anschläge frühestens stehen
  const DIP = 0.012;     // die kurze Senke vor dem Anschlag — sie macht ihn hörbar
  const LEAP = 2;        // um so viele Sprossen springt die Drehung (mit Umlauf)

  const NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

  let ctx = null;    // die Tonmaschine, sobald ein Akkord da war
  let dest = null;   // der Regler, an dem alles hängt (die Stummschaltung)
  let root = 0;      // die Frequenz, auf die sich die Halbtöne beziehen
  let rungs = [];    // die Sprossen: Halbtöne über root, aufsteigend
  let pos = 0;       // auf welcher Sprosse der Ton gerade steht
  let voice = null;  // die eine Stimme
  let last = -1;     // wann zuletzt angeschlagen wurde (Uhr der Tonmaschine)

  /* Die Sprossen aus dem Dreiklang: der Grundton in die tiefe Oktave gelegt,
     darüber Terz und Quinte im nächstliegenden Abstand, oben der Grundton
     wieder. */
  function rungsOf(semis) {
    const pcs = [];
    for (let i = 0; i < semis.length; i++) pcs.push(((semis[i] % 12) + 12) % 12);
    const base = pcs[0] - 12;
    const out = [base];
    for (let i = 1; i < pcs.length; i++) {
      let n = pcs[i] - 12;
      while (n <= out[out.length - 1]) n += 12;
      out.push(n);
    }
    out.push(base + 12);
    return out;
  }

  function freqOf(semi) { return root * Math.pow(2, semi / 12); }

  /* Die Stimme: ein Dreieck durch ein Filter. Sie entsteht einmal und läuft,
     bis alles verstummt — Anschlag und Tonhöhe sind Bewegungen an ihr. */
  function ensure() {
    if (voice && voice.ctx === ctx && voice.dest === dest) return voice;
    release(true);
    let osc, filt, gain;
    try {
      osc = ctx.createOscillator();
      filt = ctx.createBiquadFilter();
      gain = ctx.createGain();
    } catch (e) { return null; }
    filt.type = "lowpass";
    filt.Q.value = 0.9;
    filt.frequency.value = 600;
    osc.type = "triangle";
    osc.frequency.value = freqOf(rungs.length ? rungs[pos] : 0);
    gain.gain.value = 0.0001;
    osc.connect(filt);
    filt.connect(gain);
    gain.connect(dest);
    try { osc.start(); } catch (e) { return null; }
    voice = { ctx: ctx, dest: dest, osc: osc, filt: filt, gain: gain };
    return voice;
  }

  /* Den Ton der aktuellen Sprosse hören lassen. Steht der letzte Anschlag noch
     keine MIN_GAP zurück, rückt allein die Tonhöhe nach: Der Bass wandert dann
     mit dem gehaltenen Zug, statt zu hämmern. */
  function play() {
    if (!ctx || !dest || !rungs.length) return;
    const v = ensure();
    if (!v) return;
    const t = ctx.currentTime + 0.005;
    const freq = freqOf(rungs[pos]);
    if (last >= 0 && t - last < MIN_GAP) {
      try {
        const p = v.osc.frequency;
        p.cancelScheduledValues(t);
        p.setValueAtTime(p.value, t);
        p.linearRampToValueAtTime(freq, t + 0.04);
      } catch (e) {}
      return;
    }
    try {
      const g = v.gain.gain;
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
      else g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.exponentialRampToValueAtTime(0.0001, t + DIP);
      g.exponentialRampToValueAtTime(LEVEL, t + DIP + 0.02);
      g.exponentialRampToValueAtTime(Math.max(0.0001, LEVEL * SUSTAIN), t + 0.5);
      // Die Tonhöhe wechselt in der Senke — dort hört man den Sprung nicht.
      const p = v.osc.frequency;
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
      p.setValueAtTime(freq, t + DIP);
      // Das Filter geht mit dem Anschlag auf und fällt wieder zu: der Zupf.
      const f = v.filt.frequency;
      if (f.cancelAndHoldAtTime) f.cancelAndHoldAtTime(t);
      else f.cancelScheduledValues(t);
      f.setValueAtTime(Math.max(80, f.value), t);
      f.setValueAtTime(Math.max(400, freq * 7), t + DIP);
      f.exponentialRampToValueAtTime(Math.max(220, freq * 2.2), t + 0.45);
    } catch (e) {}
    last = t;
  }

  /* Ein neuer Akkord: dieselbe Sprosse, andere Töne. So bleibt die Linie, die
     der Anwender gespielt hat, über den Akkordwechsel hinweg erhalten. */
  function set(c, d, rootHz, semis) {
    if (!c || !d) return;
    ctx = c;
    dest = d;
    root = rootHz;
    rungs = rungsOf(semis);
    if (pos >= rungs.length) pos = rungs.length - 1;
    if (pos < 0) pos = 0;
    play();
  }

  /* Die Drehung des Steins sucht sich ebenfalls einen anderen Ton, aber im
     Sprung: zwei Sprossen weiter, und über das obere Ende der Leiter hinaus
     wieder von unten. So klingt sie hörbar anders als der Schritt zur Seite
     und trifft doch immer einen Ton des Akkords. */
  function turn() {
    if (!rungs.length) return pos;
    pos = (pos + LEAP) % rungs.length;
    play();
    return pos;
  }

  /* Der Zug zur Seite sucht einen anderen Ton desselben Akkords: nach links
     eine Sprosse tiefer, nach rechts eine höher. Am Ende der Leiter bleibt der
     Ton stehen und wird wiederholt. */
  function shift(dx) {
    if (!rungs.length) return pos;
    const next = pos + (dx > 0 ? 1 : -1);
    if (next >= 0 && next < rungs.length) pos = next;
    play();
    return pos;
  }

  /* Die Stimme abbauen: leiser werden, dann verstummen. quick ist der Fall,
     dass sofort eine neue an ihre Stelle tritt. */
  function release(quick) {
    const v = voice;
    voice = null;
    if (!v) return;
    try {
      const t = v.ctx.currentTime;
      const g = v.gain.gain;
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
      else g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.exponentialRampToValueAtTime(0.0001, t + (quick ? 0.02 : 0.08));
      v.osc.stop(t + (quick ? 0.05 : 0.12));
      v.osc.onended = function () { try { v.gain.disconnect(); } catch (e) {} };
    } catch (e) {}
  }

  // Alles verstummt: beim Pausieren, beim Spielende, beim Verlassen der Partie.
  function stop() {
    rungs = [];
    pos = 0;
    last = -1;
    release(false);
  }

  /* Für die Anzeige: der Name des stehenden Tons samt Oktave. Gerechnet wird er
     aus der Frequenz, damit dieses Modul die Tonart weiterhin nicht kennen
     muss. */
  function label() {
    if (!rungs.length || !root) return "";
    const freq = freqOf(rungs[pos]);
    const midi = Math.round(69 + 12 * Math.log(freq / 440) / Math.LN2);
    return NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  }

  // Für die Anzeige: die wievielte Sprosse von wie vielen.
  function rung() { return { pos: pos, count: rungs.length }; }

  return {
    set: set,
    turn: turn,
    shift: shift,
    stop: stop,
    label: label,
    rung: rung
  };
})();
