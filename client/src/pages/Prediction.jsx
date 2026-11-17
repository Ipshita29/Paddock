import React, { useEffect, useState } from 'react';
import { Check, X, Info } from 'lucide-react';
import { Plus, Reveal, SectionHead, Faq, Status } from '../components/Footer.jsx';
import { getNextRace, getRacePrediction } from '../services/api.js';

const pct = (p, digits = 0) => (p > 0 && p < 0.005 && digits === 0 ? '<1%' : `${(p * 100).toFixed(digits)}%`);
const fmtDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const METHOD = [
  { q: 'How does the model work?', a: "Logistic regression trained on past Grands Prix. It weighs qualifying position, the historical win rate of that grid slot, recent finishing form, recent points share and wins, constructor form, and the driver's record at the circuit." },
  { q: 'How is data leakage prevented?', a: "Training uses only races before the target race, in chronological order. The 40 most recent races are held out to calibrate the probabilities, and each race's field is scaled to sum to 100%. The backtest re-fits the model for every race using only earlier races." },
  { q: 'What if qualifying data is missing?', a: 'PADDOCK shows no prediction. If the model cannot run, the page says so instead of showing placeholder numbers.' },
  { q: 'Can I trust the percentages?', a: 'Treat them as estimates. The calibration table compares what the model said with how often drivers really won, and results are shaped heavily by strategy, weather and incidents.' },
];

function RaceCards({ race }) {
  const q = race.qualifyingSession;
  return (
    <Reveal className="status-cards">
      <div className="scrd"><Plus size={14} className="plus--sm">Grand Prix</Plus><p className="scrd__v">{race.raceName}</p></div>
      <div className="scrd"><Plus size={14} className="plus--sm">Circuit</Plus><p className="scrd__v">{race.circuitName}</p><p className="muted" style={{ fontSize: 14 }}>{race.locality}, {race.country}</p></div>
      <div className="scrd"><Plus size={14} className="plus--sm">Race day, round {race.round}</Plus><p className="scrd__v">{fmtDate(race.date)}</p>{q && <p className="muted num" style={{ fontSize: 14 }}>Qualifying {shortDate(q.date)}{q.time ? `, ${q.time.slice(0, 5)} UTC` : ''}</p>}</div>
    </Reveal>
  );
}

function Grid({ grid }) {
  if (!grid || !grid.length) return null;
  return (
    <section className="pr-sec" aria-label="Qualifying grid">
      <SectionHead label="Grid" lead="The qualifying" tail="grid." count={grid.length} />
      <ol className="glist">{grid.map((g) => <li key={g.driverId}><span className="npill num">{g.position}</span><span className="glist__n">{g.name}</span><span className="glist__t">{g.constructorName}</span></li>)}</ol>
    </section>
  );
}

function Outcome({ result }) {
  if (!result || result.status !== 'completed') return null;
  return (
    <section className="pr-sec" aria-label="Prediction against the real result">
      <SectionHead label="Result" lead="Prediction against" tail="the real result." />
      <div className="px">
        <div className="outcome">
          <span className={`npill ${result.predictedWinnerCorrect ? '' : 'npill--miss'}`}>{result.predictedWinnerCorrect ? <Check size={16} aria-label="Correct" /> : <X size={16} aria-label="Missed" />}</span>
          <p>{result.predictedWinnerCorrect ? "The model's top pick won." : "The model's top pick did not win."} <b>{result.winner.name}</b> ({result.winner.constructorName}) won from P{result.winner.grid}; the model had given them <span className="num">{pct(result.probabilityGivenToWinner)}</span>, ranking them <span className="num">#{result.rankGivenToWinner}</span> in the field.</p>
          <p className="muted">Podium: {result.podium.map((p) => `${p.position}. ${p.name}`).join('  ·  ')}</p>
        </div>
      </div>
    </section>
  );
}

