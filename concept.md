# Tetris

## Zweck

Ein spielbares Tetris für den Desktop — im Aussehen und in den Regeln nah am
Original der NES-Fassung, beim Würfeln der Steine dagegen nach dem 35er-Vorrat
von Tetris The Grand Master 3.

## Nutzen

Der 35er-Vorrat liegt zwischen den beiden bekannten Welten: Er garantiert nicht
wie das Sieben-Bag-Verfahren, dass jede Sorte in jedem Siebenerblock vorkommt —
Durststrecken und gelegentliche Dopplungen bleiben also möglich. Er lässt sie aber
nicht ausufern, weil jeder gezogene Stein im Vorrat durch den ersetzt wird, der am
längsten aussetzt. Über die Zeit gleicht sich die Verteilung von selbst aus, ohne
dass die Folge vorhersagbar würde.

## Aufbau

- `src/index.html` — Einstieg, lädt Preact (`morphos:lib`) und die vier Bausteine.
- `src/rng.js` — der Zufall: das 16-Bit-Schieberegister als Quelle, der Vorrat von
  35 Steinen, das Gedächtnis der letzten vier und die Durstliste.
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
  Stufe je Steinsorte und der Pad-Klang, der ihre Oberstimmen stehen lässt.
- `src/bass.js` — der Bass darunter: die eine durchlaufende Stimme, die Leiter
  der Akkordtöne, auf der sie steht, die Züge, die sie stellen — Links und
  Rechts rücken eine Sprosse, die Drehung springt zwei —, das Ausklingen jedes
  Anschlags und das Raster, auf das er wahlweise rückt.
- `src/drums.js` — das Schlagzeug: das Muster über zwei Takte, die drei aus
  Sinus und gefiltertem Rauschen gerechneten Schläge, der Wirbel für gefallene
  Reihen und der Vorratsleger, der alles auf die Uhr der Tonmaschine legt — der
  Puls der Musik, und über `grid()` auch ihr Raster.
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

**Der 35er-Vorrat statt des NES-Zufalls.** Das Spiel begann mit dem Auswahlverfahren
des NES (ein Wurf, bei Wiederholung genau ein zweiter). Es erzeugte Ketten von drei
und vier gleichen Steinen — erwartbar für dieses Verfahren, aber unbefriedigend.
An seine Stelle ist der Vorrat aus Tetris The Grand Master 3 getreten:

- Ein **Vorrat von 35 Steinen**, fünf je Sorte. Gezogen wird ein Platz darin.
- Ein **Gedächtnis der letzten vier** gezogenen Steine. Liegt der getroffene Stein
  darin, wird neu gewürfelt — bis zu sechs Würfe je Zug; der sechste gilt in jedem Fall.
- Eine **Durstliste** der sieben Sorten, vorn die am längsten nicht gezogene. Jeder
  geleerte Platz — der eines Fehlwurfs wie der des gezogenen Steins — bekommt den
  vordersten Stein dieser Liste; der gezogene wandert an ihr Ende. So wächst der
  Anteil einer ausbleibenden Sorte im Vorrat, bis sie kommt.

Als Zufallsquelle bleibt das 16-Bit-Schieberegister erhalten, damit das Merkwort
weiter die Partie bestimmt: Bit 1 und Bit 9 werden verknüpft, das Ergebnis wandert
oben hinein. Für ein Byte läuft es acht Schritte (sonst teilten zwei Bytes
nacheinander sieben ihrer acht Bits), und beide Hälften werden verschränkt. Für einen
Platz 0–34 werden Bytes ab 245 verworfen statt umgebogen — 245 ist sieben mal
fünfunddreißig, sonst kämen die vorderen Plätze häufiger.

Das Gedächtnis beginnt mit S, Z, S, O. Damit sind beim ersten Zug genau die drei
Sorten gesperrt, mit denen sich schlecht anfangen lässt: Das Spiel startet fast
immer mit I, J, L oder T.

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
e-vermindert).

**Der Bass ist ein Ton, und der Anwender spielt ihn.** Zuerst lag unter dem
Akkord ein gehaltener Grundton, dann schritt dort eine Figur den Akkord aus;
jetzt steht dort genau EIN Ton — der, auf den der Anwender den Bass gestellt hat.
Die Züge des Steins stellen ihn:

