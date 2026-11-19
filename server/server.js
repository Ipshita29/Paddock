// PADDOCK API server
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { ApiError, JolpicaError } = require('./services/jolpicaService');

const app = express();
const PORT = process.env.PORT || 5001;

const allowedOrigins = [];
const originList = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',');
for (let i = 0; i < originList.length; i++) {
  allowedOrigins.push(originList[i].trim());
}

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, data: { status: 'up' } });
});
app.use('/api/history', require('./routes/historyRoutes'));
app.use('/api/people', require('./routes/peopleRoutes'));
app.use('/api/prediction', require('./routes/predictionRoutes'));

// any other /api URL
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: { status: 404, message: `No API route for ${req.method} ${req.originalUrl}` } });
});

// in production the same server also serves the built React app
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h' }));
  app.get('*', (req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// error handler: every error ends up here
app.use((err, req, res, next) => {
  let status = 500;
  let message = 'Something went wrong on the server.';

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
  } else if (err instanceof JolpicaError) {
    status = 502;
    message = 'The Formula 1 data source is temporarily unavailable. Please try again shortly.';
  } else {
    console.error(err);
  }

  res.status(status).json({ ok: false, error: { status: status, message: message } });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`PADDOCK API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
