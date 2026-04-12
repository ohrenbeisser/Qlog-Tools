/**
 * app.js — Einstiegspunkt der Qlog-Tools PWA.
 *
 * Aufgaben:
 *   1. Alle Module importieren
 *   2. Panel-Callbacks registrieren (Lazy-Loading je Panel)
 *   3. Globale Funktionen exponieren (benötigt von onclick-Attributen im HTML)
 *   4. App initialisieren
 *
 * Warum globale Funktionen (window.*)?
 *   ES-Module haben keinen globalen Scope. Da das HTML onclick="doSearch()"
 *   verwendet, müssen die Funktionen explizit auf window gesetzt werden.
 *   Alternative wäre addEventListener() im JS — das würde das HTML aber komplexer machen.
 */

import { showPanel, switchQslTab, initThemeToggle, panelCallbacks } from './modules/nav.js';
import { loadRecentQsos }                             from './modules/dashboard.js';
import { initQsl, doSearch, clearSearch,
         selectAll, highlightRow,
         updateCount, doSubmit }                      from './modules/qsl.js';
import { initExport, applyExportFilter,
         resetExportFilter, updateExportCount,
         downloadAdif }                               from './modules/qsl_export.js';
import { loadSettings, saveSettings }                 from './modules/settings.js';

// ── Panel-Callbacks registrieren ──────────────────────────────────────────────
// Einstellungen werden nur geladen, wenn das Panel tatsächlich geöffnet wird.
// Start-Panel: bei erneutem Öffnen die Tabelle aktualisieren.
// Export: Länderliste einmalig laden wenn Tab erstmals geöffnet wird.
panelCallbacks.settings = loadSettings;
panelCallbacks.start    = loadRecentQsos;
panelCallbacks.qsl      = () => initExport();  // Tab-Wechsel innerhalb QSL reicht nicht —
                                                // initExport() prüft selbst ob bereits geladen

// ── Globale Funktionen (von HTML onclick-Attributen aufgerufen) ───────────────
window.showPanel         = showPanel;
window.switchQslTab      = switchQslTab;
window.loadRecentQsos    = loadRecentQsos;
window.doSearch          = doSearch;
window.clearSearch       = clearSearch;
window.selectAll         = selectAll;
window.highlightRow      = highlightRow;
window.updateCount       = updateCount;
window.doSubmit          = doSubmit;
window.applyExportFilter = applyExportFilter;
window.resetExportFilter = resetExportFilter;
window.updateExportCount = updateExportCount;
window.downloadAdif      = downloadAdif;
window.saveSettings      = saveSettings;

// ── Initialisierung ───────────────────────────────────────────────────────────
initThemeToggle();  // Theme-Toggle-Button aktivieren
initQsl();          // Datum-Feld auf heute setzen
loadRecentQsos();   // Starttabelle sofort laden
