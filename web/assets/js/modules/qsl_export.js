/**
 * qsl_export.js — QSL-Export-Tab: Filtern, Vorschau, ADIF-Download.
 *
 * Zeigt QSOs mit qsl_sent='Q' und qsl_sent_via='B' (Bureau-Warteschlange).
 * Alle Filter sind optional. Die Tabelle lädt erst nach Klick auf "Anwenden".
 * Einzelne QSOs können per Checkbox vom Export ausgeschlossen werden.
 *
 * Beim Klick auf "ADIF herunterladen" öffnet sich ein Dialog mit zwei Optionen:
 *   - "Als gesendet markieren" (qsl_sent='Y' in der DB) — per Switch
 *   - Feldumfang: Minimal oder Erweitert                — per Radio-Button
 * Beide Einstellungen werden in LocalStorage gespeichert.
 *
 * Öffentliche API (via window.* in app.js exponiert):
 *   initExport()         — Lädt Länder-Dropdown beim ersten Tab-Öffnen
 *   applyExportFilter()  — Lädt gefilterte QSOs in die Tabelle
 *   resetExportFilter()  — Setzt Filter zurück und leert die Tabelle
 *   downloadAdif()       — Öffnet Export-Dialog
 *   updateExportCount()  — Aktualisiert Zähler (von onclick in HTML aufgerufen)
 */

import { apiGet, apiPut } from './api.js';
import { getExportExtendedFields } from './settings.js';

// ── Konstanten ────────────────────────────────────────────────────────────────

/** LocalStorage-Schlüssel für persistierte Dialog-Einstellungen. */
const LS_MARK_SENT = 'qlog_export_mark_sent';
const LS_SCOPE     = 'qlog_export_scope';

/** Gültige Werte für den Feldumfang. */
const SCOPE_MINIMAL  = 'minimal';
const SCOPE_EXTENDED = 'extended';

/**
 * Mapping von LocalStorage-Feldschlüsseln auf [ADIF-Tag, QSO-Eigenschaft].
 * Wird bei jedem ADIF-Record genutzt — als Modulkonstante einmalig erzeugt.
 *
 * Schlüssel: identisch mit den `key`-Werten in settings.js:EXPORT_FIELDS.
 */
const EXT_FIELD_MAP = {
  freq:       ['FREQ',       'freq'],
  rst_rcvd:   ['RST_RCVD',   'rst_rcvd'],
  comment:    ['COMMENT',    'comment'],
  notes:      ['NOTES',      'notes'],
  tx_pwr:     ['TX_PWR',     'tx_pwr'],
  my_rig:     ['MY_RIG',     'my_rig'],
  my_antenna: ['MY_ANTENNA', 'my_antenna'],
};

// ── Zustand ───────────────────────────────────────────────────────────────────

/** Aktuell geladene QSO-Liste (wird für den ADIF-Export genutzt). */
let _currentQsos = [];

/** Verhindert mehrfaches Laden der Länderliste. */
let _countriesLoaded = false;

/** Einmalig registrierter Dialog-Listener. */
let _dialogInitialized = false;

// ── Initialisierung ───────────────────────────────────────────────────────────

/**
 * Lädt Länderliste und Datumsbereich einmalig beim ersten Öffnen des Export-Tabs.
 * Beide Requests laufen parallel (Promise.all).
 */
