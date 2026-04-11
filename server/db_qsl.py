import sqlite3
from typing import Optional
from .db_base import get_connection


def recent_qsos(db_path: str, limit: int = 20) -> list[dict]:
    """Die letzten N QSOs, neueste zuerst."""
    conn = get_connection(db_path)
    try:
        rows = conn.execute(
            """
            SELECT id, callsign, start_time, band, mode, rst_sent, rst_rcvd,
                   qsl_rcvd, qsl_sent, qsl_rcvd_via, qsl_sent_via
            FROM contacts
            ORDER BY start_time DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def search_qsos(db_path: str, callsign: str) -> list[dict]:
    """Alle QSOs mit einem Rufzeichen, neueste zuerst."""
    conn = get_connection(db_path)
    try:
        rows = conn.execute(
            """
            SELECT id, start_time, band, mode, rst_sent, rst_rcvd,
                   qsl_rcvd, qsl_sent, qsl_rcvd_via, qsl_sent_via
            FROM contacts
            WHERE UPPER(callsign) = UPPER(?)
            ORDER BY start_time DESC
            """,
            (callsign,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def confirm_qsos(db_path: str, entries: list[dict]) -> int:
    """QSL-Felder für eine Liste von QSOs setzen. Gibt Anzahl geänderter Zeilen zurück."""
    conn = get_connection(db_path)
    updated = 0
    try:
        for e in entries:
            qso_id  = e["id"]
            date    = e["date"]
            rcvd    = e.get("qsl_rcvd")
            sent    = e.get("qsl_sent")
            rcvd_via = e.get("qsl_rcvd_via")
            sent_via = e.get("qsl_sent_via")

            fields = []
            params = []

            if rcvd:
                fields += ["qsl_rcvd = ?", "qsl_rdate = ?"]
                params += [rcvd, date]
                if rcvd_via:
                    fields.append("qsl_rcvd_via = ?")
                    params.append(rcvd_via)

            if sent:
                fields += ["qsl_sent = ?", "qsl_sdate = ?"]
                params += [sent, date]
                if sent_via:
                    fields.append("qsl_sent_via = ?")
                    params.append(sent_via)

            if not fields:
                continue

            params.append(qso_id)
            conn.execute(
                f"UPDATE contacts SET {', '.join(fields)} WHERE id = ?",
                params,
            )
            updated += conn.execute("SELECT changes()").fetchone()[0]

        conn.commit()
        return updated
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
