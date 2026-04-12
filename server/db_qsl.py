"""
db_qsl.py — Datenbankzugriffe für QSL-Funktionen.

Alle Funktionen öffnen eine eigene Verbindung und schliessen sie
nach Gebrauch wieder (kein Connection-Pooling nötig, da SQLite).
"""

import sqlite3
from typing import Optional
from .db_base import get_connection


# ── Lesende Abfragen ──────────────────────────────────────────────────────────

def recent_qsos(db_path: str, limit: int = 20) -> list[dict]:
    """Die letzten *limit* QSOs, neueste zuerst.

    Gibt start_date (YYYY-MM-DD) und start_utc (HH:MM) als
    separate Felder zurück — start_time ist in der DB ein
    ISO-8601-String wie '2026-01-01T14:48:23.071Z'.
    """
    conn = get_connection(db_path)
    try:
        rows = conn.execute(
            """
            SELECT id, callsign,
                   strftime('%Y-%m-%d', start_time) AS start_date,
                   strftime('%H:%M',   start_time)  AS start_utc,
                   band, mode, rst_sent, rst_rcvd, country
            FROM   contacts
            ORDER  BY start_time DESC
            LIMIT  ?
            """,
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def search_qsos(db_path: str, callsign: str) -> list[dict]:
    """Alle QSOs mit einem Rufzeichen, neueste zuerst.

    callsign wird case-insensitiv verglichen (UPPER auf beiden Seiten).
    Gibt QSL-Felder zurück, damit das Frontend den aktuellen Status
    kennt und bereits bestätigte QSOs als disabled/dimmed darstellen kann.
    """
    conn = get_connection(db_path)
    try:
        rows = conn.execute(
            """
            SELECT id,
                   strftime('%Y-%m-%d', start_time) AS start_date,
                   strftime('%H:%M',   start_time)  AS start_utc,
                   band, mode, rst_sent, rst_rcvd,
                   qsl_rcvd, qsl_sent,
                   qsl_rcvd_via, qsl_sent_via
            FROM   contacts
            WHERE  UPPER(callsign) = UPPER(?)
            ORDER  BY start_time DESC
            """,
            (callsign,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ── Schreibende Operationen ───────────────────────────────────────────────────

def confirm_qsos(db_path: str, entries: list[dict]) -> int:
    """QSL-Felder für eine Liste von QSOs setzen.

    Jeder Eintrag in *entries* muss mindestens enthalten:
      - id        (int)  — Primärschlüssel des Kontakts
      - date      (str)  — Datum der Eintragung, Format YYYY-MM-DD
    Optional:
      - qsl_rcvd     (str|None)  — 'Y' um Empfang zu bestätigen
      - qsl_sent     (str|None)  — 'Y' um Versand zu bestätigen
      - qsl_rcvd_via (str|None)  — 'B'=Bureau, 'D'=Direct
      - qsl_sent_via (str|None)  — 'B'=Bureau, 'D'=Direct

    Einträge ohne qsl_rcvd und qsl_sent werden übersprungen.
    Gibt die Gesamtzahl der geänderten Zeilen zurück.
    Bei einem Fehler wird die Transaktion zurückgerollt.
    """
    conn = get_connection(db_path)
    updated = 0
    try:
        for e in entries:
            changed = _update_single_qso(conn, e)
            updated += changed

        conn.commit()
        return updated

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


def _update_single_qso(conn: sqlite3.Connection, e: dict) -> int:
    """Baut das UPDATE für einen einzelnen QSO-Eintrag und führt es aus.

    Gibt die Anzahl geänderter Zeilen (0 oder 1) zurück.
    Separiert von confirm_qsos(), um die Schleife schlank zu halten.
    """
    qso_id   = e["id"]
    date     = e["date"]
    rcvd     = e.get("qsl_rcvd")
    sent     = e.get("qsl_sent")
    rcvd_via = e.get("qsl_rcvd_via")
    sent_via = e.get("qsl_sent_via")

    fields: list[str] = []
    params: list      = []

    if rcvd:
        # Empfangsstatus + Eingangsdatum setzen
        fields += ["qsl_rcvd = ?", "qsl_rdate = ?"]
        params += [rcvd, date]
        if rcvd_via:
            fields.append("qsl_rcvd_via = ?")
            params.append(rcvd_via)

    if sent:
        # Sendestatus + Sendedatum setzen
        fields += ["qsl_sent = ?", "qsl_sdate = ?"]
        params += [sent, date]
        if sent_via:
            fields.append("qsl_sent_via = ?")
            params.append(sent_via)

    if not fields:
        # Nichts zu tun
        return 0

    params.append(qso_id)
    cursor = conn.execute(
        f"UPDATE contacts SET {', '.join(fields)} WHERE id = ?",
        params,
    )
    # cursor.rowcount ist nach einem UPDATE direkt verfügbar und
    # zuverlässiger als ein separates SELECT changes(), da changes()
    # durch zwischenzeitliche Statements überschrieben werden könnte.
    return cursor.rowcount
