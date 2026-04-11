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


# ── Log-Queue (wird von TKinter gelesen) ─────────────────────────────────────

log_queue: queue.Queue = queue.Queue()


def _log(method: str, path: str, detail: str = "") -> None:
    msg = f"{method} {path}"
    if detail:
        msg += f" → {detail}"
    log_queue.put(msg)


# ── Pydantic-Schemas ──────────────────────────────────────────────────────────

class QslConfirmEntry(BaseModel):
    id: int
    date: str                          # YYYY-MM-DD
    qsl_rcvd: Optional[str] = None     # "Y" | None
    qsl_sent: Optional[str] = None     # "Y" | None
    qsl_rcvd_via: Optional[str] = None # "B" | "D" | None
    qsl_sent_via: Optional[str] = None # "B" | "D" | None


class ConfigIn(BaseModel):
    db_path: str
    port: int
    auto_open_browser: bool
    max_log_entries: int


# ── Dashboard ────────────────────────────────────────────────────────────────

@app.get("/api/dashboard/recent")
def dashboard_recent():
    settings = cfg_module.load()
    try:
        rows = recent_qsos(settings["db_path"], limit=20)
    except Exception as e:
        _log("GET", "/api/dashboard/recent", f"Fehler: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    _log("GET", "/api/dashboard/recent", f"{len(rows)} QSO(s)")
    return rows


# ── QSL-Endpunkte ─────────────────────────────────────────────────────────────

@app.get("/api/qsl/search")
def qsl_search(call: str = Query(..., min_length=1)):
    settings = cfg_module.load()
    try:
        rows = search_qsos(settings["db_path"], call.upper())
    except Exception as e:
        _log("GET", f"/api/qsl/search?call={call}", f"Fehler: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    _log("GET", f"/api/qsl/search?call={call}", f"{len(rows)} QSO(s)")
    return rows


@app.put("/api/qsl/confirm")
def qsl_confirm(entries: list[QslConfirmEntry]):
    settings = cfg_module.load()
    try:
        updated = confirm_qsos(settings["db_path"], [e.model_dump() for e in entries])
    except Exception as e:
        _log("PUT", "/api/qsl/confirm", f"Fehler: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    _log("PUT", "/api/qsl/confirm", f"{updated} QSO(s) eingetragen")
    return {"updated": updated}


# ── Konfigurations-Endpunkte ──────────────────────────────────────────────────

@app.get("/api/config")
def get_config():
    _log("GET", "/api/config")
    return cfg_module.load()


@app.put("/api/config")
def put_config(data: ConfigIn):
    cfg_module.save(data.model_dump())
    _log("PUT", "/api/config", "gespeichert")
    return {"ok": True}


# ── Statische PWA-Dateien ─────────────────────────────────────────────────────

if WEB_DIR.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
