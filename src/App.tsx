import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Search, Compass, Flame, CalendarDays, Bookmark, Shuffle, Plus, Check, X,
  Menu, SlidersHorizontal, Sparkles, ChevronRight, Play, Star, Clock3, Tv,
  Users, Mic2, Clapperboard, Heart, ArrowUpRight, CalendarClock,
  Minus, ExternalLink, RefreshCw, Filter, BookOpen, Globe2
} from 'lucide-react';
import './index.css';

type Anime = {
  id: number;
  type?: string;
  title: { english?: string; romaji: string; native?: string };
  coverImage: { large: string; extraLarge: string };
  bannerImage?: string;
  description?: string;
  averageScore?: number;
  meanScore?: number;
  popularity?: number;
  favourites?: number;
  episodes?: number;
  duration?: number;
  seasonYear?: number;
  season?: string;
  format?: string;
  status?: string;
  genres: string[];
  studios?: { nodes: { name: string }[] };
  startDate?: { year?: number; month?: number; day?: number };
  nextAiringEpisode?: { episode: number; airingAt: number; timeUntilAiring: number };
};
type SavedEntry = { anime: Anime; status: string; progress: number };
type Person = { id: number; name: { full: string }; image?: { large: string } };
type Detail = Anime & {
  characters?: { edges: { role: string; node: Person; voiceActors: Person[] }[] };
  staff?: { edges: { role: string; node: Person }[] };
  relations?: { edges: { relationType: string; node: Anime }[] };
  streamingEpisodes?: { title: string; thumbnail?: string; url: string; site: string }[];
  nextAiringEpisode?: { episode: number; airingAt: number; timeUntilAiring: number };
  tags?: { name: string; rank: number }[];
  externalLinks?: { site: string; url: string; type?: string }[];
  trailer?: { id: string; site: string; thumbnail?: string };
  studios?: { nodes: { name: string }[] };
  source?: string;
  countryOfOrigin?: string;
};
const BASE_FIELDS = 'id title{english romaji native} coverImage{large extraLarge} bannerImage description(asHtml:false) averageScore meanScore popularity favourites episodes duration seasonYear season format status genres studios(isMain:true){nodes{name}} startDate{year month day} nextAiringEpisode{episode airingAt timeUntilAiring}';
const LIST_QUERY = 'query($page:Int,$perPage:Int,$sort:[MediaSort],$search:String,$genre:String,$season:MediaSeason,$seasonYear:Int,$format:MediaFormat){Page(page:$page,perPage:$perPage){media(type:ANIME,isAdult:false,sort:$sort,search:$search,genre:$genre,season:$season,seasonYear:$seasonYear,format:$format){' + BASE_FIELDS + '}}}';
const DETAIL_QUERY = 'query($id:Int){Media(id:$id,type:ANIME){' + BASE_FIELDS + ' source countryOfOrigin tags{ name rank } characters(page:1,perPage:12,sort:ROLE){edges{role node{id name{full} image{large}} voiceActors(language:JAPANESE,sort:RELEVANCE){id name{full} image{large}}}} staff(page:1,perPage:10,sort:RELEVANCE){edges{role node{id name{full} image{large}}}} relations{edges{relationType(version:2) node{id type title{english romaji} coverImage{large} seasonYear startDate{year month day}}}} streamingEpisodes{title thumbnail url site} externalLinks{site url type} trailer{id site thumbnail}}}';
const RECOMMEND_QUERY = 'query($id:Int){Media(id:$id,type:ANIME){recommendations(sort:RATING_DESC,perPage:8){nodes{mediaRecommendation{' + BASE_FIELDS + '}}}}}';
const title = (a: Anime) => a.title.english || a.title.romaji;
const score = (a: Anime) => a.averageScore ? (a.averageScore / 10).toFixed(1) : '—';
const safeText = (s?: string) => (s || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
async function ani<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!response.ok) throw new Error(response.status === 429 ? 'AniList is receiving too many requests. Try again in a moment.' : 'The anime catalogue is temporarily unavailable.');
  const json = await response.json();
  if (json.errors?.length) throw new Error(json.errors[0].message || 'AniList returned an error.');
  return json.data as T;
}
async function getAnime(variables: Record<string, unknown> = {}) {
  const data = await ani<{ Page: { media: Anime[] } }>(LIST_QUERY, { page: 1, perPage: 24, sort: ['POPULARITY_DESC'], ...variables });
  return data.Page.media;
}
const genres = ['Action','Adventure','Comedy','Drama','Fantasy','Horror','Mystery','Romance','Sci-Fi','Slice of Life','Sports','Supernatural','Thriller','Psychological','Music'];
const navItems = [
  { label: 'Discover', icon: Compass },
  { label: 'Trending', icon: Flame },
  { label: 'Seasonal', icon: CalendarDays },
  { label: 'Airing Calendar', icon: CalendarClock },
  { label: 'My Library', icon: Bookmark }
];
const statuses = ['Watching', 'Plan to Watch', 'Completed', 'On Hold', 'Dropped'];
const seasonNow = () => ['WINTER','SPRING','SUMMER','FALL'][Math.floor(new Date().getMonth() / 3)];

