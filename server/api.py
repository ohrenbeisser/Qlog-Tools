"""
api.py — FastAPI-App mit allen HTTP-Endpunkten.

Startpunkt: main.py startet uvicorn mit dieser App als daemon-Thread.
Die PWA-Dateien aus web/ werden als statische Dateien unter / gemountet,
sodass API und Frontend auf demselben Port laufen (kein CORS nötig).
"""

import queue
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config as cfg_module
from .db_qsl import confirm_qsos, recent_qsos, search_qsos

WEB_DIR = Path(__file__).parent.parent / "web"

app = FastAPI(title="Qlog-Tools")


# ── Log-Queue (thread-safe, wird von TKinter per root.after() gelesen) ────────

log_queue: queue.Queue = queue.Queue()


def _log(method: str, path: str, detail: str = "") -> None:
    """Schreibt eine Zeile in die Log-Queue. Format: 'GET /pfad → detail'"""
    msg = f"{method} {path}"
    if detail:
        msg += f" → {detail}"
    log_queue.put(msg)


def _db_error(method: str, path: str, exc: Exception) -> HTTPException:
    """Loggt den internen Fehler und gibt eine generische 500-Antwort zurück.

    Interne Fehlermeldungen (z. B. Datenbankpfade, Stack-Traces) werden
    nicht an den Client weitergegeben, um keine Implementierungsdetails
    preiszugeben.
    """
    _log(method, path, f"Fehler: {exc}")
    return HTTPException(status_code=500, detail="Interner Serverfehler")


# ── Pydantic-Schemas ──────────────────────────────────────────────────────────

class QslConfirmEntry(BaseModel):
    """Ein QSO-Eintrag für die QSL-Bestätigung."""
    id: int
    date: str                           # Format: YYYY-MM-DD
    qsl_rcvd:     Optional[str] = None  # 'Y' = empfangen
    qsl_sent:     Optional[str] = None  # 'Y' = gesendet
    qsl_rcvd_via: Optional[str] = None  # 'B'=Bureau, 'D'=Direct
    qsl_sent_via: Optional[str] = None  # 'B'=Bureau, 'D'=Direct


class ConfigIn(BaseModel):
    """Einstellungen-Payload für PUT /api/config."""
    db_path:           str
    port:              int
    auto_open_browser: bool
    max_log_entries:   int


# ── Dashboard ────────────────────────────────────────────────────────────────

@app.get("/api/dashboard/recent")
def dashboard_recent():
    """Gibt die letzten 20 QSOs zurück (für die Startseite)."""
    settings = cfg_module.load()
    try:
        rows = recent_qsos(settings["db_path"], limit=20)
    except Exception as e:
        raise _db_error("GET", "/api/dashboard/recent", e)
    _log("GET", "/api/dashboard/recent", f"{len(rows)} QSO(s)")
    return rows


# ── QSL-Endpunkte ─────────────────────────────────────────────────────────────

@app.get("/api/qsl/search")
def qsl_search(call: str = Query(..., min_length=1)):
    """Sucht alle QSOs für ein Rufzeichen (case-insensitiv)."""
    settings = cfg_module.load()
    try:
        rows = search_qsos(settings["db_path"], call.upper())
    except Exception as e:
        raise _db_error("GET", f"/api/qsl/search?call={call}", e)
    _log("GET", f"/api/qsl/search?call={call}", f"{len(rows)} QSO(s)")
    return rows


@app.put("/api/qsl/confirm")
def qsl_confirm(entries: list[QslConfirmEntry]):
    """Setzt QSL-Felder für eine Liste von QSOs."""
    settings = cfg_module.load()
    try:
        updated = confirm_qsos(settings["db_path"], [e.model_dump() for e in entries])
    except Exception as e:
        raise _db_error("PUT", "/api/qsl/confirm", e)
    _log("PUT", "/api/qsl/confirm", f"{updated} QSO(s) eingetragen")
    return {"updated": updated}


# ── Konfigurations-Endpunkte ──────────────────────────────────────────────────

@app.get("/api/config")
def get_config():
    """Gibt die aktuellen Einstellungen zurück."""
    _log("GET", "/api/config")
    return cfg_module.load()


@app.put("/api/config")
def put_config(data: ConfigIn):
    """Speichert neue Einstellungen in config.ini."""
    cfg_module.save(data.model_dump())
    _log("PUT", "/api/config", "gespeichert")
    return {"ok": True}


# ── Statische PWA-Dateien ─────────────────────────────────────────────────────

# Wird zuletzt gemountet, damit /api/-Routen Vorrang haben.
if WEB_DIR.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
