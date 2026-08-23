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
  Ein einfacher Zustandsobjekt-Baum, der von außen verändert wird; dazu das kurze
  Ereignisband `fx` für die Bildschau und die
  Momentaufnahme (`snapshot`) und ihre Umkehrung (`fromSnapshot`).
- `src/replay.js` — das Band der Aufzeichnung und der Abspielkopf.
- `src/highscores.js` — die Bestenliste: Lesen und Schreiben der Datei, das Bilden
  der Einträge und ihre Gruppierung nach dem Merkwort.
- `src/archive.js` — das Archiv: eine Datei je gespielter Partie, das Verdichten des
  Bandes und der Weg zurück zu ihm.
- `src/analysis.js` — was aus einem ganzen Band ablesbar ist: Tempo, Ausbeute, Stapel,
  Züge, Durststrecken und die Kurven über die Spielzeit.
- `src/gameui.js` — die Ansichten des Spiels: Leinwand des Feldes, Vorschau,
  Statistik, Startbild und die Ansicht der laufenden Partie samt Einblendungen.
- `src/replayui.js` — die Ansicht der Wiedergabe und ihre Bedienleiste.
- `src/scoresui.js` — die Ansicht der Bestenliste.
- `src/statsui.js` — die Auswertung einer archivierten Partie: Zahlen und Kurven.
- `src/app.js` — Zustand, Tastensteuerung, Bildtakt, Aufzeichnung, Eintrag ins Ergebnis.
- `src/fxpaint.js` — der Pinselkasten: Farben mischen, Kachel, Schattenriss,
  Hintergrund und Saum zeichnen.
- `src/fx.js` — die Bildschau des Feldes: eigener Bildtakt, Ereignisse, Teilchen,
  Erschütterung, Nachglühen.
- `src/style.css` — Grundmaße, Farben, Feld und Seitenspalten.
- `src/overlay.css` — Startbildschirm, Einblendungen, Knöpfe, Eingabefelder.
- `src/screens.css` — Wiedergabe und Bestenliste.

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

Der Rückweg zum Startbildschirm würfelt neu — aber nur nach einer durchgespielten
Partie: Sie ist eine erledigte Aufgabe, die nächste soll eine neue sein; wer das Wort
behalten will, findet es in der Bestenliste und startet es von dort. Ein Abbruch
mitten im Spiel lässt das Wort dagegen stehen, denn wer aufgibt, versucht meist
dieselbe Folge noch einmal.

**Startlagen und Falltempo wie im Original.** Die Steine erscheinen mit der flachen
Seite nach oben, mittig. Die Tabelle der Bilder pro Feld (48 bei Level 0 bis 1 ab
Level 29) stammt aus dem Original, ebenso die Punkte 40/100/300/1200 mal (Level + 1).
Ein Level dauert zehn Reihen; das Startlevel ist frei wählbar (0–9).

**Bewusste Abweichungen.** Drehungen dürfen um bis zu zwei Spalten ausweichen, wenn
sie sonst an einer Wand scheitern würden — das Original kennt das nicht, ohne es
ist Spielen an der Wand aber unnötig zäh. Dazu kommen ein Schattenriss der
Landestelle und die Leertaste zum sofortigen Fallenlassen (ein Punkt je Feld);
beides gibt es im Original ebenfalls nicht.

**Das Feld ist eine Leinwand, nicht ein Raster aus Kästchen.** Bis auf das Feld
bleibt die ganze Oberfläche Preact und CSS; das Feld selbst zeichnet ein eigener
Bildtakt auf ein `<canvas>`. Nur so lassen sich Dinge zeigen, die zwischen zwei
Spielzuständen liegen: der Stein gleitet zwischen zwei Feldern weiter, statt zu
springen; Funken, Lichtsäulen, Druckwellen und das Erzittern des Bildes laufen
weiter, auch wenn sich am Spielstand gerade nichts ändert. Preact hängt die
Leinwand nur auf und reicht ihr nach jedem Neuzeichnen den neuesten Zustand — die
Bildschau liest ihn, verändert ihn nie.

