/**
 * utils.js — Gemeinsame Hilfsfunktionen für alle Module.
 *
 * Exportiert:
 *   esc(str)                        — HTML-Sonderzeichen escapen
 *   qslBadges(rcvd, sent)           — QSL-Status-Badge HTML-String
 */

/**
 * Escaped HTML-Sonderzeichen in einem String.
 * Verhindert XSS bei dynamisch eingefügtem Inhalt.
 *
 * @param {*} str
 * @returns {string}
 */
export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Erzeugt HTML für QSL-Status-Badges (Rcvd + Sent).
 * Gibt '—' zurück wenn kein relevanter Status vorhanden.
 *
 * @param {string|null} rcvd — qsl_rcvd-Wert aus der DB
 * @param {string|null} sent — qsl_sent-Wert aus der DB
 * @returns {string} HTML-Fragment
 */
export function qslBadges(rcvd, sent) {
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