function PredictionBody({ data }) {
  const { prediction: p, model, grid } = data;
  const w = p.winner; const max = p.topFive[0].probability;
  const topW = Math.max(...model.importances.map((x) => Math.abs(x.weight)));
  return (
    <>
      <Reveal className="px"><div className="winner">
        <div><Plus>Predicted winner (estimate)</Plus><p className="winner__name">{w.name}</p><p className="winner__team">{w.constructorName} · starts P{w.grid}</p></div>
        <p className="winner__prob num" aria-label={`${(w.probability * 100).toFixed(0)} percent estimated chance`}>{pct(w.probability)}</p>
      </div></Reveal>
      <p className="px disclaimer"><Info size={16} aria-hidden="true" /> These are statistical estimates built from past results. They are not guaranteed outcomes and not betting advice.</p>

      <section className="pr-sec" aria-label="Top five contenders">
        <SectionHead label="Top five" lead="The top five" tail="contenders." count={5} />
        <ol className="top5 top5--px">
          {p.topFive.map((d) => (
            <li key={d.driverId} className={d.rank === 1 ? 'win' : ''}>
              <span className="npill num">{d.rank}</span>
              <span className="top5__name">{d.name}<small>{d.constructorName} · P{d.grid}</small></span>
              <span className="top5__pct num">{pct(d.probability)}</span>
              <span className="top5__bar" aria-hidden="true"><span style={{ width: `${(d.probability / max) * 100}%` }} /></span>
              <details className="why">
                <summary>Why the model rates {d.name.split(' ').slice(-1)[0]} this way</summary>
                <ul>{d.factors.map((f) => <li key={f.key}><span className={`why__tag why__tag--${f.effect}`}>{f.effect === 'helps' ? 'Helps' : 'Holds back'}</span> <b>{f.label}.</b> {f.detail}.</li>)}</ul>
                <p className="muted" style={{ fontSize: 13 }}>Compared with the average car on this grid.</p>
              </details>
            </li>
          ))}
        </ol>
      </section>

      <section className="pr-sec" aria-label="Win probability, whole field">
        <SectionHead label="Whole field" lead="Win probability," tail="every driver." count={p.field.length} />
        <div className="px">
          <div className="table-scroll">
            <table className="ftable">
              <thead><tr><th scope="col">Driver</th><th scope="col">Team</th><th scope="col" className="r">Grid</th><th scope="col" className="r">Win chance</th></tr></thead>
              <tbody>{p.field.map((d) => <tr key={d.driverId}><th scope="row">{d.name}</th><td>{d.constructorName}</td><td className="r num">{d.grid}</td><td className="r num">{(d.probability * 100).toFixed(1)}%</td></tr>)}</tbody>
              <tfoot><tr><th scope="row" colSpan={3}>Total across the field</th><td className="r num">{(p.field.reduce((a, d) => a + d.probability, 0) * 100).toFixed(1)}%</td></tr></tfoot>
            </table>
          </div>
        </div>
      </section>

      <Grid grid={grid} />

      <section className="pr-sec" aria-label="How the model thinks">
        <SectionHead label="The model" lead="How the model" tail="thinks." />
        <div className="px model">
          <p className="model__lead">{model.name}, trained on <span className="num">{model.trainingRaces}</span> races since {model.firstSeason} (the latest <span className="num">{model.calibrationRaces}</span> were held back to calibrate the probabilities). It used only races before this one: the last was the {model.trainedThrough.season} {model.trainedThrough.raceName}.</p>
          <p className="muted">It does not simply back pole position. Longer bars matter more.</p>
          <ul className="weights">
            {model.importances.map((f) => {
              const better = f.key === 'grid_ln' || f.key === 'drv_form' || f.key === 'circ_pos' ? f.weight < 0 : f.weight > 0;
              return (
                <li key={f.key}><span>{f.label}</span>
                  <span className="wbar" aria-hidden="true"><span className={better ? '' : 'wbar--warn'} style={{ width: `${(Math.abs(f.weight) / topW) * 100}%` }} /></span>
                  <span className="num weights__v">{f.weight > 0 ? '+' : ''}{f.weight.toFixed(2)}</span></li>
              );
            })}
          </ul>
          <p className="muted" style={{ fontSize: 13 }}>Weights are in log-odds units on standardised inputs. A negative weight on position or finishing average means a lower number (a better position) raises the chance. Factors overlap, so read them as a guide, not an exact recipe.</p>
        </div>
      </section>
      <Outcome result={data.result} />
    </>
  );
}

