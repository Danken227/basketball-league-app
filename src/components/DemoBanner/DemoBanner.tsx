import { dataSource } from '../genius/geniusConfig';

// Pasek wersji demonstracyjnej: poza domeną ligi strona pokazuje dane testowe (wymyślone drużyny i wyniki),
// więc uprzedzamy o tym, żeby nikt nie wziął ich za prawdziwe.
function DemoBanner() {
  if (dataSource !== 'mock') return null;
  return (
    <div className="bg-amber-400 px-4 py-2 text-center text-xs font-semibold text-slate-950 sm:text-sm">
      Wersja demonstracyjna — wyniki, drużyny i zawodnicy to dane testowe. Prawdziwe dane Genius Sports pojawią się po uruchomieniu strony na domenie ligi.
    </div>
  );
}

export default DemoBanner;
