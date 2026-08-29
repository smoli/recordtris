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
- `src/engine.js` — Spielfeld, Kollision, Einrasten, Reihenauflösung, Level, Spielart.
  Ein einfacher Zustandsobjekt-Baum, der von außen verändert wird; dazu das kurze
  Ereignisband `fx` für die Bildschau und die
  Momentaufnahme (`snapshot`) und ihre Umkehrung (`fromSnapshot`).
- `src/replay.js` — das Band der Aufzeichnung und der Abspielkopf.
- `src/highscores.js` — die Bestenliste: Lesen und Schreiben der Datei, das Bilden
  der Einträge und ihre Gruppierung — klassisch nach dem Merkwort, endlos nach dem
  festen Level.
- `src/gameui.js` — die Ansichten des Spiels: Leinwand des Feldes, Vorschau,
  Statistik, Startbild.
- `src/replayui.js` — die Bedienleiste der Wiedergabe.
- `src/scoresui.js` — die Ansicht der Bestenliste.
- `src/app.js` — Zustand, Tastensteuerung, Bildtakt, Aufzeichnung, Eintrag ins Ergebnis.
- `src/fxpaint.js` — der Pinselkasten: Farben mischen, Kachel, Schattenriss,
  Hintergrund und Saum zeichnen.
- `src/fx.js` — die Bildschau des Feldes: eigener Bildtakt, Ereignisse, Teilchen,
  Erschütterung, Nachglühen. Von hier aus klingt der Reihenschlag.
- `src/sound.js` — die vier Geräusche: drei Wege zum Klang, Mindestabstand,
  Stummschalter, Selbstauskunft für die Diagnose; dazu die Tonmaschine selbst,
  die sie über `bus()` weiterreicht.
- `src/pad.js` — das Klangbett des musikalischen Endlosspiels: die Tonart, die
  Stufe je Steinsorte und der Pad-Klang, der sie stehen lässt.
- `src/soundassets.js` — die vier Beigaben aus `assets`: an der Stelle im Dokument
  ablesen, an der das Bündeln sie eingesetzt hat, und an `sound.js` übergeben.
- `src/soundfiles.js` — das Netz darunter: im Datenordner suchen oder vom Anwender
  entgegennehmen, in Bytes verwandeln, an `sound.js` übergeben und sichern.
- `src/sounddiag.js` — die Ton-Diagnose (Taste `T`): legt offen, was jeder Klang
  gerade tut, spielt ihn auf Knopfdruck und nimmt Aufnahmen entgegen — gewählt oder
  über dem Fenster fallen gelassen.
- `src/style.css` — Grundmaße, Farben, Feld und Seitenspalten.
- `src/overlay.css` — Startbildschirm, Einblendungen, Knöpfe, Eingabefelder.
- `src/screens.css` — Wiedergabe und Bestenliste.
- `src/diag.css` — die Ton-Diagnose.

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

**Zwei Spielarten, eine Regel.** Neben dem klassischen Spiel gibt es das Endlosspiel:
Das Level bleibt dort, wo es begann — die Steine fallen von der ersten Sekunde an so
schnell wie am Ende, und es zählt nicht der Punktestand, sondern die durchgehaltene
Zeit. Umgesetzt ist das als ein einziges Feld `mode` im Spielstand ("classic" oder
"forever"), das genau eine Zeile der Regel schaltet: das Hochzählen des Levels nach
je zehn Reihen. Alles andere — Steinfolge, Punkte, Aufzeichnung, Wiedereinstieg —
bleibt Wort für Wort dasselbe. Ein neuer Spielmodus, der nichts verzweigt außer dem,
was er wirklich ändert.

Das Merkwort behält seinen Sinn: Es bestimmt auch im Endlosspiel die Steinfolge, ist
dort aber nicht die Aufgabe — die Aufgabe ist das Level. Weil die Zeit dort das
Ergebnis ist, muss die Uhr auch dann weiterlaufen, wenn sich am Spielstand gerade
nichts ändert; der Bildtakt stößt darum bei jeder neuen Sekunde ein Neuzeichnen an,
ohne dafür ein Bild aufzuzeichnen. Da das Level nie steigt, bleibt im Endlosspiel
auch die Farbe des Levels stehen und die Druckwelle des Levelaufstiegs aus — beides
fällt von selbst weg, ohne Sonderfall in der Bildschau.

