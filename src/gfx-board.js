/* Das Spielfeld in drei Dimensionen. Es bekommt bei jedem Bild den Spielzustand
   gereicht und gleicht seine Steine daran an — es rechnet nichts am Spiel, es
   zeigt es nur. Woran es Ereignisse erkennt (Aufsetzen, Fallenlassen, geräumte
   Reihen, Levelwechsel), sieht es allein am Vergleich zweier Zustände. Deshalb
   funktioniert dasselbe auch in der Wiedergabe. */
const TetrisBoard3D = (function () {
  const COLS = TetrisGfx.COLS;
  const ROWS = TetrisGfx.ROWS;
  const FOV = 52;
  const CELL_Z = 0;

  // So weit muss die Kamera weg, damit Feld und Rahmen ins Bild passen.
  function distanceFor(aspect) {
    const half = Math.tan((FOV * Math.PI / 180) / 2);
    return Math.max(11.7 / half, 6.7 / (half * Math.max(aspect, 0.2)));
  }

  /* Scheitert irgendetwas am Aufbau — kein WebGL, eine fehlende Fähigkeit der
     Bibliothek —, gibt es kein Ergebnis; die Oberfläche zeigt dann das flache Feld. */
  function create(canvas, getState) {
    if (!canvas || !TetrisGfx.available()) return null;
    try {
      return build(canvas, getState);
    } catch (e) {
      return null;
    }
  }

  function build(canvas, getState) {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x060911, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const res = TetrisGfx.resources();
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x070b16, 32, 88);
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 220);

    const arena = TetrisArena.create(scene, res);
    const fx = TetrisFx.create(scene, res);

    // --- Die liegenden Steine ---
    const locked = new THREE.Group();
    scene.add(locked);
    const grid = [];
    for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(null));
    const pool = [];

    function take(type, r, c) {
      const m = pool.length ? pool.pop() : TetrisGfx.block(res, type);
      const mm = res.mats[type];
      m.material = mm.frame;
      m.userData.gem.material = mm.gem;
      m.userData.type = type;
      m.userData.flashing = false;
      m.userData.y = TetrisGfx.cellY(r);
      m.userData.ty = m.userData.y;
      m.userData.born = 1;
      m.position.set(TetrisGfx.cellX(c), m.userData.y, CELL_Z);
      m.rotation.set(0, 0, 0);
      m.scale.set(1, 1, 1);
      m.visible = true;
      locked.add(m);
      return m;
    }

    function give(m) {
      locked.remove(m);
      pool.push(m);
    }

    // --- Der fallende Stein und sein Schattenriss ---
    const pieceGroup = new THREE.Group();
    scene.add(pieceGroup);
    const pieceCubes = [];
    const pieceGlow = [];
    for (let i = 0; i < 4; i++) {
      const m = TetrisGfx.block(res, "I");
      pieceGroup.add(m);
      pieceCubes.push(m);
      const sp = new THREE.Sprite(res.mats.I.glow);
      sp.scale.set(2.6, 2.6, 1);
      pieceGroup.add(sp);
      pieceGlow.push(sp);
    }

    const ghostGroup = new THREE.Group();
    scene.add(ghostGroup);
    const ghostPlates = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(res.geo.ghost, res.mats.I.ghost);
      m.visible = false;
      ghostGroup.add(m);
      ghostPlates.push(m);
    }

    // --- Was wir vom letzten Bild wissen ---
    let prevElapsed = -1;
    let prevLevel = -1;
    let prevClear = null;
    let prevCount = -1;     // wie viele Steine bisher kamen — daran hängt "ein neuer Stein"
    let prevPiece = null;   // {type, x, y, rot, top, cols}
    let pieceX = 0, pieceY = 0, spin = 0, pieceSnap = true;
    let dolly = 0;
    let time = 0;
    const look = new THREE.Vector3();

    /* Ein Bild gilt als Sprung, wenn die gespielte Zeit zurückläuft oder weit
       vorspringt — beim Spulen in der Wiedergabe. Dann wird nur gestellt, nicht
       gespielt: keine Splitter, kein Wackeln. */
    function isJump(g) {
      return prevElapsed < 0 || g.elapsed < prevElapsed - 1 || g.elapsed - prevElapsed > 400;
    }

    // Die Steinstatistik zählt jeden gezogenen Stein — ihre Summe ist seine Nummer.
    function pieceCount(g) {
      let n = 0;
      for (let i = 0; i < TetrisPieces.TYPES.length; i++) n += g.stats[TetrisPieces.TYPES[i]] || 0;
      return n;
    }

    /* Reihen sind gefallen: die Steine der geräumten Reihen zerspringen, alles
       darüber bekommt sein neues Ziel und rutscht dorthin. */
    function collapse(rows, quiet) {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        for (let c = 0; c < COLS; c++) {
          const m = grid[r][c];
          if (!m) continue;
          if (!quiet) {
            fx.burst(TetrisGfx.cellX(c), TetrisGfx.cellY(r), m.userData.type, 0.55 + rows.length * 0.12);
          }
          give(m);
          grid[r][c] = null;
        }
      }
      // Eine Reihe rutscht um so viele Reihen, wie unter ihr weggefallen sind.
      for (let r = ROWS - 1; r >= 0; r--) {
        let shift = 0;
        for (let i = 0; i < rows.length; i++) if (rows[i] > r) shift++;
        if (!shift) continue;
        for (let c = 0; c < COLS; c++) {
          const m = grid[r][c];
          grid[r + shift][c] = m;
          grid[r][c] = null;
          if (!m) continue;
          m.userData.ty = TetrisGfx.cellY(r + shift);
          if (quiet) {
            m.userData.y = m.userData.ty;
            m.position.y = m.userData.ty;
          }
        }
      }
    }

    // Gleicht das Gitter an das Brett an und meldet, was neu dazugekommen ist.
    function reconcile(g, quiet) {
      const fresh = [];
      const clearing = g.clearRows;
      for (let r = 0; r < ROWS; r++) {
        const isClearing = !!(clearing && clearing.indexOf(r) !== -1);
        for (let c = 0; c < COLS; c++) {
          const type = g.board[r][c];
          let m = grid[r][c];
          if (m && (!type || m.userData.type !== type)) { give(m); m = null; grid[r][c] = null; }
          if (type && !m) {
            m = take(type, r, c);
            grid[r][c] = m;
            if (quiet) m.userData.born = 0;
            else fresh.push([r, c, type]);
          }
          if (!m) continue;
          // Volle Reihen glühen weiß, bis sie verschwinden.
          if (isClearing !== m.userData.flashing) {
            m.userData.flashing = isClearing;
            m.material = isClearing ? res.flash.frame : res.mats[m.userData.type].frame;
            m.userData.gem.material = isClearing ? res.flash.gem : res.mats[m.userData.type].gem;
          }
        }
      }
      return fresh;
    }

    function updateBlocks(dt, t) {
      const pulse = 1 + Math.sin(t * 34) * 0.12;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const m = grid[r][c];
          if (!m) continue;
          const d = m.userData;
          if (Math.abs(d.y - d.ty) > 0.002) {
            d.y = TetrisGfx.ease(d.y, d.ty, 0.00002, dt);
            m.position.y = d.y;
          }
          if (d.born > 0) {
            d.born = Math.max(0, d.born - dt * 7);
            const s = 1 + d.born * d.born * 0.5;
            m.scale.set(s, s, 1 + d.born * 1.2);
          } else if (d.flashing) {
            m.scale.set(pulse, pulse, pulse);
          } else if (m.scale.x !== 1) {
            m.scale.set(1, 1, 1);
          }
        }
      }
    }

    // Der fallende Stein: er gleitet zu seinem Platz und dreht sich in seine Lage hinein.
    function updatePiece(g, dt, quiet, isNew) {
      const p = g.piece;
      if (!p || g.over) {
        pieceGroup.visible = false;
        arena.pieceLight.intensity = TetrisGfx.ease(arena.pieceLight.intensity, 0, 0.001, dt);
        return;
      }
      pieceGroup.visible = true;
      const n = TetrisPieces.SIZE[p.type];
      const mid = (n - 1) / 2;
      const tx = TetrisGfx.cellX(p.x + mid);
      const ty = TetrisGfx.cellY(p.y + mid);

      if (isNew || quiet || pieceSnap) {
        pieceX = tx; pieceY = ty; spin = 0; pieceSnap = false;
        if (isNew && !quiet) pieceY = ty + 1.2; // neue Steine gleiten von oben herein
      } else if (prevPiece && prevPiece.rot !== p.rot) {
        const dir = ((p.rot - prevPiece.rot + 4) % 4) === 1 ? 1 : -1;
        spin = dir * Math.PI / 2;
      }
      pieceX = TetrisGfx.ease(pieceX, tx, 0.000002, dt);
      pieceY = TetrisGfx.ease(pieceY, ty, 0.0000001, dt);
      spin = TetrisGfx.ease(spin, 0, 0.000004, dt);

      pieceGroup.position.set(pieceX, pieceY, CELL_Z);
      pieceGroup.rotation.z = spin;

      const cells = TetrisGfx.pieceCells(p.type, p.rot);
      const mm = res.mats[p.type];
      const beat = 0.9 + Math.sin(time * 6) * 0.1;
      for (let i = 0; i < 4; i++) {
        const cube = pieceCubes[i];
        const sp = pieceGlow[i];
        const cell = cells[i];
        if (!cell) { cube.visible = false; sp.visible = false; continue; }
        cube.visible = true;
        sp.visible = true;
        cube.material = mm.frame;
        cube.userData.gem.material = mm.gem;
        cube.position.set(cell[0], cell[1], 0.05);
        sp.material = mm.glow;
        sp.position.set(cell[0], cell[1], -0.5);
        sp.scale.setScalar(2.4 * beat);
      }

      arena.pieceLight.color.copy(mm.color);
      arena.pieceLight.position.set(pieceX, pieceY, 2.6);
      arena.pieceLight.intensity = TetrisGfx.ease(arena.pieceLight.intensity, 1.7 * beat, 0.002, dt);
    }

    function updateGhost(g) {
      let used = 0;
      if (g.piece && !g.over) {
        const cells = TetrisEngine.renderCells(g);
        for (let i = 0; i < cells.length && used < 4; i++) {
          if (cells[i].kind !== "ghost") continue;
          const m = ghostPlates[used++];
          m.material = res.mats[cells[i].type].ghost;
          m.position.set(TetrisGfx.cellX(i % COLS), TetrisGfx.cellY(Math.floor(i / COLS)), -0.3);
          m.visible = true;
        }
      }
      for (let i = used; i < 4; i++) ghostPlates[i].visible = false;
    }

    /* Setzt ein Stein auf, gibt es eine Druckwelle. Kam er aus großer Höhe, war es
       ein Fallenlassen — dann zieht er zusätzlich Lichtbahnen hinter sich her. */
    function impact(fresh) {
      let low = 0, sx = 0;
      const type = fresh[0][2];
      for (let i = 0; i < fresh.length; i++) {
        low = Math.max(low, fresh[i][0]);
        sx += fresh[i][1];
      }
      const color = res.mats[type].color;
      fx.ring(TetrisGfx.cellX(sx / fresh.length), TetrisGfx.cellY(low) - 0.2, color, 1);
      for (let i = 0; i < fresh.length; i++) {
        fx.burst(TetrisGfx.cellX(fresh[i][1]), TetrisGfx.cellY(fresh[i][0]) - 0.4, type, 0.16);
      }
      /* Zwischen der letzten gesehenen Lage des Steins und dem Ort, an dem er
         liegt, klafft nur dann eine Lücke, wenn er fallen gelassen wurde. */
      const fall = prevPiece ? low - prevPiece.top : 0;
      if (fall > 5) {
        for (let i = 0; i < prevPiece.cols.length; i++) {
          fx.streak(TetrisGfx.cellX(prevPiece.cols[i]), TetrisGfx.cellY(prevPiece.top), TetrisGfx.cellY(low), color);
        }
        fx.kick(0.34);
        fx.bang(0.16);
      } else {
        fx.kick(0.12);
      }
    }

    /* Was für den Vergleich beim nächsten Bild gebraucht wird. Die letzte Lage des
       Steins bleibt über sein Einrasten hinaus stehen — die Fallspur braucht sie. */
    function remember(g, count) {
      prevElapsed = g.elapsed;
      prevLevel = g.level;
      prevCount = count;
      prevClear = g.clearRows ? g.clearRows.slice() : null;
      if (g.piece) {
        const cells = TetrisPieces.SHAPES[g.piece.type][g.piece.rot];
        let top = ROWS;
        const cols = [];
        for (let i = 0; i < cells.length; i++) {
          top = Math.min(top, g.piece.y + cells[i][1]);
          if (cols.indexOf(g.piece.x + cells[i][0]) === -1) cols.push(g.piece.x + cells[i][0]);
        }
        prevPiece = { type: g.piece.type, x: g.piece.x, y: g.piece.y, rot: g.piece.rot, top: top, cols: cols };
      }
    }

    function step(g, dt) {
      const quiet = isJump(g);
      const count = pieceCount(g);
      const isNew = quiet || count !== prevCount;

      // Erst die gefallenen Reihen, dann alles andere — sonst stimmt das Gitter nicht.
      let collapsed = false;
      if (prevClear && !g.clearRows) {
        collapse(prevClear, quiet);
        collapsed = true;
        if (!quiet) {
          fx.bang(0.3);
          fx.kick(0.3 + prevClear.length * 0.12);
        }
      }

      const fresh = reconcile(g, quiet);

      // Neue liegende Steine ohne gefallene Reihen: hier ist eben einer aufgesetzt.
      if (!quiet && !collapsed && fresh.length) impact(fresh);

      // Volle Reihen kündigen sich mit Blitz und Stoß an.
      if (!quiet && g.clearRows && !prevClear) {
        const n = g.clearRows.length;
        fx.bang(0.34 + n * 0.16);
        fx.kick(0.2 + n * 0.16);
        arena.flashLight.intensity = 2.2 + n * 1.4;
      }

      if (g.level !== prevLevel) {
        arena.setLevel(g.level);
        if (!quiet && prevLevel >= 0) { fx.bang(0.4); fx.kick(0.3); }
      }
      arena.setOver(!!g.over);

      updateBlocks(dt, time);
      updatePiece(g, dt, quiet, isNew);
      updateGhost(g);
      remember(g, count);
    }

    // --- Bildtakt ---
    let raf = 0;
    let last = 0;
    let w = 0, h = 0;

    function loop(now) {
      raf = requestAnimationFrame(loop);
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0.016;
      last = now;
      time += dt;

      const cw = canvas.clientWidth | 0;
      const ch = canvas.clientHeight | 0;
      if (!cw || !ch) return;
      if (cw !== w || ch !== h) {
        w = cw; h = ch;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }

      const g = getState();
      if (g) step(g, dt);

      arena.flashLight.intensity = Math.max(0, arena.flashLight.intensity - dt * 14);
      arena.update(dt, time);
      fx.update(dt, time);

      dolly = TetrisGfx.ease(dolly, g && g.over ? 4.5 : 0, 0.06, dt);
      const dist = distanceFor(camera.aspect) + dolly;
      camera.position.set(
        Math.sin(time * 0.17) * 0.85 + fx.shake.x,
        1.35 + Math.sin(time * 0.23) * 0.45 + fx.shake.y,
        dist
      );
      look.set(fx.shake.x * 0.35, 0.35 + fx.shake.y * 0.2, 0);
      camera.lookAt(look);

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(loop);

    function dispose() {
      cancelAnimationFrame(raf);
      TetrisGfx.dispose(res);
      renderer.dispose();
      if (typeof renderer.forceContextLoss === "function") {
        try { renderer.forceContextLoss(); } catch (e) { /* nicht überall vorhanden */ }
      }
    }

    return { dispose: dispose };
  }

  return { create: create };
})();
