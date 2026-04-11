/**
 * Einstellungen-Panel: Konfiguration laden und speichern.
 */

import { apiGet, apiPut } from './api.js';

export async function loadSettings() {
  try {
    const cfg = await apiGet('/api/config');
    document.getElementById('cfg-db-path').value     = cfg.db_path;
    document.getElementById('cfg-port').value        = cfg.port;
    document.getElementById('cfg-max-log').value     = cfg.max_log_entries;
    document.getElementById('cfg-auto-open').checked = cfg.auto_open_browser;
  } catch (err) {
    MDesign.Snackbar.show({ message: 'Einstellungen konnten nicht geladen werden', duration: 4000 });
  }
}

export async function saveSettings() {
  const body = {
    db_path:           document.getElementById('cfg-db-path').value,
    port:              parseInt(document.getElementById('cfg-port').value),
    max_log_entries:   parseInt(document.getElementById('cfg-max-log').value),
    auto_open_browser: document.getElementById('cfg-auto-open').checked,
  };
  try {
    await apiPut('/api/config', body);
    MDesign.Snackbar.show({ message: '✓ Einstellungen gespeichert', duration: 3000 });
  } catch (err) {
    MDesign.Snackbar.show({ message: 'Fehler beim Speichern: ' + err.message, duration: 4000 });
  }
}
