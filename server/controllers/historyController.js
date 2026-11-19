/*
  historyController.js
  Champions and decades come from data/history.json, so they always work.
  Live data from Jolpica (standings and race winners) is added when it is available.
*/
const history = require('../data/history.json');
const jolpica = require('../services/jolpicaService');
const ApiError = jolpica.ApiError;

const FIRST_SEASON = 1950;

// GET /api/history
exports.getHistory = (req, res, next) => {
  try {
    res.json({ ok: true, data: { meta: history.meta, decades: history.decades } });
  } catch (err) {
    next(err);
  }
};

// GET /api/history/seasons
exports.getSeasons = async (req, res, next) => {
  try {
    const seasons = Object.values(history.seasons);
    seasons.sort((a, b) => a.season - b.season);
    const lastCurated = seasons[seasons.length - 1].season;

    let live = false;
    const extra = [];
    try {
      const allYears = await jolpica.getSeasonsList();
      live = true;
      for (let i = 0; i < allYears.length; i++) {
        const year = allYears[i];
        if (year <= lastCurated) continue;
        const result = await jolpica.getSeasonStandings(year, 'driver');
        const first = result.standings[0];
        let leader = null;
        if (first) leader = { name: first.name, points: first.points };
        extra.push({ season: year, inProgress: true, leader: leader });
      }
    } catch (err) {
      // the curated list is enough
    }

    res.json({ ok: true, data: { seasons: [...seasons, ...extra], live: live } });
  } catch (err) {
    next(err);
  }
};

// GET /api/history/:season
exports.getSeason = async (req, res, next) => {
  try {
    const season = Number(req.params.season);
    if (!Number.isInteger(season) || season < FIRST_SEASON) {
      throw new ApiError(400, `Season must be a year from ${FIRST_SEASON} onward.`);
    }

    const curated = history.seasons[String(season)] || null;
    const detail = {
      season: season,
      ...(curated || {}),
      winners: [],
      driverStandings: [],
      constructorStandings: [],
      source: curated ? 'curated' : 'none',
      live: false,
    };

    try {
      const winners = await jolpica.getSeasonWinners(season);
      const drivers = await jolpica.getSeasonStandings(season, 'driver');
      let constructors = { standings: [] };
      if (season >= 1958) constructors = await jolpica.getSeasonStandings(season, 'constructor');

      detail.winners = winners;
      detail.driverStandings = drivers.standings.slice(0, 10);
      detail.constructorStandings = constructors.standings.slice(0, 10);
      detail.live = true;
      detail.source = 'jolpica';
    } catch (err) {
      detail.note = 'Live race data is temporarily unavailable. Showing curated champions only.';
    }

    if (!curated && !detail.live) {
      throw new ApiError(404, `No data available for the ${season} season.`);
    }
    res.json({ ok: true, data: detail });
  } catch (err) {
    next(err);
  }
};
