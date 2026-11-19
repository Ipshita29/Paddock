/**
 * Builds a unified chronological milestone timeline for any Formula 1 driver.
 * Merges karting pathway, junior series, F1 debut, maiden victory,
 * team transitions, world championships, and landmark highlights.
 */

export function buildDriverMilestones(driver) {
  if (!driver) return [];

  const milestones = [];

  const hasDebut = Boolean(driver.debut && driver.debut.season);
  const hasFirstWin = Boolean(driver.firstWin && driver.firstWin.season);

  // 1. Junior & Karting Pathway
  if (Array.isArray(driver.pathway)) {
    driver.pathway.forEach(([yr, desc]) => {
      const isKarting = /kart|cadet|bambino/i.test(desc);
      milestones.push({
        year: Number(yr),
        category: isKarting ? 'KARTING' : 'JUNIOR ASCENT',
        title: isKarting ? 'Karting Foundations' : 'Junior Series',
        text: desc,
      });
    });
  }

  // 2. F1 Debut
  if (hasDebut) {
    milestones.push({
      year: Number(driver.debut.season),
      category: 'F1 DEBUT',
      title: 'Formula 1 Debut',
      text: `Debuts in Formula 1 at the ${driver.debut.race || 'Grand Prix'} driving for ${driver.debut.team || 'the team'}.`,
    });
  }

  // 3. First Grand Prix Victory
  if (hasFirstWin) {
    milestones.push({
      year: Number(driver.firstWin.season),
      category: 'FIRST WIN',
      title: 'Maiden Victory',
      text: `Takes maiden Grand Prix victory at the ${driver.firstWin.race || 'Grand Prix'} with ${driver.firstWin.team || 'the team'}.`,
    });
  }

  // 4. World Championships
  if (driver.stats && Array.isArray(driver.stats.titles)) {
    driver.stats.titles.forEach((yr, idx) => {
      const ordinal = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'][idx] || `${idx + 1}th`;
      milestones.push({
        year: Number(yr),
        category: 'WORLD TITLE',
        title: `${ordinal} World Championship`,
        text: `Crowns FIA Formula 1 World Drivers' Champion.`,
      });
    });
  }

  // 5. Curated / Generated Highlights (filter out near-duplicates of debut / first win)
  if (Array.isArray(driver.highlights)) {
    driver.highlights.forEach((h) => {
      const hYear = Number(h.year);
      const isDebutDuplicate = hasDebut && hYear === Number(driver.debut.season) && /debut/i.test(h.text);
      const isFirstWinDuplicate = hasFirstWin && hYear === Number(driver.firstWin.season) && /first win|maiden win/i.test(h.text);
      const isTitleDuplicate = driver.stats?.titles?.includes(hYear) && /title|world champion/i.test(h.text);

      if (isDebutDuplicate || isFirstWinDuplicate || isTitleDuplicate) {
        // If the highlight provides richer detail (e.g. "and wins at Spa and Monza" or "finishes second"), update the existing entry text
        const existing = milestones.find((m) => m.year === hYear && (m.category === 'F1 DEBUT' || m.category === 'FIRST WIN' || m.category === 'WORLD TITLE'));
        if (existing && h.text.length > existing.text.length) {
          existing.text = h.text;
        }
        return;
      }

      let cat = 'MILESTONE';
      let title = 'Career Landmark';
      if (/monaco|silverstone|spa|monza|brazil|suzuka/i.test(h.text) && /win/i.test(h.text)) {
        cat = 'LANDMARK WIN';
        title = 'Landmark Victory';
      } else if (/ferrari|mercedes|mclaren|red bull|williams|aston martin/i.test(h.text) && /joins|moves|signed/i.test(h.text)) {
        cat = 'TEAM MOVE';
        title = 'Team Transition';
      }

      milestones.push({
        year: hYear,
        category: cat,
        title,
        text: h.text,
      });
    });
  }

  // Deduplicate by year + text
  const unique = [];
  const seen = new Set();
  for (const m of milestones) {
    const key = `${m.year}:${m.text.toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
    }
  }

  const catPriority = {
    KARTING: 1,
    'JUNIOR ASCENT': 2,
    'F1 DEBUT': 3,
    'TEAM MOVE': 4,
    'FIRST WIN': 5,
    'LANDMARK WIN': 6,
    MILESTONE: 7,
    'WORLD TITLE': 8,
  };

  unique.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return (catPriority[a.category] || 5) - (catPriority[b.category] || 5);
  });

  // One card per year: the most significant item leads, and a second sentence from the same year is appended.
  const IMPORTANT = new Set(['F1 DEBUT', 'FIRST WIN', 'WORLD TITLE', 'LANDMARK WIN']);
  const byYear = new Map();
  unique.forEach((m) => { if (!byYear.has(m.year)) byYear.set(m.year, []); byYear.get(m.year).push(m); });
  return [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, items]) => {
    const lead = [...items].sort((a, b) => (catPriority[b.category] || 5) - (catPriority[a.category] || 5))[0];
    const extra = items.filter((m) => m !== lead).map((m) => m.text).slice(0, 1);
    return { year, category: lead.category, title: lead.title, text: lead.text, detail: extra.join(' '), important: items.some((m) => IMPORTANT.has(m.category)) };
  });
}
