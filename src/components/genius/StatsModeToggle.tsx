import type { StatsMode } from './GeniusEmbed';

const options: { value: StatsMode; label: string }[] = [
  { value: 'avg', label: 'Średnie' },
  { value: 'tot', label: 'Sumy' },
];

// Przełącznik widoku statystyk: średnie na mecz albo wartości sumaryczne (kolumny ukrywa GeniusEmbed).
function StatsModeToggle({ value, onChange }: { value: StatsMode; onChange: (mode: StatsMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Rodzaj statystyk" className="inline-flex rounded-full bg-slate-100 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            value === option.value ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default StatsModeToggle;
