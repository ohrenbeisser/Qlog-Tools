/**
 * stats.js — Statistik-Panel
 *
 * Aufgaben:
 *   - Filter-Dropdowns mit echten Band/Mode-Werten befüllen (einmalig)
 *   - Summary-Kacheln laden (/api/stats/summary)
 *   - Statistik-Daten laden (/api/stats/by/<type>)
 *   - Rang-Tabelle mit Inline-Balken rendern
 *   - Chart.js-Balkendiagramm rendern (horizontal bei >12 Einträgen)
 *   - Zeilenklick → Tabellenzeile + Chart-Balken hervorheben
 *
 * Chart.js wird als globales Skript über <script src="...chart.min.js"> geladen
 * (kein ES-Modul-Import möglich für UMD-Bundles ohne Bundler).
 */

import { apiGet } from './api.js';

// ── Konfiguration je Typ ──────────────────────────────────────────────────────

const TYPE_CONFIG = {
  country:  {
    endpoint:   '/api/stats/by/country',
    tableTitle: 'Länder nach QSO-Anzahl',
    badge:      n => `${n} Länder`,
    chartTitle: 'Top 20 Länder',
    chartSub:   'nach QSO-Anzahl',
    colHeader:  'Land',
    chartLimit: 20,
  },
  band: {
    endpoint:   '/api/stats/by/band',
    tableTitle: 'Bänder nach QSO-Anzahl',
    badge:      n => `${n} Bänder`,
    chartTitle: 'Bänder',
    chartSub:   'nach QSO-Anzahl',
    colHeader:  'Band',
    chartLimit: 20,
  },
  mode: {
    endpoint:   '/api/stats/by/mode',
    tableTitle: 'Betriebsarten',
    badge:      n => `${n} Modes`,
    chartTitle: 'Betriebsarten',
    chartSub:   'nach QSO-Anzahl',
    colHeader:  'Mode',
    chartLimit: 20,
  },
  year: {
    endpoint:   '/api/stats/by/year',
    tableTitle: 'Jahre',
    badge:      n => `${n} Jahre`,
    chartTitle: 'QSOs nach Jahr',
    chartSub:   'chronologisch',
    colHeader:  'Jahr',
    chartLimit: 20,
  },
  month: {
    endpoint:   '/api/stats/by/month',
    tableTitle: 'Monate',
    badge:      n => `${n} Monate`,
    chartTitle: 'QSOs nach Monat',
    chartSub:   'neueste zuerst',
    colHeader:  'Monat',
    chartLimit: 24,
  },
  weekday: {
    endpoint:   '/api/stats/by/weekday',
    tableTitle: 'QSOs nach Wochentag',
    badge:      n => `${n} Tage`,
    chartTitle: 'Wochentage',
    chartSub:   'Montag – Sonntag',
    colHeader:  'Wochentag',
    chartLimit: 7,
  },
  hour: {
    endpoint:   '/api/stats/by/hour',
    tableTitle: 'QSOs nach Stunde (UTC)',
    badge:      n => `${n} Stunden`,
    chartTitle: 'Tagesverteilung',
    chartSub:   'Stunden UTC',
    colHeader:  'Stunde UTC',
    chartLimit: 24,
  },
  callsign: {
    endpoint:   '/api/stats/by/callsign',
    tableTitle: 'Rufzeichen nach QSO-Anzahl',
    badge:      n => `${n} Rufzeichen`,
    chartTitle: 'Top 20 Rufzeichen',
    chartSub:   'nach QSO-Anzahl',
    colHeader:  'Rufzeichen',
    chartLimit: 20,
  },
};

// ── Modul-State ───────────────────────────────────────────────────────────────

let _currentType    = 'country';
let _chartInstance  = null;
let _filtersLoaded  = false;
let _currentData    = [];

// ── Öffentliche API ───────────────────────────────────────────────────────────

/**
 * Wird von panelCallbacks.stats aufgerufen wenn das Panel geöffnet wird.
 * Lädt Filter-Dropdowns einmalig und danach die Standard-Statistik.
 */
export async function initStats() {
  if (!_filtersLoaded) {
    await _loadFilterOptions();
    _filtersLoaded = true;
  }
  await _loadStats(_currentType);
}

/**
 * Chip-Klick: Typ wechseln.
 * Wird global als window.selectStatsType exponiert.
 */
