import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilterSelect } from '../components/common/Filters';
import PageHeader from '../components/common/PageHeader';
import { icons } from '../components/common/icons';
import { geniusEditionById, geniusEditions, geniusJuniorCompetitions, geniusLeagueName, type GeniusLeagueId } from '../components/genius/geniusConfig';
import { fetchGeniusPage } from '../components/genius/geniusFetch';
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

const tabs = [
  { id: 'aktualnosci', label: 'Aktualności' },
  { id: 'druzyny', label: 'Nazwy drużyn w edycjach' },
] as const;

function AdminPage() {
  const admin = useAdmin();
  const [params, setParams] = useSearchParams();
  const tab = params.get('zakladka') === 'druzyny' ? 'druzyny' : 'aktualnosci';

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
          {tab === 'aktualnosci' ? <NewsAdmin /> : <TeamNamesAdmin />}
        </>
      )}
    </div>
  );
}

export default AdminPage;