**Woher die Bildschau weiß, was geschehen ist.** Zweierlei. Was man dem Zustand
ansieht — volle Reihen, Level, Punkte, Spielende —, erkennt sie am Vergleich mit
dem vorigen Bild; das wirkt deshalb auch in der Wiedergabe, die ja nur
Momentaufnahmen zeigt. Was man ihm nicht ansieht — Drehung, Fallenlassen,
Einrasten —, meldet die Regel selbst über ein kurzes Ereignisband `state.fx`, das
die Bildschau ausliest und leert. Das Band gehört nicht zum Spielstand und steht
darum weder in der Momentaufnahme noch in der Bestenliste.

**Das Glühen entsteht durch ein zweites, grobes Bild.** Jede Szene wird zweimal
gezeichnet: fein auf das sichtbare Bild und grob auf eine Fläche von einem Drittel
der Kantenlänge. Diese wird weich gezeichnet und additiv darübergelegt. Das kostet
kaum etwas und lässt alles Helle nach außen strahlen — Kacheln, Funken, Balken und
Schrift zugleich, ohne dass jede Form ihren eigenen Schein braucht.

**Ein Kästchen je Feld.** Ein Tetromino soll als vier Kästchen zu erkennen sein,
nicht als eine verschmolzene Form. Jedes Feld bekommt eine flache Fläche in der
Farbe seines Steins, eine schmale Fuge zum Nachbarn, leicht gerundete Ecken, innen
einen hellen Grat entlang der Kante und einen dunklen Hauch am Fuß. Das ist das
ursprüngliche Aussehen des Spiels; es wurde dem Zusammenwachsen der Felder
bewusst vorgezogen — die Effekte ringsherum (Schein, Funken, Erschütterung, Spur)
bleiben davon unberührt. Der Schattenriss der Landestelle folgt derselben Form:
ein leerer Umriss je Feld. Die Vorschau in der Seitenspalte bildet sie in CSS nach.

**Die gezeichnete Höhe zieht der Regel nach.** Der Stein gleitet nicht nur zwischen
zwei Feldern mit — die gezeichnete Höhe folgt der des Spielstands zusätzlich weich
nach. Das glättet die Sprünge, die die Regel selbst macht: vor allem beim Halten
von "ein Feld tiefer", wo der Stein sonst im Feldraster hüpft, weil dort die Uhr der
Schwerkraft bei jedem Schritt neu beginnt. Ein neuer Stein oder ein Sprung über
mehrere Felder setzt die Höhe sofort, damit nichts hinterherschleift. Die Spur
hinter dem Stein tastet dieselbe gleitende Höhe ab und ist deshalb ein Schmier,
kein Abdruck im Raster.

**Jedes Level hat seine Farbe.** Zehn Farben wechseln sich ab; sie färben den
Hintergrund des Feldes, den Saum, das Aufblitzen beim Tetris und — über die Klasse
`lv0` bis `lv9` am Wurzelelement — auch die Lichtstriche der Seitenspalten und die
Zahlen. Die Reihe steht doppelt: in `fxpaint.js` für die Leinwand und in
`style.css` für alles andere. Sie muss zusammenpassen.

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
wiederholte gleiche Bilder kommen gar nicht erst aufs Band. Am Ende der Partie wandert
das Band ins Archiv — es lebt damit nicht mehr nur so lange wie sie.

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
Reihen auf einmal fielen, wie oft jede Steinsorte kam — und der Name der Datei, in der
das ganze Band dieser Partie liegt. Die Datei ist eine flache Liste aller Partien
— nicht ein vorgerechnetes Ergebnis —, damit sich jede Sicht
daraus ableiten lässt und nichts verloren geht. Aus der Liste heraus lässt sich das
gewählte Wort sofort wieder spielen — die Bestenliste ist damit nicht nur Rückblick,
sondern der kürzeste Weg zur nächsten Runde derselben Aufgabe. Das Startlevel bleibt
dabei das auf dem Startbildschirm gewählte; die Enter-Abkürzung gilt nur, wenn keine
laufende Partie daran hängt. An jeder einzelnen Partie stehen zwei weitere Wege: ihre
Aufzeichnung ansehen und ihre Auswertung aufklappen. Beide brauchen das Band aus dem
Archiv; Partien ohne Band — ältere oder solche, deren Ablegen misslang — sagen das an
Ort und Stelle.