**Das Endlosspiel kann musikalisch sein.** Jede Steinsorte ist eine Stufe einer
Tonart; erscheint ein Stein, klingt sein Akkord als weiches Pad und bleibt stehen,
bis der nächste Stein ihn ablöst. Die Zuordnung stammt vom Anwender und ist fest:
I → I, S → IV, O → II, Z → III, T → V, J → VI, L → VII. Die Tonart ist F-Dur, die
Stufen sind ihre Dreiklänge (F-Dur, g-Moll, a-Moll, B♭-Dur, C-Dur, d-Moll,
e-vermindert), dazu ein Bass eine Oktave unter dem Grundton; die Lagen steigen mit
der Stufe, weil ein Pad davon getragener klingt als von einem Sprung zurück in die
tiefe Oktave.

Das ist keine dritte Spielart, sondern ein Schalter des Endlosspiels: ein Feld
`musical` im Spielstand, das ausschließlich klingt — keine Regel, keine Wertung,
keine eigene Bestenliste hängen daran. Warum am Endlosspiel: Dort bleibt das Tempo
stehen, und die Musik ist das, was die Partie gliedert, statt einer steigenden Zahl.
Weil das Merkwort die Steinfolge bestimmt, bestimmt es damit auch die Akkordfolge —
dasselbe Wort spielt dieselbe Musik.

Ausgelöst wird das Bett dort, wo sein Anlass entsteht: in `spawn()`. Unterbrochen
wird es überall dort, wo die Partie stillsteht — Pause, Spielende, Verlassen, und in
der Wiedergabe, denn dort läuft kein Stein auf. Aus der Wiedergabe heraus
weiterzuspielen setzt es wieder an. In der Wiedergabe selbst schweigt es: Sie zeigt
Bilder, und ein Erscheinen ist ihnen nicht anzusehen — genau wie beim Schieben.
Geklungen wird über die Tonmaschine von `sound.js` (`bus()`), also über deren
Regler: Damit erfasst die Stummschaltung (Taste `S`) das Bett mit, ohne davon zu
wissen.

**Bewusste Abweichungen.** Drehungen dürfen um bis zu zwei Spalten ausweichen, wenn
sie sonst an einer Wand scheitern würden — das Original kennt das nicht, ohne es
ist Spielen an der Wand aber unnötig zäh. Dazu kommen ein Schattenriss der
Landestelle und die Leertaste zum sofortigen Fallenlassen (ein Punkt je Feld);
beides gibt es im Original ebenfalls nicht.

**Eine gehaltene Taste muss sich selbst bestätigen.** Das Wiederholen von Links,
Rechts und Runter läuft im Bildtakt weiter, solange ein Eintrag dafür besteht; er
entsteht beim Drücken und fällt beim Loslassen weg. Geht ein Loslassen verloren —
das kann es, die App sieht nur die Ereignisse, die sie bekommt —, schiebt sich der
Stein von allein weiter, und das Spiel ist verdorben. Darum altert jeder Eintrag:
Jeder Tastendruck setzt sein Alter zurück, auch die Wiederholung des Betriebssystems,
die eine gehaltene Taste laufend als weiteres Drücken meldet. Bleibt beides aus, gilt
die Taste als losgelassen. Zwei Fristen, weil die Systemwiederholung immer nur der
zuletzt gedrückten Taste gilt: Wer beim Schieben dreht, dessen Pfeiltaste hört auf zu
wiederholen, obwohl sie gehalten bleibt. Nur solange eine Taste selbst wiederholt,
zählt die kurze Frist; sonst die lange. Erkannt wird die Taste an ihrer Lage
(`e.code`), nicht an ihrem Zeichen, damit das Loslassen auch dann passt, wenn eine
Zusatztaste dazwischenkam. Dazu die groben Netze: Verlassen des Fensters, Verdecken
des Fensters und die Pause geben alle Tasten frei.

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
Momentaufnahmen zeigt. Was man ihm nicht ansieht — Schieben, Drehung, Fallenlassen,
Einrasten —, meldet die Regel selbst über ein kurzes Ereignisband `state.fx`, das
die Bildschau ausliest und leert. Das Band gehört nicht zum Spielstand und steht
darum weder in der Momentaufnahme noch in der Bestenliste. Das Schieben ist der
einzige Eintrag ohne Bild: Es meldet sich allein, damit es zu hören ist.

