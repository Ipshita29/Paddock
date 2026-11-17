/**
 * peopleController.js
 * ------------------------------------------------------------------
 * THE GRID: every driver who has started a Formula 1 World Championship Grand Prix.
 *
 * Data layers
 *  1. people.json "archive": per-driver career records for 1950-2025, aggregated from
 *     Jolpica results by jolpicaService.aggregateRaces (the same function that merges live data).
 *  2. Live merge: seasons after `meta.bakedThrough` are fetched from Jolpica (cached) and
 *     added, so the current season stays up to date. If Jolpica is down, the baked data is used.
 *  3. people.json "drivers": curated editorial (stories, highlights, legacy, rivalries, pathways).
 *     Drivers without a curated feature get a plain summary generated ONLY from verified statistics.
 *  4. people.json "portraits": the single place that maps a driver to a photograph.
 */
const people = require('../data/people.json');
const history = require('../data/history.json');
const jolpica = require('../services/jolpicaService');
const { ApiError } = jolpica;

const BAKED_THROUGH = people.meta.bakedThrough;
const CURATED = new Map(people.drivers.map((d) => [d.driverId, d]));
const PORTRAITS = people.portraits;
const DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const PAGE_MAX = 60;

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// World titles per driver, from the same champions table the History pages use.
const TITLES = new Map();
Object.values(history.seasons).forEach((s) => {
  const list = TITLES.get(s.champion.driverId) || [];
  list.push(s.season); TITLES.set(s.champion.driverId, list);
});

// ------------------------------------------------------------------ archive
const locOf = (a) => (a ? { season: a[0], round: a[1], race: a[2], team: a[3] || null } : null);

function fromBaked(e) {
  return {
    id: e.i, given: e.g, family: e.f, name: `${e.g} ${e.f}`.trim(), code: e.c, number: e.u, dob: e.b, nationality: e.a,
    seasons: e.y.map(([season, teams, starts, wins, podiums, poles, points]) => ({ season, teams, starts, wins, podiums, poles, points })),
    debut: locOf(e.d), firstWin: locOf(e.w), last: e.z ? { season: e.z[0], round: e.z[1], race: e.z[2] } : null,
  };
}

/** Combine the baked archive with live results (a Map from aggregateRaces) when available. */
function assemble(agg) {
  const map = new Map(people.archive.map((e) => [e.i, fromBaked(e)]));
  let info = null;
  const infoFor = async () => { if (!info) { try { info = new Map((await jolpica.getAllDrivers()).map((x) => [x.driverId, x])); } catch (_) { info = new Map(); } } return info; };
  return { map, infoFor, agg };
}

async function buildArchive(withLive) {
  const { map, infoFor } = assemble(null);
  let live = false;
  if (withLive) {
    try {
      const agg = await jolpica.getDriverAggregates(BAKED_THROUGH + 1);
      for (const [id, a] of agg) {
        let d = map.get(id);
        if (!d) {
          const i = (await infoFor()).get(id) || {};
          d = { id, given: i.givenName || a.name.split(' ')[0], family: i.familyName || a.name.split(' ').slice(1).join(' '), name: i.name || a.name, code: i.code || a.code, number: i.number || null, dob: i.dateOfBirth || null, nationality: i.nationality || null, seasons: [], debut: null, firstWin: null, last: null };
          map.set(id, d);
        }
        [...a.seasons.entries()].sort((x, y) => x[0] - y[0]).forEach(([season, s]) => {
          if (!d.seasons.some((x) => x.season === season)) d.seasons.push({ season, teams: s.teams, starts: s.starts, wins: s.wins, podiums: s.podiums, poles: s.poles, points: Math.round(s.points * 100) / 100 });
        });
        d.debut = d.debut || a.debut;
        d.firstWin = d.firstWin || a.firstWin;
        d.last = { season: a.last.season, round: a.last.round, race: a.last.race };
      }
      live = true;
    } catch (_) { /* baked data only */ }
  }

  const latest = Math.max(...[...map.values()].flatMap((d) => d.seasons.map((s) => s.season)));
  const list = [...map.values()].map((d) => {
    d.seasons.sort((a, b) => a.season - b.season);
    const sum = (k) => d.seasons.reduce((a, s) => a + s[k], 0);
    d.stats = { starts: sum('starts'), wins: sum('wins'), podiums: sum('podiums'), poles: sum('poles'), points: Math.round(sum('points') * 100) / 100 };
    d.first = d.seasons[0].season; d.lastSeason = d.seasons[d.seasons.length - 1].season;
    d.active = d.lastSeason === latest;
    d.titles = TITLES.get(d.id) || [];
    d.teams = [...new Set(d.seasons.flatMap((s) => s.teams))];
    return d;
  });
  return { list, byId: new Map(list.map((d) => [d.id, d])), live, latest };
}

