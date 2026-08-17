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
- `src/seed.js` — das Merkwort: Wort zu Startwert des Registers, und das Würfeln
  eines aussprechbaren Wortes.
- `src/pieces.js` — die sieben Steine mit ihren vier Drehlagen, die Falltempo-Tabelle
  und die Punktetabelle.
- `src/engine.js` — Spielfeld, Kollision, Einrasten, Reihenauflösung, Level.
  Ein einfacher Zustandsobjekt-Baum, der von außen verändert wird; dazu die
  Momentaufnahme (`snapshot`) und ihre Umkehrung (`fromSnapshot`).
- `src/replay.js` — das Band der Aufzeichnung und der Abspielkopf.
- `src/highscores.js` — die Bestenliste: Lesen und Schreiben der Datei, das Bilden
  der Einträge und ihre Gruppierung nach dem Merkwort.
- `src/gameui.js` — die Ansichten des Spiels: Feld, Vorschau, Statistik, Startbild.
- `src/replayui.js` — die Bedienleiste der Wiedergabe.
- `src/scoresui.js` — die Ansicht der Bestenliste.
- `src/app.js` — Zustand, Tastensteuerung, Bildtakt, Aufzeichnung, Eintrag ins Ergebnis.
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

**Ein Wort als Startwert.** Den Startwert des Registers bestimmt ein Merkwort: Die
Zeichen des Wortes laufen durch eine FNV-1a-Streuung, das Ergebnis wird auf 16 Bit
gefaltet. Damit spielt dasselbe Wort immer dieselbe Steinfolge — dieselbe Partie
lässt sich wiederholen oder mit anderen vergleichen. Ein Wort statt einer Zahl,
weil man es sich merken und weitersagen kann. Vor dem Vergleich wird
kleingeschrieben, Umlaute werden ausgeschrieben und alles außer Buchstaben und
Ziffern entfällt; "Grün!" und "gruen" sind also dieselbe Partie. Wer keines eingibt,
bekommt ein gewürfeltes aus Silben (Anlaut plus Kern, zwei oder drei Silben) — es
steht danach im Feld und in der Seitenspalte, kann also nachträglich notiert werden.

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

**Die Partie wird mitgeschrieben.** Jedes Bild, das sich vom vorherigen unterscheidet,
kommt als vollständige Momentaufnahme aufs Band: Feld, Stein, Zahlen, Statistik — und
der innere Zustand des Zufallsregisters. Nicht die Tastendrücke werden aufgezeichnet,
sondern die Zustände selbst. Das kostet mehr Platz, ist dafür aber unabhängig davon,
ob ein Nachspielen exakt dieselben Zeitschritte träfe, und erlaubt das Rückwärtsgehen
ohne Neuberechnung. Unveränderte Felder teilen sich dieselbe Zeichenkette, und
wiederholte gleiche Bilder kommen gar nicht erst aufs Band.

**Wiedereinstieg statt bloßem Zusehen.** Weil die Momentaufnahme auch den Zufall
enthält, ist jedes Bild der Wiedergabe ein vollwertiger Spielstand. "Hier
weiterspielen" macht daraus wieder ein laufendes Spiel, schneidet das Band an dieser
Stelle ab und zeichnet von dort den neuen Verlauf auf — ein Zurücknehmen beliebig
vieler Züge. Die Zeitachse ist die gespielte Zeit, nicht die Zahl der Bilder; das
Abspielen läuft dadurch im Tempo der Partie, wahlweise vorwärts oder rückwärts und
mit einem Faktor von ¼ bis 4. Ein Bild, in dem das Spiel schon verloren ist, lässt
sich nicht fortsetzen.

**Die Bestenliste gehört dem Merkwort.** Jede Partie, die mit "Game Over" endet, wird
als ein Eintrag in `tetris-highscores.json` im Datenordner festgehalten: Zeitpunkt,
Punkte, Reihen, Level und Startlevel, Spieldauer, wie oft eine, zwei, drei oder vier
Reihen auf einmal fielen, und wie oft jede Steinsorte kam. Die Datei ist eine flache
Liste aller Partien — nicht ein vorgerechnetes Ergebnis —, damit sich jede Sicht
daraus ableiten lässt und nichts verloren geht.

Zusammengefasst wird beim Anzeigen: gruppiert nach dem normalisierten Merkwort, denn
es bestimmt die Steinfolge, also die Aufgabe. Voreingestellt zeigt jede Zeile den
besten Wert dieses Wortes und die Zahl der Partien; die einzelnen Partien mit allen
Zahlen stehen daneben. Wer dieselbe Aufgabe zehnmal spielt, sieht daran seinen
Fortschritt. Die Liste wird beim Öffnen der App gelesen und nach jeder beendeten
Partie geschrieben; fehlt der Datenordner, lebt sie nur in dieser Sitzung weiter und
sagt das auch. Eine Partie, die aus der Aufzeichnung heraus fortgesetzt wurde, trägt
den Vermerk des Wiedereinstiegs — ihr Ergebnis ist mit einem durchgespielten nicht
vergleichbar.

**Sonst kein Speichern.** Außer der Bestenliste hält das Spiel keinen Zustand über
einen Neustart hinaus. Das Band der Aufzeichnung lebt nur so lange wie die Partie und
wird mit jedem neuen Spiel verworfen.
