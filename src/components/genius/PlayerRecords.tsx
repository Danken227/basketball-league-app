import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { geniusCacheKey } from './geniusCache';
import { findCompetition, geniusEditionById, geniusLeagueName, geniusSnapshot, type GeniusLeagueId } from './geniusConfig';
import { fetchGeniusJson, type GeniusPageOptions } from './geniusFetch';
import { loadSnapshot } from './geniusSnapshot';
import { parseScheduleDate } from './geniusUnfinished';

// Rekordy zawodnika (zakładka „Rekordy” na stronie zawodnika): najlepszy występ w każdej statystyce — w wybranej
// edycji albo w całej karierze. Liczymy je z linii meczów zawodnika (zakładka „Mecze”, w Genius gamelog: jeden
// wiersz na mecz z pełnym box score), czyli z tych samych danych co rekordy rozgrywek. Strona edycji tę zakładkę
// i tak wczytuje (te same zapytanie i opcje), więc rekordy sezonu nie dokładają zapytań; cała kariera dociąga
// zakładki „Mecze” pozostałych rozgrywek, w których zawodnik grał.

interface GameLine {
  cid: number;
  matchId?: string;
  opponent: string;
  date?: Date;
  values: Partial<Record<StatKey, number>>;
}

type StatKey = 'pts' | 'reb' | 'off' | 'def' | 'ast' | 'stl' | 'blk' | 'eff' | 'min' | '2pm' | '3pm' | 'ftm';

// Statystyki w tabeli i kolumny Genius (nagłówki po angielsku; po tłumaczeniu oryginał zostaje w data-genius-label).
const stats: { key: StatKey; label: string; column: string }[] = [
  { key: 'pts', label: 'Punkty', column: 'PTS' },
  { key: 'reb', label: 'Zbiórki', column: 'REB' },
  { key: 'off', label: 'Zbiórki w ataku', column: 'OFF' },
  { key: 'def', label: 'Zbiórki w obronie', column: 'DEF' },
  { key: 'ast', label: 'Asysty', column: 'AST' },
  { key: 'stl', label: 'Przechwyty', column: 'STL' },
  { key: 'blk', label: 'Bloki', column: 'BLK' },
  { key: 'eff', label: 'Eval', column: 'EFF' },
  { key: 'min', label: 'Minuty', column: 'MINS' },
  { key: '2pm', label: 'Celne rzuty za 2', column: '2PM' },
  { key: '3pm', label: 'Celne rzuty za 3', column: '3PM' },
  { key: 'ftm', label: 'Celne rzuty wolne', column: 'FTM' },
];

// Opcje jak w blokach lig na stronie zawodnika (LeagueBlock) — to samo zapytanie i ten sam wpis w migawce.
const GAMELOG_OPTIONS: GeniusPageOptions = { showTitle: true, showSubMenus: false };
const ATTEMPTS = 3;
const PARALLEL = 3;

async function loadGamelog(personId: string, cid: number): Promise<HTMLElement | undefined> {
  const page = `/competition/${cid}/person/${personId}/gamelog`;
  const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html').body;
  if (geniusSnapshot) {
    const html = await loadSnapshot(geniusCacheKey({ page, ...GAMELOG_OPTIONS }));
    return html ? parse(html) : undefined;
  }
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const json = await fetchGeniusJson(attempt ? `${page}?r=${Date.now()}&` : page, GAMELOG_OPTIONS).catch(() => undefined);
    if (json?.html?.includes(`_comp_${cid}`)) return parse(json.html);
  }
  return undefined;
}

// "35:43" → 35,72 minuty (do porównań); pozostałe kolumny to liczby.
const cellValue = (key: StatKey, text: string) => {
  if (key === 'min') {
    const m = text.match(/(\d+):(\d{2})/);
    return m ? Number(m[1]) + Number(m[2]) / 60 : undefined;
  }
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) && text !== '' ? value : undefined;
};

// Wiersze tabeli „Mecze”: rywal (pierwsza kolumna), data z linkiem do meczu, potem statystyki.
function readGamelog(root: HTMLElement, cid: number): GameLine[] {
  const table = root.querySelector('table');
  if (!table) return [];
  const heads = [...(table.tHead?.rows[0]?.cells ?? [])].map((th) => (th.dataset.geniusLabel ?? th.textContent ?? '').trim().toUpperCase());
  return [...table.tBodies].flatMap((body) =>
    [...body.rows].flatMap((row) => {
      const cells = [...row.cells];
      const dateLink = cells[1]?.querySelector('a');
      if (cells.length < heads.length || !dateLink) return [];
      const values: GameLine['values'] = {};
      for (const { key, column } of stats) {
        const index = heads.indexOf(column);
        const value = index < 0 ? undefined : cellValue(key, cells[index].textContent?.trim() ?? '');
        if (value !== undefined) values[key] = value;
      }
      return [
        {
          cid,
          matchId: decodeURIComponent(dateLink.getAttribute('href') ?? '').match(/\/(?:match|mecze)\/(\d+)/)?.[1],
          opponent: cells[0].textContent?.replace(/\s+/g, ' ').trim() ?? '',
          date: parseScheduleDate(dateLink.textContent ?? ''),
          values,
        },
      ];
    }),
  );
}

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });

