/**
 * Start-Panel: letzte 20 QSOs laden und anzeigen.
 */

import { apiGet } from './api.js';

function qslBadge(val) {
  if (!val || val === 'N') return '<span class="md-chip" style="opacity:0.4">—</span>';
  const colors = {
    Y: 'background:color-mix(in srgb,#22c55e 20%,transparent);color:#16a34a',
    R: 'background:color-mix(in srgb,#f59e0b 20%,transparent);color:#d97706',
    Q: 'background:color-mix(in srgb,#f59e0b 20%,transparent);color:#d97706',
    V: 'background:color-mix(in srgb,#6750A4 20%,transparent);color:#6750A4',
    I: 'background:color-mix(in srgb,#6b7280 20%,transparent);color:#6b7280',
  };
  return `<span class="md-chip" style="${colors[val] || ''}">${val}</span>`;
}

export async function loadRecentQsos() {
  const loading   = document.getElementById('start-loading');
  const empty     = document.getElementById('start-empty');
  const errorEl   = document.getElementById('start-error');
  const tableWrap = document.getElementById('start-table-wrap');

  loading.style.display   = 'flex';
  empty.style.display     = 'none';
  errorEl.style.display   = 'none';
  tableWrap.style.display = 'none';

  try {
    const data = await apiGet('/api/dashboard/recent');

    loading.style.display = 'none';

    if (data.length === 0) { empty.style.display = 'flex'; return; }

    const tbody = document.getElementById('start-tbody');
    tbody.innerHTML = '';
    data.forEach(q => {
      const dt   = q.start_time ? q.start_time.split(' ') : ['—', ''];
      const date = dt[0] ?? '—';
      const time = dt[1] ? dt[1].slice(0, 5) : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="md-td" style="font-family:monospace;font-weight:700">${q.callsign}</td>
        <td class="md-td" style="font-family:monospace">${date}<span class="col-time md-text-muted" style="font-size:11px;display:none"><br>${time}</span></td>
        <td class="md-td col-time" style="font-family:monospace">${time || '—'}</td>
        <td class="md-td"><span class="md-chip md-chip-suggestion chip-band">${q.band ?? '—'}</span></td>
        <td class="md-td"><span class="md-chip md-chip-suggestion chip-mode">${q.mode ?? '—'}</span></td>
        <td class="md-td col-rst" style="font-family:monospace">${q.rst_sent ?? '—'}</td>
        <td class="md-td col-rst" style="font-family:monospace">${q.rst_rcvd ?? '—'}</td>
        <td class="md-td md-text-center">${qslBadge(q.qsl_rcvd)}</td>
        <td class="md-td md-text-center">${qslBadge(q.qsl_sent)}</td>`;
      tbody.appendChild(tr);
    });

    tableWrap.style.display = 'block';

  } catch (err) {
    loading.style.display = 'none';
    document.getElementById('start-error-msg').textContent =
      'Verbindung fehlgeschlagen: ' + err.message;
    errorEl.style.display = 'flex';
  }
}
