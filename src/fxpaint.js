/* Der Pinselkasten der Bildschau: Farben mischen und die immer gleichen Formen
   zeichnen — Kachel, Schattenriss, Hintergrund, Saum. Reine Zeichenarbeit ohne
   eigenen Zustand; wer wann was zeichnet, entscheidet fx.js. */
const TetrisPaint = (function () {
  const TYPE_COLOR = {
    I: "#33e6f5", J: "#5b7cff", L: "#ffa726", O: "#ffe040",
    S: "#4dfb9a", T: "#c77dff", Z: "#ff5c78"
  };
  // Jedes Level färbt Hintergrund, Saum und Aufblitzen anders ein.
  const LEVEL_TINT = [
    "#6ea8ff", "#4dfb9a", "#ffe040", "#ff5c78", "#c77dff",
    "#33e6f5", "#ffa726", "#ff7ac6", "#7dff9b", "#5b7cff"
  ];

  const rgbCache = {};
  function rgb(hex) {
    let v = rgbCache[hex];
    if (!v) {
      v = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
      rgbCache[hex] = v;
    }
    return v;
  }

  function col(hex, a) {
    const c = rgb(hex);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
  }

  // f über 1 zieht die Farbe zum Weiß, f unter 1 ins Dunkle.
  function shade(hex, f, a) {
    const c = rgb(hex);
    const k = f >= 1 ? f - 1 : 0;
    const r = f >= 1 ? c[0] + (255 - c[0]) * k : c[0] * f;
    const g = f >= 1 ? c[1] + (255 - c[1]) * k : c[1] * f;
    const b = f >= 1 ? c[2] + (255 - c[2]) * k : c[2] * f;
    return "rgba(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + "," + (a === undefined ? 1 : a) + ")";
  }

  function typeColor(t) { return TYPE_COLOR[t] || "#8c97ad"; }
  function levelColor(l) {
    const n = LEVEL_TINT.length;
    return LEVEL_TINT[((l % n) + n) % n];
  }

  // r ist entweder eine Zahl für alle vier Ecken oder [oben-links … unten-links].
  function roundRect(c, x, y, w, h, r) {
    const lim = Math.min(w / 2, h / 2);
    const a = typeof r === "number" ? [r, r, r, r] : r;
    const tl = Math.max(0, Math.min(a[0], lim)), tr = Math.max(0, Math.min(a[1], lim));
    const br = Math.max(0, Math.min(a[2], lim)), bl = Math.max(0, Math.min(a[3], lim));
    c.beginPath();
    c.moveTo(x + tl, y);
    c.lineTo(x + w - tr, y); c.quadraticCurveTo(x + w, y, x + w, y + tr);
    c.lineTo(x + w, y + h - br); c.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    c.lineTo(x + bl, y + h); c.quadraticCurveTo(x, y + h, x, y + h - bl);
    c.lineTo(x, y + tl); c.quadraticCurveTo(x, y, x + tl, y);
    c.closePath();
  }

  /* Ein Kästchen je Feld — das ursprüngliche Aussehen des Stapels: flache Farbe,
     eine schmale Fuge zum Nachbarn, ein heller Grat rundum, ein dunkler Fuß. Ein
     Tetromino bleibt dadurch als vier Kästchen erkennbar. */
  const PAD = 0.035; // Fuge zum Nachbarfeld, Anteil der Kantenlänge
  const RAD = 0.085; // Eckenrundung, Anteil der Kantenlänge

  function tileBox(x, y, s, pad) {
    return [x + pad, y + pad, x + s - pad, y + s - pad];
  }

  /* Eine Kachel: flache Farbe, ein heller Grat entlang der Kante und ein dunkler
     Hauch am Fuß. glow > 0 legt zusätzlich einen Schein darum. */
  function block(c, x, y, s, hex, alpha, glow) {
    const b = tileBox(x, y, s, s * PAD);
    const w = b[2] - b[0], h = b[3] - b[1];
    if (w <= 0 || h <= 0) return;
    const r = s * RAD;
    c.save();
    c.globalAlpha = alpha;
    if (glow > 0) { c.shadowColor = col(hex, 0.85); c.shadowBlur = s * glow; }
    c.fillStyle = shade(hex, 1);
    roundRect(c, b[0], b[1], w, h, r);
    c.fill();
    c.shadowBlur = 0;

    /* Fuß und Grat liegen INNEN: auf die Kachel beschnitten bleibt vom doppelt
       breiten Strich nur die innere Hälfte stehen — wie ein innerer Schatten. */
    roundRect(c, b[0], b[1], w, h, r);
    c.clip();
    const g = c.createLinearGradient(0, b[3] - h * 0.45, 0, b[3]);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,.45)");
    c.fillStyle = g;
    c.fillRect(b[0], b[1], w, h);
    const lw = Math.max(1.2, s * 0.05);
    c.lineWidth = lw * 2;
    c.strokeStyle = "rgba(255,255,255,.3)";
    roundRect(c, b[0], b[1], w, h, r);
    c.stroke();
    c.restore();
  }

  // Der Schattenriss der Landestelle: je Feld ein leerer Umriss.
  function ghost(c, x, y, s, hex, alpha) {
    const b = tileBox(x, y, s, s * PAD);
    const w = b[2] - b[0], h = b[3] - b[1];
    if (w <= 0 || h <= 0) return;
    const r = s * RAD;
    const lw = Math.max(1, s * 0.045);
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = col(hex, 0.08);
    roundRect(c, b[0], b[1], w, h, r);
    c.fill();
    c.lineWidth = lw;
    c.strokeStyle = col(hex, 0.85);
    roundRect(c, b[0] + lw / 2, b[1] + lw / 2, w - lw, h - lw, Math.max(0, r - lw / 2));
    c.stroke();
    c.restore();
  }

  // Ein weicher Lichtpunkt je Farbe, einmal gezeichnet und danach nur noch kopiert.
  const dots = {};
  function dot(hex) {
    let cv = dots[hex];
    if (!cv) {
      cv = document.createElement("canvas");
      cv.width = 64; cv.height = 64;
      const c = cv.getContext("2d");
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, col(hex, 1));
      g.addColorStop(0.3, col(hex, 0.55));
      g.addColorStop(1, col(hex, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
      dots[hex] = cv;
    }
    return cv;
  }

  /* Der Hintergrund des Feldes: Tiefe, zwei wandernde Schleier in der Farbe des
     Levels, ein Sternenfeld und das Raster der Zellen. */
  function backdrop(c, w, h, cell, t, hex, stars) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#04060c");
    g.addColorStop(0.55, "#070a13");
    g.addColorStop(1, "#0c1120");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);

    c.save();
    c.globalCompositeOperation = "lighter";
    for (let i = 0; i < 2; i++) {
      const ph = t / (i ? 9700 : 6300) + i * 2.1;
      const cx = w * (0.5 + 0.45 * Math.sin(ph));
      const cy = h * (0.5 + 0.4 * Math.cos(ph * 0.77 + i));
      const rad = Math.max(w, h) * (i ? 0.6 : 0.45);
      const rg = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
      rg.addColorStop(0, col(hex, i ? 0.12 : 0.17));
      rg.addColorStop(1, col(hex, 0));
      c.fillStyle = rg;
      c.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const a = s.a * (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t / 700 * s.f + s.p)));
      c.fillStyle = "rgba(255,255,255," + a.toFixed(3) + ")";
      c.fillRect(s.x * w, s.y * h, s.s, s.s);
    }
    c.restore();

    c.save();
    c.strokeStyle = col(hex, 0.075);
    c.lineWidth = 1;
    c.beginPath();
    for (let x = cell; x < w - 0.5; x += cell) {
      const px = Math.round(x) + 0.5;
      c.moveTo(px, 0); c.lineTo(px, h);
    }
    for (let y = cell; y < h - 0.5; y += cell) {
      const py = Math.round(y) + 0.5;
      c.moveTo(0, py); c.lineTo(w, py);
    }
    c.stroke();
    c.restore();
  }

  // Dunkler Saum außen, dazu ein farbiger Hauch in der Farbe des Levels.
  function vignette(c, w, h, hex, strength) {
    const r0 = Math.min(w, h) * 0.34;
    const r1 = Math.max(w, h) * 0.8;
    const g = c.createRadialGradient(w / 2, h / 2, r0, w / 2, h / 2, r1);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0," + (0.2 + 0.5 * strength).toFixed(3) + ")");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);

    c.save();
    c.globalCompositeOperation = "lighter";
    const g2 = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.5, w / 2, h / 2, r1);
    g2.addColorStop(0, col(hex, 0));
    g2.addColorStop(1, col(hex, 0.18 * strength));
    c.fillStyle = g2;
    c.fillRect(0, 0, w, h);
    c.restore();
  }

  return {
    PAD: PAD, RAD: RAD,
    col: col, shade: shade, typeColor: typeColor, levelColor: levelColor,
    roundRect: roundRect, tileBox: tileBox,
    block: block, ghost: ghost, dot: dot,
    backdrop: backdrop, vignette: vignette
  };
})();