- **Ein neuer Stein** lässt ihn auf seiner Sprosse stehen und gibt ihm den Ton
  des neuen Akkords. So bleibt die Linie, die der Anwender gespielt hat, über
  den Akkordwechsel hinweg erhalten.
- **Links und rechts** rücken eine Sprosse tiefer oder höher.
- **Eine Drehung** springt zwei Sprossen weiter und läuft über das obere Ende
  der Leiter hinaus wieder unten ein. So trifft auch sie einen anderen Ton des
  Akkords, aber im Sprung statt im Schritt — hörbar anders als der Zug zur
  Seite, und bei vier Sprossen ein Pendeln zwischen den beiden Hälften der
  Leiter (Grundton ↔ Quinte, Terz ↔ oberer Grundton).

Die Leiter sind die Töne des Dreiklangs im Bassbereich, aufsteigend: die Quinte
eine Oktave unter dem Grundton, darüber Grundton, Terz und Quinte — vier
Sprossen, an deren Enden der Schritt zur Seite stehen bleibt und nur wiederholt
wird. Der Grundton liegt eine Oktave unter dem Grundton der
Tonart, sodass die Stufen eine diatonische Basslinie ergeben. Das Pad behält nur
die Oberstimmen, damit die tiefe Lage dem Bass gehört.

**Die Leiter endet oben auf der Quinte, nicht auf dem Grundton.** Zuerst war die
oberste Sprosse der Grundton eine Oktave höher. Bei den oberen Stufen (V, VI,
VII) lag sie damit über dem mittleren C — dort ist kein Bass mehr, sondern eine
Mittelstimme, die dem Pad ins Gehege kommt. Also ist die Leiter um eine Sprosse
nach unten gerückt: dieselben vier Töne des Dreiklangs, dieselbe Weite von einer
Oktave, aber die oberste liegt in jeder Stufe unter dem mittleren C und die
unterste ist die Quinte darunter. Der Grundton behält dabei seine Tonhöhe — die
Basslinie über die Akkordwechsel hinweg ist dieselbe wie zuvor; nur ist er jetzt
die zweite Sprosse statt der ersten, und dort (`HOME`) beginnt der Bass auch.

Es klingt **eine einzige Stimme, die durchläuft**, statt für jeden Anschlag eine
neue: So gibt es beim Wechsel weder Knacken noch Lücke, und die Tonhöhe kann auch
ohne neuen Anschlag nachrücken. Das braucht es, weil eine gehaltene Taste sich
zwanzigmal in der Sekunde wiederholt (`DAS_RATE` 50 ms): Liegen zwei Züge dichter
als 0,11 s beieinander, rückt nur noch die Tonhöhe nach, ohne neuen Anschlag —
sonst wäre der Bass beim Halten ein Maschinengewehr. Der Anschlag selbst ist eine
kurze Senke der Lautstärke, in der auch die Tonhöhe springt, und ein Filter, das
mit ihm auf- und wieder zufällt.

**Und er verklingt.** Zuerst blieb der Anschlag auf einem Halt stehen, bis der
nächste kam. Bei einer Stimme, die ohnehin durchläuft, ist das ein Dauerton unter
der Musik — ein Brummen statt eines gespielten Basses, und es nimmt jedem
einzelnen Anschlag seine Gestalt. Jetzt sinkt er von diesem Halt in `DECAY` = 2,4
Sekunden ganz weg. Wer spielt, hört ihn durchgehend, denn jeder Zug setzt ihn neu
an; wer eine Weile nichts tut, hört ihn ausgehen. Die Stille zwischen zwei Zügen
gehört damit zu dem, was der Anwender spielt.

Weil ein Anschlag nun eine Kurve über Sekunden ist und sein Beginn im Raster auch
in der Zukunft liegen kann, wird eine laufende Kurve nicht mehr auf ihren Wert von
*jetzt* festgeschrieben, sondern mit `cancelAndHoldAtTime` auf ihren Wert *zur
Zeit des Anschlags* — sonst spränge das Ausklingen in der Wartezeit auf das Raster
zurück nach oben.

