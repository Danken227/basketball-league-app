import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilterSelect } from '../components/common/Filters';
import PageHeader from '../components/common/PageHeader';
import { icons } from '../components/common/icons';
import {
  competitionId,
  currentGeniusEdition,
  findCompetition,
  geniusEditionById,
  geniusEditions,
  geniusLeagueName,
  geniusLeagueOptions,
  geniusSnapshot,
  isGeniusDomain,
} from '../components/genius/geniusConfig';
import { checkUnfinishedMatches, type PlayedMatch, type UnfinishedMatch } from '../components/genius/geniusUnfinished';
import { saveMatchVideos, syncMatchVideos, type MatchVideos } from '../components/genius/matchVideos';
import { youtubeVideoId, youtubeWatchUrl } from '../components/genius/youtubeStreams';
import { loadCompetitionRosters, loadTeamRoster, suggestLeader, type RosterPlayer, type RosterTeam } from '../components/genius/geniusRosters';
import {
  individualAwards,
  medalIcons,
  medalNames,
  setAchievements,
  useAchievements,
  type Achievement,
  type AchievementsByCompetition,
  type MedalPlace,
} from '../data/achievements';
import { fetchGeniusPage } from '../components/genius/geniusFetch';
import { isGroupName, isPlayoffPhase, readGroups } from '../components/genius/geniusGroups';
import { collectHistory, historyCoverage, type EditionCoverage } from '../components/genius/geniusHistory';
import { loadStoredRecords, playedMatchIds, recomputeRecords, type RecordsProgress, type StoredRecords } from '../components/genius/geniusRecordsData';
import client from '@client/client';
import { news as dalkNews, newsCategories, newsCategory, newsDateLabel, newsPath } from '../data/news';
import PlayoffBracket from '../components/playoff/PlayoffBracket';
import {
  PLAYOFF_SIZES,
  pendingLabel,
  playoffRounds,
  roundName,
  seedLabel,
  seedOrder,
  thirdPlaceMatch,
  type PlayoffBracket as PlayoffBracketData,
  type PlayoffMatch,
  type PlayoffResult,
  type PlayoffSeed,
  type SeriesFormat,
  seriesFormats,
  type StandingsZone,
  type ZoneCounts,
  zoneOfGroup,
} from '../data/playoff';
import { usePlayoffGames } from '../components/playoff/playoffGames';
import { adminRequest, reloadSiteContent, setAdmin, teamRenames, useAdmin, useSiteContent, type AddedNewsItem } from '../data/siteContent';
import { saveNewsDraft } from './newsDraft';

// Panel administratora (link w stopce): logowanie, dodawanie aktualności i nazwy drużyn w poszczególnych edycjach.
// Uprawnienia sprawdza serwer (/api/admin) — ta strona tylko pokazuje formularze.

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition hover:border-orange-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20';
const buttonClass = 'rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-50';
const linkButtonClass = 'text-sm font-medium text-orange-600 hover:text-orange-700';
// Mniejsze przyciski w listach (Wyświetl, Edytuj, Usuń) — w stylu "Opublikuj".
const smallButtonClass = 'rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-40';
const dangerButtonClass = 'rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700';
// Po 5 — lista obok formularza nie wydłuża panelu.
const NEWS_PER_ADMIN_PAGE = 5;
// Zapisane nazwy drużyn — wiersze tabeli są niskie, więc po 10.
const TEAM_NAMES_PER_ADMIN_PAGE = 10;

