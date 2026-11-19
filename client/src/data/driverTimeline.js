// Builds a timeline of milestones for any driver: karting and junior years, F1 debut,
// first win, world titles and other highlights.

const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'];

// lower number comes first when two milestones are in the same year
const CATEGORY_ORDER = {
  KARTING: 1,
  'JUNIOR ASCENT': 2,
  'F1 DEBUT': 3,
  'TEAM MOVE': 4,
  'FIRST WIN': 5,
  'LANDMARK WIN': 6,
  MILESTONE: 7,
  'WORLD TITLE': 8,
};

// categories that are marked as important on the timeline
const IMPORTANT = ['F1 DEBUT', 'FIRST WIN', 'WORLD TITLE', 'LANDMARK WIN'];

function orderOf(category) {
  return CATEGORY_ORDER[category] || 5;
}

export function buildDriverMilestones(driver) {
  if (!driver) return [];

  const milestones = [];
  const hasDebut = Boolean(driver.debut && driver.debut.season);
  const hasFirstWin = Boolean(driver.firstWin && driver.firstWin.season);
  const titles = driver.stats && Array.isArray(driver.stats.titles) ? driver.stats.titles : [];

  // 1. karting and junior series
  if (Array.isArray(driver.pathway)) {
    for (let i = 0; i < driver.pathway.length; i++) {
      const year = driver.pathway[i][0];
      const description = driver.pathway[i][1];
      const isKarting = /kart|cadet|bambino/i.test(description);
      milestones.push({
        year: Number(year),
        category: isKarting ? 'KARTING' : 'JUNIOR ASCENT',
        title: isKarting ? 'Karting Foundations' : 'Junior Series',
        text: description,
      });
    }
  }

  // 2. F1 debut
  if (hasDebut) {
    milestones.push({
      year: Number(driver.debut.season),
      category: 'F1 DEBUT',
      title: 'Formula 1 Debut',
      text: `Debuts in Formula 1 at the ${driver.debut.race || 'Grand Prix'} driving for ${driver.debut.team || 'the team'}.`,
    });
  }

  // 3. first win
  if (hasFirstWin) {
    milestones.push({
      year: Number(driver.firstWin.season),
      category: 'FIRST WIN',
      title: 'Maiden Victory',
      text: `Takes maiden Grand Prix victory at the ${driver.firstWin.race || 'Grand Prix'} with ${driver.firstWin.team || 'the team'}.`,
    });
  }

  // 4. world championships
  for (let i = 0; i < titles.length; i++) {
    const ordinal = ORDINALS[i] || `${i + 1}th`;
    milestones.push({
      year: Number(titles[i]),
      category: 'WORLD TITLE',
      title: `${ordinal} World Championship`,
      text: "Crowns FIA Formula 1 World Drivers' Champion.",
    });
  }

  // 5. highlights (skipped if they repeat the debut, first win or title)
  if (Array.isArray(driver.highlights)) {
    for (let i = 0; i < driver.highlights.length; i++) {
      const h = driver.highlights[i];
      const year = Number(h.year);

      const repeatsDebut = hasDebut && year === Number(driver.debut.season) && /debut/i.test(h.text);
      const repeatsFirstWin = hasFirstWin && year === Number(driver.firstWin.season) && /first win|maiden win/i.test(h.text);
      const repeatsTitle = titles.includes(year) && /title|world champion/i.test(h.text);

      if (repeatsDebut || repeatsFirstWin || repeatsTitle) {
        // if the highlight has more detail, use its text for the existing milestone
        for (let j = 0; j < milestones.length; j++) {
          const m = milestones[j];
          const isSpecial = m.category === 'F1 DEBUT' || m.category === 'FIRST WIN' || m.category === 'WORLD TITLE';
          if (m.year === year && isSpecial) {
            if (h.text.length > m.text.length) m.text = h.text;
            break;
          }
        }
        continue;
      }

      let category = 'MILESTONE';
      let title = 'Career Landmark';
      if (/monaco|silverstone|spa|monza|brazil|suzuka/i.test(h.text) && /win/i.test(h.text)) {
        category = 'LANDMARK WIN';
        title = 'Landmark Victory';
      } else if (/ferrari|mercedes|mclaren|red bull|williams|aston martin/i.test(h.text) && /joins|moves|signed/i.test(h.text)) {
        category = 'TEAM MOVE';
        title = 'Team Transition';
      }
      milestones.push({ year: year, category: category, title: title, text: h.text });
    }
  }

  // remove milestones with the same year and text
  const unique = [];
  const seen = [];
  for (let i = 0; i < milestones.length; i++) {
    const key = `${milestones[i].year}:${milestones[i].text.toLowerCase().trim()}`;
    if (!seen.includes(key)) {
      seen.push(key);
      unique.push(milestones[i]);
    }
  }

  unique.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return orderOf(a.category) - orderOf(b.category);
  });

  // group by year
  const byYear = new Map();
  for (let i = 0; i < unique.length; i++) {
    const year = unique[i].year;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(unique[i]);
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);

  // one card per year: the most important milestone leads, and one more sentence from that year is added
  const result = [];
  for (let i = 0; i < years.length; i++) {
    const items = byYear.get(years[i]);

    let lead = items[0];
    for (let j = 1; j < items.length; j++) {
      if (orderOf(items[j].category) > orderOf(lead.category)) lead = items[j];
    }

    let detail = '';
    let important = false;
    for (let j = 0; j < items.length; j++) {
      if (items[j] !== lead && detail === '') detail = items[j].text;
      if (IMPORTANT.includes(items[j].category)) important = true;
    }

    result.push({
      year: years[i],
      category: lead.category,
      title: lead.title,
      text: lead.text,
      detail: detail,
      important: important,
    });
  }
  return result;
}