**Das Schlagzeug führt die Uhr der Musik.** Sie lag beim Bass, solange der eine
Figur ausschritt; seit er nur noch auf Zuruf anschlägt, hat er keinen Puls mehr,
an den sich etwas hängen ließe. Also liegt der Vorratsleger jetzt im Schlagzeug —
und weil er der einzige Zeitgeber der Musik ist, gibt es nichts, wogegen er
driften könnte. Gelegt wird im Voraus auf die Uhr der Tonmaschine, nicht auf den
Bildtakt: Ein Zeitgeber des Fensters ist für einen Puls zu ungenau. Ein
`setInterval` weckt alle 50 ms den Vorratsleger, der alles einträgt, was in der
nächsten Viertelsekunde fällig ist; ist die Uhr davongelaufen, weil das Fenster
stillstand, schließt der Puls auf, statt die verpassten Schritte nachzuholen.
Der Puls beginnt mit dem ersten Stein und läuft über die Akkordwechsel hinweg
durch — ein Neuansetzen bei jedem Stein wäre genau der Absatz, den die Blende
ringsherum vermeidet.

Ein Schritt ist eine Achtel, acht davon ein Takt; das Muster geht über zwei Takte,
damit die Wiederholung nicht sofort als solche auffällt: Trommel auf die Eins und
die Drei, Schlag auf die Zwei und die Vier, Hut auf jeder Achtel mit Betonung auf
den Zählzeiten, am Ende ein Auftakt. Geschlagen wird mit dem, was die Tonmaschine
selbst hergibt — ein fallender Sinus für die Trommel, hochpassgefiltertes Rauschen
für Schlag und Hut, dazu ein kurzer Ton als Körper des Schlags. Keine Aufnahme,
also auch nichts, was fehlen könnte. Einen eigenen Schalter hat es nicht: Es
beginnt mit dem ersten Akkord, endet mit dem Klangbett und hängt wie alles am
Regler von `sound.js`.

**Gefallene Reihen bekommen einen Wirbel.** In der musikalischen Partie schweigt
der Klang der vollen Reihe — die Stelle, an der das Spiel am meisten zu melden
hat, war damit die stillste. Das Schlagzeug füllt sie: Für die nächsten Schritte
tritt an die Stelle des Musters ein Wirbel aus anschwellenden Sechzehnteln auf
dem Fell, vorn und hinten eine Trommel. Seine Länge sagt, wie viele Reihen fielen
(zwei Schritte bis vier beim Tetris). Ausgelöst wird er in `lock()`, wo die vollen
Reihen erkannt werden, und er beginnt beim nächsten Schritt, der noch nicht auf
der Uhr liegt — ein Wirbel gehört auf den Puls, nicht zwischen ihn. Das ist
höchstens eine Achtel später und trifft damit ungefähr das Aufblitzen der Reihen.
Der Schrittzähler läuft
unter ihm weiter, sodass das Muster danach dort einsetzt, wo es ohne ihn stünde.

**Das Raster ist der Puls, den man borgen kann.** Auf Wunsch soll der Bass nicht
im Augenblick des Zuges klingen, sondern auf dem Puls. Weil die einzige Uhr der
Musik im Schlagzeug liegt, gibt es sie dort als `grid(t, div)` heraus: den
nächsten Rasterpunkt ab `t`. Der Bass fragt danach und legt seinen Anschlag
dorthin — auf Sechzehntel, also höchstens eine halbe Achtel später. Mehr wäre als
Verzögerung der eigenen Taste zu spüren; weniger würde nichts zurechtrücken.
Fällt ein weiterer Zug in die Wartezeit, greift dieselbe Regel wie beim
Tastenhalten: Die Tonhöhe rückt sofort nach, angeschlagen wird einmal. Das Raster
ist ein Schalter der Sitzung, kein Feld des Spielstands: Es klingt nur, ändert
weder Regel noch Aufzeichnung, und die Momentaufnahme weiß nichts davon.

**Die Züge des Steins spielen den Bass.** Das ist das Einzige an der Musik, das
der Anwender unmittelbar in der Hand hat — die Akkordfolge selbst gehört dem
Merkwort. Ausgelöst wird es in `move()` und `rotate()`, direkt neben dem Klang
des Zuges — der in der musikalischen Partie ohnehin schweigt, sodass der Bass an
seine Stelle tritt. Nur ein gelungener Zug zählt; einer, der an der Wand
scheitert, ändert nichts. Weil die Aufzeichnung Bilder speichert und keine
Handgriffe, bleibt das der Wiedergabe fern — dort läuft, wie das ganze Bett,
nichts.

