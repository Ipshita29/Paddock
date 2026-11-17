const router = require('express').Router();
const c = require('../controllers/predictionController');
router.get('/next-race', c.getNextRace); // must stay above "/:season/:round"
router.get('/:season/:round', c.getRace);
module.exports = router;
