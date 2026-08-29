/* Das Schlagzeug des musikalischen Endlosspiels.

   Es hat keine eigene Uhr: Den Puls schlägt der Bass (arp.js), und derselbe
   Schritt, der dort einen Ton legt, legt hier einen Schlag. So können die
   beiden nicht auseinanderlaufen — zwei Zeitgeber nebeneinander täten das
   unweigerlich, und ein Schlagzeug, das gegen den Bass schleift, ist schlimmer
   als gar keines.

   Ein Schritt ist eine Achtel. Acht Schritte sind ein Takt, das Muster läuft
   über zwei Takte, damit die Wiederholung nicht gleich als solche auffällt:
   Bass auf die Eins und die Drei, Schlag auf die Zwei und die Vier, Hut auf
   jeder Achtel — und am Ende des zweiten Taktes ein Auftakt zurück auf die Eins.

   Geschlagen wird mit dem, was die Tonmaschine selbst hergibt: ein fallender
   Sinus für die Trommel, gefiltertes Rauschen für Schlag und Hut. Aufnahmen
   braucht es dafür nicht. Alles hängt am Regler von sound.js und ist damit von
   der Stummschaltung (Taste S) mit erfasst.

   Was hier steht, klingt nur — es kennt weder Spiel noch Tonart. */
const TetrisDrums = (function () {
  const BAR = 16;        // Schritte des Musters (zwei Takte zu je acht Achteln)
  const KICK  = [1, 0, 0, 0,  1, 0, 0, 0,   1, 0, 0, 0,  1, 0, 0, 1];
  const SNARE = [0, 0, 1, 0,  0, 0, 1, 0,   0, 0, 1, 0,  0, 0, 1, 0];
  const HAT   = [2, 1, 2, 1,  2, 1, 2, 1,   2, 1, 2, 1,  2, 1, 2, 2]; // 2 = betont

  const KICK_LEVEL  = 0.42;
  const SNARE_LEVEL = 0.20;
  const HAT_LEVEL   = 0.055; // der Hut steht leise, er soll nur ticken

  let live = [];       // was gerade klingt — damit ein Anhalten es noch erwischt
  let noiseBuf = null; // das Rauschen, einmal gerechnet
  let noiseCtx = null; // und die Tonmaschine, für die es gilt

  /* Rauschen als Klangkörper: einmal gefüllt, danach von jedem Schlag geteilt.
     Vier Zehntel reichen — länger klingt hier ohnehin nichts. */
  function noise(ctx) {
    if (noiseBuf && noiseCtx === ctx) return noiseBuf;
    let buf;
    try {
      const len = Math.floor(ctx.sampleRate * 0.4);
      buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { return null; }
    noiseBuf = buf;
    noiseCtx = ctx;
    return buf;
  }

  /* Buchführung: Was klingt, steht in der Liste, bis es von selbst endet —
     nur so kann stop() es vorzeitig kurzmachen. */
  function track(node, gain) {
    const v = { node: node, gain: gain };
    live.push(v);
    node.onended = function () {
      const k = live.indexOf(v);
      if (k >= 0) live.splice(k, 1);
      try { gain.disconnect(); } catch (e) {}
    };
  }

  // Die große Trommel: ein Sinus, der beim Anschlag in die Tiefe fällt.
  function kick(ctx, dest, t) {
    let osc, g;
    try {
      osc = ctx.createOscillator();
      g = ctx.createGain();
    } catch (e) { return; }
    osc.type = "sine";
    osc.frequency.setValueAtTime(132, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(KICK_LEVEL, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
    osc.connect(g);
    g.connect(dest);
    try { osc.start(t); osc.stop(t + 0.34); } catch (e) { return; }
    track(osc, g);
  }

  /* Der Schlag: helles Rauschen für das Fell, dazu ein kurzer Ton als Körper —
     ohne ihn klingt er wie ein Zischen, nicht wie eine Trommel. */
  function snare(ctx, dest, t) {
    const buf = noise(ctx);
    if (buf) {
      let src, hp, g;
      try {
        src = ctx.createBufferSource();
        hp = ctx.createBiquadFilter();
        g = ctx.createGain();
      } catch (e) { return; }
      src.buffer = buf;
      hp.type = "highpass";
      hp.frequency.value = 1500;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(SNARE_LEVEL, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      src.connect(hp);
      hp.connect(g);
      g.connect(dest);
      try { src.start(t); src.stop(t + 0.2); } catch (e) { return; }
      track(src, g);
    }
    let osc, og;
    try {
      osc = ctx.createOscillator();
      og = ctx.createGain();
    } catch (e) { return; }
    osc.type = "triangle";
    osc.frequency.setValueAtTime(196, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.linearRampToValueAtTime(SNARE_LEVEL * 0.55, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(og);
    og.connect(dest);
    try { osc.start(t); osc.stop(t + 0.12); } catch (e) { return; }
    track(osc, og);
  }

  // Der Hut: sehr kurzes, sehr hohes Rauschen. Betont ist er etwas lauter.
  function hat(ctx, dest, t, accent) {
    const buf = noise(ctx);
    if (!buf) return;
    let src, hp, g;
    try {
      src = ctx.createBufferSource();
      hp = ctx.createBiquadFilter();
      g = ctx.createGain();
    } catch (e) { return; }
    src.buffer = buf;
    src.playbackRate.value = 1.7; // helleres Rauschen als beim Schlag
    hp.type = "highpass";
    hp.frequency.value = 7200;
    const peak = HAT_LEVEL * (accent ? 1.8 : 1);
    const dur = accent ? 0.055 : 0.035;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(hp);
    hp.connect(g);
    g.connect(dest);
    try { src.start(t); src.stop(t + dur + 0.02); } catch (e) { return; }
    track(src, g);
  }

  /* Ein Schritt des Pulses: Der Bass ruft das für jeden Ton, den er legt, mit
     der laufenden Nummer des Schritts und der Zeit auf der Uhr der Tonmaschine.
     Welche Schläge fällig sind, sagt das Muster. */
  function step(ctx, dest, n, t) {
    if (!ctx || !dest) return;
    const i = ((n % BAR) + BAR) % BAR;
    if (KICK[i]) kick(ctx, dest, t);
    if (SNARE[i]) snare(ctx, dest, t);
    if (HAT[i]) hat(ctx, dest, t, HAT[i] > 1);
  }

  // Alles verstummt: Was schon auf der Uhr liegt, wird kurzgemacht.
  function stop() {
    for (let i = live.length - 1; i >= 0; i--) {
      const v = live[i];
      const ctx = noiseCtx;
      try {
        const t = v.gain.context ? v.gain.context.currentTime : (ctx ? ctx.currentTime : 0);
        if (v.gain.gain.cancelAndHoldAtTime) v.gain.gain.cancelAndHoldAtTime(t);
        else v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), t);
        v.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        v.node.stop(t + 0.06);
      } catch (e) {}
    }
  }

  return {
    step: step,
    stop: stop
  };
})();
