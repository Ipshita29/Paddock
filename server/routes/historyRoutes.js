const router = require('express').Router();
const c = require('../controllers/historyController');
router.get('/', c.getHistory);
router.get('/seasons', c.getSeasons); // must stay above "/:season"
router.get('/:season', c.getSeason);
module.exports = router;
