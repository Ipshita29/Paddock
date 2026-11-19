/*
  predictionService.js
  Prepares the data from Jolpica, runs the Python model and builds the API response.

  The project has no folder for Python files, so the model source is kept in the
  PYTHON_MODEL string below and run with: python3 -I -c <source>
  Node sends one JSON document to Python and reads one JSON document back.

  Rules:
  - No qualifying result means no prediction (status "awaiting-qualifying").
  - If Python or its libraries are missing, the status is "model-unavailable". Numbers are never made up.
  - A prediction only uses races that happened BEFORE the race being predicted.
*/
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const jolpica = require('./jolpicaService');
const peopleData = require('../data/people.json');
const ApiError = jolpica.ApiError;

const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const MODEL_FIRST_SEASON = Number(process.env.MODEL_FIRST_SEASON) || 2014;
const BACKTEST_FIRST_SEASON = Number(process.env.BACKTEST_FIRST_SEASON) || 2022;
const MIN_HISTORY_RACES = 60;
const PY_TIMEOUT_MS = 180000;
const DISCLAIMER = 'These are statistical estimates built from past results, not guaranteed outcomes.';
const PORTRAITS = peopleData.portraits || {};

// ---------------------------------------------------------------- Python model
const PYTHON_MODEL = String.raw`
import sys, json, math, warnings
warnings.filterwarnings("ignore")
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

WARMUP_RACES = 20        # races that only build history; never used as training rows
CALIBRATION_RACES = 40   # the races just before the target, held out to calibrate probabilities
MIN_TRAIN_RACES = 20
PRIOR_FINISH = 10.5      # neutral finishing position used to shrink small samples

# (key, label) - order matters
FEATURES = [
    ("grid_ln",    "Qualifying position"),
    ("grid_prior", "Historical win rate from this grid slot"),
    ("drv_form",   "Driver's recent finishing average"),
    ("drv_pts",    "Driver's recent points share"),
    ("drv_wins",   "Driver's recent wins"),
    ("con_pts",    "Constructor's recent points share"),
    ("con_wins",   "Constructor's recent wins"),
    ("circ_win",   "Driver's win record at this circuit"),
    ("circ_pos",   "Driver's average finish at this circuit"),
]
COLS = [f[0] for f in FEATURES]
LABELS = dict(FEATURES)


def grid_of(entry, n):
    g = entry.get("grid")
    if not g:
        g = n
    return int(min(max(g, 1), 20))


class State:
    """Running knowledge of everything that happened BEFORE the race being featurised."""

    def __init__(self):
        self.recs = []   # one record per completed race
        self.gn = {}     # grid slot -> entries
        self.gw = {}     # grid slot -> wins
        self.circ = {}   # (circuit, driver) -> [starts, wins, sum of finishing positions]

    def featurize(self, race):
        entries = race["entries"]
        n = len(entries)
        last5, last10 = self.recs[-5:], self.recs[-10:]
        dp10, cp5 = {}, {}
        for r in last10:
            for d, p in r["pts"].items():
                dp10[d] = dp10.get(d, 0.0) + p
        for r in last5:
            for c, p in r["cpts"].items():
                cp5[c] = cp5.get(c, 0.0) + p
        max_dp10 = max(dp10.values()) if dp10 else 0.0
        max_cp5 = max(cp5.values()) if cp5 else 0.0
        out = []
        for e in entries:
            d, c = e["driverId"], e["constructorId"]
            g = grid_of(e, n)
            gn, gw = self.gn.get(g, 0), self.gw.get(g, 0)
            prior = (gw + 0.3) / (gn + 6.0)
            pos5 = [r["pos"][d] for r in last5 if d in r["pos"]]
            form = (sum(pos5) + PRIOR_FINISH * 2) / (len(pos5) + 2)
            wins10 = sum(1 for r in last10 if r["winner"] == d)
            cwins10 = sum(1 for r in last10 if r["cwinner"] == c)
            s, w, ps = self.circ.get((race["circuitId"], d), (0, 0, 0.0))
            out.append({
                "driverId": d, "constructorId": c, "grid": g,
                "name": e.get("name"), "code": e.get("code"), "constructorName": e.get("constructorName"),
                "position": e.get("position"),
                "grid_ln": math.log(g),
                "grid_prior": math.log(prior),
                "drv_form": form,
                "drv_pts": (dp10.get(d, 0.0) / max_dp10) if max_dp10 > 0 else 0.0,
                "drv_wins": wins10 / 10.0,
                "con_pts": (cp5.get(c, 0.0) / max_cp5) if max_cp5 > 0 else 0.0,
                "con_wins": cwins10 / 10.0,
                "circ_win": (w + 0.2) / (s + 4.0),
                "circ_pos": (ps + PRIOR_FINISH * 3) / (s + 3.0),
                "_prior": prior, "_wins10": wins10, "_cwins10": cwins10, "_s": s, "_w": w,
                "_avg_here": (ps / s) if s else None,
            })
        return out

    def update(self, race):
        entries = race["entries"]
        n = len(entries)
        rec = {"pos": {}, "pts": {}, "cpts": {}, "winner": None, "cwinner": None}
        for e in entries:
            d, c, p = e["driverId"], e["constructorId"], e["position"]
            g = grid_of(e, n)
            won = 1 if p == 1 else 0
            rec["pos"][d] = p
            rec["pts"][d] = e.get("points", 0.0)
            rec["cpts"][c] = rec["cpts"].get(c, 0.0) + e.get("points", 0.0)
            if won:
                rec["winner"], rec["cwinner"] = d, c
            self.gn[g] = self.gn.get(g, 0) + 1
            self.gw[g] = self.gw.get(g, 0) + won
            s, w, ps = self.circ.get((race["circuitId"], d), (0, 0, 0.0))
            self.circ[(race["circuitId"], d)] = (s + 1, w + won, ps + p)
        self.recs.append(rec)


def build_rows(races):
    st, rows = State(), []
    for i, race in enumerate(races):
        feats = st.featurize(race)
        for f in feats:
            f["race_idx"] = i
            f["y"] = 1 if f["position"] == 1 else 0
        rows.extend(feats)
        st.update(race)
    return st, pd.DataFrame(rows)


def fit_model(train, calib):
    scaler = StandardScaler().fit(train[COLS].values)
    lr = LogisticRegression(C=0.5, max_iter=5000).fit(scaler.transform(train[COLS].values), train["y"].values)
    s = lr.decision_function(scaler.transform(calib[COLS].values))
    platt = LogisticRegression(C=1e4, max_iter=5000).fit(s.reshape(-1, 1), calib["y"].values)
    return scaler, lr, platt


def score(model, df):
    scaler, lr, platt = model
    s = lr.decision_function(scaler.transform(df[COLS].values))
    raw = 1.0 / (1.0 + np.exp(-s))
    cal = platt.predict_proba(s.reshape(-1, 1))[:, 1]
    return raw / raw.sum(), cal / cal.sum()   # each race's field sums to 1


def split(df, t):
    train = df[(df.race_idx >= WARMUP_RACES) & (df.race_idx < t - CALIBRATION_RACES)]
    calib = df[(df.race_idx >= t - CALIBRATION_RACES) & (df.race_idx < t)]
    return train, calib


def importances(model):
    scaler, lr, platt = model
    slope = float(platt.coef_[0][0])
    coefs = lr.coef_[0] * slope
    order = np.argsort(-np.abs(coefs))
    return [{"key": COLS[i], "label": LABELS[COLS[i]], "weight": round(float(coefs[i]), 3)} for i in order]


def describe(row, key):
    g = row["grid"]
    if key == "grid_ln":
        return "Starts from P%d" % g
    if key == "grid_prior":
        return "%.0f%% of past entries from P%d went on to win" % (row["_prior"] * 100, g)
    if key == "drv_form":
        return "Averages P%.1f over the last five races" % row["drv_form"]
    if key == "drv_pts":
        return "Has %.0f%% of the best points haul over the last ten races" % (row["drv_pts"] * 100)
    if key == "drv_wins":
        return "%d win%s in the last ten races" % (row["_wins10"], "" if row["_wins10"] == 1 else "s")
    if key == "con_pts":
        return "Team has %.0f%% of the best team points haul over the last five races" % (row["con_pts"] * 100)
    if key == "con_wins":
        return "Team won %d of the last ten races" % row["_cwins10"]
    if key == "circ_win":
        return "%d win%s in %d start%s here" % (row["_w"], "" if row["_w"] == 1 else "s", row["_s"], "" if row["_s"] == 1 else "s") if row["_s"] else "No previous starts at this circuit"
    if key == "circ_pos":
        return ("Averages P%.1f here" % row["_avg_here"]) if row["_s"] else "No previous starts at this circuit"
    return ""


def factors_for(model, rows_df, i, top=3):
    """Why is this driver rated as they are, compared with the average car on this grid?"""
    scaler, lr, platt = model
    Z = scaler.transform(rows_df[COLS].values)
    slope = float(platt.coef_[0][0])
    contrib = lr.coef_[0] * slope * (Z[i] - Z.mean(axis=0))
    order = np.argsort(-np.abs(contrib))[:top]
    row = rows_df.iloc[i]
    return [{"key": COLS[j], "label": LABELS[COLS[j]], "effect": "helps" if contrib[j] > 0 else "hurts",
             "strength": round(float(contrib[j]), 3), "detail": describe(row, COLS[j])} for j in order]


def field_output(model, rows_df, probs, top_n=5):
    order = np.argsort(-probs)
    field = []
    for rank, i in enumerate(order, start=1):
        row = rows_df.iloc[i]
        item = {"rank": rank, "driverId": row["driverId"], "name": row["name"], "code": row["code"],
                "constructorId": row["constructorId"], "constructorName": row["constructorName"],
                "grid": int(row["grid"]), "probability": round(float(probs[i]), 5)}
        if rank <= top_n:
            item["factors"] = factors_for(model, rows_df, i)
        field.append(item)
    return field


def predict(payload):
    races, target = payload["races"], payload["target"]
    if len(races) < WARMUP_RACES + CALIBRATION_RACES + MIN_TRAIN_RACES:
        return {"error": "insufficient-history", "races": len(races)}
    state, df = build_rows(races)
    t = len(races)
    train, calib = split(df, t)
    model = fit_model(train, calib)
    target_rows = pd.DataFrame(state.featurize(target))
    raw, cal = score(model, target_rows)
    last = races[-1]
    return {
        "field": field_output(model, target_rows, cal),
        "probabilitySum": round(float(cal.sum()), 4),
        "model": {
            "name": "Calibrated logistic regression",
            "trainingRaces": int(train.race_idx.nunique()),
            "calibrationRaces": int(calib.race_idx.nunique()),
            "trainedThrough": {"season": last["season"], "round": last["round"], "raceName": last["raceName"]},
            "firstSeason": races[0]["season"],
            "importances": importances(model),
        },
    }


def race_metrics(p, y, prior):
    """p: normalised probabilities for one race; y: 0/1 winner vector; prior: baseline probabilities."""
    w = int(np.argmax(y))
    order = np.argsort(-p)
    return {
        "top1": int(order[0] == w), "top3": int(w in order[:3]), "top5": int(w in order[:5]),
        "logloss": -math.log(max(p[w], 1e-4)), "brier": float(np.sum((p - y) ** 2)),
        "prior_logloss": -math.log(max(prior[w], 1e-4)), "prior_brier": float(np.sum((prior - y) ** 2)),
        "rank": int(np.where(order == w)[0][0]) + 1,
    }


def backtest(payload):
    races, first_test = payload["races"], payload["firstTestSeason"]
    state, df = build_rows(races)
    start = WARMUP_RACES + CALIBRATION_RACES + MIN_TRAIN_RACES
    out, bins_p, bins_y = [], [], []
    agg = {k: [] for k in ["top1", "top3", "top5", "logloss", "brier", "raw_logloss", "raw_brier", "prior_logloss", "prior_brier", "pole_top1", "uniform_logloss", "uniform_brier"]}
    for t, race in enumerate(races):
        if t < start or race["season"] < first_test:
            continue
        rows = df[df.race_idx == t].reset_index(drop=True)
        if rows.empty or rows["y"].sum() != 1:
            continue
        train, calib = split(df, t)
        model = fit_model(train, calib)
        raw, cal = score(model, rows)
        y = rows["y"].values.astype(float)
        prior = np.exp(rows["grid_prior"].values)
        prior = prior / prior.sum()
        m = race_metrics(cal, y, prior)
        mr = race_metrics(raw, y, prior)
        n = len(rows)
        w = int(np.argmax(y))
        pole = int(np.argmin(rows["grid"].values))
        agg["top1"].append(m["top1"]); agg["top3"].append(m["top3"]); agg["top5"].append(m["top5"])
        agg["logloss"].append(m["logloss"]); agg["brier"].append(m["brier"])
        agg["raw_logloss"].append(mr["logloss"]); agg["raw_brier"].append(mr["brier"])
        agg["prior_logloss"].append(m["prior_logloss"]); agg["prior_brier"].append(m["prior_brier"])
        agg["pole_top1"].append(int(pole == w))
        agg["uniform_logloss"].append(math.log(n)); agg["uniform_brier"].append(1.0 - 1.0 / n)
        bins_p.extend(cal.tolist()); bins_y.extend(y.tolist())
        order = np.argsort(-cal)
        out.append({
            "season": race["season"], "round": race["round"], "raceName": race["raceName"], "date": race["date"],
            "predicted": [{"driverId": rows.iloc[i]["driverId"], "name": rows.iloc[i]["name"], "grid": int(rows.iloc[i]["grid"]), "probability": round(float(cal[i]), 4)} for i in order[:5]],
            # the complete ranking the model produced for this race, using only information from before it
            "field": [{"driverId": rows.iloc[i]["driverId"], "name": rows.iloc[i]["name"], "constructorId": rows.iloc[i]["constructorId"], "constructorName": rows.iloc[i]["constructorName"], "grid": int(rows.iloc[i]["grid"]), "probability": round(float(cal[i]), 4)} for i in order],
            "pole": {"driverId": rows.iloc[pole]["driverId"], "name": rows.iloc[pole]["name"]},
            "actual": {"driverId": rows.iloc[w]["driverId"], "name": rows.iloc[w]["name"], "grid": int(rows.iloc[w]["grid"]), "probability": round(float(cal[w]), 4), "rank": m["rank"]},
            "hit": bool(m["top1"]), "poleHit": bool(pole == w),
        })
    if not out:
        return {"error": "no-test-races"}
    mean = lambda k: round(float(np.mean(agg[k])), 4)
    edges = [0.0, 0.02, 0.05, 0.10, 0.20, 0.40, 1.0001]
    bp, by = np.array(bins_p), np.array(bins_y)
    calibration = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (bp >= lo) & (bp < hi)
        if mask.sum():
            calibration.append({"from": lo, "to": min(hi, 1.0), "predicted": round(float(bp[mask].mean()), 4), "observed": round(float(by[mask].mean()), 4), "count": int(mask.sum())})
    return {
        "summary": {
            "races": len(out),
            "from": {"season": out[0]["season"], "round": out[0]["round"]},
            "to": {"season": out[-1]["season"], "round": out[-1]["round"]},
            "model": {"top1": mean("top1"), "top3": mean("top3"), "top5": mean("top5"), "logLoss": mean("logloss"), "brier": mean("brier")},
            "uncalibrated": {"logLoss": mean("raw_logloss"), "brier": mean("raw_brier")},
            "poleBaseline": {"top1": mean("pole_top1")},
            "gridBaseline": {"logLoss": mean("prior_logloss"), "brier": mean("prior_brier")},
            "uniform": {"logLoss": mean("uniform_logloss"), "brier": mean("uniform_brier")},
            "calibration": calibration,
            "protocol": "Walk-forward: for every race the model is re-fitted using only earlier races (the latest %d held out for calibration)." % CALIBRATION_RACES,
        },
        "races": out,
    }


payload = json.load(sys.stdin)
mode = payload.get("mode")
result = predict(payload) if mode == "predict" else backtest(payload)
sys.stdout.write(json.dumps(result))
`;

