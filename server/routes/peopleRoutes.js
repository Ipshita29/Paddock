const router = require('express').Router();
const c = require('../controllers/peopleController');
router.get('/', c.getPeople);
router.get('/:driverId', c.getPerson);
module.exports = router;
