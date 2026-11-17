import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Plus, Reveal, SectionHead, Credit, Status } from '../components/Footer.jsx';
import { getHistory, getSeasons, getSeason } from '../services/api.js';

/** Drivers with the most world championships, from the seasons API. */
function driverTitles(seasons, limit = 6) {
  const map = new Map();
  seasons.forEach((s) => {
    if (!s.champion) return;
    const e = map.get(s.champion.driverId) || { id: s.champion.driverId, name: s.champion.name, years: [] };
    e.years.push(s.season); map.set(s.champion.driverId, e);
  });
  return [...map.values()].sort((a, b) => b.years.length - a.years.length || a.years[0] - b.years[0]).slice(0, limit);
}

/** Live standings and race winners for one season (cached by the server, curated fallback). */
function SeasonPanel({ season, onClose }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let live = true;
    setState({ loading: true, data: null, error: null });
    getSeason(season).then((data) => live && setState({ loading: false, data, error: null })).catch((e) => live && setState({ loading: false, data: null, error: e.message }));
    return () => { live = false; };
  }, [season]);
  const d = state.data;
  return (
    <aside className="spanel" aria-label={`${season} season details`}>
      <div className="spanel__head"><h3 className="h3"><span className="num">{season}</span> <span className="dim">season</span></h3><button className="spanel__x" onClick={onClose} aria-label="Close season details"><X size={22} /></button></div>
      <Status loading={state.loading} error={state.error} label="Loading the season" />
      {d && (
        <>
          {d.note && <p className="spanel__note">{d.note}</p>}
          <div className="spanel__cols">
            {d.driverStandings.length > 0 && (
              <div><h4>Drivers' standings</h4>
                <ol>{d.driverStandings.map((s) => <li key={s.id}><span className="num">{s.position}</span><span>{s.name}</span><span className="num">{s.points}</span></li>)}</ol></div>
            )}
            {d.winners.length > 0 && (
              <div><h4>Race winners</h4>
                <ol className="spanel__win">{d.winners.map((w) => <li key={w.round}><span className="num">{w.round}</span><span>{w.raceName.replace(' Grand Prix', ' GP')}</span><span>{w.winner}</span></li>)}</ol></div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function Index({ decades, seasons }) {
  const top = useMemo(() => driverTitles(seasons, 6), [seasons]);
  return (
    <div>
      <section className="light" style={{ paddingBottom: 'clamp(72px, 10vw, 150px)' }}>
        <div className="phead px">
          <h1 className="h1">History</h1>
          <p>Seventy-five years of Formula 1, one decade at a time: the cars, the constructors, the rules and the moments that defined each era.</p>
          <span className="npill num" aria-label={`${decades.length} decades`}>{decades.length}</span>
        </div>
        <div className="dgrid">
          {decades.map((d, i) => (
            <Reveal key={d.id} delay={(i % 2) * 0.08}>
              <Link to={`/history/${d.id}`} className="pcard">
                <div className="pcard__img"><img src={`/images/${d.image.file}`} alt={d.image.alt} loading={i < 2 ? 'eager' : 'lazy'} /><span className="pcard__title">{d.label}</span></div>
                <div className="pcard__cap"><Plus size={14} className="plus--sm">{d.title}</Plus><span className="num">{d.years[0]} to {Math.min(d.years[1], new Date().getFullYear())}</span></div>
              </Link>
              <p className="credit">Photo: {d.image.credit.author}, {d.image.credit.license}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {top.length > 0 && (
        <section className="dark sec titles" aria-label="Most championships">
          <SectionHead label="Champions" lead="Most world titles." tail="Names that defined the eras." count={top.length} />
          {top.map((t, i) => (
            <Reveal key={t.id} className="trow">
              <span className="npill num">{i + 1}</span>
              <div><p className="trow__name">{t.name}</p><p className="trow__years num">{t.years.join(', ')}</p></div>
              <p className="trow__n num">{t.years.length}</p>
            </Reveal>
          ))}
        </section>
      )}
    </div>
  );
}

function Decade({ decades, seasons, meta, id }) {
  const [openSeason, setOpenSeason] = useState(null);
  useEffect(() => { setOpenSeason(null); }, [id]);
  const idx = decades.findIndex((d) => d.id === id);
  if (idx < 0) return <Navigate to="/history" replace />;
  const d = decades[idx]; const prev = decades[idx - 1]; const next = decades[idx + 1];
  const rows = seasons.filter((s) => s.season >= d.years[0] && s.season <= d.years[1]);

  return (
    <div>
      <section className="dark px d-top">
        <Link to="/history" className="back"><ArrowLeft size={14} /> All decades</Link>
        <div className="d-title">
          <Plus>History, <span className="num">{d.years[0]} to {Math.min(d.years[1], new Date().getFullYear())}</span></Plus>
          <h1 className="h1"><span className="num">{d.label}</span> {d.title}</h1>
        </div>
        <Reveal className="d-hero"><img src={`/images/${d.image.file}`} alt={d.image.alt} /></Reveal>
        <Credit image={d.image} />
        <div className="d-intro">
          <Plus>{d.kicker}</Plus>
          <Reveal>{d.intro.map((t) => <p key={t.slice(0, 16)}>{t}</p>)}</Reveal>
        </div>
      </section>

      <section className="dark sec" aria-label="Defining moments">
        <SectionHead label="Defining moments" lead="The moments that" tail="shaped the decade." count={d.moments.length} />
        {d.moments.map((m, i) => (
          <Reveal key={m.title} className="mrow">
            <span className="npill num">{i + 1}</span>
            <span className="mrow__date">{m.date}</span>
            <div><h3 className="mrow__title">{m.title}</h3><p className="mrow__text">{m.text}</p></div>
          </Reveal>
        ))}
      </section>

      <section className="light sec" aria-label="Iconic cars">
        <SectionHead label="Iconic cars" lead="The machines" tail="behind the story." count={d.cars.length} />
        <div className="cars">
          {d.cars.map((car) => {
            const img = car.image && car.image.file !== d.image.file ? car.image : null;
            return (
              <Reveal key={car.name} className={`car ${img ? '' : 'car--plain'}`}>
                {img && <div className="car__img"><img src={`/images/${img.file}`} alt={img.alt} loading="lazy" /></div>}
                <div className="car__body"><span className="car__yr num">{car.year}</span><h3 className="car__name">{car.name}</h3><p className="car__text">{car.text}</p></div>
                {img && <p className="credit">Photo: {img.credit.author}, {img.credit.license}</p>}
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="dark sec" aria-label="Constructors and regulations">
        <div className="two">
          <div><h3 className="h3">Important <span className="dim">constructors</span></h3>{d.constructors.map((k) => <div key={k.name} className="lrow lrow--ctor"><b>{k.name}</b><span>{k.text}</span></div>)}</div>
          <div><h3 className="h3">Regulation <span className="dim">changes</span></h3>{d.regulations.map((r) => <div key={r.year + r.text} className="lrow"><b className="num">{r.year}</b><span>{r.text}</span></div>)}</div>
        </div>
      </section>

      <section className="dark" style={{ paddingBottom: 'clamp(72px, 10vw, 150px)' }} aria-label="Championship highlights">
        <SectionHead label="Champions" lead="Championship" tail="highlights." count={rows.length} />
        <p className="px muted" style={{ marginTop: -28, marginBottom: 24, fontSize: 15 }}>Select a season for its standings and every race winner.</p>
        {rows.map((s) => (
          <div key={s.season} className={`champ ${openSeason === s.season ? 'is-open' : ''}`}>
            <button className="champ__yr num" onClick={() => setOpenSeason(openSeason === s.season ? null : s.season)} aria-expanded={openSeason === s.season}>{s.season}</button>
            <span className="champ__name">{s.champion ? s.champion.name : <em className="dim">In progress{s.leader ? `, leader ${s.leader.name}` : ''}</em>}</span>
            <span>{s.champion ? s.champion.constructor : ''}</span>
            <span>{s.constructorChampion ? `Constructors: ${s.constructorChampion.name}` : s.season < 1958 ? 'No constructors\' title yet' : ''}</span>
          </div>
        ))}
        {openSeason && <div className="px" style={{ paddingTop: 24 }}><SeasonPanel season={openSeason} onClose={() => setOpenSeason(null)} /></div>}
        <div className="px sources">
          <p>{meta.sources.join(' · ')}</p>
          <p>{d.references.map((r, i) => <span key={r.url}>{i > 0 && ' · '}<a href={r.url} target="_blank" rel="noreferrer noopener">{r.label}</a></span>)}</p>
        </div>
      </section>

      <section className="dark" style={{ paddingBottom: 'clamp(40px, 6vw, 80px)' }} aria-label="More decades">
        <div className="pager">
          {prev ? <Link to={`/history/${prev.id}`}><span className="muted"><ArrowLeft size={14} style={{ verticalAlign: -2 }} /> Previous</span><span className="h3">{prev.label}: {prev.title}</span></Link> : <span />}
          {next ? <Link to={`/history/${next.id}`}><span className="muted">Next <ArrowRight size={14} style={{ verticalAlign: -2 }} /></span><span className="h3">{next.label}: {next.title}</span></Link> : <span />}
        </div>
      </section>
    </div>
  );
}

export default function History() {
  const { decade } = useParams();
  const [state, setState] = useState({ loading: true, error: null, decades: [], seasons: [], meta: null });
  const load = () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.all([getHistory(), getSeasons()])
      .then(([h, s]) => setState({ loading: false, error: null, decades: h.decades, seasons: s.seasons, meta: h.meta }))
      .catch((e) => setState((s) => ({ ...s, loading: false, error: e.message })));
  };
  useEffect(load, []);

  if (state.loading || state.error) {
    return <div className="dark" style={{ minHeight: '70vh', paddingTop: 140 }}><Status loading={state.loading} error={state.error} onRetry={load} label="Opening the archive" /></div>;
  }
  return decade ? <Decade decades={state.decades} seasons={state.seasons} meta={state.meta} id={decade} /> : <Index decades={state.decades} seasons={state.seasons} />;
}
