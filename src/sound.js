/* Die Geräusche des Spiels. Die vier Klänge liegen als <audio> im Dokument;
   hier entstehen daraus kleine Stapel von Kopien, damit derselbe Klang mehrfach
   übereinanderliegen kann, ohne sich selbst abzuschneiden — beim Schieben folgt
   ein Ton dicht auf den nächsten.

   Ausgelöst werden sie dort, wo auch die Bildschau ihre Ereignisse bekommt
   (fx.js): dieselben Anlässe, dieselbe Stelle. Ein Mindestabstand je Klang
   verhindert, dass eine gehaltene Taste eine Salve auslöst. */
const TetrisSound = (function () {
  /* Je Klang: das Element im Dokument, die Lautstärke, der Mindestabstand zweier
     Anschläge und die Zahl der Stimmen — so oft darf er übereinanderliegen.
     Was dicht aufeinander folgt, braucht mehr davon als eine volle Reihe. */
  const DEFS = {
    move:   { id: "snd-move",   vol: 0.40, gap: 45,  voices: 4 }, // verschieben und drehen
    drop:   { id: "snd-drop",   vol: 0.60, gap: 60,  voices: 3 }, // der Stein setzt auf
    rows:   { id: "snd-rows",   vol: 0.70, gap: 90,  voices: 2 }, // eine bis drei Reihen
    tetris: { id: "snd-tetris", vol: 0.85, gap: 250, voices: 1 }  // vier Reihen auf einmal
  };

  const banks = {};
  let built = false;
  let muted = false;

  function now() {
    return typeof performance !== "undefined" && performance.now
      ? performance.now() : Date.now();
  }

  /* Die Kopien tragen die Quelle des Vorbilds mit sich — im Markup steht dort der
     Pfad der Beigabe, den das Bündeln durch die eingebettete Fassung ersetzt.
     Im Dokument hängen müssen die Kopien nicht, um zu klingen. */
  function build() {
    if (built) return;
    built = true;
    for (const key in DEFS) {
      const def = DEFS[key];
      const el = document.getElementById(def.id);
      if (!el) continue;
      const voices = [];
      for (let i = 0; i < def.voices; i++) {
        const v = i === 0 ? el : el.cloneNode(true);
        v.preload = "auto";
        v.volume = def.vol;
        if (v !== el) v.load(); // die Kopie soll bereitstehen, bevor sie gebraucht wird
        voices.push(v);
      }
      banks[key] = { voices: voices, at: 0, last: -1e9, gap: def.gap };
    }
  }

  function play(key) {
    if (muted) return;
    build();
    const bank = banks[key];
    if (!bank) return;
    const t = now();
    if (t - bank.last < bank.gap) return;
    bank.last = t;
    const v = bank.voices[bank.at];
    bank.at = (bank.at + 1) % bank.voices.length;
    try { v.currentTime = 0; } catch (e) { /* noch nicht bereit — dann von vorn */ }
    const p = v.play();
    // Ohne Zutun des Anwenders darf nichts klingen; das ist kein Fehler.
    if (p && p.catch) p.catch(function () {});
  }

  // Abschalten heißt auch: was gerade klingt, hört auf.
  function stopAll() {
    for (const key in banks) {
      const voices = banks[key].voices;
      for (let i = 0; i < voices.length; i++) {
        try { voices[i].pause(); voices[i].currentTime = 0; } catch (e) {}
      }
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (muted) stopAll();
  }

  // Die Stimmen entstehen gleich beim Laden — dann klingt schon der erste Zug.
  build();

  return {
    play: play,
    setMuted: setMuted
  };
})();
