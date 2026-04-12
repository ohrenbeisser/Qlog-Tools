/**
 * api.js — Fetch-Wrapper für alle API-Aufrufe.
 *
 * Zentralisiert Fehlerbehandlung und Serialisierung, damit die
 * aufrufenden Module keine fetch()-Details kennen müssen.
 *
 * Öffentliche API:
 *   apiGet(path)        → Promise<any>
 *   apiPut(path, body)  → Promise<any>
 */

/** Timeout in Millisekunden für alle API-Aufrufe. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Basisimplementierung für alle API-Aufrufe.
 *
 * Wirft bei HTTP-Fehlern oder Netzwerk-Timeout eine Error-Instanz
 * mit einer für den Nutzer lesbaren Meldung.
 *
 * @param {string} path     — Relativer Pfad, z. B. '/api/qsl/search?call=DL1ABC'
 * @param {RequestInit} [options] — Optionale fetch()-Optionen (method, headers, body)
 * @returns {Promise<any>}  — Geparste JSON-Antwort
 * @throws {Error}          — Bei Netzwerkfehler, Timeout oder HTTP-Fehler
 */
async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(path, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${path}`);
    return await res.json();
  } catch (err) {
    // AbortError → verständlichere Meldung
    if (err.name === 'AbortError') {
      throw new Error(`Zeitüberschreitung – ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * HTTP GET — liest Daten vom Backend.
 *
 * @param {string} path
 * @returns {Promise<any>}
 */
export function apiGet(path) {
  return apiFetch(path);
}

/**
 * HTTP PUT — sendet JSON-Daten ans Backend.
 *
 * @param {string} path
 * @param {any} body — Wird automatisch als JSON serialisiert
 * @returns {Promise<any>}
 */
export function apiPut(path, body) {
  return apiFetch(path, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
}
