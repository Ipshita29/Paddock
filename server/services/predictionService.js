/**
 * predictionService.js
 * ------------------------------------------------------------------
 * Prepares model inputs from Jolpica data, runs the Python model and
 * packages the result for the API.
 *
 * Where the model lives
 * ---------------------
 * The project structure has no folder for Python files, so the model's source
 * is kept in PYTHON_MODEL below and executed with `python3 -I -c <source>`.
 * Node sends one JSON document on stdin and reads one JSON document from stdout.
 * Nothing is written to disk by Python and no extra process stays running.
 *
 * Honesty rules
 * -------------
 *  - No qualifying result -> no prediction (status "awaiting-qualifying").
 *  - Python or its libraries missing -> status "model-unavailable", never fake numbers.
 *  - Every prediction is made only from races that happened BEFORE the target race.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const jolpica = require('./jolpicaService');
const { ApiError } = jolpica;

const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const MODEL_FIRST_SEASON = Number(process.env.MODEL_FIRST_SEASON) || 2014;
const BACKTEST_FIRST_SEASON = Number(process.env.BACKTEST_FIRST_SEASON) || 2022;
const MIN_HISTORY_RACES = 60; // warm-up (20) + training (>=0) + calibration (40)
const PY_TIMEOUT_MS = 180000;

// ====================================================================
// PYTHON MODEL
// ====================================================================
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

// ====================================================================
// Running Python
// ====================================================================
function runPython(payload) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(PYTHON_BIN, ['-I', '-c', PYTHON_MODEL], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      reject(Object.assign(new Error(`Could not start ${PYTHON_BIN}`), { code: 'PYTHON_MISSING' }));
      return;
    }
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Object.assign(new Error('Prediction model timed out'), { code: 'PYTHON_TIMEOUT' })); }, PY_TIMEOUT_MS);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(Object.assign(new Error(`Python interpreter "${PYTHON_BIN}" could not be started (${err.code || err.message})`), { code: 'PYTHON_MISSING' }));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const missing = /ModuleNotFoundError|ImportError/.test(stderr);
        reject(Object.assign(new Error(missing ? 'Python is installed but pandas, numpy or scikit-learn is missing' : `Prediction model failed: ${stderr.trim().split('\n').pop()}`), { code: missing ? 'PYTHON_DEPS' : 'PYTHON_FAILED' }));
        return;
      }
      try { resolve(JSON.parse(stdout)); } catch (e) { reject(Object.assign(new Error('Prediction model returned unreadable output'), { code: 'PYTHON_FAILED' })); }
    });
    child.stdin.on('error', () => { /* handled by close/error */ });
    child.stdin.end(JSON.stringify(payload));
  });
}

const isModelUnavailable = (err) => ['PYTHON_MISSING', 'PYTHON_DEPS', 'PYTHON_FAILED', 'PYTHON_TIMEOUT'].includes(err.code);

// ====================================================================
// Dataset
// ====================================================================
let datasetMemo = null;

/** Every completed race since MODEL_FIRST_SEASON, oldest first, with qualifying-based grid positions. */
async function loadDataset() {
  if (datasetMemo && Date.now() - datasetMemo.at < 10 * 60 * 1000) return datasetMemo.races;
  const races = [];
  const lastSeason = new Date().getFullYear();
  for (let season = MODEL_FIRST_SEASON; season <= lastSeason; season += 1) {
    const results = await jolpica.getSeasonResults(season);
    const qualifying = await jolpica.getSeasonQualifying(season);
    const qualiByRound = new Map(qualifying.map((q) => [q.round, new Map(q.qualifying.map((row) => [row.driverId, row.position]))]));
    results.forEach((race) => {
      if (!race.results.length) return;
      const quali = qualiByRound.get(race.round);
      races.push({
        season: race.season,
        round: race.round,
        raceName: race.raceName,
        circuitId: race.circuitId,
        date: race.date,
        entries: race.results.map((r) => ({
          driverId: r.driverId,
          code: r.code,
          name: r.name,
          constructorId: r.constructorId,
          constructorName: r.constructorName,
          grid: (quali && quali.get(r.driverId)) || (r.grid > 0 ? r.grid : null),
          position: r.position,
          points: r.points,
        })),
      });
    });
  }
  races.sort((a, b) => a.season - b.season || a.round - b.round);
  datasetMemo = { at: Date.now(), races };
  return races;
}

// ====================================================================
// Backtest (cached in memory and on disk)
// ====================================================================
const backtestMemo = new Map();

async function getBacktest(races) {
  const last = races[races.length - 1];
  const key = `${MODEL_FIRST_SEASON}-${BACKTEST_FIRST_SEASON}-${last.season}-${last.round}-${races.length}`;
  if (backtestMemo.has(key)) return backtestMemo.get(key);
  const file = path.join(os.tmpdir(), 'paddock-cache', `backtest-${key}.json`);
  try {
    const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
    backtestMemo.set(key, cached);
    return cached;
  } catch (_) { /* compute below */ }
  const result = await runPython({ mode: 'backtest', races, firstTestSeason: BACKTEST_FIRST_SEASON });
  if (result.error) throw new Error(`Backtest could not run: ${result.error}`);
  backtestMemo.set(key, result);
  try { fs.writeFileSync(file, JSON.stringify(result)); } catch (_) { /* optional */ }
  return result;
}

