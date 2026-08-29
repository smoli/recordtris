/* Das Klangbett des Endlosspiels: Jeder Stein ist eine Stufe der Tonart.

   Erscheint ein Stein, klingt sein Akkord als weiches Pad — es bleibt stehen,
   bis der nächste Stein kommt, und wird dann abgelöst (der alte klingt aus,
   während der neue anschwillt). Die Steinfolge des Zufallsregisters wird damit
   zu einer Akkordfolge; wer dasselbe Merkwort spielt, hört dieselbe Musik.

   Die Zuordnung ist fest und stammt vom Anwender:
     I → I,  S → IV,  O → II,  Z → III,  T → V,  J → VI,  L → VII.
   Die Tonart ist F-Dur; die Stufen sind ihre Dreiklänge, dazu ein Bass eine
   Oktave unter dem Grundton.

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
     Die Lagen steigen mit der Stufe — als Pad trägt das besser als ein Sprung
     zurück in die tiefe Oktave. */
  const CHORDS = {
    I: { deg: "I",   name: "F-Dur",       semis: [0, 4, 7] },
    O: { deg: "II",  name: "g-Moll",      semis: [2, 5, 9] },
    Z: { deg: "III", name: "a-Moll",      semis: [4, 7, 11] },
    S: { deg: "IV",  name: "B♭-Dur",      semis: [5, 9, 12] },
    T: { deg: "V",   name: "C-Dur",       semis: [7, 11, 14] },
    J: { deg: "VI",  name: "d-Moll",      semis: [9, 12, 16] },
    L: { deg: "VII", name: "e-vermindert", semis: [11, 14, 17] }
  };

  const LEVEL = 0.13;   // wie laut das Bett insgesamt steht
  const ATTACK = 0.45;  // wie lange es anschwillt
  const RELEASE = 0.85; // wie lange die abgelöste Farbe ausklingt

  let voice = null;     // was gerade steht
  let voiceType = "";   // welcher Stein es ausgelöst hat
  let fading = [];      // was gerade ausklingt — damit stop() auch das erwischt

  // Die Tonmaschine liegt bei sound.js; ohne sie bleibt das Pad einfach stumm.
  function bus() {
    if (typeof TetrisSound === "undefined" || !TetrisSound.bus) return null;
    const b = TetrisSound.bus();
    return b && b.ctx && b.master ? b : null;
  }

  /* Ein Akkord als Klangkörper: ein Bass und drei Töne, jeder aus zwei leicht
     gegeneinander verstimmten Stimmen, alles durch ein weiches Tiefpassfilter,
     das beim Einsetzen langsam aufgeht. Das ergibt das Schweben eines Pads. */
  function build(ctx, dest, spec) {
    const t0 = ctx.currentTime + 0.01;
    const out = ctx.createGain();
    /* Erst der stille Grundwert, dann das Anschwellen: Wird die Farbe abgelöst,
       bevor sie überhaupt eingesetzt hat, fällt das Anschwellen weg — und was
       bleibt, ist die Stille, kein Sprung auf volle Lautstärke. */
    out.gain.value = 0.0001;
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(LEVEL, t0 + ATTACK);

    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.Q.value = 0.7;
    filt.frequency.setValueAtTime(480, t0);
    filt.frequency.linearRampToValueAtTime(1700, t0 + ATTACK * 1.7);
    filt.connect(out);
    out.connect(dest);

    const notes = [spec.semis[0] - 12].concat(spec.semis); // Bass, dann der Dreiklang
    const oscs = [];
    for (let i = 0; i < notes.length; i++) {
      const freq = ROOT * Math.pow(2, notes[i] / 12);
      const bass = i === 0;
      const detunes = bass ? [0] : [-6, 6];
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
    fade(v, quick ? 0.08 : RELEASE);
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
    try {
      /* Anhalten, ohne zurückzuspringen: Ein noch laufendes Anschwellen wird
         dort festgehalten, wo es gerade steht — von da an geht es abwärts. */
      if (v.out.gain.cancelAndHoldAtTime) v.out.gain.cancelAndHoldAtTime(t);
      else {
        v.out.gain.cancelScheduledValues(t);
        v.out.gain.setValueAtTime(Math.max(0.0001, v.out.gain.value), t);
      }
      v.out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } catch (e) {}
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
    release(voice, false);
    voice = build(b.ctx, b.master, spec);
    voiceType = voice ? type : "";
    return !!voice;
  }

  // Alles verstummt — beim Pausieren, beim Spielende, beim Verlassen der Partie.
  function stop() {
    release(voice, true);
    voice = null;
    voiceType = "";
    // Auch was schon ausklingt, wird kurzgemacht — sonst hallt die Partie nach.
    for (let i = fading.length - 1; i >= 0; i--) fade(fading[i], 0.08);
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
