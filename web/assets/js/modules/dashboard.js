/**
 * dashboard.js — Start-Panel: letzte 20 QSOs laden und anzeigen.
 *
 * Öffentliche API (via window.* in app.js exponiert):
 *   loadRecentQsos()  — Lädt die letzten 20 QSOs und rendert die Tabelle
 */

import { apiGet } from './api.js';

/**
 * Lädt die letzten 20 QSOs vom Backend und rendert sie in der Tabelle.
 *
 * Zustände:
 *   - Laden:    Spinner (#start-loading)
 *   - Leer:     Hinweistext (#start-empty)
 *   - Fehler:   Fehlermeldung (#start-error)
 *   - Erfolg:   Tabelle (#start-table-wrap)
 */
export async function loadRecentQsos() {
  const loading   = document.getElementById('start-loading');
  const empty     = document.getElementById('start-empty');
  const errorEl   = document.getElementById('start-error');
  const tableWrap = document.getElementById('start-table-wrap');

  // Lade-Zustand anzeigen
  loading.style.display   = 'flex';
  empty.style.display     = 'none';
  errorEl.style.display   = 'none';
  tableWrap.style.display = 'none';

  try {
    const data = await apiGet('/api/dashboard/recent');
    loading.style.display = 'none';

    if (data.length === 0) {
      empty.style.display = 'flex';
      return;
    }

    _renderRecentTable(data);
    tableWrap.style.display = 'block';

  } catch (err) {
    loading.style.display = 'none';
    document.getElementById('start-error-msg').textContent =
      'Verbindung fehlgeschlagen: ' + err.message;
    errorEl.style.display = 'flex';
  }
}

/**
 * Füllt den tbody der Starttabelle mit den geladenen QSO-Daten.
 *
 * @param {Object[]} data — QSO-Liste vom Backend
 */
function _renderRecentTable(data) {
  const tbody = document.getElementById('start-tbody');
  tbody.innerHTML = '';
  data.forEach(q => tbody.appendChild(_buildRecentRow(q)));
}

/**
 * Erstellt eine <tr>-Zeile für die Starttabelle.
 * Das Rufzeichen wird als Link zu QRZ.com dargestellt.
 *
 * @param {Object} q — QSO-Objekt vom Backend
 * @returns {HTMLTableRowElement}
 */
function _buildRecentRow(q) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="md-td" style="font-family:monospace;font-weight:700">
      <a href="https://www.qrz.com/db/${q.callsign}" target="_blank" rel="noopener"
         class="md-link">${q.callsign}</a></td>
    <td class="md-td" style="font-family:monospace">${q.start_date ?? '—'}</td>
    <td class="md-td" style="font-family:monospace">${q.start_utc  ?? '—'}</td>
    <td class="md-td"><span class="md-chip md-chip-suggestion chip-band">${q.band ?? '—'}</span></td>
    <td class="md-td"><span class="md-chip md-chip-suggestion chip-mode">${q.mode ?? '—'}</span></td>
    <td class="md-td" style="font-family:monospace">${q.rst_sent ?? '—'}</td>
    <td class="md-td" style="font-family:monospace">${q.rst_rcvd ?? '—'}</td>
    <td class="md-td">${q.country ?? '—'}</td>`;
  return tr;
}
