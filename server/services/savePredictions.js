// savePredictions.js - run "npm run save-predictions" (needs Python) after each race.
// It runs the model on every past race and writes the result to data/predictions.json.
const fs = require('fs');
const prediction = require('./predictionService');

async function main() {
  const saved = await prediction.buildSaved();
  fs.writeFileSync(prediction.SAVED_FILE, JSON.stringify(saved));
  console.log(`Saved ${saved.evaluation.races.length} predictions to ${prediction.SAVED_FILE}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
