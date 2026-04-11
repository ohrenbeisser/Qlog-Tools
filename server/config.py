import configparser
import os
from pathlib import Path

CONFIG_PATH = Path(__file__).parent.parent / "config.ini"

DEFAULTS = {
    "db_path": str(Path.home() / ".local/share/hamradio/QLog/qlog.db"),
    "port": "8765",
    "auto_open_browser": "true",
    "max_log_entries": "200",
}


def load() -> dict:
    cfg = configparser.ConfigParser()
    cfg.read(CONFIG_PATH)
    if "server" not in cfg:
        cfg["server"] = {}
    s = cfg["server"]
    return {
        "db_path":           s.get("db_path",           DEFAULTS["db_path"]),
        "port":              int(s.get("port",           DEFAULTS["port"])),
        "auto_open_browser": cfg.getboolean("server", "auto_open_browser", fallback=True),
        "max_log_entries":   int(s.get("max_log_entries", DEFAULTS["max_log_entries"])),
    }


def save(settings: dict) -> None:
    cfg = configparser.ConfigParser()
    cfg["server"] = {
        "db_path":           str(settings["db_path"]),
        "port":              str(settings["port"]),
        "auto_open_browser": str(settings["auto_open_browser"]).lower(),
        "max_log_entries":   str(settings["max_log_entries"]),
    }
    with open(CONFIG_PATH, "w") as f:
        cfg.write(f)