// ====================================================================
// Public API
// ====================================================================
const raceSummary = (race) => ({
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
});

const DISCLAIMER = 'These are statistical estimates built from past results, not guaranteed outcomes.';

function compare(field, actualRows) {
  if (!actualRows.length) return null;
  const winner = actualRows.find((r) => r.position === 1);
  const predictedWinner = field[0];
  const actualEntry = field.find((f) => f.driverId === winner.driverId);
  return {
    status: 'completed',
    winner: { driverId: winner.driverId, name: winner.name, constructorName: winner.constructorName, grid: winner.grid },
    predictedWinnerCorrect: predictedWinner.driverId === winner.driverId,
    probabilityGivenToWinner: actualEntry ? actualEntry.probability : null,
    rankGivenToWinner: actualEntry ? actualEntry.rank : null,
    podium: actualRows.filter((r) => r.position <= 3).map((r) => ({ position: r.position, driverId: r.driverId, name: r.name, constructorName: r.constructorName })),
  };
}

async function getRacePrediction(season, round) {
  const seasonNum = Number(season);
  const roundNum = Number(round);
  if (!Number.isInteger(seasonNum) || !Number.isInteger(roundNum) || roundNum < 1) throw new ApiError(400, 'Season and round must be whole numbers, for example /api/prediction/2026/21.');
  if (seasonNum <= MODEL_FIRST_SEASON) throw new ApiError(400, `Predictions are available from the ${MODEL_FIRST_SEASON + 1} season onward, because the model needs earlier seasons as history.`);

  const schedule = await jolpica.getSchedule(seasonNum);
  const race = schedule.find((r) => r.round === roundNum);
  if (!race) throw new ApiError(404, `No race found for season ${seasonNum}, round ${roundNum}.`);

  const base = { race: raceSummary(race), disclaimer: DISCLAIMER };
  const qualifying = await jolpica.getRaceQualifying(seasonNum, roundNum);
  if (!qualifying.length) {
    return {
      ...base,
      status: 'awaiting-qualifying',
      message: 'Qualifying has not been run yet, so there is no grid to work from. PADDOCK will not publish a prediction until the grid is set.',
      grid: [],
    };
  }
  const grid = qualifying.map((q) => ({ position: q.position, driverId: q.driverId, name: q.name, code: q.code, constructorName: q.constructorName, q1: q.q1, q2: q.q2, q3: q.q3 }));

  const all = await loadDataset();
  const history = all.filter((r) => r.season < seasonNum || (r.season === seasonNum && r.round < roundNum));
  if (history.length < MIN_HISTORY_RACES) {
    return { ...base, status: 'insufficient-history', message: `Only ${history.length} earlier races are available; at least ${MIN_HISTORY_RACES} are needed.`, grid };
  }

  const target = {
    season: seasonNum,
    round: roundNum,
    raceName: race.raceName,
    circuitId: race.circuitId,
    entries: qualifying.map((q) => ({ driverId: q.driverId, code: q.code, name: q.name, constructorId: q.constructorId, constructorName: q.constructorName, grid: q.position })),
  };

  let model;
  let evaluation;
  try {
    model = await runPython({ mode: 'predict', races: history, target });
    if (model.error) throw Object.assign(new Error(model.error), { code: 'PYTHON_FAILED' });
    evaluation = await getBacktest(all).catch(() => null);
  } catch (err) {
    if (isModelUnavailable(err)) return { ...base, status: 'model-unavailable', message: `${err.message}. No prediction is shown because PADDOCK never substitutes made-up numbers.`, grid };
    throw err;
  }

  const actualRows = await jolpica.getRaceResult(seasonNum, roundNum).catch(() => []);
  return {
    ...base,
    status: 'predicted',
    grid,
    prediction: {
      winner: model.field[0],
      topFive: model.field.slice(0, 5),
      field: model.field.map(({ factors, ...rest }) => rest),
      probabilitySum: model.probabilitySum,
    },
    model: model.model,
    result: compare(model.field, actualRows) || { status: 'upcoming' },
    evaluation,
  };
}

async function getNextRacePrediction() {
  const next = await jolpica.getNextRace();
  if (!next) {
    return { status: 'season-complete', message: 'The calendar has no upcoming Grand Prix.', disclaimer: DISCLAIMER, evaluation: null, latest: null };
  }
  const prediction = await getRacePrediction(next.season, next.round);
  // The most recent completed race that the model had predicted, for the "how did it do" section.
  const evaluation = prediction.evaluation || (await loadDataset().then(getBacktest).catch(() => null));
  const latest = evaluation && evaluation.races.length ? evaluation.races[evaluation.races.length - 1] : null;
  return { ...prediction, evaluation, latest };
}

module.exports = { getRacePrediction, getNextRacePrediction };
