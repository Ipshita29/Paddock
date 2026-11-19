import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, animate, motion, useInView, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, X } from 'lucide-react';
import { Plus, Reveal, RevealText, Status } from '../components/Footer.jsx';
import { getSeasons, getPeople, getNextRace } from '../services/api.js';
import { knowMoreInfo } from '../data/knowMoreInfo.js';

const WIKI = 'https://commons.wikimedia.org/wiki/File:';
// Photographs used by static parts of the page, with their licence details.
const IMG = {
  lauda: { file: 'lauda.jpg', alt: 'Niki Lauda in the Ferrari 312T2, 31 July 1976', focus: '55% 58%', credit: { author: 'Lothar Spurzem', license: 'CC BY-SA 2.0 de', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/de/deed.en', source: `${WIKI}LaudaNiki19760731Ferrari312T2.jpg` } },
  senna: { file: 'portrait-senna.jpg', alt: 'Ayrton Senna in his McLaren race suit', focus: '33% 30%', credit: { author: 'Instituto Ayrton Senna', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0', source: 'https://commons.wikimedia.org/wiki/File:Ayrton_Senna_9.jpg' } },
  next: { file: 'verstappen-2026.jpg', alt: 'Max Verstappen in the Red Bull, 2026 Chinese Grand Prix qualifying', credit: { author: 'Liauzh', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0', source: `${WIKI}2026_Chinese_GP_-_Red_Bull_-_Max_Verstappen_-_Qualifying.jpg` } },
};
const FANCODE_F1 = 'https://www.fancode.com/formula1'; // FanCode's official Formula 1 page (verified)

const HERO_CREDIT = { author: 'Willy Pragher', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0', source: `${WIKI}Fangio_Maserati_250F_Nurburgring_1957.jpg` };

const STATEMENT = 'PADDOCK is an independent Formula 1 magazine. We tell the story of the sport from the first championship in 1950, celebrate the people who shaped it, and estimate who wins next.';

const MotionLink = motion.create(Link);

const SERVICES = [
  { to: '/history', title: 'The Stories', text: 'Rivalries, impossible comebacks, unforgettable crashes and the moments that made Formula 1.', chips: ['Rivalries', 'The crashes', 'Comebacks', 'Championship battles', 'Legends', 'Modern era'], image: { src: '/images/stories.png', alt: 'A printed spread of black-and-white McLaren Formula 1 photographs', focus: '50% 40%' }, cta: 'Read the stories', ctaIcon: 'up', titleClass: 'svc__title--one' },
  { to: '/people', title: 'The People', text: 'The Grid: every driver who has started a Grand Prix, from 1950 to today, with short stories and career timelines.', chips: ['Every driver', 'Short stories', 'Career timelines', 'Champions'], image: { src: '/images/people.png', alt: 'Magazine cover portrait of Charles Leclerc holding his helmet', focus: '50% 30%' } },
  { to: '/prediction', title: 'The Prediction', text: 'A calibrated estimate of who wins the next Grand Prix, with its full track record in the open.', chips: ['Qualifying', 'Recent form', 'Circuit record', 'Backtest', 'Calibrated'], image: { src: '/images/prediction.png', alt: 'Overhead view of two Formula 1 cars on a street circuit', focus: '50% 55%' } },
];

function useLoad(fn) {
  const [s, setS] = useState({ data: null, error: null, loading: true });
  useEffect(() => { let live = true; fn().then((d) => live && setS({ data: d, error: null, loading: false })).catch((e) => live && setS({ data: null, error: e.message, loading: false })); return () => { live = false; }; }, []); // eslint-disable-line
  return s;
}

/** Counts up to `value` once, the first time it scrolls into view. Static for reduced-motion users. */
function CountUp({ value }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-12% 0px' });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView || !value) return undefined;
    if (reduce) { setShown(value); return undefined; }
    const controls = animate(0, value, { duration: 1.2, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [inView, value, reduce]);
  return <span ref={ref} className="num" aria-label={value ? String(value) : undefined}>{value ? (inView ? shown : 0) : '\u2014'}</span>;
}

/** One compact editorial strip instead of three stat cards. Values come from the existing API data. */
function NumbersStrip({ stats, error }) {
  return (
    <section className="nums dark" aria-label="PADDOCK in numbers">
      <div className="px">
        <Plus size={14} className="plus--sm">PADDOCK in numbers</Plus>
        <ul className="nums__row">
          {stats.map((m, i) => (
            <Reveal as="li" key={m.label} delay={i * 0.07} className="nums__col">
              <p className="nums__big"><CountUp value={m.value} /></p>
              <p className="nums__label">{m.label}{m.range && <em>{m.range}</em>}</p>
              <p className="nums__text">{m.text}</p>
            </Reveal>
          ))}
        </ul>
        <Status error={error} onRetry={() => window.location.reload()} />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- term of the day */
// Every glossary entry, in a stable order that does not depend on object key order.
const TERMS = Object.values(knowMoreInfo).sort((a, b) => a.slug.localeCompare(b.slug));
const TERM_BY_SLUG = new Map(TERMS.map((t) => [t.slug, t]));
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/**
 * Deterministic daily pick: the same term for everyone on a given UTC date, a new one each day.
 * Stepping through the list by a stride coprime with its length visits every term once before any repeats,
 * and keeps neighbouring days from showing alphabetically adjacent terms. No randomness, no backend.
 */
function termForDay(date = new Date()) {
  const n = TERMS.length;
  const day = Math.floor(date.getTime() / 86400000);
  let stride = Math.max(1, Math.round(n * 0.618));
  while (gcd(stride, n) !== 1) stride += 1;
  return TERMS[(day * stride) % n];
}

/** A short, complete description. Some entries carry a description cut off with an ellipsis; use their first full sentence instead. */
function termBlurb(t) {
  const short = (t.shortDescription || '').trim();
  if (short && !/(\u2026|\.\.\.)$/.test(short)) return short;
  const meaning = (t.meaning || '').trim();
  const first = meaning.match(/^.*?[.!?](?=\s|$)/);
  return first ? first[0] : meaning || short.replace(/(\u2026|\.\.\.)$/, '');
}

const READ = [['meaning', 'What it means'], ['whyItMatters', 'Why it matters'], ['example', 'A real F1 example'], ['beginnerTip', 'Beginner tip'], ['funFact', 'Fun fact']];

const RADIO_KEY = 'paddock:radio:dismissed';
const todayKey = () => new Date().toISOString().slice(0, 10); // UTC date, the same one that selects the term
const dismissedToday = () => { try { return window.localStorage.getItem(RADIO_KEY) === todayKey(); } catch (_) { return false; } };
const rememberDismissal = () => { try { window.localStorage.setItem(RADIO_KEY, todayKey()); } catch (_) { /* private mode: it simply returns next visit */ } };

/**
 * "PADDOCK Radio": the word of the day as a small team-radio style transmission in the bottom-right corner.
 * It is fixed-position, so it never takes space in the page. It appears once, a moment after the page loads,
 * and once dismissed it stays away until the next day's term. "Learn more" opens the full entry in the popup.
 */
function RadioPopup() {
  const reduce = useReducedMotion();
  const [today] = useState(() => termForDay());
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(today.slug);

  useEffect(() => {
    if (dismissedToday()) return undefined;
    const t = setTimeout(() => setVisible(true), reduce ? 400 : 2400);
    return () => clearTimeout(t);
  }, [reduce]);

  const view = TERM_BY_SLUG.get(slug) || today;
  const related = (view.relatedTerms || []).map((r) => TERM_BY_SLUG.get(r)).filter(Boolean);
  const meta = [today.category, today.difficulty].filter(Boolean).join(' \u00B7 ');
  const close = () => { setVisible(false); rememberDismissal(); };
  const learn = () => { setOpen((o) => !o); setSlug(today.slug); };

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside className={`radio ${open ? 'is-open' : ''}`} role="complementary" aria-label="Word of the day"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, x: 12 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
          transition={{ duration: reduce ? 0.2 : 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <div className="radio__top">
            <p className="radio__label"><i className="radio__dot" aria-hidden="true" />Paddock Radio // Word of the day</p>
            <span className="radio__wave" aria-hidden="true"><b /><b /><b /><b /><b /></span>
            <button className="radio__x" onClick={close} aria-label="Dismiss the word of the day"><X size={16} aria-hidden="true" /></button>
          </div>
          <h2 className="radio__title">{today.title}</h2>
          <p className="radio__desc">{termBlurb(today)}</p>
          {meta && <p className="radio__meta">{meta}</p>}
          <button className="radio__more" onClick={learn} aria-expanded={open} aria-controls="radio-read">{open ? 'Close entry' : 'Learn more'} {!open && <ArrowUpRight size={13} aria-hidden="true" />}</button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div id="radio-read" className="radio__read" role="region" aria-label={`${view.title}, full entry`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduce ? { duration: 0 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                <div className="radio__read-in" key={view.slug}>
                  <div className="radio__read-head">
                    <h3>{view.title}</h3>
                    {view.slug !== today.slug && <button className="radio__back" onClick={() => setSlug(today.slug)}>Back to today's word</button>}
                  </div>
                  <dl>
                    {READ.filter(([k]) => view[k]).map(([k, label]) => <div key={k}><dt>{label}</dt><dd>{view[k]}</dd></div>)}
                  </dl>
                  {related.length > 0 && (
                    <div className="radio__rel"><span>Related</span>{related.map((r) => <button key={r.slug} onClick={() => setSlug(r.slug)}>{r.title}</button>)}</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export default function Home() {
  const reduce = useReducedMotion();
  const heroRef = useRef(null); const stmtRef = useRef(null);
  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const giantY = useTransform(heroP, [0, 1], ['0%', '30%']);
  const photoY = useTransform(heroP, [0, 1], ['0%', '10%']);
  const { scrollYProgress: stmtP } = useScroll({ target: stmtRef, offset: ['start start', 'end end'] });
  const rot = useTransform(stmtP, [0, 1], [-7, 6]);
  const scl = useTransform(stmtP, [0, 0.5, 1], [0.9, 1.04, 0.96]);
  const textP = useTransform(stmtP, [0.1, 0.85], [0, 1]);

  const seasonsR = useLoad(getSeasons);
  const peopleR = useLoad(() => getPeople({ limit: 40 }));
  const nextR = useLoad(getNextRace);

  const champSeasons = seasonsR.data ? seasonsR.data.seasons.filter((s) => s.champion) : [];
  const profileCount = peopleR.data ? peopleR.data.totalDrivers : null;
  const ev = nextR.data && nextR.data.evaluation ? nextR.data.evaluation.summary : null;
  const seasonYears = champSeasons.length ? champSeasons.map((x) => x.season) : null;
  const numbers = [
    { label: 'Seasons covered', range: seasonYears ? `${Math.min(...seasonYears)}\u2013${Math.max(...seasonYears)}` : '1950\u20132025', value: champSeasons.length, text: 'Every championship season from 1950 to 2025, with champions and constructors taken from the Jolpica F1 API.' },
    { label: 'Drivers in the archive', value: profileCount, text: 'Every driver who has started a Grand Prix, with verified statistics, career timelines and short stories.' },
    { label: 'Races backtested', range: 'since 2022', value: ev ? ev.races : 0, text: 'The model is replayed on every race since 2022 using only earlier races, and scored in the open.' },
  ];


  return (
    <div className="home">
      <section className="hero" ref={heroRef} aria-label="Introduction">
        <motion.div className="hero__giant" aria-hidden="true" style={reduce ? undefined : { y: giantY }}>PADDOCK</motion.div>
        <motion.div className="hero__wrap" style={reduce ? undefined : { y: photoY }}><div className="hero__img"><img src="/images/hero-fangio-1957.jpg" alt="Juan Manuel Fangio racing a Maserati 250F at the Nurburgring, 1957" fetchpriority="high" /></div></motion.div>
        <div className="hero__fade" />
        <motion.h1 className="hero__title" initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}>The Story of Formula 1.</motion.h1>
        <motion.p className="hero__side" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }}>The past, the people and the next chapter of the sport.</motion.p>
        <a className="hero__dot" href="#statement" aria-label="Scroll to the introduction" />
        <p className="hero__credit-line">Fangio, Nurburgring 1957. Photo: {HERO_CREDIT.author}, <a href={HERO_CREDIT.licenseUrl} target="_blank" rel="noreferrer noopener">{HERO_CREDIT.license}</a>, via <a href={HERO_CREDIT.source} target="_blank" rel="noreferrer noopener">Wikimedia Commons</a></p>
      </section>

      <section id="statement" className="stmt dark" ref={stmtRef} aria-label="About PADDOCK">
        <div className="stmt__stick">
          <Plus>About PADDOCK</Plus>
          <motion.div className="stmt__img" style={reduce ? undefined : { rotate: rot, scale: scl }}>
            <img src="/images/home.png" alt="Black-and-white Formula 1 poster prints: Ayrton Senna in the McLaren, a Ferrari, and a Ferrari driver in portrait" loading="lazy" decoding="async" />
            <span className="stmt__tag"><i />PADDOCK / Archive</span>
          </motion.div>
          <div className="stmt__col">
            <RevealText className="stmt__text" text={STATEMENT} progress={textP} />
            <a className="stmt__cta" href={FANCODE_F1} target="_blank" rel="noopener noreferrer">Watch the race <ArrowUpRight size={15} aria-hidden="true" /><span className="sr-only"> (opens FanCode in a new tab)</span></a>
          </div>
        </div>
      </section>

      <section className="stack dark" aria-label="The three sections">
        {SERVICES.map((s, i) => (
          <article key={s.to} className="svc" style={{ '--i': i }}>
            <span className="npill num">{String(i + 2).padStart(2, '0')}</span>
            <div className="svc__body">
              <h2 className={`svc__title ${s.titleClass || ''}`}>{s.title}</h2>
              <p className="svc__text">{s.text}</p>
              <div className="chips">{s.chips.map((c) => <span key={c} className="chip">{c}</span>)}</div>
              <Link to={s.to} className="arrow-link">{s.cta || 'Explore'} {s.ctaIcon === 'up' ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />}</Link>
            </div>
            <MotionLink to={s.to} className="svc__img" aria-label={`Open ${s.title}`} initial="rest" whileHover="hover" whileFocus="hover" animate="rest">
              <motion.img src={s.image.src} alt={s.image.alt} loading="lazy" decoding="async" style={{ objectPosition: s.image.focus }} variants={{ rest: { scale: 1 }, hover: { scale: 1.06 } }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
              <span className="svc__shade" aria-hidden="true" />
              <span className="svc__cap" aria-hidden="true">
                <span className="svc__cap-no num">{String(i + 2).padStart(2, '0')}</span>
                <span className="svc__cap-title">{s.title}</span>
                <motion.span className="svc__cap-go" variants={{ rest: { x: 0, y: 0 }, hover: { x: 4, y: -4 } }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}><ArrowUpRight size={18} /></motion.span>
              </span>
              <motion.span className="svc__line" aria-hidden="true" variants={{ rest: { scaleX: 0 }, hover: { scaleX: 1 } }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
            </MotionLink>
          </article>
        ))}
      </section>

      <NumbersStrip stats={numbers} error={seasonsR.error || peopleR.error} />

      <RadioPopup />
    </div>
  );
}
