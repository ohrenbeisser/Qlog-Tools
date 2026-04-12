/**
 * qsl.js — QSL-Panel: Rufzeichen suchen, QSOs anzeigen, QSL-Status eintragen.
 *
 * Öffentliche API (via window.* in app.js exponiert):
 *   doSearch()          — Startet Suche mit dem aktuellen Rufzeichen
 *   clearSearch()       — Leert Suche und blendet Ergebnisse aus
 *   selectAll(type, checked) — Setzt alle Checkboxen eines Typs
 *   highlightRow(cb)    — Aktualisiert Hervorhebung einer Zeile
 *   updateCount()       — Aktualisiert die Zählanzeige unter der Tabelle
 *   doSubmit()          — Sendet ausgewählte QSOs ans Backend
 */

import { apiGet, apiPut } from './api.js';

// ── Initialisierung ───────────────────────────────────────────────────────────

/** Setzt das Datum-Feld auf heute (wird beim App-Start aufgerufen). */
export function initQsl() {
  document.getElementById('date-input').value = new Date().toISOString().split('T')[0];
}

// ── Suche ─────────────────────────────────────────────────────────────────────

/**
 * Liest das Rufzeichen-Feld, fragt die API ab und rendert die Ergebnistabelle.
 * Zeigt einen Snackbar-Fehler bei Netzwerk- oder Serverproblemen.
 */
export async function doSearch() {
  const call = document.getElementById('callsign-input').value.trim().toUpperCase();
  if (!call) return;

  _hideResultArea();

  try {
    const data = await apiGet(`/api/qsl/search?call=${encodeURIComponent(call)}`);
    _renderResults(call, data);
  } catch (err) {
    MDesign.Snackbar.show({ message: 'Fehler: ' + err.message, duration: 4000 });
    document.getElementById('empty-state').style.display = 'flex';
  }
}

/** Blendet Ergebnis-Area aus und zeigt den Initial-Hinweis. */
export function clearSearch() {
  document.getElementById('callsign-input').value = '';
  _hideResultArea();
  document.getElementById('empty-state').style.display = 'flex';
}

/** Versteckt result-area und empty-state (Zwischenzustand vor dem Laden). */
function _hideResultArea() {
  document.getElementById('empty-state').style.display  = 'none';
  document.getElementById('result-area').style.display  = 'none';
}

/**
 * Rendert Titel, Zähler, Tabellen-Body und zeigt die result-area.
 *
 * @param {string}   call  — Rufzeichen (Grossbuchstaben)
 * @param {Object[]} data  — QSO-Liste vom Backend
 */
