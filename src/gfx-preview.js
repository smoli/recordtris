/* Die Vorschau des nächsten Steins — derselbe Werkstoff wie im Feld, nur klein
   und langsam drehend. Ein eigener WebGL-Kontext mit eigenem Satz an Ressourcen. */
const TetrisPreview3D = (function () {
  function create(canvas) {
    if (!canvas || !TetrisGfx.available()) return null;
    try {
      return build(canvas);
    } catch (e) {
      return null;
    }
  }

  function build(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const res = TetrisGfx.resources();
    const scene = new THREE.Scene();
    const FOV = 38;
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.2, 60);
    const origin = new THREE.Vector3(0, 0, 0);

    // So nah, dass der Stein den Kasten füllt — quer wie hoch, je nachdem was knapper ist.
    function place(aspect) {
      const half = Math.tan((FOV * Math.PI / 180) / 2);
      camera.position.set(0, 0.35, Math.max(1.62 / half, 2.2 / (half * Math.max(aspect, 0.2))));
      camera.lookAt(origin);
    }
    place(1);

    scene.add(new THREE.HemisphereLight(0x8fa8dc, 0x0a0e18, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(5, 8, 9);
    scene.add(key);
    const rim = new THREE.PointLight(0x6ea8ff, 1.1, 30);
    rim.position.set(-7, -4, 6);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);
    const cubes = [];
    for (let i = 0; i < 4; i++) {
      const m = TetrisGfx.block(res, "I");
      m.castShadow = false;
      m.receiveShadow = false;
      m.visible = false;
      group.add(m);
      cubes.push(m);
    }

    // Ein Lichtfleck hinter dem Stein — er hebt ihn vom dunklen Kasten ab.
    const halo = new THREE.Sprite(res.mats.I.glow);
    halo.position.set(0, 0, -1.2);
    halo.scale.set(3.4, 3.4, 1);
    scene.add(halo);

    let type = null;
    let time = 0;

    function set(next) {
      if (next === type) return;
      type = next;
      const mm = type ? res.mats[type] : null;
      const cells = type ? TetrisGfx.pieceCells(type, 0) : [];
      /* Die Zellen liegen um die Mitte des Steinfelds; für den O- und den I-Stein
         verschiebt das die sichtbare Mitte, deshalb wird nachzentriert. */
      let minX = 0, maxX = 0, minY = 0, maxY = 0;
      cells.forEach((c, i) => {
        if (!i) { minX = maxX = c[0]; minY = maxY = c[1]; }
        minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]);
        minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
      });
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      for (let i = 0; i < 4; i++) {
        const cube = cubes[i];
        const cell = cells[i];
        if (!cell || !mm) { cube.visible = false; continue; }
        cube.visible = true;
        cube.material = mm.frame;
        cube.userData.gem.material = mm.gem;
        cube.position.set(cell[0] - cx, cell[1] - cy, 0);
      }
      if (mm) {
        halo.material = mm.glow;
        halo.visible = true;
      } else {
        halo.visible = false;
      }
      // Vier Felder breit muss auch der I-Stein hineinpassen — und der O-Stein,
      // der nur zwei breit ist, soll darüber nicht winzig werden.
      const span = Math.max(maxX - minX, maxY - minY) + 1.4;
      group.scale.setScalar(3.2 / Math.max(span, 2.4));
    }

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
        place(camera.aspect);
      }

      group.rotation.y = Math.sin(time * 0.7) * 0.55;
      group.rotation.x = -0.16 + Math.sin(time * 0.5) * 0.13;
      halo.scale.setScalar(3.4 + Math.sin(time * 1.7) * 0.3);

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

    return { set: set, dispose: dispose };
  }

  return { create: create };
})();
