/* Was passiert, wenn etwas passiert: Splitter geräumter Reihen, der Ring beim
   Aufsetzen, die Spur eines fallen gelassenen Steins, der Blitz und das Wackeln
   der Kamera. Alles arbeitet aus festen Vorräten — im Spiel entsteht nichts neu. */
const TetrisFx = (function () {
  const SHARDS = 220;
  const RINGS = 6;
  const STREAKS = 8;
  const GRAVITY = 26;

  function create(scene, res) {
    const group = new THREE.Group();
    scene.add(group);

    // --- Splitter: kleine Würfel, die auseinanderfliegen und dabei schrumpfen ---
    const shards = [];
    for (let i = 0; i < SHARDS; i++) {
      const m = new THREE.Mesh(res.geo.shard, res.mats.I.shard);
      m.visible = false;
      m.userData = { life: 0, ttl: 1, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0 };
      group.add(m);
      shards.push(m);
    }
    let shardAt = 0;

    // --- Ringe: eine Druckwelle dort, wo ein Stein aufsetzt ---
    const rings = [];
    for (let i = 0; i < RINGS; i++) {
      const mat = TetrisGfx.own(res, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false
      }));
      const m = new THREE.Mesh(res.geo.ring, mat);
      m.visible = false;
      m.userData = { life: 0, ttl: 0.5, size: 1 };
      group.add(m);
      rings.push(m);
    }
    let ringAt = 0;

    // --- Spuren: senkrechte Lichtbahnen hinter einem fallen gelassenen Stein ---
    const streaks = [];
    for (let i = 0; i < STREAKS; i++) {
      const mat = TetrisGfx.own(res, new THREE.MeshBasicMaterial({
        map: res.tex.glow, color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }));
      const m = new THREE.Mesh(res.geo.plane, mat);
      m.visible = false;
      m.userData = { life: 0, ttl: 0.34 };
      group.add(m);
      streaks.push(m);
    }
    let streakAt = 0;

    // --- Der Blitz vor dem Feld ---
    const flashMat = TetrisGfx.own(res, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false
    }));
    const flash = new THREE.Mesh(res.geo.plane, flashMat);
    flash.scale.set(34, 46, 1);
    flash.position.z = 7;
    flash.renderOrder = 20;
    flash.visible = false;
    group.add(flash);
    let flashLevel = 0;

    // --- Das Wackeln ---
    const shake = { x: 0, y: 0, mag: 0, t: 0 };

    function burst(x, y, type, power) {
      const n = Math.min(6, Math.round(2 + power * 3));
      for (let i = 0; i < n; i++) {
        const m = shards[shardAt];
        shardAt = (shardAt + 1) % SHARDS;
        m.material = res.mats[type].shard;
        m.position.set(x + (Math.random() - 0.5) * 0.7, y + (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.5);
        m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        const d = m.userData;
        d.vx = (Math.random() - 0.5) * 9 * power;
        d.vy = 3 + Math.random() * 9 * power;
        d.vz = 1 + Math.random() * 8 * power;
        d.rx = (Math.random() - 0.5) * 14;
        d.ry = (Math.random() - 0.5) * 14;
        d.rz = (Math.random() - 0.5) * 14;
        d.ttl = 0.8 + Math.random() * 0.7;
        d.life = d.ttl;
        m.scale.setScalar(1);
        m.visible = true;
      }
    }

    function ring(x, y, color, size) {
      const m = rings[ringAt];
      ringAt = (ringAt + 1) % RINGS;
      m.material.color.copy(color);
      m.material.opacity = 0.85;
      m.position.set(x, y, 0.62);
      m.userData.life = m.userData.ttl;
      m.userData.size = size || 1;
      m.scale.setScalar(size || 1);
      m.visible = true;
    }

    function streak(x, yTop, yBottom, color) {
      const m = streaks[streakAt];
      streakAt = (streakAt + 1) % STREAKS;
      const h = Math.max(1, yTop - yBottom);
      m.material.color.copy(color);
      m.material.opacity = 0.9;
      m.position.set(x, (yTop + yBottom) / 2, 0.3);
      m.scale.set(1.5, h + 1.5, 1);
      m.userData.life = m.userData.ttl;
      m.visible = true;
    }

    function bang(power) {
      flashLevel = Math.min(1, flashLevel + power);
    }

    // Nach oben gedeckelt: mehrere Stöße im selben Bild sollen das Feld nicht wegtragen.
    function kick(mag) {
      shake.mag = Math.min(1.1, shake.mag + mag);
    }

    function update(dt, time) {
      for (let i = 0; i < SHARDS; i++) {
        const m = shards[i];
        if (!m.visible) continue;
        const d = m.userData;
        d.life -= dt;
        if (d.life <= 0) { m.visible = false; continue; }
        d.vy -= GRAVITY * dt;
        m.position.x += d.vx * dt;
        m.position.y += d.vy * dt;
        m.position.z += d.vz * dt;
        m.rotation.x += d.rx * dt;
        m.rotation.y += d.ry * dt;
        m.rotation.z += d.rz * dt;
        // Statt zu verblassen schrumpfen sie — so genügt ein Werkstoff für alle.
        m.scale.setScalar(Math.max(0.001, d.life / d.ttl));
      }

      for (let i = 0; i < RINGS; i++) {
        const m = rings[i];
        if (!m.visible) continue;
        const d = m.userData;
        d.life -= dt;
        if (d.life <= 0) { m.visible = false; m.material.opacity = 0; continue; }
        const p = 1 - d.life / d.ttl;
        m.scale.setScalar(d.size * (0.4 + p * 3.4));
        m.material.opacity = 0.85 * (1 - p) * (1 - p);
      }

      for (let i = 0; i < STREAKS; i++) {
        const m = streaks[i];
        if (!m.visible) continue;
        const d = m.userData;
        d.life -= dt;
        if (d.life <= 0) { m.visible = false; m.material.opacity = 0; continue; }
        const p = 1 - d.life / d.ttl;
        m.material.opacity = 0.9 * (1 - p);
        m.scale.x = 1.5 * (1 - p * 0.6);
      }

      flashLevel = Math.max(0, flashLevel - dt * 3.4);
      flash.visible = flashLevel > 0.002;
      flashMat.opacity = flashLevel * 0.5;

      shake.mag = Math.max(0, shake.mag - dt * 3.6);
      shake.t += dt;
      const s = shake.mag * shake.mag;
      shake.x = Math.sin(shake.t * 58) * s * 0.9;
      shake.y = Math.cos(shake.t * 71) * s * 0.75;
    }

    return {
      group: group, shake: shake,
      burst: burst, ring: ring, streak: streak, bang: bang, kick: kick, update: update
    };
  }

  return { create: create };
})();
