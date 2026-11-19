import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUpRight, Search } from 'lucide-react';
import { Plus, Reveal, SectionHead, Credit, Status } from '../components/Footer.jsx';
import { getPeople, getPerson } from '../services/api.js';
import { getDriverSocials } from '../data/driverSocials.js';
import { teamProfile, teamMark } from '../data/teamArchive.js';
import { getDriverDossier } from '../data/driverDossiers.js';
import { buildDriverMilestones } from '../data/driverTimeline.js';

// THE GRID: the driver list and the driver profile pages.
// The photo for each driver is set in server/data/people.json ("portraits").
// To change a photo, put the file in client/public/images and edit that entry.
const IMAGE_BASE = '/images/';

function imageSrc(image) {
  if (!image) return null;
  return IMAGE_BASE + image.file;
}

function focusOf(image) {
  if (image && image.focus) return image.focus;
  return '50% 50%';
}

const FILTERS = [['all', 'All drivers'], ['current', 'Current drivers'], ['champions', 'World Champions'], ['retired', 'Retired drivers']];
const DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const PAGE_SIZE = 24;

// first letters of the first two words of a name, for example "Max Verstappen" gives "MV"
function initials(name) {
  const words = name.split(' ');
  let result = '';
  for (let i = 0; i < words.length && result.length < 2; i++) {
    if (words[i] !== '') result += words[i][0];
  }
  return result;
}

