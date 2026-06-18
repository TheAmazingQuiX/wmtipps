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
- Ergebnisse und neu feststehende K.o.-Paarungen werden automatisch von football-data.org
  übernommen (alle 6 Stunden per GitHub Action, zusätzlich jederzeit per Knopfdruck)

## Projektstruktur

```
index.html                      -> Haupt-App (das, was die Nutzer aufrufen)
admin.html                       -> Ergebnisse eintragen, Platzhalter-Teams pflegen, Sync auslösen
app.js                           -> die komplette App-Logik (React)
styles.css                       -> Design
config.js                        -> hier kommen deine Supabase-Zugangsdaten hin
sql/01_schema.sql                 -> Datenbank-Grundstruktur für Supabase
sql/02_seed_matches.sql           -> alle 104 WM-Spiele zum Einmal-Importieren
sql/03_autosync_migration.sql     -> Zusatz-Tabellen/Felder für den automatischen Sync
supabase/functions/sync-results/  -> Edge Function, die Ergebnisse von football-data.org holt
.github/workflows/sync-results.yml -> GitHub Action, die den Sync alle 6 Stunden anstößt
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

## Schritt 5: Automatischen Ergebnis-Sync einrichten

Damit Ergebnisse und die Paarungen ab dem Sechzehntelfinale **automatisch** aktualisiert
werden (alle 6 Stunden + auf Knopfdruck), brauchst du zusätzlich:

### 5.1 Kostenlosen API-Key holen

1. Gehe auf [football-data.org](https://www.football-data.org/client/register) und
   registriere dich kostenlos (E-Mail reicht, kein Kreditkartendaten nötig).
2. Du bekommst per E-Mail einen API-Key (Token). Der kostenlose Tarif deckt die
   FIFA World Cup vollständig und dauerhaft kostenlos ab.

### 5.2 Migrations-SQL ausführen

Führe `sql/03_autosync_migration.sql` im Supabase SQL Editor aus (nach den ersten
beiden SQL-Dateien). Auch hier: ersetze `BITTE-AENDERN` durch dein Admin-Passwort,
bevor du es ausführst.

### 5.3 Edge Function deployen

Du brauchst dafür einmalig die Supabase CLI (lokal auf deinem Rechner, nicht im Browser):

```bash
npm install -g supabase
supabase login
supabase link --project-ref DEIN-PROJEKT-REF   # findest du in der Projekt-URL
supabase functions deploy sync-results
```

Die Function liegt im Ordner `supabase/functions/sync-results/index.ts` in diesem Projekt.

### 5.4 Secrets für die Edge Function setzen

```bash
supabase secrets set FOOTBALL_DATA_API_KEY=dein-api-key-von-football-data-org
supabase secrets set SYNC_TRIGGER_SECRET=ein-selbst-gewaehltes-geheimwort
```

Das `SYNC_TRIGGER_SECRET` ist ein einfaches Passwort deiner Wahl – es verhindert, dass
fremde Personen deine Sync-Function aufrufen und dabei dein API-Kontingent verbrauchen.

### 5.5 GitHub Action für den 6-Stunden-Takt einrichten

Im Repository unter **Settings → Secrets and variables → Actions → New repository secret**
folgende drei Secrets anlegen:

| Name | Wert |
|------|------|
| `SUPABASE_FUNCTION_URL` | `https://DEIN-PROJEKT.supabase.co/functions/v1/sync-results` |
| `SUPABASE_ANON_KEY` | dein anon Key (derselbe wie in `config.js`) |
| `SYNC_TRIGGER_SECRET` | dasselbe Geheimwort wie in Schritt 5.4 |

Der Workflow `.github/workflows/sync-results.yml` ist bereits im Projekt enthalten und
läuft ab dann automatisch alle 6 Stunden. Du kannst ihn zusätzlich jederzeit manuell
über den Reiter **Actions → WM 2026 Ergebnisse synchronisieren → Run workflow** anstoßen.

### 5.6 Sofort-Sync über die Admin-Seite

Auf `admin.html` gibt es den Abschnitt "Automatischer Ergebnis-Sync". Trage dort einmalig
ein:
- die Function-URL (wie in der Tabelle oben)
- das `SYNC_TRIGGER_SECRET`

und klicke auf **Jetzt aktualisieren**, um sofort einen Sync-Lauf auszulösen (z. B. direkt
nach Abpfiff eines Spiels, ohne auf den nächsten 6-Stunden-Takt zu warten).

### Wie der Sync genau funktioniert

- In der **Gruppenphase** werden Ergebnisse über die festen Teamnamen zugeordnet.
- Ab dem **Sechzehntelfinale** werden die noch offenen Platzhalter ("Erster A" etc.)
  automatisch durch die echten, von football-data.org gemeldeten Teams ersetzt, sobald
  diese feststehen – inklusive der passenden Flagge.
- Jeder Lauf wird in der Tabelle `sync_log` protokolliert (sichtbar unten auf `admin.html`).
- Die football-data.org-Statuswerte werden auf unser `status`-Feld abgebildet
  (`SCHEDULED`, `LIVE`, `FINISHED`, `POSTPONED`, `CANCELLED`); laufende Spiele zeigen in
  der App ein pulsierendes "LIVE"-Label.

## Ergebnisse manuell eintragen (Fallback)

Mit eingerichtetem Auto-Sync (Schritt 5) passiert das oben Beschriebene automatisch.
Der manuelle Weg über `admin.html` bleibt zusätzlich als Fallback verfügbar – z. B.
falls football-data.org für ein einzelnes Spiel kein Ergebnis liefert oder du sofort,
ganz ohne auf den Sync zu warten, etwas korrigieren willst:

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