**Der Ton klingt im Augenblick des Zuges.** Die vier Klänge — Schieben und
Drehen, Aufsetzen, volle Reihen, Tetris — liegen als `<audio>` im Dokument.

**Die Aufnahmen sind die vier Beigaben aus dem Ordner `assets`** — `move-and-turn-shorter.wav`,
`drop-sound.mp3`, `row-completed-sound.mp3`, `tetris-sound.mp3`. Beim Bündeln setzt
Morphos an der Stelle einer Beigabe ihre `data:`-Quelle ein — die App selbst kann die
Datei nicht laden, denn im Fensterrahmen führt ein Pfad nirgendwohin, und ihr Blick
reicht nur in den Datenordner des Workspace. Alles hängt also daran, dass das Bündeln
die Stelle erkennt, an der der Pfad steht.

Welche Stelle das ist, war zunächst von außen nicht zu sehen; darum stand derselbe Pfad
eine Zeit lang an drei Stellen zugleich. Am gebauten Dokument ist es inzwischen
abgelesen: Das **`src` eines `<source>` im `<audio>`** trägt. Die beiden Ausweichwege —
eine `url(…)`-Stilregel und ein verstecktes `<img>` — sind wieder entfernt, denn sie
legten jede Aufnahme ein zweites und drittes Mal ins Dokument. `soundassets.js` liest
die Quelle beim Laden ab; was ein Pfad geblieben wäre, würde übergangen.
`TetrisSound.adoptUri()` hängt sie in die Elemente und entpackt sie zugleich für die
Tonmaschine.

**Darunter liegt ein Netz für den Fall, dass keine Stelle trägt:** zwei Wege, auf denen
die Bytes einer Aufnahme sonst noch in die laufende App gelangen; beide enden bei
`TetrisSound.adopt()`, das die Bytes entpackt UND zugleich als `data:`-Quelle in die
Elemente hängt. Was schon als Beigabe da ist, rühren sie nicht an — `TetrisSound.has()`
sagt ihnen, wo nichts mehr zu tun ist. Nur die ausdrückliche Wahl des Anwenders geht
weiterhin vor.

*Der eine Weg ist der Anwender selbst.* Er wählt die Dateien im Dateidialog des Browsers
(`<input type="file">`) oder lässt sie über dem Fenster fallen — dabei kommen echte Bytes
an, kein Pfad, und der Umweg über ein Dateisystem entfällt ganz. Das Fallenlassen gilt im
ganzen Fenster, nicht nur über der Diagnose; sie geht dabei von selbst auf und zeigt, was
daraus wurde. Zwei Formen: `intake()` erkennt am Dateinamen, welcher Klang gemeint ist —
der Weg für alle vier auf einmal; `intakeAs()` setzt den Klang fest — der Weg für die
Wahl in einer einzelnen Zeile, gleich wie die Datei heißt. Was hereinkommt, wird zugleich
als base64 nach `tetris-sounds/<klang>.txt` gesichert und in der Merkliste
`tetris-sounds.json` mit seinem ursprünglichen Namen vermerkt: Einmal hereingeholt,
bleibt es.

