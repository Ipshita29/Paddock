import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const LINKS = [
  { to: '/', label: 'Home', n: '1.0' },
  { to: '/history', label: 'Stories', n: '2.0' },
  { to: '/people', label: 'People', n: '3.0' },
  { to: '/prediction', label: 'Prediction', n: '4.0' },
];

// logo on the left, links in the middle, menu button on the right
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [light, setLight] = useState(false);
  const { pathname } = useLocation();
  // close the menu when the page changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // use dark text while the bar is over a light section
  useEffect(() => {
    function check() {
      const elements = document.elementsFromPoint(window.innerWidth / 2, 40);
      let found = null;
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el.closest('.nav') || el.closest('.menu')) continue;
        if (el.closest('.light, .dark')) {
          found = el;
          break;
        }
      }
      setLight(found !== null && found.closest('.light') !== null);
    }

    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    const timer = setTimeout(check, 400);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      clearTimeout(timer);
    };
  }, [pathname]);

  // stop the page from scrolling while the menu is open, and close it with Escape
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';

    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const dots = [];
  for (let i = 0; i < 9; i++) dots.push(<i key={i} />);

  return (
    <>
      <header className={`nav ${light ? 'nav--light' : ''}`}>
        <Link to="/" className="nav__logo" aria-label="PADDOCK home">PADDOCK<sup>®</sup></Link>
        <nav className="nav__bar" aria-label="Primary">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `nav__link ${isActive ? 'is-active' : ''}`}><small className="num">{l.n}</small>{l.label}</NavLink>
          ))}
        </nav>
        <button className="nav__menu" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
          <span className="dots" aria-hidden="true">{dots}</span>
        </button>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div className="menu" role="dialog" aria-label="Menu" initial={{ clipPath: 'inset(0 0 100% 0)' }} animate={{ clipPath: 'inset(0 0 0% 0)' }} exit={{ clipPath: 'inset(0 0 100% 0)' }} transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}>
            <div className="menu__top">
              <Link to="/" className="nav__logo">PADDOCK<sup>®</sup></Link>
              <button className="menu__x" onClick={() => setOpen(false)} aria-label="Close menu"><X size={26} /></button>
            </div>
            <p className="menu__label">Menu</p>
            <nav className="menu__list" aria-label="Menu">
              {LINKS.map((l) => <Link key={l.to} to={l.to}><small className="num">{l.n}</small>{l.label}</Link>)}
            </nav>
            <div className="menu__foot">
              <div><p>The Past. The People. The Next Chapter.</p><p>An independent Formula 1 magazine</p></div>
              <div className="chips"><span className="chip">2.0 Stories</span><span className="chip">3.0 People</span><span className="chip">4.0 Prediction</span></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