/**
 * Stale-while-revalidate: a request never waits on a slow Jolpica.
 *  - fresh cache  -> use it;
 *  - stale cache  -> use it now and refresh in the background;
 *  - cold start   -> give the live merge a few seconds, otherwise serve the baked archive
 *                    (the live merge keeps running and is used from the next request on).
 */
let memo = null;
let building = null;
let bakedMemo = null;
const LIVE_WAIT_MS = 6000;

function refresh() {
  if (!building) {
    building = buildArchive(true)
      .then((data) => { memo = { at: Date.now(), ttl: data.live ? 10 * 60 * 1000 : 2 * 60 * 1000, data }; return data; })
      .finally(() => { building = null; });
    building.catch(() => {});
  }
  return building;
}

async function loadArchive() {
  if (memo && Date.now() - memo.at < memo.ttl) return memo.data;
  const pending = refresh();
  if (memo) return memo.data;
  const first = await Promise.race([pending.catch(() => null), new Promise((r) => setTimeout(() => r(null), LIVE_WAIT_MS))]);
  if (first) return first;
  if (!bakedMemo) bakedMemo = await buildArchive(false);
  return bakedMemo;
}

// ------------------------------------------------------------------ factual text (no invention)
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const listPhrase = (arr) => (arr.length <= 1 ? arr[0] || '' : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);
const teamsPhrase = (teams) => (teams.length <= 3 ? `${listPhrase(teams)}` : `${teams.length} teams, including ${listPhrase(teams.slice(0, 3))}`);

function blurb(d) {
  const { wins, podiums, starts } = d.stats; const t = d.titles.length;
  if (t) return `${t === 1 ? 'World Champion' : `${t}-time World Champion`} (${d.titles.join(', ')}) with ${listPhrase(d.teams.slice(0, 2))}.`;
  if (wins) return `Winner of ${plural(wins, 'Grand Prix')} for ${listPhrase(d.teams.slice(0, 2))}.`;
  if (podiums) return `${plural(podiums, 'podium')} in ${plural(starts, 'start')}, ${d.first}${d.first === d.lastSeason ? '' : ` to ${d.active ? 'today' : d.lastSeason}`}.`;
  return starts === 1 ? `One Grand Prix start, in ${d.first}.` : `${plural(starts, 'Grand Prix start')} between ${d.first} and ${d.active ? 'today' : d.lastSeason}.`;
}

function generatedStory(d) {
  const { wins, podiums, starts, points } = d.stats; const t = d.titles.length;
  const nat = d.nationality ? `, ${/^[aeiou]/i.test(d.nationality) ? 'an' : 'a'} ${d.nationality} driver,` : '';
  const debut = d.debut ? `debuted at the ${d.debut.season} ${d.debut.race}${d.debut.team ? ` with ${d.debut.team}` : ''}` : `first started in ${d.first}`;
  const tail = d.active ? 'and is still racing' : `and raced until ${d.lastSeason}`;
  let result;
  if (t) result = `won ${plural(t, 'world championship')} and ${plural(wins, 'race')}`;
  else if (wins) result = `won ${plural(wins, 'race')} and reached the podium ${plural(podiums, 'time')}`;
  else if (podiums) result = `reached the podium ${plural(podiums, 'time')}`;
  else if (points > 0) result = `scored ${points} championship points`;
  else result = 'did not score a championship point';
  return `${d.name}${nat} ${debut} ${tail}. Across ${plural(starts, 'Grand Prix start')} for ${teamsPhrase(d.teams)}, the driver ${result}.`;
}

