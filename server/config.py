"""
config.py — Laden und Speichern der Anwendungseinstellungen.

Einstellungen werden in config.ini (neben main.py) persistiert.
Wird die Datei nicht gefunden, gelten die DEFAULTS.
"""

import configparser
from pathlib import Path

CONFIG_PATH = Path(__file__).parent.parent / "config.ini"

# Standardwerte — werden verwendet, wenn config.ini fehlt oder unvollständig ist
DEFAULTS: dict[str, str] = {
    "db_path":           str(Path.home() / ".local/share/hamradio/QLog/qlog.db"),
    "port":              "8765",
    "auto_open_browser": "true",
    "max_log_entries":   "200",
}


def load() -> dict:
    """Liest config.ini und gibt alle Einstellungen als dict zurück.

    Fehlende Schlüssel werden aus DEFAULTS ergänzt.
    Gibt immer ein vollständiges dict zurück (nie KeyError möglich).
    """
    cfg = configparser.ConfigParser()
    cfg.read(CONFIG_PATH)

    # Sicherstellen, dass der Abschnitt existiert (auch bei leerer Datei)
    if "server" not in cfg:
        cfg["server"] = {}

    return {
        "db_path":           cfg.get("server", "db_path",           fallback=DEFAULTS["db_path"]),
        "port":              int(cfg.get("server", "port",           fallback=DEFAULTS["port"])),
        "auto_open_browser": cfg.getboolean("server", "auto_open_browser", fallback=True),
        "max_log_entries":   int(cfg.get("server", "max_log_entries", fallback=DEFAULTS["max_log_entries"])),
    }


def save(settings: dict) -> None:
    """Schreibt die übergebenen Einstellungen in config.ini.

    Überschreibt die bestehende Datei vollständig (nur [server]-Abschnitt).
    """
    cfg = configparser.ConfigParser()
    cfg["server"] = {
        "db_path":           str(settings["db_path"]),
        "port":              str(settings["port"]),
        "auto_open_browser": str(settings["auto_open_browser"]).lower(),
        "max_log_entries":   str(settings["max_log_entries"]),
    }
    with open(CONFIG_PATH, "w") as f:
        cfg.write(f)
