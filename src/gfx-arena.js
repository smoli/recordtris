/* Der Schacht, in den die Steine fallen: Rückwand, Seitenwände, Boden, der
   leuchtende Rahmen ringsum, das Sternenfeld dahinter und das Licht. Die
   Grundfarbe wechselt mit dem Level. */
const TetrisArena = (function () {
  const COLS = TetrisGfx.COLS;
  const ROWS = TetrisGfx.ROWS;
  const HALF_W = COLS / 2;   // 5
  const HALF_H = ROWS / 2;   // 10
  const BACK_Z = -3.4;       // so tief steht die Rückwand
  const DEPTH = 4.2;         // Tiefe des Schachts von der Rückwand nach vorn

  // Eine Farbe je Level; nach acht Leveln beginnt der Kreis von vorn.
  const MOODS = [0x4a7cff, 0x21d3c4, 0x8b5cf6, 0xff7a45,
                 0x36d67a, 0xff4d8d, 0xffc23d, 0x6a5cff];

  function wallMaterial(res, color) {
    return TetrisGfx.own(res, new THREE.MeshStandardMaterial({
      color: color, roughness: 0.86, metalness: 0.12,
      side: THREE.DoubleSide, envMap: res.tex.env
    }));
  }

  function create(scene, res) {
    const group = new THREE.Group();
    scene.add(group);

    // --- Rückwand: das Raster liegt genau auf den Feldgrenzen ---
    const gridTex = res.tex.grid;
    // 30 mal 44 Einheiten, eine Kachel je Einheit: die Ränder der Wand liegen auf
    // ganzen Zahlen, also treffen die Linien genau die Feldgrenzen.
    gridTex.repeat.set(30, 44);
    const backGeo = TetrisGfx.own(res, new THREE.PlaneGeometry(30, 44));
    const backMat = TetrisGfx.own(res, new THREE.MeshStandardMaterial({
      map: gridTex, color: 0x9fb4d8, roughness: 0.95, metalness: 0.05
    }));
    const back = new THREE.Mesh(backGeo, backMat);
    back.position.z = BACK_Z;
    back.receiveShadow = true;
    group.add(back);

    // --- Der Schacht selbst: zwei Wände, Boden ---
    const sideGeo = TetrisGfx.own(res, new THREE.PlaneGeometry(DEPTH, ROWS + 1.2));
    const sideMat = wallMaterial(res, 0x1b2436);
    [-1, 1].forEach((s) => {
      const w = new THREE.Mesh(sideGeo, sideMat);
      w.position.set(s * (HALF_W + 0.05), 0, BACK_Z + DEPTH / 2);
      w.rotation.y = s * -Math.PI / 2;
      w.receiveShadow = true;
      group.add(w);
    });

    const floorGeo = TetrisGfx.own(res, new THREE.PlaneGeometry(COLS + 0.1, DEPTH));
    const floor = new THREE.Mesh(floorGeo, wallMaterial(res, 0x151d2c));
    floor.position.set(0, -HALF_H - 0.05, BACK_Z + DEPTH / 2);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    // --- Der leuchtende Rahmen vor dem Schacht ---
    const frameMat = TetrisGfx.own(res, new THREE.MeshBasicMaterial({ color: 0x4a7cff, fog: false }));
    const barH = TetrisGfx.own(res, new THREE.BoxGeometry(COLS + 1.1, 0.3, 0.3));
    const barV = TetrisGfx.own(res, new THREE.BoxGeometry(0.3, ROWS + 1.1, 0.3));
    const frame = new THREE.Group();
    [-1, 1].forEach((s) => {
      const h = new THREE.Mesh(barH, frameMat);
      h.position.set(0, s * (HALF_H + 0.4), 0.7);
      frame.add(h);
      const v = new THREE.Mesh(barV, frameMat);
      v.position.set(s * (HALF_W + 0.4), 0, 0.7);
      frame.add(v);
    });
    group.add(frame);

    // Zwei weiche Lichtbänder über und unter dem Feld — der Rahmen strahlt dadurch ab.
    const haloMat = TetrisGfx.own(res, new THREE.SpriteMaterial({
      map: res.tex.glow, color: 0x4a7cff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    const halos = [];
    [-1, 1].forEach((s) => {
      const sp = new THREE.Sprite(haloMat);
      sp.position.set(0, s * (HALF_H + 0.4), 0.4);
      sp.scale.set(COLS + 8, 4.5, 1);
      halos.push(sp);
      group.add(sp);
    });

    // --- Sterne weit dahinter ---
    const starGeo = TetrisGfx.own(res, new THREE.BufferGeometry());
    const count = 460;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 130;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 90;
      pos[i * 3 + 2] = -14 - Math.random() * 70;
    }
    starGeo.addAttribute("position", new THREE.BufferAttribute(pos, 3));
    const starMat = TetrisGfx.own(res, new THREE.PointsMaterial({
      size: 0.9, map: res.tex.glow, color: 0xbfd4ff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: true
    }));
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // --- Licht ---
    const hemi = new THREE.HemisphereLight(0x6a86c4, 0x05070c, 0.55);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xdfe8ff, 0.8);
    key.position.set(7, 16, 15);
    key.castShadow = true;
    key.shadow.mapSize.width = 1024;
    key.shadow.mapSize.height = 1024;
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 15;
    key.shadow.camera.bottom = -15;
    key.shadow.camera.near = 4;
    key.shadow.camera.far = 60;
    key.shadow.bias = -0.0018;
    key.shadow.camera.updateProjectionMatrix();
    scene.add(key);

    const rimL = new THREE.PointLight(0x4a7cff, 0.9, 40);
    rimL.position.set(-11, 9, 9);
    scene.add(rimL);
    const rimR = new THREE.PointLight(0xff5570, 0.6, 40);
    rimR.position.set(11, -8, 9);
    scene.add(rimR);

    // Das Licht des fallenden Steins — das Feld wandert farbig mit ihm.
    const pieceLight = new THREE.PointLight(0xffffff, 1.5, 16, 2);
    pieceLight.position.set(0, 0, 2.2);
    scene.add(pieceLight);

    // Für Einschläge und geräumte Reihen: ein kurzer heller Stoß von vorn.
    const flashLight = new THREE.PointLight(0xffffff, 0, 60, 2);
    flashLight.position.set(0, 0, 10);
    scene.add(flashLight);

    // --- Farbwechsel mit dem Level ---
    const mood = new THREE.Color(MOODS[0]);
    const want = new THREE.Color(MOODS[0]);
    const counter = new THREE.Color(MOODS[3]);
    const wantCounter = new THREE.Color(MOODS[3]);
    let over = false;
    let dim = 1;
    let curLevel = 0;

    function apply() {
      const i = ((curLevel % MOODS.length) + MOODS.length) % MOODS.length;
      want.setHex(MOODS[i]);
      wantCounter.setHex(MOODS[(i + 3) % MOODS.length]);
    }

    function setLevel(level) {
      curLevel = level;
      if (!over) apply();
    }

    // Im Spielende schlägt alles ins Rote um — und findet danach zum Level zurück.
    function setOver(flag) {
      if (over === flag) return;
      over = flag;
      if (over) {
        want.setHex(0xff3355);
        wantCounter.setHex(0x7a1030);
      } else {
        apply();
      }
    }

    function update(dt, time) {
      const t = 1 - Math.pow(0.02, dt);
      mood.lerp(want, t);
      counter.lerp(wantCounter, t);
      dim = TetrisGfx.ease(dim, over ? 0.42 : 1, 0.05, dt);

      // Der Rahmen atmet; im Spielende pulst er schneller und dunkler.
      const beat = 0.82 + Math.sin(time * (over ? 5.5 : 1.8)) * 0.18;
      frameMat.color.copy(mood).multiplyScalar(beat * dim + 0.12);
      haloMat.color.copy(mood);
      haloMat.opacity = (over ? 0.3 : 0.45) * beat;

      rimL.color.copy(mood);
      rimR.color.copy(counter);
      rimL.intensity = 0.95 * dim;
      rimR.intensity = 0.65 * dim;
      hemi.intensity = 0.55 * dim;
      key.intensity = 0.8 * dim;

      // Die Rückwand nimmt einen Hauch der Grundfarbe an.
      backMat.color.setRGB(
        0.42 + mood.r * 0.4, 0.48 + mood.g * 0.36, 0.62 + mood.b * 0.3
      ).multiplyScalar(dim);

      stars.rotation.z = time * 0.008;
      stars.position.x = Math.sin(time * 0.05) * 3;
      halos.forEach((h, i) => { h.scale.x = COLS + 8 + Math.sin(time * 1.3 + i) * 0.8; });
    }

    return {
      group: group, pieceLight: pieceLight, flashLight: flashLight,
      mood: mood, setLevel: setLevel, setOver: setOver, update: update
    };
  }

  return { create: create, MOODS: MOODS };
})();
