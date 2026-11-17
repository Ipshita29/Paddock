/** PADDOCK API server. */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { ApiError, JolpicaError } = require('./services/jolpicaService');

const app = express();
const PORT = process.env.PORT || 5001;
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim());

app.use(cors({ origin: origins }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, data: { status: 'up' } }));
app.use('/api/history', require('./routes/historyRoutes'));
app.use('/api/people', require('./routes/peopleRoutes'));
app.use('/api/prediction', require('./routes/predictionRoutes'));
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: { status: 404, message: `No API route for ${req.method} ${req.originalUrl}` } }));

// Production: serve the built React app from the same server.
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = 500;
  let message = 'Something went wrong on the server.';
  if (err instanceof ApiError) { status = err.status; message = err.message; }
  else if (err instanceof JolpicaError) { status = 502; message = 'The Formula 1 data source is temporarily unavailable. Please try again shortly.'; }
  else console.error(err);
  res.status(status).json({ ok: false, error: { status, message } });
});

if (require.main === module) app.listen(PORT, () => console.log(`PADDOCK API listening on http://localhost:${PORT}`));
module.exports = app;
