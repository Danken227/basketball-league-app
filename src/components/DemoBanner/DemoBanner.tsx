import { useEffect, useState } from 'react';
import { dataSource } from '../genius/geniusConfig';
import { loadManifest } from '../genius/geniusSnapshot';

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

// Pasek wersji demonstracyjnej. Z danymi testowymi (wymyślone drużyny i wyniki) uprzedzamy, żeby nikt nie wziął
// ich za prawdziwe; z migawką danych Genius — że to zapis z danego dnia, bez aktualizacji na żywo.
// Data zapisu migawki: w buildzie wpisana przez vite.config.ts (pasek od razu ma docelowy tekst), na serwerze
// deweloperskim — z manifestu.
const builtSnapshotDate: string = import.meta.env.VITE_SNAPSHOT_CREATED_AT;

function DemoBanner() {
  const [snapshotDate, setSnapshotDate] = useState(builtSnapshotDate ? dateFormat.format(new Date(builtSnapshotDate)) : undefined);
  useEffect(() => {
    if (dataSource !== 'snapshot' || builtSnapshotDate) return;
    loadManifest().then((manifest) => {
      if (manifest) setSnapshotDate(dateFormat.format(new Date(manifest.createdAt)));
    });
  }, []);

  if (dataSource === 'genius') return null;
  return (
    <div className="bg-amber-400 px-4 py-2 text-center text-xs font-semibold text-slate-950 sm:text-sm">
      {dataSource === 'mock'
        ? 'Wersja demonstracyjna — wyniki, drużyny i zawodnicy to dane testowe. Prawdziwe dane Genius Sports pojawią się po uruchomieniu strony na domenie ligi.'
        : `Wersja demonstracyjna — zapis danych Genius Sports${snapshotDate ? ` z ${snapshotDate}` : ''} (edycje 2026/27 i 2026, bez aktualizacji na żywo).`}
    </div>
  );
}

export default DemoBanner;
