import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Ban, Check, Minus, Plus as PlusIcon, X } from 'lucide-react';
import { Reveal, Status } from '../components/Footer.jsx';
import { getNextRace } from '../services/api.js';

/* ----------------------------------------------------------------------------
   PREDICTION
   1. Upcoming race: the race on the left, the model's predicted podium on the right.
   2. The podium, revisited: a carousel of completed races, each in the winning team's colours.
   3. How PADDOCK predicts: three short expandable notes.
   Everything comes from GET /api/prediction/next-race. Team colours are presentation only.
---------------------------------------------------------------------------- */

// Official-style team colours by Jolpica constructor id (presentation only).
const TEAM = {
  ferrari: '#E8002D', mercedes: '#27F4D2', mclaren: '#FF8000', red_bull: '#3671C6', williams: '#64C4FF',
  alpine: '#FF87BC', renault: '#FFD800', aston_martin: '#229971', haas: '#B6BABD', rb: '#6692FF',
  alphatauri: '#6692FF', toro_rosso: '#4A6FD6', sauber: '#52E252', alfa: '#C92D4B', audi: '#C8CDD2',
  cadillac: '#A5ADB8', force_india: '#F596C8', racing_point: '#F596C8', lotus_f1: '#F5B700', marussia: '#C0392B', manor: '#C0392B', caterham: '#1E8449',
};
const teamColor = (id) => TEAM[id] || '#8A8A8A';

const pad = (n) => String(n).padStart(2, '0');
const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const initials = (n) => n.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('');
const surname = (n) => n.trim().split(/\s+/).slice(-1)[0];
const forename = (n) => n.trim().split(/\s+/).slice(0, -1).join(' ');

/** Portrait in an arched frame, or the driver's initials when no photograph exists. */
function Face({ d }) {
  const [failed, setFailed] = useState(false);
  if (d.image && !failed) return <img src={`/images/${d.image.file}`} alt={d.image.alt} style={{ objectPosition: d.image.focus }} loading="lazy" onError={() => setFailed(true)} />;
  return <span className="face__init" aria-label={`${d.name}, no photograph`}>{initials(d.name)}</span>;
}

/** Photo credits for the portraits shown, kept to one subtle line. */
function Credits({ drivers }) {
  const seen = new Map();
  drivers.forEach((d) => { if (d && d.image && d.image.credit && !seen.has(d.image.file)) seen.set(d.image.file, `${surname(d.name)}: ${d.image.credit.author}, ${d.image.credit.license}`); });
  if (!seen.size) return null;
  return <p className="pd-credits">Photos via Wikimedia Commons. {[...seen.values()].join(' · ')}</p>;
}

/* ------------------------------------------------------------------ podium */
/**
 * Three-position podium: P2 left, P1 centre (raised), P3 right.
 * `drivers` is an array of up to three {position, name, constructorName, constructorId, image}.
 * With no drivers it renders an empty, outlined podium (used while awaiting qualifying).
 */
