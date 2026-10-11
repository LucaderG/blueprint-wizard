# Benutzerhandbuch Blueprint-Wizard

Dieses Handbuch erklärt Schritt für Schritt, wie du mit dem Blueprint-Wizard arbeitest. Die Namen der Knöpfe sind genau so geschrieben, wie du sie in der App siehst.

## Inhalt

1. Was die App macht und wie deine Daten geschützt sind
2. Erste Schritte
3. Die drei Einstiege
4. Die Blueprint-Übersicht
5. Fragen beantworten
6. Entscheidungen, Vorschläge und Widersprüche
7. Blueprint fertigstellen und exportieren
8. Einstellungen
9. Als App installieren und offline nutzen
10. Projekte sichern, exportieren und importieren
11. Häufige Probleme

## 1. Was die App macht und wie deine Daten geschützt sind

Der Blueprint-Wizard hilft dir, aus einer Idee einen Projekt-Blueprint zu machen. Ein Blueprint beschreibt dein Projekt in zehn Abschnitten, zum Beispiel das Problem, die Zielgruppe, die Kernfunktionen und den Tech-Stack. Am Ende lädst du den Blueprint als Dateien herunter. Mit diesen Dateien startest du dein Projekt in einem KI-Coding-Tool.

Du kannst bei null anfangen, mit einer halben Idee oder mit einem fast fertigen Konzept. Die App stellt dir Fragen, zeigt Lücken und Widersprüche und macht Vorschläge. Entscheiden musst du selbst.

**So werden deine Daten geschützt:**

- Deine Projekte speichert die App in deinem Browser. Dafür nutzt sie die Datenbank IndexedDB. Die App hat kein Konto und keinen eigenen Server.
- Dein OpenRouter-API-Key wird nur in deinem Browser gespeichert. Er liegt dort unverschlüsselt. Wer Zugriff auf dein Browserprofil hat, kann ihn lesen.
- Wenn du KI-Funktionen nutzt, schickt die App deine Texte und deinen Key direkt an OpenRouter. Dazwischen gibt es keinen Server der App. OpenRouter leitet deine Anfrage an den Anbieter des gewählten Modells weiter. Für diese Anbieter gelten deren Datenschutzregeln.
- Die App enthält keine Tracking-Dienste.
- Ohne KI-Funktionen bleibt alles in deinem Browser. Der Export braucht keinen API-Key.

**Wichtig:** Dein Browser ist der Speicher. Wenn du Browserdaten löschst, sind deine Projekte weg. Lies dazu Abschnitt 10 und 11.

## 2. Erste Schritte

### App öffnen

Du hast zwei Möglichkeiten:

- **Im Browser:** Öffne die Adresse https://lucaderg.github.io/blueprint-wizard/
- **Auf deinem Rechner:** Dafür brauchst du Node.js in Version 22 und ein Terminal. Öffne im Projektordner das Terminal und führe `npm install` aus. Danach startest du die App mit `npm run dev`. Das Terminal zeigt dir die Adresse an, meist http://localhost:5173.

Projekte sind an die Adresse gebunden, unter der du die App öffnest. Projekte aus `localhost` siehst du also nicht unter der öffentlichen Adresse und umgekehrt. Dasselbe gilt für andere Browser und Geräte.

### OpenRouter-Key holen und eintragen

Die KI-Funktionen brauchen einen eigenen API-Key von OpenRouter. So bekommst du ihn:

1. Klicke oben rechts auf **Einstellungen**.
2. Klicke im Abschnitt „OpenRouter-API-Key“ auf **API-Key bei OpenRouter erstellen**. Die Seite von OpenRouter öffnet sich in einem neuen Tab.
3. Melde dich bei OpenRouter an und erstelle dort einen Key. Die genauen Schritte stehen auf der Seite von OpenRouter.
4. Kopiere den Key. Er beginnt meist mit `sk-or-`.
5. Füge den Key in das Feld **API-Key** ein. Mit dem Auge-Symbol neben dem Feld siehst du den Key im Klartext.
6. Klicke auf **Speichern**. Der Key ist dann hinterlegt.
7. Klicke auf **Verbindung testen**. Bei Erfolg erscheint „Verbindung erfolgreich“. Darunter siehst du deinen bisherigen Verbrauch und, falls es ein Limit gibt, das verbleibende Limit.

Für kostenpflichtige Modelle braucht dein OpenRouter-Konto Guthaben. Ein fehlendes Guthaben zeigt die App als Fehler an (siehe Abschnitt 11).

### Modell wählen

Das Modell bestimmt, welche KI antwortet und was eine Anfrage kostet. Du findest die Auswahl im Abschnitt **Modell** der Einstellungen.

