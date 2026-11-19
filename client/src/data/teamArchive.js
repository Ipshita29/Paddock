/**
 * Team presentation data for the Career Journey on driver profiles.
 *  - colour: a team's accent colour (presentation only).
 *  - photos: a licensed car photograph for the team, chosen by the year a driver's stint ended.
 *    A team with no entry here (or no photograph for that era) gets a designed panel instead, never a stand-in picture.
 *  - logo: a team logo file in /images. Deliberately empty: no licensed, consistent logo set is available yet,
 *    so panels show a typographic team mark. Add `logo: 'team-xyz.svg'` to an entry to show a logo.
 * Credits come from the Wikimedia Commons records for each file.
 */
const PHOTOS = {
  alfa158: { file: "d1950.jpg", caption: "Alfa Romeo 158, 1950", focus: "50% 55%", credit: { author: "azrhey", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0", source: "https://commons.wikimedia.org/wiki/File:Alfa_Romeo_158_Alfetta_1950_Museo_Storico_OCT_2015.jpg" } },
  lotus49: { file: "d1960.jpg", caption: "Lotus 49, 1967", focus: "50% 55%", credit: { author: "Deep silence (Mika\u00ebl Restoux)", license: "CC BY-SA 3.0", licenseUrl: "http://creativecommons.org/licenses/by-sa/3.0/", source: "https://commons.wikimedia.org/wiki/File:Lotus_49-1.JPG" } },
  lotus72: { file: "d1970.jpg", caption: "Lotus 72, 1970s", focus: "50% 55%", credit: { author: "Neil", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0", source: "https://commons.wikimedia.org/wiki/File:Lotus_72_-_Emerson_Fittipaldi_(54667097918).jpg" } },
  mclarenMP44: { file: "d1980.jpg", caption: "McLaren MP4/4, 1988", focus: "50% 55%", credit: { author: "Hullian111", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:McLaren_MP4-4_at_Formula_1_Exhibition,_London_01.jpg" } },
  williamsFW14B: { file: "d1990.jpg", caption: "Williams FW14B, 1992", focus: "50% 55%", credit: { author: "Martin Pettitt", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Car_Show_Nigel_Mansell_with_His_1992_Williams-Renault_FW14B_Formula_1_Car.jpg" } },
  ferrariVodafone: { file: "d2000.jpg", caption: "Ferrari, early 2000s", focus: "50% 55%", credit: { author: "Hydro", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Ferrari_Vodafone_Schumacher_(2).jpg" } },
  mercedesW05: { file: "d2010.jpg", caption: "Mercedes F1 W05, 2014", focus: "50% 55%", credit: { author: "J.H. Sohn", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Mercedes_F1_W05_Melbourne.jpg" } },
  redbullRB19: { file: "d2020.jpg", caption: "Red Bull RB19, 2023", focus: "50% 55%", credit: { author: "Calreyn88", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:2023_Red_Bull_RB19.jpg" } },
  ferrari312T2: { file: "lauda.jpg", caption: "Ferrari 312T2, 1976", focus: "58% 58%", credit: { author: "Lothar Spurzem", license: "CC BY-SA 2.0 de", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/de/deed.en", source: "https://commons.wikimedia.org/wiki/File:LaudaNiki19760731Ferrari312T2.jpg" } },
  mclaren1995: { file: "hakkinen.jpg", caption: "McLaren MP4-10B, 1995", focus: "50% 50%", credit: { author: "Martin Lee from London, UK", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0", source: "https://commons.wikimedia.org/wiki/File:Mika_Hakkinen_-_Mclaren_MP4-10B_at_the_1995_British_Grand_Prix,_Silverstone_(49704716103).jpg" } },
  ferrariAlonso: { file: "alonso.jpg", caption: "Ferrari, 2010s", focus: "50% 50%", credit: { author: "Jitesh Jagadish from Dubai, United Arab Emirates", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Ferrari_F1_-_Fernando_Alonso_(5178411980).jpg" } },
  mclaren2025: { file: "norris.jpg", caption: "McLaren, 2025", focus: "50% 50%", credit: { author: "Liauzh", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:2025_Japan_GP_-_McLaren_-_Lando_Norris_-_FP1.jpg" } },
  maserati250F: { file: "fangio.jpg", caption: "Maserati 250F, 1957", focus: "50% 55%", credit: { author: "Willy Pragher", license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0", source: "https://commons.wikimedia.org/wiki/File:Fangio_Maserati_250F_exits_pits_Nurburgring_1957.jpg" } },
  tyrrell: { file: "stewart.jpg", caption: "Tyrrell, 1971", focus: "50% 45%", credit: { author: "Martin Lee", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0", source: "https://commons.wikimedia.org/wiki/File:Jackie_Stewart_Tyrrell_003_Brands_Hatch_1971.jpg" } },
  brabham1980: { file: "piquet.jpg", caption: "Brabham, 1980", focus: "50% 55%", credit: { author: "Carlomarzetti", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0", source: "https://commons.wikimedia.org/wiki/File:Nelson_Piquet_Brabham_1980_Monaco.jpg" } },
  alpine2025: { file: "gasly.jpg", caption: "Alpine, 2025", focus: "50% 50%", credit: { author: "Liauzh", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:2025_Japan_GP_-_Alpine_-_Pierre_Gasly_-_FP2.jpg" } },
  haas2025: { file: "bearman.jpg", caption: "Haas, 2025", focus: "50% 50%", credit: { author: "Liauzh", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:2025_Japan_GP_-_Haas_-_Oliver_Bearman_-_FP2.jpg" } },
  sauber2025: { file: "hulkenberg.jpg", caption: "Sauber, 2025", focus: "50% 50%", credit: { author: "Liauzh", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:2025_Japan_GP_-_Sauber_-_Nico_Hulkenberg_-_FP1.jpg" } },
  racingBulls2025: { file: "hadjar.jpg", caption: "Racing Bulls, 2025", focus: "50% 50%", credit: { author: "Liauzh", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:2025_Japan_GP_-_Racing_Bulls_-_Isack_Hadjar_-_FP2.jpg" } },
  williams2025: { file: "albon.jpg", caption: "Williams, 2025", focus: "50% 50%", credit: { author: "Liauzh", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:2025_Japan_GP_-_Williams_-_Alex_Albon_-_FP2.jpg" } },
  toroRosso: { file: "team-toro-rosso.jpg", caption: "Toro Rosso STR10, 2015", focus: "50% 55%", credit: { author: "Michael Elleray from England, United Kingdom", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Toro_Rosso_STR10_16354810498_cfbbcf532a_o.jpg" } },
  redbull2016: { file: "team-red-bull-2016.jpg", caption: "Red Bull RB12, 2016", focus: "50% 55%", credit: { author: "Calreyn88", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:2016_Red_Bull_RB12.jpg" } },
  cooperT51: { file: "team-cooper.jpg", caption: "Cooper T51, 1959", focus: "50% 55%", credit: { author: "Kogo", license: "CC BY-SA 3.0 de", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en", source: "https://commons.wikimedia.org/wiki/File:Cooper_T51.jpg" } },
  benetton94: { file: "team-benetton.jpg", caption: "Benetton B194, 1994", focus: "50% 55%", credit: { author: "Martin Lee from London, UK", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0", source: "https://commons.wikimedia.org/wiki/File:Benetton_B194_approaches_Woodcote_at_the_1994_British_Grand_Prix_(32418703451).jpg" } },
  brawn2009: { file: "team-brawn.jpg", caption: "Brawn BGP 001, 2009", focus: "50% 55%", credit: { author: "Bahnfrend", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:2009_Brawn_BGP_001_Goodwood,_2009_(01).jpg" } },
  astonMartin2023: { file: "team-aston-martin.jpg", caption: "Aston Martin AMR23, 2023", focus: "50% 55%", credit: { author: "Calreyn88", license: "CC0", licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:2023_Aston_Martin_AMR23.jpg" } },
  renaultR25: { file: "team-renault.jpg", caption: "Renault R25, 2005", focus: "50% 55%", credit: { author: "Willtron", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Renault_R25_(2005)_Fernando_Alonso.jpg" } },
};

// id, name pattern, colour, photos as [first season, last season, photo key]. A photograph is used only for stints that overlap
// the seasons its car belongs to; any other stint gets the designed panel instead of a car from the wrong era.
const TEAMS = [
  ['toro_rosso', /toro rosso/i, '#4A6FD6', [[2006, 2019, 'toroRosso']]],
  ['red_bull', /^red bull/i, '#3671C6', [[2005, 2018, 'redbull2016'], [2019, 9999, 'redbullRB19']]],
  ['ferrari', /ferrari/i, '#E8002D', [[1974, 1982, 'ferrari312T2'], [1996, 2007, 'ferrariVodafone'], [2008, 9999, 'ferrariAlonso']]],
  ['mercedes', /^mercedes/i, '#27F4D2', [[2010, 9999, 'mercedesW05']]],
  ['mclaren', /mclaren/i, '#FF8000', [[1984, 1991, 'mclarenMP44'], [1992, 2005, 'mclaren1995'], [2019, 9999, 'mclaren2025']]],
  ['williams', /^williams/i, '#64C4FF', [[1988, 1998, 'williamsFW14B'], [2020, 9999, 'williams2025']]],
  ['alpine', /^alpine/i, '#FF87BC', [[2021, 9999, 'alpine2025']]],
  ['renault', /^renault/i, '#FFD800', [[2003, 2009, 'renaultR25']]],
  ['aston_martin', /aston martin/i, '#229971', [[2021, 9999, 'astonMartin2023']]],
  ['haas', /haas/i, '#B6BABD', [[2016, 9999, 'haas2025']]],
  ['racing_bulls', /^(rb f1|rb$|racing bulls|alphatauri|visa)/i, '#6692FF', [[2020, 9999, 'racingBulls2025']]],
  ['sauber', /sauber|^audi/i, '#52E252', [[2023, 9999, 'sauber2025']]],
  ['cadillac', /cadillac/i, '#A5ADB8', []],
  ['lotus', /lotus/i, '#D9B000', [[1960, 1969, 'lotus49'], [1970, 1976, 'lotus72']]],
  ['tyrrell', /tyrrell/i, '#2D6CDF', [[1970, 1978, 'tyrrell']]],
  ['brabham', /brabham/i, '#4C8BF5', [[1978, 1985, 'brabham1980']]],
  ['cooper', /cooper/i, '#1E7F4F', [[1957, 1965, 'cooperT51']]],
  ['benetton', /benetton/i, '#00A651', [[1991, 1997, 'benetton94']]],
  ['brawn', /brawn/i, '#D7E600', [[2009, 2009, 'brawn2009']]],
  ['maserati', /maserati/i, '#C0392B', [[1950, 1960, 'maserati250F']]],
  ['alfa_romeo', /^alfa romeo/i, '#9B1B30', [[1950, 1951, 'alfa158']]],
];

/** Look up a team by its Jolpica name. Unknown teams still get a neutral, honest profile. */
export function teamProfile(name, firstSeason, lastSeason) {
  const t = TEAMS.find(([, re]) => re.test(name));
  if (!t) return { id: null, color: '#8A8A8A', photo: null, logo: null };
  // the photograph whose era covers the most seasons of this stint (later era wins a tie)
  let hit = null; let best = 0;
  t[3].forEach((e) => { const overlap = Math.min(lastSeason, e[1]) - Math.max(firstSeason, e[0]) + 1; if (overlap > 0 && overlap >= best) { best = overlap; hit = e; } });
  return { id: t[0], color: t[2], photo: hit ? PHOTOS[hit[2]] : null, logo: null };
}

/** A short typographic mark for a team: initials of its first two meaningful words. */
export function teamMark(name) {
  const words = name.replace(/\b(F1|Team|Racing|Scuderia|Grand Prix|Formula One)\b/gi, ' ').split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!words.length) return name.slice(0, 2).toUpperCase();
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}