function Evaluation({ evaluation, onPick, selected }) {
  if (!evaluation) return <section className="pr-sec"><SectionHead label="Accuracy history" lead="Scored in the open," tail="race by race." /><p className="px muted">The backtest could not be loaded right now.</p></section>;
  const s = evaluation.summary; const recent = [...evaluation.races].reverse().slice(0, 14);
  return (
    <>
      <section className="pr-sec" aria-label="Prediction accuracy history">
        <SectionHead label="Accuracy history" lead="Scored in the open," tail="race by race." count={s.races} />
        <Reveal className="plans2">
          {[[pct(s.model.top1, 1), 'Winner picked correctly', true], [pct(s.poleBaseline.top1, 1), '"Pick the pole-sitter" baseline'], [pct(s.model.top3, 1), "Winner in the model's top 3"], [pct(s.model.top5, 1), "Winner in the model's top 5"]].map(([v, l, hit]) => (
            <div key={l} className={`vcard ${hit ? 'vcard--hit' : ''}`}><Plus size={14} className="plus--sm">{l}</Plus><b className="num">{v}</b></div>
          ))}
        </Reveal>
        <p className="px muted" style={{ marginTop: 18, maxWidth: '80ch', fontSize: 15 }}>{s.protocol} {s.races} races, {s.from.season} to round {s.to.round} of {s.to.season}. The model is a modest improvement on backing pole position; results are shaped heavily by chance.</p>
        <div className="qtable">
          <div>
            <h3 className="h3">Probability <span className="dim">quality</span></h3>
            {[['Equal chance for everyone', s.uniform], ['Grid-slot history only', s.gridBaseline], ['PADDOCK, before calibration', s.uncalibrated], ['PADDOCK, calibrated', s.model]].map(([l, v], i) => (
              <div key={l} className={`qr ${i === 3 ? 'hl' : ''}`}><span>{l}</span><span className="num">log loss {v.logLoss.toFixed(3)}</span><span className="num">Brier {v.brier.toFixed(3)}</span></div>
            ))}
            <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>Lower is better.</p>
          </div>
          <div>
            <h3 className="h3">Are the percentages <span className="dim">honest?</span></h3>
            {s.calibration.map((c) => (
              <div key={c.from} className="calib">
                <span className="num">{pct(c.from)} to {pct(c.to)}</span>
                <span className="calib__bars" aria-hidden="true"><span style={{ width: `${Math.min(c.predicted / 0.7, 1) * 100}%` }} /><span style={{ width: `${Math.min(c.observed / 0.7, 1) * 100}%` }} /></span>
                <span className="num">said {pct(c.predicted, 1)}, won {pct(c.observed, 1)}</span>
              </div>
            ))}
            <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>White: predicted. Orange: observed.</p>
          </div>
        </div>
      </section>

      <section className="pr-sec" aria-label="Recent races">
        <SectionHead label="Recent races" lead="Prediction and" tail="result." count={recent.length} />
        <p className="px muted" style={{ marginTop: -28, marginBottom: 24, fontSize: 15 }}>Select a race to replay the model's prediction for it.</p>
        {recent.map((r, i) => {
          const key = `${r.season}-${r.round}`;
          return (
            <div key={key} className={`rrow ${selected === key ? 'is-open' : ''}`}>
              <span className="npill num">{i + 1}</span>
              <button className="rrow__race" onClick={() => onPick(r)}>{r.season} {r.raceName.replace(' Grand Prix', '')}</button>
              <span>Model: {r.predicted[0].name} <b className="num rb">{pct(r.predicted[0].probability)}</b></span>
              <span>Winner: {r.actual.name} <b className="num rb">rated #{r.actual.rank}</b></span>
              <span className={`rrow__res ${r.hit ? 'hit' : 'miss'}`}>{r.hit ? <><Check size={15} aria-label="Correct" /> Hit</> : <><X size={15} aria-label="Missed" /> Miss</>}</span>
            </div>
          );
        })}
      </section>
    </>
  );
}