**Der Wechsel selbst soll nicht zu hören sein, nur der neue Akkord.** Zwei
Entscheidungen tragen das. Erstens die Blende: Ein- und Ausblendung dauern gleich
lang und laufen als sin- und cos-Kurve gegeneinander, weil ihre Summe damit
konstant bleibt — zwei gegenläufige Rampen in Dezibel (die frühere Lösung) stehen
in der Mitte beide sehr tief und reißen dort ein hörbares Loch auf, das den
Wechsel zum Absatz macht. Zweitens die Stimmführung: Welche Töne ein Akkord hat,
steht fest, in welcher Oktave jeder klingt, nicht — gewählt wird die Umkehrung mit
der geringsten Bewegung gegenüber dem vorigen Akkord, sodass jede Stimme ein, zwei
Halbtöne rückt, statt dass der ganze Klang springt. Ein schwacher Zug zu einer
mittleren Lage hält die Folge davon ab, auf Dauer wegzulaufen. Damit gehaltene
Töne sich beim Überblenden nicht mit sich selbst auslöschen, bekommt jeder Akkord
ein wechselndes Feinstimmen von ±2,5 Cent: Aus einer Auslöschung wird ein langsames
Schweben. Das Filter geht beim Einsetzen nur noch ein Stück weiter auf statt von
dumpf nach hell durchzufahren, denn ein voller Aufzug klingt wie ein neuer
Anschlag. All das ist reine Klangrechnung — die Akkordfolge bleibt dieselbe, und
dasselbe Merkwort klingt weiterhin gleich.

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

**In der musikalischen Partie schweigen die Spielgeräusche.** Klopfen, Klicken und
das Aufblitzen der vollen Reihe stünden quer zu den Akkorden; wo musiziert wird,
gehört das Ohr der Musik. Gefiltert wird an denselben beiden Stellen, an denen die
Geräusche ausgelöst werden — `emit()` in `engine.js` für Schieben, Drehen und
Aufsetzen, `clearBurst()` in `fx.js` für die vollen Reihen. Beide sehen `musical`
am Spielstand, den sie ohnehin in der Hand haben; es braucht dafür keinen Schalter
in `sound.js`. Weil die Momentaufnahme `musical` mitführt, gilt es auch für die
Wiedergabe einer musikalischen Partie. Die Bilder bleiben unberührt — still wird
nur der Ton.

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

Nachgezogen wird dabei nur nach unten. Das Gleiten ist ein Vorgriff auf das
nächste Feld — und der Vorgriff kann hinfällig werden: Schiebt man den Stein zur
Seite oder dreht ihn, und er kommt dort auf etwas zu stehen, gehört er wieder
genau auf seine Zeile. Wird diese Rücknahme weich gezogen, sieht man erst den
Stein ein paar Bilder tief im Stapel stecken und dann auf ihn hochschnappen —
zwei Bewegungen für einen Zug. Darum wird die Höhe nach oben ohne Nachziehen
gesetzt: Sie ändert sich im selben Bild wie das Schieben, das der Anwender
ohnehin gerade verfolgt. Weil das Ziel selbst nie unter der Landestelle liegt und
die nachgezogene Höhe es nie überholt, steht der gezeichnete Stein damit
nie im Stapel.

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
der innere Zustand des Zufalls, also Register, Vorrat, Gedächtnis und Durstliste.
Weil der sich nur beim Ziehen eines Steins ändert, gibt ihn `rng.js` als eine
aufgehobene Zeichenkette heraus: Alle Bilder zwischen zwei Steinen teilen sich
dasselbe Stück im Speicher. Nicht die Tastendrücke werden aufgezeichnet,
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

**Ältere Bänder bleiben lesbar.** Der Wechsel des Zufalls hat die drei Stellen
verändert, an denen ein Bild im Archiv seinen Zustand ablegt. Erkannt wird das an der
Art des Werts: Wo eine Zeichenkette steht, stammt das Band aus dieser Fassung. Ein
Band der Fassung 1 lässt sich weiterhin vollständig ansehen und auswerten — nur ein
Wiedereinstieg an einer seiner Stellen beginnt den Zufall von vorn, weil der alte
Zustand für den Vorrat nichts hergibt.

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
