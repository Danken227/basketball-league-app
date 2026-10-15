import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import PhotoDialog from '../common/PhotoDialog';
import type { CompareRow, Leader, LeaderCategory, PlayByPlayStats, SummaryData } from './matchSummaryData';

// Zakładka „Summary” meczu w układzie jak na plk.pl: liderzy meczu (TOP 5 z wyborem kategorii) po lewej, a po
// prawej przebieg meczu (wyniki kwart), statystyki drużynowe i rekordy. Dane z Genius (matchSummaryData.ts); to, co
// liczymy z zapisu akcji (pbp), dochodzi chwilę później — do tego czasu tych wierszy nie ma.

const categories: { id: LeaderCategory; label: string; unit: string }[] = [
  { id: 'pts', label: 'Punkty', unit: 'pkt' },
  { id: 'reb', label: 'Zbiórki', unit: 'zb.' },
  { id: 'ast', label: 'Asysty', unit: 'as.' },
  { id: 'stl', label: 'Przechwyty', unit: 'prz.' },
  { id: 'blk', label: 'Bloki', unit: 'bl.' },
  { id: 'eff', label: 'Eval', unit: 'eval' },
];

const teamRows: { key: string; label: string }[] = [
  { key: 'eff', label: 'Eval' },
  { key: 'fgm', label: 'Celne rzuty z gry' },
  { key: '2pm', label: 'Celne za 2' },
  { key: '3pm', label: 'Celne za 3' },
  { key: 'ftm', label: 'Celne rzuty wolne' },
  { key: 'ast', label: 'Asysty' },
  { key: 'blk', label: 'Bloki' },
  { key: 'pf', label: 'Faule' },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const minutes = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

// Wartość bez zbędnego ".0" (eval Genius podaje jako 30.0).
const statText = (value: string) => value.replace(/\.0$/, '');

// Genius podaje zdjęcie w kilku rozmiarach, rozróżnionych końcówką nazwy pliku: T1 (75 px — ta jest w tabelce
// liderów i na miniaturze była rozmyta), S1 (200 px), M1 (400 px), L1 (600 px — do powiększenia).
const photoSize = (src: string, size: 'S1' | 'M1' | 'L1') => src.replace(/[TSML]1(\.\w+)$/, `${size}$1`);

function Photo({ leader, big }: { leader: Leader; big: boolean }) {
  const size = big ? 'h-24 w-20' : 'h-14 w-12';
  return leader.photo ? (
    <PhotoDialog thumbnail={photoSize(leader.photo, big ? 'M1' : 'S1')} full={photoSize(leader.photo, 'L1')} alt={leader.name} className={`${size} !rounded-lg`} />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-lg bg-white/10 font-black text-white/70 ${big ? 'text-2xl' : 'text-sm'}`} aria-hidden="true">
      {initials(leader.name)}
    </span>
  );
}

function LeadersCard({ data }: { data: SummaryData }) {
  const available = categories.filter((category) => (data.leaders[category.id]?.length ?? 0) > 0);
  const [chosen, setChosen] = useState<LeaderCategory>('pts');
  const category = available.find((item) => item.id === chosen) ?? available[0];
  if (!category) return null;
  const leaders = data.leaders[category.id]!.slice(0, 5);
  return (
    <section className="keep-dark overflow-hidden rounded-xl bg-slate-950 text-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-black uppercase tracking-wider">Liderzy meczu</h2>
        <label className="relative">
          <span className="sr-only">Kategoria</span>
          <select
            value={category.id}
            onChange={(e) => setChosen(e.target.value as LeaderCategory)}
            className="appearance-none rounded-lg bg-white/10 py-1.5 pl-3 pr-8 text-xs font-bold uppercase tracking-wide text-white outline-none ring-1 ring-white/15 transition hover:bg-white/15 focus:ring-orange-400"
          >
            {available.map((item) => (
              <option key={item.id} value={item.id} className="bg-slate-900 text-white">
                {item.label}
              </option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-orange-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
          </svg>
        </label>
      </div>
      <ol>
        {leaders.map((leader, index) => {
          const big = index === 0;
          const team = leader.team !== undefined ? data.teams[leader.team] : undefined;
          return (
            <li key={`${leader.name}-${index}`} className={`flex items-center gap-3 border-b border-white/10 px-4 last:border-0 ${big ? 'py-4' : 'py-2.5'}`}>
              <span className="w-4 shrink-0 text-sm font-semibold text-white/50">{index + 1}</span>
              <Photo leader={leader} big={big} />
              <div className="min-w-0 flex-1">
                {leader.href ? (
                  <Link to={leader.href} className={`block truncate font-bold hover:text-orange-300 ${big ? 'text-lg' : 'text-sm'}`}>
                    {leader.name}
                  </Link>
                ) : (
                  <span className={`block truncate font-bold ${big ? 'text-lg' : 'text-sm'}`}>{leader.name}</span>
                )}
                {team && (
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-white/60">
                    {team.logo && <img src={team.logo} alt="" className="h-4 w-4 shrink-0 rounded-sm bg-white object-contain" />}
                    <span className="truncate">{team.name}</span>
                  </span>
                )}
              </div>
              <div className="shrink-0 text-right">
                <span className={`block font-black tabular-nums ${big ? 'text-3xl' : 'text-lg'}`}>{statText(leader.value)}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">{category.unit}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function TeamLogo({ data, side }: { data: SummaryData; side: 0 | 1 }) {
  const team = data.teams[side];
  // Białe podłoże kafelka także w trybie ciemnym (keep-dark przywraca w nim białą paletę) — loga są projektowane na jasne tło.
  return team.logo ? (
    <span className="keep-dark mx-auto grid h-9 w-9 place-items-center rounded-md bg-white p-0.5" title={team.name}>
      <img src={team.logo} alt={team.name} className="max-h-full max-w-full object-contain" />
    </span>
  ) : (
    <span className="text-xs font-bold text-slate-700">{initials(team.name)}</span>
  );
}

const periodLabel = (index: number) => (index < 4 ? `Kw ${index + 1}` : `Dogr. ${index - 3}`);

function ProgressCard({ data, pbp }: { data: SummaryData; pbp: PlayByPlayStats }) {
  const totals: [number, number] = [0, 0];
  const cumulative = pbp.periods.map(([home, away]) => {
    totals[0] += home;
    totals[1] += away;
    return [totals[0], totals[1]] as const;
  });
  return (
    <Card title="Przebieg meczu">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="w-10" />
              {pbp.periods.map((_, index) => (
                <th key={index} className="px-2 pb-2 text-center font-semibold">
                  {periodLabel(index)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {([0, 1] as const).map((side) => (
              <tr key={side} className="border-t border-slate-100">
                <td className="py-2">
                  <TeamLogo data={data} side={side} />
                </td>
                {pbp.periods.map((period, index) => (
                  <td key={index} className="px-2 py-2 text-center tabular-nums">
                    <span className="font-bold text-slate-900">{cumulative[index][side]}</span>{' '}
                    <span className="text-xs text-slate-500">{period[side]}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PairTable({ data, rows }: { data: SummaryData; rows: { label: string; home: string; away: string; single?: boolean }[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th />
          <th className="w-20 pb-2">
            <TeamLogo data={data} side={0} />
          </th>
          <th className="w-20 pb-2">
            <TeamLogo data={data} side={1} />
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-slate-100">
            <td className="py-2 pr-2 text-slate-600">{row.label}</td>
            {row.single ? (
              <td colSpan={2} className="py-2 text-center font-bold tabular-nums text-slate-900">
                {row.home}
              </td>
            ) : (
              <>
                <td className="py-2 text-center font-bold tabular-nums text-slate-900">{row.home}</td>
                <td className="py-2 text-center font-bold tabular-nums text-slate-900">{row.away}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MatchSummary({ data, pbp, videoUrl }: { data: SummaryData; pbp?: PlayByPlayStats; videoUrl?: string }) {
  const compare = new Map<string, CompareRow>(data.compare.map((row) => [row.key, row]));
  const pair = (key: string, label: string) => {
    const row = compare.get(key);
    return row ? [{ label, home: statText(row.home), away: statText(row.away) }] : [];
  };
  const teamStats = [
    ...teamRows.flatMap(({ key, label }) => pair(key, label)),
    ...(pbp ? [{ label: 'Punkty z ławki', home: String(pbp.benchPoints[0]), away: String(pbp.benchPoints[1]) }] : []),
  ];
  const records = [
    ...pair('lead', 'Najwyższe prowadzenie'),
    ...pair('run', 'Najdłuższa seria punktowa'),
    ...(pbp
      ? [
          { label: 'Zmiany prowadzenia', home: String(pbp.leadChanges), away: '', single: true },
          { label: 'Remisy', home: String(pbp.ties), away: '', single: true },
          { label: 'Czas prowadzenia', home: minutes(pbp.timeLeading[0]), away: minutes(pbp.timeLeading[1]) },
        ]
      : []),
  ];

  return (
    <div className="mt-6">
      {videoUrl && (
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          Transmisja:
          <a
            href={videoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-red-500"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15.1V8.9l5.8 3.1-5.8 3.1Z" />
            </svg>
            YouTube
          </a>
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <LeadersCard data={data} />
        <div className="flex flex-col gap-6">
          {pbp && <ProgressCard data={data} pbp={pbp} />}
          {teamStats.length > 0 && (
            <Card title="Drużynowe">
              <PairTable data={data} rows={teamStats} />
            </Card>
          )}
          {records.length > 0 && (
            <Card title="Rekordy">
              <PairTable data={data} rows={records} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default MatchSummary;