export default function Prediction() {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [review, setReview] = useState({ key: null, loading: false, error: null, data: null });
  const load = () => {
    setState({ loading: true, error: null, data: null });
    getNextRace().then((data) => setState({ loading: false, error: null, data })).catch((e) => setState({ loading: false, error: e.message, data: null }));
  };
  useEffect(load, []);
  const pick = (r) => {
    const key = `${r.season}-${r.round}`;
    setReview({ key, loading: true, error: null, data: null });
    getRacePrediction(r.season, r.round)
      .then((data) => { setReview({ key, loading: false, error: null, data }); setTimeout(() => document.getElementById('review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); })
      .catch((e) => setReview({ key, loading: false, error: e.message, data: null }));
  };
  const d = state.data;

  return (
    <div className="dark">
      <div className="phead px">
        <h1 className="h1">Prediction</h1>
        <p>A statistical estimate of the next Grand Prix winner, rebuilt from historical results after every qualifying session. Estimates, never guarantees.</p>
        <span className="npill num" aria-label="Round">{d && d.race ? d.race.round : '—'}</span>
      </div>

      <Status loading={state.loading} error={state.error} onRetry={load} label="Reading the grid and running the model. The first load can take a minute." />

      {d && d.race && (
        <>
          <section style={{ paddingBottom: 'clamp(48px, 7vw, 96px)' }} aria-label="Next Grand Prix">
            <RaceCards race={d.race} />
            {d.status === 'awaiting-qualifying' && <div className="scrd scrd--wide" role="status"><span className="npill">!</span><div><b>No prediction yet</b><p>{d.message} Below is how the model has performed on races that are already finished.</p></div></div>}
            {['model-unavailable', 'insufficient-history', 'data-unavailable'].includes(d.status) && <div className="scrd scrd--wide scrd--err" role="alert"><span className="npill">!</span><div><b>Prediction model unavailable</b><p>{d.message} PADDOCK never shows invented numbers. The qualifying grid is still shown below.</p></div></div>}
            {d.status === 'season-complete' && <div className="scrd scrd--wide"><span className="npill">!</span><div><b>Season complete</b><p>{d.message}</p></div></div>}
          </section>

          {d.status === 'predicted' && <PredictionBody data={d} />}
          {['model-unavailable', 'insufficient-history', 'data-unavailable'].includes(d.status) && <Grid grid={d.grid} />}

          <Evaluation evaluation={d.evaluation} onPick={pick} selected={review.key} />

          <div id="review" className="review">
            <Status loading={review.loading} error={review.error} label="Replaying the model for that race" />
            {review.data && review.data.status === 'predicted' && (
              <>
                <div className="px" style={{ paddingTop: 24 }}><Plus>Race review</Plus><h2 className="h2" style={{ margin: '14px 0 8px' }}>{review.data.race.season} {review.data.race.raceName}</h2><p className="muted" style={{ marginBottom: 28 }}>Reconstructed using only the races before it.</p></div>
                <RaceCards race={review.data.race} />
                <div style={{ height: 40 }} />
                <PredictionBody data={review.data} />
              </>
            )}
          </div>
        </>
      )}
      {d && !d.race && d.status === 'season-complete' && <p className="px muted" style={{ paddingBottom: 80, fontSize: 20 }}>{d.message}</p>}

      <section className="pr-sec" style={{ paddingBottom: 'clamp(72px, 10vw, 150px)' }} aria-label="Method">
        <SectionHead label="Method" lead="How it" tail="works." count={METHOD.length} />
        <div className="px" style={{ maxWidth: 1040, marginLeft: 'auto' }}><Faq items={METHOD} /></div>
      </section>
    </div>
  );
}
