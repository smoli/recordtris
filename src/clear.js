/* Der Klang der gefallenen Reihen im musikalischen Endlosspiel.

   Vorher wirbelte an dieser Stelle das Schlagzeug: Für ein paar Schritte trat
   ein Wirbel an die Stelle des Musters. Er saß zwischen den Schlägen statt auf
   ihnen und riss damit gerade das ein, was der Puls zusammenhält — das Muster
   verlor seinen Platz, und der Wirbel selbst klang wie ein Stolpern. Also gibt
   es ihn nicht mehr.

   An seiner Stelle steht ein eigener Klang ÜBER der Musik, der das Muster gar
   nicht erst anrührt: eine kurze Glockenfigur aus den Tönen des laufenden
   Akkords, aufsteigend, weit oben — dort, wo weder Bass noch Pad stehen. Wie
   viele Töne sie hat, sagt die Zahl der Reihen; beim Tetris kommt ein tiefer
   Ton als Grund darunter.

   Und sie liegt auf dem Puls: Der erste Ton wartet auf den nächsten Schritt
   des Schlagzeugs, die weiteren folgen im Abstand einer Sechzehntel. Damit ist
   die Figur immer im Takt, egal wann die Reihe fällt. Anders als beim Bass ist
   das kein Schalter des Anwenders — hier spielt niemand eine Taste, deren
   Verzögerung zu spüren wäre.

   Was hier steht, klingt nur — es kennt weder Spiel noch Tonart. */
