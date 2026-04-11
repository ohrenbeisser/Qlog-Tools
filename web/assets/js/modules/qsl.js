/**
 * QSL-Panel: Rufzeichen suchen, QSOs anzeigen, QSL-Status eintragen.
 */

import { apiGet, apiPut } from './api.js';

export function initQsl() {
  document.getElementById('date-input').value = new Date().toISOString().split('T')[0];
}

export async function doSearch() {
  const call = document.getElementById('callsign-input').value.trim().toUpperCase();
  if (!call) return;

  document.getElementById('empty-state').style.display  = 'none';
  document.getElementById('result-area').style.display  = 'none';

  try {
    const data = await apiGet(`/api/qsl/search?call=${encodeURIComponent(call)}`);

    document.getElementById('result-title').textContent = `QSOs mit ${call}`;
    document.getElementById('result-count').textContent = data.length;

    const tbody = document.getElementById('qso-tbody');
    tbody.innerHTML = '';

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px">
        <span class="md-text-muted md-body-medium">Keine QSOs gefunden</span></td></tr>`;
    } else {
      data.forEach(q => {
        const dt   = q.start_time ? q.start_time.split(' ') : ['—', ''];
        const date = dt[0] ?? '—';
        const time = dt[1] ? dt[1].slice(0, 5) : '—';
        const alreadyRcvd = q.qsl_rcvd === 'Y';
        const alreadySent = q.qsl_sent === 'Y';
        const tr = document.createElement('tr');
        if (alreadyRcvd && alreadySent) tr.classList.add('row-confirmed');
        tr.dataset.id = q.id;
        tr.innerHTML = `
          <td class="md-td" style="font-family:monospace">${date}<span class="col-time md-text-muted" style="font-size:11px;display:none"><br>${time}</span></td>
          <td class="md-td col-time" style="font-family:monospace">${time}</td>
          <td class="md-td"><span class="md-chip md-chip-suggestion chip-band">${q.band ?? '—'}</span></td>
          <td class="md-td"><span class="md-chip md-chip-suggestion chip-mode">${q.mode ?? '—'}</span></td>
          <td class="md-td col-rst" style="font-family:monospace">${q.rst_sent ?? '—'}</td>
          <td class="md-td col-rst" style="font-family:monospace">${q.rst_rcvd ?? '—'}</td>
          <td class="md-td md-text-center">
            <label class="md-checkbox-container" style="justify-content:center">
              <input type="checkbox" class="cb-rcvd" ${alreadyRcvd ? 'checked disabled' : ''}
                onchange="updateCount(); highlightRow(this)">
              <span></span>
            </label>
          </td>
          <td class="md-td md-text-center">
            <label class="md-checkbox-container" style="justify-content:center">
              <input type="checkbox" class="cb-sent" ${alreadySent ? 'checked disabled' : ''}
                onchange="updateCount(); highlightRow(this)">
              <span></span>
            </label>
          </td>`;
        tbody.appendChild(tr);
      });
    }

    document.getElementById('check-all-rcvd').checked = false;
    document.getElementById('check-all-sent').checked = false;
    updateCount();
    document.getElementById('result-area').style.display = 'block';

  } catch (err) {
    MDesign.Snackbar.show({ message: 'Fehler: ' + err.message, duration: 4000 });
    document.getElementById('empty-state').style.display = 'flex';
  }
}

export function clearSearch() {
  document.getElementById('callsign-input').value = '';
  document.getElementById('result-area').style.display  = 'none';
  document.getElementById('empty-state').style.display  = 'flex';
}

export function selectAll(type, checked) {
  document.querySelectorAll(`.cb-${type}:not(:disabled)`).forEach(cb => {
    cb.checked = checked;
    highlightRow(cb);
  });
  updateCount();
}

export function highlightRow(cb) {
  const tr = cb.closest('tr');
  const anyChecked = tr.querySelector('.cb-rcvd').checked || tr.querySelector('.cb-sent').checked;
  tr.classList.toggle('row-selected', anyChecked);
}

export function updateCount() {
  const rcvd = document.querySelectorAll('.cb-rcvd:checked:not(:disabled)').length;
  const sent  = document.querySelectorAll('.cb-sent:checked:not(:disabled)').length;
  const el = document.getElementById('submit-info');
  if (rcvd > 0 || sent > 0) {
    el.innerHTML = `<strong>${rcvd}</strong> Rcvd · <strong>${sent}</strong> Sent ausgewählt`;
  } else {
    el.textContent = '0 QSOs ausgewählt';
  }
}

export async function doSubmit() {
  const date = document.getElementById('date-input').value;
  const entries = [];

  document.querySelectorAll('#qso-tbody tr').forEach(tr => {
    const rcvd = tr.querySelector('.cb-rcvd');
    const sent = tr.querySelector('.cb-sent');
    if (!rcvd || !sent) return;
    if ((!rcvd.checked || rcvd.disabled) && (!sent.checked || sent.disabled)) return;
    entries.push({
      id:       parseInt(tr.dataset.id),
      date,
      qsl_rcvd: rcvd.checked && !rcvd.disabled ? 'Y' : null,
      qsl_sent: sent.checked && !sent.disabled  ? 'Y' : null,
    });
  });

  if (entries.length === 0) return;

  try {
    const { updated } = await apiPut('/api/qsl/confirm', entries);
    MDesign.Snackbar.show({ message: `✓ ${updated} QSO(s) eingetragen`, duration: 3000 });

    document.querySelectorAll('#qso-tbody tr').forEach(tr => {
      const rcvd = tr.querySelector('.cb-rcvd');
      const sent = tr.querySelector('.cb-sent');
      if (!rcvd || !sent) return;
      if (rcvd.checked || sent.checked) {
        rcvd.disabled = true;
        sent.disabled = true;
        tr.classList.add('row-confirmed');
        tr.classList.remove('row-selected');
      }
    });

    document.getElementById('check-all-rcvd').checked = false;
    document.getElementById('check-all-sent').checked = false;
    updateCount();

  } catch (err) {
    MDesign.Snackbar.show({ message: 'Fehler: ' + err.message, duration: 4000 });
  }
}
