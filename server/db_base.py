"""
db_base.py — SQLite-Verbindungs-Factory.

WAL-Modus und busy_timeout ermöglichen gleichzeitigen Lesezugriff
durch Qlog, ohne SQLITE_BUSY-Fehler zu riskieren.
"""

import re
import sqlite3


def _regexp(pattern: str, value: str) -> bool:
    """Python-Implementierung der SQLite-Funktion REGEXP.

    SQLite hat kein eingebautes REGEXP — Qlog registriert es beim Öffnen
    der DB selbst. Damit unsere Verbindung nicht mit 'no such function: REGEXP'
    scheitert (z. B. wenn Qlog-Trigger beim UPDATE laufen), registrieren wir
    dieselbe Funktion hier ebenfalls.
    """
    if value is None:
        return False
    return re.search(pattern, value) is not None


def get_connection(db_path: str) -> sqlite3.Connection:
    """Öffnet eine SQLite-Verbindung mit für Qlog optimierten PRAGMAs.

    Parameters
    ----------
    db_path : str
        Absoluter Pfad zur qlog.db.

    Returns
    -------
    sqlite3.Connection
        Verbindung mit row_factory=sqlite3.Row (Spalten per Name abrufbar).

    Notes
    -----
    - WAL (Write-Ahead Logging) erlaubt gleichzeitiges Lesen und Schreiben.
    - busy_timeout=5000 ms: Wartezeit bei gesperrter DB, bevor ein Fehler geworfen wird.
    - check_same_thread=False: Verbindung wird in FastAPI-Worker-Threads genutzt.
    - REGEXP wird als Python-Funktion registriert (Qlog-Trigger benötigen sie).
    - Jede aufrufende Funktion ist selbst für conn.close() verantwortlich.
    """
    conn = sqlite3.connect(db_path, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.create_function("REGEXP", 2, _regexp)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn
