# Tetris

## Zweck

Ein spielbares Tetris für den Desktop — bewusst nah am Original der NES-Fassung,
insbesondere bei dem, was das Spiel ausmacht: welcher Stein als Nächstes kommt.

## Nutzen

Wer das klassische Tetris kennt, findet hier dessen Steinverteilung wieder: die
typischen Durststrecken ohne I-Stein, die gelegentlichen Dopplungen. Das
Spielgefühl unterscheidet sich spürbar von modernen Tetris-Varianten mit
Sieben-Bag-Verfahren, in denen jeder Stein garantiert alle sieben Züge kommt.

## Aufbau

- `src/index.html` — Einstieg, lädt Preact (`morphos:lib`) und die vier Bausteine.
- `src/rng.js` — der Zufall des Originals: das 16-Bit-Schieberegister und das
  Auswahlverfahren.
- `src/pieces.js` — die sieben Steine mit ihren vier Drehlagen, die Falltempo-Tabelle
  und die Punktetabelle.
- `src/engine.js` — Spielfeld, Kollision, Einrasten, Reihenauflösung, Level.
  Ein einfacher Zustandsobjekt-Baum, der von außen verändert wird.
- `src/app.js` — Oberfläche in Preact, Tastensteuerung, Bildtakt.
- `src/style.css` — Aussehen.

Der Spielzustand liegt bewusst nicht in einem Preact-State, sondern in einer Ref:
Der Bildtakt (`requestAnimationFrame`) schreibt ihn fort und stößt ein Neuzeichnen
nur an, wenn sich der Zähler `version` geändert hat.

## Getroffene Entscheidungen

**Zufall wie im Original.** Eine Zufallszahl entsteht aus einem 16-Bit-Schiebe-
register: Bit 1 und Bit 9 werden verknüpft, das Ergebnis wandert oben hinein;
verwendet wird das obere Byte. Die Steinwahl addiert dazu einen Zähler aller bisher
gezogenen Steine und schneidet auf 0–7. Trifft es die leere achte Stelle oder
denselben Stein wie zuletzt, gibt es genau einen zweiten Wurf, verschoben gegen den
letzten Stein. Wiederholungen werden dadurch seltener — aber nicht unmöglich.
Der Startwert des Registers ist zufällig (die Konsole erreicht dasselbe, indem sie
das Register im Titelbild weiterlaufen lässt).

**Startlagen und Falltempo wie im Original.** Die Steine erscheinen mit der flachen
Seite nach oben, mittig. Die Tabelle der Bilder pro Feld (48 bei Level 0 bis 1 ab
Level 29) stammt aus dem Original, ebenso die Punkte 40/100/300/1200 mal (Level + 1).
Ein Level dauert zehn Reihen; das Startlevel ist frei wählbar (0–9).

**Bewusste Abweichungen.** Drehungen dürfen um bis zu zwei Spalten ausweichen, wenn
sie sonst an einer Wand scheitern würden — das Original kennt das nicht, ohne es
ist Spielen an der Wand aber unnötig zäh. Dazu kommen ein Schattenriss der
Landestelle und die Leertaste zum sofortigen Fallenlassen (ein Punkt je Feld);
beides gibt es im Original ebenfalls nicht.

**Das Feld füllt das Fenster.** Alle Maße hängen an einer einzigen Größe, der
Kantenlänge eines Feldes (`--cell` in `src/style.css`); Seitenspalten, Schriften und
Knöpfe rechnen daraus. Die Kantenlänge folgt dem knapperen der beiden Maße Höhe und
Breite, wobei die Breite abzüglich der beiden Seitenspalten zählt, sobald das mehr
hergibt als ein fester Anteil der Fensterbreite. Nach unten bleibt sie bei 16 Pixeln,
nach oben bei 60 — ein größeres Fenster wird also genutzt, ein kleines bleibt spielbar.

**Kein Speichern.** Das Spiel hält keinen Zustand über einen Neustart hinaus —
keine Bestenliste, kein fortgesetztes Spiel.
