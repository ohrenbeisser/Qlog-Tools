"""
api.py — FastAPI-App mit allen HTTP-Endpunkten.

Startpunkt: main.py startet uvicorn mit dieser App als daemon-Thread.
Die PWA-Dateien aus web/ werden als statische Dateien unter / gemountet,
sodass API und Frontend auf demselben Port laufen (kein CORS nötig).
"""

import queue
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config as cfg_module
from .db_qsl import (
    confirm_qsos, export_countries, export_date_range,
    export_qsos, mark_qsos_sent, recent_qsos, search_qsos,
)
from .db_stats import (
    get_stats_summary,
    get_by_country, get_by_band, get_by_mode,
    get_by_year, get_by_month, get_by_weekday,
    get_by_hour, get_by_callsign,
    get_date_range, get_all_bands, get_all_modes,
    search_callsigns,
)

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
    date: str                        # Format: YYYY-MM-DD
    qsl_rcvd:     str | None = None  # 'Y' = Karte empfangen
    qsl_sent:     str | None = None  # 'R' = angefordert (TNX QSO), 'Y' = bereits verschickt
    qsl_rcvd_via: str | None = None  # 'B'=Bureau, 'D'=Direct
    qsl_sent_via: str | None = None  # 'B'=Bureau, 'D'=Direct


class MarkSentIn(BaseModel):
    """Payload für PUT /api/qsl/mark_sent."""
    ids:  list[int]
    date: str          # Format: YYYY-MM-DD


class ConfigIn(BaseModel):
    """Einstellungen-Payload für PUT /api/config."""
    db_path:           str
    port:              int
    bind_all:          bool
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


# ── Export-Endpunkte ──────────────────────────────────────────────────────────

@app.get("/api/qsl/export/daterange")
def qsl_export_daterange():
    """Gibt ältestes und neuestes Datum der Bureau-Export-QSOs zurück."""
    settings = cfg_module.load()
    try:
        result = export_date_range(settings["db_path"])
    except Exception as e:
        raise _db_error("GET", "/api/qsl/export/daterange", e)
    _log("GET", "/api/qsl/export/daterange")
    return result


@app.get("/api/qsl/export/countries")
def qsl_export_countries():
    """Gibt alle Länder zurück, die im Bureau-Export vorkommen (für Filter-Dropdown)."""
    settings = cfg_module.load()
    try:
        countries = export_countries(settings["db_path"])
    except Exception as e:
        raise _db_error("GET", "/api/qsl/export/countries", e)
    _log("GET", "/api/qsl/export/countries", f"{len(countries)} Länder")
    return countries


@app.get("/api/qsl/export")
def qsl_export(
    date_from: str | None = Query(None),
    date_to:   str | None = Query(None),
    band:      str | None = Query(None),
    mode:      str | None = Query(None),
    country:   str | None = Query(None),
):
    """Gibt gefilterte QSOs für den Bureau-Export zurück (qsl_sent=Q, qsl_sent_via=B)."""
    settings = cfg_module.load()
    try:
        rows = export_qsos(
            settings["db_path"],
            date_from=date_from,
            date_to=date_to,
            band=band,
            mode=mode,
            country=country,
        )
    except Exception as e:
        raise _db_error("GET", "/api/qsl/export", e)
    _log("GET", "/api/qsl/export", f"{len(rows)} QSO(s)")
    return rows


@app.put("/api/qsl/mark_sent")
def qsl_mark_sent(data: MarkSentIn):
    """Setzt qsl_sent='Y' + qsl_sdate für die angegebenen QSO-IDs.

    Wird nach dem ADIF-Export aufgerufen, wenn der Nutzer die Option
    'Als gesendet markieren' aktiviert hat.
    """
    settings = cfg_module.load()
    try:
        updated = mark_qsos_sent(settings["db_path"], data.ids, data.date)
    except Exception as e:
        raise _db_error("PUT", "/api/qsl/mark_sent", e)
    _log("PUT", "/api/qsl/mark_sent", f"{updated} QSO(s) als gesendet markiert")
    return {"updated": updated}


# ── Statistik-Endpunkte ───────────────────────────────────────────────────────

# Dispatcher: Typ → DB-Funktion (alle mit gleicher Signatur außer band/mode)
_STATS_HANDLERS = {
    'country':  get_by_country,
    'year':     get_by_year,
    'month':    get_by_month,
    'weekday':  get_by_weekday,
    'hour':     get_by_hour,
    'callsign': get_by_callsign,
}