- Das Standardmodell ist `anthropic/claude-haiku-5.5`.
- Die Liste der Modelle lädt die App von OpenRouter. Mit dem Feld **Modelle filtern** suchst du nach Name oder Modell-ID, zum Beispiel nach „claude“.
- Die Option **Nur Modelle mit strukturierten Antworten** ist standardmäßig aktiv. Die App arbeitet mit strukturierten Antworten. Lass die Option deshalb an.
- Jedes Modell zeigt seinen Preis: Eingabe und Ausgabe, jeweils pro Million Tokens. Ein Token ist ein kleines Stück Text.
- Ein Klick auf ein Modell in der Liste wählt es aus. Die Auswahl wird sofort gespeichert.
- Mit **Standard wiederherstellen** kehrst du zum Standardmodell zurück.
- Lädt die Liste nicht, zeigt die App die Meldung „Die Modellliste konnte nicht geladen werden“. Du kannst dann mit **Erneut versuchen** nochmal laden. Alternativ trägst du unter **Modell-ID** eine ID ein, zum Beispiel `anthropic/claude-sonnet-5.5`, und klickst auf **Übernehmen**.

Sobald ein Key gespeichert ist, verschwindet auf der Startseite der Hinweis „Für die KI-Funktionen brauchst du einen OpenRouter-API-Key.“

## 3. Die drei Einstiege

Die Startseite zeigt drei Kacheln. Jede führt zu einem anderen Einstieg.

### Ich habe keine Idee

Dieser Einstieg hilft dir, eine Projektidee zu finden. Er besteht aus einem kurzen Fragebogen auf einer Seite und den Ideen, die die KI daraus vorschlägt.

**Der Fragebogen.** Alles ist freiwillig.

- **Was interessiert dich?** Tippe Vorschläge an oder schreibe eigene Begriffe. Du trennst sie mit Enter oder Komma.
- **Was nervt dich im Alltag?** Ein Ärgernis ist oft der beste Startpunkt.
- **Was kannst du schon?** Programmieren ist keine Voraussetzung.
- **Was möchtest du dabei lernen?**
- **Wie viel Zeit hast du?** Du wählst zwischen „Ein paar Stunden“ und „Langfristig“. Ein erneuter Klick hebt die Auswahl auf.
- **Wo soll das Projekt laufen?** Zur Auswahl stehen Egal, Web, Smartphone, Desktop und Kommandozeile.

Für den Start reichen Interessen, ein Ärgernis oder ein Lernziel. Die Schaltfläche **Ideen finden** wird aktiv, sobald du davon eines angegeben hast. Ohne Key ist **Ideen finden** nicht verfügbar. Dann erscheint nur **Ohne KI starten**, wie unten beschrieben.

**Die Ideen.** Die KI schlägt vier Ideen vor. Jede Karte zeigt eine Kurzbeschreibung, die Kernfunktionen, den Aufwand (klein, mittel oder groß), die Neuheit und den Lernwert, jeweils auf einer Skala von 1 bis 5. Du kannst:

- **Einfacher** oder **Ehrgeiziger** wählen, um die Idee anzupassen.
- **Mehr wie diese** wählen, um ähnliche Ideen zu bekommen.
- Im Feld **Eigener Wunsch für diese Idee** einen eigenen Wunsch schreiben und **Abwandeln** klicken.
- Mit **Neu würfeln** vier neue Ideen anfordern. Die App vermeidet dabei Wiederholungen.
- Zwei Ideen mit **Zum Kombinieren auswählen** markieren und **Ausgewählte kombinieren** klicken.
- Mit **Antworten ändern** zurück zum Fragebogen gehen.

**Die gewählte Idee.** Ein Klick auf **Diese Idee nehmen** legt sofort ein Projekt an. Der Projektname ist der Titel der Idee. Problem, Zielgruppe, Kernfunktionen und Tech-Stack sind vorausgefüllt. Diese Abschnitte sind als „Von KI, übernommen“ markiert. Danach arbeitest du im normalen Blueprint weiter.

**Ohne Key.** Ohne Key erscheint **Ohne KI starten**. Die App legt dann ein leeres Projekt an. Deine Angaben zu Ärgernissen und Interessen stehen als Text im Abschnitt „Problem & Vision“.

**Der Stand bleibt nur in diesem Tab.** Beim Neuladen der Seite bleibt der Stand erhalten. Schließt du den Tab, ist er weg.

### Ich habe eine Teil-Idee

Hier beschreibst du, was du schon im Kopf hast.

