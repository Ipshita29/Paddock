import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Plus, Reveal, Credit } from '../components/Footer.jsx';
import { f1Stories, STORY_CATEGORIES } from '../data/f1Stories.js';

// THE STORIES (route /history, and /history/:slug for one story).
// Titles, years, categories and articles come from src/data/f1Stories.js.
// Photos are real Wikimedia Commons images listed in the tables below.
// photographs with their licence details
const PHOTOS = {
  fangio57: { file: "hero-fangio-1957.jpg", wide: true, focus: "50% 62%", alt: "Juan Manuel Fangio in the Maserati 250F at the Nurburgring, 1957", caption: "Juan Manuel Fangio in the Maserati 250F at the Nurburgring, 1957.", credit: { author: "Willy Pragher", license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0", source: "https://commons.wikimedia.org/wiki/File:Fangio_Maserati_250F_Nurburgring_1957.jpg" } },
  fangio: { file: "portrait-fangio.jpg", wide: false, focus: "50% 28%", alt: "Juan Manuel Fangio", caption: "Juan Manuel Fangio.", credit: { author: "Unknown authorUnknown author", license: "Public domain", licenseUrl: "https://commons.wikimedia.org/wiki/File:Juan_Manuel_Fangio_(circa_1952).jpg", source: "https://commons.wikimedia.org/wiki/File:Juan_Manuel_Fangio_(circa_1952).jpg" } },
  mossLotus: { file: "moss.jpg", wide: true, focus: "50% 55%", alt: "Stirling Moss in the Lotus 18, Monaco, 1961", caption: "Stirling Moss in the Lotus 18, Monaco, 1961.", credit: { author: "John Chapman (Pyrope)", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Lotus_18_Stirling_Moss_Monaco_1961.jpg" } },
  moss: { file: "portrait-moss.jpg", wide: false, focus: "50% 28%", alt: "Stirling Moss", caption: "Stirling Moss.", credit: { author: "AngMoKio", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Stirling_Moss_2014_2_amk.jpg" } },
  stewartTyrrell: { file: "stewart.jpg", wide: true, focus: "50% 45%", alt: "Jackie Stewart in the Tyrrell, Brands Hatch, 1971", caption: "Jackie Stewart in the Tyrrell, Brands Hatch, 1971.", credit: { author: "Martin Lee", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0", source: "https://commons.wikimedia.org/wiki/File:Jackie_Stewart_Tyrrell_003_Brands_Hatch_1971.jpg" } },
  stewart: { file: "portrait-stewart.jpg", wide: false, focus: "55% 35%", alt: "Jackie Stewart", caption: "Jackie Stewart.", credit: { author: "Lothar Spurzem", license: "CC BY-SA 2.0 de", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/de/deed.en", source: "https://commons.wikimedia.org/wiki/File:Stewart,_Jackie_(Foto_Spurzem_1973).jpg" } },
  brabham: { file: "portrait-jack_brabham.jpg", wide: false, focus: "50% 24%", alt: "Jack Brabham, 1966", caption: "Jack Brabham, 1966.", credit: { author: "Lothar Spurzem", license: "CC BY-SA 2.0 de", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/de/deed.en", source: "https://commons.wikimedia.org/wiki/File:BrabhamJack1966B.jpg" } },
  clarkLotus: { file: "clark.jpg", wide: true, focus: "50% 50%", alt: "Jim Clark in his Lotus, 1962", caption: "Jim Clark in his Lotus, 1962.", credit: { author: "Lothar Spurzem", license: "CC BY-SA 2.0 de", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/de/deed.en", source: "https://commons.wikimedia.org/wiki/File:ClarkJim-Lotus19620805.jpg" } },
  clark: { file: "portrait-clark.jpg", wide: false, focus: "50% 28%", alt: "Jim Clark", caption: "Jim Clark.", credit: { author: "Unknown photographer; NL-HaNA, ANEFO / neg. stroken, 1945-1989, 2.24.01.05, item number 91", license: "CC0", licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Jim_Clark_1965.jpg" } },
  laudaFerrari: { file: "lauda.jpg", wide: true, focus: "58% 58%", alt: "Niki Lauda in the Ferrari 312T2, 31 July 1976", caption: "Niki Lauda in the Ferrari 312T2, 31 July 1976.", credit: { author: "Lothar Spurzem", license: "CC BY-SA 2.0 de", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/de/deed.en", source: "https://commons.wikimedia.org/wiki/File:LaudaNiki19760731Ferrari312T2.jpg" } },
  lauda: { file: "portrait-lauda.jpg", wide: false, focus: "50% 28%", alt: "Niki Lauda", caption: "Niki Lauda.", credit: { author: "Hans van Dijk for Anefo   / neg. stroken, 1945-1989, 2.24.01.05, item number 932-2315", license: "CC0", licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Lauda_at_1982_Dutch_Grand_Prix.jpg" } },
  huntMcLaren: { file: "hunt.jpg", wide: true, focus: "50% 55%", alt: "James Hunt in the McLaren, 1976 British Grand Prix", caption: "James Hunt in the McLaren, 1976 British Grand Prix.", credit: { author: "50DAG2026", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:McLaren_James_Hunt_UKgp76.jpg" } },
  hunt: { file: "portrait-hunt.jpg", wide: false, focus: "50% 28%", alt: "James Hunt", caption: "James Hunt.", credit: { author: "Uploader's father, digitized and altered by Mr.choppers", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:J._Hunt_in_1977_(cropped).jpg" } },
  sennaMcLaren: { file: "senna.jpg", wide: true, focus: "50% 40%", alt: "Ayrton Senna in the McLaren MP4/6, United States Grand Prix, 1991", caption: "Ayrton Senna in the McLaren MP4/6, United States Grand Prix, 1991.", credit: { author: "wileynorwichphoto", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Ayrton_Senna_McLaren_MP4-6_1991_United_States.jpg" } },
  senna: { file: "portrait-senna.jpg", wide: false, focus: "33% 30%", alt: "Ayrton Senna", caption: "Ayrton Senna.", credit: { author: "Instituto Ayrton Senna", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Ayrton_Senna_9.jpg" } },
  mansellWilliams: { file: "mansell.jpg", wide: true, focus: "50% 55%", alt: "Nigel Mansell in the Williams, 1985", caption: "Nigel Mansell in the Williams, 1985.", credit: { author: "Lothar Spurzem", license: "CC BY-SA 2.0 de", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/de/deed.en", source: "https://commons.wikimedia.org/wiki/File:Mansell_-_Williams_1985.jpg" } },
  mansell: { file: "portrait-mansell.jpg", wide: false, focus: "62% 28%", alt: "Nigel Mansell", caption: "Nigel Mansell.", credit: { author: "Stuart Seeger", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:NigelMansell.jpg" } },
  prost: { file: "portrait-prost.jpg", wide: false, focus: "50% 28%", alt: "Alain Prost", caption: "Alain Prost.", credit: { author: "Thesupermat", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Festival_automobile_international_2015_-_Photocall_-_065_(cropped).jpg" } },
  hakkinenMcLaren: { file: "hakkinen.jpg", wide: true, focus: "50% 50%", alt: "Mika Hakkinen in the McLaren MP4-10B, 1995 British Grand Prix", caption: "Mika Hakkinen in the McLaren MP4-10B, 1995 British Grand Prix.", credit: { author: "Martin Lee from London, UK", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0", source: "https://commons.wikimedia.org/wiki/File:Mika_Hakkinen_-_Mclaren_MP4-10B_at_the_1995_British_Grand_Prix,_Silverstone_(49704716103).jpg" } },
  hakkinen: { file: "portrait-hakkinen.jpg", wide: false, focus: "50% 28%", alt: "Mika Hakkinen", caption: "Mika Hakkinen.", credit: { author: "Sven Mandel", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Mika_H%C3%A4kkinen_Champions_for_Charity_2016-07-27.jpg" } },
  schumacherFerrari: { file: "schumacher.jpg", wide: true, focus: "50% 50%", alt: "Michael Schumacher in the Ferrari, 2004", caption: "Michael Schumacher in the Ferrari, 2004.", credit: { author: "Rick Dikeman", license: "CC BY-SA 3.0", licenseUrl: "http://creativecommons.org/licenses/by-sa/3.0/", source: "https://commons.wikimedia.org/wiki/File:Michael_Schumacher_Ferrari_2004.jpg" } },
  vettel: { file: "portrait-vettel.jpg", wide: false, focus: "50% 28%", alt: "Sebastian Vettel", caption: "Sebastian Vettel.", credit: { author: "Morio", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Sebastian_Vettel_2011_Sebastian_Vettel_in_Yokohama.jpg" } },
  vettelRedBull: { file: "vettel.jpg", wide: true, focus: "50% 50%", alt: "Sebastian Vettel in the Red Bull, Singapore Grand Prix, 2013", caption: "Sebastian Vettel in the Red Bull, Singapore Grand Prix, 2013.", credit: { author: "Benjamin Goetzinger", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Formula_One_Grand_Prix_Singapore_2013_-_Sebastian_Vettel_in_Red_Bull_Renault_1.jpg" } },
  interlagos: { file: "circuit-interlagos.jpg", wide: true, focus: "34% 50%", alt: "The Autodromo Jose Carlos Pace at Interlagos, home of the Brazilian Grand Prix", caption: "The Autodromo Jose Carlos Pace at Interlagos, home of the Brazilian Grand Prix.", credit: { author: "ProtoplasmaKid", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Vista_a%C3%A9rea_del_Aut%C3%B3dromo_Jos%C3%A9_Carlos_Pace_02.jpg" } },
  hamilton: { file: "portrait-hamilton.jpg", wide: false, focus: "50% 28%", alt: "Lewis Hamilton", caption: "Lewis Hamilton.", credit: { author: "Picture by Lauren Hurley / No 10 Downing Street", license: "OGL 3", licenseUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3", source: "https://commons.wikimedia.org/wiki/File:Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_(54566928382)_(cropped).jpg" } },
  button: { file: "portrait-button.jpg", wide: false, focus: "57% 38%", alt: "Jenson Button", caption: "Jenson Button.", credit: { author: "Engyles", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:2018_British_Grand_Prix_-_Jenson_Button_(08).jpg" } },
  alonsoFerrari: { file: "alonso.jpg", wide: true, focus: "50% 50%", alt: "Fernando Alonso in the Ferrari", caption: "Fernando Alonso in the Ferrari.", credit: { author: "Jitesh Jagadish from Dubai, United Arab Emirates", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Ferrari_F1_-_Fernando_Alonso_(5178411980).jpg" } },
  alonso: { file: "portrait-alonso.jpg", wide: false, focus: "50% 30%", alt: "Fernando Alonso", caption: "Fernando Alonso.", credit: { author: "Off The Track Media", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Fernando_Alonso_racing_at_the_2024_F1_in_Schools_World_Finals_(cropped).jpg" } },
  rosbergMercedes: { file: "rosberg.jpg", wide: true, focus: "50% 50%", alt: "Nico Rosberg in the Mercedes", caption: "Nico Rosberg in the Mercedes.", credit: { author: "Takayuki Suzuki from Kanagawa, Japan", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0", source: "https://commons.wikimedia.org/wiki/File:Mercedes,_No.6_Nico_Rosberg_(1)_(15592608282).jpg" } },
  rosberg: { file: "portrait-rosberg.jpg", wide: false, focus: "50% 28%", alt: "Nico Rosberg", caption: "Nico Rosberg.", credit: { author: "Sven Mandel", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Nico_Rosberg_2016.jpg" } },
  verstappen: { file: "portrait-max_verstappen.jpg", wide: false, focus: "50% 28%", alt: "Max Verstappen", caption: "Max Verstappen.", credit: { author: "Steffen Pr\u00f6\u00dfdorf", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:2024-08-25_Motorsport,_Formel_1,_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_(portrait_cropped).jpg" } },
  verstappenRedBull: { file: "verstappen.jpg", wide: true, focus: "50% 50%", alt: "Max Verstappen in the Red Bull, 2025 Japanese Grand Prix", caption: "Max Verstappen in the Red Bull, 2025 Japanese Grand Prix.", credit: { author: "Liauzh", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:2025_Japan_GP_-_Red_Bull_-_Max_Verstappen_-_Race.jpg" } },
  norrisMcLaren: { file: "norris.jpg", wide: true, focus: "50% 50%", alt: "Lando Norris in the McLaren, 2025 Japanese Grand Prix", caption: "Lando Norris in the McLaren, 2025 Japanese Grand Prix.", credit: { author: "Liauzh", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:2025_Japan_GP_-_McLaren_-_Lando_Norris_-_FP1.jpg" } },
  norris: { file: "portrait-norris.jpg", wide: false, focus: "50% 28%", alt: "Lando Norris", caption: "Lando Norris.", credit: { author: "Steffen Pr\u00f6\u00dfdorf, crop by Cerebral726", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:2024-08-25_Motorsport,_Formel_1,_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_4016_by_Stepro_(cropped).jpg" } },
  antonelli: { file: "portrait-antonelli.jpg", wide: false, focus: "50% 28%", alt: "Kimi Antonelli", caption: "Kimi Antonelli.", credit: { author: "Yu Chu Chin", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Kimi_Antonelli_at_the_Melbourne_Walk_during_the_2026_Australian_Grand_Prix_(028A7923)_cropped.jpg" } },
  antonelliMercedes: { file: "antonelli.jpg", wide: true, focus: "50% 50%", alt: "Kimi Antonelli in the Mercedes, 2025 Japanese Grand Prix", caption: "Kimi Antonelli in the Mercedes, 2025 Japanese Grand Prix.", credit: { author: "Liauzh", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:2025_Japan_GP_-_Mercedes_-_Kimi_Antonelli_-_FP2.jpg" } },
};

// story slug -> [cover photo, optional second photo for the article]
const STORY_PHOTOS = {
  "fangio-nurburgring-1957": ["fangio57", "fangio"],
  "moss-hawthorn-1958-sportsmanship": ["mossLotus", "moss"],
  "jackie-stewart-spa-1966-safety": ["stewartTyrrell", "stewart"],
  "jack-brabham-1966-own-car": ["brabham"],
  "jim-clark-monza-1967": ["clarkLotus", "clark"],
  "niki-lauda-1976-return": ["laudaFerrari", "lauda"],
  "james-hunt-fuji-1976": ["huntMcLaren", "hunt"],
  "senna-monaco-1984-toleman": ["senna", "sennaMcLaren"],
  "adelaide-1986-mansell-tyre": ["mansellWilliams", "mansell"],
  "senna-prost-suzuka-1989-1990": ["sennaMcLaren", "prost"],
  "imola-1994-legacy-of-safety": ["senna", "sennaMcLaren"],
  "hakkinen-adelaide-1995-comeback": ["hakkinenMcLaren", "hakkinen"],
  "schumacher-hakkinen-2000": ["schumacherFerrari", "hakkinen"],
  "vettel-monza-2008-toro-rosso": ["vettel", "vettelRedBull"],
  "brazil-2008-massa-hamilton": ["interlagos", "hamilton"],
  "brawn-gp-2009-fairytale": ["button"],
  "alonso-2012-championship-fight": ["alonsoFerrari", "alonso"],
  "rosberg-hamilton-2016": ["rosbergMercedes", "rosberg"],
  "verstappen-barcelona-2016-first-win": ["verstappen", "verstappenRedBull"],
  "abu-dhabi-2021-title-decider": ["verstappenRedBull", "hamilton"],
  "mclaren-norris-piastri-resurgence": ["norrisMcLaren", "norris"],
  "kimi-antonelli-2026-youngest-champion": ["antonelli", "antonelliMercedes"],
};


const BY_SLUG = new Map();
for (let i = 0; i < f1Stories.length; i++) {
  BY_SLUG.set(f1Stories[i].slug, f1Stories[i]);
}

// the photos listed for a story
function photosOf(story) {
  const keys = STORY_PHOTOS[story.slug] || [];
  const photos = [];
  for (let i = 0; i < keys.length; i++) {
    if (PHOTOS[keys[i]]) photos.push(PHOTOS[keys[i]]);
  }
  return photos;
}

// a real photograph of the same decade, used when a story has no photo of its own
function decadePhoto(year) {
  const decade = Math.min(2020, Math.max(1950, Math.floor(year / 10) * 10));
  return {
    file: `d${decade}.jpg`,
    wide: true,
    focus: '50% 50%',
    alt: `Formula 1 in the ${decade}s`,
    caption: `Formula 1 in the ${decade}s.`,
    credit: { author: 'Wikimedia Commons', license: 'see source' },
  };
}

function coverOf(story) {
  const photos = photosOf(story);
  if (photos.length > 0) return photos[0];
  return decadePhoto(story.year);
}

// the story's own photos first, then the decade photo
function photoChain(story) {
  return [...photosOf(story), decadePhoto(story.year)];
}

// a story photo that moves on to the next photo if it fails to load, so a card is never empty
function StoryImg({ story, className, style }) {
  const chain = useMemo(() => photoChain(story), [story]);
  const [index, setIndex] = useState(0);
  const photo = chain[Math.min(index, chain.length - 1)];

  function onError() {
    if (index < chain.length - 1) setIndex(index + 1);
  }

  return (
    <img
      src={`/images/${photo.file}`}
      alt=""
      loading="lazy"
      decoding="async"
      className={className}
      style={{ ...style, objectPosition: photo.focus || '50% 50%' }}
      onError={onError}
    />
  );
}

// the paragraphs of a story
function paragraphs(story) {
  const parts = story.story.split(/\n\n/);
  const result = [];
  for (let i = 0; i < parts.length; i++) {
    const text = parts[i].trim();
    if (text !== '') result.push(text);
  }
  return result;
}

// the story of the day: the same one all day, chosen from stories with a wide cover photo
function featuredFor(date = new Date()) {
  const pool = [];
  for (let i = 0; i < f1Stories.length; i++) {
    const photo = coverOf(f1Stories[i]);
    if (photo && photo.wide) pool.push(f1Stories[i]);
  }
  return pool[Math.floor(date.getTime() / 86400000) % pool.length];
}

// stories that share people, category or time period with this one
function relatedTo(story, limit = 3) {
  const scored = [];
  for (let i = 0; i < f1Stories.length; i++) {
    const other = f1Stories[i];
    if (other.slug === story.slug) continue;

    let score = 0;
    for (let j = 0; j < other.peopleInvolved.length; j++) {
      if (story.peopleInvolved.includes(other.peopleInvolved[j])) score += 3;
    }
    if (other.category === story.category) score += 2;
    if (Math.abs(other.year - story.year) <= 6) score += 1;
    scored.push({ story: other, score: score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Math.abs(a.story.year - story.year) - Math.abs(b.story.year - story.year);
  });

  const result = [];
  for (let i = 0; i < limit && i < scored.length; i++) result.push(scored[i].story);
  return result;
}

// the picture for a story: its photo, or its year and category if there is no photo
function Cover({ story, photo, className = '' }) {
  const [failed, setFailed] = useState(false);

  if (photo && !failed) {
    return (
      <div className={`cov ${className}`}>
        <img
          src={`/images/${photo.file}`}
          alt={photo.alt}
          loading="lazy"
          decoding="async"
          style={{ objectPosition: photo.focus }}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={`cov cov--type ${className}`} role="img" aria-label={`${story.year}, ${story.category}`}>
      <span className="cov__year num">{story.year}</span>
      <span className="cov__tag">{story.category}</span>
    </div>
  );
}

const meta = (s) => <span className="meta"><i />{s.year}<em>{s.category}</em></span>;

// ---------------------------------------------------------------- stories page (Timed Card Opening)

// widths of a card when resting, hovered and active, based on the screen width
function posterWidths() {
  const screenWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
  let rest = Math.round(Math.min(290, Math.max(250, screenWidth * 0.195)));
  if (screenWidth <= 768) {
    rest = 210;
  } else if (screenWidth <= 1024) {
    rest = 240;
  }
  return { rest: rest, hover: Math.round(rest * 1.07), active: Math.round(rest * 1.2) };
}

// load an image early so the background changes without delay
function preload(photo) {
  if (photo && photo.file) {
    const img = new Image();
    img.src = `/images/${photo.file}`;
  }
}

function StoriesBrowser() {
  const [params, setParams] = useSearchParams();

  let activeCategory = 'all';
  if (STORY_CATEGORIES.includes(params.get('c'))) activeCategory = params.get('c');

  // stories in the chosen category
  const filteredStories = useMemo(() => {
    if (activeCategory === 'all') return f1Stories;
    const list = [];
    for (let i = 0; i < f1Stories.length; i++) {
      if (f1Stories[i].category === activeCategory) list.push(f1Stories[i]);
    }
    return list;
  }, [activeCategory]);

  const featured = useMemo(() => featuredFor(), []);

  // the story that starts as active: the featured story if it is in this category, otherwise the first story
  const [activeSlug, setActiveSlug] = useState(() => {
    if (activeCategory === 'all') return featured.slug;
    for (let i = 0; i < filteredStories.length; i++) {
      if (filteredStories[i].slug === featured.slug) return featured.slug;
    }
    if (filteredStories.length > 0) return filteredStories[0].slug;
    return f1Stories[0].slug;
  });

  const activeStory = BY_SLUG.get(activeSlug) || filteredStories[0] || f1Stories[0];
  const activePhoto = coverOf(activeStory);

  const [hoveredSlug, setHoveredSlug] = useState(null);
  const [timingSlug, setTimingSlug] = useState(null);
  const [widths, setWidths] = useState(posterWidths());
  const timerRef = useRef(null);
  const deckRef = useRef(null);
  const cardRefs = useRef({});
  const reduceMotion = useReducedMotion();

  // keep the card widths right when the window is resized
  useEffect(() => {
    function onResize() {
      setWidths(posterWidths());
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // if the active story is not in the chosen category, use the first one
  useEffect(() => {
    let found = false;
    for (let i = 0; i < filteredStories.length; i++) {
      if (filteredStories[i].slug === activeSlug) found = true;
    }
    if (!found && filteredStories.length > 0) setActiveSlug(filteredStories[0].slug);
  }, [filteredStories, activeSlug]);

  // load the active photo, and the first five covers, early
  useEffect(() => {
    preload(activePhoto);
  }, [activePhoto]);

  useEffect(() => {
    for (let i = 0; i < 5; i++) preload(coverOf(f1Stories[i]));
  }, []);

  // scroll the active card into view
  useEffect(() => {
    const el = cardRefs.current[activeSlug];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeSlug]);

  // left and right arrow keys move through the stories
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();

      let index = -1;
      for (let i = 0; i < filteredStories.length; i++) {
        if (filteredStories[i].slug === activeSlug) index = i;
      }
      if (e.key === 'ArrowRight' && index !== -1 && index < filteredStories.length - 1) {
        setActiveSlug(filteredStories[index + 1].slug);
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        setActiveSlug(filteredStories[index - 1].slug);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filteredStories, activeSlug]);

  // stop the hover timer when leaving the page
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  // Timed Card Opening: a card becomes active after the mouse stays on it for 420ms
  function handleCardMouseEnter(story) {
    if (story.slug === activeSlug) return;

    preload(coverOf(story));
    stopTimer();
    setHoveredSlug(story.slug);
    setTimingSlug(story.slug);

    timerRef.current = setTimeout(() => {
      setActiveSlug(story.slug);
      setTimingSlug(null);
      setHoveredSlug(null);
      timerRef.current = null;
    }, 420);
  }

  function handleCardMouseLeave(story) {
    stopTimer();
    if (timingSlug === story.slug) setTimingSlug(null);
    if (hoveredSlug === story.slug) setHoveredSlug(null);
  }

  // A click activates the card at once and opens the story.
  // On touch screens the first tap only activates the card, and a second tap opens it.
  function handleCardClick(e, story) {
    stopTimer();
    setTimingSlug(null);
    setHoveredSlug(null);

    const noHover = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none)').matches;
    if (noHover && story.slug !== activeSlug) e.preventDefault();
    setActiveSlug(story.slug);
  }

  function chooseCategory(category) {
    const next = new URLSearchParams(params);
    if (category === 'all') {
      next.delete('c');
    } else {
      next.set('c', category);
    }
    setParams(next, { replace: true });
  }

  // left and right buttons above the cards
  function scrollDeck(direction) {
    if (deckRef.current) {
      const distance = deckRef.current.clientWidth * 0.65;
      deckRef.current.scrollBy({ left: direction * distance, behavior: 'smooth' });
    }
  }

  let activeIndex = -1;
  for (let i = 0; i < filteredStories.length; i++) {
    if (filteredStories[i].slug === activeSlug) activeIndex = i;
  }

  return (
    <div className="stories-browser dark">
      {/* 1. Full-screen cinematic background */}
      <div className="stories-browser__bg" aria-hidden="true">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={activeStory.slug}
            className="stories-bg__layer"
            initial={{ opacity: 0, scale: 1.07 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          >
            {activePhoto ? (
              <img
                src={`/images/${activePhoto.file}`}
                alt={activePhoto.alt}
                className="stories-bg__img"
                style={{ objectPosition: activePhoto.focus || '50% 50%' }}
              />
            ) : (
              <div className="stories-bg__fallback">
                <span className="stories-bg__year num">{activeStory.year}</span>
                <span className="stories-bg__tag">{activeStory.category}</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="stories-bg__overlay-vignette" />
        <div className="stories-bg__overlay-headline" />
        <div className="stories-bg__overlay-left" />
        <div className="stories-bg__overlay-bottom" />
        <div className="stories-bg__overlay-top" />
      </div>

      {/* 2. Top bar: Archive Meta & Category Filters */}
      <header className="stories-bar px">
        <div className="stories-bar__left">
          <Plus size={13}>The Archive</Plus>
          <span className="stories-bar__sep">/</span>
          <span className="stories-bar__count num">{filteredStories.length} Stories</span>
          <span className="stories-bar__era">1950–2026</span>
        </div>
        <nav className="stories-bar__filters" aria-label="Filter stories by category">
          {['all', ...STORY_CATEGORIES].map((c) => (
            <button
              key={c}
              className={`st-pill ${activeCategory === c ? 'is-active' : ''}`}
              aria-pressed={activeCategory === c}
              onClick={() => chooseCategory(c)}
            >
              {c === 'all' ? 'All Stories' : c}
            </button>
          ))}
        </nav>
      </header>

      {/* Layer 2: Dramatically larger background title (72–100px editorial magazine headline) */}
      <div className="stories-hero-title-container px" aria-hidden="true">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStory.slug}
            className="stories-hero-title-wrap"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="stories-hero-title">{activeStory.title}</h1>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 3. Layer 3: Foreground story information & larger rectangular cards */}
      <div className="stories-content px">
        {/* Vertical story posters: the primary focus (Timed Card Opening) */}
        <section className="stories-deck-wrap" aria-label="Browse stories">
          <div className="stories-deck-head">
            <span className="deck-label">
              <span className="deck-label__dot" /> Timed Card Opening <span className="deck-label__hint">· Hover to expand</span>
            </span>
            <div className="deck-nav">
              <span className="deck-counter num">
                {String(activeIndex + 1).padStart(2, '0')} / {String(filteredStories.length).padStart(2, '0')}
              </span>
              <div className="deck-arrows">
                <button
                  type="button"
                  className="deck-arrow"
                  onClick={() => scrollDeck(-1)}
                  aria-label="Previous story cards"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="deck-arrow"
                  onClick={() => scrollDeck(1)}
                  aria-label="Next story cards"
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="stories-deck" ref={deckRef} role="list" aria-label="Formula 1 stories">
            {filteredStories.map((story) => {
              const isActive = story.slug === activeSlug;
              const isHovered = story.slug === hoveredSlug;
              const isTiming = story.slug === timingSlug;
              const isDim = !!hoveredSlug && !isHovered && !isActive;
              const width = isActive ? widths.active : isHovered ? widths.hover : widths.rest;

              return (
                <motion.div
                  key={story.slug}
                  role="listitem"
                  className="timed-slot"
                  initial={false}
                  animate={{ width, opacity: isDim ? 0.5 : 1 }}
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }}
                >
                  <Link
                    to={`/history/${story.slug}`}
                    ref={(el) => (cardRefs.current[story.slug] = el)}
                    className={`timed-card ${isActive ? 'is-active' : ''} ${isHovered ? 'is-hovered' : ''} ${isTiming ? 'is-timing' : ''}`}
                    aria-current={isActive ? 'true' : undefined}
                    onMouseEnter={() => handleCardMouseEnter(story)}
                    onMouseLeave={() => handleCardMouseLeave(story)}
                    onFocus={() => { if (!isActive) setActiveSlug(story.slug); }}
                    onClick={(e) => handleCardClick(e, story)}
                    aria-label={`${story.title}, ${story.category}, ${story.year}. Opens the story.`}
                  >
                    {/* Timed opening progress bar */}
                    <span className={`timed-card__progress ${isTiming ? 'is-animating' : ''}`} aria-hidden="true" />

                    {/* Full-bleed photograph */}
                    <span className="timed-card__img-wrap" aria-hidden="true">
                      <StoryImg story={story} className="timed-card__img" />
                    </span>
                    <span className="timed-card__shade" aria-hidden="true" />

                    {/* Top: category label and year */}
                    <span className="timed-card__top">
                      <span className="timed-card__cat">{story.category}</span>
                      <span className="timed-card__year num">{story.year}</span>
                    </span>

                    {/* Bottom: title */}
                    <span className="timed-card__bottom">
                      <span className="timed-card__title">{story.title}</span>
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
          {activePhoto && (
            <p className="stories-credit">
              Photo: {activePhoto.credit.author}, {activePhoto.credit.license}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

// One layout per slot, so the archive never repeats the same card thirty times in article related views.
const SLOTS = ['lg', 'md', 'sm', 'sm', 'sm', 'wide'];

function Card({ story, slot, index }) {
  const photo = coverOf(story);
  const flip = slot === 'wide' && Math.floor(index / SLOTS.length) % 2 === 1;
  return (
    <Reveal className={`sc sc--${slot} ${flip ? 'sc--flip' : ''}`} delay={(index % 3) * 0.05}>
      <Link to={`/history/${story.slug}`} className="sc__link" aria-label={`${story.title}, ${story.year}`}>
        <Cover story={story} photo={photo} className="sc__img" />
        <div className="sc__body">
          <p className="sc__no num">{story.storyNumber}</p>
          {meta(story)}
          <h3 className="sc__title">{story.title}</h3>
          <p className="sc__intro">{story.subtitle}</p>
          <span className="sc__go">Read story <ArrowUpRight size={14} aria-hidden="true" /></span>
        </div>
      </Link>
    </Reveal>
  );
}

/* --------------------------------------------------------------- article */
function Article({ story }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const bar = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });
  const photos = photosOf(story);
  const cover = photos[0] || null;
  const second = photos[1] || null;
  const paras = paragraphs(story);
  const figureAt = paras.length >= 7 ? 3 : -1;
  const related = useMemo(() => relatedTo(story), [story]);
  const wide = cover && cover.wide;

  useEffect(() => { document.title = `${story.title} | PADDOCK`; return () => { document.title = 'Stories | PADDOCK'; }; }, [story]);

  return (
    <article className="stories sa" ref={ref}>
      {!reduce && <motion.div className="sa__progress" style={{ scaleX: bar }} aria-hidden="true" />}

      <header className={`sa-hero dark ${wide ? 'sa-hero--wide' : cover ? 'sa-hero--split' : 'sa-hero--type'}`}>
        {wide && <><Cover story={story} photo={cover} className="sa-hero__bg" /><div className="sa-hero__shade" /></>}
        {!wide && !cover && <span className="sa-hero__year num" aria-hidden="true">{story.year}</span>}
        <div className="sa-hero__in px">
          <Link to="/history" className="back"><ArrowLeft size={14} /> Back to Stories</Link>
          <div className="sa-hero__copy">
            <p className="feat__kicker"><i />{story.category}<span>{story.year}</span><span className="num">No. {story.storyNumber}</span></p>
            <motion.h1 className="sa-hero__title" initial={reduce ? false : { y: 36, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>{story.title}</motion.h1>
            <p className="sa-hero__sub">{story.subtitle}</p>
          </div>
          {cover && !wide && <figure className="sa-hero__portrait"><div><Cover story={story} photo={cover} /></div></figure>}
        </div>
        {cover && <span className="sa-hero__credit">{cover.caption} Photo: {cover.credit.author}, {cover.credit.license}</span>}
      </header>

      <section className="sa-read light px">
        <aside className="sa-side" aria-label="About this story">
          <dl>
            <div><dt>Grand Prix</dt><dd>{story.grandPrix}</dd></div>
            <div><dt>Era</dt><dd className="num">{story.era} · {story.category}</dd></div>
            <div><dt>People involved</dt><dd><ul>{story.peopleInvolved.map((n) => <li key={n}>{n}</li>)}</ul></dd></div>
          </dl>
        </aside>
        <div className="sa-body">
          {paras.map((p, i) => (
            <React.Fragment key={i}>
              <Reveal as="p" className={i === 0 ? 'sa-lede' : ''}>{p}</Reveal>
              {i === figureAt && second && (
                <Reveal as="figure" className="sa-fig">
                  <div><img src={`/images/${second.file}`} alt={second.alt} loading="lazy" decoding="async" style={{ objectPosition: second.focus }} /></div>
                  <Credit image={second} className="sa-fig__credit" />
                </Reveal>
              )}
            </React.Fragment>
          ))}
          <Reveal className="sa-why"><p className="sa-why__label"><i />Why it still matters</p><p>{story.whyItMatters}</p></Reveal>
          <details className="sa-src">
            <summary>Sources</summary>
            <ul>{story.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer noopener">{s.name}<ArrowUpRight size={12} aria-hidden="true" /></a></li>)}</ul>
          </details>
          <Link to="/history" className="back back--dark"><ArrowLeft size={14} /> Back to Stories</Link>
        </div>
      </section>

      <section className="st-next dark px" aria-label="Related stories">
        <div className="st-next__head"><Plus>Read next</Plus></div>
        <div className="st-next__grid">
          {related.map((s, i) => <Card key={s.slug} story={s} slot="sm" index={i} />)}
        </div>
      </section>
    </article>
  );
}

export default function History() {
  const { slug } = useParams();
  if (!slug) return <StoriesBrowser />;
  const story = BY_SLUG.get(slug);
  if (!story) return <Navigate to="/history" replace />;
  return <Article story={story} />;
}
