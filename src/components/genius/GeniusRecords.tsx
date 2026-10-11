import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { renameTeam, teamRenames, useSiteContent, type TeamNameEntry } from '../../data/siteContent';
import { findCompetition } from './geniusConfig';
import {
  loadRecordMatches,
  loadStoredRecords,
  recordCategories,
  topRecords,
  type MatchLines,
  type RecordField,
  type RecordRow,
  type RecordsProgress,
  type StoredRecords,
} from './geniusRecordsData';

// Strona rekordów rozgrywek. Rekordy przeliczone przez administratora (zapisane w bazie) pokazujemy od razu; gdy ich
// nie ma, liczymy je w przeglądarce ze statystyk meczów (geniusRecordsData) i zapamiętujemy mecze na dobę, więc
// kolejne wejście pobiera tylko nowe.

const STORAGE_PREFIX = 'genius-records-v1:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const TOP = 5;

function loadCached(cid: number): Record<string, MatchLines> {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_PREFIX + cid) ?? '{}') as Record<string, MatchLines>;
    return Object.fromEntries(Object.entries(stored).filter(([, match]) => Date.now() - match.savedAt < MAX_AGE_MS));
  } catch {
    return {};
  }
}

function saveCached(cid: number, matches: Record<string, MatchLines>) {
  try {
    localStorage.setItem(STORAGE_PREFIX + cid, JSON.stringify(matches));
  } catch {
    // Brak miejsca — rekordy zostają tylko na czas wizyty.
  }
}

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
// Data meczu z nagłówka Genius ("Oct 4, 2026, 8:30 PM" albo po tłumaczeniu "04.10.2026, 20:30").
function formatDate(text: string) {
  const pl = text.match(/^(\d{2}\.\d{2}\.\d{4})/);
  if (pl) return pl[1];
  const date = new Date(text.replace(/,(?=\s*\d{1,2}:)/, ''));
  return Number.isNaN(date.getTime()) ? text : dateFormat.format(date);
}

function RecordsTable({
  cid,
  title,
  unit,
  rows,
  field,
  renames,
}: {
  cid: number;
  title: string;
  unit: string;
  rows: RecordRow[];
  field: RecordField;
  renames: TeamNameEntry[];
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">Brak danych.</p>
      ) : (
        <ol>
          {rows.map((row, index) => (
            <li key={`${row.matchId}-${row.playerId}`} className="flex items-center gap-3 border-t border-slate-100 px-4 py-2.5 first:border-t-0">
              <span className="w-5 shrink-0 text-sm text-slate-400">{index + 1}.</span>
              <div className="min-w-0 flex-1">
                <Link to={`/zawodnicy/${row.playerId}?rozgrywki=${cid}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-orange-600">
                  {row.player}
                </Link>
                <p className="truncate text-xs text-slate-500">
                  {renameTeam(row.team, renames)} ·{' '}
                  <Link to={`/mecze/${row.matchId}?rozgrywki=${cid}&sekcja=boxscore`} className="hover:text-orange-600 hover:underline">
                    vs {renameTeam(row.opponent, renames)}
                  </Link>
                  {row.date && `, ${formatDate(row.date)}`}
                </p>
              </div>
              <span className={`shrink-0 text-right text-lg font-black tabular-nums ${index === 0 ? 'text-orange-600' : 'text-slate-900'}`}>
                {row[field]}
                <span className="ml-1 text-[10px] font-semibold text-slate-400">{unit}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RecordsView({ cid, records, note }: { cid: number; records: Record<RecordField, RecordRow[]>; note: string }) {
  // Nazwy drużyn z edycji tych rozgrywek (panel administratora).
  const renames = teamRenames(useSiteContent().teamNames, findCompetition(cid)?.editionId);
  return (
    <div className="mt-5">
      <p className="mb-3 text-xs text-slate-500">{note}</p>
      <div className="grid gap-4 md:grid-cols-3">
        {recordCategories.map(({ key, label, unit }) => (
          <RecordsTable key={key} cid={cid} title={label} unit={unit} rows={records[key].slice(0, TOP)} field={key} renames={renames} />
        ))}
      </div>
    </div>
  );
}

// Bez zapisanych rekordów: liczenie w przeglądarce, z postępem.
function ComputedRecords({ cid }: { cid: number }) {
  const [matches, setMatches] = useState<Record<string, MatchLines>>(() => loadCached(cid));
  const [progress, setProgress] = useState<RecordsProgress>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadRecordMatches(cid, {
      skip: loadCached(cid),
      isActive: () => active,
      onMatch: (id, match) =>
        setMatches((prev) => {
          const next = { ...prev, [id]: match };
          saveCached(cid, next);
          return next;
        }),
      onProgress: (next) => active && setProgress(next),
    }).finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [cid]);

  const records = useMemo(() => topRecords(matches, TOP), [matches]);
  const total = progress?.matchIds.length;
  const status =
    total === undefined
      ? ' Wczytywanie terminarza…'
      : loading
        ? ` Wczytywanie meczów: ${progress!.loaded} z ${total}…`
        : ` Mecze: ${progress!.loaded} z ${total}${progress!.failed ? ` (${progress!.failed} niedostępnych)` : ''}.`;
  return <RecordsView cid={cid} records={records} note={`Najwyższe zdobycze w jednym meczu, liczone ze statystyk rozegranych meczów.${status}`} />;
}

const computedAtFormat = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function GeniusRecords({ cid }: { cid: number }) {
  // undefined — sprawdzamy bazę; null — brak zapisanych (liczymy w przeglądarce).
  const [stored, setStored] = useState<StoredRecords | null>();
  useEffect(() => {
    let active = true;
    loadStoredRecords(cid)
      .catch(() => null)
      .then((records) => active && setStored(records));
    return () => {
      active = false;
    };
  }, [cid]);

  if (stored === undefined) return <p className="mt-5 text-xs text-slate-500">Wczytywanie rekordów…</p>;
  if (stored === null) return <ComputedRecords cid={cid} />;
  return (
    <RecordsView
      cid={cid}
      records={stored.top}
      note={`Najwyższe zdobycze w jednym meczu (${stored.matchCount} rozegranych meczów, stan z ${computedAtFormat.format(new Date(stored.computedAt))}).`}
    />
  );
}

export default GeniusRecords;