1. Schreibe in das Feld „Beschreib deine Idee“.
2. Gib optional einen Projektnamen ein. Lässt du das Feld leer, schlägt die KI einen Namen vor.
3. Klicke auf **Idee einordnen**. Die KI verteilt deinen Text auf die zehn Abschnitte des Blueprints. Sie schlägt außerdem einen Reifegrad, einen Namen und eine Kurzfassung vor. Das Projekt entsteht erst, wenn die KI geantwortet hat. Während die Anfrage läuft, kannst du mit **Abbrechen** stoppen.

Ohne Key ist **Idee einordnen** nicht verfügbar. Mit **Ohne KI starten** legst du dann sofort ein Projekt an. Dein Text steht als eigener Inhalt im Abschnitt „Problem & Vision“. Lässt du den Namen leer, heißt das Projekt „Neues Projekt“.

Der Text darf höchstens 20.000 Zeichen lang sein. Ein Zähler unter dem Feld zeigt dir, wie viele Zeichen du schon geschrieben hast.

### Ich habe fast alles

Hier fügst du dein fertiges Konzept ein. Die KI prüft es auf Lücken und ordnet es den Abschnitten zu.

1. Füge dein Konzept in das Feld ein. Alternativ klickst du auf **Datei laden** und wählst eine Textdatei. Erlaubt sind Dateien mit der Endung `.txt` oder `.md`.
2. Klicke auf **Idee einordnen** oder auf **Ohne KI starten**. Die beiden Schaltflächen funktionieren wie im Einstieg „Ich habe eine Teil-Idee“.

Auch hier darf der Text höchstens 20.000 Zeichen lang sein.

## 4. Die Blueprint-Übersicht

Ein Projekt öffnest du, indem du in der Projektliste auf seinen Namen klickst. Die Projektseite zeigt alles Wichtige.

- **Vollständigkeit:** Ein Balken zeigt, wie weit der Blueprint ist.
- **Knöpfe:** **Rückgängig**, **Wiederholen**, **Fragen beantworten** (mit der Zahl offener Fragen), **Entscheidungen & Vorschläge** (mit roter Zahl bei Widersprüchen) und **Blueprint fertigstellen**.
- **Speicherstatus:** Er steht rechts neben den Knöpfen.
- **Reifegrade im Überblick:** Die App zählt, wie viele Abschnitte leer, vage oder entschieden sind.

### Die zehn Abschnitte

1. Problem & Vision
2. Zielgruppe & Nutzer
3. Kernfunktionen (MVP)
4. Nicht-Ziele
5. Nutzerabläufe & Screens
6. Datenmodell
7. Tech-Stack & Plattform
8. Integrationen & externe Dienste
9. Risiken & offene Punkte
10. Umsetzungs-Roadmap

### Einen Abschnitt bearbeiten

1. Klicke auf **Bearbeiten**. Es öffnet sich ein Textfeld.
2. Schreibe oder ändere den Text.
3. Klicke auf **Fertig**. Strg+Enter (auf dem Mac Cmd+Enter) übernimmt den Text ebenfalls.
4. Mit **Abbrechen** oder der Taste Esc verwirfst du deine Änderung.

Ein Abschnitt ohne Text bleibt „leer“. Sobald du Text eingibst, aber keinen Reifegrad wählst, setzt die App den Reifegrad auf „vage“.

### Reifegrade

Jeder Abschnitt hat einen Reifegrad:

- **leer:** Der Abschnitt hat noch keinen Inhalt.
- **vage:** Es gibt eine Vorstellung, sie ist aber noch nicht festgelegt.
- **entschieden:** Der Abschnitt ist festgelegt.

Die Reifegrade „vage“ und „entschieden“ kannst du erst setzen, wenn der Abschnitt Inhalt hat. Vorher sind die Auswahlfelder gesperrt.

### KI-Vorschläge übernehmen

Ein Abschnitt mit dem Hinweis **KI-Vorschlag** stammt von der KI. Er gilt noch nicht als bestätigt.

- Klicke auf **Übernehmen**, um den Vorschlag zu bestätigen. Der Abschnitt zeigt dann „Von KI, übernommen“.
- Änderst du den Text selbst, gilt er als dein eigener Inhalt. Die KI überschreibt eigenen Inhalt nie.

Nicht übernommene KI-Inhalte nennt auch der Reife-Check beim Export.

### Rückgängig und Wiederholen

- Du nutzt die Knöpfe **Rückgängig** und **Wiederholen** oder die Tasten Strg+Z, Strg+Umschalt+Z und Strg+Y. Auf dem Mac nimmst du Cmd statt Strg.
- In einem Textfeld gilt das normale Verhalten deines Browsers.
- Die App merkt sich bis zu 50 Schritte pro Besuch der Seite. Wenn du die Seite neu lädst oder verlässt, beginnt der Verlauf neu.

### Automatisches Speichern