export async function initExport() {
  if (_countriesLoaded) return;
  _initDialog();
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
 * Registriert die Button-Listener im Export-Dialog (einmalig).
 * Lädt außerdem gespeicherte Einstellungen aus LocalStorage in die Steuerelemente.
 */
function _initDialog() {
  if (_dialogInitialized) return;
  _dialogInitialized = true;

  document.getElementById('exp-dlg-cancel').addEventListener('click', () => {
    MDesign.Dialog.close('#export-options-dialog');
  });

  document.getElementById('exp-dlg-confirm').addEventListener('click', () => {
    _onDialogConfirm();
  });

  // Einstellungen aus LocalStorage laden
  const markSent = localStorage.getItem(LS_MARK_SENT) !== 'false';  // default: true
  const scope    = localStorage.getItem(LS_SCOPE) ?? SCOPE_MINIMAL;

  document.getElementById('exp-dlg-mark-sent').checked = markSent;
  document.getElementById(
    scope === SCOPE_EXTENDED ? 'exp-dlg-scope-extended' : 'exp-dlg-scope-minimal'
  ).checked = true;
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
    updateExportCount();
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
 * Wird sowohl intern (nach Render) als auch vom onclick im HTML aufgerufen.
 */
export function updateExportCount() {
  const total    = document.querySelectorAll('.cb-export').length;
  const selected = document.querySelectorAll('.cb-export:checked').length;
  document.getElementById('exp-count').textContent =
    `${selected} von ${total} QSOs zum Export ausgewählt`;
}

// ── ADIF-Dialog ───────────────────────────────────────────────────────────────

/**
 * Öffnet den Export-Dialog. Wird bei Klick auf "ADIF herunterladen" aufgerufen.
 * Prüft vorher ob überhaupt QSOs ausgewählt sind.
 */
export function downloadAdif() {
  const selectedIds = _getSelectedIds();

  if (selectedIds.size === 0) {
    MDesign.Snackbar.show({ message: 'Keine QSOs ausgewählt', duration: 3000 });
    return;
  }

  MDesign.Dialog.open('#export-options-dialog');
}

/**
 * Wird beim Klick auf "Exportieren" im Dialog ausgeführt.
 * Liest Dialog-Einstellungen, speichert sie, schließt den Dialog
 * und führt den Export durch.
 */
async function _onDialogConfirm() {
  const markSent = document.getElementById('exp-dlg-mark-sent').checked;
  const scope    = document.querySelector('input[name="exp-dlg-scope"]:checked')?.value
                   ?? SCOPE_MINIMAL;

  // Präferenzen für künftige Sitzungen speichern
  localStorage.setItem(LS_MARK_SENT, String(markSent));
  localStorage.setItem(LS_SCOPE,     scope);

  MDesign.Dialog.close('#export-options-dialog');

  const selectedIds = _getSelectedIds();
  const qsos        = _currentQsos.filter(q => selectedIds.has(q.id));

  if (qsos.length === 0) return;  // Kann nach Dialog-Schließen nicht mehr passieren, aber sicher ist sicher

  // ADIF-Datei generieren und herunterladen
  const adif = _buildAdif(qsos, scope);
  _triggerDownload(adif, _buildFilename());

  // Optional: QSOs in DB als gesendet markieren
  if (markSent) {
    await _markSentInDb(qsos.map(q => q.id));
  }

  MDesign.Snackbar.show({ message: `✓ ${qsos.length} QSO(s) exportiert`, duration: 3000 });
}

/**
 * Gibt die IDs aller aktuell angehakten Tabellenzeilen als Set zurück.
 *
 * @returns {Set<number>}
 */
function _getSelectedIds() {
  return new Set(
    [...document.querySelectorAll('#exp-tbody tr')]
      .filter(tr => tr.querySelector('.cb-export')?.checked)
      .map(tr => parseInt(tr.dataset.id, 10))
  );
}

/**
 * Ruft PUT /api/qsl/mark_sent auf und setzt qsl_sent='Y' für die exportierten QSOs.
 * Fehler werden im Snackbar angezeigt, brechen den Export aber nicht ab.
 *
 * @param {number[]} ids
 */
async function _markSentInDb(ids) {
  const date = new Date().toISOString().split('T')[0];
  try {
    await apiPut('/api/qsl/mark_sent', { ids, date });
  } catch (err) {
    MDesign.Snackbar.show({
      message: 'DB-Markierung fehlgeschlagen: ' + err.message,
      duration: 5000,
    });
  }
}

// ── ADIF-Generierung ──────────────────────────────────────────────────────────

/**
 * Baut den ADIF-String aus einer Liste von QSO-Objekten.
 *
 * @param {Object[]} qsos
 * @param {'minimal'|'extended'} scope
 * @returns {string} Vollständiger ADIF-Inhalt
 */
function _buildAdif(qsos, scope) {
  const lines = [
    'ADIF Export — Qlog-Tools',
    `<ADIF_VER:5>3.1.4`,
    `<PROGRAMID:10>Qlog-Tools`,
    '<EOH>',
    '',
  ];

  qsos.forEach(q => {
    lines.push(_buildAdifRecord(q, scope), '<EOR>', '');
  });

  return lines.join('\n');
}

/**
 * Baut einen einzelnen ADIF-Record aus einem QSO-Objekt.
 *
 * Feldumfang:
 *   Minimal:   CALL, QSO_DATE, TIME_ON, BAND, MODE, RST_SENT,
 *              QSL_RCVD, QSL_SENT, QSL_SENT_VIA
 *   Erweitert: + FREQ, RST_RCVD, COMMENT, NOTES, TX_PWR, MY_RIG, MY_ANTENNA
 *
 * QSL_RCVD steuert ob "TNX" (Y) oder "PSE" (N/leer) auf die Karte gedruckt wird.
 *
 * @param {Object} q
 * @param {'minimal'|'extended'} scope
 * @returns {string}
 */
function _buildAdifRecord(q, scope) {
  const fields = [];

  const adifField = (tag, value) => {
    if (value == null || value === '') return;
    const v = String(value);
    fields.push(`<${tag}:${v.length}>${v}`);
  };

  // ── Pflichtfelder (Minimal) ───────────────────────────────────────────────
  adifField('CALL',        q.callsign);
  adifField('QSO_DATE',    (q.start_date ?? '').replace(/-/g, ''));   // YYYYMMDD
  adifField('TIME_ON',     (q.start_utc  ?? '').replace(':', '') + '00'); // HHMMSS
  adifField('BAND',        q.band);
  // Wenn Unterbetriebsart vorhanden, diese als MODE exportieren (z. B. FT8 statt MFSK)
  adifField('MODE',        q.submode || q.mode);
  adifField('RST_SENT',    q.rst_sent);
  // QSL_RCVD=Y → "TNX" gedruckt; N/leer → "PSE" (Quelle: qslshop.de)
  adifField('QSL_RCVD',    q.qsl_rcvd ?? 'N');
  adifField('QSL_SENT',    'Q');
  adifField('QSL_SENT_VIA','B');

  // ── Erweiterte Felder (konfigurierbar in den Einstellungen) ──────────────
  if (scope === SCOPE_EXTENDED) {
    // Aktive Felder aus LocalStorage lesen — immer aktuell, kein Server-Call nötig
    getExportExtendedFields().forEach(key => {
      const entry = EXT_FIELD_MAP[key];
      // entry[0] = ADIF-Tag, entry[1] = DB-Feldname → Wert aus QSO-Objekt lesen
      if (entry) adifField(entry[0], q[entry[1]]);
    });
  }

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
