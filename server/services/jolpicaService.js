/*
  jolpicaService.js - the only file that talks to the Jolpica F1 API.

  - Requests go through one queue with a small gap between them, so we stay under the rate limit.
  - 429 and 5xx errors are retried a few times.
  - Responses are cached in memory and on disk. If the network fails, an older copy is used.
  - The raw JSON is turned into small, simple objects.
*/
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = (process.env.JOLPICA_BASE_URL || 'https://api.jolpi.ca/ergast/f1').replace(/\/$/, '');
const CACHE_DIR = path.join(os.tmpdir(), 'paddock-cache');
const MIN_GAP_MS = 350;
const MAX_ATTEMPTS = 4;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TTL = { SHORT: 5 * MINUTE, MEDIUM: HOUR, LONG: 30 * DAY };

const http = axios.create({ baseURL: BASE_URL, timeout: 20000, headers: { 'User-Agent': 'paddock-magazine/1.0' } });
const memory = new Map();
const inflight = new Map();

try {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
} catch (err) {
  // the disk cache is optional
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class JolpicaError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'JolpicaError';
    this.status = status;
  }
}

// an error with the HTTP status the API should answer with
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ---------------------------------------------------------------- queue
let chain = Promise.resolve();
let lastRequestAt = 0;
function enqueue(task) {
  const run = chain.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await task();
    } finally {
      lastRequestAt = Date.now();
    }
  });
  chain = run.catch(() => {});
  return run;
}

// ---------------------------------------------------------------- cache
function cacheFile(key) {
  const name = crypto.createHash('sha1').update(key).digest('hex');
  return path.join(CACHE_DIR, name + '.json');
}

function readCache(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const entry = JSON.parse(fs.readFileSync(cacheFile(key), 'utf8'));
    memory.set(key, entry);
    return entry;
  } catch (err) {
    return null;
  }
}

function writeCache(key, data) {
  const entry = { savedAt: Date.now(), data: data };
  memory.set(key, entry);
  try {
    fs.writeFileSync(cacheFile(key), JSON.stringify(entry));
  } catch (err) {
    // ignore, the memory cache still works
  }
}

// ---------------------------------------------------------------- fetch
async function requestWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await enqueue(() => http.get(url));
      return res.data.MRData;
    } catch (err) {
      lastError = err;
      const status = err.response && err.response.status;
      const canRetry = !status || status === 429 || status >= 500;
      if (!canRetry || attempt === MAX_ATTEMPTS) break;

      let delay = attempt * 1500;
      const retryAfter = Number(err.response && err.response.headers && err.response.headers['retry-after']);
      if (retryAfter > 0) delay = retryAfter * 1000;
      await sleep(Math.min(delay, 15000));
    }
  }

  const status = lastError.response && lastError.response.status;
  let reason = `(${lastError.code || lastError.message})`;
  if (status) reason = `(HTTP ${status})`;
  throw new JolpicaError(`Jolpica request failed for ${url} ${reason}`, status);
}

// ttl is a number (ms) or a function(data) that returns a number.
// A function lets empty answers (for example "no qualifying yet") be cached for a short time.
async function fetchJson(url, ttl = TTL.MEDIUM) {
  const cached = readCache(url);
  if (cached) {
    let maxAge = ttl;
    if (typeof ttl === 'function') maxAge = ttl(cached.data);
    if (Date.now() - cached.savedAt < maxAge) return cached.data;
  }
  if (inflight.has(url)) return inflight.get(url);

  const job = requestWithRetry(url)
    .then((data) => {
      writeCache(url, data);
      return data;
    })
    .catch((err) => {
      // better old data than none
      if (cached) return cached.data;
      throw err;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, job);
  return job;
}

// fetch every page of a list endpoint
async function fetchAllPages(url, ttl) {
  const sep = url.includes('?') ? '&' : '?';
  const pages = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const page = await fetchJson(`${url}${sep}limit=100&offset=${offset}`, ttl);
    pages.push(page);
    total = Number(page.total) || 0;
    offset = offset + 100;
  }
  return pages;
}

