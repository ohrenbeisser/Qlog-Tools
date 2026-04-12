"""
db_base.py — SQLite-Verbindungs-Factory.

WAL-Modus und busy_timeout ermöglichen gleichzeitigen Lesezugriff
durch Qlog, ohne SQLITE_BUSY-Fehler zu riskieren.
"""

import sqlite3


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
    - Jede aufrufende Funktion ist selbst für conn.close() verantwortlich.
    """
    conn = sqlite3.connect(db_path, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn
