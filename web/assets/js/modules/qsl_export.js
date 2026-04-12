/**
 * qsl_export.js — QSL-Export-Tab: Filtern, Vorschau, ADIF-Download.
 *
 * Zeigt QSOs mit qsl_sent='Q' und qsl_sent_via='B' (Bureau-Warteschlange).
 * Alle Filter sind optional. Die Tabelle lädt erst nach Klick auf "Anwenden".
 * Einzelne QSOs können per Checkbox vom Export ausgeschlossen werden.
 *
 * Öffentliche API (via window.* in app.js exponiert):
 *   initExport()         — Lädt Länder-Dropdown beim ersten Tab-Öffnen
 *   applyExportFilter()  — Lädt gefilterte QSOs in die Tabelle
 *   resetExportFilter()  — Setzt Filter zurück und leert die Tabelle
 *   downloadAdif()       — Exportiert angezeigte (nicht abgehakte) QSOs als ADIF
 */

import { apiGet } from './api.js';

// ── Zustand ───────────────────────────────────────────────────────────────────

/** Aktuell geladene QSO-Liste (wird für den ADIF-Export genutzt). */
let _currentQsos = [];

/** Verhindert mehrfaches Laden der Länderliste. */
let _countriesLoaded = false;

// ── Initialisierung ───────────────────────────────────────────────────────────

/**
 * Lädt Länderliste und Datumsbereich einmalig beim ersten Öffnen des Export-Tabs.
 * Beide Requests laufen parallel (Promise.all).
 */
export async function initExport() {
  if (_countriesLoaded) return;
  try {
    const [countries, range] = await Promise.all([
      apiGet('/api/qsl/export/countries'),
      apiGet('/api/qsl/export/daterange'),
    ]);
    _fillCountrySelect(countries);
    _prefillDateRange(range);
    _countriesLoaded = true;
  } catch (err) {
    // Nicht kritisch — Felder bleiben leer, Filter funktioniert trotzdem
    console.warn('Export-Initialisierung fehlgeschlagen:', err.message);
  }
}

/**
 * Belegt die Datumsfelder mit dem ältesten und neuesten QSO-Datum vor.
 *
 * @param {{ date_from: string|null, date_to: string|null }} range
 */
function _prefillDateRange(range) {
  if (range.date_from) document.getElementById('exp-date-from').value = range.date_from;
  if (range.date_to)   document.getElementById('exp-date-to').value   = range.date_to;
}

/**
 * Befüllt das Länder-Dropdown mit den vorhandenen Werten.
 *
 * @param {string[]} countries
 */
