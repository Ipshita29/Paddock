/*
  peopleController.js - "The Grid": every driver who has started a Grand Prix.

  Data comes from three places:
  1. people.json "archive": baked career records for 1950-2025.
  2. Jolpica: seasons after the baked ones are fetched live and merged in.
     If Jolpica is down, only the baked data is used.
  3. people.json "drivers": hand-written stories for the curated drivers.
     Other drivers get a short text built only from their real statistics.
*/
const people = require('../data/people.json');
const history = require('../data/history.json');
const jolpica = require('../services/jolpicaService');
const ApiError = jolpica.ApiError;

const BAKED_THROUGH = people.meta.bakedThrough;
const PORTRAITS = people.portraits;
const DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const PAGE_MAX = 60;
const LIVE_WAIT_MS = 6000;

// curated drivers by id
const CURATED = new Map();
for (let i = 0; i < people.drivers.length; i++) {
  CURATED.set(people.drivers[i].driverId, people.drivers[i]);
}

// world championship years for each driver id
const TITLES = new Map();
const champSeasons = Object.values(history.seasons);
for (let i = 0; i < champSeasons.length; i++) {
  const s = champSeasons[i];
  const years = TITLES.get(s.champion.driverId) || [];
  years.push(s.season);
  TITLES.set(s.champion.driverId, years);
}

