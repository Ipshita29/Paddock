import React, { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import History from './pages/History.jsx';
import People from './pages/People.jsx';
import Prediction from './pages/Prediction.jsx';
// Home.css also has the shared design (colours, fonts, navbar, footer)
import './css/Home.css';
import './css/History.css';
import './css/People.css';
import './css/Prediction.css';

const TITLES = {
  '/': 'PADDOCK | The Past. The People. The Next Chapter.',
  '/history': 'Stories | PADDOCK',
  '/people': 'People | PADDOCK',
  '/prediction': 'Prediction | PADDOCK',
};

export default function App() {
  const { pathname } = useLocation();
  const isStoriesIndex = pathname === '/history';

  // go back to the top when the page changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // set the page title (a story article sets its own title)
  useEffect(() => {
    if (pathname.startsWith('/history/')) return;
    const firstPart = '/' + pathname.split('/')[1];
    document.title = TITLES[firstPart] || TITLES['/'];
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Navbar />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:slug" element={<History />} />
          <Route path="/people" element={<People />} />
          <Route path="/people/:driverId" element={<People />} />
          <Route path="/prediction" element={<Prediction />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isStoriesIndex && <Footer />}
    </>
  );
}
