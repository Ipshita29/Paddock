import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight, Plus as PlusIcon } from 'lucide-react';
import { Plus, Reveal, RevealText, SectionHead, Faq, Status } from '../components/Footer.jsx';
import { getHistory, getSeasons, getPeople, getPerson, getNextRace } from '../services/api.js';

const WIKI = 'https://commons.wikimedia.org/wiki/File:';
// Photographs used by static parts of the page, with their licence details.
const IMG = {
  d1950: { file: 'd1950.jpg', alt: 'An Alfa Romeo 158, the car that opened the World Championship in 1950', credit: { author: 'azrhey', license: 'CC BY-SA 2.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0', source: `${WIKI}Alfa_Romeo_158_Alfetta_1950_Museo_Storico_OCT_2015.jpg` } },
  d1960: { file: 'd1960.jpg', alt: 'A Lotus 49', credit: { author: 'Deep silence (Mikaël Restoux)', license: 'CC BY-SA 3.0', licenseUrl: 'http://creativecommons.org/licenses/by-sa/3.0/', source: `${WIKI}Lotus_49-1.JPG` } },
  senna: { file: 'portrait-senna.jpg', alt: 'Ayrton Senna in his McLaren race suit', focus: '33% 30%', credit: { author: 'Instituto Ayrton Senna', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0', source: 'https://commons.wikimedia.org/wiki/File:Ayrton_Senna_9.jpg' } },
  next: { file: 'verstappen-2026.jpg', alt: 'Max Verstappen in the Red Bull, 2026 Chinese Grand Prix qualifying', credit: { author: 'Liauzh', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0', source: `${WIKI}2026_Chinese_GP_-_Red_Bull_-_Max_Verstappen_-_Qualifying.jpg` } },
};
const HERO_CREDIT = { author: 'Willy Pragher', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0', source: `${WIKI}Fangio_Maserati_250F_Nurburgring_1957.jpg` };

const STATEMENT = 'PADDOCK is an independent Formula 1 magazine. We tell the story of the sport from the first championship in 1950, celebrate the people who shaped it, and estimate who wins next.';
const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;

const SERVICES = [
  { to: '/history', title: 'The History', text: 'Cars, constructors, seasons and the moments that defined each decade, from 1950 to today.', chips: ['Decades', 'Iconic cars', 'Constructors', 'Regulations', 'Champions'], image: IMG.d1950 },
  { to: '/people', title: 'The People', text: 'The Grid: every driver who has started a Grand Prix, from 1950 to today, with short stories and career timelines.', chips: ['Every driver', 'Short stories', 'Career timelines', 'Champions'], image: IMG.senna },
  { to: '/prediction', title: 'The Prediction', text: 'A calibrated estimate of who wins the next Grand Prix, with its full track record in the open.', chips: ['Qualifying', 'Recent form', 'Circuit record', 'Backtest', 'Calibrated'], image: IMG.next },
];

/** Constructors' titles per team, most first, from the seasons API. */
function constructorTitles(seasons, limit = 6) {
  const map = new Map();
  seasons.forEach((s) => {
    const c = s.constructorChampion; if (!c) return;
    const e = map.get(c.constructorId) || { id: c.constructorId, name: c.name, years: [] };
    e.years.push(s.season); map.set(c.constructorId, e);
  });
  return [...map.values()].sort((a, b) => b.years.length - a.years.length).slice(0, limit);
}

function useLoad(fn) {
  const [s, setS] = useState({ data: null, error: null, loading: true });
  useEffect(() => { let live = true; fn().then((d) => live && setS({ data: d, error: null, loading: false })).catch((e) => live && setS({ data: null, error: e.message, loading: false })); return () => { live = false; }; }, []); // eslint-disable-line
  return s;
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

  const hist = useLoad(getHistory);
  const seasonsR = useLoad(getSeasons);
  const peopleR = useLoad(() => getPeople({ limit: 40 }));
  const nextR = useLoad(getNextRace);
  const sennaR = useLoad(() => getPerson('senna'));
  const schuR = useLoad(() => getPerson('michael_schumacher'));

  const decades = hist.data ? hist.data.decades : [];
  const champSeasons = seasonsR.data ? seasonsR.data.seasons.filter((s) => s.champion) : [];
  const cons = useMemo(() => constructorTitles(champSeasons, 6), [seasonsR.data]); // eslint-disable-line
  const legends = peopleR.data ? peopleR.data.items : [];
  const profileCount = peopleR.data ? peopleR.data.totalDrivers : null;
  const ev = nextR.data && nextR.data.evaluation ? nextR.data.evaluation.summary : null;
  const d1950 = decades.find((d) => d.id === '1950s');
  const lauda = legends.find((p) => p.driverId === 'lauda'); const prost = legends.find((p) => p.driverId === 'prost'); const sennaS = legends.find((p) => p.driverId === 'senna');
  const nextName = nextR.data && nextR.data.race ? nextR.data.race.raceName : 'The next Grand Prix';

  const faq = [
    { q: 'Where does the data come from?', a: 'Race data comes from the Jolpica F1 API, an open Ergast-compatible source. Photographs come from Wikimedia Commons, with author and licence credited on every image.' },
    { q: 'Does PADDOCK predict with certainty?', a: ev ? `No. Every prediction is a statistical estimate. On races since 2022 the model picked the winner ${pct(ev.model.top1)} of the time, against ${pct(ev.poleBaseline.top1)} for simply backing pole position.` : 'No. Every prediction is a statistical estimate, scored in the open against the simple baseline of backing pole position.' },
    { q: 'What happens when qualifying has not happened?', a: 'Nothing is published. PADDOCK shows no prediction until the grid is set, and never substitutes made-up numbers.' },
    { q: 'Is PADDOCK affiliated with Formula 1?', a: 'No. PADDOCK is an independent publication, not affiliated with Formula 1, the FIA or any team.' },
    { q: 'Why do some profiles have no karting history?', a: 'Only documented, verified entries are shown. Where PADDOCK has none, the profile says so rather than guessing.' },
  ];

  const highlights = [
    d1950 && { to: '/history/1950s', title: 'Fangio, Nurburgring 1957', image: d1950.cars[1].image, cap: 'History, 1950s', yr: '1957' },
    lauda && { to: '/history/1970s', title: 'Lauda and the fire of 1976', image: lauda.image, cap: 'History, 1970s', yr: '1976' },
    sennaS && { to: '/people/senna', title: 'Ayrton Senna', image: sennaS.image, cap: 'People, Legend', yr: String(sennaR.data && sennaR.data.debut ? sennaR.data.debut.season : '') },
    { to: '/prediction', title: nextName, image: IMG.next, cap: 'Prediction', yr: nextR.data && nextR.data.race ? String(nextR.data.race.season) : '' },
  ].filter(Boolean);
  const stories = [
    d1950 && { to: '/history/1950s', title: 'Fangio hunts down the Ferraris at the Nurburgring', img: d1950.cars[1].image, cat: 'History, 1950s' },
    lauda && { to: '/history/1970s', title: 'Lauda returns six weeks after the fire', img: lauda.image, cat: 'History, 1970s' },
    prost && { to: '/history/1980s', title: 'Senna and Prost collide at Suzuka', img: prost.image, cat: 'History, 1980s' },
  ].filter(Boolean);

  const legendCards = [[sennaR, 'poles', 'pole positions'], [schuR, 'titles', 'world championships']].map(([r, k, cap]) => {
    const p = r.data; if (!p) return null;
    return { p, big: k === 'poles' ? p.stats.poles : p.stats.titles.length, cap, quote: p.story.split('. ')[0] + '.' };
  }).filter(Boolean);

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
          <motion.div className="stmt__img" style={reduce ? undefined : { rotate: rot, scale: scl }}><img src={`/images/${IMG.d1950.file}`} alt={IMG.d1950.alt} loading="lazy" /></motion.div>
          <RevealText className="stmt__text" text={STATEMENT} progress={textP} />
          <p className="stmt__credit">Photo: {IMG.d1950.credit.author}, {IMG.d1950.credit.license}, via Wikimedia Commons</p>
        </div>
      </section>

      <section className="stack dark" aria-label="The three sections">
        {SERVICES.map((s, i) => (
          <article key={s.to} className="svc" style={{ '--i': i }}>
            <span className="npill num">{i + 1}</span>
            <div className="svc__body">
              <h2 className="svc__title">{s.title}</h2>
              <p className="svc__text">{s.text}</p>
              <div className="chips">{s.chips.map((c) => <span key={c} className="chip">{c}</span>)}</div>
              <Link to={s.to} className="arrow-link">Explore <ArrowRight size={14} /></Link>
            </div>
            <Link to={s.to} className="svc__img" aria-label={`Open ${s.title}`}><img src={`/images/${s.image.file}`} alt={s.image.alt} loading="lazy" style={{ objectPosition: s.image.focus }} /></Link>
            <span className="svc__credit">Photo: {s.image.credit.author}, {s.image.credit.license}</span>
          </article>
        ))}
      </section>

      <section className="light sec" aria-label="Why PADDOCK">
        <SectionHead label="Why PADDOCK?" lead="Archive-deep and data-honest —" tail="the PADDOCK way" />
        <div className="cards">
          <Reveal className="scard scard--a scard--photo"><img src={`/images/${IMG.d1960.file}`} alt={IMG.d1960.alt} loading="lazy" /><Plus>Archival photography</Plus><p className="scard__text" style={{ marginLeft: 0 }}>Every photograph is licensed from Wikimedia Commons and credited to its author.</p></Reveal>
          <Reveal delay={0.05} className="scard scard--b"><Plus>Seasons covered</Plus><div><p className="scard__big num">{champSeasons.length || '—'}</p><p className="scard__text">Every championship season from 1950 to 2025, with champions and constructors taken from the Jolpica F1 API.</p></div></Reveal>
          <Reveal className="scard scard--c"><Plus>Drivers in the archive</Plus><div><p className="scard__big num">{profileCount || '—'}</p><p className="scard__text">Every driver who has started a Grand Prix, with verified statistics, career timelines and short stories.</p></div></Reveal>
          <Reveal delay={0.05} className="scard scard--d scard--dark"><Plus>Races backtested</Plus><div><p className="scard__big num">{ev ? ev.races : '—'}</p><p className="scard__text">The model is replayed on every race since 2022 using only earlier races, and scored in the open.</p></div></Reveal>
        </div>
        <Status error={seasonsR.error || peopleR.error || hist.error} onRetry={() => window.location.reload()} />
      </section>

      {cons.length > 0 && (
        <section className="light" style={{ paddingBottom: 'clamp(72px, 10vw, 150px)' }} aria-label="Constructors">
          <SectionHead label="Constructors" lead="Titles, team by team." tail="The names behind the cars." count={cons.length} />
          <div className="cgrid">
            {cons.map((c, i) => (
              <Reveal key={c.id} delay={(i % 3) * 0.06} className="cell">
                <Plus size={14} className="plus--sm">Constructors' titles</Plus>
                <p className="cell__name">{c.name}</p>
                <p className="cell__meta"><b className="num">{c.years.length} titles</b><span className="num">{c.years[0]} to {c.years[c.years.length - 1]}</span></p>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {highlights.length > 0 && (
        <section className="light" style={{ paddingBottom: 'clamp(72px, 10vw, 150px)' }} aria-label="Highlights">
          <SectionHead label="Highlights" lead="Stories picked from the archive," tail="and the next race." count={highlights.length} />
          <div className="hl">
            {highlights.map((h, i) => (
              <Reveal key={h.to + h.title} delay={(i % 2) * 0.08}>
                <Link to={h.to} className="pcard">
                  <div className="pcard__img"><img src={`/images/${h.image.file}`} alt={h.image.alt} loading="lazy" style={{ objectPosition: h.image.focus }} /><span className="pcard__title">{h.title}</span></div>
                  <div className="pcard__cap"><Plus size={14} className="plus--sm">{h.cap}</Plus><span className="num">{h.yr}</span></div>
                </Link>
                <p className="credit">Photo: {h.image.credit.author}, {h.image.credit.license}</p>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {legendCards.length > 0 && (
        <section className="light" style={{ paddingBottom: 'clamp(72px, 10vw, 150px)' }} aria-label="Legends by the numbers">
          <SectionHead label="Legends" lead="Legends," tail="by the numbers." count={legendCards.length} />
          <div className="lcards">
            {legendCards.map(({ p, big, cap, quote }) => (
              <Reveal key={p.driverId} className="lcard">
                <div className="lcard__img"><img src={`/images/${p.image.file}`} alt={p.image.alt} loading="lazy" style={{ objectPosition: p.image.focus }} /></div>
                <div className="lcard__mid"><p className="lcard__quote">{quote}</p><Link to={`/people/${p.driverId}`} className="plus plus--sm"><PlusIcon size={14} color="#FF4A1C" />{p.name}, {p.nationality}</Link></div>
                <div className="lcard__right"><p className="lcard__big num">{big}</p><p className="lcard__cap">{cap}</p></div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <section className="dark sec" aria-label="The Prediction">
        <SectionHead label="The Prediction" lead="Calibrated. Honest." tail="Built on data." count={3} />
        {nextR.loading && <Status loading label="Loading the model's track record. The first load can take a minute." />}
        {nextR.error && <Status error={nextR.error} onRetry={() => window.location.reload()} />}
        {ev && (
          <div className="plans">
            {[
              { tag: 'Baseline', v: ev.poleBaseline.top1, unit: 'winner picked', d: 'Simply backing the driver on pole position.', f: ['No form or circuit knowledge', 'The bar the model has to beat', 'Replayed on every race since 2022', 'Always available'] },
              { tag: 'PADDOCK model', v: ev.model.top1, unit: 'winner picked', d: 'A calibrated model using grid, form and circuit record.', f: ['Re-fitted for every race', 'Only earlier races are used', 'Probabilities sum to 100%', 'No grid, no prediction'] },
              { tag: 'Top three', v: ev.model.top3, unit: 'winner in top 3', d: "How often the real winner was among the model's top three.", f: ['Scored on the same races', 'Shown with every miss', 'Calibration published', 'An estimate, never a promise'] },
            ].map((p) => (
              <Reveal key={p.tag} className="plan">
                <span className="plan__tag"><Plus size={14} className="plus--sm">{p.tag}</Plus></span>
                <p className="plan__price num">{pct(p.v)}<small>{p.unit}</small></p>
                <p className="plan__desc">{p.d}</p>
                <ul className="plan__feat">{p.f.map((f) => <li key={f}><PlusIcon size={14} />{f}</li>)}</ul>
                <Link to="/prediction" className="btn">See the prediction</Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      <section className="dark" style={{ paddingBottom: 'clamp(72px, 10vw, 150px)' }} aria-label="Questions">
        <SectionHead label="FAQ" lead="Got any questions?" tail="We've got answers." count={faq.length} />
        <div className="px" style={{ maxWidth: 1040, marginLeft: 'auto' }}><Faq items={faq} /></div>
      </section>

      {stories.length > 0 && (
        <section className="dark" style={{ paddingBottom: 'clamp(40px, 6vw, 80px)' }} aria-label="Journal">
          <SectionHead label="Journal" lead="Moments worth" tail="a second look." count={stories.length} />
          <div className="jrows">
            {stories.map((s) => (
              <Link key={s.to + s.title} to={s.to} className="jrow">
                <span className="jrow__img"><img src={`/images/${s.img.file}`} alt={s.img.alt} loading="lazy" style={{ objectPosition: s.img.focus }} /></span>
                <span className="jrow__body"><span className="jrow__title">{s.title}</span><span className="jrow__cat">{s.cat}</span></span>
                <PlusIcon className="jrow__plus" size={22} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