// lower case and remove accents so searching "raikkonen" finds "Räikkönen"
function fold(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------- archive

function toLocation(a) {
  if (!a) return null;
  return { season: a[0], round: a[1], race: a[2], team: a[3] || null };
}

// turn one baked archive entry into a driver object
function fromBaked(e) {
  const seasons = [];
  for (let i = 0; i < e.y.length; i++) {
    const row = e.y[i];
    seasons.push({ season: row[0], teams: row[1], starts: row[2], wins: row[3], podiums: row[4], poles: row[5], points: row[6] });
  }
  let last = null;
  if (e.z) last = { season: e.z[0], round: e.z[1], race: e.z[2] };
  return {
    id: e.i,
    given: e.g,
    family: e.f,
    name: `${e.g} ${e.f}`.trim(),
    code: e.c,
    number: e.u,
    dob: e.b,
    nationality: e.a,
    seasons: seasons,
    debut: toLocation(e.d),
    firstWin: toLocation(e.w),
    last: last,
  };
}

// add live seasons from Jolpica to the baked drivers
async function addLiveData(map) {
  const agg = await jolpica.getDriverAggregates(BAKED_THROUGH + 1);
  let infoById = null;

  for (const [id, a] of agg) {
    let driver = map.get(id);

    if (!driver) {
      // a new driver who is not in the baked archive: look up personal details
      if (infoById === null) {
        infoById = new Map();
        try {
          const all = await jolpica.getAllDrivers();
          for (let i = 0; i < all.length; i++) infoById.set(all[i].driverId, all[i]);
        } catch (err) {
          // keep the empty map
        }
      }
      const info = infoById.get(id) || {};
      const nameParts = a.name.split(' ');
      driver = {
        id: id,
        given: info.givenName || nameParts[0],
        family: info.familyName || nameParts.slice(1).join(' '),
        name: info.name || a.name,
        code: info.code || a.code,
        number: info.number || null,
        dob: info.dateOfBirth || null,
        nationality: info.nationality || null,
        seasons: [],
        debut: null,
        firstWin: null,
        last: null,
      };
      map.set(id, driver);
    }

    const years = [...a.seasons.keys()].sort((x, y) => x - y);
    for (let i = 0; i < years.length; i++) {
      const year = years[i];
      const s = a.seasons.get(year);
      let alreadyThere = false;
      for (let j = 0; j < driver.seasons.length; j++) {
        if (driver.seasons[j].season === year) alreadyThere = true;
      }
      if (!alreadyThere) {
        driver.seasons.push({ season: year, teams: s.teams, starts: s.starts, wins: s.wins, podiums: s.podiums, poles: s.poles, points: round2(s.points) });
      }
    }
    driver.debut = driver.debut || a.debut;
    driver.firstWin = driver.firstWin || a.firstWin;
    driver.last = { season: a.last.season, round: a.last.round, race: a.last.race };
  }
}

// work out totals, titles and teams for every driver
function addTotals(drivers) {
  let latest = 0;
  for (let i = 0; i < drivers.length; i++) {
    for (let j = 0; j < drivers[i].seasons.length; j++) {
      if (drivers[i].seasons[j].season > latest) latest = drivers[i].seasons[j].season;
    }
  }

  for (let i = 0; i < drivers.length; i++) {
    const d = drivers[i];
    d.seasons.sort((a, b) => a.season - b.season);

    let starts = 0;
    let wins = 0;
    let podiums = 0;
    let poles = 0;
    let points = 0;
    const teams = [];
    for (let j = 0; j < d.seasons.length; j++) {
      const s = d.seasons[j];
      starts += s.starts;
      wins += s.wins;
      podiums += s.podiums;
      poles += s.poles;
      points += s.points;
      for (let k = 0; k < s.teams.length; k++) {
        if (!teams.includes(s.teams[k])) teams.push(s.teams[k]);
      }
    }

    d.stats = { starts: starts, wins: wins, podiums: podiums, poles: poles, points: round2(points) };
    d.first = d.seasons[0].season;
    d.lastSeason = d.seasons[d.seasons.length - 1].season;
    d.active = d.lastSeason === latest;
    d.titles = TITLES.get(d.id) || [];
    d.teams = teams;
  }
  return latest;
}

async function buildArchive(withLive) {
  const map = new Map();
  for (let i = 0; i < people.archive.length; i++) {
    map.set(people.archive[i].i, fromBaked(people.archive[i]));
  }

  let live = false;
  if (withLive) {
    try {
      await addLiveData(map);
      live = true;
    } catch (err) {
      // use the baked data only
    }
  }

  const list = [...map.values()];
  const latest = addTotals(list);
  const byId = new Map();
  for (let i = 0; i < list.length; i++) byId.set(list[i].id, list[i]);

  return { list: list, byId: byId, live: live, latest: latest };
}

/*
  Caching, so a request never waits long for Jolpica:
  - fresh cache: use it
  - old cache: use it now and refresh in the background
  - no cache yet: wait a few seconds for the live data, then fall back to the baked archive
*/
let cached = null;
let building = null;
let bakedOnly = null;

function refresh() {
  if (!building) {
    building = buildArchive(true)
      .then((data) => {
        let ttl = 2 * 60 * 1000;
        if (data.live) ttl = 10 * 60 * 1000;
        cached = { at: Date.now(), ttl: ttl, data: data };
        return data;
      })
      .finally(() => {
        building = null;
      });
    building.catch(() => {});
  }
  return building;
}

async function loadArchive() {
  if (cached && Date.now() - cached.at < cached.ttl) return cached.data;

  const pending = refresh();
  if (cached) return cached.data;

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), LIVE_WAIT_MS));
  const first = await Promise.race([pending.catch(() => null), timeout]);
  if (first) return first;

  if (!bakedOnly) bakedOnly = await buildArchive(false);
  return bakedOnly;
}

// ---------------------------------------------------------------- text built from real statistics

function plural(n, word) {
  if (n === 1) return `${n} ${word}`;
  return `${n} ${word}s`;
}

function listPhrase(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  const first = items.slice(0, items.length - 1);
  return `${first.join(', ')} and ${items[items.length - 1]}`;
}

function teamsPhrase(teams) {
  if (teams.length <= 3) return listPhrase(teams);
  return `${teams.length} teams, including ${listPhrase(teams.slice(0, 3))}`;
}

