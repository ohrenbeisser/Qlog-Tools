# Qlog-Tools

**QSL-Karten- und Logbuch-Verwaltung für [Qlog](https://github.com/foldynl/QLog)**

Qlog-Tools ist eine Desktop-Applikation für Funkamateure, die ihr Logbuch mit Qlog führen. Sie ermöglicht das Eintragen empfangener QSL-Karten, den Export von QSL-Karten als ADIF-Datei für den Bureau-Versand sowie Statistiken und Sonderrufzeichen-Auswertung — direkt aus der Qlog-Datenbank, ohne Qlog selbst öffnen zu müssen.

---

## Funktionen

### QSL Empfangen
- Rufzeichen eingeben → alle QSOs werden aufgelistet
- Pro QSO einzeln oder per "Alle"-Button auswählen:
  - **Empfangen** — setzt `qsl_rcvd = Y` + Eingangsdatum
  - **Angefordert** — setzt `qsl_sent = R` + `qsl_sent_via = B` (TNX QSO, Karte wird angefordert)
- Bereits bestätigte QSOs werden abgedimmt und gesperrt

### QSL Bureau-Export
- Filtert QSOs mit `qsl_sent = Q` und `qsl_sent_via = B` (Bureau-Warteschlange)
- Filter nach Datum, Band, Mode, Land und eigenem Rufzeichen (wichtig bei mehreren Rufzeichen)
- Meistgenutztes eigenes Rufzeichen wird automatisch vorausgewählt
- Einzelne QSOs können vom Export ausgeschlossen werden
- ADIF-Download direkt im Browser (kein Server-Upload)
- Zwei Feldumfänge wählbar:
  - **Minimal** — CALL, QSO_DATE, TIME_ON, BAND, MODE, RST_SENT, QSL_RCVD, QSL_SENT, QSL_SENT_VIA, STATION_CALLSIGN
  - **Erweitert** — zusätzlich FREQ, RST_RCVD, COMMENT, NOTES, TX_PWR, MY_RIG, MY_ANTENNA (konfigurierbar)
- Optional: QSOs nach Export automatisch als gesendet markieren (`qsl_sent = Y`)
- `QSL_RCVD = Y` → "TNX" auf der Karte · `QSL_RCVD = N` → "PSE" (kompatibel mit [qslshop.de](https://qslshop.de))

### Statistik
- 8 Auswertungstypen: Länder · Bänder · Modes · Jahre · Monate · Wochentage · Stunden · Rufzeichen
- Summary-Kacheln: QSOs gesamt, Länder, Bänder, Betriebsarten
- Filterbar nach Zeitraum, Band, Mode
- Rang-Tabelle mit Inline-Balken + Chart.js-Diagramm (horizontal oder vertikal je nach Datenmenge)

### Rufzeichen-Suche
- Teilstring- oder Anfangs-Suche über alle Rufzeichen im Log
- Filter nach Band und Mode
- Pagination: 500 Zeilen pro Seite, weitere nachladen
- QSL-Status als farbige Badges

### Sonderrufzeichen
- Zeigt alle QSOs mit Sonderrufzeichen aus dem Log
- Erkennungslogik: Suffix > 3 Buchstaben (z.B. DA0IARU) oder mehrere Ziffern im Distrikt (z.B. DL75DARC, DL2025W)
- Filterbar nach Zeitraum, Band, Mode

### Weitere Features
- **Dashboard** — zeigt die letzten 20 QSOs auf einen Blick
- **Einstellungen** — Export-Feldauswahl im Browser (LocalStorage), Server-Konfiguration im Tkinter-Fenster
- **SUBMODE-Unterstützung** — wenn Qlog eine Unterbetriebsart speichert (z. B. FT8 unter MFSK), wird diese im ADIF-Export als MODE ausgegeben
- **LAN-Zugriff** — optionaler Zugriff vom Smartphone oder Tablet im Heimnetz
- **Dark Mode** — Material Design 3, vollständig responsiv
- **PWA** — läuft im Browser, installierbar, funktioniert offline (Service Worker)

---

## Voraussetzungen

- Linux (x86_64, getestet auf Ubuntu/Debian)
- [Qlog](https://github.com/foldynl/QLog) mit einer vorhandenen `qlog.db`
- Python 3.10 oder neuer

---

## Installation

### Option A — Debian-Paket (empfohlen)

```bash
# Paket herunterladen (aus GitHub Releases)
wget https://github.com/ohrenbeisser/Qlog-Tools/releases/latest/download/qlog-tools_0.4.3_amd64.deb

# Installieren
sudo dpkg -i qlog-tools_0.4.3_amd64.deb

# Abhängigkeiten nachziehen falls nötig
sudo apt install -f
```

Die App erscheint danach im Anwendungsmenü unter **Qlog-Tools**.

```bash
# Starten
qlog-tools

# Deinstallieren
sudo apt remove qlog-tools
```

### Option B — Direkt aus dem Quellcode

```bash
git clone https://github.com/ohrenbeisser/Qlog-Tools.git
cd Qlog-Tools
pip3 install -r requirements.txt
python3 main.py
```

---

## Erster Start

1. App starten — das Tkinter-Fenster öffnet sich
2. Im Reiter **Einstellungen** den Pfad zur `qlog.db` eintragen:
   - Linux: `~/.local/share/hamradio/QLog/qlog.db`
3. **Speichern** klicken
4. Browser öffnet sich automatisch auf `http://127.0.0.1:8765`

---

## Bedienung

### Hauptfenster (Tkinter)

| Reiter | Funktion |
|--------|----------|
| Server-Log | Zeigt alle API-Anfragen in Echtzeit |
| Einstellungen | DB-Pfad, Port, Netzwerk-Binding, Log-Einträge |

### Browser-Oberfläche (`http://127.0.0.1:8765`)

| Panel | Funktion |
|-------|----------|
| Start | Letzte 20 QSOs auf einen Blick |
| QSL → Empfangen | QSL-Karten eintragen (Empfangen / Anfordern) |
| QSL → Export | Bureau-Export als ADIF-Datei |
| Statistik | QSO-Auswertungen nach 8 Typen mit Diagramm |
| Rufzeichen | Rufzeichen-Suche mit Pagination |
| Sonderrufzeichen | QSOs mit Sonder- und Gedenkrufzeichen |
| Einstellungen | Export-Felder konfigurieren |
| Über | Version, Autor, Links |

---

## Konfiguration

### Server-Einstellungen (`config.ini`)

| Einstellung | Standard | Beschreibung |
|-------------|----------|--------------|
| `db_path` | `~/.local/share/hamradio/QLog/qlog.db` | Pfad zur Qlog-Datenbank |
| `port` | `8765` | HTTP-Port des lokalen Servers |
| `bind_all` | `false` | `true` = LAN-Zugriff (0.0.0.0) — Neustart nötig |
| `auto_open_browser` | `true` | Browser beim Start automatisch öffnen |
| `max_log_entries` | `200` | Maximale Anzahl Zeilen im Server-Log |

### Browser-Einstellungen (LocalStorage)

| Schlüssel | Beschreibung |
|-----------|--------------|
| `qlog_export_extended_fields` | Aktive Felder beim "Erweitert"-Export |
| `qlog_export_scope` | Letzter gewählter Export-Modus (minimal/erweitert) |
| `qlog_export_mark_sent` | Als gesendet markieren nach Export (true/false) |

---

## Technischer Aufbau

```
main.py
  ├── FastAPI + uvicorn (Daemon-Thread)  → Port 8765
  │     ├── /api/...     REST-Endpunkte
  │     └── /            Statische PWA-Dateien (web/)
  └── Tkinter (Hauptthread)
        ├── Server-Log (polling log_queue alle 200 ms)
        └── Einstellungen (config.ini)
```

- **Backend:** Python, FastAPI, uvicorn, SQLite (WAL-Modus, read/write)
- **Frontend:** Vanilla JS (ES-Module), Material Design 3 (MDesign), PWA mit Service Worker
- **Schriften:** Roboto + Material Symbols — lokal eingebettet, kein CDN
- **Datenbank:** Qlog-eigene SQLite-Datenbank

---

## Entwicklung

```bash
git clone https://github.com/ohrenbeisser/Qlog-Tools.git
cd Qlog-Tools
pip3 install -r requirements.txt
python3 main.py
```

### DEB-Paket neu bauen

```bash
./packaging/build_deb.sh
# Ausgabe: packaging/qlog-tools_<version>_amd64.deb
```

### Versionsschema

| Stelle | Bedeutung | Wann hochzählen |
|--------|-----------|-----------------|
| Major `1.x.x` | Breaking Changes | Manuell |
| Minor `x.1.x` | Neue Features | Bei jedem Feature, Patch → 0 |
| Patch `x.x.1` | Bugfixes / Commits | Bei jedem Commit |

Version wird an drei Stellen gesetzt: `web/index.html`, `packaging/build_deb.sh`, `packaging/debian/DEBIAN/control`.
Außerdem `CACHE_NAME` in `web/sw.js` erhöhen um den Browser-Cache zu invalidieren.

---

## Lizenz

MIT License — Copyright (c) 2026 Chris Seifert, DL6LG

Dieses Projekt wird unter der [MIT-Lizenz](LICENSE) veröffentlicht. Die Software wird ohne jegliche Gewähr bereitgestellt — weder ausdrücklich noch stillschweigend. Die Nutzung erfolgt auf eigene Gefahr. Der Autor übernimmt keine Haftung für Schäden, die durch die Verwendung entstehen.

---

## Autor

**Chris Seifert, DL6LG**
[www.ohrenbeisser.de](https://www.ohrenbeisser.de)
