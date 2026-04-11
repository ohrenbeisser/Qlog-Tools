/**
 * Navigation: Drawer-Panel-Wechsel und Theme-Toggle.
 */

const panelTitles = {
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

export function showPanel(name, item) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.md-drawer-item').forEach(i => i.classList.remove('md-active'));
  document.getElementById('panel-' + name).classList.add('active');
  item.classList.add('md-active');
  document.getElementById('app-bar-title').textContent = panelTitles[name] || name;
  MDesign.Drawer.close('#main-drawer');
}

export function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');

  function updateIcon() {
    btn.querySelector('.md-icon').textContent =
      MDesign.Theme.get() === 'dark' ? 'light_mode' : 'dark_mode';
  }

  btn.addEventListener('click', () => {
    MDesign.Theme.toggle();
    updateIcon();
  });

  document.addEventListener('md-theme-change', updateIcon);
  updateIcon();
}
