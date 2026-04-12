/**
 * settings.js — Einstellungen-Panel: Konfiguration laden und speichern.
 *
 * Öffentliche API (via window.* in app.js exponiert):
 *   loadSettings()  — Lädt aktuelle Einstellungen vom Backend und füllt die Felder
 *   saveSettings()  — Validiert und speichert die Einstellungen via Backend
 */

import { apiGet, apiPut } from './api.js';

/**
 * Lädt die aktuellen Einstellungen vom Backend und füllt die Formularfelder.
 * Zeigt einen Snackbar-Fehler, falls die API nicht erreichbar ist.
 */
export async function loadSettings() {
  try {
    const cfg = await apiGet('/api/config');
    document.getElementById('cfg-db-path').value     = cfg.db_path;
    document.getElementById('cfg-port').value        = cfg.port;
    document.getElementById('cfg-max-log').value     = cfg.max_log_entries;
    document.getElementById('cfg-auto-open').checked = cfg.auto_open_browser;
  } catch (err) {
    MDesign.Snackbar.show({
      message:  'Einstellungen konnten nicht geladen werden',
      duration: 4000,
    });
  }
}

/**
 * Liest die Formularfelder, validiert den Port und sendet die Einstellungen ans Backend.
 *
 * Validierung:
 *   - Port muss im Bereich 1024–65535 liegen (Ports < 1024 erfordern Root-Rechte)
 *   - max_log_entries wird als Integer geparst (NaN wird als 0 gespeichert → Backend-Default)
 */
export async function saveSettings() {
  const port = parseInt(document.getElementById('cfg-port').value, 10);
  if (isNaN(port) || port < 1024 || port > 65535) {
    MDesign.Snackbar.show({
      message:  'Port muss zwischen 1024 und 65535 liegen',
      duration: 4000,
    });
    return;
  }

  const body = {
    db_path:           document.getElementById('cfg-db-path').value,
    port,
    max_log_entries:   parseInt(document.getElementById('cfg-max-log').value, 10) || 200,
    auto_open_browser: document.getElementById('cfg-auto-open').checked,
  };

  try {
    await apiPut('/api/config', body);
    MDesign.Snackbar.show({ message: '✓ Einstellungen gespeichert', duration: 3000 });
  } catch (err) {
    MDesign.Snackbar.show({
      message:  'Fehler beim Speichern: ' + err.message,
      duration: 4000,
    });
  }
}
