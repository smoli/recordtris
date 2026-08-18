/* Die Bausteine der 3D-Darstellung: die Prüfung, ob WebGL überhaupt geht, die
   selbst gezeichneten Texturen, die Werkstoffe der Steine und ihre Geometrien.
   Jede Ansicht (Spielfeld, Vorschau) legt sich einen eigenen Satz an — zwei
   WebGL-Kontexte können sich keine Ressourcen teilen. */
const TetrisGfx = (function () {
  // Etwas kräftiger als die Flächenfarben der 2D-Fassung: im Licht wirkt sonst alles blass.
  const COLORS = {
    I: 0x35d6e8, J: 0x5578ff, L: 0xffa11a,
    O: 0xffd93b, S: 0x44e88f, T: 0xc06cff, Z: 0xff5570
  };

  const COLS = 10;
  const ROWS = 20;

  // Feldkoordinaten in Weltkoordinaten: die Mitte des Feldes ist der Ursprung,
  // ein Feld ist genau eine Einheit groß.
  function cellX(c) { return c - (COLS - 1) / 2; }
  function cellY(r) { return (ROWS - 1) / 2 - r; }

  let checked = null;
  function available() {
    if (checked !== null) return checked;
    checked = false;
    if (typeof THREE === "undefined") return checked;
    try {
      const probe = document.createElement("canvas");
      checked = !!(probe.getContext("webgl") || probe.getContext("experimental-webgl"));
    } catch (e) {
      checked = false;
    }
    return checked;
  }

  function paint(size, draw) {
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    draw(cv.getContext("2d"), size);
    return cv;
  }

  /* Eine Umgebung zum Spiegeln — hell von oben, dunkel nach unten. Ohne sie bliebe
     metallisches Material schwarz, denn es hat nichts, was es zurückwerfen könnte. */
  function envMap() {
    const wall = paint(128, (g, s) => {
      const grd = g.createLinearGradient(0, 0, 0, s);
      grd.addColorStop(0, "#44557f");
      grd.addColorStop(0.5, "#171e30");
      grd.addColorStop(1, "#05070c");
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
    });
    const top = paint(128, (g, s) => {
      g.fillStyle = "#33425f";
      g.fillRect(0, 0, s, s);
      const grd = g.createRadialGradient(s / 2, s * 0.42, 2, s / 2, s * 0.42, s * 0.55);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(1, "rgba(120,150,210,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
    });
    const floor = paint(128, (g, s) => {
      g.fillStyle = "#05070d";
      g.fillRect(0, 0, s, s);
    });
    const tex = new THREE.CubeTexture([wall, wall, top, floor, wall, wall]);
    tex.needsUpdate = true;
    return tex;
  }

  // Ein weicher Lichtfleck — er ersetzt das Nachleuchten, das ohne Nachbearbeitung fehlt.
  function glowTexture() {
    const cv = paint(128, (g, s) => {
      const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.22, "rgba(255,255,255,.5)");
      grd.addColorStop(0.55, "rgba(255,255,255,.12)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
    });
    const tex = new THREE.Texture(cv);
    tex.needsUpdate = true;
    return tex;
  }

  /* Ein einzelnes Rasterfeld. Die Rückwand wiederholt es einmal je Einheit, sodass
     seine Ränder genau auf den Feldgrenzen liegen. */
  function gridTexture() {
    const cv = paint(64, (g, s) => {
      g.fillStyle = "#0d1424";
      g.fillRect(0, 0, s, s);
      g.strokeStyle = "rgba(142,188,255,.42)";
      g.lineWidth = 2;
      g.strokeRect(1, 1, s - 2, s - 2);
      g.fillStyle = "rgba(142,188,255,.07)";
      g.fillRect(s * 0.22, s * 0.22, s * 0.56, s * 0.56);
    });
    const tex = new THREE.Texture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  /* Alles, was eine Ansicht zum Zeichnen braucht. `extra` sammelt, was Arena und
     Effekte noch dazulegen — damit beim Schließen nichts im Grafikspeicher bleibt. */
  function resources() {
    const tex = { env: envMap(), glow: glowTexture(), grid: gridTexture() };

    const geo = {
      frame: new THREE.BoxGeometry(0.94, 0.94, 0.9),
      gem: new THREE.BoxGeometry(0.6, 0.6, 1.02),
      ghost: new THREE.BoxGeometry(0.84, 0.84, 0.1),
      shard: new THREE.BoxGeometry(0.24, 0.24, 0.24),
      plane: new THREE.PlaneGeometry(1, 1),
      ring: new THREE.RingGeometry(0.38, 0.62, 32)
    };

    const mats = {};
    TetrisPieces.TYPES.forEach((t) => {
      const c = new THREE.Color(COLORS[t]);
      mats[t] = {
        color: c,
        // Die Fassung ist dunkles, poliertes Metall — sie fängt Licht und Umgebung.
        frame: new THREE.MeshStandardMaterial({
          color: c.clone().multiplyScalar(0.3),
          emissive: c.clone().multiplyScalar(0.05),
          roughness: 0.32, metalness: 0.72, envMap: tex.env
        }),
        // Der Kern leuchtet aus sich selbst und steht ein Stück aus der Fassung heraus.
        gem: new THREE.MeshStandardMaterial({
          color: c.clone(),
          emissive: c.clone().multiplyScalar(0.55),
          roughness: 0.15, metalness: 0.2, envMap: tex.env
        }),
        ghost: new THREE.MeshBasicMaterial({
          color: c.clone(), transparent: true, opacity: 0.34,
          blending: THREE.AdditiveBlending, depthWrite: false
        }),
        shard: new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.15) }),
        glow: new THREE.SpriteMaterial({
          map: tex.glow, color: c.clone(), transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false
        })
      };
    });

    // Weiß glühend: so sehen Reihen aus, die gleich verschwinden.
    const flash = {
      frame: new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0xdce8ff, roughness: 0.1, metalness: 0.1, envMap: tex.env
      }),
      gem: new THREE.MeshBasicMaterial({ color: 0xffffff })
    };

    return { tex: tex, geo: geo, mats: mats, flash: flash, extra: [] };
  }

  // Was Arena und Effekte selbst erzeugen, kommt hierher — dispose räumt es mit auf.
  function own(res, thing) {
    res.extra.push(thing);
    return thing;
  }

  function dispose(res) {
    const drop = (o) => { if (o && typeof o.dispose === "function") o.dispose(); };
    Object.keys(res.geo).forEach((k) => drop(res.geo[k]));
    Object.keys(res.tex).forEach((k) => drop(res.tex[k]));
    Object.keys(res.mats).forEach((k) => {
      const m = res.mats[k];
      drop(m.frame); drop(m.gem); drop(m.ghost); drop(m.shard); drop(m.glow);
    });
    drop(res.flash.frame);
    drop(res.flash.gem);
    res.extra.forEach(drop);
    res.extra.length = 0;
  }

  /* Ein Stein: dunkle Fassung mit leuchtendem Kern darin. Beide zusammen ergeben
     die abgeschrägte Kachel, die man von vorn als Block sieht. */
  function block(res, type) {
    const m = res.mats[type];
    const mesh = new THREE.Mesh(res.geo.frame, m.frame);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const gem = new THREE.Mesh(res.geo.gem, m.gem);
    mesh.add(gem);
    mesh.userData = { type: type, gem: gem, y: 0, ty: 0, born: 0 };
    return mesh;
  }

  // Die Zellen eines Steins samt der Mitte, um die er sich dreht.
  function pieceCells(type, rot) {
    const n = TetrisPieces.SIZE[type];
    const mid = (n - 1) / 2;
    return TetrisPieces.SHAPES[type][rot].map((p) => [p[0] - mid, mid - p[1]]);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // Ein zeitunabhängiges Annähern: pro Sekunde bleibt der Anteil `rest` übrig.
  function ease(cur, target, rest, dt) {
    return lerp(cur, target, 1 - Math.pow(rest, dt));
  }

  return {
    COLORS: COLORS, COLS: COLS, ROWS: ROWS,
    available: available, cellX: cellX, cellY: cellY,
    paint: paint, resources: resources, own: own, dispose: dispose,
    block: block, pieceCells: pieceCells, lerp: lerp, ease: ease
  };
})();
