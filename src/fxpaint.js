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

  function roundRect(c, x, y, w, h, r) {
    const k = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + k, y);
    c.lineTo(x + w - k, y); c.quadraticCurveTo(x + w, y, x + w, y + k);
    c.lineTo(x + w, y + h - k); c.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
    c.lineTo(x + k, y + h); c.quadraticCurveTo(x, y + h, x, y + h - k);
    c.lineTo(x, y + k); c.quadraticCurveTo(x, y, x + k, y);
    c.closePath();
  }

  /* Eine Kachel: Verlauf von der hellen Kante zum dunklen Fuß, ein Grat aus Licht
     und ein glühender Kern. glow > 0 legt zusätzlich einen Schein darum. */
  function block(c, x, y, s, hex, alpha, glow) {
    const pad = s * 0.07;
    const r = s * 0.2;
    const bx = x + pad, by = y + pad, bs = s - pad * 2;
    if (bs <= 0) return;
    c.save();
    c.globalAlpha = alpha;
    if (glow > 0) { c.shadowColor = col(hex, 0.85); c.shadowBlur = s * glow; }
    const g = c.createLinearGradient(bx, by, bx + bs * 0.4, by + bs);
    g.addColorStop(0, shade(hex, 1.5));
    g.addColorStop(0.45, shade(hex, 1.02));
    g.addColorStop(1, shade(hex, 0.5));
    c.fillStyle = g;
    roundRect(c, bx, by, bs, bs, r);
    c.fill();
    c.shadowBlur = 0;
    const lw = Math.max(1, s * 0.07);
    c.lineWidth = lw;
    c.strokeStyle = shade(hex, 1.9, 0.5);
    roundRect(c, bx + lw / 2, by + lw / 2, bs - lw, bs - lw, r * 0.85);
    c.stroke();
    c.globalCompositeOperation = "lighter";
    c.fillStyle = col(hex, 0.2);
    roundRect(c, bx + bs * 0.22, by + bs * 0.22, bs * 0.56, bs * 0.56, r * 0.6);
    c.fill();
    c.restore();
  }

  // Der Schattenriss der Landestelle: gestrichelter Umriss, kaum gefüllt.
  function ghost(c, x, y, s, hex, alpha) {
    const pad = s * 0.13;
    const w = s - pad * 2;
    if (w <= 0) return;
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = col(hex, 0.09);
    roundRect(c, x + pad, y + pad, w, w, s * 0.16);
    c.fill();
    c.lineWidth = Math.max(1, s * 0.08);
    c.strokeStyle = col(hex, 0.95);
    c.setLineDash([s * 0.2, s * 0.15]);
    c.stroke();
    c.setLineDash([]);
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

  // Dunkler Saum außen, dazu ein farbiger Hauch — und ein Hauch Röhrenbildschirm.
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

  function scanlines(c, w, h) {
    c.save();
    c.fillStyle = "rgba(0,0,0,.16)";
    for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
    c.restore();
  }

  return {
    col: col, shade: shade, typeColor: typeColor, levelColor: levelColor,
    roundRect: roundRect, block: block, ghost: ghost, dot: dot,
    backdrop: backdrop, vignette: vignette, scanlines: scanlines
  };
})();
