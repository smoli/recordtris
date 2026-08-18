# Tetris — Anleitung

## Ziel

Fallende Steine so stapeln, dass eine Reihe über die volle Breite geschlossen ist.
Volle Reihen blinken kurz auf und verschwinden, alles darüber rutscht nach. Erreicht
ein Stein die Oberkante, ist das Spiel vorbei.

## Anfangen

Beim Start wählst du das **Startlevel** (0 bis 9). Je höher, desto schneller fallen
die Steine von Anfang an — und desto mehr Punkte bringt jede Reihe. Dann auf
**Spiel starten** klicken oder Enter drücken.

Darunter steht das **Merkwort**. Es bestimmt, welche Steine kommen: Mit demselben
Wort fällt jedes Mal dieselbe Folge — gut, um eine Partie zu wiederholen, bis sie
sitzt, oder um mit jemand anderem dieselbe Partie zu spielen und die Punkte zu
vergleichen. Beim Öffnen steht dort ein gewürfeltes Wort; du kannst es überschreiben
oder mit dem Würfel 🎲 ein neues holen. Erlaubt sind Buchstaben und Ziffern, bis zu
sechzehn Zeichen. Groß- und Kleinschreibung macht keinen Unterschied.

Während des Spiels steht das Wort rechts in der Spalte, nach dem Spielende auch in
der Einblendung — du kannst es dir also noch notieren, wenn die Partie gut lief.
**Noch einmal** und Enter starten dieselbe Folge erneut.

Wenn die Tasten nicht reagieren, einmal ins Spielfeld klicken.

## Tasten

| Taste | Wirkung |
| --- | --- |
| ← → | Stein nach links oder rechts verschieben (gedrückt halten wiederholt) |
| A | Stein gegen den Uhrzeigersinn drehen |
| D | Stein im Uhrzeigersinn drehen |
| ↓ | einen Schritt tiefer, gibt einen Punkt |
| Leertaste | sofort ganz nach unten fallen lassen |
| P | Pause und weiter |
| R | in der Pause oder nach dem Spielende: Aufzeichnung ansehen |
| H | Bestenliste öffnen (auf dem Startbildschirm, in der Pause, nach dem Spielende) |
| Esc | Spiel beenden, zurück zum Startbildschirm |
| Enter | nach dem Spielende noch einmal dieselbe Steinfolge; in der Bestenliste das gewählte Wort spielen |

Der blasse Umriss unten im Feld zeigt, wo der Stein landen wird.

## Aufzeichnung und Wiedergabe

Jede Partie wird von der ersten Sekunde an mitgeschrieben. In der **Pause** und nach
dem **Spielende** führt der Knopf *Aufzeichnung ansehen* (oder die Taste **R**) zur
Wiedergabe. Das Feld zeigt dann nicht das Spiel, sondern die Aufnahme — Punkte,
Level, Statistik und Vorschau laufen mit.

Unter dem Feld liegt die Bedienleiste:

- Der **Schieberegler** springt an jede beliebige Stelle.
- **⏮ ⏭** an den Anfang oder ans Ende, **◀| |▶** ein einzelnes Bild zurück oder vor.
- **▶** spielt vorwärts ab, **◀◀** rückwärts. Ein zweiter Klick hält an.
- **Tempo** von ¼× bis 4× — die Aufnahme läuft sonst im Tempo der Partie.

| Taste | Wirkung in der Wiedergabe |
| --- | --- |
| ← → | ein Bild zurück oder vor (gedrückt halten spult) |
| Leertaste | abspielen und anhalten |
| B | rückwärts abspielen |
| 1 … 5 | Tempo ¼×, ½×, 1×, 2×, 4× |
| Enter | hier weiterspielen |
| Esc | zurück zum Spiel |

### Hier weiterspielen

Der wichtigste Knopf: **Hier weiterspielen** macht aus der gezeigten Stelle wieder
ein laufendes Spiel — mit demselben Feld, denselben Punkten und derselben Steinfolge,
die von dort an gekommen wäre. Damit lässt sich ein misslungener Zug beliebig weit
zurücknehmen und anders versuchen. Das Spiel läuft sofort weiter, halte dich also
bereit. Was danach passiert, wird von dieser Stelle an neu aufgezeichnet; der alte
Verlauf ab dort ist damit weg.

Ein Bild, in dem das Spiel schon verloren ist, lässt sich nicht fortsetzen — spule
ein Stück zurück, dann geht es wieder.

## Bestenliste

Jede Partie, die mit *Game Over* endet, wird von selbst festgehalten — du musst nichts
tun. Der Knopf **Bestenliste** (oder die Taste **H**) zeigt sie: auf dem
Startbildschirm, in der Pause und nach dem Spielende.