// ---------------------------------------------------------------- normalisers
function normalizeDriver(d) {
  return {
    driverId: d.driverId,
    code: d.code || null,
    number: d.permanentNumber || null,
    givenName: d.givenName,
    familyName: d.familyName,
    name: `${d.givenName} ${d.familyName}`,
    nationality: d.nationality,
    dateOfBirth: d.dateOfBirth,
    url: d.url || null,
  };
}

function normalizeRace(r) {
  return {
    season: Number(r.season),
    round: Number(r.round),
    raceName: r.raceName,
    circuitId: r.Circuit.circuitId,
    circuitName: r.Circuit.circuitName,
    locality: r.Circuit.Location.locality,
    country: r.Circuit.Location.country,
    lat: Number(r.Circuit.Location.lat),
    long: Number(r.Circuit.Location.long),
    date: r.date,
    time: r.time || null,
    url: r.url || null,
    sessions: {
      firstPractice: r.FirstPractice || null,
      secondPractice: r.SecondPractice || null,
      thirdPractice: r.ThirdPractice || null,
      sprintQualifying: r.SprintQualifying || r.SprintShootout || null,
      sprint: r.Sprint || null,
      qualifying: r.Qualifying || null,
    },
  };
}

function normalizeResult(row) {
  return {
    driverId: row.Driver.driverId,
    code: row.Driver.code || null,
    name: `${row.Driver.givenName} ${row.Driver.familyName}`,
    constructorId: row.Constructor.constructorId,
    constructorName: row.Constructor.name,
    number: row.number || null,
    grid: row.grid !== undefined ? Number(row.grid) : null,
    position: Number(row.position),
    positionText: row.positionText,
    points: Number(row.points),
    status: row.status,
    time: row.Time ? row.Time.time : null,
    laps: row.laps ? Number(row.laps) : null,
  };
}

function normalizeQualifying(row) {
  return {
    driverId: row.Driver.driverId,
    code: row.Driver.code || null,
    name: `${row.Driver.givenName} ${row.Driver.familyName}`,
    constructorId: row.Constructor.constructorId,
    constructorName: row.Constructor.name,
    number: row.number || null,
    position: Number(row.position),
    q1: row.Q1 || null,
    q2: row.Q2 || null,
    q3: row.Q3 || null,
  };
}

// the same race can appear on two pages, so join the rows by round number
function mergeRacesByRound(pages, listKey, normalizeRow) {
  const byRound = new Map();
  for (let i = 0; i < pages.length; i++) {
    const races = pages[i].RaceTable.Races;
    for (let j = 0; j < races.length; j++) {
      const r = races[j];
      if (!byRound.has(r.round)) {
        const race = normalizeRace(r);
        race.rows = [];
        byRound.set(r.round, race);
      }
      const rows = r[listKey] || [];
      for (let k = 0; k < rows.length; k++) {
        byRound.get(r.round).rows.push(normalizeRow(rows[k]));
      }
    }
  }
  const list = [...byRound.values()];
  list.sort((a, b) => a.round - b.round);
  return list;
}

function currentYear() {
  return new Date().getFullYear();
}

// finished seasons never change, so they are cached for much longer
function seasonTtl(season) {
  if (Number(season) < currentYear()) return TTL.LONG;
  return TTL.MEDIUM;
}

// ---------------------------------------------------------------- public API
async function getSeasonsList() {
  const pages = await fetchAllPages('/seasons.json', DAY);
  const years = [];
  for (let i = 0; i < pages.length; i++) {
    const seasons = pages[i].SeasonTable.Seasons;
    for (let j = 0; j < seasons.length; j++) years.push(Number(seasons[j].season));
  }
  years.sort((a, b) => a - b);
  return years;
}

async function getSchedule(season) {
  const data = await fetchJson(`/${season}.json?limit=100`, seasonTtl(season));
  return data.RaceTable.Races.map(normalizeRace);
}

// the next race that has not happened yet, or null when the calendar is complete
async function getNextRace() {
  const data = await fetchJson('/current/next.json', 10 * MINUTE);
  if (data.RaceTable.Races.length) return normalizeRace(data.RaceTable.Races[0]);
  const upcoming = await getSchedule(currentYear() + 1).catch(() => []);
  return upcoming[0] || null;
}

