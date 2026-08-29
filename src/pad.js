/* Das Klangbett des Endlosspiels: Jeder Stein ist eine Stufe der Tonart.

   Erscheint ein Stein, klingt sein Akkord als weiches Pad — es bleibt stehen,
   bis der nächste Stein kommt, und wird dann abgelöst (der alte klingt aus,
   während der neue anschwillt). Die Steinfolge des Zufallsregisters wird damit
   zu einer Akkordfolge; wer dasselbe Merkwort spielt, hört dieselbe Musik.

   Die Zuordnung ist fest und stammt vom Anwender:
     I → I,  S → IV,  O → II,  Z → III,  T → V,  J → VI,  L → VII.
   Die Tonart ist F-Dur; die Stufen sind ihre Dreiklänge, dazu ein Bass eine
   Oktave unter dem Grundton.

   Der Übergang von einer Farbe zur nächsten ist die eigentliche Arbeit hier.
   Zwei Dinge machen ihn weich: eine gleichleistungs-Blende (die eine Farbe geht
   mit sin, die andere mit cos — zusammen bleibt die Lautstärke konstant, statt
   in der Mitte einzubrechen) und eine Stimmführung, die jeden Ton in die Oktave
   legt, die dem vorigen Akkord am nächsten liegt.

   Geklungen wird über die Tonmaschine von sound.js — dieselbe, die auch die
   Aufnahmen entpackt. Das Pad hängt an deren Regler und ist damit von der
   Stummschaltung (Taste S) mit erfasst, ohne dass es davon wissen muss.

   Ausgelöst wird es dort, wo sein Anlass entsteht: in engine.js beim Erscheinen
   eines Steins. Was hier steht, klingt nur — es kennt das Spiel nicht. */