const TetrisClear = (function () {
  const LEVEL = 0.09;    // wie laut die Figur insgesamt steht — hoch oben trägt wenig weit
  const DECAY = 1.1;     // so lange klingt ein Ton aus
  const TOP = 24;        // die Figur beginnt zwei Oktaven über dem Grundton der Tonart
  const DIV = 1;         // der erste Ton auf den Schritt des Pulses selbst (Achtel)

  /* Wie viele Töne die Figur je Zahl gefallener Reihen hat. Der Index ist die
     Zahl der Reihen; vier Reihen bekommen die längste Figur. */
  const NOTES = [0, 2, 3, 4, 6];

  let ctxRef = null;  // die Tonmaschine, sobald ein Akkord da war
  let destRef = null; // der Regler, an dem alles hängt (die Stummschaltung)
  let root = 0;       // die Frequenz, auf die sich die Halbtöne beziehen
  let pcs = [];       // die Töne des laufenden Akkords als Tonklassen (0–11)
  let live = [];      // was gerade klingt — damit ein Anhalten es noch erwischt

  /* Der Akkord, den die Figur ausspielt. Sie nimmt ihn vom Pad entgegen, damit
     dieses Modul die Tonart nicht kennen muss. */
  function set(c, d, rootHz, semis) {
    if (!c || !d) return;
    ctxRef = c;
    destRef = d;
    root = rootHz;
    const out = [];
    for (let i = 0; i < semis.length; i++) out.push(((semis[i] % 12) + 12) % 12);
    pcs = out;
  }

  /* Die Leiter der Figur: die Töne des Akkords, aufsteigend ab TOP und über die
     Oktave hinaus weiterlaufend, damit auch die lange Figur nur steigt. */
  function ladder(n) {
    const out = [];
    if (!pcs.length) return out;
    let prev = -Infinity;
    for (let i = 0; i < n; i++) {
      let s = pcs[i % pcs.length] + TOP;
      while (s <= prev) s += 12;
      out.push(s);
      prev = s;
    }
    return out;
  }

  function freqOf(semi) { return root * Math.pow(2, semi / 12); }

  /* Buchführung: Was klingt, steht in der Liste, bis es von selbst endet — nur
     so kann stop() es vorzeitig kurzmachen. */
  function track(node, gain) {
    const v = { node: node, gain: gain };
    live.push(v);
    node.onended = function () {
      const k = live.indexOf(v);
      if (k >= 0) live.splice(k, 1);
      try { gain.disconnect(); } catch (e) {}
    };
  }

  /* Ein Ton der Figur: ein Sinus mit einem leisen Oberton knapp daneben — das
     ergibt das leichte Schlagen einer Glocke. Anschlag hart, Ausklingen lang. */
  function bell(ctx, dest, t, freq, level, dur) {
    const parts = [{ mul: 1, amp: 1 }, { mul: 2.01, amp: 0.32 }];
    for (let i = 0; i < parts.length; i++) {
      let osc, g;
      try {
        osc = ctx.createOscillator();
        g = ctx.createGain();
      } catch (e) { return; }
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * parts[i].mul, t);
      const peak = Math.max(0.0002, level * parts[i].amp);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(dest);
      try { osc.start(t); osc.stop(t + dur + 0.05); } catch (e) { return; }
      track(osc, g);
    }
  }

  /* Der Grund unter dem Tetris: der Grundton des Akkords eine Oktave unter der
     Figur, weich und kurz — er macht die vier Reihen schwerer als die eine. */
  function thud(ctx, dest, t, freq) {
    let osc, g, filt;
    try {
      osc = ctx.createOscillator();
      filt = ctx.createBiquadFilter();
      g = ctx.createGain();
    } catch (e) { return; }
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    filt.type = "lowpass";
    filt.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(LEVEL * 1.1, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(filt);
    filt.connect(g);
    g.connect(dest);
    try { osc.start(t); osc.stop(t + 0.75); } catch (e) { return; }
    track(osc, g);
  }

  /* Der Puls kommt vom Schlagzeug — dort liegt die einzige Uhr der Musik. Der
     erste Ton wartet auf den nächsten Schritt; läuft kein Puls, klingt er
     sofort. Der Abstand der weiteren Töne ist eine Sechzehntel, also die halbe
     Länge eines Schrittes. */
  function drums(fn, a, b) {
    if (typeof TetrisDrums === "undefined" || !TetrisDrums[fn]) return null;
    return TetrisDrums[fn](a, b);
  }

  function onBeat(t) {
    const g = drums("grid", t, DIV);
    return g > t ? g : t;
  }

  function span() {
    const s = drums("stepDur");
    return (s > 0 ? s : 0.26) / 2;
  }

  /* Die Figur der gefallenen Reihen. Sie tritt an die Stelle des Geräuschs, das
     in der musikalischen Partie schweigt, und legt sich über das laufende
     Muster, ohne es anzurühren. */
  function burst(rows) {
    if (!ctxRef || !destRef || !pcs.length) return;
    const n = NOTES[Math.max(0, Math.min(NOTES.length - 1, rows | 0))];
    if (!n) return;
    const t0 = onBeat(ctxRef.currentTime + 0.02);
    const gap = span();
    const notes = ladder(n);
    for (let i = 0; i < notes.length; i++) {
      const t = t0 + i * gap;
      // Die Figur wird nach oben hin leiser, der letzte Ton klingt am längsten.
      const level = LEVEL * (1 - 0.07 * i);
      const dur = i === notes.length - 1 ? DECAY * 1.8 : DECAY;
      bell(ctxRef, destRef, t, freqOf(notes[i]), level, dur);
    }
    if ((rows | 0) >= 4) thud(ctxRef, destRef, t0, freqOf(pcs[0] + TOP - 12));
  }

  // Alles verstummt: beim Pausieren, beim Spielende, beim Verlassen der Partie.
  function stop() {
    pcs = [];
    for (let i = live.length - 1; i >= 0; i--) {
      const v = live[i];
      try {
        const t = v.gain.context ? v.gain.context.currentTime : 0;
        if (v.gain.gain.cancelAndHoldAtTime) v.gain.gain.cancelAndHoldAtTime(t);
        else v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), t);
        v.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        v.node.stop(t + 0.09);
      } catch (e) {}
    }
  }

  return {
    set: set,
    burst: burst,
    stop: stop
  };
})();
