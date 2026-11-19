import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useTransform } from 'framer-motion';
import { AlertTriangle, ArrowUpRight, Loader } from 'lucide-react';

// Small shared pieces (Plus, Reveal, SectionHead, RevealText, Credit, Status) and the Footer.
// They live in this file because the project has no separate component files for them.

// the small orange + sign before labels
export function Plus({ size = 16, children, className = '' }) {
  return (
    <span className={`plus ${className}`}>
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 1v14M1 8h14" /></svg>
      {children}
    </span>
  );
}

// moves its content up a little when it scrolls into view
// it never starts invisible, so text can always be read
export function Reveal({ children, delay = 0, className = '', as = 'div', ...rest }) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  if (reduce) return <Tag className={className} {...rest}>{children}</Tag>;
  return (
    <Tag className={className} initial={{ y: 26 }} whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }} {...rest}>
      {children}
    </Tag>
  );
}

// section heading: label on the left, big title, count on the right
export function SectionHead({ label, lead, tail, count }) {
  return (
    <div className="shead px">
      <Plus>{label}</Plus>
      <Reveal as="h2" className="h2">{lead}{tail && <> <span className="dim">{tail}</span></>}</Reveal>
      {count !== undefined && <span className="npill num" aria-label={`${count} items`}>{count}</span>}
    </div>
  );
}

function Word({ children, progress, range }) {
  const color = useTransform(progress, range, ['#5f5f5f', '#ffffff']);
  return <motion.span style={{ color }}>{children} </motion.span>;
}

// words turn from grey to white as you scroll (progress goes from 0 to 1)
export function RevealText({ text, progress, className = '' }) {
  const reduce = useReducedMotion();
  const words = text.split(' ');
  if (reduce) return <p className={className} style={{ color: '#fff' }}>{text}</p>;
  return (
    <p className={className}>
      {words.map((w, i) => <Word key={i + w} progress={progress} range={[i / words.length, Math.min((i + 1.6) / words.length, 1)]}>{w}</Word>)}
    </p>
  );
}

// photo credit line for a Wikimedia Commons photograph
export function Credit({ image, caption = true, className = '' }) {
  if (!image) return null;
  const c = image.credit;
  return (
    <p className={`credit ${className}`}>
      {caption && image.caption ? `${image.caption} ` : ''}Photo: {c.author}, <a href={c.licenseUrl || c.source} target="_blank" rel="noreferrer noopener">{c.license}</a>, via <a href={c.source} target="_blank" rel="noreferrer noopener">Wikimedia Commons</a>
    </p>
  );
}

// loading and error messages used by every page
export function Status({ loading, error, onRetry, label = 'Loading' }) {
  if (loading) return <div className="status" role="status"><Loader size={18} className="spin" /><span>{label}</span></div>;
  if (error) {
    return (
      <div className="status status--error" role="alert">
        <AlertTriangle size={18} /><span>{error}</span>
        {onRetry && <button className="btn btn--outline btn--auto" onClick={onRetry}>Try again</button>}
      </div>
    );
  }
  return null;
}

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__top px">
        <p className="footer__big">The Past. The People. <span>The Next Chapter.</span></p>
        <div className="footer__col"><h4>Navigation</h4>
          <Link to="/">Home <ArrowUpRight size={13} /></Link><Link to="/history">Stories <ArrowUpRight size={13} /></Link><Link to="/people">People <ArrowUpRight size={13} /></Link><Link to="/prediction">Prediction <ArrowUpRight size={13} /></Link>
        </div>
        <div className="footer__col"><h4>Sources</h4>
          <a href="https://github.com/jolpica/jolpica-f1" target="_blank" rel="noreferrer noopener">Jolpica F1 API <ArrowUpRight size={13} /></a>
          <a href="https://commons.wikimedia.org/" target="_blank" rel="noreferrer noopener">Wikimedia Commons <ArrowUpRight size={13} /></a>
        </div>
      </div>
      <div className="footer__smoke" aria-hidden="true" />
      <div className="footer__word" aria-hidden="true">PADDOCK</div>
      <div className="footer__fine"><span>Independent</span><span>Not affiliated with Formula 1 or the FIA</span><span>Estimates, never guarantees</span></div>
    </footer>
  );
}
