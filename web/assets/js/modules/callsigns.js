/**
 * callsigns.js — Rufzeichen-Suche
 *
 * Sucht alle QSOs für ein (Teil-)Rufzeichen und zeigt sie in einer
 * Detailtabelle: Rufzeichen · Datum · Zeit UTC · Band · Mode · Land ·
 * RST Rcvd · QSL-Status
 *
 * Öffentliche API (window.* in app.js):
 *   doCallsignSearch()       — Suche starten (Enter oder Button)
 *   clearCallsignSearch()    — Suche leeren
 *   toggleCallsignSearchMode(btn) — Partial ↔ Beginning umschalten
 */

import { apiGet } from './api.js';

// ── State ─────────────────────────────────────────────────────────────────────

let _searchMode    = 'partial';   // 'partial' | 'beginning'
let _filtersLoaded = false;

// ── Öffentliche API ───────────────────────────────────────────────────────────

export async function initCallsigns() {
  // Enter-Taste im Suchfeld
  const input = document.getElementById('cs-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') doCallsignSearch();
    });
  }

  // Band/Mode-Dropdowns einmalig befüllen
  if (!_filtersLoaded) {
    const data = await apiGet('/api/stats/filters');
    if (data) {
      const bandSel = document.getElementById('cs-filter-band');
      const modeSel = document.getElementById('cs-filter-mode');
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
    }
    _filtersLoaded = true;
  }
}

export async function doCallsignSearch() {
  const q = document.getElementById('cs-input').value.trim().toUpperCase();
  if (!q) return;

  const band = document.getElementById('cs-filter-band').value;
  const mode = document.getElementById('cs-filter-mode').value;

  _setState('loading');

  const params = new URLSearchParams({ q, search_mode: _searchMode });
  if (band) params.set('band', band);
  if (mode) params.set('mode', mode);

  const rows = await apiGet('/api/callsigns/search?' + params.toString());

  if (!rows) {
    _setState('error');
    return;
  }

  _renderResults(q, rows);
}

export function clearCallsignSearch() {
  document.getElementById('cs-input').value = '';
  _setState('idle');
}

export function toggleCallsignSearchMode(btn) {
  _searchMode = _searchMode === 'partial' ? 'beginning' : 'partial';
  // Label und Icon tauschen
  const icon  = btn.querySelector('.md-icon');
  const label = btn.querySelector('.cs-mode-label');
  if (_searchMode === 'beginning') {
    if (icon)  icon.textContent  = 'align_horizontal_left';
    if (label) label.textContent = 'Anfang';
    btn.title = 'Suche: beginnt mit … (klicken für Teilstring)';
  } else {
    if (icon)  icon.textContent  = 'manage_search';
    if (label) label.textContent = 'Teilstring';
    btn.title = 'Suche: Teilstring (klicken für Anfang)';
  }
  // Neue Suche starten wenn bereits Ergebnisse vorhanden
  const q = document.getElementById('cs-input').value.trim();
  if (q) doCallsignSearch();
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function _renderResults(q, rows) {
  // Kopfzeile
  document.getElementById('cs-result-call').textContent  = q;
  document.getElementById('cs-result-count').textContent =
    rows.length === 500 ? '500+ QSOs' : `${rows.length} QSO${rows.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('cs-tbody');
  tbody.innerHTML = '';

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px">
      <span class="md-text-muted md-body-medium">Keine QSOs gefunden</span>
    </td></tr>`;
  } else {
    rows.forEach(r => tbody.appendChild(_buildRow(r)));
  }

  _setState('results');
}

function _buildRow(r) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="font-family:monospace;font-weight:600">${_esc(r.callsign ?? '—')}</td>
    <td style="font-family:monospace">${r.start_date ?? '—'}</td>
    <td style="font-family:monospace">${r.start_utc  ?? '—'}</td>
    <td><span class="md-chip md-chip-suggestion chip-band">${_esc(r.band ?? '—')}</span></td>
    <td><span class="md-chip md-chip-suggestion chip-mode">${_esc(r.mode ?? '—')}</span></td>
    <td>${_esc(r.country ?? '—')}</td>
    <td style="font-family:monospace">${_esc(r.rst_rcvd ?? '—')}</td>
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

// ── UI-Zustand ────────────────────────────────────────────────────────────────

function _setState(state) {
  const els = {
    idle:    document.getElementById('cs-idle'),
    loading: document.getElementById('cs-loading'),
    error:   document.getElementById('cs-error'),
    results: document.getElementById('cs-results'),
  };
  Object.entries(els).forEach(([key, el]) => {
    if (el) el.style.display = key === state ? (key === 'results' ? 'block' : 'flex') : 'none';
  });
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
