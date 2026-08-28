/* Die Geräusche des Spiels.

   Die vier Klänge liegen als <audio> im Dokument. Ihre Quellen sind Pfade
   (assets/…) — und Pfade führen in diesem Fensterrahmen nirgendwohin: Das Bündeln
   lässt sie stehen, und der Rahmen lässt keinen Dateizugriff zu. Jedes Element
   meldet darum "Quelle nicht spielbar". Die Aufnahmen kommen deshalb über das
   Dateisystem des Workspace in die App (soundfiles.js) und werden hier mit adopt()
   übernommen: Sie werden entpackt UND als data:-Quelle in die Elemente gehängt.

   Gehört wird über drei Wege. Jeder Anschlag geht den ersten, der wirklich trägt:
     1. das <audio>-Element (bzw. eine seiner Kopien) — der Weg, der immer ging;
     2. der entpackte Klangkörper in der Tonmaschine — falls das Element abweist;
     3. ein kurzer selbst erzeugter Ton — falls es die Aufnahme gar nicht gibt.
   Weist ein Weg ab, übernimmt der nächste. Der dritte ist der Notnagel: Er
   ersetzt die Aufnahme nicht, er verhindert nur, dass das Spiel stumm bleibt.

   Warum in dieser Reihenfolge: Die Tonmaschine schläft, bis der Anwender etwas
   tut, und in manchem Fensterrahmen darf sie nie erwachen. Das Element ist der
   verlässlichere Weg und kommt deshalb zuerst. Liegt eine entpackte Aufnahme
   bereit, dreht sich das um — sie klingt ohne Anlauf, das Element wird Rückfall.

   Vorlaufende Stille im Klangkörper wird übersprungen: Manche Aufnahme beginnt
   erst ein paar Millisekunden nach ihrem Anfang zu klingen, und genau das hört
   man als Verzögerung.

   Was der Ton gerade tut, lässt sich ansehen: report() legt für jeden Klang
   offen, was gefunden, entpackt und zuletzt geschehen ist — die Ton-Diagnose
   (sounddiag.js) zeigt es, Taste T.

   Ausgelöst werden die Klänge am Ort des Anlasses: was die Regel meldet, klingt
   in der Regel (engine.js) — noch im selben Tastendruck. Was man erst dem
   Zustand ansieht (volle Reihen), klingt in der Bildschau (fx.js). */
