// Checked driver profile links. Only real, official accounts are listed.
// A link is never guessed from a driver's name, and a missing platform is simply left out.

// Removed after a link check on 19 Nov 2026 (404, expired or mismatched certificate, CMS error page or connection failure).
// Restore an entry here once the destination works again:
//   leclerc.youtube: https://www.youtube.com/@charlesleclerc
//   ocon.twitter: https://x.com/estebanocon
//   bottas.website: https://valtteribottas.com/
//   bearman.website: https://www.olliebearman.com/
//   lawson.website: https://www.liamlawson.co.nz/
//   rosberg.twitter: https://x.com/nico_rosberg
//   rosberg.website: https://nicorosberg.com/
//   button.website: https://www.jensonbutton.com/
//   senna.website: https://www.ayrtonsenna.com.br/
//   prost.twitter: https://x.com/prostoficiel
//   stewart.twitter: https://x.com/sirjackiestewart
//   hunt.website: https://www.jameshuntracing.com/

export const DRIVER_SOCIALS = {
  leclerc: {
    instagram: { handle: '@charles_leclerc', url: 'https://www.instagram.com/charles_leclerc/' },
    twitter: { handle: '@Charles_Leclerc', url: 'https://x.com/charles_leclerc' },
    tiktok: { handle: '@charlesleclerc', url: 'https://www.tiktok.com/@charlesleclerc' },
    website: { handle: 'charlesleclerc.com', url: 'https://www.charlesleclerc.com/' },
    wikipedia: { handle: 'Charles Leclerc', url: 'https://en.wikipedia.org/wiki/Charles_Leclerc' },
  },
  hamilton: {
    instagram: { handle: '@lewishamilton', url: 'https://www.instagram.com/lewishamilton/' },
    twitter: { handle: '@LewisHamilton', url: 'https://x.com/lewishamilton' },
    youtube: { handle: '@lewishamilton', url: 'https://www.youtube.com/@lewishamilton' },
    tiktok: { handle: '@lewishamilton', url: 'https://www.tiktok.com/@lewishamilton' },
    website: { handle: 'lewishamilton.com', url: 'https://www.lewishamilton.com/' },
    wikipedia: { handle: 'Lewis Hamilton', url: 'https://en.wikipedia.org/wiki/Lewis_Hamilton' },
  },
  max_verstappen: {
    instagram: { handle: '@maxverstappen1', url: 'https://www.instagram.com/maxverstappen1/' },
    twitter: { handle: '@Max33Verstappen', url: 'https://x.com/max33verstappen' },
    website: { handle: 'verstappen.com', url: 'https://www.verstappen.com/' },
    wikipedia: { handle: 'Max Verstappen', url: 'https://en.wikipedia.org/wiki/Max_Verstappen' },
  },
  norris: {
    instagram: { handle: '@landonorris', url: 'https://www.instagram.com/landonorris/' },
    twitter: { handle: '@LandoNorris', url: 'https://x.com/landonorris' },
    youtube: { handle: '@landonorris', url: 'https://www.youtube.com/@landonorris' },
    tiktok: { handle: '@landonorris', url: 'https://www.tiktok.com/@landonorris' },
    website: { handle: 'landonorris.com', url: 'https://landonorris.com/' },
    wikipedia: { handle: 'Lando Norris', url: 'https://en.wikipedia.org/wiki/Lando_Norris' },
  },
  piastri: {
    instagram: { handle: '@oscarpiastri', url: 'https://www.instagram.com/oscarpiastri/' },
    twitter: { handle: '@OscarPiastri', url: 'https://x.com/oscarpiastri' },
    tiktok: { handle: '@oscarpiastri', url: 'https://www.tiktok.com/@oscarpiastri' },
    website: { handle: 'oscarpiastri.com', url: 'https://oscarpiastri.com/' },
    wikipedia: { handle: 'Oscar Piastri', url: 'https://en.wikipedia.org/wiki/Oscar_Piastri' },
  },
  russell: {
    instagram: { handle: '@georgerussell63', url: 'https://www.instagram.com/georgerussell63/' },
    twitter: { handle: '@GeorgeRussell63', url: 'https://x.com/georgerussell63' },
    youtube: { handle: '@georgerussell63', url: 'https://www.youtube.com/@georgerussell63' },
    tiktok: { handle: '@georgerussell63', url: 'https://www.tiktok.com/@georgerussell63' },
    website: { handle: 'georgerussell63.com', url: 'https://www.georgerussell63.com/' },
    wikipedia: { handle: 'George Russell', url: 'https://en.wikipedia.org/wiki/George_Russell_(racing_driver)' },
  },
  sainz: {
    instagram: { handle: '@carlossainz55', url: 'https://www.instagram.com/carlossainz55/' },
    twitter: { handle: '@Carlossainz55', url: 'https://x.com/carlossainz55' },
    youtube: { handle: '@carlossainz55', url: 'https://www.youtube.com/@carlossainz55' },
    tiktok: { handle: '@carlossainz55', url: 'https://www.tiktok.com/@carlossainz55' },
    website: { handle: 'carlossainz.es', url: 'https://www.carlossainz.es/' },
    wikipedia: { handle: 'Carlos Sainz Jr.', url: 'https://en.wikipedia.org/wiki/Carlos_Sainz_Jr.' },
  },
  alonso: {
    instagram: { handle: '@fernandoalo_oficial', url: 'https://www.instagram.com/fernandoalo_oficial/' },
    twitter: { handle: '@alo_oficial', url: 'https://x.com/alo_oficial' },
    tiktok: { handle: '@fernandoalonso', url: 'https://www.tiktok.com/@fernandoalonso' },
    website: { handle: 'fernandoalonso.com', url: 'https://fernandoalonso.com/' },
    wikipedia: { handle: 'Fernando Alonso', url: 'https://en.wikipedia.org/wiki/Fernando_Alonso' },
  },
  gasly: {
    instagram: { handle: '@pierregasly', url: 'https://www.instagram.com/pierregasly/' },
    twitter: { handle: '@PierreGASLY', url: 'https://x.com/pierregasly' },
    tiktok: { handle: '@pierregasly', url: 'https://www.tiktok.com/@pierregasly' },
    website: { handle: 'pierregasly.com', url: 'https://www.pierregasly.com/' },
    wikipedia: { handle: 'Pierre Gasly', url: 'https://en.wikipedia.org/wiki/Pierre_Gasly' },
  },
  ocon: {
    instagram: { handle: '@estebanocon', url: 'https://www.instagram.com/estebanocon/' },
    tiktok: { handle: '@estebanocon', url: 'https://www.tiktok.com/@estebanocon' },
    website: { handle: 'esteban-ocon.com', url: 'https://www.esteban-ocon.com/' },
    wikipedia: { handle: 'Esteban Ocon', url: 'https://en.wikipedia.org/wiki/Esteban_Ocon' },
  },
  albon: {
    instagram: { handle: '@alex_albon', url: 'https://www.instagram.com/alex_albon/' },
    twitter: { handle: '@alex_albon', url: 'https://x.com/alex_albon' },
    tiktok: { handle: '@alex_albon', url: 'https://www.tiktok.com/@alex_albon' },
    website: { handle: 'alexalbon.com', url: 'https://www.alexalbon.com/' },
    wikipedia: { handle: 'Alex Albon', url: 'https://en.wikipedia.org/wiki/Alex_Albon' },
  },
  tsunoda: {
    instagram: { handle: '@yukitsunoda0511', url: 'https://www.instagram.com/yukitsunoda0511/' },
    twitter: { handle: '@yukitsunoda07', url: 'https://x.com/yukitsunoda07' },
    website: { handle: 'yukitsunoda.com', url: 'https://www.yukitsunoda.com/' },
    wikipedia: { handle: 'Yuki Tsunoda', url: 'https://en.wikipedia.org/wiki/Yuki_Tsunoda' },
  },
  bottas: {
    instagram: { handle: '@valtteribottas', url: 'https://www.instagram.com/valtteribottas/' },
    twitter: { handle: '@ValtteriBottas', url: 'https://x.com/valtteribottas' },
    wikipedia: { handle: 'Valtteri Bottas', url: 'https://en.wikipedia.org/wiki/Valtteri_Bottas' },
  },
  hulkenberg: {
    instagram: { handle: '@hulkhulkenberg', url: 'https://www.instagram.com/hulkhulkenberg/' },
    twitter: { handle: '@HulkHulkenberg', url: 'https://x.com/hulkhulkenberg' },
    website: { handle: 'nicohulkenberg.net', url: 'https://www.nicohulkenberg.net/' },
    wikipedia: { handle: 'Nico Hülkenberg', url: 'https://en.wikipedia.org/wiki/Nico_H%C3%BClkenberg' },
  },
  stroll: {
    instagram: { handle: '@lance_stroll', url: 'https://www.instagram.com/lance_stroll/' },
    twitter: { handle: '@lance_stroll', url: 'https://x.com/lance_stroll' },
    website: { handle: 'lancestroll.com', url: 'https://www.lancestroll.com/' },
    wikipedia: { handle: 'Lance Stroll', url: 'https://en.wikipedia.org/wiki/Lance_Stroll' },
  },
  antonelli: {
    instagram: { handle: '@kimi.antonelli', url: 'https://www.instagram.com/kimi.antonelli/' },
    wikipedia: { handle: 'Andrea Kimi Antonelli', url: 'https://en.wikipedia.org/wiki/Andrea_Kimi_Antonelli' },
  },
  bearman: {
    instagram: { handle: '@olliebearman', url: 'https://www.instagram.com/olliebearman/' },
    twitter: { handle: '@OllieBearman', url: 'https://x.com/olliebearman' },
    wikipedia: { handle: 'Oliver Bearman', url: 'https://en.wikipedia.org/wiki/Oliver_Bearman' },
  },
  colapinto: {
    instagram: { handle: '@francolapinto', url: 'https://www.instagram.com/francolapinto/' },
    twitter: { handle: '@FranColapinto', url: 'https://x.com/fran_colapinto' },
    website: { handle: 'francolapinto.com', url: 'https://francolapinto.com/' },
    wikipedia: { handle: 'Franco Colapinto', url: 'https://en.wikipedia.org/wiki/Franco_Colapinto' },
  },
  bortoleto: {
    instagram: { handle: '@gabrielbortoleto_', url: 'https://www.instagram.com/gabrielbortoleto_/' },
    twitter: { handle: '@gabi_bortoleto', url: 'https://x.com/gabi_bortoleto' },
    wikipedia: { handle: 'Gabriel Bortoleto', url: 'https://en.wikipedia.org/wiki/Gabriel_Bortoleto' },
  },
  lawson: {
    instagram: { handle: '@liamlawson30', url: 'https://www.instagram.com/liamlawson30/' },
    twitter: { handle: '@LiamLawson30', url: 'https://x.com/liamlawson30' },
    wikipedia: { handle: 'Liam Lawson', url: 'https://en.wikipedia.org/wiki/Liam_Lawson' },
  },
  perez: {
    instagram: { handle: '@schecoperez', url: 'https://www.instagram.com/schecoperez/' },
    twitter: { handle: '@SChecoPerez', url: 'https://x.com/schecoperez' },
    website: { handle: 'checoperez.com', url: 'https://checoperez.com/' },
    wikipedia: { handle: 'Sergio Pérez', url: 'https://en.wikipedia.org/wiki/Sergio_P%C3%A9rez' },
  },
  vettel: {
    instagram: { handle: '@sebastianvettel', url: 'https://www.instagram.com/sebastianvettel/' },
    website: { handle: 'sebastianvettel.de', url: 'https://www.sebastianvettel.de/' },
    wikipedia: { handle: 'Sebastian Vettel', url: 'https://en.wikipedia.org/wiki/Sebastian_Vettel' },
  },
  raikkonen: {
    instagram: { handle: '@kimimatiasraikkonen', url: 'https://www.instagram.com/kimimatiasraikkonen/' },
    wikipedia: { handle: 'Kimi Räikkönen', url: 'https://en.wikipedia.org/wiki/Kimi_R%C3%A4ikk%C3%B6nen' },
  },
  rosberg: {
    instagram: { handle: '@nicorosberg', url: 'https://www.instagram.com/nicorosberg/' },
    youtube: { handle: '@nicorosberg', url: 'https://www.youtube.com/@nicorosberg' },
    wikipedia: { handle: 'Nico Rosberg', url: 'https://en.wikipedia.org/wiki/Nico_Rosberg' },
  },
  button: {
    instagram: { handle: '@jensonbutton', url: 'https://www.instagram.com/jensonbutton/' },
    twitter: { handle: '@JensonButton', url: 'https://x.com/jensonbutton' },
    wikipedia: { handle: 'Jenson Button', url: 'https://en.wikipedia.org/wiki/Jenson_Button' },
  },
  michael_schumacher: {
    instagram: { handle: '@michaelschumacher', url: 'https://www.instagram.com/michaelschumacher/' },
    twitter: { handle: '@schumacher', url: 'https://x.com/schumacher' },
    website: { handle: 'michael-schumacher.de', url: 'https://www.michael-schumacher.de/' },
    wikipedia: { handle: 'Michael Schumacher', url: 'https://en.wikipedia.org/wiki/Michael_Schumacher' },
  },
  senna: {
    instagram: { handle: '@ayrtonsennavr', url: 'https://www.instagram.com/ayrtonsennavr/' },
    twitter: { handle: '@ayrtonsenna', url: 'https://x.com/ayrtonsenna' },
    wikipedia: { handle: 'Ayrton Senna', url: 'https://en.wikipedia.org/wiki/Ayrton_Senna' },
  },
  lauda: {
    wikipedia: { handle: 'Niki Lauda', url: 'https://en.wikipedia.org/wiki/Niki_Lauda' },
  },
  prost: {
    instagram: { handle: '@alainprostofficiel', url: 'https://www.instagram.com/alainprostofficiel/' },
    wikipedia: { handle: 'Alain Prost', url: 'https://en.wikipedia.org/wiki/Alain_Prost' },
  },
  fangio: {
    website: { handle: 'museofangio.com', url: 'https://www.museofangio.com/' },
    wikipedia: { handle: 'Juan Manuel Fangio', url: 'https://en.wikipedia.org/wiki/Juan_Manuel_Fangio' },
  },
  clark: {
    website: { handle: 'jimclarktrust.com', url: 'https://jimclarktrust.com/' },
    wikipedia: { handle: 'Jim Clark', url: 'https://en.wikipedia.org/wiki/Jim_Clark' },
  },
  stewart: {
    website: { handle: 'raceagainstdementia.com', url: 'https://www.raceagainstdementia.com/' },
    wikipedia: { handle: 'Jackie Stewart', url: 'https://en.wikipedia.org/wiki/Jackie_Stewart' },
  },
  moss: {
    website: { handle: 'stirlingmoss.com', url: 'https://www.stirlingmoss.com/' },
    wikipedia: { handle: 'Stirling Moss', url: 'https://en.wikipedia.org/wiki/Stirling_Moss' },
  },
  hakkinen: {
    instagram: { handle: '@aklmika', url: 'https://www.instagram.com/aklmika/' },
    twitter: { handle: '@F1MikaHakkinen', url: 'https://x.com/f1mikahakkinen' },
    wikipedia: { handle: 'Mika Häkkinen', url: 'https://en.wikipedia.org/wiki/Mika_H%C3%A4kkinen' },
  },
  mansell: {
    twitter: { handle: '@nigelmansell', url: 'https://x.com/nigelmansell' },
    wikipedia: { handle: 'Nigel Mansell', url: 'https://en.wikipedia.org/wiki/Nigel_Mansell' },
  },
  piquet: {
    wikipedia: { handle: 'Nelson Piquet', url: 'https://en.wikipedia.org/wiki/Nelson_Piquet' },
  },
  hunt: {
    wikipedia: { handle: 'James Hunt', url: 'https://en.wikipedia.org/wiki/James_Hunt' },
  },
  emerson_fittipaldi: {
    instagram: { handle: '@emersonfittipaldioficial', url: 'https://www.instagram.com/emersonfittipaldioficial/' },
    twitter: { handle: '@emmofittipaldi', url: 'https://x.com/emmofittipaldi' },
    wikipedia: { handle: 'Emerson Fittipaldi', url: 'https://en.wikipedia.org/wiki/Emerson_Fittipaldi' },
  },
  ascari: {
    wikipedia: { handle: 'Alberto Ascari', url: 'https://en.wikipedia.org/wiki/Alberto_Ascari' },
  },
  jack_brabham: {
    website: { handle: 'brabham.co.uk', url: 'https://www.brabham.co.uk/' },
    wikipedia: { handle: 'Jack Brabham', url: 'https://en.wikipedia.org/wiki/Jack_Brabham' },
  },
  hill: {
    wikipedia: { handle: 'Graham Hill', url: 'https://en.wikipedia.org/wiki/Graham_Hill' },
  },
  damon_hill: {
    instagram: { handle: '@96damonhill', url: 'https://www.instagram.com/96damonhill/' },
    twitter: { handle: '@HillF1', url: 'https://x.com/hillf1' },
    wikipedia: { handle: 'Damon Hill', url: 'https://en.wikipedia.org/wiki/Damon_Hill' },
  },
};

// Returns the checked profile links for a driver (only links that exist in DRIVER_SOCIALS).
// A link guessed from a driver's name is never added, because it could be wrong.
export function getDriverSocials(driver) {
  if (!driver) return [];
  const id = driver.driverId || driver.id;
  const entry = DRIVER_SOCIALS[id] || {};

  const platforms = [
    { key: 'instagram', label: 'Instagram', kind: 'social' },
    { key: 'youtube', label: 'YouTube', kind: 'social' },
    { key: 'twitter', label: 'X / Twitter', kind: 'social' },
    { key: 'tiktok', label: 'TikTok', kind: 'social' },
    { key: 'website', label: 'Official Website', kind: 'website' },
    { key: 'wikipedia', label: 'Reference Archive', kind: 'wiki' },
  ];

  const results = [];
  for (let i = 0; i < platforms.length; i++) {
    const platform = platforms[i];
    if (entry[platform.key]) {
      results.push({
        platform: platform.key,
        label: platform.label,
        kind: platform.kind,
        handle: entry[platform.key].handle,
        url: entry[platform.key].url,
      });
    }
  }
  return results;
}