function _fillCountrySelect(countries) {
  const sel = document.getElementById('exp-country');
  countries.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

// ── Filter ────────────────────────────────────────────────────────────────────

/**
 * Liest die Filterfelder, fragt die API ab und rendert die Ergebnistabelle.
 */
export async function applyExportFilter() {
  const params = _buildFilterParams();
  _showExportState('loading');

  try {
    const data = await apiGet(`/api/qsl/export?${params}`);
    _currentQsos = data;

    if (data.length === 0) {
      _showExportState('empty');
      return;
    }

    _renderExportTable(data);
    _updateExportCount();
    _showExportState('table');
  } catch (err) {
    MDesign.Snackbar.show({ message: 'Fehler: ' + err.message, duration: 4000 });
    _showExportState('empty');
  }
}

/**
 * Setzt alle Filterfelder zurück und leert die Tabelle.
 */
export function resetExportFilter() {
  document.getElementById('exp-date-from').value = '';
  document.getElementById('exp-date-to').value   = '';
  document.getElementById('exp-band').value       = '';
  document.getElementById('exp-mode').value       = '';
  document.getElementById('exp-country').value    = '';
  _currentQsos = [];
  _showExportState('idle');
}

/**
 * Liest die Filterfelder und gibt einen URL-Query-String zurück.
 * Leere Felder werden weggelassen.
 *
 * @returns {string} z. B. 'date_from=2026-01-01&band=40m'
 */
function _buildFilterParams() {
  const fields = {
    date_from: document.getElementById('exp-date-from').value,
    date_to:   document.getElementById('exp-date-to').value,
    band:      document.getElementById('exp-band').value,
    mode:      document.getElementById('exp-mode').value,
    country:   document.getElementById('exp-country').value,
  };
  return Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

// ── Tabelle ───────────────────────────────────────────────────────────────────

/**
 * Steuert welcher Bereich im Export-Tab sichtbar ist.
 *
 * @param {'idle'|'loading'|'empty'|'table'} state
 */
function _showExportState(state) {
  document.getElementById('exp-idle').style.display    = state === 'idle'    ? 'flex' : 'none';
  document.getElementById('exp-loading').style.display = state === 'loading' ? 'flex' : 'none';
  document.getElementById('exp-empty').style.display   = state === 'empty'   ? 'flex' : 'none';
  document.getElementById('exp-table-wrap').style.display = state === 'table' ? 'block' : 'none';
}

/**
 * Rendert die Ergebnistabelle mit allen gefilterten QSOs.
 *
 * @param {Object[]} data
 */
function _renderExportTable(data) {
  const tbody = document.getElementById('exp-tbody');
  tbody.innerHTML = '';
  data.forEach(q => tbody.appendChild(_buildExportRow(q)));
}

/**
 * Erstellt eine <tr>-Zeile für die Export-Tabelle.
 * Die Checkbox ist standardmäßig aktiviert — Haken entfernen = vom Export ausschließen.
 *
 * @param {Object} q
 * @returns {HTMLTableRowElement}
 */
function _buildExportRow(q) {
  const tr = document.createElement('tr');
  tr.dataset.id = q.id;
  tr.innerHTML = `
    <td class="md-td md-text-center">
      <label class="md-checkbox-container" style="justify-content:center">
        <input type="checkbox" class="cb-export" checked
          onchange="updateExportCount()">
        <span></span>
      </label>
    </td>
    <td class="md-td" style="font-family:monospace;font-weight:700">
      <a href="https://www.qrz.com/db/${q.callsign}" target="_blank" rel="noopener"
         class="md-link">${q.callsign}</a>
    </td>
    <td class="md-td">${q.country ?? '—'}</td>
    <td class="md-td" style="font-family:monospace">${q.start_date ?? '—'}</td>
    <td class="md-td" style="font-family:monospace">${q.start_utc  ?? '—'}</td>
    <td class="md-td"><span class="md-chip md-chip-suggestion chip-band">${q.band ?? '—'}</span></td>
    <td class="md-td"><span class="md-chip md-chip-suggestion chip-mode">${q.mode ?? '—'}</span></td>
    <td class="md-td" style="font-family:monospace">${q.rst_sent ?? '—'}</td>`;
  return tr;
}

/**
 * Aktualisiert den Zähler unter der Tabelle (ausgewählte / gesamt).
 */
export function updateExportCount() {
  const total    = document.querySelectorAll('.cb-export').length;
  const selected = document.querySelectorAll('.cb-export:checked').length;
  document.getElementById('exp-count').textContent =
    `${selected} von ${total} QSOs zum Export ausgewählt`;
}

/** Alias für den initialen Aufruf nach dem Rendern. */
function _updateExportCount() { updateExportCount(); }

// ── ADIF-Export ───────────────────────────────────────────────────────────────

/**
 * Generiert eine ADIF-Datei aus den aktivierten Zeilen und löst den
 * Browser-Download aus. Es wird kein Server-Request benötigt — die
 * Daten liegen bereits in _currentQsos.
 */
export function downloadAdif() {
  const selectedIds = new Set(
    [...document.querySelectorAll('#exp-tbody tr')]
      .filter(tr => tr.querySelector('.cb-export')?.checked)
      .map(tr => parseInt(tr.dataset.id, 10))
  );

  const qsos = _currentQsos.filter(q => selectedIds.has(q.id));

  if (qsos.length === 0) {
    MDesign.Snackbar.show({ message: 'Keine QSOs ausgewählt', duration: 3000 });
    return;
  }

  const adif = _buildAdif(qsos);
  _triggerDownload(adif, _buildFilename());
  MDesign.Snackbar.show({ message: `✓ ${qsos.length} QSO(s) exportiert`, duration: 3000 });
}

/**
 * Baut den ADIF-String aus einer Liste von QSO-Objekten.
 *
 * @param {Object[]} qsos
 * @returns {string} Vollständiger ADIF-Inhalt
 */
function _buildAdif(qsos) {
  const lines = [
    'ADIF Export — Qlog-Tools',
    `<ADIF_VER:5>3.1.4`,
    `<PROGRAMID:10>Qlog-Tools`,
    '<EOH>',
    '',
  ];

  qsos.forEach(q => {
    const record = _buildAdifRecord(q);
    lines.push(record + '<EOR>', '');
  });

  return lines.join('\n');
}

/**
 * Baut einen einzelnen ADIF-Record aus einem QSO-Objekt.
 *
 * @param {Object} q
 * @returns {string}
 */
function _buildAdifRecord(q) {
  const fields = [];

  const adifField = (tag, value) => {
    if (!value) return;
    const v = String(value);
    fields.push(`<${tag}:${v.length}>${v}`);
  };

  adifField('CALL',     q.callsign);
  adifField('QSO_DATE', (q.start_date ?? '').replace(/-/g, ''));  // YYYYMMDD
  adifField('TIME_ON',  (q.start_utc  ?? '').replace(':', '') + '00');  // HHMMSS
  adifField('BAND',     q.band);
  adifField('MODE',     q.mode);
  adifField('RST_SENT', q.rst_sent);
  adifField('RST_RCVD', q.rst_rcvd);
  adifField('COUNTRY',  q.country);
  // QSL_RCVD steuert ob "TNX" (Y) oder "PSE" (N/leer) auf die Karte gedruckt wird
  adifField('QSL_RCVD',     q.qsl_rcvd ?? 'N');
  adifField('QSL_SENT',     'Q');
  adifField('QSL_SENT_VIA', 'B');

  return fields.join('\n');
}

/**
 * Generiert einen Dateinamen mit aktuellem Datum.
 *
 * @returns {string} z. B. 'qsl_export_2026-04-12.adif'
 */
function _buildFilename() {
  const date = new Date().toISOString().split('T')[0];
  return `qsl_export_${date}.adif`;
}

/**
 * Löst einen Browser-Download für einen Text-String aus.
 *
 * @param {string} content  — Dateiinhalt
 * @param {string} filename — Vorgeschlagener Dateiname
 */
function _triggerDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