const TetrisPad = (function () {
  const KEY_NAME = "F-Dur";
  const ROOT = 174.6141; // F3 — der Grundton der Tonart

  /* Je Steinsorte die Stufe: ihr Name, ihr Zeichen und die Halbtonschritte des
     Dreiklangs über dem Grundton der Tonart (F=0, G=2, A=4, B♭=5, C=7, D=9, E=11).
     Notiert ist die Grundstellung; welche Oktave jeder Ton beim Klingen bekommt,
     entscheidet die Stimmführung in voicing() vom vorigen Akkord her. */
  const CHORDS = {
    I: { deg: "I",   name: "F-Dur",       semis: [0, 4, 7] },
    O: { deg: "II",  name: "g-Moll",      semis: [2, 5, 9] },
    Z: { deg: "III", name: "a-Moll",      semis: [4, 7, 11] },
    S: { deg: "IV",  name: "B♭-Dur",      semis: [5, 9, 12] },
    T: { deg: "V",   name: "C-Dur",       semis: [7, 11, 14] },
    J: { deg: "VI",  name: "d-Moll",      semis: [9, 12, 16] },
    L: { deg: "VII", name: "e-vermindert", semis: [11, 14, 17] }
  };

  const LEVEL = 0.13;     // wie laut das Bett insgesamt steht
  const CROSSFADE = 0.7;  // wie lange eine Farbe in die nächste übergeht
  const CUT = 0.08;       // wie kurz ein hartes Anhalten ausklingt
  const CENTER = 9;       // um diese Lage (Halbtöne über dem Grundton) pendeln die Oberstimmen

  let voice = null;       // was gerade steht
  let voiceType = "";     // welcher Stein es ausgelöst hat
  let fading = [];        // was gerade ausklingt — damit stop() auch das erwischt
  let lastVoicing = null; // die Oberstimmen der stehenden Farbe, aufsteigend
  let drift = 0;          // wechselndes Feinstimmen, damit gehaltene Töne sich nicht auslöschen

  // Die Tonmaschine liegt bei sound.js; ohne sie bleibt das Pad einfach stumm.
  function bus() {
    if (typeof TetrisSound === "undefined" || !TetrisSound.bus) return null;
    const b = TetrisSound.bus();
    return b && b.ctx && b.master ? b : null;
  }

  /* Die Blende als Kurve statt als Rampe. Zwei gegenläufige Rampen in Dezibel
     stehen in ihrer Mitte beide sehr tief — dort reißt ein hörbares Loch auf,
     und genau das macht einen Akkordwechsel zum Absatz. sin und cos dagegen
     ergänzen sich zu einer gleichbleibenden Leistung. */
  const STEPS = 48;
  function curve(peak, rising) {
    const a = new Float32Array(STEPS);
    for (let i = 0; i < STEPS; i++) {
      const x = (i / (STEPS - 1)) * (Math.PI / 2);
      a[i] = Math.max(0.0001, peak * (rising ? Math.sin(x) : Math.cos(x)));
    }
    return a;
  }

  /* Eine Blende auf einen Regler legen. Kann er keine Kurve, wird daraus eine
     schlichte lineare Rampe — auch die ist noch weit weicher als die frühere
     Rampe in Dezibel. */
  function glide(param, ctx, peak, rising, dur) {
    const t = ctx.currentTime + 0.005;
    try {
      param.setValueCurveAtTime(curve(peak, rising), t, dur);
      return;
    } catch (e) {}
    try {
      param.setValueAtTime(rising ? 0.0001 : Math.max(0.0001, peak), t);
      param.linearRampToValueAtTime(rising ? peak : 0.0001, t + dur);
    } catch (e) {}
  }

  /* Die Lage eines Akkords: seine Töne stehen fest, aber in welcher Oktave jeder
     erklingt, ist frei. Gewählt wird die Umkehrung, bei der sich die Stimmen
     gegenüber dem vorigen Akkord am wenigsten bewegen — so rückt jede nur ein,
     zwei Halbtöne weiter, statt dass der ganze Klang springt. Ein schwacher Zug
     zur Mitte hält die Lage auf Dauer davon ab, nach oben oder unten wegzulaufen. */
  function voicing(spec) {
    const pcs = [];
    for (let i = 0; i < spec.semis.length; i++) pcs.push(((spec.semis[i] % 12) + 12) % 12);
    let best = null, bestCost = Infinity;
    for (let rot = 0; rot < pcs.length; rot++) {
      for (let oct = 0; oct <= 1; oct++) {
        const cand = [pcs[rot] + oct * 12];
        for (let i = 1; i < pcs.length; i++) {
          let n = pcs[(rot + i) % pcs.length];
          while (n <= cand[cand.length - 1]) n += 12;
          cand.push(n);
        }
        if (cand[cand.length - 1] > 24) continue; // nicht höher als zwei Oktaven über dem Grundton
        let mid = 0;
        for (let i = 0; i < cand.length; i++) mid += cand[i];
        let cost = Math.abs(mid / cand.length - CENTER) * 0.15;
        if (lastVoicing && lastVoicing.length === cand.length) {
          for (let i = 0; i < cand.length; i++) cost += Math.abs(cand[i] - lastVoicing[i]);
        }
        if (cost < bestCost) { bestCost = cost; best = cand; }
      }
    }
    return best || pcs.slice();
  }

  /* Ein Akkord als Klangkörper: ein Bass und drei Töne, jeder aus zwei leicht
     gegeneinander verstimmten Stimmen, alles durch ein weiches Tiefpassfilter,
     das beim Einsetzen langsam aufgeht. Das ergibt das Schweben eines Pads. */
  function build(ctx, dest, notes, det) {
    const t0 = ctx.currentTime + 0.01;
    const out = ctx.createGain();
    /* Erst der stille Grundwert, dann die Blende: Wird die Farbe abgelöst,
       bevor sie überhaupt eingesetzt hat, fällt das Anschwellen weg — und was
       bleibt, ist die Stille, kein Sprung auf volle Lautstärke. */
    out.gain.value = 0.0001;
    glide(out.gain, ctx, LEVEL, true, CROSSFADE);

    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.Q.value = 0.7;
    /* Das Filter geht nur noch ein Stück weiter auf, statt von dumpf nach hell
       durchzufahren: Ein voller Aufzug bei jedem Stein klingt wie ein neuer
       Anschlag und macht damit gerade das hörbar, was hier verschwinden soll. */
    filt.frequency.setValueAtTime(1150, t0);
    filt.frequency.linearRampToValueAtTime(1750, t0 + CROSSFADE * 1.4);
    filt.connect(out);
    out.connect(dest);

    const oscs = [];
    for (let i = 0; i < notes.length; i++) {
      const freq = ROOT * Math.pow(2, notes[i] / 12);
      const bass = i === 0;
      /* Das wechselnde Feinstimmen sorgt dafür, dass ein Ton, den zwei
         aufeinanderfolgende Akkorde gemeinsam haben, während der Blende
         langsam schwebt statt sich mit sich selbst auszulöschen. */
      const detunes = bass ? [det] : [-6 + det, 6 + det];
      for (let d = 0; d < detunes.length; d++) {
        let osc, gain;
        try {
          osc = ctx.createOscillator();
          gain = ctx.createGain();
        } catch (e) { break; }
        osc.type = bass ? "triangle" : "sawtooth";
        osc.frequency.setValueAtTime(freq, t0);
        osc.detune.setValueAtTime(detunes[d], t0);
        gain.gain.value = (bass ? 0.55 : 0.30) / detunes.length;
        osc.connect(gain);
        gain.connect(filt);
        try { osc.start(t0); } catch (e) { continue; }
        oscs.push(osc);
      }
    }
    if (!oscs.length) { try { out.disconnect(); } catch (e) {} return null; }
    return { ctx: ctx, out: out, oscs: oscs };
  }

  /* Eine Farbe ausklingen lassen: leiser werden, dann verstummen. Sie wandert
     dabei in die Liste des Ausklingens, damit ein hartes Anhalten sie noch
     erreicht. */
  function release(v, quick) {
    if (!v) return;
    fade(v, quick ? CUT : CROSSFADE);
    fading.push(v);
    const last = v.oscs[v.oscs.length - 1];
    last.onended = function () {
      const k = fading.indexOf(v);
      if (k >= 0) fading.splice(k, 1);
      try { v.out.disconnect(); } catch (e) {}
    };
  }

  // Leiser werden und danach verstummen — die Bewegung selbst, ohne Buchführung.
  function fade(v, dur) {
    const t = v.ctx.currentTime;
    let from = LEVEL;
    try {
      /* Anhalten, ohne zurückzuspringen: Eine noch laufende Blende wird dort
         festgehalten, wo sie gerade steht — von da an geht es abwärts. */
      if (v.out.gain.cancelAndHoldAtTime) v.out.gain.cancelAndHoldAtTime(t);
      else v.out.gain.cancelScheduledValues(t);
      from = Math.max(0.0001, v.out.gain.value);
    } catch (e) {}
    glide(v.out.gain, v.ctx, from, false, dur);
    for (let i = 0; i < v.oscs.length; i++) {
      try { v.oscs[i].stop(t + dur + 0.05); } catch (e) {}
    }
  }

  /* Der Akkord eines Steins. Er löst den vorigen ab — auch derselbe Stein
     zweimal hintereinander setzt neu an, denn er ist ein neuer Anschlag. */
  function chord(type) {
    const spec = CHORDS[type];
    if (!spec) return false;
    const b = bus();
    if (!b) return false;
    if (TetrisSound.wake) TetrisSound.wake();
    const led = voicing(spec);
    // Der Bass bleibt in seiner tiefen Oktave — er trägt, er soll nicht wandern.
    const bass = (((spec.semis[0] % 12) + 12) % 12) - 12;
    drift = drift > 0 ? -2.5 : 2.5;
    release(voice, false);
    voice = build(b.ctx, b.master, [bass].concat(led), drift);
    voiceType = voice ? type : "";
    lastVoicing = led;
    return !!voice;
  }

  // Alles verstummt — beim Pausieren, beim Spielende, beim Verlassen der Partie.
  function stop() {
    release(voice, true);
    voice = null;
    voiceType = "";
    lastVoicing = null; // die nächste Partie beginnt wieder in der mittleren Lage
    // Auch was schon ausklingt, wird kurzgemacht — sonst hallt die Partie nach.
    for (let i = fading.length - 1; i >= 0; i--) fade(fading[i], CUT);
  }

  // Für die Anzeige: welche Stufe ein Stein ist, und wie die Tonart heißt.
  function chordOf(type) { return CHORDS[type] || null; }
  function keyName() { return KEY_NAME; }
  function playing() { return voiceType; }

  return {
    chord: chord,
    stop: stop,
    chordOf: chordOf,
    keyName: keyName,
    playing: playing
  };
})();