*Der andere Weg ist die Suche im Datenordner.* `soundfiles.js` sieht beim Start ohne
Zutun in der Merkliste `tetris-sounds.json`, im Ordner `tetris-sounds/` und im
Datenordner selbst nach; welcher Klang gemeint ist, verrät der Dateiname, welche Tonform
vorliegt, verraten die ersten Bytes. Gelesen werden beide Formen — die Bytes der
Tondatei selbst, sofern das Dateisystem sie unversehrt durchreicht, und dieselbe
Aufnahme als base64 in einer Textdatei; die zweite trägt immer, weil Text unterwegs
nichts verliert. Genau darum wird auch das Gesicherte als base64 abgelegt, und der
gesicherte Dateiname ist der Klang selbst (`move.txt`): So findet die Suche ihn wieder,
auch wenn die Merkliste verloren geht.

Findet sich nichts und reicht niemand etwas herein, bleibt es bei den eigenen Tönen —
der Datenordner ist keine Bedingung, sondern eine Möglichkeit.

**Ein Klang geht drei Wege, bis einer trägt.** Weil sich von außen nicht feststellen
lässt, welcher Weg in einem gegebenen Fensterrahmen wirklich zum Lautsprecher führt,
verlässt sich `sound.js` auf keinen einzigen. Jeder Anschlag versucht der Reihe nach:

1. **das `<audio>`-Element** — genauer eine von mehreren Kopien, damit ein Ton den
   vorigen nicht abschneidet. Der verlässlichste Weg, darum in der Regel der erste;
2. **den entpackten Klangkörper in der Tonmaschine** — aus den Bytes einer
   Aufnahme entsteht ein Klangkörper (`decodeAudioData`, ohne Netzzugriff).
   Vorlaufende Stille im Klang wird beim Starten übersprungen. Liegt ein
   Klangkörper bereit, rückt dieser Weg an die erste Stelle: Er klingt ohne Anlauf,
   das Element wird zum Rückfall;
3. **einen kurzen selbst erzeugten Ton** aus Oszillatoren der Tonmaschine.

Weist ein Weg ab, übernimmt noch derselbe Anschlag den nächsten — auch dann, wenn das
Element erst nachträglich ablehnt (`play()` gibt ein Versprechen). Ein Element, das
einen Fehler meldet oder keine spielbare Quelle hat, wird gar nicht erst gefragt. Der
dritte Weg ist der Notnagel: Er ersetzt die Aufnahme nicht, er verhindert nur, dass
das Spiel stumm bleibt, wenn die Beigaben nicht ankommen. Jeder Klang bekommt seine
Bank auch dann, wenn sein Element beim Laden noch fehlt — sonst gäbe es später nichts
zu spielen; nach dem Element wird bei jedem Anschlag erneut gesucht.

**Der Ton kann sich selbst erklären.** `sound.js` gibt über `report()` Auskunft: je
Klang, ob sein Element im Dokument steht, ob seine Quelle eingebettet wurde, was das
Entpacken ergab, welcher Weg zuletzt getragen hat und woran der letzte Versuch
scheiterte. Die Ton-Diagnose (`sounddiag.js`, Taste `T`) zeigt das und spielt jeden
Klang auf Knopfdruck — einmal die ganze Kette, einmal nur den eigenen Ton. Darunter
stehen die beiden Herkünfte: erst die Beigaben (`soundassets.js`) mit Dateiname, Größe
und dem Vermerk *übernommen* oder *nicht eingebettet* — daran ist abzulesen, ob das
Bündeln die Aufnahmen eingesetzt hat. Dann, als Netz, die Aufnahmen aus dem
Datenordner (`soundfiles.js`); dort kommen sie auch herein — ein Feld
zum Fallenlassen, ein Knopf zum Wählen aller vier auf einmal, je Zeile einer für
einen einzelnen Klang und einer zum erneuten Suchen im Datenordner. Der Klick
ist dabei die stärkste Zustimmung des Anwenders, die der Browser kennt: Was auf
Knopfdruck stumm bleibt, bleibt nicht wegen fehlender Zustimmung stumm. Sie hängt an
einer eigenen Preact-Wurzel (`#diag`) und liegt damit über jeder Ansicht, ohne dass
eine davon von ihr wissen muss. `Esc` gehört weiter dem Spiel; nur `T` schließt sie.

