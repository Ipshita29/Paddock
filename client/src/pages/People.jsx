import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Search, Star } from 'lucide-react';
import { Plus, Reveal, SectionHead, Credit, Status } from '../components/Footer.jsx';
import { getPeople, getPerson } from '../services/api.js';

/* ----------------------------------------------------------------------------
   THE GRID: driver archive + magazine-style driver profiles.
   Photographs: every image path goes through imageSrc() below, and the mapping from
   a driver to a photograph lives in server/data/people.json ("portraits"). To replace
   or add a photo, drop the file in client/public/images and edit that one entry.
---------------------------------------------------------------------------- */
const IMAGE_BASE = '/images/';
const imageSrc = (image) => (image ? `${IMAGE_BASE}${image.file}` : null);
const focusOf = (image) => (image && image.focus ? image.focus : '50% 50%');

const FILTERS = [['all', 'All drivers'], ['current', 'Current drivers'], ['champions', 'World Champions'], ['retired', 'Retired drivers']];
const DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const PAGE_SIZE = 24;

const initials = (name) => name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('');
const careerLabel = ([a, b]) => (b === null ? `${a} to present` : a === b ? `${a}` : `${a} to ${b}`);
const fmtDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null);

/** Photograph with a consistent crop, or a designed placeholder when no photograph is available. */
function Portrait({ driver, large = false, eager = false }) {
  const [failed, setFailed] = useState(false);
  const src = imageSrc(driver.image);
  if (!src || failed) {
    return (
      <div className={`gph ${large ? 'gph--lg' : ''}`} role="img" aria-label={`${driver.name}: photograph not yet available`}>
        <span className="gph__init" aria-hidden="true">{initials(driver.name)}</span>
        <span className="gph__note">Photograph not yet available</span>
      </div>
    );
  }
  return <img src={src} alt={driver.image.alt} loading={large || eager ? 'eager' : 'lazy'} decoding="async" style={{ objectPosition: focusOf(driver.image) }} onError={() => setFailed(true)} />;
}