// short one-line description shown on the cards
function blurb(d) {
  const wins = d.stats.wins;
  const podiums = d.stats.podiums;
  const starts = d.stats.starts;
  const titleCount = d.titles.length;
  const lastYear = d.active ? 'today' : d.lastSeason;

  if (titleCount > 0) {
    let label = 'World Champion';
    if (titleCount > 1) label = `${titleCount}-time World Champion`;
    return `${label} (${d.titles.join(', ')}) with ${listPhrase(d.teams.slice(0, 2))}.`;
  }
  if (wins > 0) {
    return `Winner of ${plural(wins, 'Grand Prix')} for ${listPhrase(d.teams.slice(0, 2))}.`;
  }
  if (podiums > 0) {
    let years = `${d.first}`;
    if (d.first !== d.lastSeason) years = `${d.first} to ${lastYear}`;
    return `${plural(podiums, 'podium')} in ${plural(starts, 'start')}, ${years}.`;
  }
  if (starts === 1) return `One Grand Prix start, in ${d.first}.`;
  return `${plural(starts, 'Grand Prix start')} between ${d.first} and ${lastYear}.`;
}

// longer paragraph for drivers without a hand-written story
function generatedStory(d) {
  const wins = d.stats.wins;
  const podiums = d.stats.podiums;
  const starts = d.stats.starts;
  const points = d.stats.points;
  const titleCount = d.titles.length;

  let nationality = '';
  if (d.nationality) {
    let article = 'a';
    if (/^[aeiou]/i.test(d.nationality)) article = 'an';
    nationality = `, ${article} ${d.nationality} driver,`;
  }

  let debut = `first started in ${d.first}`;
  if (d.debut) {
    debut = `debuted at the ${d.debut.season} ${d.debut.race}`;
    if (d.debut.team) debut += ` with ${d.debut.team}`;
  }

  let ending = `and raced until ${d.lastSeason}`;
  if (d.active) ending = 'and is still racing';

  let result = 'did not score a championship point';
  if (titleCount > 0) {
    result = `won ${plural(titleCount, 'world championship')} and ${plural(wins, 'race')}`;
  } else if (wins > 0) {
    result = `won ${plural(wins, 'race')} and reached the podium ${plural(podiums, 'time')}`;
  } else if (podiums > 0) {
    result = `reached the podium ${plural(podiums, 'time')}`;
  } else if (points > 0) {
    result = `scored ${points} championship points`;
  }

  return `${d.name}${nationality} ${debut} ${ending}. Across ${plural(starts, 'Grand Prix start')} for ${teamsPhrase(d.teams)}, the driver ${result}.`;
}

// up to five key moments for drivers without hand-written highlights
function generatedHighlights(d) {
  const list = [];

  if (d.debut) {
    let text = `Debuts at the ${d.debut.race}`;
    if (d.debut.team) text += ` with ${d.debut.team}`;
    list.push({ year: d.debut.season, text: text + '.' });
  }
  if (d.firstWin) {
    let text = `Wins for the first time at the ${d.firstWin.race}`;
    if (d.firstWin.team) text += ` for ${d.firstWin.team}`;
    list.push({ year: d.firstWin.season, text: text + '.' });
  }
  for (let i = 0; i < d.titles.length; i++) {
    list.push({ year: d.titles[i], text: 'Wins the World Championship.' });
  }

  // best season: most wins, then podiums, then points
  let best = null;
  for (let i = 0; i < d.seasons.length; i++) {
    const s = d.seasons[i];
    if (best === null) {
      best = s;
    } else if (s.wins !== best.wins) {
      if (s.wins > best.wins) best = s;
    } else if (s.podiums !== best.podiums) {
      if (s.podiums > best.podiums) best = s;
    } else if (s.points > best.points) {
      best = s;
    }
  }
  if (best && (best.wins > 0 || best.podiums > 0) && !d.titles.includes(best.season)) {
    let what = plural(best.podiums, 'podium');
    if (best.wins > 0) what = plural(best.wins, 'win');
    list.push({ year: best.season, text: `Best season: ${what} with ${listPhrase(best.teams)}.` });
  }

  if (d.teams.length >= 3 && d.debut) {
    list.push({ year: d.lastSeason, text: `Has raced for ${d.teams.length} teams, including ${listPhrase(d.teams.slice(0, 3))}.` });
  }
  if (!d.active && d.last && d.stats.starts > 1) {
    list.push({ year: d.last.season, text: `Final Grand Prix start at the ${d.last.race}.` });
  }

  // remove repeats, sort by year and keep five
  const unique = [];
  const seen = [];
  for (let i = 0; i < list.length; i++) {
    const key = `${list[i].year}${list[i].text}`;
    if (!seen.includes(key)) {
      seen.push(key);
      unique.push(list[i]);
    }
  }
  unique.sort((a, b) => a.year - b.year);
  return unique.slice(0, 5);
}

