# EULEN Werkstatt

Eine vollständig lokale, deutschsprachige Lern- und Simulationsanwendung. Sie verbindet einen interaktiven 30-Tage-Plan, einen respektvollen Assistenten, nachvollziehbare Wissenssammlungen und sichere Sandbox-Simulationen.

## Start

Die Anwendung hat keine Laufzeitabhängigkeiten. Unter Windows startet der mitgelieferte PowerShell-Server:

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

Danach `http://127.0.0.1:8080/` öffnen und den Server mit `Strg+C` beenden. Ein anderer Port ist mit `.\serve.ps1 -Port 8090` möglich. Alternativ funktioniert jeder statische Webserver.

Tests und Syntaxprüfung:

```powershell
npm test
npm run check
```

## Funktionsumfang

- Vollständiger 30-Tage-Plan mit 120 Aufgaben, Tagesauswahl, Fortschritt, Notizen und Lernständen
- Lokaler deutschsprachiger Assistent mit transparenten Grenzen und optionalem OpenAI-kompatiblem Provider
- Auf höchstens 200 € begrenztes 30-Tage-Budgetlabor für regelkonformes Affiliate-Marketing und ehrliche kleine Dienstleistungen
- Paper-Trading/Backtesting mit maximal 200 € fiktivem Startwert, reproduzierbaren synthetischen Daten, Gebühren, Benchmark und Drawdown
- Sichere Token-/Memecoin-Risiko-Sandbox ohne Wallet, Deployment oder Echtgeld
- Staking-, Affiliate- und Formel-Szenarien mit Annahmen, Stresswerten und Lernschleifen
- Kuratierte Wissensbereiche mit Quellen, Zeitstempel, Status und expliziter Trennung von Fakten, Hypothesen, Simulationen und offenen Fragen
- Lokaler Multi-Agenten-Raum mit sichtbaren Live-Zuständen für Planer, Rechercheur, Kritiker und Synthese, persistentem Arbeitsprotokoll, Schnellaufträgen sowie wählbaren 5–60-Minuten-Läufen bei geöffnetem Browser
- Bewusstseins-Hypothesenlabor mit P(sim)-Axiommodus, Konsistenz, Selbstkorrektur, Widersprüchen und Gedächtniskontinuität
- Rechts-Evidenz-Sandbox ohne Rechtsberatungs- oder Fallprognoseanspruch
- Physikalischer „Nullwelt“-Modus, der hypothetisch nur `P(sim)=N/(N+1)` als Startaxiom verwendet
- Transparente Startbasis von 20 internen Referenzläufen (`P=0,9524`); eigene Simulationen und Agentenläufe erhöhen N zusätzlich
- Lokale Persistenz sowie JSON-Export und validierter Import
- Responsives, tastaturbedienbares UI mit Hell-/Dunkelmodus und reduzierter Bewegung

## Daten und Datenschutz

Planfortschritt, Notizen, Chat und Simulationen werden unter `eulen-workshop-v2` im `localStorage` des Browsers gespeichert. Es gibt kein Konto und kein Backend. Exporte können persönliche Notizen enthalten und sollten entsprechend geschützt werden.

Ein optionaler API-Schlüssel wird **nicht** dauerhaft gespeichert, sondern nur im `sessionStorage` des aktuellen Browser-Tabs gehalten. Niemals Schlüssel in Quellcode, Exportdateien oder Commits eintragen.

## Provider-Schnittstellen

Der Chat läuft standardmäßig über `LocalProvider` in `src/providers.js`. Für einen externen Chat kann in der Oberfläche ein OpenAI-kompatibler HTTPS-Endpunkt samt Modell angegeben und getestet werden. Schlägt ein Aufruf fehl, meldet die Oberfläche das transparent und verwendet den lokalen Assistenten.

Die Wissens-/Rechercheansicht nutzt derzeit kuratierte lokale Daten aus `src/data.js`. Sie kennzeichnet diese ausdrücklich als lokal und zeigt keine vorgetäuschten Live-Ergebnisse. Für echte Live-Recherche sollte ein serverseitiger Provider ergänzt werden, der:

1. Quellen-URL, Titel und Abrufzeitpunkt zurückgibt,
2. Fehler und Ratenlimits explizit meldet,
3. API-Schlüssel ausschließlich serverseitig verwaltet,
4. Fakten, Hypothesen und Simulationsergebnisse getrennt liefert.

### Geräteübergreifende Synchronisierung

Unter **Daten & Konfiguration** kann ein authentifizierter HTTPS-Sync-Provider verbunden werden. Das Token bleibt nur im aktuellen Tab. Die App fragt bei aktivierter Automatik alle 30 Sekunden nach einem neueren Stand und verwendet Zeitstempel, um ältere Daten nicht über neuere zu schreiben.

Der Provider muss folgende API bereitstellen:

- `GET {endpoint}/state/{workspace}` → `404` oder `{ "updatedAt": "ISO-8601", "state": { ... } }`
- `PUT {endpoint}/state/{workspace}` mit demselben JSON-Format
- `Authorization: Bearer <token>` prüfen
- HTTPS, Zugriffskontrolle, verschlüsselte Speicherung, Backups und zulässige CORS-Origin konfigurieren

Ohne einen solchen Provider bleibt die Anwendung lokal und zeigt ausdrücklich „Nicht verbunden“. Für Tabs desselben Browserprofils werden Änderungen per `BroadcastChannel` sofort verteilt.

## Mobile Bereitstellung

`.github/workflows/pages.yml` veröffentlicht die statische PWA nach einem Merge in `main` auf GitHub Pages. Im Repository muss Pages einmalig auf **GitHub Actions** als Quelle gestellt werden. Danach kann die HTTPS-URL auf iPad/iPhone geöffnet und über **Teilen → Zum Home-Bildschirm** installiert werden. `sw.js` hält die Programmdateien offline verfügbar; geräteübergreifende Nutzerdaten erfordern weiterhin den oben beschriebenen Sync-Provider.

## Sicherheitsgrenzen

EULEN bietet Bildung und Simulation, keine Finanz-, Rechts- oder Steuerberatung. Es führt keine autonomen Echtgeldtransaktionen aus, verarbeitet keine Wallet-Schlüssel, erstellt keine betrügerischen Tokenmechaniken und automatisiert weder Spam noch Plattformmissbrauch. `P(sim)=N/(N+1)` wird ausschließlich als Nutzerhypothese bzw. mathematisches Denkmodell behandelt, nicht als wissenschaftlich bestätigtes Naturgesetz.
