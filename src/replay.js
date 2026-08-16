/* Die Aufzeichnung einer Partie und ihr Abspielkopf.
   Aufgezeichnet wird jedes Bild, das sich vom vorherigen unterscheidet — samt
   Zustand des Zufalls, damit von jeder Stelle aus weitergespielt werden kann.
   Die Zeitachse ist die gespielte Zeit (state.elapsed), nicht die Zahl der Bilder. */
const TetrisReplay = (function () {
  const SPEEDS = [0.25, 0.5, 1, 2, 4];
  const SPEED_LABELS = ["¼×", "½×", "1×", "2×", "4×"];

  // Zeigt das Bild dasselbe wie das vorherige, muss es nicht aufs Band.
  function sameFrame(a, b) {
    if (a.board !== b.board || a.score !== b.score || a.lines !== b.lines) return false;
    if (a.nextType !== b.nextType || a.over !== b.over) return false;
    if ((a.clearRows === null) !== (b.clearRows === null)) return false;
    if ((a.piece === null) !== (b.piece === null)) return false;
    if (!a.piece) return true;
    return a.piece.type === b.piece.type && a.piece.rot === b.piece.rot &&
           a.piece.x === b.piece.x && a.piece.y === b.piece.y;
  }

  function record(frames, state) {
    const snap = TetrisEngine.snapshot(state);
    const last = frames.length ? frames[frames.length - 1] : null;
    if (last) {
      // Unverändertes Feld: dieselbe Zeichenkette weiterverwenden statt sie zu kopieren.
      if (last.board === snap.board) snap.board = last.board;
      if (sameFrame(last, snap)) return false;
    }
    frames.push(snap);
    return true;
  }

  function cursor(frames, index) {
    const i = Math.max(0, Math.min(frames.length - 1, index));
    return { index: i, playing: false, dir: 1, speed: 1, time: frames[i].t };
  }

  function seek(cur, frames, index) {
    const i = Math.max(0, Math.min(frames.length - 1, index));
    cur.time = frames[i].t;
    if (i === cur.index) return false;
    cur.index = i;
    return true;
  }

  // Ein Bild weiter oder zurück — das hält das Abspielen an.
  function step(cur, frames, delta) {
    cur.playing = false;
    return seek(cur, frames, cur.index + delta) || true;
  }

  /* Abspielen in eine Richtung. Steht der Kopf schon am Ende dieser Richtung,
     beginnt er am anderen Ende von vorn. */
  function play(cur, frames, dir) {
    cur.dir = dir;
    cur.playing = true;
    if (dir > 0 && cur.index >= frames.length - 1) seek(cur, frames, 0);
    else if (dir < 0 && cur.index <= 0) seek(cur, frames, frames.length - 1);
    else cur.time = frames[cur.index].t;
    return true;
  }

  function pause(cur, frames) {
    cur.playing = false;
    cur.time = frames[cur.index].t;
    return true;
  }

  // Ein Bildtakt des Abspielens; liefert, ob sich sichtbar etwas geändert hat.
  function advance(cur, frames, dt) {
    if (!cur.playing) return false;
    const before = cur.index;
    cur.time += dt * cur.speed * cur.dir;
    let i = cur.index;
    if (cur.dir > 0) {
      while (i + 1 < frames.length && frames[i + 1].t <= cur.time) i++;
      if (i >= frames.length - 1) { i = frames.length - 1; cur.playing = false; cur.time = frames[i].t; }
    } else {
      while (i > 0 && frames[i - 1].t >= cur.time) i--;
      if (i <= 0) { i = 0; cur.playing = false; cur.time = frames[0].t; }
    }
    cur.index = i;
    return i !== before || !cur.playing;
  }

  // "1:23,4" — Minuten, Sekunden, Zehntel der gespielten Zeit.
  function formatTime(ms) {
    const tenths = Math.max(0, Math.round(ms / 100));
    const secs = Math.floor(tenths / 10);
    const mm = Math.floor(secs / 60);
    const ss = secs % 60;
    return mm + ":" + (ss < 10 ? "0" + ss : ss) + "," + (tenths % 10);
  }

  return {
    SPEEDS: SPEEDS,
    SPEED_LABELS: SPEED_LABELS,
    record: record,
    cursor: cursor,
    seek: seek,
    step: step,
    play: play,
    pause: pause,
    advance: advance,
    formatTime: formatTime
  };
})();