export async function selectStatsType(type, btn) {
  _currentType = type;
  document.querySelectorAll('.stats-chips .md-chip').forEach(c =>
    c.classList.remove('stats-chip-active')
  );
  btn.classList.add('stats-chip-active');
  await _loadStats(type);
}

/**
 * "Anwenden"-Button.
 */
export async function applyStatsFilter() {
  _updateFilterSubtitle();
  await _loadStats(_currentType);
}

/**
 * "Zurücksetzen"-Button.
 */
export async function resetStatsFilter() {
  document.getElementById('stats-filter-from').value  = '';
  document.getElementById('stats-filter-to').value    = '';
  document.getElementById('stats-filter-band').value  = '';
  document.getElementById('stats-filter-mode').value  = '';
  _updateFilterSubtitle();
  await _loadStats(_currentType);
}

// ── Interne Funktionen ────────────────────────────────────────────────────────

async function _loadFilterOptions() {
  const data = await apiGet('/api/stats/filters');
  if (!data) return;

  // Datumsfelder mit erstem/letztem QSO-Datum vorbelegen
  if (data.date_from) document.getElementById('stats-filter-from').value = data.date_from;
  if (data.date_to)   document.getElementById('stats-filter-to').value   = data.date_to;

  const bandSel = document.getElementById('stats-filter-band');
  const modeSel = document.getElementById('stats-filter-mode');

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

async function _loadStats(type) {
  _setLoading(true);

  const params = _buildParams(type);
  const cfg    = TYPE_CONFIG[type];

  // Summary-Kacheln und Statistik-Daten parallel laden
  const [summary, rows] = await Promise.all([
    apiGet('/api/stats/summary' + params),
    apiGet(cfg.endpoint + params),
  ]);

  _setLoading(false);

  if (!rows) {
    _showEmpty();
    return;
  }

  _currentData = rows;

  // Kacheln
  if (summary) {
    document.getElementById('kachel-qsos').textContent      = summary.total_qsos.toLocaleString('de-DE');
    document.getElementById('kachel-countries').textContent = summary.total_countries;
    document.getElementById('kachel-bands').textContent     = summary.total_bands;
    document.getElementById('kachel-modes').textContent     = summary.total_modes;
  }

  // Tabellen-Header
  document.getElementById('stats-table-title').textContent = cfg.tableTitle;
  document.getElementById('stats-table-badge').textContent = cfg.badge(rows.length);
  document.getElementById('stats-col-header').textContent  = cfg.colHeader;

  // Chart-Header
  document.getElementById('stats-chart-title').textContent = cfg.chartTitle;
  document.getElementById('stats-chart-sub').textContent   = cfg.chartSub;

  _renderTable(rows, cfg);
  _renderChart(rows, cfg);
}

function _buildParams(type) {
  const from = document.getElementById('stats-filter-from').value;
  const to   = document.getElementById('stats-filter-to').value;
  const band = type === 'band' ? '' : document.getElementById('stats-filter-band').value;
  const mode = type === 'mode' ? '' : document.getElementById('stats-filter-mode').value;

  const p = new URLSearchParams();
  if (from) p.set('date_from', from);
  if (to)   p.set('date_to',   to);
  if (band) p.set('band',      band);
  if (mode) p.set('mode',      mode);

  const qs = p.toString();
  return qs ? '?' + qs : '';
}

function _renderTable(rows, cfg) {
  const tbody  = document.getElementById('stats-tbody');
  tbody.innerHTML = '';
  const maxVal = rows.length > 0 ? rows[0].count : 1;

  rows.forEach((row, i) => {
    const pct = Math.round((row.count / maxVal) * 100);
    const tr  = document.createElement('tr');
    tr.innerHTML = `
      <td class="stats-rank">${i + 1}</td>
      <td>${_esc(row.label)}</td>
      <td>
        <div class="stats-bar-wrap">
          <div class="stats-bar-track">
            <div class="stats-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="stats-bar-count">${row.count.toLocaleString('de-DE')}</span>
        </div>
      </td>`;
    tr.addEventListener('click', () => _highlightRow(tr, i, cfg));
    tbody.appendChild(tr);
  });
}

function _highlightRow(tr, idx, cfg) {
  // Tabellenzeile
  document.querySelectorAll('#stats-tbody tr').forEach(r =>
    r.classList.remove('stats-row-active')
  );
  tr.classList.add('stats-row-active');

  // Chart-Balken: ausgewählten hervorheben, rest dimmen
  if (!_chartInstance) return;
  const limit  = Math.min(cfg.chartLimit, _currentData.length);
  if (idx >= limit) return;

  const primary = _getCSSVar('--md-primary', '#6750A4');
  _chartInstance.data.datasets[0].backgroundColor = Array.from(
    { length: limit },
    (_, i) => i === idx ? primary : _primaryAlpha(0.45)
  );
  _chartInstance.update('none');
}

function _renderChart(rows, cfg) {
  const canvas = document.getElementById('stats-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Farben aus aktuellem Theme
  const primary    = _getCSSVar('--md-primary', '#6750A4');
  const primaryMid = _primaryAlpha(0.55);
  const textColor  = _getCSSVar('--md-on-surface', '#1C1B1F');
  const gridColor  = _getCSSVar('--md-outline-variant', '#CAC4D0');
  const tooltipBg  = _getCSSVar('--md-surface-container-high', '#ECE6F0');

  const limit  = Math.min(cfg.chartLimit, rows.length);
  const sliced = rows.slice(0, limit);
  const labels = sliced.map(r => r.label);
  const values = sliced.map(r => r.count);

  if (_chartInstance) {
    _chartInstance.destroy();
    _chartInstance = null;
  }

  // Horizontal bei vielen Labels (Länder, Rufzeichen, Monate), sonst vertikal
  const isHorizontal = limit > 12;

  // Canvas-Container-Höhe dynamisch anpassen
  const body = canvas.parentElement;
  body.style.minHeight = isHorizontal
    ? Math.max(320, limit * 22) + 'px'
    : '320px';

  _chartInstance = new Chart(ctx, {   // Chart ist globales UMD-Objekt
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data:            values,
        backgroundColor: Array(limit).fill(primaryMid),
        borderRadius:    4,
        borderSkipped:   false,
      }],
    },
    options: {
      indexAxis:  isHorizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor:      textColor,
          bodyColor:       textColor,
          borderColor:     gridColor,
          borderWidth:     1,
          padding:         10,
          cornerRadius:    8,
          callbacks: {
            label: ctx => ` ${ctx.parsed[isHorizontal ? 'x' : 'y'].toLocaleString('de-DE')} QSOs`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: textColor,
            font:  { size: 11 },
            maxRotation: isHorizontal ? 0 : 35,
            callback: isHorizontal
              ? v => v.toLocaleString('de-DE')
              : undefined,
          },
          grid: { color: isHorizontal ? gridColor : 'transparent' },
        },
        y: {
          ticks: {
            color: textColor,
            font:  { size: 11 },
            callback: isHorizontal
              ? undefined
              : v => v.toLocaleString('de-DE'),
          },
          grid: { color: isHorizontal ? 'transparent' : gridColor },
        },
      },
    },
  });
}

