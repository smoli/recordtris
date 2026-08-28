/* Die Geräusche des Spiels. Die vier Klänge liegen als <audio> im Dokument, weil
   nur im Markup der Pfad der Beigabe steht, den das Bündeln durch die eingebettete
   Fassung ersetzt.

   Gespielt wird bevorzugt nicht über diese Elemente, sondern über die Tonmaschine
   des Browsers: Die eingebettete Fassung ist eine data:-Quelle, aus ihr entstehen
   beim Laden entpackte Klangkörper. Ein Anschlag ist danach nur noch das Starten
   einer Stimme — ohne Anlauf, ohne Abschneiden, ohne Stapel von Kopien.

   Bevorzugt heißt: nur solange die Tonmaschine nachweislich läuft. Sie schläft, bis
   der Anwender etwas tut, und in manchem Fensterrahmen darf sie überhaupt nie
   erwachen — dann käme aus ihr nichts, und alles bliebe still. Deshalb entscheidet
   jeder Anschlag neu: läuft sie und ist der Klang entpackt, klingt er über sie;
   sonst über das Element. Weist auch das Element ab, springt die Tonmaschine ein.
   Beide Wege fangen einander auf.

   Vorlaufende Stille im Klang wird übersprungen: Manche Aufnahme beginnt erst ein
   paar Millisekunden nach ihrem Anfang zu klingen, und genau das hört man als
   Verzögerung.

   Ausgelöst werden die Klänge am Ort des Anlasses: was die Regel meldet, klingt in
   der Regel (engine.js) — noch im selben Tastendruck. Was man erst dem Zustand
   ansieht (volle Reihen), klingt in der Bildschau (fx.js). */
