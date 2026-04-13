"""
db_stats.py — Nur-lesende Statistik-Abfragen auf der Qlog-Datenbank.

Alle Funktionen öffnen eine eigene Verbindung via get_connection() und
schließen sie im finally-Block. Parameter werden immer als Tuple übergeben,
nie per String-Formatierung (SQL-Injection-Schutz).

Alle Filter-Parameter sind optional (None = kein Filter).
start_time liegt in der DB als ISO-8601-String vor ('2026-01-01T14:48:23.071Z'),
daher wird DATE(start_time) bzw. strftime() für Datumsvergleiche genutzt.
"""

from .db_base import get_connection


# ── Interner Helper ───────────────────────────────────────────────────────────

def _add_filters(
    query: str,
    params: list,
    date_from: str | None,
    date_to:   str | None,
    band:      str | None,
    mode:      str | None,
) -> tuple[str, list]:
    """Hängt WHERE-Bedingungen für die Standard-Filter an.

    Wird immer auf eine Query angewendet, die bereits ein WHERE enthält
    (also mit 'AND' weiterverknüpft werden kann).
    """
    if date_from:
        query += " AND DATE(start_time) >= ?"
        params.append(date_from)
    if date_to:
        query += " AND DATE(start_time) <= ?"
        params.append(date_to)
    if band:
        query += " AND band = ?"
        params.append(band)
    if mode:
        query += " AND mode = ?"
        params.append(mode)
    return query, params


# ── Übersicht ─────────────────────────────────────────────────────────────────

def get_stats_summary(
    db_path:   str,
    date_from: str | None = None,
    date_to:   str | None = None,
    band:      str | None = None,
    mode:      str | None = None,
) -> dict:
    """Gibt Kennzahlen für die Summary-Kacheln zurück.

    Returns
    -------
    {
        'total_qsos':    int,
        'total_countries': int,
        'total_bands':   int,
        'total_modes':   int,
    }
    """
    conn = get_connection(db_path)
    try:
        base = "FROM contacts WHERE 1=1"
        p: list = []
        base, p = _add_filters(base, p, date_from, date_to, band, mode)

        rows = conn.execute(
            f"""
            SELECT
                COUNT(*)                                        AS total_qsos,
                COUNT(DISTINCT NULLIF(country, ''))             AS total_countries,
                COUNT(DISTINCT NULLIF(band, ''))                AS total_bands,
                COUNT(DISTINCT NULLIF(mode, ''))                AS total_modes
            {base}
            """,
            p,
        ).fetchone()
        return dict(rows) if rows else {
            'total_qsos': 0, 'total_countries': 0,
            'total_bands': 0, 'total_modes': 0,
        }
    finally:
        conn.close()


# ── Gruppierte Statistiken ────────────────────────────────────────────────────

def get_by_country(
    db_path:   str,
    date_from: str | None = None,
    date_to:   str | None = None,
    band:      str | None = None,
    mode:      str | None = None,
) -> list[dict]:
    """QSO-Anzahl pro Land, absteigend sortiert.

    Returns [{label, count}, ...]
    """
    conn = get_connection(db_path)
    try:
        q = """
            SELECT country AS label, COUNT(*) AS count
            FROM   contacts
            WHERE  country IS NOT NULL AND country != ''
        """
        p: list = []
        q, p = _add_filters(q, p, date_from, date_to, band, mode)
        q += " GROUP BY country ORDER BY count DESC"
        return [dict(r) for r in conn.execute(q, p).fetchall()]
    finally:
        conn.close()


def get_by_band(
    db_path:   str,
    date_from: str | None = None,
    date_to:   str | None = None,
    mode:      str | None = None,
) -> list[dict]:
    """QSO-Anzahl pro Band, absteigend sortiert.

    Kein band-Filter (würde nur ein Band zeigen).
    Returns [{label, count}, ...]
    """
    conn = get_connection(db_path)
    try:
        q = """
            SELECT band AS label, COUNT(*) AS count
            FROM   contacts
            WHERE  band IS NOT NULL AND band != ''
        """
        p: list = []
        q, p = _add_filters(q, p, date_from, date_to, band=None, mode=mode)
        q += " GROUP BY band ORDER BY count DESC"
        return [dict(r) for r in conn.execute(q, p).fetchall()]
    finally:
        conn.close()


def get_by_mode(
    db_path:   str,
    date_from: str | None = None,
    date_to:   str | None = None,
    band:      str | None = None,
) -> list[dict]:
    """QSO-Anzahl pro Mode, absteigend sortiert.

    Kein mode-Filter (würde nur einen Mode zeigen).
    Returns [{label, count}, ...]
    """
    conn = get_connection(db_path)
    try:
        q = """
            SELECT mode AS label, COUNT(*) AS count
            FROM   contacts
            WHERE  mode IS NOT NULL AND mode != ''
        """
        p: list = []
        q, p = _add_filters(q, p, date_from, date_to, band=band, mode=None)
        q += " GROUP BY mode ORDER BY count DESC"
        return [dict(r) for r in conn.execute(q, p).fetchall()]
    finally:
        conn.close()


def get_by_year(
    db_path:   str,
    date_from: str | None = None,
    date_to:   str | None = None,
    band:      str | None = None,
    mode:      str | None = None,
) -> list[dict]:
    """QSO-Anzahl pro Jahr, absteigend (neuestes zuerst).

    Returns [{label, count}, ...]  label = 'YYYY'
    """
    conn = get_connection(db_path)
    try:
        q = """
            SELECT strftime('%Y', start_time) AS label, COUNT(*) AS count
            FROM   contacts
            WHERE  start_time IS NOT NULL
        """
        p: list = []
        q, p = _add_filters(q, p, date_from, date_to, band, mode)
        q += " GROUP BY label ORDER BY label DESC"
        return [dict(r) for r in conn.execute(q, p).fetchall()]
    finally:
        conn.close()


def get_by_month(
    db_path:   str,
    date_from: str | None = None,
    date_to:   str | None = None,
    band:      str | None = None,
    mode:      str | None = None,
) -> list[dict]:
    """QSO-Anzahl pro Monat, absteigend (neuester zuerst).

    Returns [{label, count}, ...]  label = 'YYYY-MM'
    """
    conn = get_connection(db_path)
    try:
        q = """
            SELECT strftime('%Y-%m', start_time) AS label, COUNT(*) AS count
            FROM   contacts
            WHERE  start_time IS NOT NULL
        """
        p: list = []
        q, p = _add_filters(q, p, date_from, date_to, band, mode)
        q += " GROUP BY label ORDER BY label DESC"
        return [dict(r) for r in conn.execute(q, p).fetchall()]
    finally:
        conn.close()


def get_by_weekday(
    db_path:   str,
    date_from: str | None = None,
    date_to:   str | None = None,
    band:      str | None = None,
    mode:      str | None = None,
) -> list[dict]:
    """QSO-Anzahl pro Wochentag (Mo–So), nach Wochentag sortiert.

    SQLite: strftime('%w') → 0=Sonntag … 6=Samstag.
    Wir sortieren Mo–So (day_num 1–6, dann 0).

    Returns [{label, count}, ...]  label = 'Montag' etc.
    """
    conn = get_connection(db_path)
    try:
        q = """
            SELECT
                CASE CAST(strftime('%w', start_time) AS INTEGER)
                    WHEN 0 THEN 'Sonntag'
                    WHEN 1 THEN 'Montag'
                    WHEN 2 THEN 'Dienstag'
                    WHEN 3 THEN 'Mittwoch'
                    WHEN 4 THEN 'Donnerstag'
                    WHEN 5 THEN 'Freitag'
                    WHEN 6 THEN 'Samstag'
                END AS label,
                COUNT(*) AS count,
                CAST(strftime('%w', start_time) AS INTEGER) AS day_num
            FROM contacts
            WHERE start_time IS NOT NULL
        """
        p: list = []
        q, p = _add_filters(q, p, date_from, date_to, band, mode)
        # Montag zuerst: 1,2,3,4,5,6,0
        q += " GROUP BY day_num ORDER BY CASE day_num WHEN 0 THEN 7 ELSE day_num END"
        rows = conn.execute(q, p).fetchall()
        return [{'label': r['label'], 'count': r['count']} for r in rows]
    finally:
        conn.close()


def get_by_hour(
    db_path:   str,
    date_from: str | None = None,
    date_to:   str | None = None,
    band:      str | None = None,
    mode:      str | None = None,
) -> list[dict]:
    """QSO-Anzahl pro UTC-Stunde (0–23), aufsteigend.

    Returns [{label, count}, ...]  label = '00' … '23'
    """
    conn = get_connection(db_path)
    try:
        q = """
            SELECT strftime('%H', start_time) AS label, COUNT(*) AS count
            FROM   contacts
            WHERE  start_time IS NOT NULL
        """
        p: list = []
        q, p = _add_filters(q, p, date_from, date_to, band, mode)
        q += " GROUP BY label ORDER BY label ASC"
        return [dict(r) for r in conn.execute(q, p).fetchall()]
    finally:
        conn.close()


# ── Sonderrufzeichen ──────────────────────────────────────────────────────────

# Bekannte ITU-Präfixe, die mit einer Ziffer enden.
# Werden bei der 2-Ziffern-Analyse berücksichtigt, damit z.B. A65RW
# (A6 = UAE) nicht fälschlicherweise als Sonderrufzeichen gezählt wird.
_KNOWN_DIGIT_PREFIXES = {
    'A4', 'A6', 'A7', 'A9',
    'C3',
    'E7',
    'S5',
    'T7',
    'V5',
    'Z3', 'Z6',
    '2E', '2M', '2W',
    '3Z',
    '4J', '4K', '4L', '4X', '4Z',
    '5B', '5C', '5H', '5N', '5R', '5T', '5U', '5V', '5W', '5X', '5Z',
    '6O', '6V', '6W', '6Y',
    '7P', '7Q', '7X',
    '8P', '8Q', '8R', '8S',
    '9A', '9H', '9J', '9K', '9L', '9M', '9N', '9Q', '9U', '9V', '9X', '9Y',
}


def _is_special_callsign(call: str) -> bool:
    """Gibt True zurück wenn das Rufzeichen ein Sonderrufzeichen ist.

    Kriterien (aus Qlog-Stats übernommen):
      1. Suffix (abschließende Buchstaben) länger als 3 → Sonderrufzeichen
         z.B. DA0IARU (Suffix: IARU=4), 3Z0XMAS (Suffix: XMAS=4)
      2. Letzte Ziffernsequenz im Präfix-/Distriktteil hat 3+ Stellen → Sonder
         z.B. DL2025W, 9A100IARU
      3. Letzte Ziffernsequenz hat genau 2 Stellen UND der Präfix+erste Ziffer
         ist kein bekanntes ITU-Präfix → Sonderrufzeichen
         z.B. DL75DARC (kein DL7-Präfix), aber A65RW ist normal (A6 = UAE)
    """
    import re
    # Portable-Stationen (DL6LG/P) ausschließen — diese sind keine Sonderrufzeichen
    if '/' in call:
        return False
    suffix_match = re.search(r'([A-Z]+)$', call)
    if not suffix_match:
        return False
    suffix = suffix_match.group(1)
    prefix_and_number = call[:-len(suffix)]
    # Kriterium 1: Suffix > 3 Buchstaben
    if len(suffix) > 3:
        return True
    # Ziffernsequenzen im Präfix+Distrikt analysieren
    digit_sequences = re.findall(r'\d+', prefix_and_number)
    if not digit_sequences:
        return False
    last_seq = digit_sequences[-1]
    last_pos = prefix_and_number.rfind(last_seq)
    prefix   = prefix_and_number[:last_pos]
    if len(last_seq) == 1:
        return False
    if len(last_seq) == 2:
        return (prefix + last_seq[0]) not in _KNOWN_DIGIT_PREFIXES
    # 3+ Ziffern → definitiv Sonderrufzeichen
    return True


def get_special_callsigns(
    db_path:   str,
    date_from: str | None = None,
    date_to:   str | None = None,
    band:      str | None = None,
    mode:      str | None = None,
) -> list[dict]:
    """Gibt alle QSOs mit Sonderrufzeichen zurück.

    Sonderrufzeichen werden in Python nach dem DB-Abruf gefiltert
    (_is_special_callsign). Portable-Stationen (enthält '/') werden
    ausgeschlossen, da deren Suffix-Analyse nicht zuverlässig ist.

    Sortierung: neueste QSOs zuerst.
    """
    conn = get_connection(db_path)
    try:
        q = """
            SELECT callsign,
                   strftime('%Y-%m-%d', start_time) AS start_date,
                   strftime('%H:%M',   start_time)  AS start_utc,
                   band, mode, country,
                   qsl_rcvd, qsl_sent
            FROM   contacts
            WHERE  callsign IS NOT NULL
              AND  callsign NOT LIKE '%/%'
        """
        params: list = []
        q, params = _add_filters(q, params, date_from, date_to, band, mode)
        q += " ORDER BY start_time DESC"
        rows = conn.execute(q, params).fetchall()
    finally:
        conn.close()

    return [dict(r) for r in rows if _is_special_callsign(r["callsign"])]


def get_by_callsign(
    db_path:   str,
    date_from: str | None = None,
    date_to:   str | None = None,
    band:      str | None = None,
    mode:      str | None = None,
    limit:     int = 100,
) -> list[dict]:
    """QSO-Anzahl pro Rufzeichen, absteigend, begrenzt auf *limit*.

    Returns [{label, count}, ...]
    """
    conn = get_connection(db_path)
    try:
        q = """
            SELECT callsign AS label, COUNT(*) AS count
            FROM   contacts
            WHERE  callsign IS NOT NULL AND callsign != ''
        """
        p: list = []
        q, p = _add_filters(q, p, date_from, date_to, band, mode)
        q += f" GROUP BY callsign ORDER BY count DESC LIMIT {int(limit)}"
        return [dict(r) for r in conn.execute(q, p).fetchall()]
    finally:
        conn.close()


# ── Rufzeichen-Suche ─────────────────────────────────────────────────────────

def search_callsigns(
    db_path:     str,
    q:           str,
    search_mode: str = 'partial',
    band:        str | None = None,
    mode:        str | None = None,
    limit:       int = 500,
    offset:      int = 0,
) -> list[dict]:
    """Sucht QSOs nach Rufzeichen (Teilstring oder Anfang).

    Parameters
    ----------
    q           : Suchbegriff (case-insensitiv)
    search_mode : 'partial'   → %q% (überall im Rufzeichen)
                  'beginning' → q%  (nur am Anfang)
    band        : optionaler Band-Filter
    mode        : optionaler Mode-Filter
    limit       : maximale Trefferzahl pro Seite (Standard 500)
    offset      : Anzahl zu überspringender Zeilen für Pagination

    Returns
    -------
    [{callsign, start_date, start_utc, band, mode, country,
      rst_rcvd, qsl_rcvd, qsl_sent}, ...]
    neueste QSOs zuerst.
    """
    conn = get_connection(db_path)
    try:
        pattern = f'%{q}%' if search_mode == 'partial' else f'{q}%'
        sql = """
            SELECT callsign,
                   strftime('%Y-%m-%d', start_time) AS start_date,
                   strftime('%H:%M',   start_time)  AS start_utc,
                   band, mode, country,
                   rst_rcvd,
                   qsl_rcvd, qsl_sent
            FROM   contacts
            WHERE  UPPER(callsign) LIKE UPPER(?)
        """
        params: list = [pattern]
        if band:
            sql += " AND band = ?"
            params.append(band)
        if mode:
            sql += " AND mode = ?"
            params.append(mode)
        sql += f" ORDER BY start_time DESC LIMIT {int(limit)} OFFSET {int(offset)}"
        return [dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


# ── Hilfsfunktionen für Filter-Dropdowns ─────────────────────────────────────

def get_date_range(db_path: str) -> dict:
    """Erstes und letztes QSO-Datum in der Datenbank.

    Returns {'date_from': 'YYYY-MM-DD', 'date_to': 'YYYY-MM-DD'}
    Beide Werte sind None wenn keine QSOs vorhanden.
    """
    conn = get_connection(db_path)
    try:
        row = conn.execute(
            """
            SELECT DATE(MIN(start_time)) AS date_from,
                   DATE(MAX(start_time)) AS date_to
            FROM   contacts
            WHERE  start_time IS NOT NULL
            """
        ).fetchone()
        return {
            'date_from': row['date_from'] if row else None,
            'date_to':   row['date_to']   if row else None,
        }
    finally:
        conn.close()


def get_all_bands(db_path: str) -> list[str]:
    """Alle vorhandenen Bänder, alphabetisch sortiert."""
    conn = get_connection(db_path)
    try:
        rows = conn.execute(
            "SELECT DISTINCT band FROM contacts WHERE band IS NOT NULL AND band != '' ORDER BY band"
        ).fetchall()
        return [r['band'] for r in rows]
    finally:
        conn.close()


def get_all_modes(db_path: str) -> list[str]:
    """Alle vorhandenen Betriebsarten, alphabetisch sortiert."""
    conn = get_connection(db_path)
    try:
        rows = conn.execute(
            "SELECT DISTINCT mode FROM contacts WHERE mode IS NOT NULL AND mode != '' ORDER BY mode"
        ).fetchall()
        return [r['mode'] for r in rows]
    finally:
        conn.close()
