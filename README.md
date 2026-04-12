# Qlog-Tools

**QSL-Karten- und Logbuch-Verwaltung für [Qlog](https://github.com/foldynl/QLog)**

Qlog-Tools ist eine Desktop-Applikation für Funkamateure, die ihr Logbuch mit Qlog führen. Sie ermöglicht das komfortable Eintragen empfangener QSL-Karten und den Export von QSL-Karten als ADIF-Datei für den Bureau-Versand — direkt aus der Qlog-Datenbank heraus, ohne Qlog selbst öffnen zu müssen.

---

## Funktionen

### QSL Empfangen
- Rufzeichen eingeben → alle QSOs werden aufgelistet
- Pro QSO einzeln oder per "Alle"-Button auswählen:
  - **Empfangen** — setzt `qsl_rcvd = Y` + Eingangsdatum
  - **Anfordern** — setzt `qsl_sent = R` (TNX QSO, Karte wird angefordert)
- Bereits bestätigte QSOs werden abgedimmt und gesperrt

### QSL Bureau-Export
- Filtert QSOs mit `qsl_sent = Q` und `qsl_sent_via = B` (Bureau-Warteschlange)
- Filter nach Datum, Band, Mode und Land
- Einzelne QSOs können vom Export ausgeschlossen werden
- ADIF-Download direkt im Browser (kein Server-Upload)
- Zwei Feldumfänge wählbar:
  - **Minimal** — CALL, QSO_DATE, TIME_ON, BAND, MODE, RST_SENT, QSL_RCVD, QSL_SENT, QSL_SENT_VIA
  - **Erweitert** — zusätzlich FREQ, RST_RCVD, COMMENT, NOTES, TX_PWR, MY_RIG, MY_ANTENNA
- Optional: QSOs nach Export automatisch als gesendet markieren (`qsl_sent = Y`)
- `QSL_RCVD = Y` → "TNX" auf der Karte · `QSL_RCVD = N` → "PSE" (kompatibel mit [qslshop.de](https://qslshop.de))

### Weitere Features
- **Dashboard** — zeigt die letzten 20 QSOs auf einen Blick
- **Einstellungen** — Export-Feldauswahl im Browser (LocalStorage), Server-Konfiguration im Tkinter-Fenster
- **Dark Mode** — Material Design 3, vollständig responsiv
- **PWA** — läuft im Browser, installierbar, funktioniert offline (Service Worker)
- **LAN-Zugriff** — optionaler Zugriff vom Smartphone oder Tablet im Heimnetz

---

## Voraussetzungen

- Linux (x86_64, getestet auf Ubuntu/Debian)
- [Qlog](https://github.com/foldynl/QLog) mit einer vorhandenen `qlog.db`
- Python 3.10 oder neuer

---

## Installation

### Option A — Debian-Paket (empfohlen)

Das `.deb`-Paket installiert die App inklusive Python-Abhängigkeiten automatisch:

```bash
# Paket herunterladen (aus GitHub Releases)
wget https://github.com/ohrenbeisser/Qlog-Tools/releases/latest/download/qlog-tools_0.2.0_amd64.deb

# Installieren
sudo dpkg -i qlog-tools_0.2.0_amd64.deb

# Abhängigkeiten nachziehen falls nötig
sudo apt install -f
```

Die App erscheint danach im Anwendungsmenü unter **Qlog-Tools**.

Starten aus dem Terminal:
```bash
qlog-tools
```

Deinstallieren:
```bash
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

Das Tkinter-Fenster dient als Server-Monitor und Konfiguration:

| Reiter | Funktion |
|--------|----------|
| Server-Log | Zeigt alle API-Anfragen in Echtzeit |
| Einstellungen | DB-Pfad, Port, Netzwerk-Binding, Log-Einträge |

### Browser-Oberfläche

Die eigentliche Bedienoberfläche läuft im Browser unter `http://127.0.0.1:8765`:

| Panel | Funktion |
|-------|----------|
| Start | Letzte 20 QSOs auf einen Blick |
| QSL → Empfangen | QSL-Karten eintragen (Empfangen / Anfordern) |
| QSL → Export | Bureau-Export als ADIF-Datei |
| Einstellungen | Export-Felder konfigurieren |
| Über | Version, Autor, Links |

---

## Konfiguration

### Server-Einstellungen (`config.ini`)

Werden im Tkinter-Fenster verwaltet und in `config.ini` gespeichert:

| Einstellung | Standard | Beschreibung |
|-------------|----------|--------------|
| `db_path` | `~/.local/share/hamradio/QLog/qlog.db` | Pfad zur Qlog-Datenbank |
| `port` | `8765` | HTTP-Port des lokalen Servers |
| `bind_all` | `false` | `true` = LAN-Zugriff (0.0.0.0), `false` = nur lokal |
| `auto_open_browser` | `true` | Browser beim Start automatisch öffnen |
| `max_log_entries` | `200` | Maximale Anzahl Zeilen im Server-Log |

### Browser-Einstellungen (LocalStorage)

Werden direkt im Browser gespeichert — kein Server-Roundtrip:

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

- **Backend:** Python, FastAPI, uvicorn, SQLite (WAL-Modus)
- **Frontend:** Vanilla JS (ES-Module), Material Design 3 (MDesign), PWA mit Service Worker
- **Schriften:** Roboto + Material Symbols — lokal eingebettet, kein CDN
- **Datenbank:** Qlog-eigene SQLite-Datenbank, read/write

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

Version wird in `web/index.html` gesetzt:
```html
<span class="md-chip md-chip-suggestion about-version">Version 0.2.0</span>
```

---

## Geplante Funktionen (Phase 2)

- **Statistik-Tab** — Integration von Qlog-Stats
- **Rufzeichen-Tab** — Rufzeichen-Verwaltung
- **Abfragen-Tab** — Individuelle Datenbankabfragen

---

## Lizenz

Dieses Projekt ist aktuell ohne Lizenz veröffentlicht. Bei Interesse an einer Nutzung bitte direkt Kontakt aufnehmen.

---

## Autor

**Chris Seifert, DL6LG**
[www.ohrenbeisser.de](https://www.ohrenbeisser.de)
