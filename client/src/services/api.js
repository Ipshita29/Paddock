/**
 * api.js - the only place the frontend talks to the PADDOCK server.
 * The browser never calls Jolpica directly; the server caches and normalises it.
 */
const BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5001/api');
const memory = new Map();

async function request(path, ttl = 60000) {
  const hit = memory.get(path);
  if (hit && Date.now() - hit.at < ttl) return hit.data;

  let res;
  try {
    res = await fetch(`${BASE}${path}`);
  } catch (_) {
    throw new Error('The PADDOCK server could not be reached. Check your connection and try again.');
  }
  let body = null;
  try { body = await res.json(); } catch (_) { /* handled below */ }
  if (!res.ok || !body || body.ok === false) {
    throw new Error((body && body.error && body.error.message) || `The server returned an error (${res.status}).`);
  }
  memory.set(path, { at: Date.now(), data: body.data });
  return body.data;
}

export const getHistory = () => request('/history', 10 * 60000);
export const getSeasons = () => request('/history/seasons', 10 * 60000);
export const getSeason = (season) => request(`/history/${season}`, 10 * 60000);
/** The Grid. params: { filter, decade, search, page, limit, sort } (empty values are ignored). */
export const getPeople = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)).toString();
  return request(`/people${qs ? `?${qs}` : ''}`, 5 * 60000);
};
export const getPerson = (driverId) => request(`/people/${encodeURIComponent(driverId)}`, 10 * 60000);
export const getNextRace = () => request('/prediction/next-race', 2 * 60000);
export const getRacePrediction = (season, round) => request(`/prediction/${season}/${round}`, 10 * 60000);