async function getSeasonResults(season) {
  const pages = await fetchAllPages(`/${season}/results.json`, seasonTtl(season));
  const races = mergeRacesByRound(pages, 'Results', normalizeResult);
  for (let i = 0; i < races.length; i++) {
    races[i].results = races[i].rows;
    delete races[i].rows;
  }
  return races;
}

async function getSeasonQualifying(season) {
  const pages = await fetchAllPages(`/${season}/qualifying.json`, seasonTtl(season));
  const races = mergeRacesByRound(pages, 'QualifyingResults', normalizeQualifying);
  for (let i = 0; i < races.length; i++) {
    races[i].qualifying = races[i].rows;
    delete races[i].rows;
  }
  return races;
}

async function getRaceQualifying(season, round) {
  // an empty answer (qualifying not run yet) is only cached for a few minutes
  const data = await fetchJson(`/${season}/${round}/qualifying.json`, (d) => {
    if (d.RaceTable.Races.length) return DAY;
    return 3 * MINUTE;
  });
  const race = data.RaceTable.Races[0];
  return race ? race.QualifyingResults.map(normalizeQualifying) : [];
}

async function getRaceResult(season, round) {
  const data = await fetchJson(`/${season}/${round}/results.json?limit=100`, (d) => {
    if (d.RaceTable.Races.length) return TTL.LONG;
    return 3 * MINUTE;
  });
  const race = data.RaceTable.Races[0];
  return race ? race.Results.map(normalizeResult) : [];
}

async function getSeasonWinners(season) {
  const data = await fetchJson(`/${season}/results/1.json?limit=100`, seasonTtl(season));
  return data.RaceTable.Races.map((r) => ({
    round: Number(r.round),
    raceName: r.raceName,
    circuitName: r.Circuit.circuitName,
    date: r.date,
    winner: `${r.Results[0].Driver.givenName} ${r.Results[0].Driver.familyName}`,
    driverId: r.Results[0].Driver.driverId,
    constructor: r.Results[0].Constructor.name,
  }));
}

async function getSeasonStandings(season, kind) {
  const isDriver = kind === 'driver';
  const data = await fetchJson(`/${season}/${isDriver ? 'driverstandings' : 'constructorstandings'}.json?limit=100`, seasonTtl(season));
  const list = data.StandingsTable.StandingsLists[0];
  if (!list) return { round: null, standings: [] };
  const rows = isDriver ? list.DriverStandings : list.ConstructorStandings;
  return {
    round: Number(list.round),
    standings: rows.map((s) => ({
      position: Number(s.position),
      points: Number(s.points),
      wins: Number(s.wins),
      name: isDriver ? `${s.Driver.givenName} ${s.Driver.familyName}` : s.Constructor.name,
      id: isDriver ? s.Driver.driverId : s.Constructor.constructorId,
      constructor: isDriver && s.Constructors[0] ? s.Constructors[0].name : undefined,
    })),
  };
}

async function getAllDrivers() {
  const pages = await fetchAllPages('/drivers.json', TTL.LONG);
  return pages.flatMap((p) => p.DriverTable.Drivers.map(normalizeDriver));
}

async function getDriver(driverId) {
  const data = await fetchJson(`/drivers/${encodeURIComponent(driverId)}.json`, TTL.LONG);
  const d = data.DriverTable.Drivers[0];
  return d ? normalizeDriver(d) : null;
}

// total number of results for a driver that match a filter, for example wins
async function getTotal(id, suffix) {
  const data = await fetchJson(`/drivers/${id}/${suffix}?limit=1`, TTL.LONG);
  return Number(data.total);
}

