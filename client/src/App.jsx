import React, { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import History from './pages/History.jsx';
import People from './pages/People.jsx';
import Prediction from './pages/Prediction.jsx';
// Home.css also holds the global design system (colours, type, navbar, footer, shared pieces).
import './css/Home.css';
import './css/History.css';
import './css/People.css';
import './css/Prediction.css';

const TITLES = { '/': 'PADDOCK | The Past. The People. The Next Chapter.', '/history': 'History | PADDOCK', '/people': 'People | PADDOCK', '/prediction': 'Prediction | PADDOCK' };

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => { document.title = TITLES['/' + pathname.split('/')[1]] || TITLES['/']; }, [pathname]);
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:decade" element={<History />} />
          <Route path="/people" element={<People />} />
          <Route path="/people/:driverId" element={<People />} />
          <Route path="/prediction" element={<Prediction />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