// ---------------------------------------------------------------- running Python

function makeError(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function runPython(payload) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(PYTHON_BIN, ['-I', '-c', PYTHON_MODEL], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      reject(makeError(`Could not start ${PYTHON_BIN}`, 'PYTHON_MISSING'));
      return;
    }

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(makeError('Prediction model timed out', 'PYTHON_TIMEOUT'));
    }, PY_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(makeError(`Python interpreter "${PYTHON_BIN}" could not be started (${err.code || err.message})`, 'PYTHON_MISSING'));
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      if (exitCode !== 0) {
        const missingLibrary = /ModuleNotFoundError|ImportError/.test(stderr);
        if (missingLibrary) {
          reject(makeError('Python is installed but pandas, numpy or scikit-learn is missing', 'PYTHON_DEPS'));
        } else {
          const lastLine = stderr.trim().split('\n').pop();
          reject(makeError(`Prediction model failed: ${lastLine}`, 'PYTHON_FAILED'));
        }
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(makeError('Prediction model returned unreadable output', 'PYTHON_FAILED'));
      }
    });

    child.stdin.on('error', () => {
      // the close or error handler above reports the problem
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

function isModelUnavailable(err) {
  const codes = ['PYTHON_MISSING', 'PYTHON_DEPS', 'PYTHON_FAILED', 'PYTHON_TIMEOUT'];
  return codes.includes(err.code);
}

// ---------------------------------------------------------------- race data

let datasetCache = null;

// every finished race since MODEL_FIRST_SEASON, oldest first
async function loadDataset() {
  if (datasetCache && Date.now() - datasetCache.at < 10 * 60 * 1000) return datasetCache.races;

  const races = [];
  const lastSeason = new Date().getFullYear();

  for (let season = MODEL_FIRST_SEASON; season <= lastSeason; season++) {
    const results = await jolpica.getSeasonResults(season);
    const qualifying = await jolpica.getSeasonQualifying(season);

    // qualifying position of each driver, for each round
    const qualiByRound = new Map();
    for (let i = 0; i < qualifying.length; i++) {
      const positions = new Map();
      for (let j = 0; j < qualifying[i].qualifying.length; j++) {
        const row = qualifying[i].qualifying[j];
        positions.set(row.driverId, row.position);
      }
      qualiByRound.set(qualifying[i].round, positions);
    }

    for (let i = 0; i < results.length; i++) {
      const race = results[i];
      if (race.results.length === 0) continue;

      const quali = qualiByRound.get(race.round);
      const entries = [];
      for (let j = 0; j < race.results.length; j++) {
        const r = race.results[j];
        let grid = null;
        if (quali && quali.get(r.driverId)) {
          grid = quali.get(r.driverId);
        } else if (r.grid > 0) {
          grid = r.grid;
        }
        entries.push({
          driverId: r.driverId,
          code: r.code,
          name: r.name,
          constructorId: r.constructorId,
          constructorName: r.constructorName,
          grid: grid,
          position: r.position,
          positionText: r.positionText,
          status: r.status,
          points: r.points,
        });
      }

      races.push({
        season: race.season,
        round: race.round,
        raceName: race.raceName,
        circuitId: race.circuitId,
        date: race.date,
        entries: entries,
      });
    }
  }

  races.sort((a, b) => a.season - b.season || a.round - b.round);
  datasetCache = { at: Date.now(), races: races };
  return races;
}

// ---------------------------------------------------------------- backtest (cached in memory and on disk)

const backtestCache = new Map();

async function getBacktest(races) {
  const last = races[races.length - 1];
  const key = `v2-${MODEL_FIRST_SEASON}-${BACKTEST_FIRST_SEASON}-${last.season}-${last.round}-${races.length}`;
  if (backtestCache.has(key)) return backtestCache.get(key);

  const file = path.join(os.tmpdir(), 'paddock-cache', `backtest-${key}.json`);
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    backtestCache.set(key, saved);
    return saved;
  } catch (err) {
    // no saved copy yet, so run the model below
  }

  const result = await runPython({ mode: 'backtest', races: races, firstTestSeason: BACKTEST_FIRST_SEASON });
  if (result.error) throw new Error(`Backtest could not run: ${result.error}`);
  backtestCache.set(key, result);
  try {
    fs.writeFileSync(file, JSON.stringify(result));
  } catch (err) {
    // saving to disk is optional
  }
  return result;
}

// ---------------------------------------------------------------- building the response

function raceSummary(race) {
  return {
    season: race.season,
    round: race.round,
    raceName: race.raceName,
    circuitId: race.circuitId,
    circuitName: race.circuitName,
    locality: race.locality,
    country: race.country,
    lat: race.lat,
    long: race.long,
    date: race.date,
    time: race.time,
    url: race.url,
    qualifyingSession: race.sessions && race.sessions.qualifying,
  };
}

// a driver's portrait from people.json, or null if there is none
function imageOf(driverId) {
  const p = PORTRAITS[driverId];
  if (!p) return null;
  return { file: p.file, alt: p.alt, focus: p.focus, credit: p.credit };
}

function addImage(driver) {
  return { ...driver, image: imageOf(driver.driverId) };
}

// add a portrait to the predicted winner and the top five
function withPortraits(prediction) {
  if (!prediction) return prediction;
  const topFive = [];
  for (let i = 0; i < prediction.topFive.length; i++) topFive.push(addImage(prediction.topFive[i]));
  return { ...prediction, winner: addImage(prediction.winner), topFive: topFive };
}

/*
  How good was the predicted winner? It depends on where that driver really finished:
  exact (P1), podium (P2-P3), top5 (P4-P5), outside (P6 or lower),
  dnf (did not finish) and unavailable (no prediction or no result).
*/
function classifyOutcome(position, finished) {
  if (!Number.isInteger(position) || position < 1) return 'unavailable';
  if (!finished) return 'dnf';
  if (position === 1) return 'exact';
  if (position <= 3) return 'podium';
  if (position <= 5) return 'top5';
  return 'outside';
}

// a driver finished the race if their position text is a number (not "R", "D", "W" and so on)
function isFinisher(entry) {
  return /^\d+$/.test(String(entry.positionText));
}

// compare the predicted order with the real result of one race
function compareRace(r, raw) {
  let field = null;
  if (Array.isArray(r.field)) field = r.field;

  let rawEntries = [];
  if (raw) {
    rawEntries = [...raw.entries];
    rawEntries.sort((a, b) => a.position - b.position);
  }

  if (!field || rawEntries.length === 0) {
    let classification = null;
    if (rawEntries.length > 0) classification = rawEntries;
    return { predictedGrid: null, classification: classification, summary: { outcome: 'unavailable' } };
  }

  // the real result
  const classification = [];
  const actualByDriver = new Map();
  for (let i = 0; i < rawEntries.length; i++) {
    const e = rawEntries[i];
    const row = {
      position: e.position,
      driverId: e.driverId,
      name: e.name,
      constructorId: e.constructorId,
      constructorName: e.constructorName,
      finished: isFinisher(e),
      status: e.status || null,
      image: imageOf(e.driverId),
    };
    classification.push(row);
    actualByDriver.set(e.driverId, row);
  }

  // the predicted order, with where each driver really finished
  const predictedGrid = [];
  for (let i = 0; i < field.length; i++) {
    const f = field[i];
    const actual = actualByDriver.get(f.driverId);
    predictedGrid.push({
      rank: i + 1,
      driverId: f.driverId,
      name: f.name,
      constructorId: f.constructorId,
      constructorName: f.constructorName,
      startGrid: f.grid,
      actualPosition: actual ? actual.position : null,
      finished: actual ? actual.finished : null,
    });
  }

  const pick = predictedGrid[0];

  let podiumHits = 0;
  let exactPodium = true;
  for (let i = 0; i < 3 && i < predictedGrid.length; i++) {
    const d = predictedGrid[i];
    if (d.actualPosition !== null && d.actualPosition <= 3 && d.finished) podiumHits++;
    if (d.actualPosition !== i + 1) exactPodium = false;
  }

  let exactMatches = 0;
  for (let i = 0; i < predictedGrid.length; i++) {
    if (predictedGrid[i].actualPosition === predictedGrid[i].rank) exactMatches++;
  }

  return {
    predictedGrid: predictedGrid,
    classification: classification,
    summary: {
      outcome: classifyOutcome(pick.actualPosition, pick.finished),
      predictedWinner: { driverId: pick.driverId, name: pick.name, constructorName: pick.constructorName },
      finishedPosition: pick.actualPosition,
      finished: pick.finished,
      podiumHits: podiumHits, // how many of the predicted top three finished in the real top three
      exactPodium: exactPodium, // true only when all three positions match
      exactMatches: exactMatches, // drivers whose predicted rank equals their finishing position
      fieldSize: predictedGrid.length,
    },
  };
}

const enrichedCache = new WeakMap();

// add the real podium and winner to every backtest race
function withPodiums(evaluation, allRaces) {
  if (!evaluation || !evaluation.races) return evaluation;
  if (enrichedCache.has(evaluation)) return enrichedCache.get(evaluation);

  const rawByKey = new Map();
  for (let i = 0; i < allRaces.length; i++) {
    rawByKey.set(`${allRaces[i].season}-${allRaces[i].round}`, allRaces[i]);
  }

  const races = [];
  for (let i = 0; i < evaluation.races.length; i++) {
    const r = evaluation.races[i];
    const raw = rawByKey.get(`${r.season}-${r.round}`);

    const podium = [];
    if (raw) {
      const top = raw.entries.filter((e) => e.position >= 1 && e.position <= 3);
      top.sort((a, b) => a.position - b.position);
      for (let j = 0; j < top.length; j++) {
        podium.push({
          position: top[j].position,
          driverId: top[j].driverId,
          name: top[j].name,
          constructorId: top[j].constructorId,
          constructorName: top[j].constructorName,
          image: imageOf(top[j].driverId),
        });
      }
    }

    const winner = podium[0] || null;
    const rest = { ...r };
    delete rest.field;

    races.push({
      ...rest,
      ...compareRace(r, raw),
      circuitId: raw ? raw.circuitId : null,
      podium: podium,
      winner: winner,
      predictedPick: { ...r.predicted[0], image: imageOf(r.predicted[0].driverId) },
    });
  }

  const result = { ...evaluation, races: races };
  enrichedCache.set(evaluation, result);
  return result;
}

// compare the predicted winner with the real result (null if the race has not been run)
function compare(field, actualRows) {
  if (actualRows.length === 0) return null;

  let winner = null;
  for (let i = 0; i < actualRows.length; i++) {
    if (actualRows[i].position === 1) {
      winner = actualRows[i];
      break;
    }
  }

  let winnerInField = null;
  for (let i = 0; i < field.length; i++) {
    if (field[i].driverId === winner.driverId) {
      winnerInField = field[i];
      break;
    }
  }

  const podium = [];
  for (let i = 0; i < actualRows.length; i++) {
    const r = actualRows[i];
    if (r.position <= 3) {
      podium.push({ position: r.position, driverId: r.driverId, name: r.name, constructorName: r.constructorName });
    }
  }

  return {
    status: 'completed',
    winner: { driverId: winner.driverId, name: winner.name, constructorName: winner.constructorName, grid: winner.grid },
    predictedWinnerCorrect: field[0].driverId === winner.driverId,
    probabilityGivenToWinner: winnerInField ? winnerInField.probability : null,
    rankGivenToWinner: winnerInField ? winnerInField.rank : null,
    podium: podium,
  };
}

// ---------------------------------------------------------------- public functions

async function getRacePrediction(season, round) {
  const seasonNum = Number(season);
  const roundNum = Number(round);
  if (!Number.isInteger(seasonNum) || !Number.isInteger(roundNum) || roundNum < 1) {
    throw new ApiError(400, 'Season and round must be whole numbers, for example /api/prediction/2026/21.');
  }
  if (seasonNum <= MODEL_FIRST_SEASON) {
    throw new ApiError(400, `Predictions are available from the ${MODEL_FIRST_SEASON + 1} season onward, because the model needs earlier seasons as history.`);
  }

  const schedule = await jolpica.getSchedule(seasonNum);
  let race = null;
  for (let i = 0; i < schedule.length; i++) {
    if (schedule[i].round === roundNum) race = schedule[i];
  }
  if (!race) throw new ApiError(404, `No race found for season ${seasonNum}, round ${roundNum}.`);

  const base = { race: raceSummary(race), disclaimer: DISCLAIMER };

  const qualifying = await jolpica.getRaceQualifying(seasonNum, roundNum);
  if (qualifying.length === 0) {
    return {
      ...base,
      status: 'awaiting-qualifying',
      message: 'Qualifying has not been run yet, so there is no grid to work from. PADDOCK will not publish a prediction until the grid is set.',
      grid: [],
    };
  }

  const grid = [];
  for (let i = 0; i < qualifying.length; i++) {
    const q = qualifying[i];
    grid.push({ position: q.position, driverId: q.driverId, name: q.name, code: q.code, constructorName: q.constructorName, q1: q.q1, q2: q.q2, q3: q.q3 });
  }

  // only races before this one are used as history
  const all = await loadDataset();
  const history = [];
  for (let i = 0; i < all.length; i++) {
    const r = all[i];
    if (r.season < seasonNum || (r.season === seasonNum && r.round < roundNum)) history.push(r);
  }
  if (history.length < MIN_HISTORY_RACES) {
    return {
      ...base,
      status: 'insufficient-history',
      message: `Only ${history.length} earlier races are available; at least ${MIN_HISTORY_RACES} are needed.`,
      grid: grid,
    };
  }

  const entries = [];
  for (let i = 0; i < qualifying.length; i++) {
    const q = qualifying[i];
    entries.push({ driverId: q.driverId, code: q.code, name: q.name, constructorId: q.constructorId, constructorName: q.constructorName, grid: q.position });
  }
  const target = { season: seasonNum, round: roundNum, raceName: race.raceName, circuitId: race.circuitId, entries: entries };

  let model;
  let evaluation;
  try {
    model = await runPython({ mode: 'predict', races: history, target: target });
    if (model.error) throw makeError(model.error, 'PYTHON_FAILED');
    evaluation = await getBacktest(all).catch(() => null);
  } catch (err) {
    if (isModelUnavailable(err)) {
      return {
        ...base,
        status: 'model-unavailable',
        message: `${err.message}. No prediction is shown because PADDOCK never substitutes made-up numbers.`,
        grid: grid,
      };
    }
    throw err;
  }

  const actualRows = await jolpica.getRaceResult(seasonNum, roundNum).catch(() => []);

  // the full field without the "factors" detail
  const field = [];
  for (let i = 0; i < model.field.length; i++) {
    const row = { ...model.field[i] };
    delete row.factors;
    field.push(row);
  }

  return {
    ...base,
    status: 'predicted',
    grid: grid,
    prediction: withPortraits({
      winner: model.field[0],
      topFive: model.field.slice(0, 5),
      field: field,
      probabilitySum: model.probabilitySum,
    }),
    model: model.model,
    result: compare(model.field, actualRows) || { status: 'upcoming' },
    evaluation: evaluation,
  };
}

async function getNextRacePrediction() {
  const next = await jolpica.getNextRace();
  if (!next) {
    return { status: 'season-complete', message: 'The calendar has no upcoming Grand Prix.', disclaimer: DISCLAIMER, evaluation: null, latest: null };
  }

  const prediction = await getRacePrediction(next.season, next.round);

  // the most recent finished race the model had predicted, for the "how did it do" section
  const all = await loadDataset();
  const backtest = prediction.evaluation || (await getBacktest(all).catch(() => null));
  const evaluation = withPodiums(backtest, all);

  let latest = null;
  if (evaluation && evaluation.races.length > 0) {
    latest = evaluation.races[evaluation.races.length - 1];
  }
  return { ...prediction, evaluation: evaluation, latest: latest };
}

module.exports = { getRacePrediction, getNextRacePrediction };