const shown = (key: StatKey, value: number) =>
  key === 'min' ? `${Math.floor(value)}:${String(Math.round((value % 1) * 60)).padStart(2, '0')}` : String(Number.isInteger(value) ? value : value.toFixed(1));

// Rekord w statystyce: najwyższa wartość; przy remisie najnowszy mecz (i ile razy ją osiągnął).
function bestOf(lines: GameLine[], key: StatKey) {
  let best: GameLine | undefined;
  let times = 0;
  for (const line of lines) {
    const value = line.values[key];
    if (value === undefined) continue;
    const current = best?.values[key];
    if (current === undefined || value > current) {
      best = line;
      times = 1;
    } else if (value === current) {
      times++;
      if ((line.date?.getTime() ?? 0) > (best!.date?.getTime() ?? 0)) best = line;
    }
  }
  return best && best.values[key]! > 0 ? { line: best, times } : undefined;
}

function PlayerRecords({ personId, seasonCids, careerCids, seasonName }: { personId: string; seasonCids: number[]; careerCids: number[]; seasonName: string }) {
  const [scope, setScope] = useState<'season' | 'career'>('season');
  const cids = scope === 'season' ? seasonCids : careerCids;
  const cidsKey = cids.join(',');
  // Linie meczów po rozgrywkach (undefined — jeszcze nie wczytane, null — Genius nie oddał).
  const [loaded, setLoaded] = useState<Record<string, GameLine[] | null>>({});

  useEffect(() => {
    let active = true;
    const missing = cidsKey
      .split(',')
      .filter(Boolean)
      .map(Number)
      .filter((cid) => loaded[`${personId}:${cid}`] === undefined);
    (async () => {
      for (let i = 0; i < missing.length; i += PARALLEL) {
        const batch = await Promise.all(
          missing.slice(i, i + PARALLEL).map(async (cid) => {
            const root = await loadGamelog(personId, cid);
            return [`${personId}:${cid}`, root ? readGamelog(root, cid) : null] as const;
          }),
        );
        if (!active) return;
        setLoaded((prev) => ({ ...prev, ...Object.fromEntries(batch) }));
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loaded: tylko do pominięcia już wczytanych
  }, [personId, cidsKey]);

  const parts = cids.map((cid) => loaded[`${personId}:${cid}`]);
  const done = parts.filter((part) => part !== undefined).length;
  const failed = parts.filter((part) => part === null).length;
  const lines = parts.flatMap((part) => part ?? []);

  const scopeButton = (value: 'season' | 'career', label: string) => (
    <button
      type="button"
      onClick={() => setScope(value)}
      aria-pressed={scope === value}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        scope === value ? 'bg-orange-500 text-slate-950' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black text-slate-900">Rekordowe występy</h2>
        <div className="flex gap-2">
          {scopeButton('season', `Edycja ${seasonName}`)}
          {scopeButton('career', 'Cała kariera')}
        </div>
      </div>
      {done < cids.length && (
        <p className="mb-3 text-sm text-slate-500">
          Wczytywanie meczów zawodnika{cids.length > 1 ? ` (${done} z ${cids.length} rozgrywek)` : ''}…
        </p>
      )}
      {done === cids.length && lines.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          {failed > 0
            ? geniusSnapshot
              ? 'Meczów tego zawodnika nie ma w wersji demonstracyjnej (zapis danych Genius Sports).'
              : 'Genius Sports nie zwrócił meczów zawodnika. Spróbuj odświeżyć stronę za chwilę.'
            : 'Brak rozegranych meczów.'}
        </p>
      ) : (
        lines.length > 0 && (
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Statystyka</th>
                  <th className="px-4 py-3 text-right font-semibold">Ile</th>
                  <th className="px-4 py-3 font-semibold">Mecz</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(({ key, label }) => {
                  const best = bestOf(lines, key);
                  const found = best && findCompetition(best.line.cid);
                  const edition = found && geniusEditionById.get(found.editionId);
                  return (
                    <tr key={key} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{label}</td>
                      <td className="px-4 py-2.5 text-right text-base font-black tabular-nums text-slate-900">{best ? shown(key, best.line.values[key]!) : '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {best && (
                          <>
                            {best.line.matchId ? (
                              <Link
                                to={`/mecze/${best.line.matchId}?rozgrywki=${best.line.cid}&sekcja=boxscore`}
                                className="font-semibold text-slate-900 hover:text-orange-600 hover:underline"
                              >
                                vs {best.line.opponent}
                              </Link>
                            ) : (
                              <span className="font-semibold text-slate-900">vs {best.line.opponent}</span>
                            )}
                            <span className="text-xs text-slate-500">
                              {best.line.date && ` · ${dateFormat.format(best.line.date)}`}
                              {scope === 'career' && found && ` · ${geniusLeagueName(found.leagueId as GeniusLeagueId)} ${edition?.name ?? ''}`}
                              {best.times > 1 && ` · ${best.times} razy`}
                            </span>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
      {done === cids.length && failed > 0 && lines.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">Genius nie oddał meczów z {failed} rozgrywek — rekordy mogą być niepełne. Odśwież stronę za chwilę.</p>
      )}
    </section>
  );
}

export default PlayerRecords;