/* ------------------------------------------------------------------ card */
function DriverCard({ d, index, eager = false }) {
  return (
    <Reveal delay={(index % 3) * 0.05} className="gcard">
      <Link to={`/people/${d.driverId}`} className="gcard__link" aria-label={`${d.name}, ${d.nationality}, ${careerLabel(d.years)}`}>
        <div className="gcard__media">
          <Portrait driver={d} eager={eager || index < 12} />
          <span className={`gcard__status gcard__status--${d.status}`}><i />{d.status === 'active' ? 'Active' : 'Retired'}</span>
          {d.number && <span className="gcard__num num">{d.number}</span>}
        </div>
        <div className="gcard__body">
          <h3 className="gcard__name">{d.name}</h3>
          <p className="gcard__meta"><span>{d.nationality}</span><span className="num">{careerLabel(d.years)}</span></p>
          <p className="gcard__desc">{d.description}</p>
          <span className="gcard__go">{d.curated ? 'Read the story' : 'View the record'} <ArrowRight size={14} /></span>
        </div>
      </Link>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ index */
function Grid() {
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') || 'all';
  const decade = params.get('decade') || '';
  const q = params.get('q') || '';
  const [input, setInput] = useState(q);
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState({ loading: false, error: null });
  const [tick, setTick] = useState(0);

  const set = (patch) => { const next = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k))); setParams(next, { replace: true }); };

  // debounce the search box into the URL
  useEffect(() => { const t = setTimeout(() => { if (input !== q) set({ q: input.trim() }); }, 300); return () => clearTimeout(t); }, [input]); // eslint-disable-line

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    getPeople({ filter, decade, search: q, page: 1, limit: PAGE_SIZE })
      .then((data) => { if (!live) return; setState({ loading: false, error: null, data }); setItems(data.items); setPage(1); })
      .catch((e) => live && setState({ loading: false, error: e.message, data: null }));
    return () => { live = false; };
  }, [filter, decade, q, tick]);

  const loadMore = () => {
    setMore({ loading: true, error: null });
    getPeople({ filter, decade, search: q, page: page + 1, limit: PAGE_SIZE })
      .then((data) => { setItems((cur) => [...cur, ...data.items]); setPage(page + 1); setMore({ loading: false, error: null }); })
      .catch((e) => setMore({ loading: false, error: e.message }));
  };

  const d = state.data;
  const facets = d ? d.facets : null;

  return (
    <div className="dark">
      <div className="grid-head px">
        <Plus>The People</Plus>
        <h1 className="grid-head__title">The Grid</h1>
        <p className="grid-head__tag">20 Drivers. 20 Stories. One Championship.</p>
        <p className="grid-head__lede">Every driver who has started a World Championship Grand Prix, from the first season in 1950 to today. Pick a name and open the story.</p>
        <p className="grid-head__count num" aria-live="polite">{d ? <>{d.totalDrivers} drivers in the archive</> : '—'}</p>
      </div>

      <div className="gcontrols px">
        <div className="gcontrols__row">
          <div className="chips" role="group" aria-label="Filter drivers">
            {FILTERS.map(([id, label]) => (
              <button key={id} className="chip chip--btn" aria-pressed={filter === id} onClick={() => set({ filter: id === 'all' ? '' : id })}>
                {label}{facets && <span className="num chip__n">{facets[id]}</span>}
              </button>
            ))}
          </div>
          <label className="gsearch"><Search size={18} aria-hidden="true" /><span className="sr-only">Search drivers by name</span>
            <input type="search" placeholder="Search by name" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" /></label>
        </div>
        <div className="gcontrols__row gcontrols__row--decades">
          <span className="gcontrols__label">By decade</span>
          <div className="chips chips--scroll" role="group" aria-label="Filter by decade">
            <button className="chip chip--btn" aria-pressed={!decade} onClick={() => set({ decade: '' })}>All eras</button>
            {DECADES.map((dec) => (
              <button key={dec} className="chip chip--btn" aria-pressed={decade === dec} disabled={facets ? facets.decades[dec] === 0 && decade !== dec : false} onClick={() => set({ decade: dec })}>
                {dec}{facets && <span className="num chip__n">{facets.decades[dec]}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Status loading={state.loading && !d} error={state.error} onRetry={() => setTick((t) => t + 1)} label="Opening the archive" />
      {d && d.note && <p className="px gnote">{d.note}</p>}

      {d && (
        <section className="gresults" aria-label="Drivers" aria-busy={state.loading}>
          <p className="gresults__count px num" aria-live="polite">{d.total === 0 ? 'No drivers found' : `Showing ${items.length} of ${d.total}`}{q ? ` for "${q}"` : ''}</p>
          {d.total === 0 ? (
            <p className="px gempty">No driver matches those filters. Try a surname, a different decade or all drivers.</p>
          ) : (
            <div className="ggrid px">{items.map((x, i) => <DriverCard key={x.driverId} d={x} index={i} />)}</div>
          )}
          {items.length < d.total && (
            <div className="gmore px">
              <button className="btn btn--outline btn--auto" onClick={loadMore} disabled={more.loading}>{more.loading ? 'Loading' : `Show ${Math.min(PAGE_SIZE, d.total - items.length)} more`}</button>
              {more.error && <p className="gnote">{more.error}</p>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- timeline */
function Timeline({ seasons }) {
  const first = seasons[0].season; const last = seasons[seasons.length - 1].season;
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const bySeason = new Map(seasons.map((s) => [s.season, s]));
  const segments = [];
  years.forEach((y, i) => {
    const s = bySeason.get(y);
    if (!s) return;
    const key = s.teams.join(' / ');
    const prev = segments[segments.length - 1];
    if (prev && prev.key === key && prev.end === i - 1) { prev.end = i; prev.items.push(s); } else segments.push({ key, start: i, end: i, items: [s] });
  });
  const detail = (s) => `${s.season}: ${s.teams.join(', ')}. ${s.starts} start${s.starts === 1 ? '' : 's'}, ${s.wins} win${s.wins === 1 ? '' : 's'}, ${s.podiums} podium${s.podiums === 1 ? '' : 's'}${s.champion ? '. World Champion.' : '.'}`;

  return (
    <div className="tl-scroll" tabIndex={0} aria-label="Career timeline, scrolls horizontally">
      <div className="tl" style={{ '--n': years.length }}>
        {years.map((y, i) => { const s = bySeason.get(y); return (
          <div key={`m${y}`} className="tl__mark" style={{ gridColumn: i + 1, gridRow: 1 }}>{s && s.champion && <span className="tl__star" title={`${y}: World Champion`}><Star size={14} fill="currentColor" aria-hidden="true" /><b>Champion</b></span>}</div>
        ); })}
        {years.map((y, i) => !bySeason.get(y) && <div key={`g${y}`} className="tl__gap" style={{ gridColumn: i + 1, gridRow: 2 }} title={`${y}: did not start a Grand Prix`} />)}
        {segments.map((sg, k) => (
          <div key={`s${k}`} className={`tl__bar ${sg.items.some((s) => s.champion) ? 'tl__bar--champ' : ''}`} style={{ gridColumn: `${sg.start + 1} / ${sg.end + 2}`, gridRow: 2 }} title={sg.items.map(detail).join('\n')}>
            <span className="tl__team">{sg.items[0].teams.join(' / ')}</span>
            <span className="tl__sub num">{sg.items.reduce((a, s) => a + s.wins, 0)} {sg.items.reduce((a, s) => a + s.wins, 0) === 1 ? 'win' : 'wins'} · {sg.items.reduce((a, s) => a + s.starts, 0)} starts</span>
          </div>
        ))}
        {years.map((y, i) => <div key={`y${y}`} className="tl__year num" style={{ gridColumn: i + 1, gridRow: 3 }}>{y}</div>)}
        {years.map((y, i) => { const s = bySeason.get(y); return <div key={`w${y}`} className="tl__wins num" style={{ gridColumn: i + 1, gridRow: 4 }}>{s && s.wins > 0 ? `${s.wins}W` : ''}</div>; })}
      </div>
      <ol className="sr-only">{seasons.map((s) => <li key={s.season}>{detail(s)}</li>)}</ol>
    </div>
  );
}

/* ---------------------------------------------------------------- profile */
function Profile({ driverId }) {
  const reduce = useReducedMotion();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const load = () => {
    setState({ loading: true, error: null, data: null });
    getPerson(driverId).then((data) => setState({ loading: false, error: null, data })).catch((e) => setState({ loading: false, error: e.message, data: null }));
  };
  useEffect(load, [driverId]);
  const p = state.data;

  if (!p) {
    return (
      <div className="dark" style={{ minHeight: '70vh', paddingTop: 130 }}>
        <div className="px"><Link to="/people" className="back"><ArrowLeft size={14} /> The Grid</Link></div>
        <Status loading={state.loading} error={state.error} onRetry={load} label="Opening the story" />
      </div>
    );
  }
  const titles = p.stats.titles; const born = fmtDate(p.dateOfBirth);
  const stat = (label, value, hot) => (
    <Reveal className={`pstat ${hot ? 'pstat--hot' : ''}`} key={label}><Plus size={14} className="plus--sm">{label}</Plus><b className="num">{value}</b>{hot && <span className="pstat__yrs num">{titles.length ? titles.join(', ') : 'None'}</span>}</Reveal>
  );

  return (
    <div className="dark">
      {/* introduction: the driver's face is the main visual */}
      <section className="pf px" aria-label="Driver introduction">
        <Link to="/people" className="back"><ArrowLeft size={14} /> The Grid</Link>
        <div className="pf__grid">
          <div className="pf__copy">
            <div className="chips pf__chips">
              <span className={`chip chip--status chip--${p.status}`}><i />{p.status === 'active' ? 'Active' : 'Retired'}</span>
              {p.number && <span className="chip num">#{p.number}</span>}
            </div>
            <motion.h1 className="pf__name" initial={reduce ? false : { y: 30 }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>{p.name}</motion.h1>
            {p.tagline && <p className="pf__tag">{p.tagline}</p>}
            <dl className="pf__facts">
              {born && <div><dt>Born</dt><dd>{born}{p.birthPlace ? `, ${p.birthPlace}` : ''}</dd></div>}
              <div><dt>Nationality</dt><dd>{p.nationality}</dd></div>
              {p.teams.length > 0 && <div><dt>Teams</dt><dd>{p.teams.join(', ')}</dd></div>}
              <div><dt>Career</dt><dd className="num">{careerLabel(p.careerYears)}</dd></div>
            </dl>
          </div>
          <figure className="pf__portrait">
            <div className="pf__frame"><Portrait driver={p} large /></div>
            {p.image && <Credit image={p.image} caption={false} className="pf__credit" />}
          </figure>
        </div>
      </section>

      {/* the story */}
      <section className="pstory px" aria-label="The story">
        <Plus>The story</Plus>
        <div>
          <p className="pstory__text">{p.story}</p>
          {p.legacy && <p className="pstory__legacy">{p.legacy}</p>}
          {p.rivalry && (
            <p className="pstory__rival"><span>Defining rivalry</span>{p.rivalry.driver ? <Link to={`/people/${p.rivalry.driver.driverId}`}>{p.rivalry.name} <ArrowRight size={16} /></Link> : <b>{p.rivalry.name}</b>}</p>
          )}
        </div>
      </section>

      {/* statistics */}
      <section className="g-sec" aria-label="Career statistics">
        <SectionHead label="The numbers" lead="Career" tail="statistics." />
        <div className="pstats px">
          {stat('World Championships', titles.length, true)}
          {stat('Grand Prix wins', p.stats.wins)}
          {stat('Podiums', p.stats.podiums)}
          {stat('Pole positions', p.stats.poles)}
          {stat('Starts', p.stats.starts)}
        </div>
      </section>

      {p.highlights.length > 0 && (
        <section className="g-sec" aria-label="Career highlights">
          <SectionHead label="Highlights" lead="Career" tail="highlights." count={p.highlights.length} />
          {p.highlights.map((h, i) => (
            <div key={`${h.year}${h.text}`} className="hrow"><span className="npill num">{i + 1}</span><span className="hrow__yr num">{h.year}</span><span className="hrow__txt">{h.text}</span></div>
          ))}
        </section>
      )}

      {p.timeline.length > 0 && (
        <section className="g-sec" aria-label="Career timeline">
          <SectionHead label="Timeline" lead="Career" tail="timeline." />
          <div className="px"><Timeline seasons={p.timeline} /></div>
        </section>
      )}

      {p.related.length > 0 && (
        <section className="g-sec" style={{ paddingBottom: 'clamp(72px, 10vw, 140px)' }} aria-label="More from the grid">
          <SectionHead label="Explore" lead="More from" tail="the grid." count={p.related.length} />
          <div className="ggrid ggrid--3 px">{p.related.map((x, i) => <DriverCard key={x.driverId} d={x} index={i} />)}</div>
        </section>
      )}
    </div>
  );
}

export default function People() {
  const { driverId } = useParams();
  return driverId ? <Profile driverId={driverId} /> : <Grid />;
}
