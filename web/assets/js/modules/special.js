/**
 * special.js — Sonderrufzeichen-Panel
 *
 * Zeigt alle QSOs mit Sonderrufzeichen (Suffix > 3 Buchstaben oder
 * mehrere Ziffern im Distrikt, z.B. DL75DARC, DA0IARU, DL2025W).
 *
 * Filter: Zeitraum, Band, Mode — werden über /api/stats/filters befüllt.
 * Tabelle lädt erst nach Klick auf "Anwenden" oder beim ersten Panel-Öffnen.
 *
 * Öffentliche API (via window.* in app.js exponiert):
 *   initSpecial()              — Lädt Filter-Dropdowns und erste Daten
 *   applySpecialFilter()       — Lädt gefilterte Sonderrufzeichen
 *   resetSpecialFilter()       — Setzt Filter zurück und lädt neu
 */

import { apiGet } from './api.js';

// ── State ─────────────────────────────────────────────────────────────────────

let _filtersLoaded = false;

// ── Öffentliche API ───────────────────────────────────────────────────────────

export async function initSpecial() {
  if (!_filtersLoaded) {
    await _loadFilterOptions();
    _filtersLoaded = true;
  }
  await _load();
}

export async function applySpecialFilter() {
  await _load();
}

export async function resetSpecialFilter() {
  document.getElementById('sp-date-from').value = '';
  document.getElementById('sp-date-to').value   = '';
  document.getElementById('sp-band').value       = '';
  document.getElementById('sp-mode').value       = '';
  await _load();
}

// ── Interne Funktionen ────────────────────────────────────────────────────────

async function _loadFilterOptions() {
  try {
    const data = await apiGet('/api/stats/filters');
    if (!data) return;

    if (data.date_from) document.getElementById('sp-date-from').value = data.date_from;
    if (data.date_to)   document.getElementById('sp-date-to').value   = data.date_to;

    const bandSel = document.getElementById('sp-band');
    const modeSel = document.getElementById('sp-mode');
    data.bands.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b; opt.textContent = b;
      bandSel.appendChild(opt);
    });
    data.modes.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = m;
      modeSel.appendChild(opt);
    });
  } catch (err) {
    console.warn('Special-Filter-Initialisierung fehlgeschlagen:', err.message);
  }
}

async function _load() {
  _setState('loading');

  const params = _buildParams();
  try {
    const rows = await apiGet('/api/special/list' + params);
    if (!rows || rows.length === 0) {
      _setState('empty');
      return;
    }
    _render(rows);
    _setState('results');
  } catch (err) {
    MDesign.Snackbar.show({ message: 'Fehler: ' + err.message, duration: 4000 });
    _setState('empty');
  }
}

function _buildParams() {
  const from = document.getElementById('sp-date-from').value;
  const to   = document.getElementById('sp-date-to').value;
  const band = document.getElementById('sp-band').value;
  const mode = document.getElementById('sp-mode').value;
  const p = new URLSearchParams();
  if (from) p.set('date_from', from);
  if (to)   p.set('date_to',   to);
  if (band) p.set('band',      band);
  if (mode) p.set('mode',      mode);
  const qs = p.toString();
  return qs ? '?' + qs : '';
}

function _render(rows) {
  const tbody = document.getElementById('sp-tbody');
  tbody.innerHTML = '';
  rows.forEach(r => tbody.appendChild(_buildRow(r)));
  document.getElementById('sp-count').textContent =
    `${rows.length.toLocaleString('de-DE')} Sonderrufzeichen`;
}

function _buildRow(r) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="font-family:monospace;font-weight:600">
      <a href="https://www.qrz.com/db/${_esc(r.callsign)}" target="_blank" rel="noopener"
         class="md-link">${_esc(r.callsign ?? '—')}</a>
    </td>
    <td style="font-family:monospace">${r.start_date ?? '—'}</td>
    <td style="font-family:monospace">${r.start_utc  ?? '—'}</td>
    <td><span class="md-chip md-chip-suggestion chip-band">${_esc(r.band ?? '—')}</span></td>
    <td><span class="md-chip md-chip-suggestion chip-mode">${_esc(r.mode ?? '—')}</span></td>
    <td>${_esc(r.country ?? '—')}</td>
    <td>${_qslBadges(r.qsl_rcvd, r.qsl_sent)}</td>`;
  return tr;
}

function _qslBadges(rcvd, sent) {
  const parts = [];
  if (rcvd && rcvd !== 'N') parts.push(`<span class="md-chip md-chip-suggestion ${_rcvdClass(rcvd)}">${_rcvdLabel(rcvd)}</span>`);
  if (sent && sent !== 'N') parts.push(`<span class="md-chip md-chip-suggestion ${_sentClass(sent)}">${_sentLabel(sent)}</span>`);
  return parts.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap">${parts.join('')}</div>` : '—';
}

function _rcvdClass(v) {
  return { Y: 'qsl-badge-yes', R: 'qsl-badge-requested', V: 'qsl-badge-verified', I: 'qsl-badge-ignored' }[v] ?? '';
}
function _sentClass(v) {
  return { Y: 'qsl-badge-yes', R: 'qsl-badge-requested', Q: 'qsl-badge-requested', I: 'qsl-badge-ignored' }[v] ?? '';
}
function _rcvdLabel(v) {
  return { Y: 'Rcvd', R: 'Req', V: 'LoTW', I: 'Ign' }[v] ?? v;
}
function _sentLabel(v) {
  return { Y: 'Sent', R: 'Req', Q: 'Queue', I: 'Ign' }[v] ?? v;
}

function _setState(state) {
  const map = {
    loading: document.getElementById('sp-loading'),
    empty:   document.getElementById('sp-empty'),
    results: document.getElementById('sp-results'),
  };
  Object.entries(map).forEach(([key, el]) => {
    if (el) el.style.display = key === state ? (key === 'results' ? 'block' : 'flex') : 'none';
  });
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
