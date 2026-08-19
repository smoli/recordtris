/* Die Bildschau des Spielfelds. Ein eigener Bildtakt zeichnet fortlaufend den
   neuesten Spielzustand — mit Nachglühen, Funken, Lichtsäulen und Erschütterung.
   Sie liest den Zustand nur; verändert wird er allein in engine.js.

   Woher sie weiß, was geschehen ist: Was man dem Zustand ansieht (volle Reihen,
   Level, Punkte, Spielende), erkennt sie am Vergleich mit dem letzten Bild — das
   gilt auch für die Wiedergabe. Was man ihm nicht ansieht (Drehung, Fallenlassen,
   Einrasten), meldet die Regel selbst über das Band state.fx. */
const TetrisFx = (function () {
  const COLS = 10, ROWS = 20;
  const MAX_PARTS = 520;
  const TAU = Math.PI * 2;
  const P = TetrisPaint;
  const MASK = P.MASK;

  /* An welchen Seiten dieser Zelle liegt ein Nachbar desselben Steins? Nur so
     weiß der Pinsel, welche Kante nach außen zeigt und welche zuwachsen darf. */
  function cellsMask(cells, i) {
    const cx = cells[i][0], cy = cells[i][1];
    let m = 0;
    for (let j = 0; j < cells.length; j++) {
      if (j === i) continue;
      const dx = cells[j][0] - cx, dy = cells[j][1] - cy;
      if (dx === 0 && dy === -1) m |= MASK.UP;
      else if (dx === 1 && dy === 0) m |= MASK.RIGHT;
      else if (dx === 0 && dy === 1) m |= MASK.DOWN;
      else if (dx === -1 && dy === 0) m |= MASK.LEFT;
    }
    return m;
  }

  // Im Stapel wachsen nur gleiche Steinsorten zusammen — Grenzen bleiben sichtbar.
  function boardMask(board, r, c) {
    const type = board[r][c];
    let m = 0;
    if (r > 0 && board[r - 1][c] === type) m |= MASK.UP;
    if (c < COLS - 1 && board[r][c + 1] === type) m |= MASK.RIGHT;
    if (r < ROWS - 1 && board[r + 1][c] === type) m |= MASK.DOWN;
    if (c > 0 && board[r][c - 1] === type) m |= MASK.LEFT;
    return m;
  }

  function create(canvas) {
    const ctx = canvas.getContext("2d");
    const bloom = document.createElement("canvas");
    const bctx = bloom.getContext("2d");

    let w = 0, h = 0, cell = 0, ox = 0, oy = 0, dpr = 1, bk = 1;
    let raf = 0, alive = true, last = 0, t = 0;
    let game = null, stars = [];
    let shake = 0, flash = 0, flashHex = "#ffffff";
    let vy = null, vyPiece = null; // die gezeichnete Höhe des Steins und wessen sie ist

    const parts = [], rings = [], beams = [], bars = [], texts = [], trail = [];
    const prev = { word: null, elapsed: null, level: null, score: null,
                   clearKey: "", over: false, mark: null, clearY: 0 };

    // --- Maße ---

    function resize() {
      const rw = canvas.clientWidth, rh = canvas.clientHeight;
      if (!rw || !rh) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rw; h = rh;
      cell = Math.min(w / COLS, h / ROWS);
      ox = (w - cell * COLS) / 2;
      oy = (h - cell * ROWS) / 2;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      bloom.width = Math.max(1, Math.round(w * dpr * 0.34));
      bloom.height = Math.max(1, Math.round(h * dpr * 0.34));
      bk = bloom.width / w;
      stars = [];
      for (let i = 0; i < 70; i++) {
        stars.push({ x: Math.random(), y: Math.random(), s: Math.random() < 0.8 ? 1 : 2,
                     a: 0.15 + Math.random() * 0.5, f: 0.6 + Math.random() * 1.8, p: Math.random() * TAU });
      }
    }

    // --- Was gezeigt werden soll ---

    function spark(x, y, hex, vx, vy, life, size, kind) {
      if (parts.length >= MAX_PARTS) return;
      parts.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, hex: hex,
                   size: size, kind: kind || "dot",
                   rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.02 });
    }
    function burst(x, y, hex, n, speed, life, size, kind) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const v = speed * (0.3 + Math.random());
        spark(x, y, hex, Math.cos(a) * v, Math.sin(a) * v, life * (0.6 + Math.random() * 0.7), size, kind);
      }
    }
    function ring(x, y, hex, rMax, life, width) {
      rings.push({ x: x, y: y, hex: hex, rMax: rMax, life: life, max: life, width: width });
    }
    function say(x, y, text, hex, size, life) {
      texts.push({ x: x, y: y, text: text, hex: hex, size: size, life: life, max: life });
    }
    function reset(g) {
      parts.length = 0; rings.length = 0; beams.length = 0;
      bars.length = 0; texts.length = 0; trail.length = 0;
      shake = 0; flash = 0;
      prev.level = g ? g.level : null;
      prev.score = g ? g.score : null;
      prev.clearKey = g && g.clearRows ? g.clearRows.join(",") : "";
      prev.over = g ? g.over : false;
      prev.mark = null;
      vy = null; vyPiece = null;
    }

    /* Wie weit der Stein zwischen zwei Feldern schon unterwegs ist — 0 bis 1.
       Voll bis 1 gezählt: 1 ist genau das nächste Feld, deshalb geht die Bewegung
       ohne Sprung in den nächsten Schritt der Regel über. */
    function pieceFrac(g) {
      if (!g.piece || g.over || g.paused || g.clearRows) return 0;
      if (TetrisEngine.dropDistance(g) <= 0) return 0;
      const iv = TetrisPieces.gravityMs(g.level);
      if (!(iv > 0)) return 0;
      return Math.max(0, Math.min(1, g.dropTimer / iv));
    }

    // Der Rahmen des ganzen Steins in Bildpunkten — über ihn läuft der Farbverlauf.
    function cellsFrame(cells, px, py) {
      let x0 = cells[0][0], x1 = x0, y0 = cells[0][1], y1 = y0;
      for (let i = 1; i < cells.length; i++) {
        if (cells[i][0] < x0) x0 = cells[i][0];
        if (cells[i][0] > x1) x1 = cells[i][0];
        if (cells[i][1] < y0) y0 = cells[i][1];
        if (cells[i][1] > y1) y1 = cells[i][1];
      }
      return [(px + x0) * cell, (py + y0) * cell,
              (x1 - x0 + 1) * cell, (y1 - y0 + 1) * cell];
    }

    /* Die Meldungen der Regel: Drehung, Fallenlassen, Einrasten. */
    function handle(ev) {
      const hex = P.typeColor(ev.type);
      const cells = TetrisPieces.SHAPES[ev.type] ? TetrisPieces.SHAPES[ev.type][ev.rot] : null;
      if (!cells) return;
      if (ev.k === "rot") {
        let sx = 0, sy = 0;
        for (let i = 0; i < cells.length; i++) { sx += ev.x + cells[i][0] + 0.5; sy += ev.y + cells[i][1] + 0.5; }
        ring(sx / cells.length * cell, sy / cells.length * cell, hex, cell * 1.6, 280, cell * 0.1);
        return;
      }
      if (ev.k === "drop") {
        // Über jede Spalte des Steins eine Lichtsäule, vom Absprung bis zum Aufschlag.
        const deep = {};
        for (let i = 0; i < cells.length; i++) {
          const c = ev.x + cells[i][0];
          if (deep[c] === undefined || cells[i][1] > deep[c]) deep[c] = cells[i][1];
        }
        for (const key in deep) {
          const c = Number(key);
          beams.push({ x: c * cell, w: cell, hex: hex, life: 340, max: 340,
                       y0: (ev.from + deep[key]) * cell, y1: (ev.to + deep[key] + 1) * cell });
          burst((c + 0.5) * cell, (ev.to + deep[key] + 1) * cell, hex,
                4, cell * 0.006, 420, cell * 0.12, "dot");
        }
        shake = Math.min(16, shake + 2.5 + ev.dist * 0.5);
        return;
      }
      if (ev.k === "lock") {
        for (let i = 0; i < cells.length; i++) {
          const x = (ev.x + cells[i][0] + 0.5) * cell;
          const y = (ev.y + cells[i][1] + 1) * cell;
          burst(x, y, hex, 3, cell * 0.004, 380, cell * 0.1, "dot");
        }
        shake = Math.min(12, shake + 1.8);
      }
    }

    /* Volle Reihen: gleißender Balken, Splitter in den Farben der Steine, eine
       Druckwelle und ein Aufblitzen, das mit der Zahl der Reihen wächst. */
    function clearBurst(g, rows) {
      const n = rows.length;
      for (let i = 0; i < n; i++) {
        const r = rows[i];
        bars.push({ row: r, life: 420, max: 420 });
        for (let c = 0; c < COLS; c++) {
          const hex = P.typeColor(g.board[r][c]);
          burst((c + 0.5) * cell, (r + 0.5) * cell, hex,
                n >= 4 ? 5 : 3, cell * 0.009, 620, cell * 0.14,
                Math.random() < 0.45 ? "shard" : "dot");
        }
        ring(COLS * cell / 2, (r + 0.5) * cell, "#ffffff", cell * 8, 460, cell * 0.14);
      }
      prev.clearY = (rows[0] + 0.5) * cell;
      shake = Math.min(28, shake + 5 + n * 4);
      flash = Math.min(1, flash + 0.15 * n);
      flashHex = n >= 4 ? P.levelColor(g.level) : "#ffffff";
      if (n >= 4) say(COLS * cell / 2, prev.clearY, "TETRIS", "#ffffff", cell * 1.1, 1200);
      else if (n === 3) say(COLS * cell / 2, prev.clearY, "DREIFACH", "#ffe040", cell * 0.7, 900);
    }

    function levelUp(g) {
      const hex = P.levelColor(g.level);
      flash = Math.max(flash, 0.32);
      flashHex = hex;
      ring(COLS * cell / 2, ROWS * cell / 2, hex, cell * 12, 850, cell * 0.32);
      burst(COLS * cell / 2, ROWS * cell / 2, hex, 30, cell * 0.009, 1000, cell * 0.18, "dot");
      say(COLS * cell / 2, ROWS * cell * 0.3, "LEVEL " + g.level, hex, cell * 0.8, 1400);
    }

    function gameOver(g) {
      flash = 0.7; flashHex = "#ff5c78";
      shake = 24;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!g.board[r][c] || Math.random() > 0.5) continue;
          spark((c + 0.5) * cell, (r + 0.5) * cell, P.typeColor(g.board[r][c]),
                (Math.random() - 0.5) * cell * 0.006, -Math.random() * cell * 0.005,
                800 + Math.random() * 700, cell * 0.16, "shard");
        }
      }
    }

    // --- Fortschreiben ---

    function watch(g) {
      const key = g.clearRows ? g.clearRows.join(",") : "";
      if (key && key !== prev.clearKey) clearBurst(g, g.clearRows);
      prev.clearKey = key;

      if (prev.level !== null && g.level > prev.level) levelUp(g);
      prev.level = g.level;

      if (prev.score !== null && g.score - prev.score >= 40) {
        say(COLS * cell / 2, prev.clearY || ROWS * cell * 0.45, "+" + (g.score - prev.score),
            P.levelColor(g.level), cell * 0.62, 950);
      }
      prev.score = g.score;

      if (g.over && !prev.over) gameOver(g);
      prev.over = g.over;
    }

    function step(dt) {
      t += dt;
      const g = game;
      if (g) {
        // Ein neues Spiel — oder ein Sprung zurück in der Aufzeichnung — räumt auf.
        if (prev.word !== g.seedWord || prev.elapsed === null || g.elapsed < prev.elapsed - 1) reset(g);
        prev.word = g.seedWord;
        prev.elapsed = g.elapsed;
        if (g.fx && g.fx.length) {
          for (let i = 0; i < g.fx.length; i++) handle(g.fx[i]);
          g.fx.length = 0;
        }
        watch(g);

        /* Die gezeichnete Höhe des Steins zieht der Regel weich nach. Zwischen zwei
           Feldern gleitet sie ohnehin mit; das Nachziehen glättet zusätzlich die
           Sprünge, die die Regel selbst macht — vor allem beim Halten von "ein Feld
           tiefer", wo der Stein sonst im Raster hüpft. Ein neuer Stein oder ein
           weiter Sprung setzt sie sofort, damit nichts hinterherschleift. */
        if (g.piece && !g.over) {
          const target = g.piece.y + pieceFrac(g);
          if (vy === null || vyPiece !== g.piece || g.paused || Math.abs(target - vy) > 2.5) {
            vy = target;
          } else {
            vy += (target - vy) * (1 - Math.pow(0.004, dt / 90));
            if (Math.abs(target - vy) < 0.004) vy = target;
          }
          vyPiece = g.piece;
        } else { vy = null; vyPiece = null; }

        // Das Nachglühen: abgetastet wird die gleitende Lage, nicht das Feldraster.
        if (g.piece && !g.over && !g.paused) {
          const p = g.piece;
          const m = prev.mark;
          if (!m || m.type !== p.type || m.rot !== p.rot || m.x !== p.x ||
              Math.abs(vy - m.y) >= 0.26) {
            prev.mark = { type: p.type, rot: p.rot, x: p.x, y: vy };
            trail.push({ type: p.type, rot: p.rot, x: p.x, y: vy, life: 190, max: 190 });
            if (trail.length > 12) trail.shift();
          }
        } else prev.mark = null;
      }

      const grav = cell * 0.00001;
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i];
        q.life -= dt;
        if (q.life <= 0) { parts.splice(i, 1); continue; }
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vy += grav * dt;
        q.vx *= 0.995;
        q.rot += q.vr * dt;
      }
      decay(rings, dt); decay(beams, dt); decay(bars, dt); decay(texts, dt); decay(trail, dt);

      const k = dt / 16.7;
      shake *= Math.pow(0.86, k);
      flash *= Math.pow(0.85, k);
      if (shake < 0.15) shake = 0;
      if (flash < 0.004) flash = 0;
    }

    function decay(list, dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].life -= dt;
        if (list[i].life <= 0) list.splice(i, 1);
      }
    }

    // --- Zeichnen ---

    /* Die Szene wird zweimal gezeichnet: einmal fein auf das sichtbare Bild und
       einmal grob auf eine kleine Fläche, die danach weich und additiv darüber
       kommt — daher das Glühen. */
    function scene(c, hi) {
      const g = game;
      c.save();
      c.translate(ox, oy);
      if (g) {
        drawBoard(c, g, hi);
        drawBars(c);
        drawTrail(c);
        drawGhost(c, g, hi);
        drawPiece(c, g, hi);
      }
      drawBeams(c);
      drawRings(c);
      drawParts(c);
      if (hi) drawTexts(c);
      c.restore();
    }

    function drawBoard(c, g, hi) {
      const dim = g.over ? 0.5 : 1;
      for (let r = 0; r < ROWS; r++) {
        const hot = g.clearRows && g.clearRows.indexOf(r) !== -1;
        for (let cc = 0; cc < COLS; cc++) {
          const type = g.board[r][cc];
          if (!type) continue;
          const hex = hot ? "#ffffff" : P.typeColor(type);
          const x = cc * cell, y = r * cell;
          if (hi) P.block(c, x, y, cell, hex, dim, hot ? 0.8 : 0, boardMask(g.board, r, cc));
          else {
            c.fillStyle = P.col(hex, hot ? 0.95 : 0.4 * dim);
            c.fillRect(x, y, cell, cell);
          }
        }
      }
    }

    function drawGhost(c, g, hi) {
      if (!g.piece || g.over) return;
      const d = TetrisEngine.dropDistance(g);
      if (d <= 0) return;
      const p = g.piece;
      const cells = TetrisPieces.SHAPES[p.type][p.rot];
      const hex = P.typeColor(p.type);
      const a = 0.5 + 0.2 * Math.sin(t / 260);
      for (let i = 0; i < cells.length; i++) {
        const y = p.y + cells[i][1] + d;
        if (y < 0) continue;
        const x = (p.x + cells[i][0]) * cell;
        if (hi) P.ghost(c, x, y * cell, cell, hex, a, cellsMask(cells, i));
        else { c.fillStyle = P.col(hex, 0.1); c.fillRect(x, y * cell, cell, cell); }
      }
    }

    /* Gezeichnet wird die nachgezogene Höhe vy, nicht die des Spielstands: Der Stein
       gleitet zwischen zwei Feldern weiter — die volle Feldbreite, denn erst dann
       geht der letzte Bildpunkt nahtlos in den nächsten Schritt der Regel über. */
    function drawPiece(c, g, hi) {
      if (!g.piece || g.over) return;
      const p = g.piece;
      const cells = TetrisPieces.SHAPES[p.type][p.rot];
      const hex = P.typeColor(p.type);
      const py = vy === null ? p.y : vy;
      const frame = cellsFrame(cells, p.x, py);
      const glow = 0.5 + 0.25 * Math.sin(t / 190);
      for (let i = 0; i < cells.length; i++) {
        const y = py + cells[i][1];
        if (y < -1) continue;
        const x = (p.x + cells[i][0]) * cell;
        if (hi) P.block(c, x, y * cell, cell, hex, 1, glow, cellsMask(cells, i), frame);
        else { c.fillStyle = P.col(hex, 0.8); c.fillRect(x, y * cell, cell, cell); }
      }
    }

    function drawTrail(c) {
      c.save();
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < trail.length; i++) {
        const q = trail[i];
        const k = q.life / q.max;
        const a = 0.22 * k * k;
        if (a < 0.008) continue;
        const cells = TetrisPieces.SHAPES[q.type][q.rot];
        c.fillStyle = P.col(P.typeColor(q.type), a);
        for (let j = 0; j < cells.length; j++) {
          const m = cellsMask(cells, j);
          const b = P.tileBox((q.x + cells[j][0]) * cell, (q.y + cells[j][1]) * cell,
                              cell, cell * 0.05, m);
          P.roundRect(c, b[0], b[1], b[2] - b[0], b[3] - b[1], P.tileRadii(cell * 0.26, m));
          c.fill();
        }
      }
      c.restore();
    }

    function drawBars(c) {
      c.save();
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < bars.length; i++) {
        const b = bars[i];
        const k = b.life / b.max;
        const y = b.row * cell;
        const grow = (1 - k) * cell * 1.4;
        const g = c.createLinearGradient(0, y - grow, 0, y + cell + grow);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.5, "rgba(255,255,255," + (0.85 * k).toFixed(3) + ")");
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = g;
        c.fillRect(-cell, y - grow, cell * (COLS + 2), cell + grow * 2);
      }
      c.restore();
    }

    function drawBeams(c) {
      c.save();
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < beams.length; i++) {
        const b = beams[i];
        const k = b.life / b.max;
        const g = c.createLinearGradient(0, b.y0, 0, b.y1);
        g.addColorStop(0, P.col(b.hex, 0));
        g.addColorStop(1, P.col(b.hex, 0.7 * k));
        c.fillStyle = g;
        const inset = (1 - k) * b.w * 0.34;
        c.fillRect(b.x + inset, b.y0, b.w - inset * 2, Math.max(0, b.y1 - b.y0));
      }
      c.restore();
    }

    function drawRings(c) {
      c.save();
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < rings.length; i++) {
        const r = rings[i];
        const k = 1 - r.life / r.max;
        const rad = r.rMax * (1 - (1 - k) * (1 - k));
        if (rad <= 0) continue;
        c.strokeStyle = P.col(r.hex, 0.65 * (1 - k));
        c.lineWidth = Math.max(1, r.width * (1 - k));
        c.beginPath();
        c.arc(r.x, r.y, rad, 0, TAU);
        c.stroke();
      }
      c.restore();
    }

    function drawParts(c) {
      c.save();
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < parts.length; i++) {
        const q = parts[i];
        const k = q.life / q.max;
        const a = Math.min(1, k * 1.7);
        if (q.kind === "shard") {
          c.save();
          c.translate(q.x, q.y);
          c.rotate(q.rot);
          c.fillStyle = P.col(q.hex, a);
          c.fillRect(-q.size / 2, -q.size / 2, q.size, q.size * 0.7);
          c.restore();
        } else {
          const s = q.size * (0.5 + k);
          c.globalAlpha = a;
          c.drawImage(P.dot(q.hex), q.x - s, q.y - s, s * 2, s * 2);
          c.globalAlpha = 1;
        }
      }
      c.restore();
    }

    function drawTexts(c) {
      for (let i = 0; i < texts.length; i++) {
        const q = texts[i];
        const k = q.life / q.max;
        const grow = Math.min(1, (1 - k) * 6);
        c.save();
        c.globalAlpha = Math.min(1, k * 2.4);
        c.translate(q.x, q.y - (1 - k) * cell * 1.6);
        c.scale(0.6 + 0.4 * grow, 0.6 + 0.4 * grow);
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.font = "800 " + q.size.toFixed(1) + "px 'Segoe UI', system-ui, sans-serif";
        c.lineWidth = Math.max(2, q.size * 0.16);
        c.strokeStyle = "rgba(0,0,0,.6)";
        c.strokeText(q.text, 0, 0);
        c.shadowColor = q.hex;
        c.shadowBlur = q.size * 0.8;
        c.fillStyle = "#ffffff";
        c.fillText(q.text, 0, 0);
        c.fillStyle = q.hex;
        c.globalAlpha *= 0.55;
        c.fillText(q.text, 0, 0);
        c.restore();
      }
    }

    function draw() {
      const g = game;
      const hex = g ? P.levelColor(g.level) : "#6ea8ff";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      P.backdrop(ctx, w, h, cell, t, hex, stars);

      const sx = shake ? (Math.random() * 2 - 1) * shake : 0;
      const sy = shake ? (Math.random() * 2 - 1) * shake : 0;
      ctx.translate(sx, sy);
      bctx.setTransform(bk, 0, 0, bk, sx * bk, sy * bk);
      bctx.clearRect(-sx, -sy, w, h);

      scene(ctx, true);
      scene(bctx, false);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.75;
      ctx.filter = "blur(" + Math.max(2, cell * 0.28).toFixed(1) + "px)";
      ctx.drawImage(bloom, 0, 0, w, h);
      ctx.restore();

      if (flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = P.col(flashHex, Math.min(0.8, flash));
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      const over = !!(g && g.over);
      P.vignette(ctx, w, h, over ? "#ff5c78" : hex, over ? 0.6 : 0.32);
    }

    // --- Bildtakt ---

    function frame(now) {
      if (!alive) return;
      if (canvas.clientWidth !== w || canvas.clientHeight !== h) resize();
      const dt = last ? Math.min(now - last, 50) : 16;
      last = now;
      if (w > 0 && h > 0) { step(dt); draw(); }
      raf = requestAnimationFrame(frame);
    }

    resize();
    raf = requestAnimationFrame(frame);

    return {
      setGame: function (g) { game = g; },
      destroy: function () { alive = false; cancelAnimationFrame(raf); }
    };
  }

  return { create: create };
})();
