/* Der Bass des musikalischen Endlosspiels: eine Figur, die den stehenden Akkord
   ausschreitet, statt ihn auszuhalten.

   Das Pad (pad.js) hält die Oberstimmen; hier unten läuft der Puls. Die Figur
   sind die Töne desselben Akkords im Bassbereich — Grundton, Terz, Quinte, dazu
   der Grundton eine Oktave höher —, einer nach dem anderen in gleichbleibendem
   Schritt. Wechselt der Akkord, wechseln die Töne; der Puls läuft durch, denn
   er ist das, was die Partie trägt.

   Die RICHTUNG gehört dem Anwender: Jede gelungene Drehung eines Steins kehrt
   sie um. Die Figur läuft dann von der Stelle, an der sie gerade steht, wieder
   zurück — hoch, runter, hoch, je nachdem, wie oft gedreht wurde.

   Gelegt werden die Töne im Voraus auf die Uhr der Tonmaschine, nicht auf die
   des Bildtakts: Ein Zeitgeber des Fensters ist zu ungenau für einen Puls und
   würde bei jeder Verzögerung stolpern. Ein Zeitgeber weckt hier nur alle paar
   Hundertstel den Vorratsleger.

   Weil dieser Vorratsleger die einzige Uhr der Musik ist, hängt auch das
   Schlagzeug (drums.js) an ihm: Jeder Schritt, der hier einen Ton legt, legt
   dort seinen Schlag. Der Schritt zählt dabei stur vorwärts, gleich wohin die
   Figur gerade läuft — eine Drehung wendet den Bass, nicht den Takt.

   Was hier steht, klingt nur — es kennt weder Spiel noch Tonart. */