export default function App() {
  const [tab, setTab] = useState('Discover');
  const [items, setItems] = useState<Anime[]>([]);
  const [trending, setTrending] = useState<Anime[]>([]);
  const [seasonal, setSeasonal] = useState<Anime[]>([]);
  const [recommendations, setRecommendations] = useState<Anime[]>([]);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [genre, setGenre] = useState('');
  const [format, setFormat] = useState('');
  const [sort, setSort] = useState('POPULARITY_DESC');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Anime | null>(null);
  const [detailData, setDetailData] = useState<Detail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [saved, setSaved] = useState<Record<number, SavedEntry>>(() => {
    try { return JSON.parse(localStorage.getItem('aniverse:library:v2') || '{}'); } catch { return {}; }
  });
  const [menu, setMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState('All');
  const [toast, setToast] = useState('');

  useEffect(() => { localStorage.setItem('aniverse:library:v2', JSON.stringify(saved)); }, [saved]);
  useEffect(() => {
    let live = true;
    setBusy(true); setError('');
    getAnime({ search: term || undefined, genre: genre || undefined, format: format || undefined, seasonYear: year ? Number(year) : undefined, sort: [sort] })
      .then(data => { if (live) setItems(data); })
      .catch(e => { if (live) setError(e.message || 'Could not load anime.'); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [term, genre, format, sort, year]);
  useEffect(() => {
    let live = true;
    getAnime({ sort: ['TRENDING_DESC'], perPage: 10 }).then(data => { if (live) setTrending(data); }).catch(() => {});
    getAnime({ sort: ['POPULARITY_DESC'], perPage: 10, season: seasonNow(), seasonYear: new Date().getFullYear() })
      .then(data => { if (live) setSeasonal(data); }).catch(() => {});
    return () => { live = false; };
  }, []);
  useEffect(() => {
    let live = true;
    const firstSaved = Object.values(saved)[0]?.anime;
    if (!firstSaved) { setRecommendations([]); return () => { live = false; }; }
    ani<{ Media: { recommendations: { nodes: { mediaRecommendation: Anime | null }[] } } }>(RECOMMEND_QUERY, { id: firstSaved.id })
      .then(data => { if (live) setRecommendations(data.Media.recommendations.nodes.map(n => n.mediaRecommendation).filter((x): x is Anime => Boolean(x))); })
      .catch(() => {});
    return () => { live = false; };
  }, [Object.keys(saved).join(',')]);
  useEffect(() => {
    if (!detail) { setDetailData(null); setDetailError(''); return; }
    let live = true;
    setDetailBusy(true); setDetailError(''); setDetailData(null);
    ani<{ Media: Detail }>(DETAIL_QUERY, { id: detail.id })
      .then(data => { if (live) { setDetailData(data.Media); setDetail((old) => old ? { ...old, ...data.Media } : old); } })
      .catch(e => { if (live) setDetailError(e.message || 'Could not load title details.'); })
      .finally(() => { if (live) setDetailBusy(false); });
    return () => { live = false; };
  }, [detail?.id]);

  const library = useMemo(() => Object.values(saved), [saved]);
  const currentList = tab === 'My Library'
    ? library.filter(entry => libraryFilter === 'All' || entry.status === libraryFilter).map(entry => entry.anime)
    : tab === 'Trending' ? trending : tab === 'Seasonal' || tab === 'Airing Calendar' ? seasonal : items;
  const hero = trending[0] || items[0];
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200); };
  const saveTitle = (anime: Anime, status = 'Plan to Watch') => {
    setSaved(old => {
      if (old[anime.id]) { const next = { ...old }; delete next[anime.id]; return next; }
      return { ...old, [anime.id]: { anime, status, progress: 0 } };
    });
    notify(saved[anime.id] ? 'Removed from your library' : 'Added to your library');
  };
  const updateEntry = (id: number, patch: Partial<SavedEntry>) => setSaved(old => ({ ...old, [id]: { ...old[id], ...patch } }));
  const nav = (value: string) => {
    setTab(value); setMenu(false); setGenre(''); setTerm(''); setSearch(''); setFormat(''); setYear('');
    setSort(value === 'Trending' ? 'TRENDING_DESC' : 'POPULARITY_DESC');
  };
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setTerm(search.trim()); setTab('Discover'); };
  const surprise = () => {
    const pool = items.length ? items : trending;
    if (pool.length) openTitle(pool[Math.floor(Math.random() * pool.length)]);
  };
  const openTitle = (anime: Anime) => { setDetail(anime); setMenu(false); };
  const resetFilters = () => { setGenre(''); setFormat(''); setYear(''); setTerm(''); setSearch(''); };
  const setGenreFilter = (value: string) => { setGenre(genre === value ? '' : value); setTab('Discover'); };
  const heroBackground = hero?.bannerImage || hero?.coverImage?.extraLarge || '';
  const sectionHeading = tab === 'My Library' ? 'Your collection' : tab === 'Trending' ? 'Trending anime' : tab === 'Seasonal' ? 'This season' : tab === 'Airing Calendar' ? 'Upcoming episodes' : term ? 'Search results' : genre ? genre + ' anime' : 'Find your next favourite';
  const countLabel = tab === 'My Library' ? library.length + ' SAVED' : currentList.length + ' TITLES';

  return (
    <div className='app-shell'>
      <aside className={menu ? 'sidebar is-open' : 'sidebar'}>
        <button className='brand' onClick={() => nav('Discover')}><span className='brand-mark'>A<span>✳</span></span><span className='brand-name'>ANI<span>VERSE</span><small>THE ANIME UNIVERSE</small></span></button>
        <div className='side-label'>YOUR UNIVERSE</div>
        <nav className='side-nav'>
          {navItems.map(item => <button key={item.label} className={tab === item.label ? 'side-link active' : 'side-link'} onClick={() => nav(item.label)}>
            <item.icon size={17}/><span>{item.label}</span>{item.label === 'My Library' && <b>{library.length}</b>}
          </button>)}
        </nav>
        <div className='side-divider'/>
        <div className='side-label'>EXPLORE GENRES</div>
        <div className='genre-list'>{genres.map(g => <button key={g} className={genre === g ? 'genre-pill selected' : 'genre-pill'} onClick={() => setGenreFilter(g)}>{g}</button>)}</div>
        <div className='sidebar-bottom'><span className='live-dot'/> LIVE ANILIST CATALOGUE</div>
      </aside>

      <main className='main-area'>
        <header className='topbar'>
          <button className='icon-button menu-toggle' onClick={() => setMenu(!menu)} aria-label='Open navigation'><Menu size={19}/></button>
          <div className='breadcrumb'>ANIVERSE <span>/</span> <b>{tab.toUpperCase()}</b></div>
          <form className='global-search' onSubmit={submitSearch}><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder='Search anime titles...'/>{search && <button type='button' onClick={() => { setSearch(''); setTerm(''); }}><X size={15}/></button>}<kbd>ENTER</kbd></form>
          <button className='profile-dot' onClick={() => nav('My Library')} title='Your library'>A</button>
        </header>

        {tab === 'Discover' && !term && !genre && <section className='hero-panel' style={heroBackground ? { backgroundImage: 'linear-gradient(90deg, #0b0c12 0%, #0b0c12ed 35%, #0b0c1270 72%, #0b0c1270 100%), url(' + heroBackground + ')' } : undefined}>
          <div className='hero-glow'/>
          <div className='hero-content'>
            <div className='eyebrow'><span/> YOUR NEXT GREAT STORY STARTS HERE</div>
            <h1>Enter a world<br/>of <em>endless stories.</em></h1>
            <p>Discover new worlds, unforgettable characters and stories that stay with you long after the credits roll.</p>
            <div className='hero-actions'><button className='button-primary' onClick={() => document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' })}><Compass size={16}/> Explore anime</button><button className='button-glass' onClick={surprise}><Shuffle size={15}/> Surprise me</button></div>
            <div className='hero-meta'><span><i/> LIVE ANILIST DATA</span><span>✦ THOUSANDS OF TITLES</span></div>
          </div>
          {hero && <button className='hero-feature' onClick={() => openTitle(hero)}><span>FEATURED RIGHT NOW</span><b>{title(hero)}</b><small><Star size={12} fill='currentColor'/> {score(hero)}　·　{hero.format || 'ANIME'}</small></button>}
          <div className='hero-orb orb-one'/><div className='hero-orb orb-two'/>
        </section>}
        {tab === 'Discover' && !term && !genre && <section className='signal-strip' aria-label='ANIVERSE catalogue statistics'>
          <div><Flame size={19}/><span><b>{trending.length || '—'}</b><small>TRENDING TITLES</small></span></div>
          <div><CalendarDays size={19}/><span><b>{seasonal.length || '—'}</b><small>SEASONAL PICKS</small></span></div>
          <div><Bookmark size={19}/><span><b>{library.length}</b><small>IN YOUR LIBRARY</small></span></div>
        </section>}

        <div className='page-content'>
          {tab === 'Airing Calendar' && <section className='airing-calendar-page'>
            <div className='calendar-intro'><div><span className='overline'>STAY IN THE LOOP</span><h1>Your anime week,<br/><em>at a glance.</em></h1><p>Upcoming episode drops from the current seasonal catalogue, ordered by airing time.</p></div><div className='calendar-orbit'><CalendarClock size={38}/><b>{seasonal.filter(a => a.nextAiringEpisode).length}</b><small>TRACKED AIRINGS</small></div></div>
            <div className='calendar-list'>
              {seasonal.filter(a => a.nextAiringEpisode).sort((a,b) => (a.nextAiringEpisode?.airingAt || 0) - (b.nextAiringEpisode?.airingAt || 0)).map(anime => <button className='calendar-entry' key={anime.id} onClick={() => openTitle(anime)}><img src={anime.coverImage.large} alt={title(anime)}/><span className='calendar-entry-main'><b>{title(anime)}</b><small>EPISODE {anime.nextAiringEpisode?.episode} · {anime.format || 'ANIME'}</small></span><span className='calendar-entry-time'><b>{new Date((anime.nextAiringEpisode?.airingAt || 0) * 1000).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</b><small>{new Date((anime.nextAiringEpisode?.airingAt || 0) * 1000).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</small></span><ChevronRight size={16}/></button>)}
              {seasonal.length > 0 && !seasonal.some(a => a.nextAiringEpisode) && <div className='empty-state'><CalendarClock size={28}/><h3>No airing times available yet</h3><p>AniList has not supplied upcoming episode schedules for the current seasonal titles.</p><button className='button-primary' onClick={() => nav('Seasonal')}>Browse this season</button></div>}
              {!seasonal.length && <div className='empty-state'><CalendarClock size={28}/><h3>Calendar is loading</h3><p>Seasonal schedule data will appear as soon as the catalogue responds.</p><button className='button-primary' onClick={() => nav('Seasonal')}>Browse seasonal anime</button></div>}
            </div>
          </section>}
          {tab === 'My Library' && <section className='library-overview'><div><span className='overline'>YOUR WATCH JOURNEY</span><b>{library.length}</b><small>TOTAL TITLES</small></div><div><span className='overline'>COMPLETED</span><b>{library.filter(e => e.status === 'Completed').length}</b><small>FINISHED STORIES</small></div><div><span className='overline'>WATCHING</span><b>{library.filter(e => e.status === 'Watching').length}</b><small>IN PROGRESS</small></div><div><span className='overline'>EPISODES LOGGED</span><b>{library.reduce((sum,e) => sum + e.progress,0)}</b><small>YOUR PROGRESS</small></div></section>}
          {tab === 'Discover' && !term && !genre && <>
            <section className='quick-moods'>
              <div className='section-title'><div><span className='overline'>PICK YOUR VIBE</span><h2>Explore by mood</h2></div><button className='text-link' onClick={surprise}>Surprise me <Shuffle size={14}/></button></div>
              <div className='mood-row'>
                {[['⚔️','Adrenaline','Action'],['🌌','Fantasy worlds','Fantasy'],['💞','Heart & soul','Romance'],['🧠','Mind-bending','Psychological'],['☀️','Feel-good','Comedy'],['🏆','Rivalries','Sports']].map(([emoji,label,g]) => <button className='mood-card' key={g} onClick={() => setGenreFilter(g)}><span>{emoji}</span><b>{label}</b><small>{g}</small><ChevronRight size={14}/></button>)}
              </div>
            </section>
            <section className='feature-shelf'>
              <div className='section-title'><div><span className='overline'>THE COMMUNITY IS WATCHING</span><h2><Flame size={20}/> Trending right now</h2></div><button className='text-link' onClick={() => nav('Trending')}>View all <ArrowUpRight size={14}/></button></div>
              <div className='trending-strip'>{trending.slice(0,7).map((anime,index) => <button className='trend-card' key={anime.id} onClick={() => openTitle(anime)}><div className='trend-poster'><img src={anime.coverImage.extraLarge || anime.coverImage.large} alt={title(anime)} loading='lazy'/><b>{String(index + 1).padStart(2,'0')}</b><span><Star size={11} fill='currentColor'/> {score(anime)}</span></div><strong>{title(anime)}</strong><small>{anime.format || 'ANIME'} · {anime.seasonYear || 'TBA'}</small></button>)}</div>
            </section>
            {recommendations.length > 0 && <section className='feature-shelf'><div className='section-title'><div><span className='overline'>BASED ON YOUR LIBRARY</span><h2><Sparkles size={20}/> More like what you love</h2></div></div><div className='mini-recommendations'>{recommendations.slice(0,6).map(anime => <button key={anime.id} onClick={() => openTitle(anime)}><img src={anime.coverImage.large} alt={title(anime)}/><span><b>{title(anime)}</b><small>★ {score(anime)} · {anime.format || 'ANIME'}</small></span><ChevronRight size={15}/></button>)}</div></section>}
          </>}

          {tab !== 'Airing Calendar' && <section className='catalogue-section' id='catalogue'>
            <div className='section-title catalogue-heading'><div><span className='overline'>{tab === 'My Library' ? 'YOUR PERSONAL WATCH SPACE' : tab === 'Seasonal' ? 'CURRENT ANIME SEASON' : tab === 'Trending' ? 'POPULAR WITH THE COMMUNITY' : term ? 'ANILIST SEARCH' : genre ? 'GENRE COLLECTION' : 'CURATED FOR THE CURIOUS'}</span><h2>{sectionHeading}</h2></div><div className='catalogue-tools'><span>{countLabel}</span><button className={showFilters ? 'filter-button active' : 'filter-button'} onClick={() => setShowFilters(!showFilters)}><Filter size={14}/> Filters</button><label className='sort-select'><SlidersHorizontal size={14}/><select value={sort} onChange={e => setSort(e.target.value)}><option value='POPULARITY_DESC'>Most popular</option><option value='SCORE_DESC'>Top rated</option><option value='TRENDING_DESC'>Trending</option><option value='FAVOURITES_DESC'>Most favourited</option><option value='START_DATE_DESC'>Newest</option></select></label></div></div>
            {showFilters && <div className='filter-panel'><label>FORMAT<select value={format} onChange={e => setFormat(e.target.value)}><option value=''>Any format</option><option value='TV'>TV</option><option value='MOVIE'>Movie</option><option value='OVA'>OVA</option><option value='ONA'>ONA</option><option value='SPECIAL'>Special</option></select></label><label>YEAR<select value={year} onChange={e => setYear(e.target.value)}><option value=''>Any year</option>{Array.from({length: 35},(_,i) => new Date().getFullYear() - i).map(y => <option key={y}>{y}</option>)}</select></label><label>GENRE<select value={genre} onChange={e => setGenre(e.target.value)}><option value=''>Any genre</option>{genres.map(g => <option key={g}>{g}</option>)}</select></label><button onClick={resetFilters}>Clear all</button></div>}
            {tab === 'My Library' && <div className='library-toolbar'><div className='library-count'><Bookmark size={15}/> {library.length} titles saved</div><div className='status-tabs'>{['All',...statuses].map(status => <button key={status} className={libraryFilter === status ? 'selected' : ''} onClick={() => setLibraryFilter(status)}>{status}</button>)}</div></div>}
            {(genre || term || format || year) && <div className='active-filters'>{[term && 'Search: ' + term,genre,format,year].filter(Boolean).map(value => <button key={value} onClick={() => { if (value === genre) setGenre(''); else if (value === format) setFormat(''); else if (value === year) setYear(''); else { setTerm(''); setSearch(''); } }}>{value} <X size={12}/></button>)}</div>}
            {busy && tab !== 'Trending' && tab !== 'Seasonal' && tab !== 'My Library' ? <div className='anime-grid'>{Array.from({length:12},(_,i) => <div className='poster-skeleton' key={i}/>)}</div>
              : error && tab === 'Discover' ? <div className='empty-state'><Sparkles/><h3>We lost the signal</h3><p>{error}</p><button className='button-primary' onClick={() => setTerm('')}>Retry catalogue</button></div>
              : currentList.length === 0 ? <div className='empty-state'><BookOpen size={28}/><h3>{tab === 'My Library' ? 'Your watch journey starts here' : 'No titles found'}</h3><p>{tab === 'My Library' ? 'Save anime from Discover and build your own collection.' : 'Try another search or remove a filter.'}</p><button className='button-primary' onClick={() => nav('Discover')}>Explore anime</button></div>
              : <div className='anime-grid'>{currentList.map(anime => <AnimeCard key={anime.id} anime={anime} saved={Boolean(saved[anime.id])} entry={saved[anime.id]} onOpen={() => openTitle(anime)} onSave={() => saveTitle(anime)} onProgress={value => updateEntry(anime.id,{ progress: value })}/>)}</div>}
          </section>}
          <footer className='footer'><b>ANIVERSE ✳</b><span>Discover more. Feel more. Anime without limits.</span><small>POWERED BY ANILIST</small></footer>
        </div>
      </main>

      {detail && <div className='detail-backdrop' onMouseDown={e => { if (e.target === e.currentTarget) setDetail(null); }}>
        <section className='detail-modal'>
          <button className='detail-close' onClick={() => setDetail(null)} aria-label='Close title details'><X size={19}/></button>
          <div className='detail-banner' style={detailData?.bannerImage ? { backgroundImage: 'linear-gradient(0deg,#101119 0%,transparent 100%),url(' + detailData.bannerImage + ')' } : undefined}>
            <div className='banner-overlay'><span>ANIVERSE TITLE FILE　/　#{detail.id}</span><button onClick={() => saveTitle(detailData || detail)}>{saved[detail.id] ? <Check size={15}/> : <Plus size={15}/>} {saved[detail.id] ? 'In your library' : 'Add to library'}</button></div>
          </div>
          <div className='detail-layout'>
            <div className='detail-poster-wrap'><img className='detail-poster' src={detail.coverImage.extraLarge || detail.coverImage.large} alt={title(detail)}/><div className='poster-score'><Star size={14} fill='currentColor'/> {score(detailData || detail)} <small>ANILIST SCORE</small></div>
              <button className='detail-save-mobile' onClick={() => saveTitle(detailData || detail)}>{saved[detail.id] ? <Check size={15}/> : <Plus size={15}/>} {saved[detail.id] ? 'Saved' : 'Add to library'}</button>
            </div>
            <div className='detail-main'>
              <div className='detail-kicker'>{detailData?.format || detail.format || 'ANIME'} <span>•</span> {detailData?.status?.replace(/_/g,' ') || detail.status?.replace(/_/g,' ') || 'TITLE PROFILE'}</div>
              <h2>{title(detailData || detail)}</h2><div className='detail-native'>{detailData?.title.native || detail.title.native || detail.title.romaji}</div>
              <div className='detail-stats'>
                <div><Star size={15}/><b>{score(detailData || detail)}</b><small>SCORE</small></div>
                <div><Tv size={15}/><b>{detailData?.episodes ?? detail.episodes ?? '—'}</b><small>EPISODES</small></div>
                <div><Clock3 size={15}/><b>{detailData?.duration ?? detail.duration ?? '—'}<small> min</small></b><small>PER EPISODE</small></div>
                <div><CalendarDays size={15}/><b>{detailData?.seasonYear || detail.seasonYear || 'TBA'}</b><small>YEAR</small></div>
              </div>
              <div className='detail-genres'>{(detailData?.genres || detail.genres || []).map(g => <span key={g}>{g}</span>)}</div>
              {detailBusy && <div className='detail-loading'><span/> Fetching full title dossier from AniList…</div>}
              {detailError && <div className='detail-error'>{detailError} <button onClick={() => setDetail({ ...detail })}><RefreshCw size={13}/> Retry</button></div>}
              <div className='detail-block'><h3>Synopsis</h3><p className='synopsis'>{safeText(detailData?.description || detail.description) || 'A synopsis has not been added to the catalogue yet.'}</p></div>
              <div className='info-grid'>
                <div><span>RELEASE</span><b>{detailData?.startDate?.year ? [detailData.startDate.year,detailData.startDate.month,detailData.startDate.day].filter(Boolean).join(' / ') : detailData?.seasonYear || detail.seasonYear || 'Unknown'}</b></div>
                <div><span>SEASON</span><b>{detailData?.season || detail.season || '—'}</b></div>
                <div><span>SOURCE</span><b>{(detailData?.source || 'Unknown').replace(/_/g,' ')}</b></div>
                <div><span>COUNTRY</span><b>{detailData?.countryOfOrigin || 'JP'}</b></div>
                <div><span>STUDIO</span><b>{detailData?.studios?.nodes?.map(s => s.name).join(', ') || 'Not listed'}</b></div>
                <div><span>POPULARITY</span><b>{detailData?.popularity?.toLocaleString() || '—'}</b></div>
              </div>
              {detailData?.nextAiringEpisode && <div className='airing-card'><CalendarClock size={18}/><div><b>Episode {detailData.nextAiringEpisode.episode} is next</b><small>{new Date(detailData.nextAiringEpisode.airingAt * 1000).toLocaleString()} · {Math.max(0,Math.floor(detailData.nextAiringEpisode.timeUntilAiring / 3600))}h remaining</small></div></div>}
              {detailData?.trailer?.site === 'youtube' && <a className='trailer-link' href={'https://www.youtube.com/watch?v=' + detailData.trailer.id} target='_blank' rel='noreferrer'><Play size={15} fill='currentColor'/> Watch official trailer <ExternalLink size={13}/></a>}
              <section className='detail-block'><h3><Users size={17}/> Main cast <small>{detailData?.characters?.edges?.length || 0} CHARACTERS</small></h3>
                {detailData?.characters?.edges?.length ? <div className='people-grid'>{detailData.characters.edges.map(edge => <div className='person-card' key={edge.node.id}><img src={edge.node.image?.large || 'https://s4.anilist.co/file/anilistcdn/character/large/default.jpg'} alt={edge.node.name.full}/><div><b>{edge.node.name.full}</b><small>{edge.role}</small>{edge.voiceActors[0] && <span><Mic2 size={11}/> JP: {edge.voiceActors[0].name.full}</span>}</div></div>)}</div> : !detailBusy && <p className='muted-note'>Cast details are not available for this title.</p>}
              </section>
              <section className='detail-block'><h3><Mic2 size={17}/> Japanese voice cast <small>VOICE ACTORS</small></h3>
                {detailData?.characters?.edges?.filter(e => e.voiceActors[0]).slice(0,8).length ? <div className='voice-list'>{detailData.characters.edges.filter(e => e.voiceActors[0]).slice(0,8).map(edge => <div key={edge.node.id}><span>{edge.node.name.full}</span><b>{edge.voiceActors[0].name.full}</b></div>)}</div> : !detailBusy && <p className='muted-note'>Voice actor credits are not available.</p>}
              </section>
              <section className='detail-block'><h3><Clapperboard size={17}/> Production staff <small>KEY CREDITS</small></h3>
                {detailData?.staff?.edges?.length ? <div className='staff-list'>{detailData.staff.edges.slice(0,8).map(edge => <div key={edge.node.id}><b>{edge.node.name.full}</b><span>{edge.role}</span></div>)}</div> : !detailBusy && <p className='muted-note'>Production credits are not available.</p>}
              </section>
              <section className='detail-block'><h3><Play size={17}/> Episode guide <small>{detailData?.episodes || detail.episodes || '?'} EPISODES LISTED</small></h3>
                {detailData?.streamingEpisodes?.length ? <div className='episode-grid'>{detailData.streamingEpisodes.map((episode,index) => <a key={episode.url} href={episode.url} target='_blank' rel='noreferrer'><img src={episode.thumbnail || detail.coverImage.large} alt=''/><span><b>{episode.title}</b><small>{episode.site} · Episode {index + 1}</small></span><ExternalLink size={13}/></a>)}</div> : <div className='episode-summary'><Tv size={18}/><span><b>{detailData?.episodes || detail.episodes || 'Episode count unavailable'} episodes</b><small>AniList provides the episode count and schedule. Individual episode titles or playable links are shown when the catalogue supplies them.</small></span></div>}
              </section>
              {detailData?.relations?.edges?.filter(edge => edge.node.type === 'ANIME').length ? <section className='detail-block'><h3><Heart size={17}/> Franchise connections <small>RELEASE-ORDER GUIDE</small></h3><p className='muted-note'>Related anime arranged by known release year. This is a viewing aid, not an official episode-by-episode chronology.</p><div className='relation-list'>{detailData.relations.edges.filter(edge => edge.node.type === 'ANIME').sort((a,b) => (a.node.startDate?.year || a.node.seasonYear || 9999) - (b.node.startDate?.year || b.node.seasonYear || 9999)).map((edge,index) => <button key={edge.node.id} onClick={() => openTitle(edge.node)}><img src={edge.node.coverImage.large} alt=''/><span><b>{title(edge.node)}</b><small>{String(index + 1).padStart(2,'0')} · {edge.relationType.replace(/_/g,' ')} · {edge.node.startDate?.year || edge.node.seasonYear || 'YEAR UNKNOWN'}</small></span><ChevronRight size={15}/></button>)}</div></section> : null}
              {detailData?.tags?.length ? <section className='detail-block'><h3><Sparkles size={17}/> Themes & tags</h3><div className='tag-cloud'>{detailData.tags.slice(0,16).map(tag => <span key={tag.name}>{tag.name}</span>)}</div></section> : null}
              {detailData?.externalLinks?.length ? <section className='detail-block'><h3><Globe2 size={17}/> Official & catalogue links</h3><div className='external-links'>{detailData.externalLinks.slice(0,8).map(link => <a key={link.url} href={link.url} target='_blank' rel='noreferrer'>{link.site} <ExternalLink size={12}/></a>)}</div></section> : null}
              {saved[detail.id] && <section className='watch-progress'><div className='progress-head'><span>YOUR WATCH PROGRESS</span><b>{saved[detail.id].progress} / {detailData?.episodes || detail.episodes || '—'}</b></div><div className='progress-track'><i style={{ width: (detailData?.episodes ? Math.min(100,saved[detail.id].progress / detailData.episodes * 100) : 0) + '%' }}/></div><div className='progress-controls'><label>STATUS<select value={saved[detail.id].status} onChange={e => updateEntry(detail.id,{status:e.target.value})}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label><div><button onClick={() => updateEntry(detail.id,{progress:Math.max(0,saved[detail.id].progress - 1)})}><Minus size={14}/></button><button onClick={() => updateEntry(detail.id,{progress:Math.min(detailData?.episodes || 999,saved[detail.id].progress + 1)})}><Plus size={14}/> Episode watched</button></div></div></section>}
            </div>
          </div>
        </section>
      </div>}
      {toast && <div className='toast'><Check size={15}/>{toast}</div>}
    </div>
  );
}

function AnimeCard({ anime, saved, entry, onOpen, onSave, onProgress }: {
  anime: Anime; saved: boolean; entry?: SavedEntry; onOpen: () => void; onSave: () => void; onProgress: (value: number) => void;
}) {
  return <article className='anime-card'>
    <button className='poster-button' onClick={onOpen}><img src={anime.coverImage.extraLarge || anime.coverImage.large} alt={title(anime)} loading='lazy'/><span className='poster-format'>{anime.format || 'ANIME'}</span><span className='poster-hover'><Play size={20} fill='currentColor'/> VIEW TITLE</span></button>
    <div className='anime-card-info'>
      <div className='card-title-row'><button className='card-title' onClick={onOpen}>{title(anime)}</button><button className={saved ? 'save-icon saved' : 'save-icon'} onClick={onSave} title={saved ? 'Remove from library' : 'Add to library'}>{saved ? <Check size={15}/> : <Plus size={15}/>}</button></div>
      <div className='card-meta'><span>{anime.seasonYear || 'TBA'} · {anime.format || 'TV'}</span><b><Star size={11} fill='currentColor'/> {score(anime)}</b></div>
      <div className='card-genres'>{anime.genres.slice(0,2).join(' · ') || 'Anime'}</div>
      <div className='card-bottom'><span><Tv size={12}/> {anime.episodes ? anime.episodes + ' eps' : 'Episodes TBA'}</span>{saved && entry && <><span className='progress-mini'>{entry.progress} watched</span><button className='save-icon' title='Log one watched episode' onClick={() => onProgress(Math.min(anime.episodes || 999, entry.progress + 1))}><Plus size={12}/></button></>}</div>
      {saved && entry && <div className='card-progress'><i style={{width:(anime.episodes ? Math.min(100,entry.progress / anime.episodes * 100) : 0) + '%'}}/></div>}
    </div>
  </article>;
}