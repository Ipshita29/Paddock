/**
 * historyController.js
 * Curated decades and baked champions come from data/history.json, which always works.
 * Live Jolpica data (standings and race winners) is added when available and cached.
 */
const history = require('../data/history.json');
const jolpica = require('../services/jolpicaService');
const { ApiError } = jolpica;

const FIRST_SEASON = 1950;

// GET /api/history
exports.getHistory = (req, res, next) => {
  try {
    res.json({ ok: true, data: { meta: history.meta, decades: history.decades } });
  } catch (err) { next(err); }
};

// GET /api/history/seasons
exports.getSeasons = async (req, res, next) => {
  try {
    const seasons = Object.values(history.seasons).sort((a, b) => a.season - b.season);
    const lastCurated = seasons[seasons.length - 1].season;
    let live = false;
    const extra = [];
    try {
      const all = await jolpica.getSeasonsList();
      live = true;
      for (const year of all.filter((y) => y > lastCurated)) {
        const { standings } = await jolpica.getSeasonStandings(year, 'driver');
        extra.push({ season: year, inProgress: true, leader: standings[0] ? { name: standings[0].name, points: standings[0].points } : null });
      }
    } catch (_) { /* curated list is enough */ }
    res.json({ ok: true, data: { seasons: [...seasons, ...extra], live } });
  } catch (err) { next(err); }
};

// GET /api/history/:season
exports.getSeason = async (req, res, next) => {
  try {
    const season = Number(req.params.season);
    if (!Number.isInteger(season) || season < FIRST_SEASON) throw new ApiError(400, `Season must be a year from ${FIRST_SEASON} onward.`);
    const curated = history.seasons[String(season)] || null;
    const detail = { season, ...(curated || {}), winners: [], driverStandings: [], constructorStandings: [], source: curated ? 'curated' : 'none', live: false };
    try {
      const [winners, drivers, constructors] = [
        await jolpica.getSeasonWinners(season),
        await jolpica.getSeasonStandings(season, 'driver'),
        season >= 1958 ? await jolpica.getSeasonStandings(season, 'constructor') : { standings: [] },
      ];
      detail.winners = winners;
      detail.driverStandings = drivers.standings.slice(0, 10);
      detail.constructorStandings = constructors.standings.slice(0, 10);
      detail.live = true;
      detail.source = 'jolpica';
    } catch (_) {
      detail.note = 'Live race data is temporarily unavailable. Showing curated champions only.';
    }
    if (!curated && !detail.live) throw new ApiError(404, `No data available for the ${season} season.`);
    res.json({ ok: true, data: detail });
  } catch (err) { next(err); }
};
