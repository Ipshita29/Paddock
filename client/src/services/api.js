// api.js - the only place where the frontend talks to the PADDOCK server.
const BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5001/api');

// answers that were already loaded, so the same page does not call the server again and again
const saved = new Map();

async function request(path, maxAge = 60000) {
  const old = saved.get(path);
  if (old && Date.now() - old.time < maxAge) return old.data;

  let res;
  try {
    res = await fetch(`${BASE}${path}`);
  } catch (err) {
    throw new Error('The PADDOCK server could not be reached. Check your connection and try again.');
  }

  let body = null;
  try {
    body = await res.json();
  } catch (err) {
    // handled below
  }

  if (!res.ok || !body || body.ok === false) {
    let message = `The server returned an error (${res.status}).`;
    if (body && body.error && body.error.message) message = body.error.message;
    throw new Error(message);
  }

  saved.set(path, { time: Date.now(), data: body.data });
  return body.data;
}

export function getHistory() {
  return request('/history', 10 * 60000);
}

export function getSeasons() {
  return request('/history/seasons', 10 * 60000);
}

export function getSeason(season) {
  return request(`/history/${season}`, 10 * 60000);
}

// params can be filter, decade, search, page, limit and sort. Empty values are left out.
export function getPeople(params = {}) {
  const query = new URLSearchParams();
  const keys = Object.keys(params);
  for (let i = 0; i < keys.length; i++) {
    const value = params[keys[i]];
    if (value !== '' && value !== null && value !== undefined) query.append(keys[i], value);
  }
  const text = query.toString();
  let path = '/people';
  if (text) path = `/people?${text}`;
  return request(path, 5 * 60000);
}

export function getPerson(driverId) {
  return request(`/people/${encodeURIComponent(driverId)}`, 10 * 60000);
}

export function getNextRace() {
  return request('/prediction/next-race', 2 * 60000);
}

export function getRacePrediction(season, round) {
  return request(`/prediction/${season}/${round}`, 10 * 60000);
}