const TetrisSound = (function () {
  /* Je Klang: das Element im Dokument, die Lautstärke, der Mindestabstand zweier
     Anschläge und die Zahl der Stimmen des Rückfalls. Der Mindestabstand hält nur
     Salven ab; er liegt unter der Wiederholrate der gehaltenen Taste (50 ms),
     damit jeder wirkliche Zug seinen Ton bekommt. */
  const DEFS = {
    move:   { id: "snd-move",   vol: 0.40, gap: 25,  voices: 4 }, // verschieben und drehen
    drop:   { id: "snd-drop",   vol: 0.60, gap: 60,  voices: 3 }, // der Stein setzt auf
    rows:   { id: "snd-rows",   vol: 0.70, gap: 90,  voices: 2 }, // eine bis drei Reihen
    tetris: { id: "snd-tetris", vol: 0.85, gap: 250, voices: 1 }  // vier Reihen auf einmal
  };

  const banks = {};
  let built = false;
  let muted = false;

  let ctx = null;        // die Tonmaschine
  let master = null;     // der gemeinsame Regler — über ihn läuft die Stummschaltung
  let live = [];         // was gerade klingt; nur damit Stummschalten es abbrechen kann
  let dead = false;      // die Tonmaschine läuft zwar, bringt aber nichts hervor
  let probeT = 0;        // Wanduhr des letzten Anschlags über die Tonmaschine
  let probeC = 0;        // ihr Uhrenstand dabei

  function now() {
    return typeof performance !== "undefined" && performance.now
      ? performance.now() : Date.now();
  }

  // --- Die Tonmaschine ---

  function audioCtor() {
    return window.AudioContext || window.webkitAudioContext || null;
  }

  /* Sie entsteht schon beim Laden. Ohne Zutun des Anwenders bleibt sie angehalten —
     entpacken darf sie trotzdem, und das ist der Sinn: Beim ersten Tastendruck ist
     alles fertig. */
  function openCtx() {
    if (ctx) return ctx;
    const Ctor = audioCtor();
    if (!Ctor) return null;
    try {
      ctx = new Ctor({ latencyHint: "interactive" });
    } catch (e) {
      try { ctx = new Ctor(); } catch (e2) { return null; }
    }
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    return ctx;
  }

  /* Der erste Tastendruck oder Klick weckt die Tonmaschine. Danach hören die
     Wächter von selbst auf zu lauschen. */
  function unlock() {
    if (!ctx) return;
    if (ctx.state === "running") { dropWatchers(); return; }
    const p = ctx.resume();
    if (p && p.then) p.then(function () { dropWatchers(); }, function () {});
  }
  function dropWatchers() {
    window.removeEventListener("keydown", unlock, true);
    window.removeEventListener("pointerdown", unlock, true);
  }
  function addWatchers() {
    window.addEventListener("keydown", unlock, true);
    window.addEventListener("pointerdown", unlock, true);
  }

  // --- Das Entpacken ---

  /* Aus einer data:-Quelle die nackten Bytes machen — ohne Netzzugriff, den die
     Sicherheitsregel ohnehin verwehrt. */
  function bytesOf(src) {
    if (!src || src.slice(0, 5) !== "data:") return null;
    const comma = src.indexOf(",");
    if (comma < 0) return null;
    if (!/;base64/i.test(src.slice(0, comma))) return null;
    let bin;
    try { bin = atob(src.slice(comma + 1)); } catch (e) { return null; }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  /* Wo der Klang wirklich anfängt: der erste Ausschlag über der Hörschwelle. Ein
     Stück davor bleibt stehen, damit der Einsatz nicht abgeschnitten klingt. */
  function firstSound(buf) {
    const data = buf.getChannelData(0);
    const limit = Math.min(data.length, Math.floor(buf.sampleRate * 0.5));
    for (let i = 0; i < limit; i++) {
      if (data[i] > 0.004 || data[i] < -0.004) {
        return Math.max(0, (i - buf.sampleRate * 0.002) / buf.sampleRate);
      }
    }
    return 0;
  }

  function decodeInto(bank, src) {
    const buffer = bytesOf(src);
    if (!buffer || !ctx || !ctx.decodeAudioData) return;
    // Die alte Form gibt kein Versprechen zurück, sondern ruft zurück.
    let p;
    try { p = ctx.decodeAudioData(buffer, ok, fail); } catch (e) { return; }
    if (p && p.then) p.then(ok, fail);
    function ok(buf) {
      if (!buf) return;
      bank.buf = buf;
      bank.skip = firstSound(buf);
    }
    function fail() { /* dann bleibt der Rückfall über das Element */ }
  }

  // --- Die Stimmen ---

  /* Der Rückfall: Kopien des Elements, damit ein Ton den vorigen nicht abschneidet.
     Sie tragen die Quelle des Vorbilds mit sich und müssen nicht im Dokument hängen,
     um zu klingen. */
  function build() {
    if (built) return;
    openCtx();
    let found = 0;
    for (const key in DEFS) {
      const def = DEFS[key];
      const el = document.getElementById(def.id);
      if (!el) continue;
      found++;
      const voices = [];
      for (let i = 0; i < def.voices; i++) {
        const v = i === 0 ? el : el.cloneNode(true);
        v.preload = "auto";
        v.volume = def.vol;
        if (v !== el) v.load(); // die Kopie soll bereitstehen, bevor sie gebraucht wird
        voices.push(v);
      }
      const bank = { voices: voices, at: 0, last: -1e9, gap: def.gap,
                     vol: def.vol, buf: null, skip: 0 };
      banks[key] = bank;
      if (ctx) decodeInto(bank, el.getAttribute("src") || el.src);
    }
    /* Fertig ist der Aufbau erst, wenn die Elemente wirklich im Dokument standen.
       Stand er zu früh — noch bevor sie da waren —, wird beim nächsten Anschlag
       noch einmal gesucht, statt für immer stumm zu bleiben. */
    if (!found) return;
    built = true;
    if (ctx) addWatchers();
  }

  // Über die Tonmaschine: eine neue Stimme je Anschlag, sofort und ohne Anlauf.
  function playBuffered(bank) {
    const src = ctx.createBufferSource();
    src.buffer = bank.buf;
    const gain = ctx.createGain();
    gain.gain.value = bank.vol;
    src.connect(gain);
    gain.connect(master);
    src.onended = function () {
      const i = live.indexOf(src);
      if (i >= 0) live.splice(i, 1);
    };
    live.push(src);
    try { src.start(0, bank.skip); } catch (e) { try { src.start(0); } catch (e2) {} }
  }

  /* Der Rückfall über das Element. Weist es den Anschlag ab — weil noch kein Zutun
     des Anwenders vorlag oder die Quelle nicht spielbar ist —, springt die
     Tonmaschine ein, sofern sie läuft. So fängt jeder der beiden Wege den anderen
     auf, statt dass es still bleibt. */
  function playElement(bank) {
    const v = bank.voices[bank.at];
    bank.at = (bank.at + 1) % bank.voices.length;
    try { v.currentTime = 0; } catch (e) { /* noch nicht bereit — dann von vorn */ }
    let p;
    try { p = v.play(); } catch (e) { rescue(bank); return; }
    if (p && p.catch) p.catch(function () { rescue(bank); });
  }

  function rescue(bank) {
    if (muted) return;
    if (ctx && bank.buf && ctx.state === "running" && !dead) playBuffered(bank);
  }

  /* Läuft sie wirklich? Eine laufende Tonmaschine lässt ihre Uhr weiterlaufen.
     Steht die Uhr, obwohl zwischen zwei Anschlägen Zeit vergangen ist, kommt aus
     ihr nichts heraus — dann übernehmen dauerhaft wieder die Elemente. */
  function stalled(t) {
    if (dead) return true;
    const c = ctx.currentTime;
    if (!probeT || c > probeC) { probeT = t; probeC = c; return false; }
    if (t - probeT > 300) { dead = true; return true; }
    return false;
  }

  function play(key) {
    if (muted) return;
    build();
    const bank = banks[key];
    if (!bank) return;
    const t = now();
    if (t - bank.last < bank.gap) return;
    bank.last = t;
    /* Die Tonmaschine schläft, bis der Anwender etwas tut — der Tastendruck selbst
       weckt sie. In manchem Fensterrahmen darf sie nie erwachen. Gespielt wird über
       sie deshalb nur, solange sie nachweislich läuft; sonst klingt es über die
       Elemente, so wie es das immer getan hat. */
    if (ctx && ctx.state !== "running") unlock();
    if (ctx && bank.buf && ctx.state === "running" && !stalled(t)) {
      playBuffered(bank);
      return;
    }
    playElement(bank);
  }

  // Abschalten heißt auch: was gerade klingt, hört auf.
  function stopAll() {
    for (let i = 0; i < live.length; i++) {
      try { live[i].stop(); } catch (e) {}
    }
    live = [];
    for (const key in banks) {
      const voices = banks[key].voices;
      for (let i = 0; i < voices.length; i++) {
        try { voices[i].pause(); voices[i].currentTime = 0; } catch (e) {}
      }
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 1;
    if (muted) stopAll();
  }

  // Die Stimmen entstehen gleich beim Laden — dann klingt schon der erste Zug.
  build();

  return {
    play: play,
    setMuted: setMuted
  };
})();
