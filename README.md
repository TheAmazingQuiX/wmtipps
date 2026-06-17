# WM 2026 Tippspiel

Eine kleine Web-App zum Tippen der Spiele der Fußball-Weltmeisterschaft 2026.
Kein Build-Schritt nötig (reines HTML/CSS/JS), Datenhaltung über Supabase,
Hosting über GitHub Pages.

## Funktionen

- Anmeldung mit Name + selbst gewählter PIN (kein E-Mail-Verfahren, ganz bewusst einfach gehalten)
- Vorrunde: nur die 3 Spiele der deutschen Nationalmannschaft
- Ab Sechzehntelfinale: alle Spiele aller Mannschaften
- Tipps sind bis zum Anstoß editierbar, danach automatisch gesperrt
- Klick auf ein Spiel zeigt die Tipps aller anderen Teilnehmenden
- Zweiter Tab: Rangliste mit 3 Punkten für exaktes Ergebnis, 1 Punkt für richtigen Sieger/Unentschieden
- Rangliste aktualisiert sich automatisch alle 5 Minuten

## Projektstruktur

```
index.html        -> Haupt-App (das, was die Nutzer aufrufen)
admin.html         -> kleines Werkzeug, um Ergebnisse einzutragen
app.js             -> die komplette App-Logik (React)
styles.css         -> Design
config.js          -> hier kommen deine Supabase-Zugangsdaten hin
sql/01_schema.sql   -> Datenbank-Struktur für Supabase
sql/02_seed_matches.sql -> alle 104 WM-Spiele zum Einmal-Importieren
```

## Schritt 1: Supabase einrichten

1. Öffne dein Supabase-Projekt (oder lege eines an auf supabase.com).
2. Gehe links auf **SQL Editor** → **New query**.
3. Öffne die Datei `sql/01_schema.sql` aus diesem Projekt, kopiere den
   gesamten Inhalt und führe ihn im SQL Editor aus (Button "Run").
   Das legt alle Tabellen, Sicherheitsregeln und Funktionen an.
4. **Wichtig:** Suche in `01_schema.sql` nach `BITTE-AENDERN` (kommt zwei Mal vor)
   und ersetze es durch ein eigenes geheimes Admin-Passwort, **bevor** du das Skript
   ausführst. Dieses Passwort brauchst du später in `admin.html`, um Ergebnisse einzutragen.
5. Öffne eine neue Query, kopiere den Inhalt von `sql/02_seed_matches.sql` und führe
   ihn aus. Das befüllt die Tabelle `matches` mit allen 104 WM-Spielen.
6. Gehe zu **Project Settings → API**. Dort findest du:
   - **Project URL** (sieht aus wie `https://xxxxx.supabase.co`)
   - **anon public** Key (ein langer Text)

## Schritt 2: App konfigurieren

Öffne `config.js` und trage die beiden Werte aus Schritt 1.6 ein:

```js
window.SUPABASE_CONFIG = {
  url: "https://xxxxx.supabase.co",
  anonKey: "dein-anon-key",
};
```

Speichern – fertig. Mehr Konfiguration ist nicht nötig.

## Schritt 3: Lokal testen (optional)

Da die App ohne Build-Schritt läuft, reicht ein einfacher lokaler Webserver, z. B.:

```bash
npx serve .
# oder
python3 -m http.server 8080
```

Dann im Browser `http://localhost:8080` öffnen.

> Hinweis: Die App muss über `http://` oder `https://` aufgerufen werden (nicht per
> Doppelklick als `file://`), da der Browser sonst die Skripte blockiert.

## Schritt 4: Auf GitHub Pages veröffentlichen

1. Lege ein neues GitHub-Repository an (oder nutze ein bestehendes).
2. Lade **alle Dateien dieses Projekts** in das Repository hoch (z. B. per
   `git add . && git commit -m "WM Tippspiel" && git push`, oder über die
   GitHub-Weboberfläche "Add file → Upload files").
3. Gehe im Repository auf **Settings → Pages**.
4. Unter "Build and deployment" → "Source" wähle **Deploy from a branch**.
5. Branch: `main` (oder wie dein Branch heißt), Ordner: `/ (root)`. Speichern.
6. Nach ein bis zwei Minuten ist die Seite unter der angezeigten URL erreichbar
   (z. B. `https://dein-name.github.io/dein-repo/`).

## Ergebnisse eintragen (admin.html)

Sobald ein Spiel beendet ist, trägst du das Ergebnis über `admin.html` ein
(einfach die Seite über die GitHub-Pages-URL + `/admin.html` aufrufen, z. B.
`https://dein-name.github.io/dein-repo/admin.html`):

1. Supabase-URL, anon Key und dein Admin-Passwort eintragen, "Verbinden" klicken.
2. Spiel aus der Liste auswählen, Ergebnis eintragen, speichern.

Über denselben Bildschirm kannst du auch die Platzhalter-Teams der K.o.-Runde
(z. B. "Zweiter A") durch die echten Mannschaftsnamen ersetzen, sobald nach der
Vorrunde feststeht, wer sich qualifiziert hat.

`admin.html` ist nicht weiter abgesichert (außer durch das Admin-Passwort) –
verlinke sie nicht öffentlich, sondern rufe sie nur selbst auf.

## Wichtige Hinweise zu den Spieldaten

- Alle Termine wurden mit Stand 17.06.2026 recherchiert und sind in
  Mitteleuropäischer Sommerzeit (MESZ) hinterlegt.
- Die Spiele der Gruppenphase stehen bereits vollständig mit echten Mannschaften
  fest (72 Spiele, davon 3 mit Deutschland in Gruppe E gegen Curaçao, Elfenbeinküste
  und Ecuador).
- Die K.o.-Runde ab dem Sechzehntelfinale ist mit Platzhaltern wie "Erster A"
  oder "Zweiter B" hinterlegt, da die genauen Teams erst nach Abschluss der
  Vorrunde feststehen. Du kannst diese über `admin.html` nachpflegen, sobald
  klar ist, welches Team sich qualifiziert hat.
- Bei Bedarf kannst du Termine, Orte oder Mannschaften direkt in der Supabase-Tabelle
  `matches` (Tab "Table Editor") anpassen, falls sich offizielle Ansetzungen ändern.

## Punkteregel

| Tipp-Ergebnis        | Punkte |
|-----------------------|--------|
| Exaktes Ergebnis      | 3      |
| Richtiger Sieger / richtig getipptes Unentschieden | 1 |
| Falsche Tendenz       | 0      |

## Sicherheits-Hinweis zur Anmeldung

Die Anmeldung per Name + PIN ist bewusst einfach gehalten (kein E-Mail-Versand,
keine Passwort-Wiederherstellung). Die PIN wird in der Datenbank nur als Hash
gespeichert. Da es sich um ein privates Tippspiel im Freundes-/Familienkreis
handelt, ist das ausreichend – für sicherheitskritische Anwendungen wäre ein
vollwertiges Auth-System (z. B. Supabase Auth) die bessere Wahl.
