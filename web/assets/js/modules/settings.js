/**
 * settings.js — Einstellungen-Panel (Browser-seitig).
 *
 * Alle Browser-Einstellungen werden im LocalStorage persistiert —
 * kein Server-Roundtrip erforderlich. Server-Einstellungen (Port,
 * Bind-Adresse, DB-Pfad usw.) werden ausschließlich im Tkinter-
 * Fenster / config.ini verwaltet.
 *
 * LocalStorage-Schlüssel:
 *   qlog_export_extended_fields  — JSON-Array der aktiven Feldnamen
 *
 * Öffentliche API (via window.* in app.js exponiert):
 *   loadSettings()           — Füllt Panel aus LocalStorage
 *   saveSettings()           — Schreibt Panel-Werte in LocalStorage
 *   switchSettingsTab(n, b)  — Wechselt zwischen Einstellungs-Tabs
 */

// ── Konstanten ────────────────────────────────────────────────────────────────

const LS_EXPORT_FIELDS = 'qlog_export_extended_fields';

/**
 * Alle konfigurierbaren "Erweitert"-ADIF-Felder.
 * Reihenfolge bestimmt die Darstellung in der Checkliste.
 * Per Default sind alle aktiv.
 */
export const EXPORT_FIELDS = [
  { id: 'ef-freq',       key: 'freq',       label: 'FREQ',       desc: 'Frequenz in MHz' },
  { id: 'ef-rst-rcvd',   key: 'rst_rcvd',   label: 'RST_RCVD',   desc: 'Empfangenes Rapport' },
  { id: 'ef-country',    key: 'country',    label: 'COUNTRY',    desc: 'Gegenstation Land' },
  { id: 'ef-comment',    key: 'comment',    label: 'COMMENT',    desc: 'Kommentar' },
  { id: 'ef-notes',      key: 'notes',      label: 'NOTES',      desc: 'Notizen' },
  { id: 'ef-tx-pwr',     key: 'tx_pwr',     label: 'TX_PWR',     desc: 'Sendeleistung (W)' },
  { id: 'ef-my-rig',     key: 'my_rig',     label: 'MY_RIG',     desc: 'Eigenes Gerät' },
  { id: 'ef-my-antenna', key: 'my_antenna', label: 'MY_ANTENNA', desc: 'Eigene Antenne' },
];

// ── LocalStorage-Zugriff ──────────────────────────────────────────────────────

/**
 * Gibt die Liste der aktiven erweiterten ADIF-Felder aus dem LocalStorage zurück.
 * Fehlt der Eintrag, werden alle Felder als aktiv betrachtet (Default: alle an).
 *
 * @returns {string[]} Array von Feldschlüsseln, z. B. ['freq', 'country']
 */
export function getExportExtendedFields() {
  const raw = localStorage.getItem(LS_EXPORT_FIELDS);
  if (raw === null) return EXPORT_FIELDS.map(f => f.key);  // Default: alle
  try {
    return JSON.parse(raw);
  } catch {
    return EXPORT_FIELDS.map(f => f.key);
  }
}

/**
 * Speichert die Liste der aktiven erweiterten ADIF-Felder im LocalStorage.
 *
 * @param {string[]} keys
 */
function _saveExportExtendedFields(keys) {
  localStorage.setItem(LS_EXPORT_FIELDS, JSON.stringify(keys));
}

// ── Tab-Umschaltung ───────────────────────────────────────────────────────────

/**
 * Wechselt zwischen den Einstellungs-Tabs.
 * Gleiches Muster wie switchQslTab() in nav.js.
 *
 * @param {string}      name — Tab-Name, z. B. 'export'
 * @param {HTMLElement} btn
 */
export function switchSettingsTab(name, btn) {
  document.querySelectorAll('#panel-settings .md-tab').forEach(t => {
    t.classList.remove('md-active');
    t.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('#panel-settings .md-tab-panel').forEach(p => {
    p.classList.remove('md-active');
  });
  btn.classList.add('md-active');
  btn.setAttribute('aria-selected', 'true');
  document.getElementById(`settings-panel-${name}`).classList.add('md-active');
}

// ── Laden ─────────────────────────────────────────────────────────────────────

/**
 * Füllt das Einstellungs-Panel aus dem LocalStorage.
 * Baut die Export-Feldliste einmalig auf (idempotent).
 */
export function loadSettings() {
  _buildExportFieldList();

  const active = new Set(getExportExtendedFields());
  EXPORT_FIELDS.forEach(f => {
    const cb = document.getElementById(f.id);
    if (cb) cb.checked = active.has(f.key);
  });
}

// ── Speichern ─────────────────────────────────────────────────────────────────

/**
 * Schreibt alle Panel-Werte in den LocalStorage.
 */
export function saveSettings() {
  const exportFields = EXPORT_FIELDS
    .filter(f => document.getElementById(f.id)?.checked)
    .map(f => f.key);

  _saveExportExtendedFields(exportFields);
  MDesign.Snackbar.show({ message: '✓ Einstellungen gespeichert', duration: 3000 });
}

// ── Interne Hilfsfunktionen ───────────────────────────────────────────────────

/**
 * Baut die Checkliste der Export-Felder im Export-Tab auf (einmalig).
 */
function _buildExportFieldList() {
  const container = document.getElementById('cfg-export-fields');
  if (!container || container.dataset.built) return;
  container.dataset.built = '1';

  EXPORT_FIELDS.forEach(f => {
    const label = document.createElement('label');
    label.className = 'md-checkbox-container settings-export-field';
    label.innerHTML = `
      <input type="checkbox" id="${f.id}">
      <span></span>
      <span class="md-body-medium">${f.label}
        <span class="md-helper-text" style="display:block">${f.desc}</span>
      </span>`;
    container.appendChild(label);
  });
}
