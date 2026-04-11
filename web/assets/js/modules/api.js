/**
 * Fetch-Wrapper für alle API-Calls.
 * Wirft bei HTTP-Fehlern eine Exception mit lesbarer Meldung.
 */

async function apiFetch(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${path}`);
  return res.json();
}

export function apiGet(path) {
  return apiFetch(path);
}

export function apiPut(path, body) {
  return apiFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
