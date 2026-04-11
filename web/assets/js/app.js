/**
 * app.js — Einstiegspunkt.
 * Importiert alle Module, initialisiert die App und
 * exponiert die vom HTML benötigten Funktionen global.
 */

import { showPanel, initThemeToggle } from './modules/nav.js';
import { loadRecentQsos }             from './modules/dashboard.js';
import { initQsl, doSearch, clearSearch,
         selectAll, highlightRow,
         updateCount, doSubmit }      from './modules/qsl.js';
import { loadSettings, saveSettings } from './modules/settings.js';

// ── Globale Funktionen (werden von onclick-Attributen im HTML aufgerufen) ─────
window.showPanel     = showPanel;
window.loadRecentQsos = loadRecentQsos;
window.doSearch      = doSearch;
window.clearSearch   = clearSearch;
window.selectAll     = selectAll;
window.highlightRow  = highlightRow;
window.updateCount   = updateCount;
window.doSubmit      = doSubmit;
window.saveSettings  = saveSettings;

// ── Init ──────────────────────────────────────────────────────────────────────
initThemeToggle();
initQsl();
loadRecentQsos();
loadSettings();