// ── UI-Helpers ────────────────────────────────────────────────────────────────

function _setLoading(on) {
  const loading = document.getElementById('stats-loading');
  const content = document.getElementById('stats-content');
  if (loading) loading.style.display = on ? 'flex' : 'none';
  if (content) content.style.display = on ? 'none'  : 'block';
}

function _showEmpty() {
  document.getElementById('stats-tbody').innerHTML =
    `<tr><td colspan="3" class="stats-empty">
       <span class="md-icon">inbox</span>
       <span>Keine Daten gefunden</span>
     </td></tr>`;
}

function _updateFilterSubtitle() {
  const from = document.getElementById('stats-filter-from').value;
  const to   = document.getElementById('stats-filter-to').value;
  const band = document.getElementById('stats-filter-band').value;
  const mode = document.getElementById('stats-filter-mode').value;
  const parts = [];
  if (from || to) parts.push(`${from || '…'} – ${to || '…'}`);
  if (band) parts.push(band);
  if (mode) parts.push(mode);
  const sub = document.getElementById('stats-filter-subtitle');
  if (sub) sub.textContent = parts.length ? parts.join(' · ') : 'Alle QSOs · keine Filter aktiv';
}

// ── Theme-Helpers ─────────────────────────────────────────────────────────────

function _getCSSVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function _primaryAlpha(alpha) {
  return `color-mix(in srgb, ${_getCSSVar('--md-primary', '#6750A4')} ${Math.round(alpha * 100)}%, transparent)`;
}

// ── Sicherheits-Helper ────────────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