// ---------------------------------------------------------------- shaping the response

function toCard(d) {
  const curated = CURATED.get(d.id);
  let description = blurb(d);
  if (curated) description = curated.tagline;

  let endYear = d.lastSeason;
  if (d.active) endYear = null;

  return {
    driverId: d.id,
    name: d.name,
    nationality: d.nationality || 'Unknown',
    number: d.number || null,
    status: d.active ? 'active' : 'retired',
    years: [d.first, endYear],
    description: description,
    image: PORTRAITS[d.id] || null,
    curated: !!curated,
    legend: !!(curated && curated.legend),
    titles: d.titles.length,
    wins: d.stats.wins,
    starts: d.stats.starts,
  };
}

// every word typed in the search box must appear in the driver's name
function matchesSearch(d, query) {
  const text = fold(`${d.name} ${d.family}`);
  const words = query.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== '' && !text.includes(words[i])) return false;
  }
  return true;
}

// did the driver race at any point during this decade (for example "1980s")?
function inDecade(d, decade) {
  const start = Number(decade.slice(0, 4));
  return d.first <= start + 9 && d.lastSeason >= start;
}

function passesFilter(d, filter) {
  if (filter === 'current') return d.active;
  if (filter === 'champions') return d.titles.length > 0;
  if (filter === 'retired') return !d.active;
  return true;
}

// a score used to put well known drivers first
function notableScore(d) {
  let score = 0;
  if (CURATED.has(d.id)) score += 1000000;
  if (PORTRAITS[d.id]) score += 500000;
  if (d.active) score += 200000;
  score += d.titles.length * 10000;
  score += d.stats.wins * 10;
  score += d.stats.starts / 10;
  return score;
}

function countWhere(list, test) {
  let count = 0;
  for (let i = 0; i < list.length; i++) {
    if (test(list[i])) count++;
  }
  return count;
}

