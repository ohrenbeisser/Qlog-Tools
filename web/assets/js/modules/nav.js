/**
 * nav.js — Navigation: Panel-Wechsel und Theme-Toggle.
 *
 * Öffentliche API (via window.* in app.js exponiert):
 *   showPanel(name, item)  — Wechselt zum gewählten Panel
 *   initThemeToggle()      — Initialisiert den Dark/Light-Umschalter
 */

/** Titel für die App Bar je Panel-ID. */
const PANEL_TITLES = {
  start:     'Start',
  qsl:       'QSL',
  stats:     'Statistik',
  callsigns: 'Rufzeichen',
  queries:   'Abfragen',
  export:    'Export',
  settings:  'Einstellungen',
  help:      'Hilfe',
  about:     'Über',
};

/**
 * Callbacks, die beim Öffnen eines bestimmten Panels aufgerufen werden.
 * Wird von app.js nach dem Import befüllt (Lazy-Loading statt eagerly).
 *
 * @type {Record<string, () => void>}
 */
export const panelCallbacks = {};

/**
 * Wechselt zum Panel mit der angegebenen ID.
 *
 * - Versteckt alle anderen Panels.
 * - Setzt den aktiven Drawer-Eintrag.
 * - Aktualisiert den App-Bar-Titel.
 * - Ruft einen registrierten Callback auf (z. B. Einstellungen nachladen).
 * - Schließt den Navigation Drawer.
 *
 * @param {string} name       — Panel-ID (ohne 'panel-' Präfix), z. B. 'qsl'
 * @param {HTMLElement} item  — Der angeklickte Drawer-Eintrag (für md-active)
 */
export function showPanel(name, item) {
  // Alle Panels und Drawer-Einträge deaktivieren
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.md-drawer-item').forEach(i => i.classList.remove('md-active'));

  // Gewähltes Panel aktivieren
  document.getElementById('panel-' + name).classList.add('active');
  item.classList.add('md-active');
  document.getElementById('app-bar-title').textContent = PANEL_TITLES[name] ?? name;

  // Optionaler Panel-Callback (z. B. Daten nachladen)
  if (panelCallbacks[name]) {
    panelCallbacks[name]();
  }

  MDesign.Drawer.close('#main-drawer');
}

/**
 * Wechselt zwischen den Tabs innerhalb des QSL-Panels.
 *
 * Funktioniert unabhängig von showPanel() — steuert nur die internen
 * md-tab-panel Elemente innerhalb von #panel-qsl.
 *
 * @param {'empfangen'|'export'} name — Tab-ID (ohne 'qsl-panel-' Präfix)
 * @param {HTMLElement} btn           — Der angeklickte Tab-Button
 */
export function switchQslTab(name, btn) {
  document.querySelectorAll('#panel-qsl .md-tab-panel').forEach(p => p.classList.remove('md-active'));
  document.querySelectorAll('#panel-qsl .md-tab').forEach(t => {
    t.classList.remove('md-active');
    t.setAttribute('aria-selected', 'false');
  });
  document.getElementById('qsl-panel-' + name).classList.add('md-active');
  btn.classList.add('md-active');
  btn.setAttribute('aria-selected', 'true');

  // Länderliste laden wenn Export-Tab erstmals geöffnet wird
  if (name === 'export' && panelCallbacks.qsl) {
    panelCallbacks.qsl();
  }
}

/**
 * Initialisiert den Dark/Light-Theme-Umschalter in der App Bar.
 *
 * Reagiert auf:
 * - Klick auf den Button → MDesign.Theme.toggle()
 * - 'md-theme-change'-Event (z. B. aus MDesign ausgelöst) → Icon aktualisieren
 */
export function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');

  /** Setzt das Icon je nach aktivem Theme. */
  function updateIcon() {
    btn.querySelector('.md-icon').textContent =
      MDesign.Theme.get() === 'dark' ? 'light_mode' : 'dark_mode';
  }

  btn.addEventListener('click', () => {
    MDesign.Theme.toggle();
    updateIcon();
  });

  // Auch auf externe Theme-Änderungen reagieren
  document.addEventListener('md-theme-change', updateIcon);
  updateIcon();
}