function Podium({ drivers, size = 'lg', empty = false }) {
  const byPos = new Map((drivers || []).map((d) => [d.position, d]));
  const order = [2, 1, 3];
  return (
    <div className={`pod pod--${size} ${empty ? 'pod--empty' : ''}`} role="list" aria-label={empty ? 'Podium awaiting qualifying' : 'Podium'}>
      {order.map((pos, i) => {
        const d = byPos.get(pos);
        const c = d ? teamColor(d.constructorId) : '#6b6b6b';
        return (
          <motion.div key={pos} role="listitem" className={`pod__col pod__col--p${pos}`} style={{ '--tc': c }}
            initial={{ y: 40, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.8, delay: 0.12 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}>
            <div className="pod__glow" aria-hidden="true" />
            <div className="pod__who">
              <div className="pod__face">{d ? <Face d={d} /> : <span className="face__init face__init--ghost" aria-hidden="true">?</span>}</div>
              <p className="pod__name">{d ? <><small>{forename(d.name)}</small>{surname(d.name)}</> : <span className="pod__tba">To be set</span>}</p>
              <p className="pod__team">{d ? d.constructorName : 'Awaiting qualifying'}</p>
            </div>
            <div className="pod__plat"><span className="pod__pos num">{pos}</span></div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------- 1. next race */
function NextRace({ data }) {
  const race = data.race;
  const top3 = data.status === 'predicted' ? data.prediction.topFive.slice(0, 3).map((d, i) => ({ ...d, position: i + 1 })) : null;
  const q = race && race.qualifyingSession;
  const unavailable = ['model-unavailable', 'insufficient-history', 'data-unavailable'].includes(data.status);

  if (!race) {
    return (
      <section className="pd-next px" aria-label="Next race">
        <div className="pd-next__left"><p className="pd-kicker"><i />Next race</p><h1 className="pd-gp">No upcoming Grand Prix</h1><p className="pd-meta">{data.message}</p></div>
      </section>
    );
  }
  return (
    <section className="pd-next px" aria-label="Next race and predicted podium">
      <div className="pd-next__left">
        <motion.div initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
          <p className="pd-kicker"><i />Next race<span> / Round {race.round}</span></p>
          <h1 className="pd-gp">{race.raceName.replace(/ Grand Prix$/, '')}<em>Grand Prix</em></h1>
          <dl className="pd-info">
            <div><dt>Circuit</dt><dd>{race.circuitName}</dd></div>
            <div><dt>Country</dt><dd>{race.country}</dd></div>
            <div><dt>Race day</dt><dd className="num">{longDate(race.date)}</dd></div>
          </dl>
        </motion.div>
      </div>

      <div className="pd-next__right">
        <p className="pd-label"><i />{top3 ? 'Predicted podium' : 'Predicted podium'}</p>
        <Podium drivers={top3} empty={!top3} />
        {data.status === 'awaiting-qualifying' && (
          <div className="pd-await" role="status">
            <h2>Awaiting qualifying</h2>
            <p>PADDOCK publishes a podium only once the grid is set.{q ? <> Qualifying <span className="num">{shortDate(q.date)}{q.time ? `, ${q.time.slice(0, 5)} UTC` : ''}</span>.</> : null}</p>
          </div>
        )}
        {unavailable && <div className="pd-await" role="alert"><h2>Prediction unavailable</h2><p>{data.message}</p></div>}
        {top3 && <p className="pd-note">A statistical estimate, not a guaranteed result.</p>}
        {top3 && <Credits drivers={top3} />}
      </div>
    </section>
  );
}

/* ------------------------------------------------------- 2. past carousel */
/** Large, soft podium silhouette used as the card's background. */
function Silhouette() {
  return (
    <svg className="rc__sil" viewBox="0 0 300 160" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs><linearGradient id="silg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".9" /><stop offset="1" stopColor="currentColor" stopOpacity=".15" /></linearGradient></defs>
      <rect x="10" y="72" width="88" height="88" rx="3" fill="url(#silg)" />
      <rect x="106" y="28" width="88" height="132" rx="3" fill="url(#silg)" />
      <rect x="202" y="100" width="88" height="60" rx="3" fill="url(#silg)" />
      <text x="54" y="125" textAnchor="middle" fontSize="40" fill="#000" fillOpacity=".5" fontFamily="inherit">2</text>
      <text x="150" y="108" textAnchor="middle" fontSize="52" fill="#000" fillOpacity=".5" fontFamily="inherit">1</text>
      <text x="246" y="148" textAnchor="middle" fontSize="34" fill="#000" fillOpacity=".5" fontFamily="inherit">3</text>
    </svg>
  );
}

/* ---------------------------------------------------- prediction outcomes */
// How good the predicted winner was, judged by where that driver actually finished (classified by the server).
const OUTCOME = {
  exact: { label: 'Exact hit', Icon: Check }, podium: { label: 'Podium hit', Icon: Check }, top5: { label: 'Top 5', Icon: Minus },
  outside: { label: 'Outside top 5', Icon: X }, dnf: { label: 'Did not finish', Icon: Ban }, unavailable: { label: 'Unavailable', Icon: Minus },
};
function OutcomePill({ outcome }) {
  const k = OUTCOME[outcome] ? outcome : 'unavailable';
  const { label, Icon } = OUTCOME[k];
  return <span className={`pd-res pd-res--${k}`}><Icon size={13} aria-hidden="true" />{label}</span>;
}

/** Change from predicted to actual position: gained, dropped or exact. */
function Delta({ from, to, finished }) {
  if (finished === false) return <span className="dl dl--dnf" title="Did not finish">DNF</span>;
  const d = from - to;
  if (d === 0) return <span className="dl dl--eq" title="Exactly as predicted">Exact</span>;
  return <span className={`dl ${d > 0 ? 'dl--up' : 'dl--down'}`} title={d > 0 ? `Finished ${d} place${d > 1 ? 's' : ''} higher than predicted` : `Finished ${-d} place${d < -1 ? 's' : ''} lower than predicted`}>{d > 0 ? '\u25B2' : '\u25BC'} {Math.abs(d)}</span>;
}

function GridRow({ side, pos, d, hover, setHover, predictedRank, highlight }) {
  const linked = hover === d.driverId;
  return (
    <li className={`gr ${linked ? 'is-link' : ''} ${highlight ? 'is-key' : ''}`} style={{ '--tc': teamColor(d.constructorId) }} onMouseEnter={() => setHover(d.driverId)} onMouseLeave={() => setHover(null)}>
      <span className="gr__pos num">P{pos}</span>
      <i className="gr__bar" aria-hidden="true" />
      <span className="gr__who"><b>{d.name}</b><small>{d.constructorName}</small></span>
      <span className="gr__end">
        {side === 'pred'
          ? <span className="gr__note num">{d.finished === false ? 'DNF' : d.actualPosition === null ? '' : `finished P${d.actualPosition}`}</span>
          : <><span className="gr__note num">predicted P{predictedRank}</span><Delta from={predictedRank} to={pos} finished={d.finished} /></>}
      </span>
    </li>
  );
}

/** Evaluation summary + the model's predicted grid beside the real classification. */
function GridComparison({ r }) {
  const [hover, setHover] = useState(null);
  const sm = r.summary;
  if (!r.predictedGrid || !r.classification || sm.outcome === 'unavailable') {
    return <p className="cmp__none">The full predicted grid is unavailable for this race, so only the result is shown.</p>;
  }
  const pick = sm.predictedWinner;
  const pickRow = r.classification.find((c) => c.driverId === pick.driverId);
  const rankOf = new Map(r.predictedGrid.map((g) => [g.driverId, g.rank]));
  const finishText = sm.finished === false ? `Did not finish${pickRow && pickRow.status ? ` (${pickRow.status})` : ''}` : `P${sm.finishedPosition}`;
  return (
    <div className="cmp">
      <dl className="sum">
        <div><dt>PADDOCK predicted</dt><dd>{pick.name}</dd></div>
        <div><dt>Actual winner</dt><dd>{r.winner.name}</dd></div>
        <div className="sum__wide"><dt>{surname(pick.name)} finished</dt><dd><span className="num">{finishText}</span><OutcomePill outcome={sm.outcome} /></dd></div>
        <div><dt>Predicted top three on the podium</dt><dd><span className="num">{sm.podiumHits} of 3</span>{sm.exactPodium && <em>exact order</em>}</dd></div>
        <div><dt>Drivers in the exact position</dt><dd><span className="num">{sm.exactMatches} of {sm.fieldSize}</span></dd></div>
      </dl>
      <div className="cmp__cols">
        <section aria-label="PADDOCK predicted grid">
          <h4 className="cmp__h"><i />PADDOCK predicted grid</h4>
          <ol className="gr__list">{r.predictedGrid.map((g) => <GridRow key={g.driverId} side="pred" pos={g.rank} d={g} hover={hover} setHover={setHover} highlight={g.rank === 1} />)}</ol>
        </section>
        <section aria-label="Actual race classification">
          <h4 className="cmp__h cmp__h--act"><i />Actual race classification</h4>
          <ol className="gr__list">{r.classification.map((c) => <GridRow key={c.driverId} side="act" pos={c.position} d={c} hover={hover} setHover={setHover} predictedRank={rankOf.get(c.driverId)} highlight={c.position === 1} />)}</ol>
        </section>
      </div>
      <p className="cmp__foot">The predicted grid is the model's ranking of the whole field, rebuilt using only the races before this one. Drivers who retired are marked DNF.</p>
    </div>
  );
}

const CARD_W = 336;
function RaceCard({ r, index, open, active, onToggle, narrow }) {
  const reduce = useReducedMotion();
  const w = r.winner;
  const c = teamColor(w.constructorId);
  const openW = narrow ? Math.min(window.innerWidth - 48, 560) : Math.min(1080, window.innerWidth - 80);
  return (
    <motion.article
      className={`rc ${open ? 'is-open' : ''} ${active ? 'is-active' : ''}`}
      style={{ '--tc': c }}
      data-idx={index}
      animate={{ width: open ? openW : CARD_W }}
      transition={reduce ? { duration: 0 } : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="rc__light" aria-hidden="true" />
      <Silhouette />
      <button className="rc__btn" onClick={() => onToggle(index)} aria-expanded={open} aria-label={`${r.raceName} ${r.season}: ${open ? 'collapse' : 'expand'} the podium`}>
        <span className="rc__top">
          <span className="rc__meta num">{pad(index + 1)} · {r.season} · Round {r.round}<br />{shortDate(r.date)}</span>
          <OutcomePill outcome={r.summary ? r.summary.outcome : 'unavailable'} />
        </span>
        <span className="rc__race">{r.raceName.replace(/ Grand Prix$/, '')}<small>Grand Prix</small></span>
        <span className="rc__win">
          <em>Race winner</em>
          <b>{w.name}</b>
          <span className="rc__team"><i />{w.constructorName}</span>
        </span>
        <span className="rc__toggle" aria-hidden="true"><PlusIcon size={20} /></span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="rc__more" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
            <div className="rc__more-in">
              <Podium drivers={r.podium} size="sm" />
              <GridComparison r={r} />
              <Credits drivers={r.podium} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function Carousel({ evaluation }) {
  const races = evaluation && evaluation.races ? [...evaluation.races].filter((r) => r.winner && r.podium.length === 3).sort((a, b) => b.season - a.season || b.round - a.round) : [];
  const track = useRef(null);
  const [openIdx, setOpenIdx] = useState(-1);
  const [active, setActive] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const drag = useRef({ down: false, moved: false, x: 0, left: 0 });

  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 720);
    on(); window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const measure = useCallback(() => {
    const t = track.current; if (!t) return;
    const pl = parseFloat(getComputedStyle(t).paddingLeft) || 0;
    let best = 0; let bestD = Infinity;
    [...t.children].forEach((el, i) => { const dd = Math.abs(el.offsetLeft - pl - t.scrollLeft); if (dd < bestD) { bestD = dd; best = i; } });
    setActive(best);
  }, []);
  useEffect(() => { measure(); }, [measure, races.length, openIdx]);

  const go = (dir) => {
    const t = track.current; if (!t) return;
    const next = Math.max(0, Math.min(races.length - 1, active + dir));
    const el = t.children[next]; const pl = parseFloat(getComputedStyle(t).paddingLeft) || 0;
    t.scrollTo({ left: el.offsetLeft - pl, behavior: 'smooth' });
  };

  const toggle = (i) => {
    if (drag.current.moved) return;
    const willOpen = openIdx !== i;
    setOpenIdx(willOpen ? i : -1);
    if (willOpen) setTimeout(() => { const t = track.current; if (!t) return; const pl = parseFloat(getComputedStyle(t).paddingLeft) || 0; t.scrollTo({ left: t.children[i].offsetLeft - pl, behavior: 'smooth' }); }, 60);
  };

  // mouse drag to scroll (touch uses native scrolling)
  const onDown = (e) => { if (e.pointerType !== 'mouse') return; const t = track.current; drag.current = { down: true, moved: false, x: e.clientX, left: t.scrollLeft }; };
  const onMove = (e) => { const d = drag.current; if (!d.down) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 6) { d.moved = true; track.current.classList.add('is-drag'); } if (d.moved) track.current.scrollLeft = d.left - dx; };
  const onUp = () => { const t = track.current; drag.current.down = false; t && t.classList.remove('is-drag'); setTimeout(() => { drag.current.moved = false; }, 0); };

  return (
    <section className="pd-past" aria-labelledby="pd-past-h">
      <div className="pd-past__head px">
        <Reveal>
          <h2 id="pd-past-h" className="pd-h2">The podium. <span>Revisited.</span></h2>
          <p className="pd-sub">Every race has a result. Every prediction has a record.</p>
        </Reveal>
        {races.length > 0 && (
          <div className="pd-arrows">
            <span className="pd-count num">{pad(Math.min(active + 1, races.length))} / {races.length}</span>
            <button className="pd-arrow" onClick={() => go(-1)} disabled={active === 0} aria-label="Previous race"><ArrowLeft size={18} /></button>
            <button className="pd-arrow" onClick={() => go(1)} disabled={active >= races.length - 1} aria-label="Next race"><ArrowRight size={18} /></button>
          </div>
        )}
      </div>
      {races.length === 0 ? (
        <p className="px pd-empty">Past races are temporarily unavailable.</p>
      ) : (
        <div className="pd-track" ref={track} onScroll={() => window.requestAnimationFrame(measure)} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} tabIndex={0} aria-label="Completed races, scroll horizontally">
          {races.map((r, i) => <RaceCard key={`${r.season}-${r.round}`} r={r} index={i} open={openIdx === i} active={active === i} onToggle={toggle} narrow={narrow} />)}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- 3. the model */
// These notes mirror server/services/predictionService.js. Do not claim a feature that is not there.
const MODEL = [
  { t: 'The methodology', body: (
    <>
      <p>Before each Grand Prix, a logistic regression model studies every race since 2014 that came before it and learns which signals have pointed to winners. For the new race it scores every driver on the grid, then rescales the scores so the whole field adds up to 100%.</p>
      <p>The three drivers with the highest chances become the predicted podium, in that order. The 40 most recent races are held back to calibrate those chances, and nothing from the race itself is ever used.</p>
    </>
  ) },
  { t: 'Data sources', body: (
    <>
      <p>Everything comes from the Jolpica F1 API: race results since 2014 and qualifying results. Nine signals are weighed:</p>
      <ul>
        <li>Qualifying position (the starting grid), and how often drivers from that grid slot have won.</li>
        <li>The driver's average finish over their last five races, and their points share and wins over the last ten.</li>
        <li>The constructor's points share over the last five races, and its wins over the last ten.</li>
        <li>The driver's win record and average finish at that circuit.</li>
      </ul>
      <p>Not used: weather, tyre strategy, penalties, car reliability or sprint results.</p>
    </>
  ) },
  { t: 'Limitations', body: (
    <>
      <p>These are statistical estimates, not guaranteed outcomes. Strategy, weather, incidents and breakdowns shape every race, and no historical model can see them.</p>
      <p>Nothing is published until qualifying has been run. Rookies and renamed teams have little or no history, so the model is less certain about them. Every miss is shown as clearly as every hit.</p>
    </>
  ) },
];

function Behind() {
  const [open, setOpen] = useState(-1);
  return (
    <section className="pd-model px" aria-labelledby="pd-model-h">
      <Reveal><h2 id="pd-model-h" className="pd-h2">How PADDOCK <span>predicts.</span></h2></Reveal>
      <div className="pd-acc">
        {MODEL.map((m, i) => (
          <div className="pd-acc__item" key={m.t}>
            <button className="pd-acc__btn" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
              <span className="pd-acc__n num">{pad(i + 1)}</span><span className="pd-acc__t">{m.t}</span><PlusIcon size={22} aria-hidden="true" />
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div className="pd-acc__panel" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                  <div className="pd-acc__body">{m.body}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- page */
export default function Prediction() {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const load = () => {
    setState({ loading: true, error: null, data: null });
    getNextRace().then((data) => setState({ loading: false, error: null, data })).catch((e) => setState({ loading: false, error: e.message, data: null }));
  };
  useEffect(load, []);
  const d = state.data;
  return (
    <div className="dark pd">
      {(state.loading || state.error) && (
        <div className="pd-state px"><Status loading={state.loading} error={state.error} onRetry={load} label="Reading the grid and the model. The first load can take a minute." /></div>
      )}
      {d && <NextRace data={d} />}
      {d && <Carousel evaluation={d.evaluation} />}
      <Behind />
    </div>
  );
}