@app.get("/api/stats/summary")
def stats_summary(
    date_from: str | None = Query(None),
    date_to:   str | None = Query(None),
    band:      str | None = Query(None),
    mode:      str | None = Query(None),
):
    """Kennzahlen für die Summary-Kacheln: QSOs, Länder, Bänder, Modes."""
    settings = cfg_module.load()
    try:
        result = get_stats_summary(settings["db_path"], date_from, date_to, band, mode)
    except Exception as e:
        raise _db_error("GET", "/api/stats/summary", e)
    _log("GET", "/api/stats/summary")
    return result


@app.get("/api/stats/by/band")
def stats_by_band(
    date_from: str | None = Query(None),
    date_to:   str | None = Query(None),
    mode:      str | None = Query(None),
):
    """QSO-Anzahl pro Band (kein Band-Filter — würde Ergebnis auf 1 reduzieren)."""
    settings = cfg_module.load()
    try:
        rows = get_by_band(settings["db_path"], date_from, date_to, mode)
    except Exception as e:
        raise _db_error("GET", "/api/stats/by/band", e)
    _log("GET", "/api/stats/by/band", f"{len(rows)} Bänder")
    return rows


@app.get("/api/stats/by/mode")
def stats_by_mode(
    date_from: str | None = Query(None),
    date_to:   str | None = Query(None),
    band:      str | None = Query(None),
):
    """QSO-Anzahl pro Mode (kein Mode-Filter — würde Ergebnis auf 1 reduzieren)."""
    settings = cfg_module.load()
    try:
        rows = get_by_mode(settings["db_path"], date_from, date_to, band)
    except Exception as e:
        raise _db_error("GET", "/api/stats/by/mode", e)
    _log("GET", "/api/stats/by/mode", f"{len(rows)} Modes")
    return rows


@app.get("/api/stats/by/{stat_type}")
def stats_by_type(
    stat_type: str,
    date_from: str | None = Query(None),
    date_to:   str | None = Query(None),
    band:      str | None = Query(None),
    mode:      str | None = Query(None),
):
    """QSO-Anzahl gruppiert nach Typ: country | year | month | weekday | hour | callsign."""
    if stat_type not in _STATS_HANDLERS:
        raise HTTPException(status_code=404, detail=f"Unbekannter Statistik-Typ: {stat_type}")
    settings = cfg_module.load()
    try:
        rows = _STATS_HANDLERS[stat_type](settings["db_path"], date_from, date_to, band, mode)
    except Exception as e:
        raise _db_error("GET", f"/api/stats/by/{stat_type}", e)
    _log("GET", f"/api/stats/by/{stat_type}", f"{len(rows)} Einträge")
    return rows


@app.get("/api/stats/filters")
def stats_filters():
    """Liefert Datumsbereich, Bänder und Modes für die Filter-Dropdowns."""
    settings = cfg_module.load()
    try:
        date_range = get_date_range(settings["db_path"])
        bands      = get_all_bands(settings["db_path"])
        modes      = get_all_modes(settings["db_path"])
    except Exception as e:
        raise _db_error("GET", "/api/stats/filters", e)
    _log("GET", "/api/stats/filters")
    return {"date_from": date_range["date_from"], "date_to": date_range["date_to"],
            "bands": bands, "modes": modes}


# ── Rufzeichen-Suche ─────────────────────────────────────────────────────────

@app.get("/api/callsigns/search")
def callsigns_search(
    q:           str        = Query(..., min_length=1),
    search_mode: str        = Query('partial'),
    band:        str | None = Query(None),
    mode:        str | None = Query(None),
    offset:      int        = Query(0, ge=0),
):
    """Sucht QSOs nach Rufzeichen (Teilstring oder Anfang), seitenweise.

    search_mode : 'partial' (Standard) oder 'beginning'
    offset      : Anzahl zu überspringender Zeilen (Pagination)
    """
    if search_mode not in ('partial', 'beginning'):
        raise HTTPException(status_code=422, detail="search_mode muss 'partial' oder 'beginning' sein")
    settings = cfg_module.load()
    try:
        rows = search_callsigns(settings["db_path"], q, search_mode, band, mode, offset=offset)
    except Exception as e:
        raise _db_error("GET", f"/api/callsigns/search?q={q}", e)
    _log("GET", f"/api/callsigns/search?q={q}&offset={offset}", f"{len(rows)} QSO(s)")
    return rows


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