- Die App speichert 600 Millisekunden nach deiner letzten Änderung automatisch.
- Die Anzeige wechselt dabei von „Änderungen werden gespeichert …“ zu „Gespeichert“.
- Verlässt du die Seite, wechselst du zu einem anderen Projekt oder schließt du den Tab, versucht die App sofort zu speichern.

**Wenn das Speichern fehlschlägt:**

- Die App zeigt „Speichern fehlgeschlagen“ mit dem Knopf **Erneut versuchen**.
- Deine Änderungen bleiben in diesem Tab erhalten. Sie liegen aber nur im Arbeitsspeicher. Lade die Seite deshalb nicht neu, bevor das Speichern geklappt hat. Klicke stattdessen auf **Erneut versuchen**.
- Bleibt der Fehler bestehen, prüfe den Speicher deines Browsers. Er kann voll sein oder für diese Seite blockiert sein.
- Ein JSON-Export enthält nur den gespeicherten Stand. Ungespeicherte Änderungen fehlen darin. Kopiere wichtige Texte deshalb vorher in eine eigene Datei.

## 5. Fragen beantworten

Die Fragenseite öffnest du mit **Fragen beantworten** auf der Projektseite.

### Analyse

Die KI prüft den Blueprint auf Lücken und Widersprüche und schlägt Fragen vor.

- Gibt es noch keine Analyse und keine offenen Fragen, startet die Analyse beim ersten Öffnen der Seite von selbst.
- Mit **Blueprint analysieren** startest du eine Analyse. Ist schon eine vorhanden, heißt der Knopf **Neu analysieren**. Während die Analyse läuft, kannst du mit **Abbrechen** stoppen.
- Das Ergebnis zeigt eine Zusammenfassung und das Datum der Analyse. Widersprüche stehen in einem roten Bereich. Lücken findest du unter „Lücken (Anzahl)“ zum Aufklappen.
- Das Ergebnis kann veraltet sein, wenn du den Blueprint inzwischen geändert hast. Starte dann eine neue Analyse.

Ohne Key kann die KI nicht analysieren. Dann gibt es keine neuen Fragen.

### Die Fragenrunde

Die Runde zeigt bis zu 8 offene Fragen auf einmal. Du musst nicht alle beantworten.

Jede Frage zeigt:

- den Abschnitt, zu dem sie gehört,
- die Wichtigkeit: „Grundsatzfrage“, „Wichtig“ oder „Detail“,
- eine kurze Begründung, warum die Frage wichtig ist,
- Antwortoptionen zum Antippen, falls es welche gibt,
- ein Textfeld. Ohne Optionen steht dort „Deine Antwort“, mit Optionen „Ergänzung oder eigene Antwort (optional)“.

**So beantwortest du eine Frage:**

- Tippe eine Option an. Ein erneuter Klick auf die gewählte Option hebt die Auswahl auf.
- Oder schreibe deine Antwort in das Textfeld.
- Oder schalte **Später** an der Frage ein. Solche Fragen kommen wieder, sobald nichts anderes mehr offen ist.

Am unteren Rand siehst du den Fortschritt, zum Beispiel „2 von 5 beantwortet, 1 später“. Mit **Antworten übernehmen** oder Strg+Enter (auf dem Mac Cmd+Enter) übernimmst du alle Antworten auf einmal. Der Knopf ist erst aktiv, wenn du mindestens eine Frage beantwortet oder auf **Später** gesetzt hast.

**Was danach passiert:**

- Die KI arbeitet deine Antworten in die passenden Abschnitte ein. Die App zeigt an, welche Abschnitte geändert wurden.
- Mit **Änderungen ansehen** siehst du jeden Abschnitt vorher und nachher.
- Mit **Zurücknehmen** nimmst du die Änderungen wieder zurück. Das geht nur, solange du den betroffenen Abschnitt danach nicht noch einmal geändert hast.
- Stark kürzende Änderungen wartet die App nicht ab. Sie stehen unter „Bitte prüfen“. Dort klickst du bei jedem Abschnitt auf **Übernehmen** oder **Verwerfen**. Verworfen bleibt der Abschnitt unverändert.
- Sind danach keine Fragen mehr offen, startet die App automatisch eine neue Analyse.
- Blockiert eine Frage, weil sie auf eine Antwort zu einem anderen Thema wartet, zeigt die App das an. Die Meldung lautet etwa „2 weitere Fragen warten auf Antworten zu anderen Themen.“

**Wenn die KI die Antworten nicht einarbeiten kann:**

Die App meldet: „Deine Antworten sind gespeichert, konnten aber nicht eingearbeitet werden.“ Du hast drei Möglichkeiten:

- **Erneut versuchen** startet die KI-Anfrage nochmal.
- **Antworten wörtlich anhängen** schreibt deine Antworten ohne KI an die Abschnitte. Jede Antwort steht als Stichpunkt mit ihrer Frage.
- **Schließen** blendet die Meldung aus.

**Ohne Key** hängt die App deine Antworten direkt wörtlich an. Die KI formuliert dann nichts um.

### Verlauf

Unter der Fragenrunde steht **Verlauf (Anzahl)**. Dort siehst du, welche Fragen du beantwortet oder auf später gestellt hast und wann.

## 6. Entscheidungen, Vorschläge und Widersprüche

Die Seite öffnest du mit **Entscheidungen & Vorschläge** auf der Projektseite. Sie hat drei Teile.

### Widersprüche

Die App prüft den Blueprint mit festen Regeln auf Gegensätze. Ein Beispiel: Der Blueprint soll offline-first sein, nennt aber gleichzeitig Echtzeit-Zusammenarbeit. Weitere Regeln prüfen die Themen Konten, Kosten, Web oder App, KI und Tracking. Außerdem zeigt die Seite die Widersprüche aus der letzten KI-Analyse, markiert mit „Aus der letzten Analyse“.

Jeder Hinweis zeigt die Stellen im Blueprint, an denen der Widerspruch steht. Um ihn aufzulösen, bearbeitest du den betroffenen Abschnitt. Die Regeln arbeiten mit Wortmustern. Ein Hinweis kann deshalb auch falsch sein. Dann kannst du ihn ignorieren.

### Wichtigste Entscheidungen

1. Klicke auf **Entscheidungen finden**. Die KI ermittelt die Punkte, die deinen Blueprint am stärksten prägen. Später heißt der Knopf **Neu ermitteln**.
2. Die App zeigt bis zu 7 Kernentscheidungen. Die Reihenfolge legt die App nach Hebel und Reifegrad der Abschnitte fest, nicht die KI.
3. Jede Entscheidung hat 2 bis 4 Optionen mit Vor- und Nachteilen. Dazu kommt die Folge der Wahl und eine Empfehlung. Die Empfehlung ist keine Entscheidung. Sie wird erst zur Entscheidung, wenn du sie bestätigst.
4. Wähle eine Option. Optional schreibst du eine Begründung unter **Begründung (optional)**. Mit **Entscheiden** speicherst du die Entscheidung.
5. Mit **Verwerfen** blendest du eine Entscheidung aus.

**Wichtig:** **Neu ermitteln** ersetzt die offenen Entscheidungen durch neue Vorschläge. Getroffene Entscheidungen bleiben.

Weitere Entscheidungen findest du unter „Weitere Entscheidungen (Anzahl)“ zum Aufklappen.

**Entscheidungsprotokoll:** Darunter stehen alle getroffenen Entscheidungen in der Reihenfolge, in der du sie getroffen hast. Ohne Begründung steht dort „Keine Begründung“. Mit **Wieder öffnen** holst du eine Entscheidung zurück in die offene Liste.

### Vorschläge

Die KI schlägt Vorschläge für die Abschnitte Kernfunktionen, Nicht-Ziele und Risiken vor. Je Abschnitt sind es höchstens 4.

- Klicke auf **Vorschläge holen**, um neue Vorschläge zu bekommen.
- Mit **Annehmen** hängst du einen Vorschlag als Stichpunkt an den Abschnitt an. Vorhandener Text bleibt unverändert.
- Mit **Ablehnen** entfernst du einen Vorschlag aus der Liste.
- Der Zähler zeigt, wie viele Vorschläge du angenommen und abgelehnt hast.

Ohne Key sind **Entscheidungen finden** und **Vorschläge holen** nicht verfügbar.

## 7. Blueprint fertigstellen und exportieren

Ist dein Blueprint bereit, lädst du ihn herunter. Der Export braucht keinen API-Key und läuft komplett in deinem Browser.

### Schritt 1: Reife-Check

Klicke auf der Projektseite auf **Blueprint fertigstellen**. Oben siehst du den Reife-Check mit der Vollständigkeit.

- Ist alles ausgearbeitet, steht dort „Dein Blueprint ist ausgearbeitet.“
- Gibt es noch offene Punkte, steht dort: „Es gibt noch offene Punkte. Du kannst trotzdem exportieren; die Hinweise bleiben im Blueprint erhalten.“

Die Hinweise nennen zum Beispiel leere Abschnitte, Abschnitte ohne Entscheidung, nicht übernommene KI-Inhalte, offene oder zurückgestellte Fragen, offene Entscheidungen, offene Vorschläge und mögliche Widersprüche. Die Hinweise zu den letzten KI-Analysen sind als „Stand prüfen“ markiert. Die Hinweise verhindern den Export nicht. Über **Fragen beantworten** und **Entscheidungen & Vorschläge** kommst du direkt zu den offenen Punkten.