const TetrisArp = (function () {
  const STEP = 0.26;   // Sekunden je Schritt — ein ruhiger, gehender Puls
  const AHEAD = 0.25;  // so weit im Voraus liegen die Töne auf der Uhr
  const TICK = 50;     // so oft (ms) wird nachgelegt
  const LEVEL = 0.22;  // wie laut der Bass steht

  let ctx = null;      // die Tonmaschine, sobald ein Akkord da war
  let dest = null;     // der Regler, an dem alles hängt (die Stummschaltung)
  let root = 0;        // die Frequenz, auf die sich die Halbtöne beziehen
  let figure = [];     // die Töne der Figur, aufsteigend (Halbtöne über root)
  let dir = 1;         // 1 = aufwärts, -1 = abwärts
  let pos = 0;         // wo die Figur gerade steht
  let at = 0;          // Zeit des nächsten Schritts auf der Uhr der Tonmaschine
  let beat = 0;        // der wievielte Schritt seit dem Beginn — der Takt des Schlagzeugs
  let timer = null;    // der Wecker des Vorratslegers
  let live = [];       // was gerade klingt — damit ein Anhalten es noch erwischt

  /* Die Töne der Figur aus dem Dreiklang: der Grundton in die tiefe Oktave
     gelegt (wie beim gehaltenen Bass zuvor), darüber Terz und Quinte im
     nächstliegenden Abstand, oben der Grundton wieder. */
  function figureOf(semis) {
    const pcs = [];
    for (let i = 0; i < semis.length; i++) pcs.push(((semis[i] % 12) + 12) % 12);
    const base = pcs[0] - 12;
    const fig = [base];
    for (let i = 1; i < pcs.length; i++) {
      let n = pcs[i] - 12;
      while (n <= fig[fig.length - 1]) n += 12;
      fig.push(n);
    }
    fig.push(base + 12);
    return fig;
  }

  /* Ein Ton der Figur: ein Dreieck durch ein Filter, das mit ihm zufällt —
     das gibt den weichen Anschlag eines gezupften Basses statt eines Piepsens.
     Gelegt wird er auf die Zeit t, nicht auf jetzt. */
  function note(semi, t) {
    const freq = root * Math.pow(2, semi / 12);
    let osc, gain, filt;
    try {
      osc = ctx.createOscillator();
      gain = ctx.createGain();
      filt = ctx.createBiquadFilter();
    } catch (e) { return; }
    filt.type = "lowpass";
    filt.Q.value = 0.9;
    filt.frequency.setValueAtTime(Math.max(400, freq * 5), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(220, freq * 1.8), t + STEP * 0.8);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(LEVEL, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + STEP * 0.92);
    osc.connect(filt);
    filt.connect(gain);
    gain.connect(dest);
    try { osc.start(t); osc.stop(t + STEP); } catch (e) { return; }
    const v = { osc: osc, gain: gain };
    live.push(v);
    osc.onended = function () {
      const k = live.indexOf(v);
      if (k >= 0) live.splice(k, 1);
      try { gain.disconnect(); } catch (e) {}
    };
  }

  /* Der Vorratsleger: alles, was in den nächsten AHEAD Sekunden fällig wird,
     kommt jetzt auf die Uhr. Ist die Uhr davongelaufen (das Fenster stand
     still), schließt der Puls wieder auf, statt die verpassten Schritte
     nachzuholen. */
  function pump() {
    if (!ctx || !figure.length) return;
    const until = ctx.currentTime + AHEAD;
    let guard = 0;
    while (at < until && guard++ < 16) {
      if (at < ctx.currentTime) at = ctx.currentTime + 0.01;
      if (pos >= figure.length || pos < 0) pos = 0;
      note(figure[pos], at);
      drums("step", ctx, dest, beat, at); // derselbe Schritt schlägt auch das Fell
      beat++;
      pos = (pos + dir + figure.length) % figure.length;
      at += STEP;
    }
  }

  /* Das Schlagzeug liegt in drums.js — hier steht nur der eine Weg dorthin.
     Fehlt es, läuft der Bass eben allein. */
  function drums(fn, a, b, c, d) {
    if (typeof TetrisDrums === "undefined" || !TetrisDrums[fn]) return null;
    return TetrisDrums[fn](a, b, c, d);
  }

  /* Ein neuer Akkord: dieselbe Figur, andere Töne. Der Puls beginnt mit dem
     ersten Akkord und läuft danach durch — ein Neuansetzen bei jedem Wechsel
     wäre der Absatz, den es hier gerade nicht geben soll. */
  function set(c, d, rootHz, semis) {
    if (!c || !d) return;
    const fresh = !timer || ctx !== c;
    ctx = c;
    dest = d;
    root = rootHz;
    figure = figureOf(semis);
    if (fresh) {
      pos = dir > 0 ? 0 : figure.length - 1;
      beat = 0; // das Muster beginnt mit der Partie auf der Eins
      at = ctx.currentTime + 0.03;
      if (timer) clearInterval(timer);
      timer = setInterval(pump, TICK);
    }
    pump(); // der erste Schritt soll mit dem Akkord kommen, nicht erst beim Wecken
  }

  /* Die Drehung des Steins kehrt die Figur um. Sie springt dabei nicht an den
     Anfang zurück, sondern läuft von hier aus zurück — man hört die Wendung,
     nicht einen Neuanfang. */
  function turn() {
    if (!figure.length) { dir = -dir; return dir; }
    dir = -dir;
    // Zwei Schritte zurück, damit der nächste Ton nicht der eben gehörte ist.
    pos = (pos + 2 * dir + 2 * figure.length) % figure.length;
    return dir;
  }

  // Alles verstummt: der Puls hört auf, und was schon auf der Uhr liegt, wird kurz.
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    drums("stop"); // das Schlagzeug hört mit dem Puls auf, den es teilt
    figure = [];
    dir = 1;
    pos = 0;
    beat = 0;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = live.length - 1; i >= 0; i--) {
      const v = live[i];
      try {
        if (v.gain.gain.cancelAndHoldAtTime) v.gain.gain.cancelAndHoldAtTime(t);
        else v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), t);
        v.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        v.osc.stop(t + 0.08);
      } catch (e) {}
    }
  }

  // Für die Anzeige: läuft die Figur gerade aufwärts oder abwärts?
  function direction() { return dir; }

  return {
    set: set,
    turn: turn,
    stop: stop,
    direction: direction
  };
})();