// career totals for one driver
async function getDriverCareer(driverId) {
  const id = encodeURIComponent(driverId);
  const first = await fetchJson(`/drivers/${id}/results.json?limit=1`, TTL.LONG);
  const entries = Number(first.total);
  if (!entries) return { entries: 0, wins: 0, podiums: 0, poles: 0, debut: null, constructors: [] };

  const firstRace = first.RaceTable.Races[0];
  const wins = await getTotal(id, 'results/1.json');
  const seconds = await getTotal(id, 'results/2.json');
  const thirds = await getTotal(id, 'results/3.json');
  const poles = await getTotal(id, 'grid/1/results.json');
  const cons = await fetchJson(`/drivers/${id}/constructors.json?limit=100`, TTL.LONG);

  const constructors = [];
  for (let i = 0; i < cons.ConstructorTable.Constructors.length; i++) {
    constructors.push(cons.ConstructorTable.Constructors[i].name);
  }
  return {
    entries: entries,
    wins: wins,
    podiums: wins + seconds + thirds,
    poles: poles,
    debut: { season: Number(firstRace.season), race: firstRace.raceName, date: firstRace.date },
    constructors: constructors,
  };
}

/*
  What counts as a Grand Prix "start" (used for every statistic on the People pages):
  - the driver is not marked "Did not start", "Did not qualify" or "Did not prequalify"
  - rows with positionText "W" (withdrawn) only count if laps were completed
  - a driver counts once per race, even if a shared drive gave them two result rows
  Wins, podiums and poles are also counted once per driver per race.
  A pole is a race started from grid position 1.
*/
const NOT_STARTED = ['Did not start', 'Did not qualify', 'Did not prequalify'];

function didStart(r) {
  if (NOT_STARTED.includes(r.status)) return false;
  if (r.positionText === 'W' && !(r.laps > 0)) return false;
  return true;
}

// turns a list of races (oldest first) into career records for every driver
// the baked archive and the live data both use this, so the numbers always match
function aggregateRaces(races) {
  const drivers = new Map();

  for (let i = 0; i < races.length; i++) {
    const race = races[i];

    // group this race's rows by driver (only drivers who started)
    const rowsByDriver = new Map();
    for (let j = 0; j < race.results.length; j++) {
      const r = race.results[j];
      if (!didStart(r)) continue;
      if (!rowsByDriver.has(r.driverId)) rowsByDriver.set(r.driverId, []);
      rowsByDriver.get(r.driverId).push(r);
    }

    for (const [id, rows] of rowsByDriver) {
      let d = drivers.get(id);
      if (!d) {
        d = { id: id, name: rows[0].name, code: rows[0].code, debut: null, firstWin: null, last: null, seasons: new Map() };
        drivers.set(id, d);
      }

      let best = rows[0].position;
      let points = 0;
      let hasPole = false;
      for (let k = 0; k < rows.length; k++) {
        if (rows[k].position < best) best = rows[k].position;
        points += rows[k].points;
        if (rows[k].grid === 1) hasPole = true;
      }

      const where = { season: race.season, round: race.round, race: race.raceName, team: rows[0].constructorName };

      let s = d.seasons.get(race.season);
      if (!s) {
        s = { starts: 0, wins: 0, podiums: 0, poles: 0, points: 0, teams: [] };
        d.seasons.set(race.season, s);
      }
      s.starts += 1;
      if (best === 1) s.wins += 1;
      if (best <= 3) s.podiums += 1;
      if (hasPole) s.poles += 1;
      s.points += points;
      for (let k = 0; k < rows.length; k++) {
        if (!s.teams.includes(rows[k].constructorName)) s.teams.push(rows[k].constructorName);
      }

      if (!d.debut) d.debut = where;
      if (best === 1 && !d.firstWin) d.firstWin = where;
      d.last = where;
    }
  }
  return drivers;
}

// aggregate every season from fromSeason up to the current year
async function getDriverAggregates(fromSeason) {
  const races = [];
  for (let season = fromSeason; season <= currentYear(); season++) {
    const seasonRaces = await getSeasonResults(season);
    for (let i = 0; i < seasonRaces.length; i++) races.push(seasonRaces[i]);
  }
  return aggregateRaces(races);
}

module.exports = {
  ApiError,
  JolpicaError,
  TTL,
  getSeasonsList,
  getSchedule,
  getNextRace,
  getSeasonResults,
  getSeasonQualifying,
  getRaceQualifying,
  getRaceResult,
  getSeasonWinners,
  getSeasonStandings,
  getAllDrivers,
  getDriver,
  getDriverCareer,
  didStart,
  aggregateRaces,
  getDriverAggregates,
};