const TetrisSound = (function () {
  /* Je Klang: das Element im Dokument, die Lautstärke, der Mindestabstand zweier
     Anschläge, die Zahl der Stimmen und das Rezept des eigenen Tons. Der
     Mindestabstand hält nur Salven ab; er liegt unter der Wiederholrate der
     gehaltenen Taste (50 ms), damit jeder wirkliche Zug seinen Ton bekommt. */
  const DEFS = {
    move: { id: "snd-move", vol: 0.40, gap: 25, voices: 4, // verschieben und drehen
            tone: { freqs: [660], to: 430, dur: 0.05, vol: 0.13, wave: "square" } },
    drop: { id: "snd-drop", vol: 0.60, gap: 60, voices: 3, // der Stein setzt auf
            tone: { freqs: [190], to: 60, dur: 0.15, vol: 0.30, wave: "triangle" } },
    rows: { id: "snd-rows", vol: 0.70, gap: 90, voices: 2, // eine bis drei Reihen
            tone: { freqs: [520], to: 1040, dur: 0.22, vol: 0.24, wave: "triangle" } },
    tetris: { id: "snd-tetris", vol: 0.85, gap: 250, voices: 1, // vier auf einmal
            tone: { freqs: [523, 659, 784, 1047], dur: 0.40, vol: 0.20,
                    wave: "triangle", step: 0.06 } }
  };

  const WAYS = ["element", "buffer", "tone"];
  const NO_SOURCE = 3; // networkState: es gibt keine spielbare Quelle

  const banks = {};
  let muted = false;
  let watching = false;

  let ctx = null;    // die Tonmaschine
  let master = null; // der gemeinsame Regler — über ihn läuft die Stummschaltung
  let live = [];     // was gerade über sie klingt; damit Stummschalten es abbricht

  function now() {
    return typeof performance !== "undefined" && performance.now
      ? performance.now() : Date.now();
  }

  // --- Die Tonmaschine ---

  /* Sie entsteht schon beim Laden. Ohne Zutun des Anwenders bleibt sie angehalten —
     entpacken darf sie trotzdem, und das ist der Sinn: Beim ersten Tastendruck ist
     alles fertig. */
  function openCtx() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext || null;
    if (!Ctor) return null;
    try {
      ctx = new Ctor({ latencyHint: "interactive" });
    } catch (e) {
      try { ctx = new Ctor(); } catch (e2) { return null; }
    }
    try {
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
    } catch (e) { master = null; }
    return ctx;
  }

  /* Der erste Tastendruck oder Klick weckt die Tonmaschine. Danach hören die
     Wächter von selbst auf zu lauschen. */
  function unlock() {
    if (!ctx) return;
    if (ctx.state === "running") { dropWatchers(); return; }
    let p;
    try { p = ctx.resume(); } catch (e) { return; }
    if (p && p.then) p.then(function () { dropWatchers(); }, function () {});
  }
  function dropWatchers() {
    watching = false;
    window.removeEventListener("keydown", unlock, true);
    window.removeEventListener("pointerdown", unlock, true);
  }
  function addWatchers() {
    if (watching) return;
    watching = true;
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
    if (!buffer) {
      bank.dec = !src ? "keine Quelle"
        : src.slice(0, 5) === "data:" ? "nicht base64" : "nicht eingebettet";
      return;
    }
    decodeBuffer(bank, buffer, "");
  }

  /* Die nackten Bytes einer Aufnahme entpacken — gleich, woher sie stammen: aus
     dem Dokument oder aus dem Datenordner. Das Entpacken frisst den Puffer auf;
     wer ihn noch braucht, bedient sich vorher. */
  function decodeBuffer(bank, buffer, label) {
    if (!ctx || !ctx.decodeAudioData) { bank.dec = "keine Tonmaschine"; return; }
    bank.dec = "läuft";
    // Die alte Form gibt kein Versprechen zurück, sondern ruft zurück.
    let p;
    try { p = ctx.decodeAudioData(buffer, ok, fail); }
    catch (e) { bank.dec = "wirft " + (e && e.name ? e.name : "?"); return; }
    if (p && p.then) p.then(ok, fail);
    function ok(buf) {
      if (!buf) return;
      bank.buf = buf;
      bank.skip = firstSound(buf);
      bank.dec = "entpackt" + (label ? " (" + label + ")" : "");
    }
    function fail() { bank.dec = "misslungen" + (label ? " (" + label + ")" : ""); }
  }

  // --- Eine Aufnahme von außen ---

  /* Die Bytes einer Datei aus dem Datenordner (soundfiles.js). Sie sind der einzige
     Weg, auf dem eine Aufnahme in diesem Fensterrahmen überhaupt ankommt: Die
     Quellen im Dokument sind Pfade, und Pfade führen hier nirgendwohin.

     Beide Wege werden damit gangbar — der Klangkörper in der Tonmaschine (dafür
     wird entpackt) und das Element (dafür wird die Datei zur data:-Quelle). */
  function adopt(key, buffer, mime, label) {
    build();
    const bank = banks[key];
    if (!bank || !buffer || !buffer.byteLength) return false;
    bank.file = label || "Datei";
    bank.note = "";
    openCtx();
    feedVoices(bank, buffer, mime);      // erst der data:-Umweg …
    decodeBuffer(bank, buffer, "Datei"); // … dann das Entpacken, das den Puffer frisst
    return true;
  }

  const MAX_INLINE = 3 * 1024 * 1024; // darüber lohnt die data:-Quelle nicht mehr

  /* Aus den Bytes eine data:-Quelle machen und sie den Stimmen geben. Das ist der
     Weg, der auch ohne wache Tonmaschine trägt. Ein neues src löscht den Fehler
     des Elements — der alte Pfad ist damit vergessen. */
  function feedVoices(bank, buffer, mime) {
    if (!bank.voices.length || buffer.byteLength > MAX_INLINE) return;
    const bytes = new Uint8Array(buffer);
    let bin = "";
    // In Häppchen, sonst sprengt der Aufruf bei großen Dateien den Stapel.
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    let uri;
    try { uri = "data:" + (mime || "audio/mpeg") + ";base64," + btoa(bin); }
    catch (e) { return; }
    for (let i = 0; i < bank.voices.length; i++) {
      const v = bank.voices[i];
      try { v.src = uri; v.volume = bank.def.vol; v.load(); } catch (e) {}
    }
  }

  // --- Der Aufbau ---

  /* Jeder Klang bekommt seine Bank gleich beim Laden — auch dann, wenn sein
     Element noch fehlt. Denn ohne Bank gäbe es nichts zu spielen, und dann wäre
     es für immer still; mit Bank bleibt wenigstens der eigene Ton.

     Die Stimmen sind Kopien des Elements, damit ein Ton den vorigen nicht
     abschneidet. Sie tragen die Quelle des Vorbilds mit sich und müssen nicht im
     Dokument hängen, um zu klingen. Fehlte das Element beim Laden noch, wird bei
     jedem Anschlag erneut nach ihm gesucht. */
  function build() {
    openCtx();
    for (const key in DEFS) {
      const def = DEFS[key];
      let bank = banks[key];
      if (!bank) {
        bank = banks[key] = { key: key, def: def, voices: [], at: 0,
                              last: -1e9, buf: null, skip: 0, file: "",
                              way: "noch nichts", note: "", dec: "—" };
      }
      if (bank.voices.length) continue;
      const el = document.getElementById(def.id);
      if (!el) { bank.note = "Element " + def.id + " fehlt im Dokument"; continue; }
      for (let i = 0; i < def.voices; i++) {
        const v = i === 0 ? el : el.cloneNode(true);
        v.preload = "auto";
        v.volume = def.vol;
        if (v !== el) v.load(); // die Kopie soll bereitstehen, bevor sie gebraucht wird
        bank.voices.push(v);
      }
      bank.note = "";
      decodeInto(bank, el.getAttribute("src") || el.src);
    }
    if (ctx) addWatchers();
  }

  // --- Die drei Wege ---

  /* Ein Element, dessen Quelle nicht spielbar ist, wird nicht erst gefragt: Es
     meldet einen Fehler oder hat gar keine Quelle. Dann geht es gleich weiter. */
  function voiceOf(bank) {
    if (!bank.voices.length) return null;
    const v = bank.voices[bank.at];
    bank.at = (bank.at + 1) % bank.voices.length;
    if (v.error) {
      bank.note = "Quelle nicht spielbar (Fehler " + v.error.code + ")";
      return null;
    }
    if (v.networkState === NO_SOURCE) {
      bank.note = "keine spielbare Quelle";
      return null;
    }
    return v;
  }

  function playElement(bank, i) {
    const v = voiceOf(bank);
    if (!v) return false;
    try { v.currentTime = 0; } catch (e) { /* noch nicht bereit — dann von vorn */ }
    let p;
    try { p = v.play(); }
    catch (e) { bank.note = "play() wirft " + (e && e.name ? e.name : "?"); return false; }
    bank.way = "Element";
    bank.note = "";
    // Weist es erst nachträglich ab, übernimmt noch derselbe Anschlag den nächsten Weg.
    if (p && p.catch) p.catch(function (e) {
      bank.note = "play() abgewiesen: " + (e && e.name ? e.name : "?");
      fire(bank, i + 1);
    });
    return true;
  }

  // Über die Tonmaschine: eine neue Stimme je Anschlag, sofort und ohne Anlauf.
  function playBuffered(bank) {
    if (!ctx || !master || !bank.buf || ctx.state !== "running") return false;
    let src;
    try {
      src = ctx.createBufferSource();
      src.buffer = bank.buf;
      const gain = ctx.createGain();
      gain.gain.value = bank.def.vol;
      src.connect(gain);
      gain.connect(master);
    } catch (e) { return false; }
    src.onended = function () {
      const k = live.indexOf(src);
      if (k >= 0) live.splice(k, 1);
    };
    live.push(src);
    try { src.start(0, bank.skip); }
    catch (e) { try { src.start(0); } catch (e2) { return false; } }
    bank.way = "Tonmaschine";
    return true;
  }

  /* Der Notnagel: ein kurzer eigener Ton. Er klingt nur, wenn die Aufnahme fehlt
     oder abweist — und nur, solange die Tonmaschine wach ist. */
  function playTone(bank) {
    if (!ctx || !master || ctx.state !== "running") return false;
    const t = bank.def.tone;
    if (!t) return false;
    const t0 = ctx.currentTime + 0.001;
    const peak = t.vol / Math.sqrt(t.freqs.length);
    for (let i = 0; i < t.freqs.length; i++) {
      const at = t0 + (t.step ? i * t.step : 0);
      let osc;
      try {
        osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = t.wave || "triangle";
        osc.frequency.setValueAtTime(t.freqs[i], at);
        if (t.to) osc.frequency.exponentialRampToValueAtTime(Math.max(30, t.to), at + t.dur);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(peak, at + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + t.dur);
        osc.connect(gain);
        gain.connect(master);
        osc.start(at);
        osc.stop(at + t.dur + 0.02);
      } catch (e) {
        // Ein Teil des Akkords klingt schon — dann gilt der Weg als getragen.
        if (i > 0) { bank.way = "eigener Ton"; return true; }
        return false;
      }
      osc.onended = function () {
        const k = live.indexOf(osc);
        if (k >= 0) live.splice(k, 1);
      };
      live.push(osc);
    }
    bank.way = "eigener Ton";
    return true;
  }

  /* Liegt eine entpackte Aufnahme bereit, klingt sie zuerst: Über die Tonmaschine
     geht es ohne Anlauf, das Element bleibt der Rückfall. Ohne Aufnahme bleibt es
     bei der gewohnten Ordnung. Der eigene Ton steht so oder so am Ende — test()
     verlässt sich darauf. */
  function waysFor(bank) {
    return bank.buf ? ["buffer", "element", "tone"] : WAYS;
  }

  /* Der erste Weg, der trägt, gewinnt. Trägt keiner, bleibt es bei diesem
     Anschlag still — und der Klang vermerkt, warum. */
  function fire(bank, i) {
    const ways = waysFor(bank);
    while (i < ways.length) {
      const way = ways[i];
      if (way === "element" && playElement(bank, i)) return;
      if (way === "buffer" && playBuffered(bank)) return;
      if (way === "tone" && playTone(bank)) return;
      i++;
    }
    bank.way = "stumm";
  }

  function play(key) {
    if (muted) return;
    build();
    const bank = banks[key];
    if (!bank) return;
    const t = now();
    if (t - bank.last < bank.def.gap) return;
    bank.last = t;
    /* Die Tonmaschine schläft, bis der Anwender etwas tut — der Tastendruck selbst
       weckt sie. In manchem Fensterrahmen darf sie nie erwachen; die Wege, die auf
       sie bauen, kommen dann nie zum Zug, das Element aber schon. */
    if (ctx && ctx.state !== "running") unlock();
    fire(bank, 0);
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

  // --- Was der Ton gerade tut ---

  /* Offengelegt für die Diagnose: je Klang, ob sein Element da ist, ob seine
     Quelle eingebettet wurde, was das Entpacken ergab und welcher Weg zuletzt
     getragen hat. Nur Ablesen, kein Eingriff. */
  function report() {
    const sounds = [];
    for (const key in DEFS) {
      const def = DEFS[key];
      const bank = banks[key] || null;
      const el = document.getElementById(def.id);
      const src = el ? (el.getAttribute("src") || el.src || "") : "";
      const embedded = src.slice(0, 5) === "data:";
      sounds.push({
        key: key,
        found: !!el,
        embedded: embedded,
        kb: embedded ? Math.round(src.length * 0.75 / 1024) : 0,
        src: embedded ? "" : src,
        ready: el ? el.readyState : -1,
        net: el ? el.networkState : -1,
        error: el && el.error ? el.error.code : 0,
        voices: bank ? bank.voices.length : 0,
        file: bank ? bank.file : "",
        decode: bank ? bank.dec : "—",
        way: bank ? bank.way : "—",
        note: bank ? bank.note : ""
      });
    }
    return {
      muted: muted,
      ctx: ctx ? ctx.state : "keine",
      clock: ctx ? Math.round(ctx.currentTime * 100) / 100 : 0,
      sounds: sounds
    };
  }

  /* Ein Klang auf Verlangen — ohne Mindestabstand. Mit way = "tone" wird nur der
     eigene Ton versucht, sonst die ganze Kette von vorn. */
  function test(key, way) {
    if (muted) return;
    build();
    const bank = banks[key];
    if (!bank) return;
    bank.last = -1e9;
    if (ctx && ctx.state !== "running") unlock();
    fire(bank, way === "tone" ? WAYS.indexOf("tone") : 0);
  }

  // Die Bänke entstehen gleich beim Laden — dann klingt schon der erste Zug.
  build();

  return {
    play: play,
    adopt: adopt,
    setMuted: setMuted,
    report: report,
    test: test
  };
})();