Zusammengefasst wird beim Anzeigen: gruppiert nach dem normalisierten Merkwort, denn
es bestimmt die Steinfolge, also die Aufgabe. Voreingestellt zeigt jede Zeile den
besten Wert dieses Wortes und die Zahl der Partien; die einzelnen Partien mit allen
Zahlen stehen daneben. Wer dieselbe Aufgabe zehnmal spielt, sieht daran seinen
Fortschritt. Die Liste wird beim Öffnen der App gelesen und nach jeder beendeten
Partie geschrieben; fehlt der Datenordner, lebt sie nur in dieser Sitzung weiter und
sagt das auch. Eine Partie, die aus der Aufzeichnung heraus fortgesetzt wurde, trägt
den Vermerk des Wiedereinstiegs — ihr Ergebnis ist mit einem durchgespielten nicht
vergleichbar.

**Das Archiv: nicht nur das Ergebnis, die Partie.** Eine Zahl allein sagt wenig über
eine Partie. Darum wird jede beendete Partie ganz behalten: Ihr Band wandert als eigene
Datei in den Ordner `tetris-games`, und der Eintrag der Bestenliste merkt sich nur den
Dateinamen. Zwei Dateien statt einer, weil die Liste bei jeder Partie neu geschrieben
wird, ein Band aber nur einmal — und weil eine Liste, die alle Bänder enthielte, beim
Öffnen der App vollständig gelesen werden müsste. So wird ein Band erst gelesen, wenn
es gebraucht wird.

Abgelegt wird verdichtet: Die Feldbilder wiederholen sich über viele Bilder hinweg und
stehen deshalb nur einmal in einem Verzeichnis, auf das jedes Bild mit einer Nummer
zeigt; der Rest eines Bildes wird zu einer nackten Zahlenreihe in fester Ordnung, ohne
Feldnamen. Aus dem Archiv entsteht wieder genau die Momentaufnahme, die die Regel
selbst schreibt — eine alte Partie lässt sich deshalb nicht nur ansehen, sondern an
jeder Stelle auch fortsetzen, mit demselben Wiedereinstieg wie in der laufenden Partie.
Sie legt sich dabei über alles andere und lässt eine laufende Partie unangetastet; erst
der Wiedereinstieg verwirft sie, und die Bedienleiste warnt dann davor. Misslingt das
Ablegen oder fehlt der Datenordner, bleibt der Eintrag ohne Band; die Bestenliste sagt
das an der betroffenen Partie.

**Die Auswertung liest das Band, nicht die Endzahlen.** Was eine Partie ausmacht, steht
nicht im Ergebnis: wie schnell gespielt wurde, wie hoch der Stapel stand, wie viele
Löcher er trug, wie oft gedreht und geschoben wurde, wie lang die längste Durststrecke
ohne lange Stange war. All das wird nicht mitgeschrieben, sondern beim Ansehen aus dem
Band gerechnet — jede Frage, die später aufkommt, lässt sich damit auch an alten
Partien noch stellen. Die Zahl der Züge entsteht aus dem Vergleich aufeinanderfolgender
Bilder: Solange das Feldbild unverändert bleibt und dieselbe Steinsorte fällt, ist es
derselbe Stein, und jede Änderung von Drehlage oder Spalte war ein Zug. Ein Einrasten
ändert das Feldbild und beendet die Zählung von selbst. Die Kurven über die Spielzeit
werden auf höchstens neunzig Stützstellen ausgedünnt, damit auch eine lange Partie
sofort erscheint.

**Sonst kein Speichern.** Außer der Bestenliste und dem Archiv hält das Spiel keinen
Zustand über einen Neustart hinaus. Das Band der laufenden Partie lebt nur so lange
wie sie und wird mit jedem neuen Spiel verworfen — aber erst, nachdem es im Archiv
liegt.