function _renderResults(call, data) {
  document.getElementById('result-title').textContent = `QSOs mit ${call}`;
  document.getElementById('result-count').textContent = data.length;

  const tbody = document.getElementById('qso-tbody');
  tbody.innerHTML = '';

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px">
      <span class="md-text-muted md-body-medium">Keine QSOs gefunden</span></td></tr>`;
  } else {
    data.forEach(q => tbody.appendChild(_buildQsoRow(q)));
  }

  // Select-All-Checkboxen zurücksetzen
  document.getElementById('check-all-rcvd').checked  = false;
  document.getElementById('check-all-anfrd').checked = false;
  updateCount();

  document.getElementById('result-area').style.display = 'block';
}

/**
 * Erstellt ein <tr>-Element für ein einzelnes QSO.
 *
 * Rcvd-Checkbox: deaktiviert wenn qsl_rcvd='Y' (Karte empfangen, unveränderlich).
 * Sent-Checkbox: deaktiviert wenn qsl_sent='Y' (Karte bereits verschickt).
 *   'R' (Angefordert) sperrt NICHT — kann erneut angefordert werden.
 *
 * Eine Zeile wird abgedimmt (row-confirmed), wenn BEIDE Felder auf 'Y' stehen.
 *
 * @param {Object} q — QSO-Objekt vom Backend
 * @returns {HTMLTableRowElement}
 */
function _buildQsoRow(q) {
  const date        = q.start_date ?? '—';
  const time        = q.start_utc  ?? '—';
  const alreadyRcvd = q.qsl_rcvd === 'Y';
  const alreadySent = q.qsl_sent  === 'Y';  // nur 'Y' sperrt, nicht 'R'
  // 'R' = Karte bereits angefordert — Checkbox vorbelegen, aber editierbar lassen
  const anfrdPrefill = q.qsl_sent === 'R';

  const tr = document.createElement('tr');
  if (alreadyRcvd && alreadySent) tr.classList.add('row-confirmed');
  // Zeile hervorheben wenn bereits angefordert (visuelles Feedback ohne Sperre)
  if (anfrdPrefill && !alreadyRcvd) tr.classList.add('row-selected');
  tr.dataset.id = q.id;

  tr.innerHTML = `
    <td class="md-td" style="font-family:monospace">${date}</td>
    <td class="md-td" style="font-family:monospace">${time}</td>
    <td class="md-td"><span class="md-chip md-chip-suggestion chip-band">${q.band ?? '—'}</span></td>
    <td class="md-td"><span class="md-chip md-chip-suggestion chip-mode">${q.mode ?? '—'}</span></td>
    <td class="md-td" style="font-family:monospace">${q.rst_sent ?? '—'}</td>
    <td class="md-td" style="font-family:monospace">${q.rst_rcvd ?? '—'}</td>
    <td class="md-td md-text-center">
      <label class="md-checkbox-container" style="justify-content:center">
        <input type="checkbox" class="cb-rcvd" ${alreadyRcvd ? 'checked disabled' : ''}
          onchange="updateCount(); highlightRow(this)">
        <span></span>
      </label>
    </td>
    <td class="md-td md-text-center">
      <label class="md-checkbox-container" style="justify-content:center">
        <input type="checkbox" class="cb-anfrd" ${alreadySent ? 'checked disabled' : anfrdPrefill ? 'checked' : ''}
          onchange="updateCount(); highlightRow(this)">
        <span></span>
      </label>
    </td>`;
  return tr;
}

// ── Checkbox-Hilfs-Funktionen ─────────────────────────────────────────────────

/**
 * Setzt alle Checkboxen eines Typs ('rcvd' oder 'sent') auf den gewünschten Zustand.
 * Deaktivierte Checkboxen (bereits bestätigt) werden ausgelassen.
 *
 * @param {'rcvd'|'sent'} type
 * @param {boolean} checked
 */
export function selectAll(type, checked) {
  document.querySelectorAll(`.cb-${type}:not(:disabled)`).forEach(cb => {
    cb.checked = checked;
    highlightRow(cb);
  });
  updateCount();
}

/**
 * Hebt eine Zeile farbig hervor, wenn mindestens eine Checkbox aktiviert ist.
 *
 * @param {HTMLInputElement} cb — Eine der beiden Checkboxen in der Zeile
 */
export function highlightRow(cb) {
  const tr = cb.closest('tr');
  const anyChecked =
    tr.querySelector('.cb-rcvd').checked ||
    tr.querySelector('.cb-anfrd').checked;
  tr.classList.toggle('row-selected', anyChecked);
}

/**
 * Aktualisiert den Text unter der Tabelle mit der Anzahl ausgewählter QSOs.
 * Deaktivierte (bereits bestätigte) Checkboxen zählen nicht mit.
 */
export function updateCount() {
  const rcvd  = document.querySelectorAll('.cb-rcvd:checked:not(:disabled)').length;
  const anfrd = document.querySelectorAll('.cb-anfrd:checked:not(:disabled)').length;
  const el = document.getElementById('submit-info');
  if (rcvd > 0 || anfrd > 0) {
    el.innerHTML = `<strong>${rcvd}</strong> Empfangen · <strong>${anfrd}</strong> Angefordert`;
  } else {
    el.textContent = '0 QSOs ausgewählt';
  }
}

// ── Eintragen ─────────────────────────────────────────────────────────────────

/**
 * Sammelt alle aktivierten QSOs, sendet sie ans Backend und dimmt sie ab.
 * Bricht ohne Aktion ab, wenn keine Checkboxen aktiviert sind.
 */
export async function doSubmit() {
  const date    = document.getElementById('date-input').value;
  const entries = _collectCheckedEntries(date);

  if (entries.length === 0) return;

  try {
    const { updated } = await apiPut('/api/qsl/confirm', entries);
    MDesign.Snackbar.show({ message: `✓ ${updated} QSO(s) eingetragen`, duration: 3000 });
    _lockSubmittedRows();
  } catch (err) {
    MDesign.Snackbar.show({ message: 'Fehler: ' + err.message, duration: 4000 });
  }
}

/**
 * Iteriert über alle Zeilen und sammelt Einträge für aktivierte Checkboxen.
 *
 * Bereits deaktivierte Checkboxen (vorherige Bestätigungen) werden ignoriert.
 * qsl_rcvd_via und qsl_sent_via werden als null gesendet (kein Via-Feld in der UI).
 *
 * Werte:
 *   Rcvd-Checkbox → qsl_rcvd = 'Y'  (Karte empfangen)
 *   Anfrd-Checkbox → qsl_sent = 'R'  (Karte angefordert / TNX QSO)
 *
 * @param {string} date — Datum im Format YYYY-MM-DD
 * @returns {Object[]} entries — Liste von QSO-Einträgen für die API
 */
function _collectCheckedEntries(date) {
  const entries = [];

  document.querySelectorAll('#qso-tbody tr').forEach(tr => {
    const rcvd  = tr.querySelector('.cb-rcvd');
    const anfrd = tr.querySelector('.cb-anfrd');
    if (!rcvd || !anfrd) return;

    // Zeile überspringen, wenn weder rcvd noch anfrd neu aktiviert wurden
    const rcvdNew  = rcvd.checked  && !rcvd.disabled;
    const anfrdNew = anfrd.checked && !anfrd.disabled;
    if (!rcvdNew && !anfrdNew) return;

    entries.push({
      id:           parseInt(tr.dataset.id, 10),
      date,
      qsl_rcvd:     rcvdNew  ? 'Y' : null,
      qsl_sent:     anfrdNew ? 'R' : null,  // 'R' = Requested (TNX QSO)
      qsl_rcvd_via: null,
      qsl_sent_via: null,
    });
  });

  return entries;
}

/**
 * Sperrt Rcvd-Checkboxen nach dem Submit (unveränderlich).
 * Anfrd-Checkboxen bleiben angehakt und editierbar — 'R' soll als
 * gespeicherter Status sichtbar bleiben.
 * Wird nach erfolgreichem Submit aufgerufen.
 */
function _lockSubmittedRows() {
  document.querySelectorAll('#qso-tbody tr').forEach(tr => {
    const rcvd  = tr.querySelector('.cb-rcvd');
    const anfrd = tr.querySelector('.cb-anfrd');
    if (!rcvd || !anfrd) return;

    // Rcvd abschliessen: Empfang ist unveränderlich → sperren
    if (rcvd.checked && !rcvd.disabled) {
      rcvd.disabled = true;
    }
    // Anfrd NICHT sperren: 'R' bleibt angehakt (zeigt gespeicherten Status),
    // kann aber erneut aktiviert/deaktiviert werden.

    // Zeile dimmen nur wenn rcvd=Y gesetzt und sent=Y (beide final abgeschlossen)
    if (rcvd.checked && rcvd.disabled && anfrd.checked && anfrd.disabled) {
      tr.classList.add('row-confirmed');
      tr.classList.remove('row-selected');
    }
  });

  document.getElementById('check-all-rcvd').checked  = false;
  document.getElementById('check-all-anfrd').checked = false;
  updateCount();
}