// years as text, for example "2015 to present"
function careerLabel(years) {
  const start = years[0];
  const end = years[1];
  if (end === null) return `${start} to present`;
  if (start === end) return `${start}`;
  return `${start} to ${end}`;
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// the driver's photo, or a placeholder with initials if there is no photo
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

// ---------------------------------------------------------------- driver card
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

// ---------------------------------------------------------------- moving text strips
const INTRO = 'Every driver who has started a World Championship Grand Prix, from the first season in 1950 to today. Pick a name and open the story.';

// Both strips are made with CSS only. The content is drawn twice and the track slides by 50%,
// so the loop never shows a gap. The second copy is hidden from screen readers.
function IntroMarquee() {
  const half = (key) => (
    <div className="mq__half" key={key}>
      {[0, 1, 2].map((i) => <span className="mq__intro" key={i}>{INTRO}<b className="mq__plus" aria-hidden="true">+</b></span>)}
    </div>
  );
  return (
    <div className="mq mq--intro">
      <p className="sr-only">{INTRO}</p>
      <div className="mq__track" aria-hidden="true">{half('a')}{half('b')}</div>
    </div>
  );
}

function DecadeMarquee({ decade, onPick }) {
  const half = (dup) => (
    <div className="mq__half" aria-hidden={dup || undefined}>
      {[0, 1].map((rep) => DECADES.map((dec) => (
        <React.Fragment key={`${rep}${dec}`}>
          <button className={`dm ${decade === dec ? 'is-on' : ''}`} aria-pressed={decade === dec} tabIndex={dup ? -1 : 0} onClick={() => onPick(decade === dec ? '' : dec)}>{dec}</button>
          <span className="dm__dash" aria-hidden="true">&mdash;</span>
        </React.Fragment>
      )))}
    </div>
  );
  return (
    <div className="mq mq--decades" role="group" aria-label="Filter by decade">
      <div className="mq__track">{half(false)}{half(true)}</div>
    </div>
  );
}

// ---------------------------------------------------------------- driver list page
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

  // change the filters in the URL. An empty value removes that filter.
  function set(changes) {
    const next = new URLSearchParams(params);
    const keys = Object.keys(changes);
    for (let i = 0; i < keys.length; i++) {
      if (changes[keys[i]]) {
        next.set(keys[i], changes[keys[i]]);
      } else {
        next.delete(keys[i]);
      }
    }
    setParams(next, { replace: true });
  }

  // wait 300ms after typing before searching
  useEffect(() => {
    const timer = setTimeout(() => {
      if (input !== q) set({ q: input.trim() });
    }, 300);
    return () => clearTimeout(timer);
  }, [input]); // eslint-disable-line

  // load the first page whenever a filter changes
  useEffect(() => {
    let active = true;
    setState((old) => ({ ...old, loading: true, error: null }));

    getPeople({ filter: filter, decade: decade, search: q, page: 1, limit: PAGE_SIZE })
      .then((data) => {
        if (!active) return;
        setState({ loading: false, error: null, data: data });
        setItems(data.items);
        setPage(1);
      })
      .catch((err) => {
        if (active) setState({ loading: false, error: err.message, data: null });
      });

    return () => {
      active = false;
    };
  }, [filter, decade, q, tick]);

  function loadMore() {
    setMore({ loading: true, error: null });
    getPeople({ filter: filter, decade: decade, search: q, page: page + 1, limit: PAGE_SIZE })
      .then((data) => {
        setItems((current) => [...current, ...data.items]);
        setPage(page + 1);
        setMore({ loading: false, error: null });
      })
      .catch((err) => setMore({ loading: false, error: err.message }));
  }

  const d = state.data;

  return (
    <div className="dark">
      <div className="grid-head px">
        <Plus>The People</Plus>
        <h1 className="grid-head__title">The Grid</h1>
        <p className="grid-head__tag">20 Drivers. 20 Stories. One Championship.</p>
      </div>

      <IntroMarquee />

      <div className="gdecade px">
        <span className="gcontrols__label">By decade</span>
        <button className="chip chip--btn" aria-pressed={!decade} onClick={() => set({ decade: '' })}>All eras</button>
      </div>
      <DecadeMarquee decade={decade} onPick={(dec) => set({ decade: dec })} />

      <div className="gcontrols px">
        <div className="gcontrols__row">
          <div className="chips" role="group" aria-label="Filter drivers">
            {FILTERS.map(([id, label]) => (
              <button key={id} className="chip chip--btn" aria-pressed={filter === id} onClick={() => set({ filter: id === 'all' ? '' : id })}>
                {label}
              </button>
            ))}
          </div>
          <label className="gsearch"><Search size={18} aria-hidden="true" /><span className="sr-only">Search drivers by name</span>
            <input type="search" placeholder="Search by name" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" /></label>
        </div>
      </div>

      <Status loading={state.loading && !d} error={state.error} onRetry={() => setTick((t) => t + 1)} label="Opening the archive" />
      {d && d.note && <p className="px gnote">{d.note}</p>}

      {d && (
        <section className="gresults" aria-label="Drivers" aria-busy={state.loading}>
          <p className="sr-only" aria-live="polite">{d.total === 0 ? 'No drivers found' : 'Results updated'}</p>
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

// ---------------------------------------------------------------- career journey
// Groups a driver's seasons into team stints (consecutive seasons with the same team).
// Everything is worked out from the driver's own record.
function sumOf(seasons, key) {
  let total = 0;
  for (let i = 0; i < seasons.length; i++) total += seasons[i][key];
  return total;
}

function buildStints(p) {
  const seasons = [...(p.timeline || [])];
  seasons.sort((a, b) => a.season - b.season);

  // join consecutive seasons with the same teams into one stint
  const stints = [];
  for (let i = 0; i < seasons.length; i++) {
    const s = seasons[i];
    const key = s.teams.join(' / ');
    const previous = stints[stints.length - 1];
    if (previous && previous.key === key && previous.to === s.season - 1) {
      previous.to = s.season;
      previous.seasons.push(s);
    } else {
      stints.push({ key: key, teams: s.teams, from: s.season, to: s.season, seasons: [s] });
    }
  }

  let latest = null;
  if (seasons.length > 0) latest = seasons[seasons.length - 1].season;

  const result = [];
  for (let i = 0; i < stints.length; i++) {
    const st = stints[i];

    const titles = [];
    for (let j = 0; j < st.seasons.length; j++) {
      if (st.seasons[j].champion) titles.push(st.seasons[j].season);
    }

    let debut = null;
    if (p.debut && p.debut.season >= st.from && p.debut.season <= st.to) debut = p.debut;
    let firstWin = null;
    if (p.firstWin && p.firstWin.season >= st.from && p.firstWin.season <= st.to) firstWin = p.firstWin;

    const wins = sumOf(st.seasons, 'wins');

    let kicker = `Chapter ${i + 1}`;
    if (debut) {
      kicker = 'First F1 chapter';
    } else if (titles.length > 0) {
      kicker = 'Championship-winning era';
    } else if (firstWin) {
      kicker = 'First victory';
    } else if (st.teams.length > 1) {
      kicker = 'Mid-season team move';
    } else if (wins > 0) {
      kicker = 'Race-winning chapter';
    }

    const facts = [];
    if (debut) facts.push(['Debut', `${debut.season} ${debut.race}`]);
    if (st.teams.length > 1) facts.push(['Team change', `${st.teams[0]} to ${st.teams[st.teams.length - 1]}, mid-season`]);
    if (firstWin) facts.push(['First win', `${firstWin.season} ${firstWin.race}`]);
    if (titles.length > 0) facts.push(['World Champion', titles.join(', ')]);

    const active = p.status === 'active' && st.to === latest;

    let range = `${st.from}\u2013${st.to}`;
    if (active) {
      range = `${st.from}\u2013Present`;
    } else if (st.from === st.to) {
      range = `${st.from}`;
    }

    result.push({
      ...st,
      i: i,
      kicker: kicker,
      facts: facts,
      titles: titles,
      active: active,
      starts: sumOf(st.seasons, 'starts'),
      wins: wins,
      podiums: sumOf(st.seasons, 'podiums'),
      poles: sumOf(st.seasons, 'poles'),
      team: st.teams[st.teams.length - 1],
      range: range,
    });
  }
  return result;
}

function StintPanel({ st }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const t = teamProfile(st.team, st.from, st.to);
  const stat = (label, v) => <div key={label}><dt>{label}</dt><dd className="num">{v}</dd></div>;
  return (
    <motion.article
      className={`cj__panel ${open ? 'is-open' : ''}`} style={{ '--tc': t.color }} tabIndex={0}
      aria-label={`${st.range}, ${st.teams.join(' / ')}. ${st.kicker}. ${st.starts} starts, ${st.wins} wins.`}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
      initial={reduce ? false : { y: 26 }} whileInView={{ y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.7, delay: Math.min(st.i * 0.08, 0.3), ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="cj__media" aria-hidden={t.photo ? undefined : 'true'}>
        {t.photo ? <img src={`/images/${t.photo.file}`} alt={t.photo.caption} loading="lazy" decoding="async" style={{ objectPosition: t.photo.focus }} /> : <span className="cj__ghost">{teamMark(st.team)}</span>}
      </div>
      <div className="cj__shade" />
      <div className="cj__top">
        {t.logo ? <img className="cj__logo" src={`/images/${t.logo}`} alt={`${st.team} logo`} /> : <span className="cj__mark" aria-hidden="true">{teamMark(st.team)}</span>}
        <span className="cj__kicker">{st.kicker}</span>
      </div>
      <div className="cj__bottom">
        <p className="cj__years num">{st.range}</p>
        <h3 className="cj__team">{st.teams.join(' / ')}</h3>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div className="cj__more" initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={{ duration: reduce ? 0.1 : 0.4, ease: [0.22, 1, 0.36, 1] }}>
              <dl className="cj__stats">{stat('Starts', st.starts)}{stat('Wins', st.wins)}{stat('Podiums', st.podiums)}{stat('Poles', st.poles)}</dl>
              {st.facts.length > 0 && <ul className="cj__facts">{st.facts.map(([k, v]) => <li key={k}><b>{k}</b>{v}</li>)}</ul>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {t.photo && <span className="cj__credit">{t.photo.caption} · Photo: {t.photo.credit.author}, {t.photo.credit.license}</span>}
    </motion.article>
  );
}

// one large panel for each team stint, joined by a thin line
function CareerJourney({ stints }) {
  if (!stints.length) return null;
  return (
    <ol className={`cj ${stints.length > 3 ? 'cj--scroll' : ''} cj--n${Math.min(stints.length, 4)}`} aria-label="Career journey, team by team" tabIndex={stints.length > 3 ? 0 : undefined}>
      {stints.map((st, i) => (
        <li key={`${st.from}-${st.key}`} className={`cj__item ${i === stints.length - 1 ? 'is-last' : ''} ${st.active ? 'is-active' : ''}`}>
          <span className="cj__node" aria-hidden="true" />
          <StintPanel st={st} />
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- driver profile page
function PlatformIcon({ platform }) {
  if (platform === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    );
  }
  if (platform === 'twitter') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  if (platform === 'youtube') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }
  if (platform === 'tiktok') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-.88-.06 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 8.78 5.86 6.32 6.32 0 0 0 3.9-5.86V9.08a8.28 8.28 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.51z" />
      </svg>
    );
  }
  if (platform === 'website') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }
  // wikipedia: the serif "W" the encyclopedia uses as its mark
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <text x="12" y="18" textAnchor="middle" fontFamily="'Linux Libertine', Georgia, 'Times New Roman', serif" fontSize="19" fontWeight="700">W</text>
    </svg>
  );
}

function CompactStatsStrip({ stats }) {
  let titles = [];
  let wins = 0;
  let podiums = 0;
  let poles = 0;
  let starts = 0;
  if (stats) {
    titles = stats.titles || [];
    wins = stats.wins || 0;
    podiums = stats.podiums || 0;
    poles = stats.poles || 0;
    starts = stats.starts || 0;
  }

  let titleNote = 'None';
  if (titles.length > 0) titleNote = titles.join(', ');

  const cells = [
    { label: 'World Championships', value: titles.length, note: titleNote, highlight: titles.length > 0 },
    { label: 'Grand Prix Wins', value: wins, note: 'Career Victories', highlight: wins > 0 },
    { label: 'Podium Finishes', value: podiums, note: 'Top 3 Finishes', highlight: false },
    { label: 'Pole Positions', value: poles, note: 'P1 Starts', highlight: false },
    { label: 'Race Starts', value: starts, note: 'Grand Prix Entries', highlight: false },
  ];

  return (
    <div className="pf-stats-strip" aria-label="Career statistics summary">
      {cells.map((c) => (
        <div key={c.label} className={`pf-stat-cell ${c.highlight ? 'pf-stat-cell--highlight' : ''}`}>
          <span className="pf-stat-cell__label">{c.label}</span>
          <b className="pf-stat-cell__val num">{c.value}</b>
          <span className="pf-stat-cell__note num">{c.note}</span>
        </div>
      ))}
    </div>
  );
}

// only these checked channels are shown, in this order
const SOCIAL_ORDER = [['instagram', 'Instagram'], ['twitter', 'X'], ['youtube', 'YouTube'], ['wikipedia', 'Wikipedia'], ['website', 'Official website']];

function BeyondThePaddock({ socials }) {
  const items = [];
  const all = socials || [];
  for (let i = 0; i < SOCIAL_ORDER.length; i++) {
    const key = SOCIAL_ORDER[i][0];
    const name = SOCIAL_ORDER[i][1];
    for (let j = 0; j < all.length; j++) {
      if (all[j].platform === key) {
        items.push({ ...all[j], name: name });
        break;
      }
    }
  }
  if (items.length === 0) return null;
  return (
    <section className="pf-beyond px" aria-label="Beyond the paddock">
      <p className="pf-beyond__label"><i />Beyond the paddock</p>
      <ul className="pf-beyond__icons">
        {items.map((s) => (
          <li key={s.platform}>
            <a className="pf-ico" href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${s.name} (opens in a new tab)`} data-tip={s.name}>
              <PlatformIcon platform={s.platform} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DriverStorySection({ dossier, rivalry, driverName }) {
  if (!dossier) return null;
  return (
    <section className="g-sec pf-story-section" aria-label="Driver biography and magazine story">
      <SectionHead label="Editorial" lead="The Driver's" tail="Story." />
      <div className="px">
        {dossier.leadQuote && (
          <blockquote className="pf-story__lead-quote">
            <span className="pf-story__quote-mark">“</span>
            <p>{dossier.leadQuote}</p>
          </blockquote>
        )}

        <div className="pf-story__spread">
          <div className="pf-story__chapters">
            {dossier.sections.map((sec, idx) => (
              <article key={idx} className="pf-story__chapter">
                <h3 className="pf-story__ch-heading">{sec.heading}</h3>
                {sec.paragraphs.map((p, pIdx) => (
                  <p key={pIdx} className="pf-story__ch-para">{p}</p>
                ))}
              </article>
            ))}
          </div>

          <aside className="pf-story__sidebar">
            {dossier.actionImage && (
              <figure className="pf-story__action-fig">
                <div className="pf-story__action-frame">
                  <img src={dossier.actionImage} alt={`${driverName} in action`} loading="lazy" />
                </div>
                {dossier.actionCaption && (
                  <figcaption className="pf-story__action-cap">
                    {dossier.actionCaption}
                  </figcaption>
                )}
              </figure>
            )}

            {rivalry && (
              <div className="pf-rivalry-box">
                <span className="pf-rivalry-box__tag">DEFINING RIVALRY</span>
                <h4 className="pf-rivalry-box__name">
                  {rivalry.driver ? (
                    <Link to={`/people/${rivalry.driver.driverId}`} className="pf-rivalry-box__link">
                      {rivalry.name} <ArrowRight size={14} />
                    </Link>
                  ) : (
                    rivalry.name
                  )}
                </h4>
                <p className="pf-rivalry-box__note">
                  A high-stakes clash of driving philosophies that produced unforgettable wheel-to-wheel duels.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- career timeline
function TimelineItem({ m, season, i }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  let seasonLine = null;
  if (season) {
    const winText = season.wins === 1 ? 'win' : 'wins';
    const podiumText = season.podiums === 1 ? 'podium' : 'podiums';
    seasonLine = `${season.starts} starts \u00B7 ${season.wins} ${winText} \u00B7 ${season.podiums} ${podiumText}`;
  }
  const hasMore = Boolean(m.detail || seasonLine);
  return (
    <motion.li className={`ht__item ${m.important ? 'is-key' : ''}`}
      initial={reduce ? false : { y: 24 }} whileInView={{ y: 0 }} viewport={{ once: true, margin: '-30px' }} transition={{ duration: 0.65, delay: Math.min(i * 0.06, 0.4), ease: [0.22, 1, 0.36, 1] }}>
      <p className="ht__year num">{m.year}</p>
      <span className="ht__node" aria-hidden="true" />
      <article className={`ht__card ${open ? 'is-open' : ''}`} tabIndex={hasMore ? 0 : undefined}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen((o) => !o)}>
        <span className="ht__cat">{m.category}</span>
        <h3 className="ht__title">{m.title}</h3>
        <p className="ht__text">{m.text}</p>
        <AnimatePresence initial={false}>
          {open && hasMore && (
            <motion.div className="ht__more" initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={{ duration: reduce ? 0.1 : 0.35, ease: [0.22, 1, 0.36, 1] }}>
              <div className="ht__more-in">
                {seasonLine && <p className="ht__season"><b>{m.year} season</b>{seasonLine}</p>}
                {m.detail && <p className="ht__detail">{m.detail}</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </article>
    </motion.li>
  );
}

// one horizontal strip of milestone cards
function HorizontalTimeline({ milestones, seasons }) {
  const track = useRef(null);
  const [edge, setEdge] = useState({ left: false, right: true });
  const seasonList = seasons || [];
  const bySeason = new Map();
  for (let i = 0; i < seasonList.length; i++) bySeason.set(seasonList[i].season, seasonList[i]);

  // check if there is more to scroll to on the left or right (to show the arrows)
  function measure() {
    const t = track.current;
    if (t) {
      setEdge({ left: t.scrollLeft > 4, right: t.scrollLeft + t.clientWidth < t.scrollWidth - 4 });
    }
  }

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [milestones]); // eslint-disable-line

  function step(direction) {
    if (track.current) track.current.scrollBy({ left: direction * 300, behavior: 'smooth' });
  }

  if (!milestones || milestones.length === 0) return null;
  return (
    <div className="ht" aria-label="Career milestones, scrolls horizontally">
      {(edge.left || edge.right) && (
        <div className="ht__arrows">
          <button onClick={() => step(-1)} disabled={!edge.left} aria-label="Earlier milestones"><ArrowLeft size={16} /></button>
          <button onClick={() => step(1)} disabled={!edge.right} aria-label="Later milestones"><ArrowRight size={16} /></button>
        </div>
      )}
      <ol className="ht__track" ref={track} onScroll={measure} tabIndex={0}>
        {milestones.map((m, i) => <TimelineItem key={`${m.year}-${m.title}`} m={m} season={bySeason.get(m.year)} i={i} />)}
      </ol>
    </div>
  );
}

function Profile({ driverId }) {
  const reduce = useReducedMotion();
  const [state, setState] = useState({ loading: true, error: null, data: null });

  function load() {
    setState({ loading: true, error: null, data: null });
    getPerson(driverId)
      .then((data) => setState({ loading: false, error: null, data: data }))
      .catch((err) => setState({ loading: false, error: err.message, data: null }));
  }

  useEffect(() => {
    load();
  }, [driverId]);

  const p = state.data;

  if (!p) {
    return (
      <div className="dark" style={{ minHeight: '70vh', paddingTop: 130 }}>
        <div className="px"><Link to="/people" className="back"><ArrowLeft size={14} /> The Grid</Link></div>
        <Status loading={state.loading} error={state.error} onRetry={load} label="Opening the dossier" />
      </div>
    );
  }

  const born = fmtDate(p.dateOfBirth);
  const dossier = getDriverDossier(p);
  const socials = getDriverSocials(p);
  // use the hand-written timeline if the driver has one, otherwise build it from their record
  let milestones = buildDriverMilestones(p);
  if (dossier && Array.isArray(dossier.timeline) && dossier.timeline.length > 0) {
    milestones = dossier.timeline;
  }
  const stints = buildStints(p);
  let tagline = p.tagline;
  if (!tagline && dossier) tagline = dossier.leadQuote;

  return (
    <div className="dark pf-flow">
      {/* 1. Driver Introduction: Asymmetrical Dossier Layout */}
      <section className="pf-dossier px" aria-label="Driver introduction dossier">
        <div className="pf-dossier__topbar">
          <Link to="/people" className="back"><ArrowLeft size={14} /> The Grid</Link>
          <span className="pf-dossier__index num">PADDOCK DOSSIER // {p.code || (p.number ? `#${p.number}` : 'ARCHIVE')}</span>
        </div>

        <div className="pf-dossier__grid">
          <div className="pf-dossier__main">
            <div className="chips pf-dossier__chips">
              <span className={`chip chip--status chip--${p.status}`}><i />{p.status === 'active' ? 'Active Driver' : 'Legend / Retired'}</span>
              {p.number && <span className="chip num">#{p.number}</span>}
              <span className="chip">{p.nationality}</span>
              {p.teams.length > 0 && <span className="chip chip--team">{p.teams[p.teams.length - 1]}</span>}
            </div>

            <motion.h1
              className="pf-dossier__name"
              initial={reduce ? false : { y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              {p.name}
            </motion.h1>

            {tagline && <p className="pf-dossier__tagline">{tagline}</p>}

            {/* Dossier Specifications Matrix */}
            <div className="pf-dossier__specs">
              <div className="pf-spec-item">
                <span className="pf-spec-item__key">Born</span>
                <span className="pf-spec-item__val">{born ? `${born}${p.birthPlace ? `, ${p.birthPlace}` : ''}` : 'Record on file'}</span>
              </div>
              <div className="pf-spec-item">
                <span className="pf-spec-item__key">F1 Debut</span>
                <span className="pf-spec-item__val">
                  {p.debut ? `${p.debut.season} ${p.debut.race} · ${p.debut.team}` : 'Grand Prix Record'}
                </span>
              </div>
              <div className="pf-spec-item">
                <span className="pf-spec-item__key">First Win</span>
                <span className="pf-spec-item__val">
                  {p.firstWin ? `${p.firstWin.season} ${p.firstWin.race} · ${p.firstWin.team}` : 'Seeking maiden victory'}
                </span>
              </div>
              <div className="pf-spec-item">
                <span className="pf-spec-item__key">Career Span</span>
                <span className="pf-spec-item__val num">{careerLabel(p.careerYears)}</span>
              </div>
              <div className="pf-spec-item pf-spec-item--full">
                <span className="pf-spec-item__key">Constructors</span>
                <span className="pf-spec-item__val">{p.teams.length > 0 ? p.teams.join(', ') : 'Independent'}</span>
              </div>
            </div>
          </div>

          <figure className="pf-dossier__portrait-col">
            <div className="pf-dossier__frame">
              <span className="pf-dossier__mark pf-dossier__mark--tl" aria-hidden="true">+</span>
              <span className="pf-dossier__mark pf-dossier__mark--tr" aria-hidden="true">+</span>
              <span className="pf-dossier__mark pf-dossier__mark--bl" aria-hidden="true">+</span>
              <span className="pf-dossier__mark pf-dossier__mark--br" aria-hidden="true">+</span>
              <Portrait driver={p} large />
              <div className="pf-dossier__frame-vignette" aria-hidden="true" />
            </div>
            {p.image && <Credit image={p.image} caption={false} className="pf-dossier__credit" />}
          </figure>
        </div>
      </section>

      {/* 2. Compact Statistics Strip */}
      <section className="px pf-stats-wrap" aria-label="Career statistics strip">
        <CompactStatsStrip stats={p.stats} />
      </section>

      {/* 3. Driver Story (Magazine Editorial Spread) */}
      <DriverStorySection dossier={dossier} rivalry={p.rivalry} driverName={p.name} />

      {/* 4. Beyond the Paddock (Official Social Profiles & References) */}
      <BeyondThePaddock socials={socials} />

      {/* 5. Career Journey: team stints, from the driver's own record */}
      {stints.length > 0 && (
        <section className="g-sec pf-journey-section" aria-label="Career journey">
          <SectionHead label="Journey" lead="The career" tail="journey." count={stints.length} />
          <div className="px"><CareerJourney stints={stints} /></div>
        </section>
      )}

      {/* 6. Career timeline: one horizontal strip, after the editorial sections */}
      {milestones.length > 0 && (
        <section className="g-sec pf-timeline-section" aria-label="Career Timeline">
          <SectionHead label="Chronology" lead="Career" tail="timeline." count={milestones.length} />
          <div className="px"><HorizontalTimeline milestones={milestones} seasons={p.timeline} /></div>
        </section>
      )}

      {/* 7. Explore More from the Grid */}
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