// GET /api/people?filter=&decade=&search=&page=&limit=&sort=
exports.getPeople = async (req, res, next) => {
  try {
    const filter = req.query.filter || 'all';
    const decade = req.query.decade || '';
    const sort = req.query.sort || 'notable';

    if (!['all', 'current', 'champions', 'retired'].includes(filter)) {
      throw new ApiError(400, 'filter must be one of all, current, champions or retired.');
    }
    if (decade && !DECADES.includes(decade)) {
      throw new ApiError(400, `decade must be one of ${DECADES.join(', ')}.`);
    }
    if (!['notable', 'name', 'career'].includes(sort)) {
      throw new ApiError(400, 'sort must be notable, name or career.');
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(PAGE_MAX, Math.max(1, Number.parseInt(req.query.limit, 10) || 24));
    const query = fold(req.query.search || '').trim();

    const archive = await loadArchive();

    // search first, then the filter
    const searched = [];
    for (let i = 0; i < archive.list.length; i++) {
      if (!query || matchesSearch(archive.list[i], query)) searched.push(archive.list[i]);
    }
    const filtered = [];
    for (let i = 0; i < searched.length; i++) {
      if (passesFilter(searched[i], filter)) filtered.push(searched[i]);
    }

    // counts shown on the filter buttons
    const decadeCounts = {};
    for (let i = 0; i < DECADES.length; i++) {
      decadeCounts[DECADES[i]] = countWhere(filtered, (d) => inDecade(d, DECADES[i]));
    }
    const facets = {
      all: searched.length,
      current: countWhere(searched, (d) => d.active),
      champions: countWhere(searched, (d) => d.titles.length > 0),
      retired: countWhere(searched, (d) => !d.active),
      decades: decadeCounts,
    };

    let pool = filtered;
    if (decade) pool = filtered.filter((d) => inDecade(d, decade));

    const sorted = [...pool];
    if (sort === 'name') {
      sorted.sort((a, b) => a.family.localeCompare(b.family) || a.given.localeCompare(b.given));
    } else if (sort === 'career') {
      sorted.sort((a, b) => a.first - b.first || a.family.localeCompare(b.family));
    } else {
      sorted.sort((a, b) => notableScore(b) - notableScore(a) || a.family.localeCompare(b.family));
    }

    const pages = Math.max(1, Math.ceil(sorted.length / limit));
    const pageItems = sorted.slice((page - 1) * limit, page * limit);
    const items = [];
    for (let i = 0; i < pageItems.length; i++) items.push(toCard(pageItems[i]));

    let note = undefined;
    if (!archive.live) {
      note = 'Live current-season data is temporarily unavailable. Showing the archive through the last baked season.';
    }

    res.json({
      ok: true,
      data: {
        items: items,
        total: sorted.length,
        page: page,
        pages: pages,
        limit: limit,
        facets: facets,
        totalDrivers: archive.list.length,
        latestSeason: archive.latest,
        live: archive.live,
        note: note,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/people/:driverId
exports.getPerson = async (req, res, next) => {
  try {
    const id = req.params.driverId;
    if (!/^[a-z0-9_-]+$/i.test(id)) {
      throw new ApiError(400, 'Driver id may contain only letters, numbers, hyphens and underscores.');
    }

    const archive = await loadArchive();
    const d = archive.byId.get(id);
    if (!d) throw new ApiError(404, `No driver with id "${id}" has started a Formula 1 Grand Prix.`);
    const curated = CURATED.get(id) || null;

    const timeline = [];
    for (let i = 0; i < d.seasons.length; i++) {
      const s = d.seasons[i];
      timeline.push({
        season: s.season,
        teams: s.teams,
        starts: s.starts,
        wins: s.wins,
        podiums: s.podiums,
        poles: s.poles,
        points: s.points,
        champion: d.titles.includes(s.season),
      });
    }

    // the rival named in the curated story, if that driver is in the archive
    let rivalCard = null;
    if (curated && curated.rivalry) {
      for (let i = 0; i < archive.list.length; i++) {
        if (fold(archive.list[i].name) === fold(curated.rivalry)) {
          rivalCard = archive.list[i];
          break;
        }
      }
    }

    // up to three other drivers with a photo who raced in the same years
    const sameEra = [];
    for (let i = 0; i < archive.list.length; i++) {
      const x = archive.list[i];
      if (x.id !== id && x.first <= d.lastSeason && x.lastSeason >= d.first && PORTRAITS[x.id]) sameEra.push(x);
    }
    sameEra.sort((a, b) => notableScore(b) - notableScore(a));
    const related = [];
    for (let i = 0; i < sameEra.length && i < 3; i++) related.push(toCard(sameEra[i]));

    let endYear = d.lastSeason;
    if (d.active) endYear = null;

    let rivalry = null;
    if (curated && curated.rivalry) {
      rivalry = { name: curated.rivalry, driver: rivalCard ? toCard(rivalCard) : null };
    }

    res.json({
      ok: true,
      data: {
        ...toCard(d),
        fullName: curated ? curated.fullName : d.name,
        birthPlace: curated ? curated.birthPlace : null,
        dateOfBirth: d.dob,
        code: d.code,
        careerYears: [d.first, endYear],
        tagline: curated ? curated.tagline : null,
        story: curated ? curated.story : generatedStory(d),
        generated: !curated,
        highlights: curated ? curated.highlights : generatedHighlights(d),
        legacy: curated ? curated.legacy : null,
        rivalry: rivalry,
        pathway: curated ? curated.pathway : [],
        relatedStories: curated ? curated.relatedStories : [],
        stats: {
          titles: d.titles,
          wins: d.stats.wins,
          podiums: d.stats.podiums,
          poles: d.stats.poles,
          starts: d.stats.starts,
          points: d.stats.points,
        },
        teams: d.teams,
        debut: d.debut,
        firstWin: d.firstWin,
        timeline: timeline,
        related: related,
        sources: people.meta.sources,
        definitions: people.meta.definitions,
        live: archive.live,
      },
    });
  } catch (err) {
    next(err);
  }
};
