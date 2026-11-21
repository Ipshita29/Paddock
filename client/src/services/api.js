// api.js - the only place where the frontend talks to the PADDOCK server.
// the deployed backend is used in production, and the local server while developing
const DEPLOYED_API = 'https://paddock-2ai7.vercel.app/api';
const LOCAL_API = 'http://localhost:5001/api';
const BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? DEPLOYED_API : LOCAL_API);

// answers that were already loaded, so the same page does not call the server again and again
const saved = new Map();

async function request(path, maxAge = 60000) {
  const old = saved.get(path);
  if (old && Date.now() - old.time < maxAge) return old.data;

  // give up after 40 seconds instead of waiting forever
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40000);

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The PADDOCK server took too long to answer. Please try again.');
    throw new Error('The PADDOCK server could not be reached. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
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

// every finished race with its saved prediction and the real result
export function getPredictionHistory() {
  return request('/prediction/history', 10 * 60000);
}

export function getRacePrediction(season, round) {
  return request(`/prediction/${season}/${round}`, 10 * 60000);
}