**Ausgelöst wird jeder Klang dort, wo sein Anlass entsteht.** Was die Regel meldet —
Schieben, Drehen, Aufsetzen —, klingt in `engine.js`, noch im selben Tastendruck: Das
Ereignisband wird erst im nächsten Bild gelesen, und ein Klang, der ein Bild später
kommt, klingt nach dem Zug statt mit ihm. Volle Reihen sieht man dem Zustand an; sie
klingen in der Bildschau (`fx.js`) und sind darum das Einzige, was auch in der
Wiedergabe zu hören ist. Ein Mindestabstand je Klang hält die Salve einer gehaltenen
Taste ab — er liegt unter der Wiederholrate, damit kein wirklicher Zug stumm bleibt.
Die Tonmaschine erwacht mit dem ersten Tastendruck oder Klick — vorher darf ohne
Zutun des Anwenders nichts klingen; entpackt wird trotzdem schon beim Laden. Die
beiden Wege, die auf sie bauen, kommen in einem Rahmen, der sie nie erwachen lässt,
nie zum Zug — das Element aber schon. Darum steht es an erster Stelle.
Ein Schalter (Taste `S`, dazu ein Knopf auf dem Startbildschirm) stellt alles still; er
gehört keiner Ansicht und wird darum vor allen anderen Tasten abgefragt. Wie alles
außer der Bestenliste lebt er nur für diese Sitzung.

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
daraus ableiten lässt und nichts verloren geht. Aus der Liste heraus lässt sich das
gewählte Wort sofort wieder spielen — die Bestenliste ist damit nicht nur Rückblick,
sondern der kürzeste Weg zur nächsten Runde derselben Aufgabe. Das Startlevel bleibt
dabei das auf dem Startbildschirm gewählte; die Enter-Abkürzung gilt nur, wenn keine
laufende Partie daran hängt.

Zusammengefasst wird beim Anzeigen: gruppiert nach dem normalisierten Merkwort, denn
es bestimmt die Steinfolge, also die Aufgabe. Voreingestellt zeigt jede Zeile den
besten Wert dieses Wortes und die Zahl der Partien; die einzelnen Partien mit allen
Zahlen stehen daneben. Wer dieselbe Aufgabe zehnmal spielt, sieht daran seinen
Fortschritt.

**Jede Spielart hat ihre eigene Liste.** Endlospartien sind mit klassischen nicht
vergleichbar — ein Punktestand aus einer Partie, in der das Level nie steigt, sagt
etwas anderes. Darum trägt jeder Eintrag seine Spielart, und die Ansicht hat zwei
Register: Klassisch gruppiert nach dem Merkwort und ordnet nach Punkten, Endlos
gruppiert nach dem festen Level und ordnet nach der durchgehaltenen Zeit. Es bleibt
dabei eine einzige Datei mit einer einzigen flachen Liste; getrennt wird erst beim
Anzeigen. Einträge aus früheren Fassungen der App haben kein Feld für die Spielart —
sie gelten als klassisch, die alte Liste bleibt also unverändert lesbar. Die
Endlosliste ist nach Level geordnet, nicht nach Bestwert: Level 9 zehn Sekunden
durchzuhalten ist mehr wert als Level 0 zehn Minuten, und das kann nur der Anwender
gewichten.

Die Liste wird beim Öffnen der App gelesen und nach jeder beendeten
Partie geschrieben; fehlt der Datenordner, lebt sie nur in dieser Sitzung weiter und
sagt das auch. Eine Partie, die aus der Aufzeichnung heraus fortgesetzt wurde, trägt
den Vermerk des Wiedereinstiegs — ihr Ergebnis ist mit einem durchgespielten nicht
vergleichbar.

**Sonst kein Speichern.** Außer der Bestenliste hält das Spiel keinen Zustand über
einen Neustart hinaus. Das Band der Aufzeichnung lebt nur so lange wie die Partie und
wird mit jedem neuen Spiel verworfen.
