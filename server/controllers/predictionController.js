// predictionController.js - connects the prediction routes to predictionService
const prediction = require('../services/predictionService');

// GET /api/prediction/next-race
exports.getNextRace = async (req, res, next) => {
  try {
    const data = await prediction.getNextRacePrediction();
    res.json({ ok: true, data: data });
  } catch (err) {
    next(err);
  }
};

// GET /api/prediction/:season/:round
exports.getRace = async (req, res, next) => {
  try {
    const data = await prediction.getRacePrediction(req.params.season, req.params.round);
    res.json({ ok: true, data: data });
  } catch (err) {
    next(err);
  }
};

// GET /api/prediction/history
exports.getHistory = async (req, res, next) => {
  try {
    const data = await prediction.getPredictionHistory();
    res.json({ ok: true, data: data });
  } catch (err) {
    next(err);
  }
};