function generatedHighlights(d) {
  const out = [];
  if (d.debut) out.push({ year: d.debut.season, text: `Debuts at the ${d.debut.race}${d.debut.team ? ` with ${d.debut.team}` : ''}.` });
  if (d.firstWin) out.push({ year: d.firstWin.season, text: `Wins for the first time at the ${d.firstWin.race}${d.firstWin.team ? ` for ${d.firstWin.team}` : ''}.` });
  d.titles.forEach((y) => out.push({ year: y, text: 'Wins the World Championship.' }));
  const best = [...d.seasons].sort((a, b) => b.wins - a.wins || b.podiums - a.podiums || b.points - a.points)[0];
  if (best && (best.wins || best.podiums) && !d.titles.includes(best.season)) out.push({ year: best.season, text: `Best season: ${best.wins ? plural(best.wins, 'win') : plural(best.podiums, 'podium')} with ${listPhrase(best.teams)}.` });
  if (d.teams.length >= 3 && d.debut) out.push({ year: d.lastSeason, text: `Has raced for ${d.teams.length} teams, including ${listPhrase(d.teams.slice(0, 3))}.` });
  if (!d.active && d.last && d.stats.starts > 1) out.push({ year: d.last.season, text: `Final Grand Prix start at the ${d.last.race}.` });
  const seen = new Set(); const uniq = out.filter((h) => { const k = `${h.year}${h.text}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return uniq.sort((a, b) => a.year - b.year).slice(0, 5);
}

// ------------------------------------------------------------------ shaping
const portrait = (id) => PORTRAITS[id] || null;

function toCard(d) {
  const c = CURATED.get(d.id);
  return {
    driverId: d.id,
    name: d.name,
    nationality: d.nationality || 'Unknown',
    number: d.number || null,
    status: d.active ? 'active' : 'retired',
    years: [d.first, d.active ? null : d.lastSeason],
    description: c ? c.tagline : blurb(d),
    image: portrait(d.id),
    curated: !!c,
    legend: !!(c && c.legend),
    titles: d.titles.length,
    wins: d.stats.wins,
    starts: d.stats.starts,
  };
}

function matches(d, q) { const hay = fold(`${d.name} ${d.family}`); return q.split(/\s+/).filter(Boolean).every((tok) => hay.includes(tok)); }
const inDecade = (d, dec) => { const start = Number(dec.slice(0, 4)); return d.first <= start + 9 && d.lastSeason >= start; };
const notable = (d) => (CURATED.has(d.id) ? 1e6 : 0) + (PORTRAITS[d.id] ? 5e5 : 0) + (d.active ? 2e5 : 0) + d.titles.length * 1e4 + d.stats.wins * 10 + d.stats.starts / 10;

// GET /api/people?filter=&decade=&search=&page=&limit=&sort=
exports.getPeople = async (req, res, next) => {
  try {
    const { filter = 'all', decade = '', sort = 'notable' } = req.query;
    if (!['all', 'current', 'champions', 'retired'].includes(filter)) throw new ApiError(400, 'filter must be one of all, current, champions or retired.');
    if (decade && !DECADES.includes(decade)) throw new ApiError(400, `decade must be one of ${DECADES.join(', ')}.`);
    if (!['notable', 'name', 'career'].includes(sort)) throw new ApiError(400, 'sort must be notable, name or career.');
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(PAGE_MAX, Math.max(1, Number.parseInt(req.query.limit, 10) || 24));
    const q = fold(req.query.search || '').trim();

    const arc = await loadArchive();
    const base = q ? arc.list.filter((d) => matches(d, q)) : arc.list;
    const byFilter = (d) => (filter === 'current' ? d.active : filter === 'champions' ? d.titles.length > 0 : filter === 'retired' ? !d.active : true);
    const filtered = base.filter(byFilter);
    const facets = {
      all: base.length, current: base.filter((d) => d.active).length, champions: base.filter((d) => d.titles.length).length, retired: base.filter((d) => !d.active).length,
      decades: Object.fromEntries(DECADES.map((dec) => [dec, filtered.filter((d) => inDecade(d, dec)).length])),
    };
    const pool = decade ? filtered.filter((d) => inDecade(d, decade)) : filtered;
    const sorted = [...pool].sort(sort === 'name' ? (a, b) => a.family.localeCompare(b.family) || a.given.localeCompare(b.given)
      : sort === 'career' ? (a, b) => a.first - b.first || a.family.localeCompare(b.family)
        : (a, b) => notable(b) - notable(a) || a.family.localeCompare(b.family));
    const pages = Math.max(1, Math.ceil(sorted.length / limit));
    const items = sorted.slice((page - 1) * limit, page * limit).map(toCard);
    res.json({ ok: true, data: { items, total: sorted.length, page, pages, limit, facets, totalDrivers: arc.list.length, latestSeason: arc.latest, live: arc.live,
      note: arc.live ? undefined : 'Live current-season data is temporarily unavailable. Showing the archive through the last baked season.' } });
  } catch (err) { next(err); }
};

// GET /api/people/:driverId
exports.getPerson = async (req, res, next) => {
  try {
    const id = req.params.driverId;
    if (!/^[a-z0-9_-]+$/i.test(id)) throw new ApiError(400, 'Driver id may contain only letters, numbers, hyphens and underscores.');
    const arc = await loadArchive();
    const d = arc.byId.get(id);
    if (!d) throw new ApiError(404, `No driver with id "${id}" has started a Formula 1 Grand Prix.`);
    const c = CURATED.get(id) || null;

    const timeline = d.seasons.map((s) => ({ season: s.season, teams: s.teams, starts: s.starts, wins: s.wins, podiums: s.podiums, poles: s.poles, points: s.points, champion: d.titles.includes(s.season) }));
    const rivalCard = c && c.rivalry ? arc.list.find((x) => fold(x.name) === fold(c.rivalry)) : null;
    const related = arc.list.filter((x) => x.id !== id && x.first <= d.lastSeason && x.lastSeason >= d.first && PORTRAITS[x.id])
      .sort((a, b) => notable(b) - notable(a)).slice(0, 3).map(toCard);

    res.json({ ok: true, data: {
      ...toCard(d),
      fullName: c ? c.fullName : d.name,
      birthPlace: c ? c.birthPlace : null,
      dateOfBirth: d.dob,
      code: d.code,
      careerYears: [d.first, d.active ? null : d.lastSeason],
      tagline: c ? c.tagline : null,
      story: c ? c.story : generatedStory(d),
      generated: !c,
      highlights: c ? c.highlights : generatedHighlights(d),
      legacy: c ? c.legacy : null,
      rivalry: c && c.rivalry ? { name: c.rivalry, driver: rivalCard ? toCard(rivalCard) : null } : null,
      pathway: c ? c.pathway : [],
      relatedStories: c ? c.relatedStories : [],
      stats: { titles: d.titles, wins: d.stats.wins, podiums: d.stats.podiums, poles: d.stats.poles, starts: d.stats.starts, points: d.stats.points },
      teams: d.teams,
      debut: d.debut, firstWin: d.firstWin,
      timeline,
      related,
      sources: people.meta.sources,
      definitions: people.meta.definitions,
      live: arc.live,
    } });
  } catch (err) { next(err); }
};
