/** predictionController.js - thin request/response layer over predictionService. */
const prediction = require('../services/predictionService');

// GET /api/prediction/next-race
exports.getNextRace = async (req, res, next) => {
  try { res.json({ ok: true, data: await prediction.getNextRacePrediction() }); } catch (err) { next(err); }
};

// GET /api/prediction/:season/:round
exports.getRace = async (req, res, next) => {
  try { res.json({ ok: true, data: await prediction.getRacePrediction(req.params.season, req.params.round) }); } catch (err) { next(err); }
};