### Schritt 2: Dateien ansehen

Unter **Dateivorschau** wählst du über **Datei auswählen** eine der fünf Dateien. Die Vorschau zeigt den Inhalt nur zum Lesen. Mit **Datei herunterladen** lädst du nur die gewählte Datei herunter.

| Datei             | Inhalt                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BLUEPRINT.md`    | Alle zehn Abschnitte, offene Punkte, das Entscheidungsprotokoll und der Fragenverlauf.                                                            |
| `CLAUDE.md`       | Kontext und Arbeitsregeln für ein KI-Coding-Tool.                                                                                                 |
| `AGENTS.md`       | Derselbe Kontext und dieselben Arbeitsregeln wie `CLAUDE.md`.                                                                                     |
| `TASKS.md`        | Deine Projekt-Roadmap, falls du eine hast, und eine Vorlage mit Phasen, Aufgaben und Abnahmekriterien. Die Vorlage ist als solche gekennzeichnet. |
| `START-PROMPT.md` | Der Text, den du in das KI-Coding-Tool einfügst.                                                                                                  |

### Schritt 3: Herunterladen

- **Alles als ZIP herunterladen** lädt alle fünf Dateien in einer ZIP-Datei herunter. Der Dateiname enthält deinen Projektnamen und endet auf `-blueprint.zip`, zum Beispiel `mein-projekt-blueprint.zip`.
- **Start-Prompt kopieren** kopiert den Text aus `START-PROMPT.md` in die Zwischenablage.

Klappt das Kopieren nicht, erscheint eine Meldung. Markiere dann den Text in der Vorschau und kopiere ihn von Hand.

### So startest du mit einem KI-Coding-Tool

Das KI-Coding-Tool ist nicht Teil dieser App. Du brauchst dafür eigene Zugänge.

1. Entpacke die ZIP-Datei in einen leeren Projektordner. Alle fünf Dateien sollen im selben Ordner liegen.
2. Öffne den Ordner mit deinem KI-Coding-Tool.
3. Füge den Start-Prompt in das Tool ein und schicke ihn ab.

Das Tool liest dann `BLUEPRINT.md`, `CLAUDE.md` oder `AGENTS.md` sowie `TASKS.md`. Der Start-Prompt bittet es, zuerst die Punkte zu klären, die den nächsten Schritt blockieren. Beantworte seine Rückfragen, bevor es mit der Umsetzung beginnt.

## 8. Einstellungen

Die Einstellungen öffnest du oben rechts über **Einstellungen**. Die Einstellungen sind in vier Bereiche gegliedert.

### OpenRouter-API-Key

Hier trägst du deinen Key ein, prüfst ihn mit **Verbindung testen** und löschst ihn mit **Key löschen**. Beim Löschen fragt die App noch einmal nach. Danach sind die KI-Funktionen erst wieder nutzbar, wenn du einen neuen Key eingetragen hast. Deine Projekte bleiben dabei erhalten.

Die Schritte stehen in Abschnitt 2.

### Modell

Hier wählst du das Modell für die KI. Die Schritte stehen in Abschnitt 2.

### Antworten

- **Kreativität (Temperatur):** Der Regler reicht von 0 bis 2. Bei 0 sind die Antworten vorhersehbar, bei 2 sehr kreativ. Der Standardwert ist 0,7.
- **Antwortsprache:** Hier legst du fest, in welcher Sprache die KI antwortet, Deutsch oder English.

### Darstellung

- **Sprache der Oberfläche:** Deutsch oder English. Die Einstellung wirkt auch auf die exportierten Dateien.
- **Farbschema:** Wie das System (Standard), Hell oder Dunkel.

Die Antwortsprache der KI ist eine eigene Einstellung. Sie ändert die Oberfläche nicht.

Modell, Temperatur und Antwortsprache speichert die App sofort. Danach erscheint die Meldung „Gespeichert“. Das Farbschema und die Sprache der Oberfläche wirken ebenfalls sofort.

### KI-Kosten oben rechts

Sobald du die erste KI-Anfrage gestellt hast, erscheint oben rechts ein Betrag mit einem Münz-Symbol. Er zeigt die Kosten aller KI-Anfragen dieser Sitzung.

- Ein Klick auf den Betrag öffnet eine Übersicht. Sie zeigt die letzte Anfrage mit Aufgabe, Tokens, Kosten und Modell. Darunter stehen die Anzahl der Anfragen, die Tokens und die Summe der Kosten.
- Mit **Zurücksetzen** startest du die Zählung neu.
- Die Kosten stammen aus den Angaben von OpenRouter. Meldet OpenRouter für eine Anfrage keine Kosten, steht dort „unbekannt“. Dann zeigt die App ein Zeichen ≥. Die Summe ist dann eine Untergrenze.
- Die Zählung gilt nur für diesen Tab. Schließt du den Tab, ist sie weg.

## 9. Als App installieren und offline nutzen

Der Blueprint-Wizard kann wie eine App auf deinem Gerät installiert werden.

**So installierst du die App:** Suche im Menü deines Browsers nach „App installieren“ oder „Installieren“. Die Bezeichnung hängt vom Browser ab. Die App hat dafür keinen eigenen Knopf. Danach startet sie in einem eigenen Fenster.

**Offline nutzen:** Hast du die App einmal geladen, öffnet sie sich auch ohne Internet. Deine Projekte liegen ohnehin in deinem Browser. KI-Funktionen brauchen dagegen eine Internetverbindung. Dazu gehören die Modellliste und **Verbindung testen**.

**Nach Updates:** Wenn eine neue Version erscheint, übernimmt die App sie automatisch. Erscheint die Meldung „Diese Seite konnte nicht geladen werden“, hilft der Knopf **Neu laden**. Die Meldung nennt zwei mögliche Gründe: Du bist gerade offline, oder die App wurde aktualisiert.

## 10. Projekte sichern, exportieren und importieren

Die Projektliste auf der Startseite zeigt alle deine Projekte. Zu jedem Projekt gibt es vier Knöpfe:

- **Umbenennen:** Gibt dem Projekt einen neuen Namen. Der Name darf höchstens 120 Zeichen lang sein.
- **Duplizieren:** Legt eine Kopie des Projekts im selben Browser an.
- **Exportieren:** Lädt das Projekt als Datei mit der Endung `.blueprint.json` herunter, zum Beispiel `mein-projekt.blueprint.json`. Die Datei enthält den vollständigen Stand des Projekts: Abschnitte, Fragen, Entscheidungen, Vorschläge und Verlauf.
- **Löschen:** Entfernt das Projekt endgültig. Die App fragt vorher nach. Das lässt sich nicht rückgängig machen.

Oben auf der Startseite steht der Knopf **Projekt importieren**. Er öffnet die Auswahl für eine `.json`-Datei. Der Import legt ein neues Projekt an und vergibt eine neue ID. Importierst du dieselbe Datei zweimal, entstehen also zwei Projekte. Ältere Projektdateien passt die App automatisch an.

Die App meldet einen Fehler, wenn die Datei kein gültiges JSON ist, keine Projektdatei des Blueprint-Wizards ist oder aus einer neueren Version stammt. In diesem Fall aktualisierst du die App und versuchst den Import erneut.

**Sicherung:** Es gibt keine Sicherung aller Projekte auf einmal. Exportiere wichtige Projekte deshalb regelmäßig als `.blueprint.json`-Datei. Das ZIP aus dem Export (Abschnitt 7) ist keine Sicherung. Es ist für den Start mit einem KI-Coding-Tool gedacht.

## 11. Häufige Probleme

Die Tabelle zeigt die häufigsten Meldungen der App. Die Texte stehen genau so in der App.

| Meldung oder Problem                                                                             | Was dahintersteckt                                                                                                                                                                                            | Was du tun kannst                                                                                                                                         |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „Es ist noch kein API-Key hinterlegt. Trage ihn in den Einstellungen ein.“                       | Du hast noch keinen Key gespeichert, oder du hast ihn gelöscht.                                                                                                                                               | Trage deinen Key unter **Einstellungen** ein und klicke auf **Speichern**.                                                                                |
| „Der API-Key ist ungültig oder wurde widerrufen.“                                                | Der Key stimmt nicht oder ist bei OpenRouter nicht mehr gültig.                                                                                                                                               | Erstelle bei OpenRouter einen neuen Key und trage ihn ein.                                                                                                |
| „Dein OpenRouter-Guthaben reicht nicht aus. Lade es auf und versuch es dann erneut.“             | Das Konto hat kein oder zu wenig Guthaben.                                                                                                                                                                    | Lade dein Guthaben bei OpenRouter auf. Mit **Verbindung testen** siehst du das verbleibende Limit.                                                        |
| „Dein API-Key darf dieses Modell nicht verwenden.“                                               | Dein Konto darf das gewählte Modell nicht nutzen.                                                                                                                                                             | Wähle unter **Modell** ein anderes Modell.                                                                                                                |
| „Das gewählte Modell ist gerade nicht verfügbar. Wähle in den Einstellungen ein anderes Modell.“ | Der Anbieter hat das Modell gerade nicht verfügbar.                                                                                                                                                           | Wähle ein anderes Modell oder versuche es später erneut.                                                                                                  |
| „Es wurden gerade zu viele Anfragen gesendet. Warte einen Moment und versuch es erneut.“         | Die Anfragen sind für den Moment begrenzt.                                                                                                                                                                    | Warte kurz und klicke dann erneut.                                                                                                                        |
| „Die KI hat zu lange gebraucht. Versuch es noch einmal.“                                         | Die Anfrage hat zu lange gedauert.                                                                                                                                                                            | Versuche es erneut.                                                                                                                                       |
| „Keine Verbindung zu OpenRouter. Prüfe deine Internetverbindung.“                                | Die App erreicht OpenRouter nicht.                                                                                                                                                                            | Prüfe deine Internetverbindung und versuche es erneut.                                                                                                    |
| „Die Antwort der KI hatte ein unerwartetes Format.“                                              | Die KI hat eine Antwort geliefert, die die App nicht verarbeiten kann.                                                                                                                                        | Klicke auf **Erneut versuchen**. Hilft das nicht, wähle ein anderes Modell.                                                                               |
| Die Modellliste lädt nicht.                                                                      | Die App kann die Liste bei OpenRouter nicht abrufen.                                                                                                                                                          | Klicke auf **Erneut versuchen** oder trage die Modell-ID unter **Modell-ID** ein.                                                                         |
| Antworten stehen nur als Stichpunkte im Abschnitt.                                               | Es gibt keinen Key, oder die KI konnte die Antworten nicht einarbeiten.                                                                                                                                       | Trage einen Key ein. Hat die KI einen Fehler gemeldet, klicke im Fehlerbereich auf **Erneut versuchen**.                                                  |
| „Speichern fehlgeschlagen“                                                                       | Der Browser konnte die Änderung nicht speichern.                                                                                                                                                              | Lade die Seite nicht neu. Klicke auf **Erneut versuchen** und prüfe den Speicher deines Browsers.                                                         |
| Die Kosten sind höher als erwartet.                                                              | Jede Anfrage kostet Geld. Auch **Neu würfeln**, **Neu analysieren** und **Neu ermitteln** sind neue Anfragen.                                                                                                 | Prüfe die Kosten oben rechts. Wähle unter **Modell** ein Modell mit niedrigeren Preisen. Die Preise stehen in der Liste.                                  |
| Oben rechts steht ein Betrag mit ≥.                                                              | Für manche Anfragen hat OpenRouter keine Kosten gemeldet. Der Betrag ist deshalb eine Untergrenze.                                                                                                            | Das ist kein Fehler. Die tatsächlichen Kosten können höher liegen.                                                                                        |
| Projekte sind verschwunden.                                                                      | Die Browserdaten wurden gelöscht. Oder du öffnest die App unter einer anderen Adresse, in einem anderen Browser oder auf einem anderen Gerät. Ein privates Fenster speichert unter Umständen nicht dauerhaft. | Öffne die App unter der Adresse, unter der du gearbeitet hast. Hast du Projekte exportiert, importiere sie. Exportiere deine Projekte künftig regelmäßig. |
| „Projekt nicht gefunden“                                                                         | Das Projekt wurde gelöscht oder liegt in einem anderen Browser.                                                                                                                                               | Prüfe die Projektliste. Hast du eine Datei exportiert, importiere sie.                                                                                    |
| Der Stand der Ideenfindung ist weg.                                                              | Der Stand bleibt nur in dem Tab, in dem du arbeitest. Nach dem Schließen des Tabs ist er weg.                                                                                                                 | Arbeite in einem Tab. Sobald du eine Idee gewählt hast, ist sie als Projekt gespeichert.                                                                  |
| Die Seite zeigt „Diese Seite konnte nicht geladen werden“.                                       | Die Seite konnte nicht geladen werden, oft wegen einer fehlenden Verbindung oder nach einem Update.                                                                                                           | Klicke auf **Neu laden**.                                                                                                                                 |
| Ein Widerspruchshinweis passt nicht.                                                             | Die Regeln arbeiten mit Wortmustern und können falsch liegen.                                                                                                                                                 | Prüfe die genannten Stellen. Ist der Hinweis falsch, kannst du ihn ignorieren.                                                                            |
| „Die Anfrage wurde abgebrochen.“                                                                 | Du hast die Anfrage mit **Abbrechen** gestoppt.                                                                                                                                                               | Starte die Anfrage erneut, wenn du sie noch brauchst.                                                                                                     |

Unter vielen Fehlermeldungen steht ein Abschnitt „Technische Details“. Darin steht die Originalmeldung von OpenRouter. Sie hilft beim Suchen nach der Ursache.
