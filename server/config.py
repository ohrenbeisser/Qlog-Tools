"""
config.py — Laden und Speichern der Server-Einstellungen.

Einstellungen werden in config.ini (neben main.py) persistiert.
Wird die Datei nicht gefunden, gelten die DEFAULTS.

Browser-seitige Einstellungen (z. B. Export-Felder) werden vom
Frontend im LocalStorage verwaltet — nicht hier.
"""

import configparser
from pathlib import Path

CONFIG_PATH = Path(__file__).parent.parent / "config.ini"

DEFAULTS: dict[str, str] = {
    "db_path":           str(Path.home() / ".local/share/hamradio/QLog/qlog.db"),
    "port":              "8765",
    "bind_all":          "false",   # false = 127.0.0.1 (lokal), true = 0.0.0.0 (LAN)
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

    if "server" not in cfg:
        cfg["server"] = {}

    return {
        "db_path":           cfg.get("server", "db_path",           fallback=DEFAULTS["db_path"]),
        "port":              int(cfg.get("server", "port",           fallback=DEFAULTS["port"])),
        "bind_all":          cfg.getboolean("server", "bind_all",    fallback=False),
        "auto_open_browser": cfg.getboolean("server", "auto_open_browser", fallback=True),
        "max_log_entries":   int(cfg.get("server", "max_log_entries", fallback=DEFAULTS["max_log_entries"])),
    }


def save(settings: dict) -> None:
    """Schreibt die übergebenen Einstellungen in config.ini."""
    cfg = configparser.ConfigParser()
    cfg["server"] = {
        "db_path":           str(settings["db_path"]),
        "port":              str(settings["port"]),
        "bind_all":          str(settings.get("bind_all", False)).lower(),
        "auto_open_browser": str(settings["auto_open_browser"]).lower(),
        "max_log_entries":   str(settings["max_log_entries"]),
    }
    with open(CONFIG_PATH, "w") as f:
        cfg.write(f)