Links steht jedes Merkwort, das du je gespielt hast, mit seinem **besten Punktestand**
und der Zahl der Partien; die stärksten Wörter stehen oben. Ein Klick auf ein Wort
zeigt rechts alle Partien dazu, die beste zuerst, und zu jeder:

- **Datum und Uhrzeit** der Partie und die erreichten **Punkte**
- **Reihen**, **Level** (samt Startlevel) und die **Dauer**
- wie oft du **Einfach**, **Doppel**, **Dreifach** und **Tetris** geräumt hast
- wie oft jede **Steinsorte** kam

Weil dasselbe Merkwort immer dieselbe Steinfolge bringt, sind die Partien eines Wortes
direkt vergleichbar: Spiel dieselbe Aufgabe mehrmals und sieh zu, wie der Bestwert
steigt. Auf dem Startbildschirm steht unter dem Wortfeld gleich, was dein Bestwert für
dieses Wort ist und wie oft du es gespielt hast; nach dem Spielende siehst du deinen
Platz — oder die Meldung, dass es ein neuer Bestwert war.

Rechts über den Partien steht der Knopf **▶ Dieses Wort spielen**: Er startet auf der
Stelle ein neues Spiel mit genau diesem Merkwort — also mit derselben Steinfolge.
Kommst du vom Startbildschirm oder vom Spielende, genügt auch **Enter**. Darunter
steht, mit welchem Startlevel gestartet wird; das ist das, was du auf dem
Startbildschirm gewählt hast. Öffnest du die Liste aus der **Pause** heraus, weist der
Hinweis darauf hin, dass die laufende Partie dabei verworfen wird — dort gibt es
absichtlich keine Enter-Abkürzung.

Eine Partie, die du über *Hier weiterspielen* aus der Aufzeichnung fortgesetzt hast,
wird ebenfalls eingetragen, aber mit dem Vermerk **↻ mit Wiedereinstieg gespielt** —
sie ist mit einer durchgespielten Partie nicht ganz vergleichbar.

Die Liste liegt als Datei `tetris-highscores.json` im Datenordner und bleibt damit
über das Schließen der App hinaus erhalten. Ist kein Datenordner eingerichtet, sagt
die Liste das oben an — sie gilt dann nur für die laufende Sitzung.

## Anzeigen

- **Punkte** — eine Reihe zählt 40, zwei 100, drei 300, vier auf einmal 1200 —
  jeweils mal Level plus eins. Jedes Feld, das du selbst tiefer schiebst oder
  fallen lässt, gibt einen Punkt dazu.
- **Level** und **Reihen** — alle zehn Reihen steigt das Level, die Steine fallen
  schneller.
- **Nächster** — der Stein, der als Nächstes kommt; er dreht sich langsam vor dir.
- **Statistik** links — wie oft jede Steinsorte bisher kam.

## Das Bild

Gespielt wird nicht auf einer Fläche, sondern in einem Schacht, in den du
hineinschaust. Die Steine sind Körper mit leuchtendem Kern: Der fallende Stein nimmt
sein Licht mit und wirft einen Schatten auf die Rückwand. Setzt er auf, läuft eine
Druckwelle über die Stelle; lässt du ihn fallen, zieht er Lichtbahnen hinter sich her.
Volle Reihen glühen weiß auf und zerspringen, dann rutscht der Stapel nach. Mit jedem
Level wechselt die Grundfarbe des Schachts.

All das ist nur Anblick — gespielt wird genau wie zuvor, und auch die Punkte ändern
sich dadurch nicht. Kann dein Rechner die räumliche Darstellung nicht anzeigen, zeigt
das Spiel von selbst das flache Feld wie früher; spielen lässt es sich dann genauso.

## Das Besondere

Welcher Stein kommt, wird nach dem Verfahren des Original-Tetris gewürfelt. Es
verhindert kurze Wiederholungen desselben Steins, garantiert aber nichts: Es kann
lange dauern, bis die ersehnte lange Stange kommt. Wer moderne Tetris-Fassungen
gewohnt ist, in denen alle sieben Steine reihum garantiert sind, merkt den
Unterschied schnell — und sollte flacher stapeln.

## Grenzen

Gespeichert werden nur die Ergebnisse der Partien, nicht die Partien selbst: Die
Aufzeichnung gehört zur laufenden Partie und lässt sich nicht ablegen. Aus der
Bestenliste lässt sich nichts löschen. Ein Ergebnis wird nur eingetragen, wenn die
Partie mit *Game Over* endet — brichst du mit Esc ab, zählt sie nicht.

Ein neues Spiel oder Esc zum Startbildschirm verwirft die Aufzeichnung. Weitergeben
lässt sich aber das Merkwort — damit spielt jemand anderes dieselbe Steinfolge.
