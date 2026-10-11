import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilterSelect } from '../components/common/Filters';
import PageHeader from '../components/common/PageHeader';
import { icons } from '../components/common/icons';
import { geniusEditionById, geniusEditions, geniusJuniorCompetitions, geniusLeagueName, type GeniusLeagueId } from '../components/genius/geniusConfig';
import { fetchGeniusPage } from '../components/genius/geniusFetch';
import { loadStoredRecords, playedMatchIds, recomputeRecords, type RecordsProgress, type StoredRecords } from '../components/genius/geniusRecordsData';
import { formatNewsDate, news as dalkNews, newsCategories, newsCategory, newsPath } from '../data/news';
import { adminRequest, reloadSiteContent, setAdmin, useAdmin, useSiteContent, type AddedNewsItem } from '../data/siteContent';

// Panel administratora (link w stopce): logowanie, dodawanie aktualności i nazwy drużyn w poszczególnych edycjach.
// Uprawnienia sprawdza serwer (/api/admin) — ta strona tylko pokazuje formularze.

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition hover:border-orange-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20';
const buttonClass = 'rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-50';
const linkButtonClass = 'text-sm font-medium text-orange-600 hover:text-orange-700';
// Mniejsze przyciski w listach (Wyświetl, Edytuj, Usuń) — w stylu "Opublikuj".
const smallButtonClass = 'rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-40';
const dangerButtonClass = 'rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700';
const NEWS_PER_ADMIN_PAGE = 9;

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

function LoginForm() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await adminRequest('login', { login, password });
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
        <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </Field>
      <Message error={error} />
      <button type="submit" className={buttonClass} disabled={busy}>
        {busy ? 'Logowanie…' : 'Zaloguj'}
      </button>
    </form>
  );
}

// Okładki do wyboru: banery używane w aktualnościach z dalk.pl, bez okładki (kolor kategorii) albo własny adres.
const covers = [...new Set(dalkNews.map((item) => item.image))];
const coverLabel = (url: string) => url.split('/').pop()!;
const today = () => new Date().toLocaleDateString('sv-SE');
const emptyNews = { slug: '', title: '', date: '', excerpt: '', html: '', image: '', source: '' };

function NewsAdmin() {
  const { news } = useSiteContent();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
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
  const sortedNews = [...news].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const listPageCount = Math.max(1, Math.ceil(sortedNews.length / NEWS_PER_ADMIN_PAGE));
  const currentListPage = Math.min(listPage, listPageCount);
  const pageNews = sortedNews.slice((currentListPage - 1) * NEWS_PER_ADMIN_PAGE, currentListPage * NEWS_PER_ADMIN_PAGE);

  const fillForm = (item?: AddedNewsItem) => {
    setEditing(item?.slug);
    setTitle(item?.title ?? '');
    setDate(item?.date ?? today());
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
        date,
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
          <div className="grid gap-4 sm:grid-cols-3">
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
            <Field label="Data publikacji">
              <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
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
          <p className="text-sm text-slate-500">Brak — na stronie są tylko aktualności przeniesione z dalk.pl.</p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {pageNews.map((item) => (
                <li key={item.slug} className={`-mx-2 rounded-lg px-2 py-3 ${editing === item.slug ? 'bg-orange-50' : ''}`}>
                  <p className="truncate text-sm font-semibold text-slate-900" title={item.title}>
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatNewsDate(item.date)} · {newsCategory(item).label}
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
const editionCompetitions = (editionId: string) => {
  const edition = geniusEditionById.get(editionId);
  if (!edition) return [];
  return (Object.entries({ ...edition.competitions, ...geniusJuniorCompetitions[editionId] }) as [GeniusLeagueId, number][]).map(([leagueId, cid]) => ({
    value: String(cid),
    label: geniusLeagueName(leagueId),
  }));
};

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

const editionName = (editionId: string) => geniusEditionById.get(editionId)?.name ?? editionId;
const editionOrder = (editionId: string) => geniusEditions.findIndex((edition) => edition.id === editionId);

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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    loadTeams(cid)
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!team) return;
    setBusy(true);
    setError(undefined);
    setSaved(undefined);
    try {
      const { entry } = await adminRequest<{ entry: { logo?: string } }>('team-name-save', { teamId: team.id, editionId, name, geniusName: team.geniusName, logo });
      await reloadSiteContent();
      applySavedLogo(entry.logo);
      setSaved(`Zapisano: ${team.geniusName} → ${name}${entry.logo ? ' (z logo)' : ''} (edycja ${editionName(editionId)}).`);
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
          <Field label={`Nazwa w edycji ${editionName(editionId)}`}>
            <input className={`${inputClass} max-w-md`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} disabled={!team} required />
          </Field>
          {team && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Logo w edycji {editionName(editionId)}</span>
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
            <button type="submit" className={buttonClass} disabled={busy || !team}>
              {busy ? 'Zapisywanie…' : 'Zapisz'}
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
                {sorted.map((entry) => (
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

const tabs = [
  { id: 'aktualnosci', label: 'Aktualności' },
  { id: 'druzyny', label: 'Nazwy drużyn w edycjach' },
  { id: 'rekordy', label: 'Rekordy' },
  { id: 'odwiedziny', label: 'Odwiedziny' },
] as const;
type TabId = (typeof tabs)[number]['id'];

function AdminPage() {
  const admin = useAdmin();
  const [params, setParams] = useSearchParams();
  const tab: TabId = tabs.find((item) => item.id === params.get('zakladka'))?.id ?? 'aktualnosci';

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
          <div className="mb-5 flex gap-2 border-b border-slate-200" role="tablist">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setParams(item.id === 'aktualnosci' ? {} : { zakladka: item.id })}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
                  tab === item.id ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {tab === 'aktualnosci' ? <NewsAdmin /> : tab === 'druzyny' ? <TeamNamesAdmin /> : tab === 'rekordy' ? <RecordsAdmin /> : <VisitsAdmin />}
        </>
      )}
    </div>
  );
}

export default AdminPage;