// Przełącznik stron listy w prawym dolnym rogu karty.
function Pager({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-end gap-2" aria-label="Strony listy">
      <button type="button" className={smallButtonClass} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ‹ Poprzednia
      </button>
      <span className="text-xs text-slate-500">
        {page} / {pageCount}
      </span>
      <button type="button" className={smallButtonClass} disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        Następna ›
      </button>
    </nav>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

const Message = ({ error, success }: { error?: string; success?: ReactNode }) =>
  error ? <p className="text-sm font-medium text-red-600">{error}</p> : success ? <p className="text-sm font-medium text-emerald-700">{success}</p> : null;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Zapamiętany login (przy „Zapamiętaj mnie”) — samo hasło zapamiętuje przeglądarka (autocomplete).
const LOGIN_STORAGE_KEY = `${client.storagePrefix}-admin-login`;

function readStoredLogin() {
  try {
    return localStorage.getItem(LOGIN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeLogin(login: string | undefined) {
  try {
    if (login) localStorage.setItem(LOGIN_STORAGE_KEY, login);
    else localStorage.removeItem(LOGIN_STORAGE_KEY);
  } catch {
    // Brak dostępu do localStorage — login nie zostanie zapamiętany.
  }
}

const eyeIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const eyeOffIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.4 3.4M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20" />
  </svg>
);

function LoginForm() {
  const [login, setLogin] = useState(readStoredLogin);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Zaznaczone, gdy login był zapamiętany przy poprzednim logowaniu.
  const [remember, setRemember] = useState(() => readStoredLogin() !== '');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await adminRequest('login', { login, password, remember });
      storeLogin(remember ? login : undefined);
      setAdmin(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-sm flex-col gap-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <Field label="Login">
        <input className={inputClass} value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required />
      </Field>
      <Field label="Hasło">
        <span className="relative block">
          <input
            className={`${inputClass} pr-10`}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-400 transition hover:text-orange-600"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
            aria-pressed={showPassword}
            title={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
          >
            {showPassword ? eyeOffIcon : eyeIcon}
          </button>
        </span>
      </Field>
      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-orange-600" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Zapamiętaj mnie
        </label>
        <button type="button" className={linkButtonClass} onClick={() => setForgotOpen((value) => !value)} aria-expanded={forgotOpen}>
          Nie pamiętasz hasła?
        </button>
      </div>
      {forgotOpen && (
        <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
          Hasło administratora nie jest zapisane na stronie — ustawia je osoba zarządzająca serwisem w konfiguracji serwera. Poproś ją o nowe hasło; po jego zmianie zaloguj się ponownie.
        </p>
      )}
      <Message error={error} />
      <button type="submit" className={buttonClass} disabled={busy}>
        {busy ? 'Logowanie…' : 'Zaloguj'}
      </button>
      <p className="text-center text-xs text-slate-500">
        {remember ? 'Sesja zostanie zapamiętana na tym urządzeniu przez 30 dni.' : 'Sesja kończy się po zamknięciu przeglądarki (najpóźniej po 12 godzinach).'}
      </p>
    </form>
  );
}

// Okładki do wyboru: banery używane w aktualnościach z dalk.pl, bez okładki (kolor kategorii) albo własny adres.
const covers = [...new Set(dalkNews.map((item) => item.image))];
const coverLabel = (url: string) => url.split('/').pop()!;
const emptyNews = { slug: '', title: '', date: '', excerpt: '', html: '', image: '', source: '' };

function NewsAdmin() {
  const { news } = useSiteContent();
  const [title, setTitle] = useState('');
  const [cover, setCover] = useState(covers[0] ?? '');
  const [customCover, setCustomCover] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<{ slug: string; title: string; edited: boolean }>();
  const [busy, setBusy] = useState(false);
  // Edytowany wpis (slug) albo undefined przy dodawaniu nowego.
  const [editing, setEditing] = useState<string>();
  // Lista dodanych wpisów od najnowszego, po NEWS_PER_ADMIN_PAGE na stronę (po usunięciu numer strony się mieści).
  const [listPage, setListPage] = useState(1);
  // Jak na stronie aktualności: data wpisu, a tego samego dnia późniejsza godzina wyżej.
  const sortedNews = [...news].sort((a, b) => b.date.localeCompare(a.date) || (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
  const listPageCount = Math.max(1, Math.ceil(sortedNews.length / NEWS_PER_ADMIN_PAGE));
  const currentListPage = Math.min(listPage, listPageCount);
  const pageNews = sortedNews.slice((currentListPage - 1) * NEWS_PER_ADMIN_PAGE, currentListPage * NEWS_PER_ADMIN_PAGE);

  const fillForm = (item?: AddedNewsItem) => {
    setEditing(item?.slug);
    setTitle(item?.title ?? '');
    setBody(item?.body ?? '');
    setCategory(item?.category ?? '');
    const image = item ? item.image : (covers[0] ?? '');
    const known = image === '' || covers.includes(image);
    setCover(known ? image : 'custom');
    setCustomCover(known ? '' : image);
  };

  const startEdit = (item: AddedNewsItem) => {
    fillForm(item);
    setSaved(undefined);
    setError(undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setSaved(undefined);
    try {
      const { item } = await adminRequest<{ item: { slug: string; title: string } }>(editing ? 'news-update' : 'news-add', {
        slug: editing,
        title,
        body,
        category,
        image: cover === 'custom' ? customCover : cover,
        reservedSlugs: dalkNews.map((entry) => entry.slug),
      });
      await reloadSiteContent();
      setSaved({ ...item, edited: Boolean(editing) });
      fillForm();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // Podgląd w osobnym oknie (zawsze tym samym — kolejne kliknięcie odświeża otwarty podgląd).
  const preview = () => {
    setError(undefined);
    if (!saveNewsDraft({ title, body, category, image: cover === 'custom' ? customCover : cover, previewAt: Date.now() })) {
      setError('Przeglądarka nie pozwala zapisać podglądu (zablokowany localStorage).');
      return;
    }
    window.open('/admin/podglad', 'news-preview');
  };

  const remove = async (slug: string, itemTitle: string) => {
    if (!window.confirm(`Usunąć aktualność „${itemTitle}”?`)) return;
    try {
      await adminRequest('news-delete', { slug });
      await reloadSiteContent();
      if (editing === slug) fillForm();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
      <Card title={editing ? 'Edycja aktualności' : 'Nowa aktualność'}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Tytuł">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <FilterSelect
              label="Temat"
              value={category}
              onChange={setCategory}
              options={[
                // Bez wyboru temat wynika z tytułu (jak we wpisach z dalk.pl) — podpowiadamy, jaki wyjdzie.
                { value: '', label: `Automatycznie (${newsCategory({ ...emptyNews, title }).label})` },
                ...newsCategories.map(({ label }) => ({ value: label, label })),
              ]}
            />
            <FilterSelect
              label="Okładka"
              value={cover}
              onChange={setCover}
              options={[
                ...covers.map((url) => ({ value: url, label: `Baner: ${coverLabel(url)}` })),
                { value: '', label: 'Bez okładki (kolor kategorii)' },
                { value: 'custom', label: 'Własny adres obrazka…' },
              ]}
            />
          </div>
          {cover === 'custom' && (
            <Field label="Adres obrazka okładki">
              <input className={inputClass} type="url" value={customCover} onChange={(e) => setCustomCover(e.target.value)} placeholder="https://…" required />
            </Field>
          )}
          <Field label="Treść" hint="Akapity oddziel pustą linią. Adresy stron (https://…) zamienią się w linki.">
            <textarea className={`${inputClass} min-h-56`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={20000} required />
          </Field>
          <Message
            error={error}
            success={
              saved && (
                <>
                  {saved.edited ? 'Zapisano zmiany:' : 'Dodano:'}{' '}
                  <Link to={`/aktualnosci/${saved.slug}`} className="underline">
                    {saved.title}
                  </Link>
                </>
              )
            }
          />
          <div className="flex items-center gap-4">
            <button type="submit" className={buttonClass} disabled={busy}>
              {busy ? 'Zapisywanie…' : editing ? 'Zapisz zmiany' : 'Opublikuj'}
            </button>
            <button type="button" className={buttonClass} onClick={preview} disabled={!title.trim() && !body.trim()}>
              Podgląd
            </button>
            {editing && (
              <button type="button" className={linkButtonClass} onClick={() => fillForm()}>
                Anuluj edycję
              </button>
            )}
          </div>
        </form>
      </Card>
      <Card title="Dodane w panelu">
        {news.length === 0 ? (
          <p className="text-sm text-slate-500">Brak — na stronie są tylko aktualności przeniesione z {client.news.sourceSite}.</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {pageNews.map((item) => (
                <li key={item.slug} className={`-mx-2 rounded-lg px-2 py-3 ${editing === item.slug ? 'bg-orange-50' : ''}`}>
                  <p className="truncate text-sm font-semibold text-slate-900" title={item.title}>
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {newsDateLabel(item)} · {newsCategory(item).label}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {/* W nowej karcie — panel z formularzem zostaje otwarty. */}
                    <Link to={newsPath(item)} target="_blank" className={smallButtonClass}>
                      Wyświetl
                    </Link>
                    <button type="button" className={smallButtonClass} onClick={() => startEdit(item)}>
                      Edytuj
                    </button>
                    <button type="button" className={dangerButtonClass} onClick={() => remove(item.slug, item.title)}>
                      Usuń
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <Pager page={currentListPage} pageCount={listPageCount} onChange={setListPage} />
          </>
        )}
      </Card>
    </div>
  );
}

// Rozgrywki edycji (ligi seniorów i kategorie juniorów) do wyboru drużyny.
// Kolejność jak na liście lig w tabelach: ligi seniorskie od najwyższej, potem juniorzy od U19 w dół.
const editionCompetitions = (editionId: string) =>
  geniusLeagueOptions.flatMap(({ value, label }) => {
    const cid = competitionId(editionId, value);
    return cid === undefined ? [] : [{ value: String(cid), label }];
  });

interface GeniusTeam {
  id: string;
  name: string;
  // Logo z Genius (podgląd w formularzu).
  logo?: string;
}

// Drużyny z listy rozgrywek Genius: link ".../team/123" (albo w migawce już "/druzyny/123") z nazwą; logo
// rozpoznajemy po opisie obrazka (Genius opisuje logo nazwą drużyny).
async function loadTeams(cid: string): Promise<GeniusTeam[]> {
  const root = await fetchGeniusPage(`/competition/${cid}/teams`);
  const logos = new Map([...(root?.querySelectorAll('img[alt]') ?? [])].map((img) => [img.getAttribute('alt')!.trim(), img.getAttribute('src') ?? '']));
  const teams = new Map<string, GeniusTeam>();
  root?.querySelectorAll('a[href]').forEach((link) => {
    const id = link.getAttribute('href')!.match(/(?:\/team\/|^\/druzyny\/)(\d+)/)?.[1];
    const name = link.textContent?.replace(/\s+/g, ' ').trim();
    if (id && name && !teams.has(id)) teams.set(id, { id, name, logo: logos.get(name) || undefined });
  });
  return [...teams.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

const editionName = (editionId: string) => geniusEditionById.get(editionId)?.name ?? editionId;
const editionOrder = (editionId: string) => geniusEditions.findIndex((edition) => edition.id === editionId);

const readDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Nie udało się odczytać pliku.'));
    reader.readAsDataURL(file);
  });

// Listy drużyn rozgrywek zapamiętane na czas pracy w panelu (zakres edycji sprawdza wszystkie rozgrywki edycji).
const teamLists = new Map<string, Promise<GeniusTeam[]>>();
const cachedTeams = (cid: string) => {
  let list = teamLists.get(cid);
  if (!list) {
    list = loadTeams(cid);
    teamLists.set(cid, list);
    // Nieudane wczytanie nie zostaje w pamięci — kolejna próba pyta Genius ponownie.
    list.catch(() => teamLists.delete(cid));
  }
  return list;
};

// Edycje od "from" do "to" (w dowolnej kolejności), od najnowszej.
const editionRange = (from: string, to: string) => {
  const [start, end] = [editionOrder(from), editionOrder(to)].sort((a, b) => a - b);
  return geniusEditions.slice(start, end + 1).map((edition) => edition.id);
};

// Gdzie drużyna grała w edycji: we wszystkich rozgrywkach edycji (drużyna mogła zmienić ligę) → nazwa z Genius
// i nazwy lig; undefined — nie grała. Rozgrywki, których listy nie udało się wczytać, zgłaszamy osobno.
interface TeamInEdition {
  editionId: string;
  geniusName?: string;
  leagues: string[];
  failed: boolean;
}

async function findTeamInEdition(teamId: string, editionId: string): Promise<TeamInEdition> {
  const lists = await Promise.all(
    editionCompetitions(editionId).map(async ({ value, label }) => ({ label, list: await cachedTeams(value).catch(() => undefined) })),
  );
  const found = lists.flatMap(({ label, list }) => {
    const entry = list?.find((item) => item.id === teamId);
    return entry ? [{ label, name: entry.name }] : [];
  });
  return { editionId, geniusName: found[0]?.name, leagues: found.map((item) => item.label), failed: lists.some(({ list }) => !list) };
}

// Wgrane logo zmniejszamy w przeglądarce do 160 px (WebP, a gdy przeglądarka go nie zapisze — PNG): mały plik
// w bazie i szybkie wczytywanie na stronie.
const LOGO_SIZE = 160;

async function resizeLogo(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LOGO_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL('image/webp', 0.9);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
}

function LogoPreview({ src, label }: { src?: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200 dark:bg-[#fff]">
        {src ? <img src={src} alt="" className="h-14 w-14 object-contain" /> : <span className="text-[10px] text-slate-400">brak</span>}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
    </div>
  );
}


function TeamNamesAdmin() {
  const { teamNames } = useSiteContent();
  const [editionId, setEditionId] = useState(geniusEditions[0].id);
  const [cid, setCid] = useState(() => editionCompetitions(geniusEditions[0].id)[0]?.value ?? '');
  const [teams, setTeams] = useState<{ cid: string; list: GeniusTeam[] }>();
  const [team, setTeam] = useState<{ id: string; geniusName: string; geniusLogo?: string }>();
  const [name, setName] = useState('');
  // Logo w edycji: '' — jak w Genius, 'keep' — zapisane wcześniej bez zmian, data URL — nowo wgrane, https — adres.
  const [logo, setLogo] = useState('');
  const [savedLogo, setSavedLogo] = useState<string>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [busy, setBusy] = useState<string | boolean>(false);
  // Zakres edycji: ta sama nazwa i logo od wybranej edycji do edycji rangeEnd (undefined — tylko wybrana edycja).
  const [rangeEnd, setRangeEnd] = useState<string>();
  const [listPage, setListPage] = useState(1);
  // Gdzie drużyna grała w edycjach zakresu (sprawdzane po wybraniu drużyny i zakresu).
  const [rangeTeams, setRangeTeams] = useState<{ key: string; editions: TeamInEdition[] }>();
  const rangeKey = team && rangeEnd ? `${team.id}:${editionRange(editionId, rangeEnd).join(',')}` : '';

  useEffect(() => {
    if (!rangeKey) return;
    const [teamId, editions] = rangeKey.split(':');
    let active = true;
    Promise.all(editions.split(',').map((edition) => findTeamInEdition(teamId, edition))).then((found) => {
      if (active) setRangeTeams({ key: rangeKey, editions: found });
    });
    return () => {
      active = false;
    };
  }, [rangeKey]);

  const rangeResult = rangeKey && rangeTeams?.key === rangeKey ? rangeTeams.editions : undefined;

  useEffect(() => {
    let active = true;
    cachedTeams(cid)
      .catch(() => [])
      .then((list) => {
        if (active) setTeams({ cid, list });
      });
    return () => {
      active = false;
    };
  }, [cid]);

  const teamList = teams?.cid === cid ? teams.list : undefined;
  const existing = (teamId: string, edition: string) => teamNames.find((entry) => entry.teamId === teamId && entry.editionId === edition);

  const resetTeam = () => {
    setTeam(undefined);
    setName('');
    setLogo('');
    setSavedLogo(undefined);
  };

  const changeEdition = (value: string) => {
    setEditionId(value);
    setRangeEnd((end) => (end === value ? undefined : end));
    setCid(editionCompetitions(value)[0]?.value ?? '');
    resetTeam();
  };

  // Inne rozgrywki to inna lista drużyn — wybrana drużyna i wpisana nazwa przestają pasować, więc je czyścimy.
  const changeCompetition = (value: string) => {
    setCid(value);
    resetTeam();
    setSaved(undefined);
  };

  // Logo zapisane wcześniej dla tej drużyny i edycji (wgrane w panelu zostaje bez zmian, dopóki nie wgrasz nowego).
  const applySavedLogo = (entryLogo?: string) => {
    setSavedLogo(entryLogo);
    setLogo(entryLogo ? (entryLogo.startsWith('/api/') ? 'keep' : entryLogo) : '');
  };

  const uploadLogo = async (file?: File) => {
    if (!file) return;
    try {
      setLogo(await resizeLogo(file));
      setError(undefined);
    } catch {
      setError('Nie udało się odczytać obrazka — wybierz plik PNG, JPG albo WebP.');
    }
  };

  const chooseTeam = (teamId: string) => {
    const found = teamList?.find((entry) => entry.id === teamId);
    setTeam(found && { id: found.id, geniusName: found.name, geniusLogo: found.logo });
    const entry = found && existing(found.id, editionId);
    setName(found ? (entry?.name ?? found.name) : '');
    applySavedLogo(entry?.logo);
    setSaved(undefined);
  };

  // Logo dla kilku edycji: zapisane wcześniej logo z panelu (adres /api/) wysyłamy jako obrazek — serwer
  // trzyma osobny plik dla każdej edycji.
  const logoForRange = async () => {
    if (logo !== 'keep' || !savedLogo) return logo;
    const response = await fetch(savedLogo);
    if (!response.ok) throw new Error('Nie udało się wczytać zapisanego logo — wgraj je ponownie.');
    return readDataUrl(await response.blob());
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!team) return;
    setBusy(true);
    setError(undefined);
    setSaved(undefined);
    try {
      if (!rangeEnd) {
        const { entry } = await adminRequest<{ entry: { logo?: string } }>('team-name-save', { teamId: team.id, editionId, name, geniusName: team.geniusName, logo });
        await reloadSiteContent();
        applySavedLogo(entry.logo);
        setSaved(`Zapisano: ${team.geniusName} → ${name}${entry.logo ? ' (z logo)' : ''} (edycja ${editionName(editionId)}).`);
        return;
      }
      if (!rangeResult) throw new Error('Poczekaj, aż sprawdzimy, w których edycjach grała drużyna.');
      const targets = rangeResult.filter((item) => item.geniusName);
      if (targets.length === 0) throw new Error('Drużyna nie grała w żadnej edycji z zakresu.');
      const rangeLogo = await logoForRange();
      let withLogo = false;
      for (const [index, target] of targets.entries()) {
        setBusy(`Zapisywanie ${index + 1}/${targets.length}…`);
        const { entry } = await adminRequest<{ entry: { logo?: string } }>('team-name-save', {
          teamId: team.id,
          editionId: target.editionId,
          name,
          geniusName: target.geniusName,
          logo: rangeLogo,
        });
        withLogo ||= Boolean(entry.logo);
        if (target.editionId === editionId) applySavedLogo(entry.logo);
      }
      await reloadSiteContent();
      const skipped = rangeResult.filter((item) => !item.geniusName);
      setSaved(
        `Zapisano: ${team.geniusName} → ${name}${withLogo ? ' (z logo)' : ''} w edycjach ${targets.map((item) => editionName(item.editionId)).join(', ')}.` +
          (skipped.length ? ` Pominięto (drużyna nie grała): ${skipped.map((item) => editionName(item.editionId)).join(', ')}.` : ''),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (teamId: string, edition: string) => {
    if (!window.confirm('Usunąć tę nazwę? W tej edycji wróci nazwa z Genius.')) return;
    try {
      await adminRequest('team-name-delete', { teamId, editionId: edition });
      await reloadSiteContent();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const edit = (teamId: string, edition: string) => {
    const entry = existing(teamId, edition);
    if (!entry) return;
    setEditionId(edition);
    setCid(editionCompetitions(edition)[0]?.value ?? '');
    setTeam({ id: entry.teamId, geniusName: entry.geniusName });
    setName(entry.name);
    applySavedLogo(entry.logo);
    setSaved(undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sorted = [...teamNames].sort((a, b) => editionOrder(a.editionId) - editionOrder(b.editionId) || a.geniusName.localeCompare(b.geniusName, 'pl'));
  // Jak lista aktualności: po usunięciu wpisu numer strony mieści się w liczbie stron.
  const listPageCount = Math.max(1, Math.ceil(sorted.length / TEAM_NAMES_PER_ADMIN_PAGE));
  const currentListPage = Math.min(listPage, listPageCount);
  const pageEntries = sorted.slice((currentListPage - 1) * TEAM_NAMES_PER_ADMIN_PAGE, currentListPage * TEAM_NAMES_PER_ADMIN_PAGE);
  // Drużyna wybrana z tabeli (Edytuj) może nie być na liście wybranych rozgrywek — dopisujemy ją do wyboru.
  const teamOptions = [
    { value: '', label: teamList === undefined ? 'Wczytywanie drużyn…' : teamList.length === 0 ? 'Brak listy drużyn' : 'Wybierz drużynę' },
    ...(team && !teamList?.some((entry) => entry.id === team.id) ? [{ value: team.id, label: team.geniusName }] : []),
    ...(teamList ?? []).map((entry) => ({ value: entry.id, label: `${entry.name}${existing(entry.id, editionId) ? ' ✓' : ''}` })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card title="Nazwa i logo drużyny w edycji">
        <p className="mb-4 text-sm text-slate-600">
          Genius pokazuje we wszystkich edycjach najnowszą nazwę i logo drużyny. Tu ustawisz nazwę i logo, pod którymi drużyna grała w danej edycji — strona
          pokaże je w tabelach, terminarzu, meczach i na stronie drużyny tej edycji.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <FilterSelect label="Edycja" value={editionId} onChange={changeEdition} options={geniusEditions.map((edition) => ({ value: edition.id, label: edition.name }))} />
            <FilterSelect label="Rozgrywki" value={cid} onChange={changeCompetition} options={editionCompetitions(editionId)} />
            <FilterSelect label="Drużyna (nazwa w Genius)" value={team?.id ?? ''} onChange={chooseTeam} options={teamOptions} />
          </div>
          {team && (
            <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-orange-600"
                  checked={rangeEnd !== undefined}
                  onChange={(e) => setRangeEnd(e.target.checked ? (geniusEditions.find((edition) => edition.id !== editionId)?.id ?? editionId) : undefined)}
                />
                Ta sama nazwa i logo w kilku edycjach (zakres)
              </label>
              {rangeEnd !== undefined && (
                <>
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Od edycji">
                      <span className="py-2 text-sm font-semibold text-slate-900">{editionName(editionId)}</span>
                    </Field>
                    <FilterSelect
                      label="Do edycji"
                      value={rangeEnd}
                      onChange={setRangeEnd}
                      options={geniusEditions.map((edition) => ({ value: edition.id, label: edition.name }))}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Drużynę szukamy we wszystkich ligach każdej edycji (mogła zmieniać poziom rozgrywek). Edycje, w których nie grała, zostaną pominięte.
                  </p>
                  {!rangeResult ? (
                    <p className="text-xs text-slate-500">Sprawdzanie edycji…</p>
                  ) : (
                    <ul className="flex flex-col gap-1 text-xs">
                      {rangeResult.map((item) => (
                        <li key={item.editionId} className={item.geniusName ? 'text-slate-700' : 'text-slate-400'}>
                          <span className="font-semibold">{editionName(item.editionId)}:</span>{' '}
                          {item.geniusName
                            ? `${item.leagues.join(', ')}${existing(team.id, item.editionId) ? ' (nadpisze zapisaną nazwę)' : ''}`
                            : 'nie grała, pominięta'}
                          {item.failed && <span className="text-orange-700"> (nie wszystkie listy drużyn się wczytały)</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
          <Field label={rangeEnd !== undefined ? 'Nazwa w edycjach z zakresu' : `Nazwa w edycji ${editionName(editionId)}`}>
            <input className={`${inputClass} max-w-md`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} disabled={!team} required />
          </Field>
          {team && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {rangeEnd !== undefined ? 'Logo w edycjach z zakresu' : `Logo w edycji ${editionName(editionId)}`}
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <LogoPreview src={team.geniusLogo} label="w Genius" />
                <span className="text-slate-400" aria-hidden="true">
                  →
                </span>
                <LogoPreview src={logo === 'keep' ? savedLogo : logo || team.geniusLogo} label={logo ? 'w tej edycji' : 'bez zmian'} />
                <div className="flex flex-wrap gap-2">
                  <label className={`${smallButtonClass} cursor-pointer`}>
                    Wgraj plik…
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => uploadLogo(e.target.files?.[0])} />
                  </label>
                  {logo && (
                    <button type="button" className={dangerButtonClass} onClick={() => setLogo('')}>
                      Logo z Genius
                    </button>
                  )}
                </div>
              </div>
              <input
                className={`${inputClass} max-w-md`}
                type="url"
                placeholder="albo adres obrazka: https://…"
                value={logo.startsWith('https://') ? logo : ''}
                onChange={(e) => setLogo(e.target.value)}
              />
            </div>
          )}
          <Message error={error} success={saved} />
          <div>
            <button type="submit" className={buttonClass} disabled={Boolean(busy) || !team || (rangeEnd !== undefined && !rangeResult)}>
              {typeof busy === 'string' ? busy : busy ? 'Zapisywanie…' : rangeEnd !== undefined ? 'Zapisz w zakresie' : 'Zapisz'}
            </button>
          </div>
        </form>
      </Card>
      <Card title="Zapisane nazwy">
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500">Brak — wszędzie są nazwy z Genius.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Edycja</th>
                  <th className="py-2 pr-4 font-semibold">Nazwa w Genius</th>
                  <th className="py-2 pr-4 font-semibold">Nazwa w edycji</th>
                  <th className="py-2 pr-4 font-semibold">Logo</th>
                  <th className="py-2 pr-4 font-semibold">Zmieniono</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageEntries.map((entry) => (
                  <tr key={`${entry.teamId}-${entry.editionId}`}>
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{editionName(entry.editionId)}</td>
                    <td className="py-2 pr-4">
                      <Link to={`/druzyny/${entry.teamId}`} className="text-slate-900 hover:text-orange-600">
                        {entry.geniusName}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 font-semibold text-slate-900">{entry.name}</td>
                    <td className="py-2 pr-4">
                      {entry.logo ? <img src={entry.logo} alt="" className="h-8 w-8 rounded bg-white object-contain dark:bg-[#fff]" /> : <span className="text-xs text-slate-400">z Genius</span>}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-xs text-slate-500">{new Date(entry.updatedAt).toLocaleString('pl-PL')}</td>
                    <td className="whitespace-nowrap py-2 text-right">
                      <button type="button" className={`${smallButtonClass} mr-2`} onClick={() => edit(entry.teamId, entry.editionId)}>
                        Edytuj
                      </button>
                      <button type="button" className={dangerButtonClass} onClick={() => remove(entry.teamId, entry.editionId)}>
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={currentListPage} pageCount={listPageCount} onChange={setListPage} />
      </Card>
    </div>
  );
}

const recordsDateFormat = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Mecze rozegrane od ostatniego przeliczenia rekordów (rozegrane teraz minus uwzględnione przy przeliczeniu).
function NewMatches({ played, records }: { played?: number | null; records?: StoredRecords | null }) {
  if (played === undefined || records === undefined) return <span className="text-slate-400">…</span>;
  if (played === null) return <span className="text-slate-400">nie udało się sprawdzić</span>;
  const fresh = played - (records ? records.matchCount + records.failedCount : 0);
  if (played === 0) return <span className="text-slate-400">brak meczów</span>;
  if (fresh <= 0) return <span className="font-semibold text-emerald-700">aktualne</span>;
  return (
    <span className="rounded bg-orange-100 px-1.5 py-0.5 font-semibold text-orange-800">
      {fresh} {fresh === 1 ? 'nowy mecz' : fresh % 10 >= 2 && fresh % 10 <= 4 && (fresh % 100 < 10 || fresh % 100 >= 20) ? 'nowe mecze' : 'nowych meczów'}
    </span>
  );
}

// Rekordy (najwyższe zdobycze w meczu) przeliczane tutaj: przeglądarka administratora pobiera statystyki wszystkich
// rozegranych meczów z Genius i zapisuje wynik w bazie — odwiedzający dostają gotowe rekordy jednym zapytaniem.
function RecordsAdmin() {
  const [editionId, setEditionId] = useState(geniusEditions[0].id);
  const competitions = editionCompetitions(editionId);
  // Zapisane rekordy rozgrywek: undefined — sprawdzanie, null — nie przeliczone.
  const [stored, setStored] = useState<Record<string, StoredRecords | null>>({});
  // Liczba rozegranych meczów teraz (terminarz Genius) — porównana z przeliczonymi pokazuje, czy rekordy są aktualne.
  // null — terminarz nie przyszedł (nie wiadomo).
  const [played, setPlayed] = useState<Record<string, number | null>>({});
  const [running, setRunning] = useState<{ cid: string; progress?: RecordsProgress }>();
  const [error, setError] = useState<string>();
  const cidsKey = competitions.map((c) => c.value).join(',');

  useEffect(() => {
    let active = true;
    for (const cid of cidsKey.split(',').filter(Boolean)) {
      loadStoredRecords(Number(cid))
        .catch(() => null)
        .then((records) => active && setStored((prev) => ({ ...prev, [cid]: records })));
      playedMatchIds(Number(cid)).then((ids) => active && setPlayed((prev) => ({ ...prev, [cid]: ids?.length ?? null })));
    }
    return () => {
      active = false;
    };
  }, [cidsKey]);

  const recompute = async (cids: string[]) => {
    setError(undefined);
    try {
      for (const cid of cids) {
        setRunning({ cid });
        const records = await recomputeRecords(Number(cid), (progress) => setRunning({ cid, progress }));
        setStored((prev) => ({ ...prev, [cid]: records }));
        setPlayed((prev) => ({ ...prev, [cid]: records.matchCount + records.failedCount }));
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRunning(undefined);
    }
  };

  return (
    <Card title="Rekordy rozgrywek">
      <p className="mb-4 text-sm text-slate-600">
        Najwyższe zdobycze zawodników w jednym meczu liczymy ze statystyk wszystkich rozegranych meczów. Strona rekordów pokazuje tylko to, co tu przeliczysz —
        przelicz po kolejce (kolumna „Nowe mecze” pokazuje, gdzie są mecze rozegrane od ostatniego przeliczenia).
      </p>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Edycja"
          value={editionId}
          onChange={(value) => {
            setEditionId(value);
            setStored({});
            setPlayed({});
          }}
          options={geniusEditions.map((edition) => ({ value: edition.id, label: edition.name }))}
        />
        <button type="button" className={buttonClass} disabled={Boolean(running)} onClick={() => recompute(competitions.map((c) => c.value))}>
          Przelicz wszystkie
        </button>
      </div>
      <Message error={error} />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-4 font-semibold">Rozgrywki</th>
              <th className="py-2 pr-4 font-semibold">Stan</th>
              <th className="py-2 pr-4 font-semibold">Nowe mecze</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {competitions.map(({ value: cid, label }) => {
              const records = stored[cid];
              const progress = running?.cid === cid ? running.progress : undefined;
              return (
                <tr key={cid}>
                  <td className="whitespace-nowrap py-2 pr-4 font-semibold text-slate-900">{label}</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">
                    {running?.cid === cid
                      ? progress
                        ? `Przeliczanie: ${progress.loaded} z ${progress.matchIds.length} meczów…`
                        : 'Wczytywanie terminarza…'
                      : records === undefined
                        ? 'Sprawdzanie…'
                        : records === null
                          ? 'Nie przeliczone'
                          : `${recordsDateFormat.format(new Date(records.computedAt))} · ${records.matchCount} meczów${records.failedCount ? ` (${records.failedCount} niedostępnych)` : ''}`}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-xs">
                    <NewMatches played={played[cid]} records={records} />
                  </td>
                  <td className="whitespace-nowrap py-2 text-right">
                    <button type="button" className={smallButtonClass} disabled={Boolean(running)} onClick={() => recompute([cid])}>
                      Przelicz
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface VisitDay {
  day: string;
  visits: number;
  views: number;
}

const monthNames = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const monthLabel = (month: string) => `${monthNames[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
const shortDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
const byMonthTotal = (days: VisitDay[], month: string) => sum(days.filter((d) => d.day.startsWith(month)));
const sum = (days: VisitDay[]) => days.reduce((total, d) => ({ visits: total.visits + d.visits, views: total.views + d.views }), { visits: 0, views: 0 });

function StatTile({ label, visits, views }: { label: string; visits: number; views: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{visits}</p>
      <p className="text-xs text-slate-500">
        wizyt · <span className="tabular-nums">{views}</span> wyświetleń
      </p>
    </div>
  );
}

// Wizyty dzienne z ostatnich 30 dni: słupki od najstarszego dnia, nad wykresem wartość wskazanego dnia.
function VisitsChart({ days }: { days: VisitDay[] }) {
  const [hovered, setHovered] = useState<number>();
  const max = Math.max(1, ...days.map((d) => d.visits));
  const shown = days[hovered ?? days.length - 1];
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 text-xs text-slate-600">
        <p aria-live="polite">
          <span className="font-semibold text-slate-900">{shortDay(shown.day)}</span>: {shown.visits} wizyt · {shown.views} wyświetleń
        </p>
        <span className="text-[10px] text-slate-400">najwięcej: {max}</span>
      </div>
      <div className="h-40 border-b border-slate-300" onMouseLeave={() => setHovered(undefined)}>
        <div className="flex h-full items-end gap-[2px]">
          {days.map((d, index) => (
            <button
              key={d.day}
              type="button"
              aria-label={`${shortDay(d.day)}: ${d.visits} wizyt, ${d.views} wyświetleń`}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
              className="group flex h-full flex-1 items-end"
            >
              <span
                className={`block w-full rounded-t-[4px] transition-colors ${hovered === index ? 'bg-orange-700 dark:bg-orange-400' : 'bg-orange-600 dark:bg-orange-500'}`}
                style={{ height: `${Math.max(d.visits ? 2 : 0, (d.visits / max) * 100)}%` }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{shortDay(days[0].day)}</span>
        <span>{shortDay(days[Math.floor(days.length / 2)].day)}</span>
        <span>{shortDay(days[days.length - 1].day)}</span>
      </div>
    </div>
  );
}

// Licznik odwiedzin strony (bez ciasteczek): wizyta to wejście na stronę, wyświetlenie — każda podstrona.
function VisitsAdmin() {
  const [data, setData] = useState<{ today: string; days: VisitDay[] }>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    adminRequest<{ today: string; days: VisitDay[] }>('visits')
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, []);

  if (error) return <Message error={error} />;
  if (!data) return <p className="text-sm text-slate-500">Wczytywanie…</p>;

  const thisMonth = data.today.slice(0, 7);
  // Miesiące od najnowszego, najwyżej 12 — bez miesięcy sprzed uruchomienia licznika (same zera na końcu listy).
  const allMonths = [...new Set(data.days.map((d) => d.day.slice(0, 7)))].slice(0, 12);
  const lastWithData = allMonths.findLastIndex((month) => byMonthTotal(data.days, month).views > 0);
  const months = allMonths.slice(0, Math.max(1, lastWithData + 1));
  const byMonth = (month: string) => byMonthTotal(data.days, month);
  const last30 = data.days.slice(0, 30).reverse();

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Dziś" {...data.days[0]} />
        <StatTile label="Ostatnie 30 dni" {...sum(last30)} />
        <StatTile label={`Ten miesiąc (${monthLabel(thisMonth)})`} {...byMonth(thisMonth)} />
        {allMonths[1] && <StatTile label={`Poprzedni miesiąc (${monthLabel(allMonths[1])})`} {...byMonth(allMonths[1])} />}
      </div>
      <Card title="Wizyty dzienne — ostatnie 30 dni">
        <VisitsChart days={last30} />
      </Card>
      <Card title="Miesiące">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-semibold">Miesiąc</th>
                <th className="py-2 pr-4 text-right font-semibold">Wizyty</th>
                <th className="py-2 text-right font-semibold">Wyświetlenia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {months.map((month) => {
                const total = byMonth(month);
                return (
                  <tr key={month}>
                    <td className="py-2 pr-4 text-slate-900">{monthLabel(month)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{total.visits}</td>
                    <td className="py-2 text-right tabular-nums">{total.views}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Wizyta to wejście na stronę (pierwsza podstrona w karcie przeglądarki), wyświetlenie — każda otwarta podstrona. Wejścia zalogowanego administratora nie są
          liczone. Licznik nie używa ciasteczek ani danych osobowych.
        </p>
      </Card>
    </div>
  );
}

// Strefy tabel (zakładka „Awanse/spadki”): ile miejsc od góry awansuje do play-off, a ile od dołu spada — osobno
// dla każdych rozgrywek (edycja × poziom). Tabele na stronie oznaczają je kolorem (geniusZones.ts).
const zoneInputClass = `${inputClass.replace('w-full', 'w-20')} text-center tabular-nums`;

const editionLeagues = (editionId: string) =>
  geniusLeagueOptions.flatMap(({ value, label }) => {
    const cid = competitionId(editionId, value);
    return cid === undefined ? [] : [{ leagueId: value, cid: String(cid), label }];
  });

// Grupy sezonu zasadniczego rozgrywek w Genius (z menu tabel; bez grup — pusta lista).
async function loadGroupNames(cid: string): Promise<string[]> {
  const root = await fetchGeniusPage(`/competition/${cid}/standings`);
  if (!root) throw new Error('Genius nie odpowiedział');
  return readGroups(root).names.filter(isGroupName);
}

function ZonesAdmin() {
  const { zones } = useSiteContent();
  const [editionId, setEditionId] = useState(geniusEditions[0].id);
  // Wpisane w formularzu (numer rozgrywek → strefy); bez wpisu — zapisane.
  const [draft, setDraft] = useState<Record<string, StandingsZone>>({});
  // „Pokazuj w tabelach” dla całej edycji; undefined — jak w zapisanych strefach.
  const [showDraft, setShowDraft] = useState<boolean>();
  // Grupy rozgrywek z Genius (numer rozgrywek → nazwy grup; null — nie udało się sprawdzić).
  const [groupsOf, setGroupsOf] = useState<Record<string, string[] | null>>({});
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [busy, setBusy] = useState(false);
  const leagues = editionLeagues(editionId);
  const cidsKey = leagues.map((league) => league.cid).join(',');
  const zoneOf = (cid: string): StandingsZone => draft[cid] ?? zones[cid] ?? { playoff: 0, relegation: 0 };
  const show = showDraft ?? leagues.some((league) => zones[league.cid]?.show);
  const previousEdition = geniusEditions[editionOrder(editionId) + 1];

  // Podział na grupy sprawdzamy w Genius (nie na sztywno): rozgrywki bez grup nie mają ustawień grup.
  useEffect(() => {
    let active = true;
    for (const cid of cidsKey.split(',').filter(Boolean)) {
      loadGroupNames(cid)
        .catch(() => null)
        .then((names) => active && setGroupsOf((prev) => ({ ...prev, [cid]: names })));
    }
    return () => {
      active = false;
    };
  }, [cidsKey]);

  const setZone = (cid: string, zone: StandingsZone) => {
    setSaved(undefined);
    setDraft((prev) => ({ ...prev, [cid]: zone }));
  };

  const number = (value: string) => Math.max(0, Math.min(30, Math.floor(Number(value) || 0)));

  const change = (cid: string, field: keyof ZoneCounts, value: string, group?: string) => {
    const zone = zoneOf(cid);
    if (group === undefined) setZone(cid, { ...zone, [field]: number(value) });
    else setZone(cid, { ...zone, groups: { ...zone.groups, [group]: { ...zoneOfGroup(zone, group), [field]: number(value) } } });
  };

  // Osobne strefy grup: na start takie jak wspólne, po wyłączeniu — znowu wspólne.
  const toggleGroups = (cid: string, enabled: boolean) => {
    const zone = zoneOf(cid);
    const names = groupsOf[cid] ?? [];
    if (enabled) setZone(cid, { ...zone, groups: Object.fromEntries(names.map((name) => [name, { playoff: zone.playoff, relegation: zone.relegation }])) });
    else setZone(cid, { playoff: zone.playoff, relegation: zone.relegation, show: zone.show });
  };

  const changeEdition = (value: string) => {
    setEditionId(value);
    setDraft({});
    setShowDraft(undefined);
    setSaved(undefined);
    setError(undefined);
  };

  // Te same strefy co w poprzedniej edycji (po poziomie rozgrywek, bez ustawień grup — grupy mogą być inne).
  const copyPrevious = () => {
    if (!previousEdition) return;
    const previous = new Map(editionLeagues(previousEdition.id).map((league) => [league.leagueId, zones[league.cid]]));
    setDraft(
      Object.fromEntries(
        leagues.map((league) => {
          const zone = previous.get(league.leagueId);
          return [league.cid, { playoff: zone?.playoff ?? 0, relegation: zone?.relegation ?? 0 }];
        }),
      ),
    );
    setShowDraft(leagues.length > 0 && editionLeagues(previousEdition.id).some((league) => zones[league.cid]?.show));
    setSaved(undefined);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setSaved(undefined);
    try {
      await adminRequest('zones-save', { zones: Object.fromEntries(leagues.map((league) => [league.cid, { ...zoneOf(league.cid), show }])) });
      await reloadSiteContent();
      setDraft({});
      setShowDraft(undefined);
      setSaved(`Zapisano strefy tabel edycji ${editionName(editionId)}.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const countInput = (cid: string, field: keyof ZoneCounts, value: number, label: string, group?: string) => (
    <input
      className={zoneInputClass}
      type="number"
      min={0}
      max={30}
      value={value}
      onChange={(e) => change(cid, field, e.target.value, group)}
      aria-label={label}
    />
  );

  return (
    <Card title="Awanse i spadki w tabelach">
      <p className="mb-4 text-sm text-slate-600">
        Ustaw, ile miejsc od góry każdej tabeli daje awans do play-off, a ile od dołu oznacza spadek. Pozostałe miejsca są neutralne. Gdy grupy mają różną liczbę
        drużyn, zaznacz „Osobno dla grup” i ustaw strefy każdej grupy. Zakładka „Play-off” bierze ze strefy drużyny do drabinki (także gdy strefy są ukryte).
      </p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect label="Edycja" value={editionId} onChange={changeEdition} options={geniusEditions.map((edition) => ({ value: edition.id, label: edition.name }))} />
          {previousEdition && (
            <button type="button" className={linkButtonClass} onClick={copyPrevious}>
              Skopiuj z edycji {previousEdition.name}
            </button>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-orange-600"
            checked={show}
            onChange={(e) => {
              setShowDraft(e.target.checked);
              setSaved(undefined);
            }}
          />
          Pokazuj strefy w tabelach tej edycji (kolor wiersza i legenda)
        </label>
        <div className="overflow-x-auto">
          <table className="w-full max-w-3xl text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-semibold">Poziom rozgrywek</th>
                <th className="py-2 pr-4 text-center font-semibold">
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden="true" />
                  Awans do play-off (od góry)
                </th>
                <th className="py-2 pr-4 text-center font-semibold">
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-red-500" aria-hidden="true" />
                  Spadek (od dołu)
                </th>
                <th className="py-2 text-center font-semibold">Osobno dla grup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leagues.map((league) => {
                const zone = zoneOf(league.cid);
                const names = groupsOf[league.cid];
                const perGroup = Boolean(zone.groups);
                // Blokada z faktycznego podziału w Genius: bez grup (albo przed sprawdzeniem) — nie da się zaznaczyć.
                const canSplit = Boolean(names && names.length > 1);
                const reason = names === undefined ? 'Sprawdzanie grup w Genius…' : names === null ? 'Nie udało się sprawdzić grup w Genius' : 'Rozgrywki bez podziału na grupy';
                return (
                  <Fragment key={league.cid}>
                    <tr>
                      <td className="py-2 pr-4 font-semibold text-slate-900">
                        {league.label}
                        {names && names.length > 1 && <span className="ml-1 text-xs font-normal text-slate-500">({names.length} {names.length < 5 ? 'grupy' : 'grup'})</span>}
                      </td>
                      <td className="py-2 pr-4 text-center">
                        {perGroup ? (
                          <span className="text-xs text-slate-400">w grupach</span>
                        ) : (
                          countInput(league.cid, 'playoff', zone.playoff, `${league.label}: miejsca do play-off`)
                        )}
                      </td>
                      <td className="py-2 pr-4 text-center">
                        {perGroup ? (
                          <span className="text-xs text-slate-400">w grupach</span>
                        ) : (
                          countInput(league.cid, 'relegation', zone.relegation, `${league.label}: miejsca spadkowe`)
                        )}
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-orange-600 disabled:opacity-40"
                          checked={perGroup}
                          disabled={!canSplit && !perGroup}
                          title={canSplit ? undefined : reason}
                          onChange={(e) => toggleGroups(league.cid, e.target.checked)}
                          aria-label={`${league.label}: osobne strefy dla grup`}
                        />
                      </td>
                    </tr>
                    {perGroup &&
                      [...new Set([...(names ?? []), ...Object.keys(zone.groups ?? {})])].map((group) => {
                        const counts = zoneOfGroup(zone, group);
                        return (
                          <tr key={group} className="bg-slate-50">
                            <td className="py-1.5 pl-4 pr-4 text-slate-700">{group}</td>
                            <td className="py-1.5 pr-4 text-center">
                              {countInput(league.cid, 'playoff', counts.playoff, `${league.label}, ${group}: miejsca do play-off`, group)}
                            </td>
                            <td className="py-1.5 pr-4 text-center">
                              {countInput(league.cid, 'relegation', counts.relegation, `${league.label}, ${group}: miejsca spadkowe`, group)}
                            </td>
                            <td />
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <Message error={error} success={saved} />
        <div>
          <button type="submit" className={buttonClass} disabled={busy}>
            {busy ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </div>
      </form>
    </Card>
  );
}

// Tabele grup rozgrywek z Genius: miejsce, drużyna (numer, nazwa, logo). Rozgrywki bez grup — jedna tabela ("").
interface GroupStandings {
  group: string;
  rows: PlayoffSeed[];
}

const teamIdOf = (href: string) => {
  let path = href;
  try {
    path = decodeURIComponent(href);
  } catch {
    // Niepoprawne kodowanie — sprawdzamy adres bez dekodowania.
  }
  return path.match(/(?:\/team\/|\/druzyny\/)(\d+)/)?.[1] ?? '';
};

function readStandings(root: HTMLElement | undefined, group: string): PlayoffSeed[] {
  return [...(root?.querySelectorAll<HTMLTableRowElement>('table.standings tbody tr') ?? [])].flatMap((row) => {
    const position = Number(row.cells[0]?.textContent?.trim());
    const link = row.querySelector<HTMLAnchorElement>('td.team-name a');
    const name = (row.querySelector('.team-name-full') ?? link)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (!position || !name) return [];
    const logo = row.querySelector('img')?.getAttribute('src') ?? '';
    return [{ group, position, teamId: teamIdOf(link?.getAttribute('href') ?? ''), name, logo: logo.startsWith('https://') ? logo : '' }];
  });
}

// Tabele grup i pozostałe fazy rozgrywek w Genius (np. „PLAY OFF” — z niej drabinka bierze wyniki meczów).
async function loadGroupStandings(cid: string): Promise<{ groups: GroupStandings[]; phases: string[] }> {
  const root = await fetchGeniusPage(`/competition/${cid}/standings`);
  if (!root) throw new Error('Nie udało się wczytać tabel z Genius — spróbuj ponownie.');
  // Grupy sezonu zasadniczego; bez grup — jedna tabela sezonu (np. „Ekstraliga 2026”, gdy obok jest „PLAY OFF”).
  const names = readGroups(root).names;
  const regular = names.filter((name) => !isPlayoffPhase(name));
  const phases = names.filter(isPlayoffPhase);
  const groupNames = regular.filter(isGroupName);
  if (groupNames.length === 0) {
    const page = regular.length > 0 && phases.length > 0 ? await fetchGeniusPage(`/competition/${cid}/standings?phaseName=${regular[0].replace(/ /g, '+')}&`) : root;
    return { groups: [{ group: '', rows: readStandings(page, '') }], phases };
  }
  const groups = await Promise.all(
    groupNames.map(async (group) => ({
      group,
      rows: readStandings(await fetchGeniusPage(`/competition/${cid}/standings?phaseName=${group.replace(/ /g, '+')}&`), group),
    })),
  );
  return { groups, phases };
}

const seedKey = (seed: Pick<PlayoffSeed, 'group' | 'position'>) => `${seed.group}|${seed.position}`;

// Zakwalifikowani (strefa play-off z każdej grupy) uszeregowani: najpierw zwycięzcy grup, potem drugie miejsca itd.,
// rozstawieni tak, żeby najwyżej uszeregowani spotkali się najpóźniej; brakujące miejsca to wolne losy.
function autoSeeds(qualified: PlayoffSeed[], size: number, groups: string[]) {
  const ranking = [...qualified].sort((a, b) => a.position - b.position || groups.indexOf(a.group) - groups.indexOf(b.group));
  return seedOrder(size).map((rank) => ranking[rank - 1] ?? null);
}

const DEFAULT_PHASE = 'PLAY OFF';

const emptyBracket = (seeds: (PlayoffSeed | null)[], phases: string[]): PlayoffBracketData => ({
  enabled: false,
  title: 'Play-off',
  phase: phases[0] ?? DEFAULT_PHASE,
  formats: [],
  thirdPlace: false,
  seeds,
  results: {},
  updatedAt: '',
});

function PlayoffAdmin() {
  const { zones, playoffs, teamNames } = useSiteContent();
  const [editionId, setEditionId] = useState(geniusEditions[0].id);
  const [cid, setCid] = useState(() => editionCompetitions(geniusEditions[0].id)[0]?.value ?? '');
  const [standings, setStandings] = useState<{ cid: string; groups?: GroupStandings[]; phases?: string[]; error?: string }>();
  // Edytowana drabinka (undefined — jeszcze nie przygotowana dla tych rozgrywek).
  const [bracket, setBracket] = useState<{ cid: string; value: PlayoffBracketData }>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [busy, setBusy] = useState(false);
  const zone = zones[cid];

  useEffect(() => {
    let active = true;
    loadGroupStandings(cid)
      .then(({ groups, phases }) => active && setStandings({ cid, groups, phases }))
      .catch((e: unknown) => active && setStandings({ cid, error: errorText(e) }));
    return () => {
      active = false;
    };
  }, [cid]);

  const groups = standings?.cid === cid ? standings.groups : undefined;
  const allRows = groups?.flatMap((group) => group.rows) ?? [];
  // Strefa play-off każdej grupy (osobne ustawienia grup albo wspólne).
  const inPlayoffZone = (row: PlayoffSeed) => Boolean(zone && row.position <= zoneOfGroup(zone, row.group).playoff);
  const qualified = groups ? groups.flatMap((group) => group.rows.filter(inPlayoffZone)) : [];
  const groupNames = groups?.map((group) => group.group) ?? [];
  const phases = (standings?.cid === cid ? standings.phases : undefined) ?? [];

  // Drabinka do edycji: zapisana (z drużynami odświeżonymi z obecnych tabel) albo nowa, rozstawiona automatycznie.
  const stored = playoffs[cid];
  const draft =
    bracket?.cid === cid
      ? bracket.value
      : groups
        ? stored
          ? {
              ...stored,
              // Zapisana faza, a gdy Genius jej nie ma — faza play-off, którą ma (albo domyślna nazwa).
              phase: phases.includes(stored.phase) ? stored.phase : (phases[0] ?? (stored.phase || DEFAULT_PHASE)),
              formats: stored.formats ?? [],
              seeds: stored.seeds.map((seed) => seed && (allRows.find((row) => seedKey(row) === seedKey(seed)) ?? seed)),
            }
          : emptyBracket(autoSeeds(qualified, PLAYOFF_SIZES.find((size) => size >= qualified.length) ?? 32, groupNames), phases)
        : undefined;
  // Mecze fazy play-off z Genius — z nich wyniki par (podgląd i lista niżej).
  const games = usePlayoffGames(Number(cid), draft?.phase ?? DEFAULT_PHASE);
  const update = (change: Partial<PlayoffBracketData>) => {
    if (!draft) return;
    setSaved(undefined);
    setBracket({ cid, value: { ...draft, ...change } });
  };

  const changeEdition = (value: string) => {
    setEditionId(value);
    setCid(editionCompetitions(value)[0]?.value ?? '');
    setBracket(undefined);
    setSaved(undefined);
    setError(undefined);
  };

  const changeCompetition = (value: string) => {
    setCid(value);
    setBracket(undefined);
    setSaved(undefined);
    setError(undefined);
  };

  const changeSize = (size: number) => update({ seeds: autoSeeds(qualified, size, groupNames), results: {}, thirdPlace: size >= 4 && Boolean(draft?.thirdPlace) });

  const changeFormat = (round: number, format: SeriesFormat) => {
    if (!draft) return;
    const formats = [...draft.formats];
    while (formats.length < round) formats.push('single');
    formats[round] = format;
    update({ formats });
  };

  const changeSeed = (index: number, value: string) => {
    if (!draft) return;
    const seeds = [...draft.seeds];
    seeds[index] = value ? (allRows.find((row) => seedKey(row) === value) ?? null) : null;
    // Wynik tej pary przestaje pasować do nowych drużyn.
    const results = { ...draft.results };
    delete results[`r0m${Math.floor(index / 2)}`];
    update({ seeds, results });
  };

  // Ręczny wyjątek pary (np. walkower): zwycięzca i opis; pusty — wynik z meczów w Genius.
  const changeResult = (key: string, change: PlayoffResult) => {
    if (!draft) return;
    const result: PlayoffResult = { ...draft.results[key], ...change };
    if (result.winner === undefined) delete result.winner;
    if (!result.score) delete result.score;
    const results = { ...draft.results, [key]: result };
    if (result.winner === undefined && !result.score) delete results[key];
    update({ results });
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError(undefined);
    setSaved(undefined);
    try {
      await adminRequest('playoff-save', { cid, bracket: draft });
      await reloadSiteContent();
      setBracket(undefined);
      setSaved(draft.enabled ? 'Zapisano — drabinka jest widoczna na stronie Tabele.' : 'Zapisano — drabinka jest ukryta na stronie (włącz „Pokazuj na stronie Tabele”).');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Usunąć drabinkę play-off tych rozgrywek?')) return;
    try {
      await adminRequest('playoff-delete', { cid });
      await reloadSiteContent();
      setBracket(undefined);
      setSaved('Usunięto drabinkę.');
    } catch (e) {
      setError(errorText(e));
    }
  };

  const seedOptions = [
    { value: '', label: 'Wolny los' },
    ...allRows.map((row) => ({ value: seedKey(row), label: `${seedLabel(row)} · ${row.name}${inPlayoffZone(row) ? '' : ' (poza strefą)'}` })),
  ];
  const rounds = draft ? playoffRounds(draft, games) : [];
  const third = draft ? thirdPlaceMatch(draft, rounds, games) : undefined;
  const matchName = (match: PlayoffMatch, side: 0 | 1) => {
    const seed = match.teams[side];
    return seed === null ? 'wolny los' : seed ? `${seedLabel(seed)} ${seed.name}` : pendingLabel(match, side).toLowerCase();
  };

  // Wynik pary z Genius: rozegrane mecze (wynik z punktu widzenia pierwszej drużyny) i podsumowanie serii.
  const geniusResult = (match: PlayoffMatch) => {
    if (games === undefined) return 'wczytywanie meczów z Genius…';
    if (match.games.length === 0) return 'brak meczów tej pary w fazie Genius';
    const scores = match.games.map((game) => (game.complete && game.score ? `${game.score[0]}:${game.score[1]}` : 'mecz zaplanowany')).join(', ');
    return match.summary ? `${scores} (${match.format === 'twoLeg' ? `suma ${match.summary}` : match.summary})` : scores;
  };

  const resultEditor = (match: PlayoffMatch) => {
    const [a, b] = match.teams;
    const known = Boolean(a && b);
    return (
      <div key={match.key} className="flex flex-col gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
        <p className="font-medium text-slate-900">
          {matchName(match, 0)} <span className="text-slate-400">vs</span> {matchName(match, 1)}
        </p>
        {known && (
          <>
            <p className="text-xs text-slate-600">
              Genius: {geniusResult(match)}
              {match.winner && <span className="font-semibold text-emerald-700"> → dalej: {match.winner.name}</span>}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <FilterSelect
                label="Zwycięzca"
                value={match.manual?.winner === undefined ? '' : String(match.manual.winner)}
                onChange={(value) => changeResult(match.key, { winner: value === '' ? undefined : (Number(value) as 0 | 1) })}
                options={[
                  { value: '', label: 'Z wyników Genius' },
                  { value: '0', label: `Ręcznie: ${a!.name}` },
                  { value: '1', label: `Ręcznie: ${b!.name}` },
                ]}
              />
              <Field label="Opis zamiast wyniku">
                <input
                  className={inputClass.replace('w-full', 'w-48')}
                  placeholder="np. walkower"
                  value={match.manual?.score ?? ''}
                  onChange={(e) => changeResult(match.key, { score: e.target.value })}
                  maxLength={40}
                />
              </Field>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <Card title="Drabinka play-off">
        <p className="mb-4 text-sm text-slate-600">
          Drużyny do drabinki to miejsca ze strefy „Awans do play-off” w tabelach grup (zakładka „Awanse/spadki”). Ułóż pary i ustaw format serii w rundach — wyniki
          i zwycięzców strona bierze z meczów fazy play-off w Genius, a kolejne rundy uzupełniają się same. Zwycięzcę możesz ustawić ręcznie tylko jako wyjątek (np.
          walkower). Po włączeniu „Pokazuj na stronie Tabele” tabela tych rozgrywek dostaje przełącznik Tabela / Play-off.
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <FilterSelect label="Edycja" value={editionId} onChange={changeEdition} options={geniusEditions.map((edition) => ({ value: edition.id, label: edition.name }))} />
          <FilterSelect label="Rozgrywki" value={cid} onChange={changeCompetition} options={editionCompetitions(editionId)} />
        </div>
        {standings?.cid === cid && standings.error ? (
          <Message error={standings.error} />
        ) : !groups || !draft ? (
          <p className="text-sm text-slate-500">Wczytywanie tabel z Genius…</p>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-slate-600">
              {qualified.length > 0
                ? zone?.groups
                  ? `Strefa play-off (osobno dla grup): ${groups.map((group) => `${seedLabel({ group: group.group, position: 0 }).replace(/0$/, '')} ${zoneOfGroup(zone, group.group).playoff}`).join(', ')} — ${qualified.length} drużyn.`
                  : `Strefa play-off: ${zone?.playoff} ${zone?.playoff === 1 ? 'miejsce' : 'miejsca'} z ${groups.length > 1 ? `każdej z ${groups.length} grup` : 'tabeli'} — ${qualified.length} drużyn.`
                : 'Te rozgrywki nie mają strefy play-off — ustaw ją w zakładce „Awanse/spadki” (do drabinki możesz też wybrać drużyny ręcznie).'}
              {stored && ' Nazwy drużyn odświeżone z obecnych tabel — zapisz, żeby je utrwalić.'}
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Nazwa">
                <input className={inputClass.replace('w-full', 'w-56')} value={draft.title} onChange={(e) => update({ title: e.target.value })} maxLength={80} />
              </Field>
              <FilterSelect
                label="Miejsc w drabince"
                value={String(draft.seeds.length)}
                onChange={(value) => changeSize(Number(value))}
                options={PLAYOFF_SIZES.map((size) => ({ value: String(size), label: `${size} (${roundName(size)})` }))}
              />
              <button type="button" className={smallButtonClass} onClick={() => changeSize(draft.seeds.length)}>
                Ułóż pary automatycznie
              </button>
            </div>
            {/* Faza Genius z wynikami: wybierana sama (zwykle „PLAY OFF”); wybór tylko przy kilku fazach play-off. */}
            <div className="flex flex-wrap items-end gap-3">
              {phases.length > 1 && (
                <FilterSelect
                  label="Faza play-off w Genius"
                  value={draft.phase}
                  onChange={(value) => update({ phase: value })}
                  options={phases.map((phase) => ({ value: phase, label: phase }))}
                />
              )}
              <p className="text-xs text-slate-500">
                {!phases.includes(draft.phase)
                  ? 'Genius nie ma jeszcze fazy play-off — wyniki pojawią się w drabince, gdy liga ją doda.'
                  : games === undefined
                    ? `Wyniki z fazy Genius „${draft.phase}”: wczytywanie meczów…`
                    : `Wyniki z fazy Genius „${draft.phase}”: ${games.length > 0 ? `${games.length} ${games.length === 1 ? 'mecz' : games.length % 10 >= 2 && games.length % 10 <= 4 && (games.length % 100 < 10 || games.length % 100 >= 20) ? 'mecze' : 'meczów'}` : 'jeszcze bez meczów'}.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-orange-600" checked={draft.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
                Pokazuj na stronie Tabele (przełącznik Tabela / Play-off)
              </label>
              {draft.seeds.length >= 4 && (
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" className="h-4 w-4 accent-orange-600" checked={draft.thirdPlace} onChange={(e) => update({ thirdPlace: e.target.checked })} />
                  Mecz o 3. miejsce
                </label>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pary: {roundName(draft.seeds.length)}</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {Array.from({ length: draft.seeds.length / 2 }, (_, pair) => (
                  <div key={pair} className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200">
                    {[pair * 2, pair * 2 + 1].map((index) => (
                      <FilterSelect key={index} label={index % 2 ? 'Gość' : 'Gospodarz'} value={draft.seeds[index] ? seedKey(draft.seeds[index]) : ''} onChange={(value) => changeSeed(index, value)} options={seedOptions} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rundy i wyniki</h3>
              {rounds.map((matches, round) => (
                <div key={round} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-end gap-3">
                    <p className="pb-2 text-xs font-semibold text-slate-700">{roundName(matches.length * 2)}</p>
                    <FilterSelect
                      label="Format serii"
                      value={draft.formats[round] ?? 'single'}
                      onChange={(value) => changeFormat(round, value as SeriesFormat)}
                      options={seriesFormats}
                    />
                  </div>
                  {matches.filter((match) => match.teams[0] !== null && match.teams[1] !== null).map(resultEditor)}
                </div>
              ))}
              {third && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-slate-700">Mecz o 3. miejsce</p>
                  {resultEditor(third)}
                </div>
              )}
            </div>
            <Message error={error} success={saved} />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={buttonClass} disabled={busy} onClick={save}>
                {busy ? 'Zapisywanie…' : 'Zapisz drabinkę'}
              </button>
              {stored && (
                <button type="button" className={dangerButtonClass} onClick={remove}>
                  Usuń drabinkę
                </button>
              )}
            </div>
          </div>
        )}
      </Card>
      {draft && groups && (
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Podgląd</h2>
          <PlayoffBracket bracket={draft} cid={Number(cid)} renames={teamRenames(teamNames, editionId)} />
        </div>
      )}
    </div>
  );
}

// Formularz zgłoszenia drużyny pobierany przyciskiem „Zgłoś zespół” w nagłówku. Bez wgranego pliku przycisk
// pobiera plik z konfiguracji klienta (ten sam co na stronie ligi).
const MAX_FORM_BYTES = 700 * 1024;
const formAccept = '.pdf,.doc,.docx,.odt,.rtf';
const fileSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

function RegistrationFormAdmin() {
  const { registrationForm } = useSiteContent();
  const [file, setFile] = useState<File>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [busy, setBusy] = useState(false);
  const defaultUrl = client.links.registrationForm;

  const choose = (chosen?: File) => {
    setSaved(undefined);
    setError(chosen && chosen.size > MAX_FORM_BYTES ? `Plik ma ${fileSize(chosen.size)} — maksymalnie ${fileSize(MAX_FORM_BYTES)}.` : undefined);
    setFile(chosen && chosen.size <= MAX_FORM_BYTES ? chosen : undefined);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(undefined);
    setSaved(undefined);
    try {
      await adminRequest('registration-form-save', { name: file.name, data: await readDataUrl(file) });
      await reloadSiteContent();
      setSaved(`Zapisano: ${file.name}. Przycisk „Zgłoś zespół” pobiera teraz ten plik.`);
      setFile(undefined);
      (event.target as HTMLFormElement).reset();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(defaultUrl ? 'Usunąć wgrany formularz? Przycisk wróci do pliku domyślnego.' : 'Usunąć wgrany formularz? Przycisk „Zgłoś zespół” zniknie.')) return;
    try {
      await adminRequest('registration-form-delete', {});
      await reloadSiteContent();
      setSaved('Usunięto wgrany formularz.');
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
      <Card title="Nowy formularz zgłoszenia">
        <p className="mb-4 text-sm text-slate-600">
          Plik pobierany przyciskiem „Zgłoś zespół” w nagłówku strony. Nowy plik zastępuje poprzedni — np. formularz na kolejną edycję.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Plik formularza" hint={`PDF, DOC, DOCX, ODT albo RTF, maksymalnie ${fileSize(MAX_FORM_BYTES)}.`}>
            <input
              type="file"
              accept={formAccept}
              className="text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-orange-700"
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </Field>
          <Message error={error} success={saved} />
          <div>
            <button type="submit" className={buttonClass} disabled={busy || !file}>
              {busy ? 'Wgrywanie…' : 'Wgraj formularz'}
            </button>
          </div>
        </form>
      </Card>
      <Card title="Obecny formularz">
        {registrationForm ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="font-semibold text-slate-900">{registrationForm.name}</p>
            <p className="text-xs text-slate-500">
              {fileSize(registrationForm.size)} · wgrany {new Date(registrationForm.uploadedAt).toLocaleString('pl-PL')}
            </p>
            <div className="flex flex-wrap gap-2">
              <a href={registrationForm.url} download={registrationForm.name} className={smallButtonClass}>
                Pobierz
              </a>
              <button type="button" className={dangerButtonClass} onClick={remove}>
                Usuń
              </button>
            </div>
          </div>
        ) : defaultUrl ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-slate-600">Plik domyślny (z {client.news.sourceSite}):</p>
            <p className="break-all font-semibold text-slate-900">{defaultUrl.split('/').pop()}</p>
            <div>
              <a href={defaultUrl} download className={smallButtonClass}>
                Pobierz
              </a>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Brak — przycisk „Zgłoś zespół” jest ukryty, dopóki nie wgrasz formularza.</p>
        )}
      </Card>
    </div>
  );
}

// Listy drużyn i zawodników zamkniętych sezonów (geniusHistory.ts): z nich filtr „Edycja” na stronach drużyny
// i zawodnika od razu wie, w których sezonach ktoś grał. Przycisk jest aktywny tylko wtedy, gdy któregoś
// zamkniętego sezonu brakuje — czyli po dodaniu nowego sezonu w konfiguracji strony.
function GeniusSeasonsAdmin() {
  const [coverage, setCoverage] = useState<EditionCoverage[]>();
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const canCollect = isGeniusDomain() && !geniusSnapshot;

  const refresh = () =>
    historyCoverage()
      .then(setCoverage)
      .catch((e) => setError(errorText(e)));
  useEffect(() => {
    refresh();
  }, []);

  const missing = coverage?.flatMap((edition) => edition.missing) ?? [];
  const collect = async () => {
    setError(undefined);
    setSaved(undefined);
    try {
      const failed = await collectHistory(missing, (done, total) => setProgress({ done, total }));
      setSaved(
        failed.length === 0
          ? 'Zapisano. Strona zacznie korzystać z nowych list w ciągu ok. 5 minut.'
          : `Zapisano część list. Genius nie oddał ${failed.length} z nich — spróbuj ponownie za chwilę.`,
      );
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setProgress(undefined);
    }
  };

  return (
    <Card title="Sezony Genius">
      <p className="mb-4 text-sm text-slate-600">
        Na stronach drużyny i zawodnika filtr „Edycja” pokazuje sezony, w których ktoś grał. Listy zakończonych sezonów się nie zmieniają, więc
        trzymamy je u siebie — wtedy strona nie pyta o nie Genius przy każdej wizycie. Po dodaniu nowego sezonu w konfiguracji strony poprzedni
        sezon staje się zakończony: kliknij wtedy przycisk poniżej (zbieranie trwa kilka minut). Bieżący sezon strona zawsze sprawdza w Genius na
        żywo.
      </p>
      {coverage === undefined ? (
        <p className="text-sm text-slate-500">Sprawdzanie…</p>
      ) : (
        <ul className="mb-4 space-y-1 text-sm">
          {coverage.map((edition) => (
            <li key={edition.editionId}>
              <span className="font-semibold text-slate-900">Sezon {edition.name}</span>{' '}
              {edition.missing.length === 0 ? (
                <span className="text-emerald-700">— w komplecie</span>
              ) : (
                <span className="text-amber-700">
                  — brakuje list z {edition.missing.length} {edition.missing.length === 1 ? 'ligi' : 'lig'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button type="button" className={buttonClass} disabled={!canCollect || missing.length === 0 || Boolean(progress)} onClick={collect}>
          Zbierz brakujące sezony
        </button>
        {progress && (
          <span className="text-sm text-slate-600">
            Zbieranie list: {progress.done} z {progress.total}… (z każdych rozgrywek 3 listy: drużyny, zawodnicy i kto zagrał)
          </span>
        )}
        {coverage && missing.length === 0 && !progress && <span className="text-sm text-slate-500">Wszystkie zakończone sezony są w komplecie.</span>}
      </div>
      {!canCollect && <p className="mb-3 text-sm text-slate-500">Zbieranie działa tylko na stronie ligi (Genius wydaje dane tylko jej domenie).</p>}
      <Message error={error} success={saved} />
    </Card>
  );
}

// Niezamknięte mecze bieżącej edycji (geniusUnfinished.ts) i przy okazji nagrania meczów (matchVideos.ts). Sprawdza
// przeglądarka administratora, tylko gdy strona panelu jest otwarta: przy wejściu do panelu (chyba że poprzednie
// sprawdzenie było niedawno) i potem co godzinę. Jedno sprawdzenie to 8 terminarzy z Genius (ok. 3 MB), więc
// częste wchodzenie do panelu nie pobiera ich za każdym razem. Wynik zapamiętuje przeglądarka — zakładki mają z czego
// pokazać czerwoną kropkę i listy także wtedy, gdy sprawdzenie przy wejściu jest pominięte.
const UNFINISHED_CHECK_MS = 60 * 60 * 1000;
const UNFINISHED_RECHECK_AFTER_MS = 15 * 60 * 1000;
const UNFINISHED_STORAGE_KEY = `${client.storagePrefix}-admin-match-check`;

interface UnfinishedCheck {
  matches?: UnfinishedMatch[];
  // Rozegrane mecze edycji (od najnowszego) i zapisane nagrania z YouTube (zakładka „Transmisje”).
  played?: PlayedMatch[];
  videos?: MatchVideos;
  failed: number;
  checkedAt?: Date;
  checking: boolean;
  error?: string;
}

type StoredCheck = Pick<UnfinishedCheck, 'matches' | 'played' | 'videos' | 'failed' | 'checkedAt'>;

function loadStoredCheck(): StoredCheck | undefined {
  try {
    const stored = JSON.parse(localStorage.getItem(UNFINISHED_STORAGE_KEY) ?? 'null') as StoredCheck | null;
    if (!stored?.checkedAt) return undefined;
    // Daty wracają z JSON jako tekst.
    const dated = <T extends { date: Date }>(items?: T[]) => items?.map((item) => ({ ...item, date: new Date(item.date) }));
    return { ...stored, checkedAt: new Date(stored.checkedAt), matches: dated(stored.matches), played: dated(stored.played) };
  } catch {
    return undefined;
  }
}

function saveStoredCheck({ matches, played, videos, failed, checkedAt }: UnfinishedCheck) {
  try {
    localStorage.setItem(UNFINISHED_STORAGE_KEY, JSON.stringify({ matches, played, videos, failed, checkedAt }));
  } catch {
    // Brak miejsca albo zablokowany storage — przy następnym wejściu sprawdzimy od nowa.
  }
}

function useUnfinishedMatches(enabled: boolean) {
  const [state, setState] = useState<UnfinishedCheck>(() => ({ failed: 0, ...loadStoredCheck(), checking: false }));
  const update = (change: (prev: UnfinishedCheck) => UnfinishedCheck) =>
    setState((prev) => {
      const next = change(prev);
      if (next.checkedAt) saveStoredCheck(next);
      return next;
    });
  const run = () =>
    checkUnfinishedMatches()
      .then(({ matches, played, upcoming, failed }) => {
        update((prev) => ({ ...prev, matches, played, failed, checkedAt: new Date(), checking: false }));
        // Przy okazji nagrania meczów: nowe dopasowania z listy kanału YouTube trafiają do bazy (matchVideos.ts).
        return syncMatchVideos([...played, ...upcoming])
          .then(({ videos }) => update((prev) => ({ ...prev, videos })))
          .catch(() => undefined);
      })
      .catch((e) => setState((prev) => ({ ...prev, checking: false, error: errorText(e) })));
  const check = () => {
    setState((prev) => ({ ...prev, checking: true, error: undefined }));
    run();
  };
  useEffect(() => {
    if (!enabled) return;
    const last = loadStoredCheck()?.checkedAt?.getTime() ?? 0;
    if (Date.now() - last > UNFINISHED_RECHECK_AFTER_MS) run();
    const timer = window.setInterval(run, UNFINISHED_CHECK_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run: zmienia się co render, licznik ma działać od wejścia do panelu
  }, [enabled]);
  const setVideos = (videos: MatchVideos) => update((prev) => ({ ...prev, videos }));
  return { ...state, check, setVideos };
}

const matchDateFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function UnfinishedMatchRow({ match }: { match: UnfinishedMatch }) {
  const found = findCompetition(match.competitionId);
  const score = match.homeScore || match.awayScore ? `${match.homeScore ?? 0} : ${match.awayScore ?? 0}` : undefined;
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-slate-100 py-3 text-sm last:border-0">
      <div className="min-w-0">
        <p className="font-semibold text-slate-900">
          {match.home} – {match.away}
          {score && <span className="ml-2 tabular-nums text-slate-600">{score}</span>}
        </p>
        <p className="text-xs text-slate-500">
          {found ? geniusLeagueName(found.leagueId) : `Rozgrywki ${match.competitionId}`} · {matchDateFormat.format(match.date)}
          {match.venue && ` · ${match.venue}`}
        </p>
        <p className={`text-xs ${match.kind === 'open' ? 'text-red-600' : 'text-amber-700'}`}>{match.reason}</p>
      </div>
      <Link to={`/mecze/${match.id}?rozgrywki=${match.competitionId}`} target="_blank" className={linkButtonClass}>
        Otwórz mecz →
      </Link>
    </li>
  );
}

function UnfinishedMatchesAdmin({ state }: { state: ReturnType<typeof useUnfinishedMatches> }) {
  const canCheck = isGeniusDomain() && !geniusSnapshot;
  const open = state.matches?.filter((match) => match.kind === 'open') ?? [];
  const notStarted = state.matches?.filter((match) => match.kind === 'notStarted') ?? [];
  return (
    <Card title="Niezamknięte mecze">
      <p className="mb-4 text-sm text-slate-600">
        Przy stoliku nie zawsze zamyka się protokół meczu. Taki mecz wisi w Genius jako trwający i <strong>nie trafia do tabeli</strong> (na pasku
        meczów pokazujemy go już jako zakończony). Zamknąć go można tylko na komputerze, na którym prowadzono statystyki tego meczu, a do tabeli
        trafi dopiero po zaimportowaniu go do bazy. Dlatego warto sprawdzać tę listę w trakcie weekendu meczowego — mecz niezamknięty na miejscu
        da się zamknąć dopiero przy kolejnych meczach, zwykle tydzień później. Sprawdzamy mecze bieżącej edycji ({currentGeniusEdition.name}): mecz
        uznajemy za niezamknięty, gdy trwa w Genius ponad 2,5 godziny albo gdy w tej samej hali zaczął się już następny mecz.
      </p>
      {!canCheck ? (
        <p className="text-sm text-slate-500">Sprawdzanie działa tylko na stronie ligi (Genius wydaje dane tylko jej domenie).</p>
      ) : state.matches === undefined ? (
        !state.error && <p className="text-sm text-slate-500">Sprawdzanie terminarzy…</p>
      ) : (
        <>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Do zamknięcia (na komputerze ze statystykami meczu)</h3>
          {open.length === 0 ? (
            <p className="mb-4 text-sm text-emerald-700">Brak — wszystkie rozegrane mecze są zamknięte.</p>
          ) : (
            <ul className="mb-4">
              {open.map((match) => (
                <UnfinishedMatchRow key={match.id} match={match} />
              ))}
            </ul>
          )}
          {notStarted.length > 0 && (
            <>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Termin minął, a mecz nie zaczął się w Genius</h3>
              <p className="mb-1 text-xs text-slate-500">Statystyk nie przesłano albo mecz przełożono (wtedy wystarczy zmienić termin w Genius).</p>
              <ul className="mb-4">
                {notStarted.map((match) => (
                  <UnfinishedMatchRow key={match.id} match={match} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {canCheck && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={buttonClass} disabled={state.checking} onClick={state.check}>
            {state.checking ? 'Sprawdzanie…' : 'Sprawdź ponownie'}
          </button>
          {state.checkedAt && (
            <span className="text-xs text-slate-500">Sprawdzono o {state.checkedAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}.</span>
          )}
        </div>
      )}
      {state.failed > 0 && (
        <p className="mt-3 text-sm text-amber-700">Genius nie oddał {state.failed} terminarzy — lista może być niepełna, sprawdź ponownie za chwilę.</p>
      )}
      <Message error={state.error} />
    </Card>
  );
}

// Osiągnięcia (zakładka „Osiągnięcia”): dla wybranych rozgrywek (edycja × liga) medale drużyn, nagrody indywidualne
// i medale dopisane zawodnikom ręcznie. Drużyny i zawodników (z występami i średnimi) bierzemy z Genius
// (geniusRosters.ts): medal drużyny trafia do wszystkich jej zawodników, a liderów statystyk podpowiadamy.
type AwardType = (typeof individualAwards)[number]['type'];

interface AwardDraft {
  playerId: string;
  playerName: string;
  teamId?: string;
  teamName?: string;
}

interface AchievementsDraft {
  // Miejsce → numer drużyny ("" — brak).
  medals: Record<MedalPlace, string>;
  awards: Partial<Record<AwardType, AwardDraft>>;
  manual: Achievement[];
}

const medalPlaces: MedalPlace[] = [1, 2, 3];

function draftFrom(items: Achievement[] = []): AchievementsDraft {
  const teamMedal = (place: MedalPlace) => items.find((item) => item.type === 'medal' && !item.playerId && item.place === place)?.teamId ?? '';
  return {
    medals: { 1: teamMedal(1), 2: teamMedal(2), 3: teamMedal(3) },
    awards: Object.fromEntries(
      items
        .filter((item) => item.type !== 'medal' && item.playerId)
        .map((item) => [item.type, { playerId: item.playerId!, playerName: item.playerName ?? '', teamId: item.teamId, teamName: item.teamName }]),
    ),
    manual: items.filter((item) => item.type === 'medal' && item.playerId),
  };
}

// Wybór zawodnika: zawodnicy z występami pogrupowani po drużynach; zapisany wcześniej, a nieobecny na liście
// (np. przed wczytaniem drużyn) — jako pierwsza pozycja.
function PlayerSelect({ teams, value, fallback, onChange, label }: { teams: RosterTeam[]; value: string; fallback?: string; onChange: (player?: { player: RosterPlayer; team: RosterTeam }) => void; label: string }) {
  const known = teams.some((team) => team.players.some((player) => player.id === value));
  return (
    <select
      className={inputClass}
      value={value}
      aria-label={label}
      onChange={(e) => {
        const team = teams.find((t) => t.players.some((player) => player.id === e.target.value));
        onChange(team && { team, player: team.players.find((player) => player.id === e.target.value)! });
      }}
    >
      <option value="">— brak —</option>
      {value && !known && <option value={value}>{fallback || value}</option>}
      {teams
        .filter((team) => team.players.length > 0)
        .map((team) => (
          <optgroup key={team.id} label={team.name}>
            {[...team.players]
              .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
              .map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
          </optgroup>
        ))}
    </select>
  );
}

// Transmisje (zakładka „Transmisje”): nagrania rozegranych meczów bieżącej edycji. Panel dopasowuje je sam
// (matchVideos.ts); tu można wkleić link, gdy tytuł filmu nie pasował, albo poprawić błędne dopasowanie.
const VIDEOS_PER_PAGE = 20;

function MatchVideoRow({ match, videoId, onSave }: { match: PlayedMatch; videoId?: string; onSave: (videoId: string | null) => Promise<void> }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const found = findCompetition(match.competitionId);
  const save = async (value: string | null) => {
    setError(undefined);
    const id = value === null ? null : youtubeVideoId(value);
    if (id === undefined) {
      setError('To nie wygląda na link do filmu YouTube.');
      return;
    }
    setBusy(true);
    try {
      await onSave(id);
      setDraft('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="grid gap-2 border-b border-slate-100 py-3 text-sm last:border-0 md:grid-cols-[1fr_22rem] md:items-center">
      <div className="min-w-0">
        <p className="font-semibold text-slate-900">
          {match.home} – {match.away}
          {(match.homeScore || match.awayScore) && (
            <span className="ml-2 tabular-nums text-slate-600">
              {match.homeScore ?? 0} : {match.awayScore ?? 0}
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500">
          {found ? geniusLeagueName(found.leagueId) : `Rozgrywki ${match.competitionId}`} · {matchDateFormat.format(match.date)} ·{' '}
          {videoId ? (
            <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noreferrer" className="font-medium text-red-600 hover:underline">
              nagranie na YouTube ↗
            </a>
          ) : (
            <span className="text-amber-700">bez nagrania</span>
          )}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          <input
            className={inputClass}
            placeholder={videoId ? 'Inny link do nagrania' : 'Wklej link do nagrania'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`Link do nagrania: ${match.home} – ${match.away}`}
          />
          <button type="button" className={smallButtonClass} disabled={busy || !draft.trim()} onClick={() => save(draft)}>
            Zapisz
          </button>
          {videoId && (
            <button type="button" className={dangerButtonClass} disabled={busy} onClick={() => save(null)}>
              Usuń
            </button>
          )}
        </div>
        {error && <span className="text-xs font-medium text-red-600">{error}</span>}
      </div>
    </li>
  );
}

function MatchVideosAdmin({ state }: { state: ReturnType<typeof useUnfinishedMatches> }) {
  const [page, setPage] = useState(1);
  const canCheck = isGeniusDomain() && !geniusSnapshot;
  const played = state.played ?? [];
  const videos = state.videos ?? {};
  const withVideo = played.filter((match) => videos[match.id]).length;
  const pageCount = Math.max(1, Math.ceil(played.length / VIDEOS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const save = async (matchId: string, videoId: string | null) => state.setVideos(await saveMatchVideos({ [matchId]: videoId }));
  return (
    <Card title="Transmisje">
      <p className="mb-4 text-sm text-slate-600">
        Na stronie meczu (zakładka Summary) jest link do nagrania na YouTube. Panel dopasowuje nagrania sam: przy wejściu do panelu (w dowolnej zakładce,
        najwyżej raz na 15 minut) i co godzinę przy otwartym panelu szuka na kanale ligi filmu z nazwami obu drużyn w tytule — także zaplanowanych transmisji na mecze najbliższych dwóch tygodni — i zapisuje go
        przy meczu. YouTube pokazuje tylko 15 najnowszych filmów, a kolejne transmisje wypychają starsze, dlatego zaglądaj do panelu raz w tygodniu. Gdy tytuł
        filmu nie pasował albo dopasowanie jest złe, wklej link ręcznie.
      </p>
      {!canCheck ? (
        <p className="text-sm text-slate-500">Dopasowywanie działa tylko na stronie ligi (terminarze z Genius).</p>
      ) : state.played === undefined ? (
        <p className="text-sm text-slate-500">Wczytywanie meczów bieżącej edycji…</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-500">
            Rozegrane mecze edycji {currentGeniusEdition.name}: {played.length}, z nagraniem: {withVideo}.
            {state.videos === undefined && ' Sprawdzanie nagrań…'}
          </p>
          <ul>
            {played.slice((currentPage - 1) * VIDEOS_PER_PAGE, currentPage * VIDEOS_PER_PAGE).map((match) => (
              <MatchVideoRow key={match.id} match={match} videoId={videos[match.id]} onSave={(videoId) => save(match.id, videoId)} />
            ))}
          </ul>
          <Pager page={currentPage} pageCount={pageCount} onChange={setPage} />
        </>
      )}
    </Card>
  );
}

const storedTeamNameOf = (stored: Achievement[] | undefined, teamId: string) => stored?.find((item) => item.teamId === teamId)?.teamName;

function AchievementsAdmin() {
  const achievements = useAchievements();
  // Domyślnie ostatnia zakończona edycja (osiągnięcia przyznaje się po sezonie).
  const [editionId, setEditionId] = useState((geniusEditions[1] ?? geniusEditions[0]).id);
  const leagues = editionLeagues(editionId);
  const [leagueChoice, setLeagueChoice] = useState<string>('eks');
  const league = leagues.find((item) => item.leagueId === leagueChoice) ?? leagues[0];
  const cid = league?.cid;
  const stored = cid ? achievements[cid] : undefined;
  const storedKey = JSON.stringify(stored ?? []);

  const [draftState, setDraftState] = useState<{ key: string; draft: AchievementsDraft }>();
  const draftKey = `${cid}:${storedKey}`;
  const draft = draftState?.key === draftKey ? draftState.draft : draftFrom(stored);
  const setDraft = (change: (draft: AchievementsDraft) => AchievementsDraft) => {
    setDraftState((prev) => ({ key: draftKey, draft: change(prev?.key === draftKey ? prev.draft : draftFrom(stored)) }));
    setSaved(undefined);
  };

  const [rosters, setRosters] = useState<{ cid: string; teams?: (RosterTeam & { failed?: boolean })[]; error?: string; progress?: string }>();
  const teams = rosters?.cid === cid ? (rosters.teams ?? []) : [];
  const [manualPlayer, setManualPlayer] = useState<{ player: RosterPlayer; team: RosterTeam }>();
  // Kadry drużyn z medalami ("<rozgrywki>:<drużyna>" → zgłoszeni zawodnicy) — medal ręczny dostają ci bez występów.
  const [teamRosters, setTeamRosters] = useState<Record<string, { id: string; name: string }[] | 'failed'>>({});
  const [manualPlace, setManualPlace] = useState<MedalPlace>(1);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [busy, setBusy] = useState(false);
  // Na domenie ligi z Genius, w wersji demonstracyjnej z migawki.
  const canLoad = isGeniusDomain() || geniusSnapshot;

  // Drużyny i zawodnicy wybranych rozgrywek z Genius (kilkanaście zapytań, ok. 15 s).
  useEffect(() => {
    if (!cid || !canLoad) return;
    let active = true;
    loadCompetitionRosters(Number(cid), (done, total) => {
      if (active) setRosters({ cid, progress: `${done} z ${total}` });
    })
      .then((loaded) => active && setRosters({ cid, teams: loaded }))
      .catch((e) => active && setRosters({ cid, error: errorText(e) }));
    return () => {
      active = false;
    };
  }, [cid, canLoad]);

  const medalTeamsKey = medalPlaces.map((place) => draft.medals[place]).join(',');
  useEffect(() => {
    if (!cid || !canLoad) return;
    medalTeamsKey
      .split(',')
      .filter(Boolean)
      .forEach((teamId) => {
        const key = `${cid}:${teamId}`;
        loadTeamRoster(Number(cid), teamId)
          .then((roster) => setTeamRosters((prev) => (prev[key] ? prev : { ...prev, [key]: roster })))
          .catch(() => setTeamRosters((prev) => (prev[key] ? prev : { ...prev, [key]: 'failed' })));
      });
  }, [cid, canLoad, medalTeamsKey]);

  const teamById = (id: string) => teams.find((team) => team.id === id);
  // Zawodnicy z kadry drużyny z wybranym medalem, którzy w niej nie zagrali (ci z występami mają medal z drużyną)
  // i nie mają jeszcze tego medalu dopisanego ręcznie.
  const manualTeamId = draft.medals[manualPlace];
  const manualRoster = manualTeamId && cid ? teamRosters[`${cid}:${manualTeamId}`] : undefined;
  const manualTeam = teamById(manualTeamId);
  const benchTeam: RosterTeam | undefined =
    manualTeamId && Array.isArray(manualRoster)
      ? {
          id: manualTeamId,
          name: manualTeam?.name ?? storedTeamNameOf(stored, manualTeamId) ?? manualTeamId,
          players: manualRoster
            .filter((player) => !manualTeam?.players.some((played) => played.id === player.id))
            .filter((player) => !draft.manual.some((item) => item.playerId === player.id && item.place === manualPlace))
            .map((player) => ({ ...player, games: 0, ppg: 0, rpg: 0, apg: 0 })),
        }
      : undefined;
  const storedTeamName = (id: string) => storedTeamNameOf(stored, id);

  const setAward = (type: AwardType, award?: AwardDraft) =>
    setDraft((prev) => {
      const awards = { ...prev.awards };
      if (award) awards[type] = award;
      else delete awards[type];
      return { ...prev, awards };
    });

  const suggest = (type: AwardType) => {
    const award = individualAwards.find((item) => item.type === type)!;
    const leader = award.stat && suggestLeader(teams, award.stat);
    if (!leader) return;
    setAward(type, {
      playerId: leader.player.id,
      playerName: leader.player.name,
      teamId: leader.team.id,
      teamName: leader.team.name,
    });
  };

  const items = (): Achievement[] => [
    ...medalPlaces.flatMap((place): Achievement[] => {
      const teamId = draft.medals[place];
      if (!teamId) return [];
      const team = teamById(teamId);
      const previous = stored?.find((item) => item.type === 'medal' && !item.playerId && item.teamId === teamId);
      // Bez wczytanych zawodników drużyny (Genius nie oddał statystyk) zostają zapisani wcześniej.
      const players = team && !('failed' in team && team.failed) ? team.players.map((player) => player.id) : (previous?.players ?? []);
      return [{ type: 'medal', place, teamId, teamName: team?.name ?? previous?.teamName ?? '', players }];
    }),
    ...individualAwards.flatMap(({ type }): Achievement[] => {
      const award = draft.awards[type];
      return award?.playerId ? [{ type, ...award }] : [];
    }),
    ...draft.manual,
  ];

  const save = async () => {
    if (!cid) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await adminRequest<{ achievements: AchievementsByCompetition }>('achievements-save', { cid, editionId, items: items() });
      setAchievements(result.achievements);
      setSaved(`Zapisano osiągnięcia: ${league.label}, edycja ${editionName(editionId)}.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const medalTeamPlayers = (teamId: string) => {
    const team = teamById(teamId);
    if (team) return 'failed' in team && team.failed ? 'Genius nie oddał zawodników — zostaną zapisani wcześniej wczytani' : `${team.players.length} zawodników z występami dostanie medal`;
    const previous = stored?.find((item) => item.teamId === teamId && !item.playerId);
    return previous?.players ? `${previous.players.length} zawodników (zapisanych)` : '';
  };

  return (
    <Card title="Osiągnięcia">
      <p className="mb-4 text-sm text-slate-600">
        Wybierz rozgrywki i wpisz medale drużyn oraz nagrody indywidualne. Medal drużyny pojawi się na stronie drużyny i u wszystkich jej zawodników, którzy zagrali w
        tych rozgrywkach (lista z Genius). Najlepszego strzelca, zbierającego i asystującego możesz podpowiedzieć ze statystyk (najwyższa średnia wśród zawodników z co
        najmniej połową meczów) i poprawić. Na dole dodasz medal zawodnikowi z kadry medalisty, który nie zagrał żadnego meczu.
      </p>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Edycja"
          value={editionId}
          onChange={setEditionId}
          options={geniusEditions.map((edition) => ({ value: edition.id, label: edition.name }))}
        />
        <FilterSelect label="Liga" value={league?.leagueId ?? ''} onChange={setLeagueChoice} options={leagues.map((item) => ({ value: item.leagueId, label: item.label }))} />
        <span className="pb-2 text-xs text-slate-500">
          {!canLoad
            ? 'Drużyny z Genius wczytują się tylko na stronie ligi.'
            : rosters?.cid !== cid || rosters.progress !== undefined
              ? `Wczytywanie drużyn i zawodników z Genius…${rosters?.cid === cid && rosters.progress ? ` (${rosters.progress})` : ''}`
              : rosters.error
                ? rosters.error
                : `Wczytano ${teams.length} drużyn.`}
        </span>
      </div>

      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Medale drużyn</h3>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {medalPlaces.map((place) => {
          const teamId = draft.medals[place];
          return (
            <Field key={place} label={`${medalIcons[place]} ${medalNames[place]}`} hint={teamId ? medalTeamPlayers(teamId) : undefined}>
              <select
                className={inputClass}
                value={teamId}
                onChange={(e) => setDraft((prev) => ({ ...prev, medals: { ...prev.medals, [place]: e.target.value } }))}
              >
                <option value="">— brak —</option>
                {teamId && !teamById(teamId) && <option value={teamId}>{storedTeamName(teamId) ?? teamId}</option>}
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </Field>
          );
        })}
      </div>

      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Nagrody indywidualne</h3>
      <div className="mb-5 flex flex-col gap-3">
        {individualAwards.map(({ type, label, stat }) => {
          const award = draft.awards[type];
          // MVP finału — tylko zawodnicy mistrza (złoty medal); bez wybranego mistrza wszyscy.
          const champion = type === 'finalsMvp' && draft.medals[1] ? teams.filter((team) => team.id === draft.medals[1]) : [];
          return (
            <div key={type} className={`grid items-center gap-2 ${stat ? 'sm:grid-cols-[12rem_1fr_auto]' : 'sm:grid-cols-[12rem_1fr]'}`}>
              <span className="text-sm font-semibold text-slate-900">{label}</span>
              <PlayerSelect
                teams={champion.length > 0 ? champion : teams}
                value={award?.playerId ?? ''}
                fallback={award?.playerName}
                label={label}
                onChange={(picked) =>
                  setAward(
                    type,
                    picked && { playerId: picked.player.id, playerName: picked.player.name, teamId: picked.team.id, teamName: picked.team.name },
                  )
                }
              />
              {stat && (
                <button type="button" className={smallButtonClass} disabled={teams.length === 0} onClick={() => suggest(type)}>
                  Podpowiedz
                </button>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Medale dodane zawodnikom ręcznie</h3>
      {draft.manual.length > 0 && (
        <ul className="mb-3 text-sm">
          {draft.manual.map((item, index) => (
            <li key={`${item.playerId}-${item.place}`} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
              <span>
                {medalIcons[item.place ?? 1]} <span className="font-semibold text-slate-900">{item.playerName}</span>
                {item.teamName && <span className="text-slate-500"> · {item.teamName}</span>}
              </span>
              <button
                type="button"
                className={dangerButtonClass}
                onClick={() => setDraft((prev) => ({ ...prev, manual: prev.manual.filter((_, i) => i !== index) }))}
              >
                Usuń
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mb-5 grid items-start gap-2 sm:grid-cols-[12rem_1fr_auto]">
        <select
          className={inputClass}
          value={manualPlace}
          aria-label="Medal"
          onChange={(e) => {
            setManualPlace(Number(e.target.value) as MedalPlace);
            setManualPlayer(undefined);
          }}
        >
          {medalPlaces.map((place) => (
            <option key={place} value={place}>
              {medalNames[place]}
            </option>
          ))}
        </select>
        <div className="flex flex-col gap-1">
          <PlayerSelect teams={benchTeam ? [benchTeam] : []} value={manualPlayer?.player.id ?? ''} label="Zawodnik" onChange={setManualPlayer} />
          <span className="text-xs text-slate-500">
            {!manualTeamId
              ? 'Najpierw wybierz drużynę z tym medalem.'
              : manualRoster === 'failed'
                ? 'Genius nie oddał kadry drużyny — spróbuj ponownie później.'
                : !benchTeam
                  ? 'Wczytywanie kadry drużyny…'
                  : benchTeam.players.length === 0
                    ? 'Wszyscy z kadry zagrali — mają medal z drużyną.'
                    : `Zawodnicy z kadry bez występów: ${benchTeam.players.length}.`}
          </span>
        </div>
        <button
          type="button"
          className={smallButtonClass}
          disabled={!manualPlayer}
          onClick={() => {
            if (!manualPlayer) return;
            const { player, team } = manualPlayer;
            setDraft((prev) => ({
              ...prev,
              manual: [...prev.manual, { type: 'medal', place: manualPlace, playerId: player.id, playerName: player.name, teamId: team.id, teamName: team.name }],
            }));
            setManualPlayer(undefined);
          }}
        >
          Dodaj medal
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={buttonClass} disabled={busy || !cid} onClick={save}>
          {busy ? 'Zapisywanie…' : 'Zapisz osiągnięcia'}
        </button>
        <Message error={error} success={saved} />
      </div>
    </Card>
  );
}

const tabs = [
  { id: 'aktualnosci', label: 'Aktualności' },
  { id: 'mecze', label: 'Niezamknięte mecze' },
  { id: 'transmisje', label: 'Transmisje' },
  { id: 'druzyny', label: 'Nazwy drużyn w edycjach' },
  { id: 'rekordy', label: 'Rekordy' },
  { id: 'strefy', label: 'Awanse/spadki' },
  { id: 'playoff', label: 'Play-off' },
  { id: 'osiagniecia', label: 'Osiągnięcia' },
  { id: 'formularz', label: 'Formularz zgłoszenia' },
  { id: 'sezony', label: 'Sezony Genius' },
  { id: 'odwiedziny', label: 'Odwiedziny' },
] as const;
type TabId = (typeof tabs)[number]['id'];

function AdminPage() {
  const admin = useAdmin();
  const [params, setParams] = useSearchParams();
  const tab: TabId = tabs.find((item) => item.id === params.get('zakladka'))?.id ?? 'aktualnosci';
  const unfinished = useUnfinishedMatches(Boolean(admin) && isGeniusDomain() && !geniusSnapshot);
  const openMatches = unfinished.matches?.filter((match) => match.kind === 'open').length ?? 0;

  const logout = async () => {
    await adminRequest('logout', {}).catch(() => undefined);
    setAdmin(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={admin ? 'Panel administratora' : 'Logowanie administratora'}
        icon={icons.rules}
        aside={
          admin && (
            <button type="button" className={buttonClass} onClick={logout}>
              Wyloguj
            </button>
          )
        }
      />
      {admin === undefined ? (
        <p className="py-10 text-center text-sm text-slate-500">Sprawdzanie sesji…</p>
      ) : !admin ? (
        <LoginForm />
      ) : (
        <>
          <div className="mb-5 flex gap-2 overflow-x-auto overflow-y-hidden border-b border-slate-200" role="tablist">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setParams(item.id === 'aktualnosci' ? {} : { zakladka: item.id })}
                className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition ${
                  tab === item.id ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {item.id === 'mecze' && openMatches > 0 && (
                  <span
                    className="ml-1.5 inline-grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 align-[1px] text-[10px] font-bold leading-none text-white"
                    aria-label={`${openMatches} do zamknięcia`}
                  >
                    {openMatches}
                  </span>
                )}
              </button>
            ))}
          </div>
          {tab === 'aktualnosci' ? (
            <NewsAdmin />
          ) : tab === 'mecze' ? (
            <UnfinishedMatchesAdmin state={unfinished} />
          ) : tab === 'transmisje' ? (
            <MatchVideosAdmin state={unfinished} />
          ) : tab === 'druzyny' ? (
            <TeamNamesAdmin />
          ) : tab === 'rekordy' ? (
            <RecordsAdmin />
          ) : tab === 'strefy' ? (
            <ZonesAdmin />
          ) : tab === 'playoff' ? (
            <PlayoffAdmin />
          ) : tab === 'osiagniecia' ? (
            <AchievementsAdmin />
          ) : tab === 'formularz' ? (
            <RegistrationFormAdmin />
          ) : tab === 'sezony' ? (
            <GeniusSeasonsAdmin />
          ) : (
            <VisitsAdmin />
          )}
        </>
      )}
    </div>
  );
}

export default AdminPage;
